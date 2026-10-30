// Elements
const buttonTypeRadios = document.getElementsByName('buttonType');
const textOptions = document.getElementById('textOptions');
const buttonColor = document.getElementById('buttonColor');
const imageOptions = document.getElementById('imageOptions');
const buttonTextInput = document.getElementById('buttonText');
const imageUpload = document.getElementById('imageUpload');
const buttonPosition = document.getElementById('buttonPosition');
const buttonSize = document.getElementById('buttonSize');
const buttonPreview = document.getElementById('buttonPreview');
const buttonAutoHideDelay = document.getElementById('autoHideDelay');
const saveButton = document.getElementById('save');

const DEFAULTS = {
    buttonType: 'image',
    buttonText: 'X',
    buttonColor: '#1A7B72',
    buttonImage: 'default',
    buttonPosition: 'top-right',
    buttonSize: 'small',
    buttonAutoHideDelay: 0
};

// Largest edge an uploaded image is stored at. The button never renders bigger than
// min(5vw, 5vh), so anything beyond this is quota spent for no visible gain.
const MAX_IMAGE_DIMENSION = 256;

// Initialize toast
let toastInstance;

// Staged image; written to storage only when Save is pressed
let currentImageData = DEFAULTS.buttonImage;

document.addEventListener('DOMContentLoaded', () => {
    const toastEl = document.getElementById('status');
    toastInstance = new bootstrap.Toast(toastEl, {
        animation: true,
        autohide: true,
        delay: 3000
    });

    // Load settings
    loadSettings();

    // Set theme
    setTheme();

    // Add event listeners
    for (const radio of buttonTypeRadios) {
        radio.addEventListener('change', toggleOptions);
    }

    imageUpload.addEventListener('change', handleImageUpload);

    // Add event listener for reset image button
    document.getElementById('resetImageButton').addEventListener('click', resetToDefaultImage);

    buttonTextInput.addEventListener('input', updatePreview);
    buttonColor.addEventListener('input', updatePreview);
    buttonPosition.addEventListener('change', updatePreview);
    buttonSize.addEventListener('change', updatePreview);
    buttonAutoHideDelay.addEventListener('input', validateAutoHideDelay);
    buttonAutoHideDelay.addEventListener('blur', validateAutoHideDelay);
    saveButton.addEventListener('click', saveSettings);
});

// Light mode and dark mode switch
function setTheme() {
    const htmlElement = document.documentElement;
    const switchElement = document.getElementById('darkModeSwitch');

    // Set the default theme to dark if no setting is found in local storage
    const currentTheme = localStorage.getItem('bsTheme') || 'dark';
    htmlElement.setAttribute('data-bs-theme', currentTheme);
    switchElement.checked = currentTheme === 'dark';

    switchElement.addEventListener('change', function () {
        if (this.checked) {
            htmlElement.setAttribute('data-bs-theme', 'dark');
            localStorage.setItem('bsTheme', 'dark');
        } else {
            htmlElement.setAttribute('data-bs-theme', 'light');
            localStorage.setItem('bsTheme', 'light');
        }
    });
}

// Show a toast; success is green, anything else red
function showToast(title, message, isError = false) {
    const toastEl = document.getElementById('status');
    toastEl.classList.toggle('text-bg-success', !isError);
    toastEl.classList.toggle('text-bg-danger', isError);

    document.getElementById('statusTitle').textContent = title;
    document.getElementById('statusMessage').textContent = message;

    if (toastInstance) {
        toastInstance.show();
    }
}

function validateAutoHideDelay() {
    const raw = buttonAutoHideDelay.value.trim();
    const value = Number(raw);
    const isValid = raw !== '' && Number.isInteger(value) && value >= 0 && value <= 300;

    buttonAutoHideDelay.setCustomValidity(isValid ? '' : 'Enter a whole number of seconds between 0 and 300');
    saveButton.disabled = !isValid;

    // Triggering browser's built-in validation to show error message
    buttonAutoHideDelay.reportValidity();
}

// Load saved settings
function loadSettings() {
    chrome.storage.local.get(DEFAULTS, (items) => {
        try {
            if (chrome.runtime.lastError) {
                console.error(`Error loading settings: ${chrome.runtime.lastError.message}`);
                showToast('Heads up', 'Saved settings could not be loaded, showing defaults.', true);
                items = { ...DEFAULTS };
            }

            // Set button type
            for (const radio of buttonTypeRadios) {
                if (radio.value === items.buttonType) {
                    radio.checked = true;
                }
            }

            // Show/hide appropriate options
            textOptions.style.display = items.buttonType === 'text' ? 'block' : 'none';
            imageOptions.style.display = items.buttonType === 'image' ? 'block' : 'none';

            // Set text
            buttonTextInput.value = items.buttonText;

            // Set color
            buttonColor.value = items.buttonColor;

            // Store the image data
            currentImageData = items.buttonImage;

            // Set position and size
            buttonPosition.value = items.buttonPosition;
            buttonSize.value = items.buttonSize;

            // Set auto-hide delay
            buttonAutoHideDelay.value = items.buttonAutoHideDelay;

            // Update preview
            updatePreview();
        } finally {
            // Always reveal the page, even if something above threw
            document.body.classList.remove('content-hidden');
        }
    });
}

