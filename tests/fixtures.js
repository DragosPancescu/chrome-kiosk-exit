const { test: base, chromium, expect } = require("@playwright/test");
const http = require("http");
const path = require("path");

const EXTENSION_PATH = path.resolve(__dirname, "..", "src");

const TEST_PAGE = `<!DOCTYPE html>
<html lang="en">
<head><title>Kiosk test page</title></head>
<body><h1>Kiosk test page</h1></body>
</html>`;

const test = base.extend({
    // Extra Chromium flags for a test, e.g. test.use({ launchArgs: ["--kiosk"] })
    launchArgs: [[], { option: true }],

    // The extension only injects into http(s) pages, so serve one locally
    pageUrl: async ({ }, use) => {
        const server = http.createServer((_, response) => {
            response.writeHead(200, { "Content-Type": "text/html" });
            response.end(TEST_PAGE);
        });
        await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));

        await use(`http://127.0.0.1:${server.address().port}/`);

        // Don't wait for the browser's keep-alive connections to time out
        server.closeAllConnections();
        await new Promise(resolve => server.close(resolve));
    },

    // A fresh browser profile with the extension loaded. Extensions need a headed
    // browser: headless windows have no real fullscreen state to detect.
    context: async ({ launchArgs }, use) => {
        const context = await chromium.launchPersistentContext("", {
            channel: "chromium",
            headless: false,
            // Use the real window size. Playwright's default fixed viewport would stop
            // --kiosk and fullscreen changes from ever reaching the page.
            viewport: null,
            args: [
                `--disable-extensions-except=${EXTENSION_PATH}`,
                `--load-extension=${EXTENSION_PATH}`,
                // Tests assert English strings; don't follow the machine's UI language
                "--lang=en-US",
                ...launchArgs
            ]
        });

        await use(context);

        // Already gone when the test closed the last window through the exit button
        await context.close().catch(() => { });
    },

    // The extension's background service worker, for chrome.* calls from tests
    background: async ({ context }, use) => {
        const worker = context.serviceWorkers()[0] ?? await context.waitForEvent("serviceworker");
        await use(worker);
    },

    extensionId: async ({ background }, use) => {
        await use(new URL(background.url()).host);
    },

    page: async ({ context }, use) => {
        await use(context.pages()[0] ?? await context.newPage());
    }
});

// Puts the browser window into the given state ("fullscreen", "normal", ...) and waits
// until Chrome reports it. Fullscreen is what the extension treats as kiosk mode.
async function setWindowState(background, state) {
    await background.evaluate(async (targetState) => {
        const [win] = await chrome.windows.getAll();
        await chrome.windows.update(win.id, { state: targetState });
    }, state);

    await expect.poll(
        () => background.evaluate(async () => (await chrome.windows.getAll())[0].state)
    ).toBe(state);
}

function saveSettings(background, settings) {
    return background.evaluate(values => chrome.storage.local.set(values), settings);
}

const exitButton = (page) => page.locator("#kiosk-exit-button");

const windowState = (background) =>
    background.evaluate(async () => (await chrome.windows.getAll())[0].state);

// Same-document navigation, the way single-page apps move between routes. Chrome
// reports the tab as loaded again, so the background re-runs its injection.
const navigateInPage = (page, url) =>
    page.evaluate(target => history.pushState({}, "", target), url);

module.exports = { test, expect, setWindowState, saveSettings, exitButton, windowState, navigateInPage };
