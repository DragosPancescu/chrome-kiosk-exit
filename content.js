(() => {
    // The settings read below is async, so a DOM check alone would let two
    // near-simultaneous injections both get past the duplicate guard.
    if (window.kioskExitButtonInjected) return;
    window.kioskExitButtonInjected = true;

    const DEFAULTS = {
        buttonType: "image", // Default to image
        buttonText: "X", // Default text
        buttonColor: "#1A7B72", // Default color
        buttonImage: "default", // Default image flag
        buttonPosition: "top-right", // Default position
        buttonSize: "small", // Default size
        buttonAutoHideDelay: 0 // Default auto-hide delay
    };

    // Create the exit button
    const exitButton = document.createElement("div");
    exitButton.id = "kiosk-exit-button";
    exitButton.style.opacity = "0";

    // Add click event to close the window
    exitButton.addEventListener("click", () => {
        chrome.runtime.sendMessage({ action: "CLOSE_KIOSK_WINDOW" }).catch(() => {
            console.log("Window closed");
        });
    });

    // Teardown for the auto-hide wiring currently in place, if any
    let stopAutoHide = null;

    function show() {
        exitButton.style.opacity = "1";
        exitButton.style.pointerEvents = "auto";
    }

    function hide() {
        exitButton.style.opacity = "0";
        // Don't let an invisible button keep swallowing clicks
        exitButton.style.pointerEvents = "none";
    }

    function setupAutoHide(delaySeconds) {
        if (stopAutoHide) {
            stopAutoHide();
            stopAutoHide = null;
        }

        show();
        if (delaySeconds <= 0) return;

        let hideTimeout;
        let lastMove = 0;

        const scheduleHide = () => {
            clearTimeout(hideTimeout);
            hideTimeout = setTimeout(hide, delaySeconds * 1000);
        };

        const onMouseMove = () => {
            // Skip if < 50ms since last handled event
            const now = Date.now();
            if (now - lastMove < 50) return;

            lastMove = now;

            show();
            scheduleHide();
        };

        document.addEventListener("mousemove", onMouseMove);

        // Start the countdown right away, so a page nobody touches hides the button too
        scheduleHide();

        stopAutoHide = () => {
            clearTimeout(hideTimeout);
            document.removeEventListener("mousemove", onMouseMove);
        };
    }

    // Apply configuration
    function applyConfig(config) {
        exitButton.className = `kiosk-exit-button kiosk-exit-button-${config.buttonPosition} kiosk-exit-button-${config.buttonSize}`;
        exitButton.replaceChildren();
        exitButton.style.color = "";

        if (config.buttonType === "image" && config.buttonImage) {
            const img = document.createElement("img");
            img.src = config.buttonImage === "default"
                ? chrome.runtime.getURL("images/default.png")
                : config.buttonImage;
            img.alt = "Exit";
            img.className = `kiosk-exit-button-${config.buttonPosition} kiosk-exit-button-${config.buttonSize}`;
            exitButton.appendChild(img);
        } else {
            exitButton.textContent = config.buttonText || DEFAULTS.buttonText;
            exitButton.style.color = config.buttonColor;
        }

        setupAutoHide(Number(config.buttonAutoHideDelay) || 0);
    }

    function attach() {
        document.body.appendChild(exitButton);

        // Add to the document, then fade in
        exitButton.style.opacity = "0";
        requestAnimationFrame(() => {
            requestAnimationFrame(show);
        });
    }

    chrome.storage.local.get(DEFAULTS, (config) => {
        applyConfig(config);

        if (document.body) {
            attach();
        } else {
            document.addEventListener("DOMContentLoaded", attach, { once: true });
        }
    });

    // Keep pages that are already open in sync with the settings page
    chrome.storage.onChanged.addListener((_, areaName) => {
        if (areaName !== "local") return;

        chrome.storage.local.get(DEFAULTS, applyConfig);
    });
})();
