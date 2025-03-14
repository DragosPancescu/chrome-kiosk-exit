// Elements
const buttonTypeRadios = document.getElementsByName('buttonType');
const textOptions = document.getElementById('textOptions');
const buttonColor = document.getElementById('buttonColor');
const imageOptions = document.getElementById('imageOptions');
const buttonTextInput = document.getElementById('buttonText');
const imageUpload = document.getElementById('imageUpload');
const uploadButton = document.getElementById('uploadButton');
const currentImage = document.getElementById('currentImage');
const buttonPosition = document.getElementById('buttonPosition');
const buttonSize = document.getElementById('buttonSize');
const buttonPreview = document.getElementById('buttonPreview');
const buttonAutoHideDelay = document.getElementById('autoHideDelay');
const saveButton = document.getElementById('save');

// Initialize toast
let toastInstance;

// Add at the top with other constants
let initComplete = false;

// Add a variable to store the current image data
let currentImageData = 'default';

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

    uploadButton.addEventListener('click', () => {
        imageUpload.click();
    });

    imageUpload.addEventListener('change', handleImageUpload);

    // Add event listener for reset image button
    document.getElementById('resetImageButton').addEventListener('click', resetToDefaultImage);

    buttonTextInput.addEventListener('input', updatePreview);
    buttonColor.addEventListener('input', updatePreview);
    buttonPosition.addEventListener('change', updatePreview);
    buttonSize.addEventListener('change', updatePreview);
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

// Load saved settings
function loadSettings() {
    chrome.storage.local.get({
        buttonType: 'text',
        buttonText: 'X',
        buttonColor: '#1A7B72',
        buttonImage: 'default',
        buttonPosition: 'top-right',
        buttonSize: 'small',
        buttonAutoHideDelay: 0
    }, (items) => {
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

        // Show the content once everything is loaded
        initComplete = true;
        document.body.classList.remove('content-hidden');
    });
}

// Toggle between text and image options
function toggleOptions() {
    const selectedType = document.querySelector('input[name="buttonType"]:checked').value;
    textOptions.style.display = selectedType === 'text' ? 'block' : 'none';
    imageOptions.style.display = selectedType === 'image' ? 'block' : 'none';
    updatePreview();
}

// Handle image upload
function handleImageUpload() {
    const file = imageUpload.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            const base64Image = e.target.result;
            
            // Store the image data in a variable for the preview
            currentImageData = base64Image;
            
            // Update the preview
            updatePreview();
            
            // Save the image in chrome.storage.local
            chrome.storage.local.set({ buttonImage: base64Image });
        };
        reader.readAsDataURL(file);
    }
}

// Reset to default image
function resetToDefaultImage() {
    // Set to default
    currentImageData = 'default';
    chrome.storage.local.set({ buttonImage: 'default' });
    updatePreview();
}

// Update the preview
function updatePreview() {
    const selectedType = document.querySelector('input[name="buttonType"]:checked').value;
    const text = buttonTextInput.value || 'X';
    const color = buttonColor.value || "#1A7B72";
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
        buttonPreview.innerHTML = '';
        buttonPreview.appendChild(img);
    }
}

// Save settings
function saveSettings() {
    const selectedType = document.querySelector('input[name="buttonType"]:checked').value;

    let imageSrc;
    if (selectedType === 'image' && currentImageData.startsWith('data:image')) {
        imageSrc = currentImageData;  // Keep Base64-encoded image
    } else {
        imageSrc = 'default';  // Use default flag
    }

    const settings = {
        buttonType: selectedType,
        buttonText: buttonTextInput.value || 'X',
        buttonColor: buttonColor.value || "#1A7B72",
        buttonImage: imageSrc,
        buttonPosition: buttonPosition.value,
        buttonSize: buttonSize.value,
        buttonAutoHideDelay: buttonAutoHideDelay.value
    };

    chrome.storage.local.set(settings, () => {
        if (toastInstance) {
            toastInstance.show();
        }
    });
}
