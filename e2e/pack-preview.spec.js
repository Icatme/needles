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
  title: '预览测试包',
  caption: 'Playwright only',
  engineCompatibility: 'classic-v1',
  difficultyModel: 'legacy-linear',
  chapters: [
    { id: 'chapter-1', order: 1, title: '第一章' },
    { id: 'chapter-2', order: 2, title: '第二章' }
  ],
  resources: { presets: 'presets.json', levels: 'levels.json' }
};
const PRESETS = {
  schema: 'needles.level-presets/v1',
  layouts: {
    clear: { obstacleAngles: [] },
    blocked: { obstacleAngles: [90] }
  }
};
const LEVELS = {
  schema: 'needles.level-list/v1',
  levels: [
    {
      id: 'e2e-01',
      legacyNumericId: 1,
      chapterId: 'chapter-1',
      order: 1,
      title: '第一关',
      instruction: '预览第一关',
      objective: { insertCount: 1 },
      layoutRef: 'clear',
      rhythm: { segments: [{ durationMs: 4000, velocity: 0.3 }] },
      presentation: { tier: 1, milestone: true, focus: 'timing' },
      tags: ['preview']
    },
    {
      id: 'e2e-02',
      legacyNumericId: 2,
      chapterId: 'chapter-2',
      order: 2,
      title: '第二关',
      instruction: '预览第二关',
      objective: { insertCount: 1 },
      layoutRef: 'blocked',
      rhythm: { segments: [{ durationMs: 4000, velocity: 0.3 }] },
      presentation: { tier: 2, milestone: true, focus: 'zones' },
      tags: ['preview', 'zones']
    }
  ]
};

async function installFixture(page) {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.route('**/packs/index.json', route => route.fulfill({ json: INDEX }));
  await page.route('**/packs/e2e/manifest.json', route => route.fulfill({ json: MANIFEST }));
  await page.route('**/packs/e2e/presets.json', route => route.fulfill({ json: PRESETS }));
  await page.route('**/packs/e2e/levels.json', route => route.fulfill({ json: LEVELS }));
}

async function waitForScene(page, key) {
  await page.waitForFunction(sceneKey => {
    try {
      return typeof game !== 'undefined' && game.scene.isActive(sceneKey);
    } catch (error) {
      return false;
    }
  }, key, { timeout: 15_000 });
}

test.beforeEach(async ({ page }) => {
  await installFixture(page);
});

test('direct level URL opens the stable test route with the requested skin', async ({ page }) => {
  const consoleErrors = [];
  const pageErrors = [];
  page.on('console', message => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('pageerror', error => pageErrors.push(error.message));

  const response = await page.goto(
    './?pack=e2e&level=2&mode=test&skin=gilded-jewel-box',
    { waitUntil: 'domcontentloaded' }
  );
  expect(response?.ok()).toBe(true);
  await waitForScene(page, 'GameScene');

  const state = await page.evaluate(() => ({
    route: game.scene.getScene('GameScene').route,
    skin: new ThemeManager().activeThemeId,
    preview: {
      enabled: PREVIEW_OPTIONS.enabled,
      packId: PREVIEW_OPTIONS.packId,
      levelId: PREVIEW_OPTIONS.levelId,
      mode: PREVIEW_OPTIONS.mode
    }
  }));
  expect(state.route).toMatchObject({
    packId: 'e2e',
    levelId: 'e2e-02',
    mode: 'test'
  });
  expect(state.skin).toBe('gilded-jewel-box');
  expect(state.preview).toEqual({
    enabled: true,
    packId: 'e2e',
    levelId: '2',
    mode: 'test'
  });
  expect(consoleErrors).toEqual([]);
  expect(pageErrors).toEqual([]);
});

test('laboratory URL opens the requested chapter without starting gameplay', async ({ page }) => {
  const response = await page.goto(
    './?pack=e2e&lab=1&chapter=chapter-2&page=1',
    { waitUntil: 'domcontentloaded' }
  );
  expect(response?.ok()).toBe(true);
  await waitForScene(page, 'LevelSelectScene');

  const state = await page.evaluate(() => {
    const scene = game.scene.getScene('LevelSelectScene');
    return {
      packId: scene.packId,
      chapterId: scene.chapterId,
      page: scene.page,
      gameActive: game.scene.isActive('GameScene')
    };
  });
  expect(state).toEqual({
    packId: 'e2e',
    chapterId: 'chapter-2',
    page: 1,
    gameActive: false
  });
});

test('invalid preview data remains on the boot error surface', async ({ page }) => {
  const response = await page.goto(
    './?pack=e2e&level=missing&mode=test',
    { waitUntil: 'domcontentloaded' }
  );
  expect(response?.ok()).toBe(true);
  await page.waitForFunction(() => (
    typeof game !== 'undefined'
      && game.scene.isActive('BootScene')
      && !game.scene.isActive('GameScene')
      && !game.scene.isActive('MenuScene')
  ));

  const state = await page.evaluate(() => ({
    bootActive: game.scene.isActive('BootScene'),
    gameActive: game.scene.isActive('GameScene'),
    menuActive: game.scene.isActive('MenuScene')
  }));
  expect(state).toEqual({
    bootActive: true,
    gameActive: false,
    menuActive: false
  });
});
