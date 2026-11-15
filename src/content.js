(() => {
    // Already running in this document (tab switch, in-page navigation): don't build a
    // second button, just put ours back if the page dropped it, e.g. by swapping <body>.
    if (window.kioskExitButton) {
        window.kioskExitButton.ensureAttached();
        return;
    }

    const DEFAULTS = globalThis.KIOSK_EXIT_DEFAULTS;

    // How long after an auto-hidden button reappears a click is ignored, so the tap
    // that revealed it can't also close the window.
    const REVEAL_GRACE_MS = 400;

    // Any of these counts as activity for auto-hide. Listening for touch and pointer
    // events directly covers pages that suppress the emulated mouse events.
    const WAKE_EVENTS = ["mousemove", "mousedown", "pointerdown", "touchstart", "wheel", "keydown"];

    // sendMessage throws synchronously once the extension was reloaded or updated
    function sendMessage(message) {
        try {
            return chrome.runtime.sendMessage(message).catch(() => undefined);
        } catch {
            return Promise.resolve(undefined);
        }
    }

    // A button left behind by a previous version of the extension
    document.getElementById("kiosk-exit-button")?.remove();

    // First run in this document, so the stylesheet isn't there yet
    sendMessage({ action: "INSERT_CSS" });

    // Create the exit button
    const exitButton = document.createElement("div");
    exitButton.id = "kiosk-exit-button";
    // Inline, so it never takes part in page layout while the stylesheet is on its way
    exitButton.style.position = "fixed";
    exitButton.style.opacity = "0";

    let configured = false;

    // False while the window isn't (known to be) in kiosk mode. A page element that is
    // already fullscreen when we arrive, e.g. a video, is what made the window
    // fullscreen, so that doesn't count until it exits and we can check again.
    let kioskActive = !document.fullscreenElement;

    // Auto-hide state
    let autoHidden = false;
    let revealedAt = -Infinity;
    let wake = () => { };
    let stopAutoHide = null;

    function render() {
        exitButton.style.opacity = kioskActive && !autoHidden ? "1" : "0";
        // An auto-hidden button stays tappable so a tap on its corner can bring it back
        // (see the click handler); outside kiosk mode it gets out of the way entirely.
        exitButton.style.pointerEvents = kioskActive ? "auto" : "none";
    }

    exitButton.addEventListener("click", () => {
        // Never close on a click the user couldn't see the target of
        if (autoHidden || performance.now() - revealedAt < REVEAL_GRACE_MS) {
            wake();
            return;
        }

        sendMessage({ action: "CLOSE_KIOSK_WINDOW" }).then(response => {
            // The background refuses when the window has left kiosk mode
            if (response?.success === false) {
                kioskActive = false;
                render();
            }
        });
    });

    function setupAutoHide(delaySeconds) {
        if (stopAutoHide) {
            stopAutoHide();
            stopAutoHide = null;
        }

        autoHidden = false;
        wake = () => { };
        render();
        if (delaySeconds <= 0) return;

        let hideTimeout;
        let lastActivity = 0;

        const scheduleHide = () => {
            clearTimeout(hideTimeout);
            hideTimeout = setTimeout(() => {
                autoHidden = true;
                render();
            }, delaySeconds * 1000);
        };

        wake = () => {
            if (autoHidden) {
                autoHidden = false;
                revealedAt = performance.now();
                render();
            }
            scheduleHide();
        };

        const onActivity = () => {
            // Skip if < 50ms since last handled event
            const now = Date.now();
            if (now - lastActivity < 50) return;

            lastActivity = now;
            wake();
        };

        // Capture on window, so pages that stop propagation don't starve us
        const listenerOptions = { capture: true, passive: true };
        for (const type of WAKE_EVENTS) {
            window.addEventListener(type, onActivity, listenerOptions);
        }

        // Start the countdown right away, so a page nobody touches hides the button too
        scheduleHide();

        stopAutoHide = () => {
            clearTimeout(hideTimeout);
            for (const type of WAKE_EVENTS) {
                window.removeEventListener(type, onActivity, listenerOptions);
            }
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
            requestAnimationFrame(render);
        });
    }

    // Asks the background whether this window is (still) in kiosk mode
    function refreshKioskState() {
        // While a page element is fullscreen the window state says nothing new
        if (document.fullscreenElement) return;

        sendMessage({ action: "IS_KIOSK_MODE" }).then(response => {
            // On any failure keep the current state rather than hide a needed button
            if (!response || response.error || typeof response.isKiosk !== "boolean") return;

            kioskActive = response.isKiosk;
            render();
        });
    }

    function ensureAttached() {
        if (configured && !exitButton.isConnected && document.body) {
            attach();
        }
        refreshKioskState();
    }

    window.kioskExitButton = { ensureAttached };

    // Entering or leaving fullscreen always resizes the viewport. Debounced, so the
    // window state has settled by the time we ask.
    let recheckTimeout;
    const scheduleKioskRecheck = () => {
        clearTimeout(recheckTimeout);
        recheckTimeout = setTimeout(refreshKioskState, 300);
    };
    window.addEventListener("resize", scheduleKioskRecheck);
    document.addEventListener("fullscreenchange", scheduleKioskRecheck);

    chrome.storage.local.get(DEFAULTS, (config) => {
        // A failed read must not cost the kiosk its exit button
        applyConfig(chrome.runtime.lastError || !config ? DEFAULTS : config);
        configured = true;

        if (document.body) {
            attach();
        } else {
            document.addEventListener("DOMContentLoaded", attach, { once: true });
        }
    });

    // Keep pages that are already open in sync with the settings page
    chrome.storage.onChanged.addListener((_, areaName) => {
        if (areaName !== "local") return;

        chrome.storage.local.get(DEFAULTS, (config) => {
            // On a failed read keep what is already showing
            if (chrome.runtime.lastError || !config) return;
            applyConfig(config);
        });
    });
})();
