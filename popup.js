document.addEventListener("DOMContentLoaded", () => {
	const statusElement = document.getElementById("status");
	const optionsButton = document.getElementById("options");

	// Check if we're in kiosk mode
	chrome.windows.getCurrent((window) => {
		if (window.state === "fullscreen") {
			statusElement.textContent = "Active: Kiosk mode detected";
			statusElement.style.backgroundColor = "#e6f4ea";
		} else {
			statusElement.textContent = "Inactive: Not in kiosk mode";
			statusElement.style.backgroundColor = "#fce8e6";
		}
	});

	// Open options page
	optionsButton.addEventListener("click", () => {
		chrome.runtime.openOptionsPage();
	});
});
