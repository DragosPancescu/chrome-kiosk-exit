const { test, expect, setWindowState, saveSettings, exitButton, windowState, navigateInPage } = require("./fixtures");

test.describe("launched with --kiosk", () => {
    test.use({ launchArgs: ["--kiosk"] });

    test("shows the button and closes the window when it is clicked", async ({ page, pageUrl }) => {
        await page.goto(pageUrl);

        const button = exitButton(page);
        await expect(button).toHaveCSS("opacity", "1");
        await expect(button).toHaveCSS("position", "fixed");

        const closed = page.waitForEvent("close");
        await button.click();
        await closed;
    });
});

test("does not inject the button into a normal window", async ({ page, pageUrl, background }) => {
    await page.goto(pageUrl);

    // Injection is asynchronous, so give it a chance to (wrongly) happen
    await page.waitForTimeout(1500);
    await expect(exitButton(page)).toHaveCount(0);

    // Sanity check that the window really isn't seen as kiosk
    const state = await background.evaluate(async () => (await chrome.windows.getAll())[0].state);
    expect(state).not.toBe("fullscreen");
});

test("hides the button and refuses to close once the window leaves fullscreen", async ({ page, pageUrl, background }) => {
    await setWindowState(background, "fullscreen");
    await page.goto(pageUrl);

    const button = exitButton(page);
    await expect(button).toHaveCSS("opacity", "1");

    await setWindowState(background, "normal");
    await expect(button).toHaveCSS("opacity", "0");
    await expect(button).toHaveCSS("pointer-events", "none");

    // Even a click that gets through must not close a window that is no longer kiosk
    await button.dispatchEvent("click");
    await page.waitForTimeout(1000);
    expect(page.isClosed()).toBe(false);

    // Going fullscreen again brings the button back
    await setWindowState(background, "fullscreen");
    await expect(button).toHaveCSS("opacity", "1");
});

test("auto-hides, comes back on a tap that does not close, then closes on the next click", async ({ page, pageUrl, background }) => {
    // Long enough that the button is still showing for the second click below
    await saveSettings(background, { buttonAutoHideDelay: 2 });
    await setWindowState(background, "fullscreen");
    await page.goto(pageUrl);

    const button = exitButton(page);
    await expect(button).toHaveCSS("opacity", "1");
    await expect(button).toHaveCSS("opacity", "0");

    // Hidden, but still there to be tapped
    await expect(button).toHaveCSS("pointer-events", "auto");

    const box = await button.boundingBox();
    const x = box.x + box.width / 2;
    const y = box.y + box.height / 2;

    // The click that reveals the button must not also close the window
    await page.mouse.click(x, y);
    await expect(button).toHaveCSS("opacity", "1");
    await page.waitForTimeout(600);
    expect(page.isClosed()).toBe(false);

    // Now it is visible and past the grace period, so this one exits
    const closed = page.waitForEvent("close");
    await page.mouse.click(x, y);
    await closed;
});

test("puts the button back after the page replaces its body", async ({ page, pageUrl, background }) => {
    await setWindowState(background, "fullscreen");
    await page.goto(pageUrl);

    const button = exitButton(page);
    await expect(button).toHaveCSS("opacity", "1");

    // What Turbo/pjax style navigation does: new body, new URL, same document
    // The URL change makes Chrome report the tab as loaded again, which re-runs the
    // content script in the same document.
    await page.evaluate(() => {
        document.body = document.createElement("body");
        history.pushState({}, "", "/next");
    });

    await expect(button).toHaveCount(1);
    await expect(button).toHaveCSS("opacity", "1");
});

test("applies settings saved in the options page to a page that is already open", async ({ context, page, pageUrl, background, extensionId }) => {
    await setWindowState(background, "fullscreen");
    await page.goto(pageUrl);

    const button = exitButton(page);
    await expect(button).toHaveCSS("opacity", "1");
    await expect(button.locator("img")).toHaveCount(1); // default is the image button

    const options = await context.newPage();
    await options.goto(`chrome-extension://${extensionId}/options.html`);

    await options.locator('label[for="textType"]').click();
    await options.locator("#buttonText").fill("EXIT");
    await options.locator("#buttonPosition").selectOption("bottom-left");
    await options.locator("#save").click();
    await expect(options.locator("#statusTitle")).toHaveText("Success!");

    await expect(button).toHaveText("EXIT");
    await expect(button).toHaveClass(/kiosk-exit-button-bottom-left/);
    await expect(button.locator("img")).toHaveCount(0);
});

test("options page loads without any network requests", async ({ context, extensionId }) => {
    const external = [];
    context.on("request", request => {
        if (/^https?:/.test(request.url())) external.push(request.url());
    });

    const options = await context.newPage();
    await options.goto(`chrome-extension://${extensionId}/options.html`);
    await expect(options.locator("#buttonPreview img")).toHaveCount(1);

    const popup = await context.newPage();
    await popup.goto(`chrome-extension://${extensionId}/popup.html`);
    await expect(popup.locator("#status")).toContainText("kiosk mode");

    expect(external).toEqual([]);
});

