const { test, expect } = require('@playwright/test');

for (const level of [1, 15, 30, 40, 41, 44, 50]) {
  test(`readable-v3 level ${level} opens the real pack in test mode`, async ({ page }) => {
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(`/?pack=readable-v3&level=${level}&mode=test`);
    await page.waitForFunction(() => typeof game !== 'undefined' && game.scene.isActive('GameScene'));
    await expect(page.locator('#game-container canvas')).toBeVisible();
    const state = await page.evaluate(() => {
      const scene = game.scene.getScene('GameScene');
      return { route: scene.route, packCount: LEVEL_PACK_REGISTRY.size };
    });
    expect(state.packCount).toBe(3);
    expect(state.route.packId).toBe('readable-v3');
    expect(state.route.mode).toBe('test');
    expect(errors).toEqual([]);
  });
}
