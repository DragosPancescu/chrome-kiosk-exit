function updateZoom() {
    document.documentElement.style.setProperty('--zoom-factor', window.devicePixelRatio || 1);
}

// Check if we've already added the button to avoid duplicates
if (!document.getElementById("kiosk-exit-button")) {
    window.addEventListener('resize', updateZoom);
    window.addEventListener('load', updateZoom);

    chrome.storage.local.get({
        buttonType: "image", // Default to image
        buttonText: "X", // Default text
        buttonColor: "#1A7B72", // Default color
        buttonImage: "default", // Default image flag
        buttonPosition: "top-right", // Default position
        buttonSize: "small", // Default size
        buttonAutoHideDelay: 0 // Default auto-hide delay
    }, (config) => {
        // Create the exit button
        const exitButton = document.createElement("div");
        exitButton.id = "kiosk-exit-button";
        exitButton.className = `kiosk-exit-button kiosk-exit-button-${config.buttonPosition} kiosk-exit-button-${config.buttonSize}`;
        exitButton.style.transition = "opacity 0.5s";  // Smooth fade-out effect

        // Apply configuration
        if (config.buttonType === "image" && config.buttonImage) {
            const img = document.createElement("img");
            img.src = config.buttonImage === 'default' ? chrome.runtime.getURL('images/default.png') : config.buttonImage;
            img.alt = "Exit";
            img.className = `kiosk-exit-button-${config.buttonPosition} kiosk-exit-button-${config.buttonSize}`;
            exitButton.appendChild(img);
        } else {
            exitButton.textContent = config.buttonText || "X";
            exitButton.style.color = config.buttonColor;
        }

        // Add click event to close the window
        exitButton.addEventListener("click", () => {
            chrome.runtime.sendMessage({ action: "CLOSE_KIOSK_WINDOW" }).catch(() => {
                console.log("Window closed");
            });
        });

        // Auto-hide logic
        if (config.buttonAutoHideDelay > 0) {
            let hideTimeout;

            document.addEventListener('mousemove', () => {
                // Show button immediately
                exitButton.style.opacity = "1";

                // Reset any existing timeout
                clearTimeout(hideTimeout);

                // Set new timeout to hide the button
                hideTimeout = setTimeout(() => {
                    exitButton.style.opacity = "0";
                }, config.buttonAutoHideDelay * 1000);
            });
        }

        // Add to the document
        document.body.appendChild(exitButton);
    });
}
