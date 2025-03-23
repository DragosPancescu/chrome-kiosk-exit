// This function runs in the context of the web page to check for kiosk-specific characteristics
function isKioskMode() {
    return new Promise((resolve, reject) => {
        chrome.windows.getCurrent((win) => {
            if (chrome.runtime.lastError) {
                reject(new Error("Error getting window: " + chrome.runtime.lastError));
                return;
            }

            chrome.system.display.getInfo((displays) => {
                if (!displays || displays.length === 0) {
                    reject(new Error("Error getting display info."));
                    return;
                }

                const screenWidth = displays[0].bounds.width;
                const screenHeight = displays[0].bounds.height;

                const isFullscreen = win.state === "fullscreen";
                const outerMatch = win.width === screenWidth && win.height === screenHeight;

                resolve(isFullscreen || outerMatch); // Resolve with the result
            });
        });
    });
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

function injectCloseButton() {
    chrome.windows.getCurrent().then(win => {
        return chrome.tabs.query({ active: true, currentWindow: true });
    }).then(tabs => {
        if (tabs[0] && tabs[0].url && tabs[0].url.startsWith("http")) {
            console.log("Checking Kiosk mode");
            isKioskMode()
                .then((isKioskModeOpen) => {
                    if (isKioskModeOpen) {
                        console.log("Injecting into:", tabs[0].url);
                        return injectKioskExitButton(tabs[0].id);
                    } else {
                        console.log("Not in Kiosk mode, won't inject the Kiosk Close Button.")
                    }
                })
                .catch((error) => {
                    console.error("Error while checking Kiosk mode:", error);
                });
        } else {
            console.warn("Skipping script injection for restricted URL:", tabs[0]?.url);
        }
    }).catch(error => {
        console.error("Error in kiosk mode Kiosk Close Button injection:", error);
    });
}

function closeKioskWindow(sendResponse) {
    chrome.windows.getCurrent().then(win => {
        sendResponse({ success: true });
        return new Promise(resolve => setTimeout(resolve, 50)).then(() => {
            return chrome.windows.remove(win.id);
        });
    }).catch(error => {
        console.error("Error closing kiosk window:", error);
    });
    return true;
}

chrome.runtime.onStartup.addListener(() => {
    injectCloseButton();
});

chrome.runtime.onInstalled.addListener(() => {
    injectCloseButton();
});

chrome.tabs.onUpdated.addListener(() => {
    injectCloseButton();
});

chrome.runtime.onMessage.addListener((message, _, sendResponse) => {
    if (message.action === "CLOSE_KIOSK_WINDOW") {
        closeKioskWindow(sendResponse)
    }
});