// Toggle between text and image options
function toggleOptions() {
    const selectedType = document.querySelector('input[name="buttonType"]:checked').value;
    textOptions.style.display = selectedType === 'text' ? 'block' : 'none';
    imageOptions.style.display = selectedType === 'image' ? 'block' : 'none';
    updatePreview();
}

function readFileAsDataURL(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result);
        reader.onerror = () => reject(new Error('the file could not be read'));
        reader.readAsDataURL(file);
    });
}

// Shrink oversized uploads so they don't eat the storage quota
function downscaleImage(dataUrl) {
    return new Promise((resolve, reject) => {
        const img = new Image();

        img.onload = () => {
            const longestEdge = Math.max(img.width, img.height);
            if (!longestEdge || longestEdge <= MAX_IMAGE_DIMENSION) {
                resolve(dataUrl);
                return;
            }

            const scale = MAX_IMAGE_DIMENSION / longestEdge;
            const canvas = document.createElement('canvas');
            canvas.width = Math.round(img.width * scale);
            canvas.height = Math.round(img.height * scale);
            canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);

            // PNG keeps transparency, which most exit icons rely on
            resolve(canvas.toDataURL('image/png'));
        };
        img.onerror = () => reject(new Error('the file is not a readable image'));

        img.src = dataUrl;
    });
}

// Handle image upload
async function handleImageUpload() {
    const file = imageUpload.files[0];
    if (!file) return;

    if (file.size > 5_000_000) {
        alert("Image too large. Please use an image under 5 MB.");
        imageUpload.value = "";
        return;
    }

    try {
        const dataUrl = await readFileAsDataURL(file);

        // Stage the image for the preview; Save is what persists it
        currentImageData = await downscaleImage(dataUrl);
        updatePreview();
    } catch (error) {
        imageUpload.value = "";
        showToast('Error', `Image not loaded: ${error.message}.`, true);
    }
}

// Reset to default image
function resetToDefaultImage() {
    // Set to default
    currentImageData = DEFAULTS.buttonImage;
    imageUpload.value = '';
    updatePreview();
}

// Update the preview
function updatePreview() {
    const selectedType = document.querySelector('input[name="buttonType"]:checked').value;
    const text = buttonTextInput.value || DEFAULTS.buttonText;
    const color = buttonColor.value || DEFAULTS.buttonColor;
    const position = buttonPosition.value;
    const size = buttonSize.value;

    // Update classes
    buttonPreview.className = `kiosk-exit-button-preview ${position} ${size}`;

    // Update content
    if (selectedType === 'text') {
        buttonPreview.textContent = text;
        buttonPreview.style.color = color;
        buttonPreview.style.justifyContent = (position === 'top-right' || position === 'bottom-right') ? 'flex-end' : 'flex-start';
    } else {
        buttonPreview.textContent = '';
        const img = document.createElement('img');

        if (currentImageData === 'default') {
            img.src = chrome.runtime.getURL('images/default.png');
        } else {
            img.src = currentImageData;
        }

        img.className = `${position} ${size}`;
        buttonPreview.replaceChildren(img);
    }
}

// Save settings
function saveSettings() {
    const selectedType = document.querySelector('input[name="buttonType"]:checked').value;

    const settings = {
        buttonType: selectedType,
        buttonText: buttonTextInput.value || DEFAULTS.buttonText,
        buttonColor: buttonColor.value || DEFAULTS.buttonColor,
        // Kept even while the text button is active, so switching type doesn't discard it
        buttonImage: currentImageData,
        buttonPosition: buttonPosition.value,
        buttonSize: buttonSize.value,
        buttonAutoHideDelay: Number(buttonAutoHideDelay.value)
    };

    chrome.storage.local.set(settings, () => {
        if (chrome.runtime.lastError) {
            console.error(`Error saving settings: ${chrome.runtime.lastError.message}`);
            showToast('Error', `Settings were not saved: ${chrome.runtime.lastError.message}`, true);
            return;
        }

        showToast('Success!', 'Your settings have been saved.');
    });
}
