document.addEventListener("DOMContentLoaded", () => {
	// Sync theme with settings page
	const theme = localStorage.getItem('bsTheme') || 'dark';
	document.documentElement.setAttribute('data-bs-theme', theme);

	const statusElement = document.getElementById("status");
	const optionsButton = document.getElementById("options");

	// Ask background.js (single source of truth) whether we're in kiosk mode
	chrome.runtime.sendMessage({ action: "IS_KIOSK_MODE" }, (response) => {
		if (chrome.runtime.lastError) {
			console.error("Error checking kiosk mode:", chrome.runtime.lastError.message);
			statusElement.innerHTML = '<i class="bi bi-x-circle-fill text-danger"></i> <span>Inactive: Not in kiosk mode</span>';
			return;
		}
		if (response?.isKiosk) {
			statusElement.innerHTML = '<i class="bi bi-check-circle-fill text-success"></i> <span>Active: Kiosk mode detected</span>';
		} else {
			statusElement.innerHTML = '<i class="bi bi-x-circle-fill text-danger"></i> <span>Inactive: Not in kiosk mode</span>';
		}
	});

	// Open options page
	optionsButton.addEventListener("click", () => {
		chrome.runtime.openOptionsPage();
	});
});
