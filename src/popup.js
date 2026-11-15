const ACTIVE_STATUS = '<svg class="icon text-success" viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="8" fill="currentColor"/><path d="M4.5 8.5l2.5 2.5 4.5-5" fill="none" stroke="#fff" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"/></svg> <span>Active: Kiosk mode detected</span>';
const INACTIVE_STATUS = '<svg class="icon text-danger" viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="8" fill="currentColor"/><path d="M5.5 5.5l5 5M10.5 5.5l-5 5" fill="none" stroke="#fff" stroke-width="1.75" stroke-linecap="round"/></svg> <span>Inactive: Not in kiosk mode</span>';

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
			statusElement.innerHTML = INACTIVE_STATUS;
			return;
		}
		if (response?.isKiosk) {
			statusElement.innerHTML = ACTIVE_STATUS;
		} else {
			statusElement.innerHTML = INACTIVE_STATUS;
		}
	});

	// Open options page
	optionsButton.addEventListener("click", () => {
		chrome.runtime.openOptionsPage();
	});
});