test("still shows the default button when the saved settings cannot be read", async ({ page, pageUrl, background }) => {
    // Load the page in a normal window first, so nothing is injected yet
    await page.goto(pageUrl);

    // Break the settings read inside the extension's world of this page. Scripts the
    // extension injects later into the same document share that world.
    await background.evaluate(async () => {
        const [tab] = await chrome.tabs.query({ active: true });
        await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: () => {
                chrome.storage.local.get = (_, callback) => callback(undefined);
            }
        });
    });

    await setWindowState(background, "fullscreen");
    await navigateInPage(page, "/after-fullscreen");

    const button = exitButton(page);
    await expect(button).toHaveCSS("opacity", "1");
    await expect(button).toHaveClass(/kiosk-exit-button-top-right/);
    await expect(button.locator("img")).toHaveAttribute("src", /images\/default\.png$/);
});

test("keeps a single button and a single stylesheet across tab switches and in-page navigation", async ({ context, page, pageUrl, background }) => {
    // Count how often the background inserts the stylesheet
    await background.evaluate(() => {
        const insertCSS = chrome.scripting.insertCSS.bind(chrome.scripting);
        self.cssInsertions = 0;
        chrome.scripting.insertCSS = (...args) => {
            self.cssInsertions++;
            return insertCSS(...args);
        };
    });

    await setWindowState(background, "fullscreen");
    await page.goto(pageUrl);

    const button = exitButton(page);
    await expect(button).toHaveCSS("opacity", "1");

    for (const route of ["/one", "/two", "/three"]) {
        await navigateInPage(page, route);
        await page.waitForTimeout(300);
    }

    // Switch to another tab and back
    const other = await context.newPage();
    await other.goto(`${pageUrl}other`);
    await expect(exitButton(other)).toHaveCSS("opacity", "1");
    await page.bringToFront();
    await page.waitForTimeout(500);

    await expect(button).toHaveCount(1);
    await expect(button).toHaveCSS("opacity", "1");

    // One for each of the two documents, however often they were re-injected
    expect(await background.evaluate(() => self.cssInsertions)).toBe(2);
});

// Chromium refuses real element fullscreen under automation ("not granted"), so this
// test fakes what the content script would see: document.fullscreenElement being set
// while the window is fullscreen.
test("stays hidden when a page element, like a video, made a normal window fullscreen", async ({ page, pageUrl, background }) => {
    const setElementFullscreen = (active) => background.evaluate(async (isActive) => {
        const [tab] = await chrome.tabs.query({ active: true });
        await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            args: [isActive],
            func: (value) => {
                Object.defineProperty(document, "fullscreenElement", {
                    configurable: true,
                    get: () => value ? document.documentElement : null
                });
                document.dispatchEvent(new Event("fullscreenchange"));
            }
        });
    }, active);

    await page.goto(pageUrl);

    // The video goes fullscreen, taking the window with it
    await setElementFullscreen(true);
    await setWindowState(background, "fullscreen");

    // e.g. autoplay moving on to the next video: the window now looks like kiosk mode,
    // so the button gets injected
    await navigateInPage(page, "/next-video");

    const button = exitButton(page);
    await expect(button).toHaveCount(1);
    await page.waitForTimeout(1000);
    await expect(button).toHaveCSS("opacity", "0");
    await expect(button).toHaveCSS("pointer-events", "none");

    // Back to a normal window: the button must not show up now either
    await setWindowState(background, "normal");
    await setElementFullscreen(false);
    await page.waitForTimeout(1000);
    await expect(button).toHaveCSS("opacity", "0");
    await expect(button).toHaveCSS("pointer-events", "none");

    await button.dispatchEvent("click");
    await page.waitForTimeout(1000);
    expect(page.isClosed()).toBe(false);
});

test("an auto-hidden button comes back on touch, without any mouse events", async ({ page, pageUrl, background }) => {
    await saveSettings(background, { buttonAutoHideDelay: 1 });
    await setWindowState(background, "fullscreen");
    await page.goto(pageUrl);

    const button = exitButton(page);
    await expect(button).toHaveCSS("opacity", "1");
    await expect(button).toHaveCSS("opacity", "0");

    // A finger landing on the hidden button: touchstart, then the click it produces
    await button.dispatchEvent("touchstart");
    await button.dispatchEvent("click");

    await expect(button).toHaveCSS("opacity", "1");
    expect(page.isClosed()).toBe(false);
});

test("options page validates the auto-hide delay without trapping focus", async ({ context, extensionId }) => {
    const options = await context.newPage();
    await options.goto(`chrome-extension://${extensionId}/options.html`);

    const delay = options.locator("#autoHideDelay");
    const save = options.locator("#save");
    await expect(delay).toHaveValue("0");
    await expect(save).toBeEnabled();

    // Clearing the field and moving on must leave the focus where the user put it
    await delay.fill("");
    await options.locator("#buttonPosition").click();
    await expect(options.locator("#buttonPosition")).toBeFocused();
    await expect(save).toBeDisabled();

    for (const invalid of ["301", "1.5", "-1"]) {
        await delay.fill(invalid);
        await expect(save).toBeDisabled();
    }

    await delay.fill("30");
    await expect(save).toBeEnabled();
});

test("popup reports whether its window is in kiosk mode", async ({ context, background, extensionId }) => {
    const popup = await context.newPage();
    await popup.goto(`chrome-extension://${extensionId}/popup.html`);
    await expect(popup.locator("#status")).toContainText("Inactive: Not in kiosk mode");

    await setWindowState(background, "fullscreen");
    await popup.reload();
    await expect(popup.locator("#status")).toContainText("Active: Kiosk mode detected");
});
