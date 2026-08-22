const { test, expect } = require('@playwright/test');

test('scoring meta-feature shortcuts open safely and daily challenge starts', async ({ page }) => {
    const pageErrors = [];
    page.on('pageerror', error => pageErrors.push(error.message));

    await page.goto('/');
    await expect(page.locator('canvas')).toBeVisible();
    await page.waitForTimeout(700);

    await page.keyboard.press('a');
    await page.waitForTimeout(120);
    await page.keyboard.press('Escape');

    await page.keyboard.press('f');
    await page.waitForTimeout(120);
    await page.keyboard.press('Escape');

    const before = await page.evaluate(() => {
        const saved = localStorage.getItem('needle_game_preferences');
        return saved ? JSON.parse(saved).scoringEnabled : true;
    });
    await page.keyboard.press('s');
    await page.waitForTimeout(160);
    const after = await page.evaluate(() => {
        const saved = localStorage.getItem('needle_game_preferences');
        return saved ? JSON.parse(saved).scoringEnabled : true;
    });
    expect(after).toBe(!before);

    // Restore the original competitive setting before starting the daily run.
    await page.keyboard.press('s');
    await page.waitForTimeout(160);
    await page.keyboard.press('d');
    await page.waitForTimeout(700);

    const activeDaily = await page.evaluate(() => {
        const saved = sessionStorage.getItem('needle_game_daily_active');
        return saved ? JSON.parse(saved) : null;
    });
    expect(activeDaily).not.toBeNull();
    expect(activeDaily.schema).toBe('needles-daily-v1');
    expect(activeDaily.dateKey).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(activeDaily.levelId).toBeTruthy();
    expect(pageErrors).toEqual([]);
});
