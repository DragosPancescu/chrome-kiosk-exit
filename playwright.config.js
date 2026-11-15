const { defineConfig } = require("@playwright/test");

module.exports = defineConfig({
    testDir: "tests",
    // Every test opens a real, sometimes fullscreen, browser window that needs focus
    workers: 1,
    fullyParallel: false,
    timeout: 30_000,
    expect: { timeout: 7_000 },
    reporter: "list"
});
