// Picks the display a window actually sits on, so multi-monitor setups are measured
// against the right screen. Falls back to the primary display.
function findDisplayForWindow(displays, win) {
    const centerX = (win.left ?? 0) + (win.width ?? 0) / 2;
    const centerY = (win.top ?? 0) + (win.height ?? 0) / 2;

    const containing = displays.find(({ bounds }) => (
        centerX >= bounds.left && centerX < bounds.left + bounds.width &&
        centerY >= bounds.top && centerY < bounds.top + bounds.height
    ));

    return containing || displays.find(display => display.isPrimary) || displays[0];
}

// Checks whether a window looks like it is running in kiosk mode.
// Pass a windowId to check a specific window, or omit it to check the focused one.
// Chrome has no API for the --kiosk flag, so a fullscreen window is the best signal there is.
async function isKioskMode(windowId) {
    const win = typeof windowId === "number"
        ? await chrome.windows.get(windowId)
        : await chrome.windows.getCurrent();

    if (win.state === "fullscreen") return true;

    // Fallback for platforms that don't report the state: the window covers its display
    const displays = await chrome.system.display.getInfo();
    if (!displays || displays.length === 0) {
        throw new Error("Error getting display info.");
    }

    const { bounds } = findDisplayForWindow(displays, win);
    return win.width === bounds.width && win.height === bounds.height;
}

// Injects into the given tab, as long as its own window is in kiosk mode.
// Safe to call repeatedly: content.js keeps a single button per document and asks
// for its stylesheet (INSERT_CSS) only the first time it runs there.
async function injectCloseButton(tab) {
    try {
        if (!tab?.url?.startsWith("http")) return;
        if (!await isKioskMode(tab.windowId)) return;

        await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            files: ["defaults.js", "content.js"]
        });
    } catch (error) {
        console.error(`Error injecting the kiosk exit button: ${error}`);
    }
}

// Used on startup/install, where no particular tab triggered the injection.
async function injectIntoActiveTab() {
    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        await injectCloseButton(tab);
    } catch (error) {
        console.error(`Error finding the active tab: ${error}`);
    }
}

async function closeKioskWindow(sender) {
    // Close the window the click came from, not whichever one happens to be focused.
    const senderWindowId = sender?.tab?.windowId;
    const windowId = typeof senderWindowId === "number"
        ? senderWindowId
        : (await chrome.windows.getCurrent()).id;

    // A button left over from a fullscreen session must not close a normal window.
    // If the check itself fails, close anyway: a kiosk with no way out is worse.
    const stillKiosk = await isKioskMode(windowId).catch(() => true);
    if (!stillKiosk) return { success: false };

    // Give the response a moment to reach the page before the window goes away
    setTimeout(() => {
        chrome.windows.remove(windowId)
            .catch(error => console.error(`Error closing kiosk window: ${error}`));
    }, 50);

    return { success: true };
}

chrome.runtime.onStartup.addListener(() => {
    injectIntoActiveTab();
});

chrome.runtime.onInstalled.addListener(() => {
    injectIntoActiveTab();
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === "complete") {
        injectCloseButton(tab);
    }
});

// A tab that finished loading in the background still needs the button once it is shown.
chrome.tabs.onActivated.addListener(({ tabId }) => {
    chrome.tabs.get(tabId)
        .then(injectCloseButton)
        .catch(error => console.error(`Error getting the activated tab: ${error}`));
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "CLOSE_KIOSK_WINDOW") {
        closeKioskWindow(sender)
            .then(sendResponse)
            .catch(error => {
                console.error(`Error closing kiosk window: ${error}`);
                sendResponse({ success: false });
            });
        return true; // keep channel open for async response
    } else if (message.action === "IS_KIOSK_MODE") {
        // From a page: check that page's window. From the popup: the focused window.
        isKioskMode(sender?.tab?.windowId)
            .then(result => sendResponse({ isKiosk: result }))
            .catch(() => sendResponse({ isKiosk: false, error: true }));
        return true; // keep channel open for async response
    } else if (message.action === "INSERT_CSS") {
        // Sent by content.js once per document, so the stylesheet is never inserted twice
        if (typeof sender?.tab?.id === "number") {
            chrome.scripting.insertCSS({
                target: { tabId: sender.tab.id },
                files: ["styles/content.css"]
            }).catch(error => console.error(`Error inserting the button stylesheet: ${error}`));
        }
    }
});
