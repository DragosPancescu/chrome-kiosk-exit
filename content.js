function updateZoom() {
    document.documentElement.style.setProperty('--zoom-factor', window.devicePixelRatio || 1);
}

// Check if we've already added the button to avoid duplicates
if (!document.getElementById("kiosk-exit-button")) {
	window.addEventListener('resize', updateZoom);
    window.addEventListener('load', updateZoom);
	// Fetch stored configuration
	chrome.storage.local.get(
		{
			buttonType: "text", // Default to text
			buttonText: "X", // Default text
			buttonColor: "#1A7B72", // Default color
			buttonImage: "default", // Default image flag
			buttonPosition: "top-right", // Default position
			buttonSize: "small", // Default size
            buttonAutoHideDelay: 0 // Default auto-hide delay
		},
		(config) => {
			// Create the exit button
			const exitButton = document.createElement("div");
			exitButton.id = "kiosk-exit-button";
			exitButton.className = `kiosk-exit-button kiosk-exit-button-${config.buttonPosition} kiosk-exit-button-${config.buttonSize}`;

			// Apply configuration
			if (config.buttonType === "image" && config.buttonImage) {
				const img = document.createElement("img");
				// Set image
                if (config.buttonImage === 'default') {
                    img.src = chrome.runtime.getURL('images/default.png');
                } else {
                    img.src = config.buttonImage;
                }
				img.alt = "Exit";
                img.className = `kiosk-exit-button-${config.buttonPosition} kiosk-exit-button-${config.buttonSize}`;
				exitButton.appendChild(img);
			} else {
				exitButton.textContent = config.buttonText || "X";
				exitButton.style.color = config.buttonColor
			}

			// Add click event to close the window
            exitButton.addEventListener("click", () => {
                // Use Chrome's extension API to close the current window
                chrome.runtime.sendMessage({ action: "closeKioskWindow" })
                    .catch(error => {
                        // This error is expected when the window closes
                        console.log("Window closed");
                    });
            });

            // If auto-hide delay is set, show the button when the mouse moves
            if (config.buttonAutoHideDelay > 0) {
                document.addEventListener('mousemove', () => {
                    // Reset the timer when the mouse moves
                    exitButton.style.display = 'block';
                    setTimeout(() => {
                        exitButton.style.display = 'none';
                    }, config.buttonAutoHideDelay * 1000);
                });
            }

			// Add to the document
			document.body.appendChild(exitButton);
		}
	);
}
