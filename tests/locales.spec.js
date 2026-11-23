// Static checks on _locales; no browser needed
const { test, expect } = require("@playwright/test");
const fs = require("fs");
const path = require("path");

const SRC = path.join(__dirname, "..", "src");
const LOCALES_DIR = path.join(SRC, "_locales");
const locales = fs.readdirSync(LOCALES_DIR);
const read = (locale) => JSON.parse(fs.readFileSync(path.join(LOCALES_DIR, locale, "messages.json"), "utf8"));
const en = read("en");

test("every key used in HTML and JS exists in en", () => {
    const used = new Set();
    for (const file of ["popup.html", "options.html", "popup.js", "options.js"]) {
        const text = fs.readFileSync(path.join(SRC, file), "utf8");
        for (const m of text.matchAll(/data-i18n(?:-[a-z-]+)?="([A-Za-z0-9_]+)"/g)) used.add(m[1]);
        for (const m of text.matchAll(/(?:msg|getMessage)\(\s*['"]([A-Za-z0-9_]+)['"]/g)) used.add(m[1]);
    }
    const manifest = fs.readFileSync(path.join(SRC, "manifest.json"), "utf8");
    for (const m of manifest.matchAll(/__MSG_([A-Za-z0-9_]+)__/g)) used.add(m[1]);

    expect([...used].filter((key) => !(key in en))).toEqual([]);
});

for (const locale of locales) {
    test(`${locale} matches en and fits store limits`, () => {
        const messages = read(locale);
        expect(Object.keys(messages).sort()).toEqual(Object.keys(en).sort());
        expect(messages.extName.message.length).toBeLessThanOrEqual(75);
        expect(messages.extDescription.message.length).toBeLessThanOrEqual(132);

        // Placeholders aren't inherited from en, so each locale must define its own
        for (const [key, entry] of Object.entries(messages)) {
            for (const name of Object.keys(en[key].placeholders || {})) {
                expect(entry.message, `${locale}.${key}`).toContain(`$${name.toUpperCase()}$`);
                expect(entry.placeholders?.[name], `${locale}.${key}`).toBeTruthy();
            }
        }
    });
}
