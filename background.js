// This function runs in the context of the web page to check for kiosk-specific characteristics
function isKioskMode() {
    return chrome.management.getSelf().then(app => {
        return app.launchType === "OPEN_FULL_SCREEN";
    }).catch(error => {
        console.error("Error checking if in Kiosk mode:", error);
        return false;
    });
}

function injectKioskExitButton(tabId) {
    console.log('Injecting Kiosk Close Button..');
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

async function injectCloseButton() {
    let isOpenKioskMode = false;
    isKioskMode().then(isKiosk => {
        isOpenKioskMode = isKiosk;
    });

    if (!isOpenKioskMode) {
        console.log("Not in Kiosk mode, won't inject close button.");
        return
    }

    chrome.windows.getCurrent().then(window => {
        return chrome.tabs.query({ active: true, currentWindow: true });
    }).then(tabs => {
        if (tabs[0] && tabs[0].url && tabs[0].url.startsWith("http")) {
            console.log("Injecting into:", tabs[0].url);
            return chrome.scripting.executeScript({
                target: { tabId: tabs[0].id },
                func: () => true
            }).then(results => {
                console.log("Script executed, results:", results);
                if (results && results[0] && results[0].result) {
                    return injectKioskExitButton(tabs[0].id);
                }
            });
        } else {
            console.warn("Skipping script injection for restricted URL:", tabs[0]?.url);
        }
    }).catch(error => {
        console.error("Error in kiosk mode close button injection:", error);
    });
}

function closeKioskWindow(sendResponse) {
    chrome.windows.getCurrent().then(window => {
        sendResponse({ success: true });
        return new Promise(resolve => setTimeout(resolve, 50)).then(() => {
            return chrome.windows.remove(window.id);
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

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "closeKioskWindow") {
        closeKioskWindow(sendResponse)
    }
});
