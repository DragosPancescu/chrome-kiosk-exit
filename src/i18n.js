// Fills in translated text from _locales/<lang>/messages.json.
// Mark elements with data-i18n="key" for their text, or data-i18n-title,
// data-i18n-placeholder, data-i18n-aria-label for those attributes.
// Load this before the page's own script so the text is in place when it runs.
(() => {
    const ATTRIBUTES = ['title', 'placeholder', 'aria-label'];

    // htmlLang names the language actually shown, which differs from the UI
    // language when Chrome falls back to English
    document.documentElement.lang = chrome.i18n.getMessage('htmlLang') || 'en';

    for (const el of document.querySelectorAll('[data-i18n]')) {
        const text = chrome.i18n.getMessage(el.dataset.i18n);
        if (text) el.textContent = text;
    }

    for (const attr of ATTRIBUTES) {
        for (const el of document.querySelectorAll(`[data-i18n-${attr}]`)) {
            const text = chrome.i18n.getMessage(el.getAttribute(`data-i18n-${attr}`));
            if (text) el.setAttribute(attr, text);
        }
    }
})();
