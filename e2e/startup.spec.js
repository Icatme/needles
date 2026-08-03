const { test, expect } = require('@playwright/test');

test('loads both level packs and reaches the menu without browser errors', async ({ page }) => {
  const consoleErrors = [];
  const pageErrors = [];
  const requestFailures = [];

  page.on('console', message => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('pageerror', error => {
    pageErrors.push(error.message);
  });
  page.on('requestfailed', request => {
    const failure = request.failure();
    requestFailures.push(
      `${request.method()} ${request.url()}${failure ? ` — ${failure.errorText}` : ''}`
    );
  });

  const response = await page.goto('/', { waitUntil: 'domcontentloaded' });
  expect(response?.ok(), 'index.html should load successfully').toBe(true);
  await expect(page.locator('#game-container canvas')).toBeVisible();

  await page.waitForFunction(() => {
    try {
      return typeof LEVEL_PACK_REGISTRY !== 'undefined'
        && LEVEL_PACK_REGISTRY.size === 2
        && typeof game !== 'undefined'
        && Boolean(game?.scene?.isActive('MenuScene'));
    } catch (error) {
      return false;
    }
  }, undefined, { timeout: 15_000 });

  const runtime = await page.evaluate(() => ({
    packIds: LEVEL_PACK_REGISTRY.getAll().map(pack => pack.id),
    levelCounts: LEVEL_PACK_REGISTRY.getAll().map(pack => pack.levels.length),
    defaultPackId: LEVEL_PACK_REGISTRY.defaultPackId,
    menuActive: game.scene.isActive('MenuScene'),
    canvasCount: document.querySelectorAll('#game-container canvas').length
  }));

  expect(runtime.packIds).toEqual(['balanced-v2', 'legacy']);
  expect(runtime.levelCounts).toEqual([50, 50]);
  expect(runtime.defaultPackId).toBe('balanced-v2');
  expect(runtime.menuActive).toBe(true);
  expect(runtime.canvasCount).toBe(1);

  await page.waitForTimeout(250);
  expect(consoleErrors, 'browser console errors').toEqual([]);
  expect(pageErrors, 'uncaught page errors').toEqual([]);
  expect(requestFailures, 'failed network requests').toEqual([]);
});
