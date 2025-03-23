function isKioskMode() {
    const isFullscreen = window.matchMedia("(display-mode: fullscreen)").matches;
    const isStandalone = window.matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
    
    const screenWidth = screen.width;
    const screenHeight = screen.height;

    const outerMatch = window.outerWidth === screenWidth && window.outerHeight === screenHeight;
    const innerMatch = window.innerWidth === screenWidth && window.innerHeight === screenHeight;

    return isFullscreen || isStandalone || (outerMatch && innerMatch);
}

document.addEventListener("DOMContentLoaded", () => {
	const statusElement = document.getElementById("status");
	const optionsButton = document.getElementById("options");

	// Check if we're in kiosk mode
	chrome.management.getSelf().then(app => {
        if (isKioskMode()) {
			statusElement.textContent = "Active: Kiosk mode detected";
			statusElement.style.backgroundColor = "#e6f4ea";
		} else {
			statusElement.textContent = "Inactive: Not in kiosk mode";
			statusElement.style.backgroundColor = "#fce8e6";
		}
    }).catch(error => {
        console.error("Error checking if in Kiosk mode (pop-up):", error);
		statusElement.textContent = "Inactive: Not in kiosk mode";
		statusElement.style.backgroundColor = "#fce8e6";
    });
	
	// Open options page
	optionsButton.addEventListener("click", () => {
		chrome.runtime.openOptionsPage();
	});
});
