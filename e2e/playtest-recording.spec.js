const fs = require('node:fs');
const { test, expect } = require('@playwright/test');

const INDEX = {
  schema: 'needles.pack-index/v1',
  defaultPackId: 'e2e',
  packs: [{ id: 'e2e', manifest: 'e2e/manifest.json' }]
};
const MANIFEST = {
  schema: 'needles.level-pack/v1',
  id: 'e2e',
  version: '1.0.0',
  title: '试玩记录测试包',
  caption: 'Playwright only',
  engineCompatibility: 'classic-v1',
  difficultyModel: 'legacy-linear',
  chapters: [{ id: 'smoke', order: 1, title: '记录流程' }],
  resources: { presets: 'presets.json', levels: 'levels.json' }
};
const PRESETS = {
  schema: 'needles.level-presets/v1',
  layouts: { clear: { obstacleAngles: [] } }
};
const LEVELS = {
  schema: 'needles.level-list/v1',
  levels: [{
    id: 'e2e-01',
    legacyNumericId: 1,
    chapterId: 'smoke',
    order: 1,
    title: '一针记录',
    instruction: '稳定完成并导出',
    objective: { insertCount: 1 },
    layoutRef: 'clear',
    rhythm: { segments: [{ durationMs: 4000, velocity: 0.3 }] },
    presentation: { tier: 1, milestone: true, focus: 'timing' },
    tags: ['e2e', 'recording']
  }]
};

async function waitForScene(page, key) {
  await page.waitForFunction(sceneKey => {
    try {
      return typeof game !== 'undefined' && game.scene.isActive(sceneKey);
    } catch (error) {
      return false;
    }
  }, key, { timeout: 15_000 });
}

async function clickCanvasPoint(page, x, y) {
  const box = await page.locator('#game-container canvas').boundingBox();
  if (!box) throw new Error('Game canvas has no bounding box');
  await page.mouse.click(
    box.x + x / 600 * box.width,
    box.y + y / 800 * box.height
  );
}

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.route('**/packs/index.json', route => route.fulfill({ json: INDEX }));
  await page.route('**/packs/e2e/manifest.json', route => route.fulfill({ json: MANIFEST }));
  await page.route('**/packs/e2e/presets.json', route => route.fulfill({ json: PRESETS }));
  await page.route('**/packs/e2e/levels.json', route => route.fulfill({ json: LEVELS }));
});

test('records, verifies, downloads and clears a local playtest', async ({ page }) => {
  const pageErrors = [];
  const consoleErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  page.on('console', message => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });

  const response = await page.goto('./', { waitUntil: 'domcontentloaded' });
  expect(response?.ok()).toBe(true);
  await waitForScene(page, 'MenuScene');

  await page.keyboard.press('KeyL');
  await waitForScene(page, 'LevelSelectScene');
  expect(await page.evaluate(() => PLAYTEST_STORE.count())).toBe(0);

  await clickCanvasPoint(page, 80, 342);
  await waitForScene(page, 'GameScene');
  expect(await page.evaluate(() => game.scene.getScene('GameScene').route.mode))
    .toBe('test');

  await page.keyboard.press('Space');
  await waitForScene(page, 'GameOverScene');

  const stored = await page.evaluate(() => {
    const attempt = PLAYTEST_STORE.list()[0];
    const level = APP_CONTEXT.catalog.getLevelConfig('e2e', 'e2e-01');
    const replay = new ReplayRunner().run(attempt.replay, level);
    return {
      count: PLAYTEST_STORE.count(),
      attempt,
      replayVerified: replay.verified
    };
  });
  expect(stored.count).toBe(1);
  expect(stored.replayVerified).toBe(true);
  expect(stored.attempt).toMatchObject({
    packId: 'e2e',
    levelId: 'e2e-01',
    mode: 'test',
    result: {
      status: 'completed',
      success: true,
      insertedCount: 1,
      totalCount: 1
    },
    shots: { count: 1 }
  });

  await page.keyboard.press('Enter');
  await waitForScene(page, 'LevelSelectScene');

  const downloadPromise = page.waitForEvent('download');
  await page.keyboard.press('KeyE');
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/^needles-playtests-\d{4}-\d{2}-\d{2}\.json$/);
  const downloadPath = await download.path();
  expect(downloadPath).toBeTruthy();
  const bundle = JSON.parse(fs.readFileSync(downloadPath, 'utf8'));
  expect(bundle).toMatchObject({
    schema: 'needles.playtest-export/v1',
    attemptCount: 1
  });
  expect(bundle.attempts[0].replay.schema).toBe('needles.replay/v1');

  await page.keyboard.press('KeyC');
  await page.waitForFunction(() => (
    game.scene.isActive('LevelSelectScene') && PLAYTEST_STORE.count() === 0
  ));
  expect(await page.evaluate(() => PLAYTEST_STORE.exportBundle().attemptCount))
    .toBe(0);
  expect(pageErrors).toEqual([]);
  expect(consoleErrors).toEqual([]);
});
