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
async function isKioskMode(windowId) {
    const win = typeof windowId === "number"
        ? await chrome.windows.get(windowId)
        : await chrome.windows.getCurrent();

    const displays = await chrome.system.display.getInfo();
    if (!displays || displays.length === 0) {
        throw new Error("Error getting display info.");
    }

    const { bounds } = findDisplayForWindow(displays, win);

    const isFullscreen = win.state === "fullscreen";
    const outerMatch = win.width === bounds.width && win.height === bounds.height;

    return isFullscreen || outerMatch;
}

function injectKioskExitButton(tabId) {
    return Promise.all([
        chrome.scripting.executeScript({
            target: { tabId: tabId },
            files: ['content.js']
        }),
        chrome.scripting.insertCSS({
            target: { tabId: tabId },
            files: ['styles/content.css']
        })
    ]);
}

// Tabs that already carry the button. Without this, every tab switch would insert
// another copy of the stylesheet. Cleared when a tab navigates away or closes.
const injectedTabs = new Set();

// Injects into the given tab, as long as its own window is in kiosk mode.
async function injectCloseButton(tab) {
    try {
        if (!tab || !tab.url || !tab.url.startsWith("http")) {
            console.warn(`Skipping script injection for restricted URL: ${tab?.url}`);
            return;
        }

        if (injectedTabs.has(tab.id)) return;

        console.log("Checking Kiosk mode");
        if (!await isKioskMode(tab.windowId)) {
            console.log("Not in Kiosk mode, won't inject the Kiosk Close Button.");
            return;
        }

        console.log(`Injecting into: ${tab.url}`);
        await injectKioskExitButton(tab.id);
        injectedTabs.add(tab.id);
    } catch (error) {
        console.error(`Error in kiosk mode Kiosk Close Button injection: ${error}`);
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

function closeKioskWindow(sender, sendResponse) {
    // Close the window the click came from, not whichever one happens to be focused.
    const senderWindowId = sender?.tab?.windowId;
    const targetWindowId = typeof senderWindowId === "number"
        ? Promise.resolve(senderWindowId)
        : chrome.windows.getCurrent().then(win => win.id);

    targetWindowId.then(windowId => {
        sendResponse({ success: true });
        return new Promise(resolve => setTimeout(resolve, 50)).then(() => {
            return chrome.windows.remove(windowId);
        });
    }).catch(error => {
        console.error(`Error closing kiosk window: ${error}`);
    });
    return true;
}

chrome.runtime.onStartup.addListener(() => {
    injectIntoActiveTab();
});

chrome.runtime.onInstalled.addListener(() => {
    injectIntoActiveTab();
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === "loading") {
        // Navigating away tears down the content script, so it needs injecting again
        injectedTabs.delete(tabId);
    } else if (changeInfo.status === "complete") {
        injectCloseButton(tab);
    }
});

chrome.tabs.onRemoved.addListener((tabId) => {
    injectedTabs.delete(tabId);
});

// A tab that finished loading in the background still needs the button once it is shown.
chrome.tabs.onActivated.addListener(({ tabId }) => {
    chrome.tabs.get(tabId)
        .then(injectCloseButton)
        .catch(error => console.error(`Error getting the activated tab: ${error}`));
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "CLOSE_KIOSK_WINDOW") {
        return closeKioskWindow(sender, sendResponse); // keep channel open for async response
    } else if (message.action === "IS_KIOSK_MODE") {
        isKioskMode()
            .then(result => sendResponse({ isKiosk: result }))
            .catch(() => sendResponse({ isKiosk: false }));
        return true; // keep channel open for async response
    }
});
