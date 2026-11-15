// Single source of truth for the button defaults, shared by the options page and the
// injected content script. Assigned rather than declared, because the content script
// can be injected into the same page more than once.
globalThis.KIOSK_EXIT_DEFAULTS = Object.freeze({
    buttonType: "image",
    buttonText: "X",
    buttonColor: "#1A7B72",
    buttonImage: "default", // flag for the bundled images/default.png
    buttonPosition: "top-right",
    buttonSize: "small",
    buttonAutoHideDelay: 0 // seconds, 0 keeps the button always visible
});
