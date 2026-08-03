const { test, expect } = require('@playwright/test');

const E2E_PACK_INDEX = {
  schema: 'needles.pack-index/v1',
  defaultPackId: 'e2e',
  packs: [
    { id: 'e2e', manifest: 'e2e/manifest.json' },
    { id: 'balanced-v2', manifest: 'balanced-v2/manifest.json' },
    { id: 'legacy', manifest: 'legacy/manifest.json' }
  ]
};

const E2E_MANIFEST = {
  schema: 'needles.level-pack/v1',
  id: 'e2e',
  version: '1.0.0',
  title: '浏览器测试包',
  caption: '仅由 Playwright 网络拦截注入',
  engineCompatibility: 'classic-v1',
  difficultyModel: 'legacy-linear',
  chapters: [
    { id: 'smoke', order: 1, title: '稳定流程' }
  ],
  resources: {
    presets: 'presets.json',
    levels: 'levels.json'
  }
};

const E2E_PRESETS = {
  schema: 'needles.level-presets/v1',
  layouts: {
    clear: { obstacleAngles: [] },
    blocked: { obstacleAngles: [90] }
  }
};

const E2E_LEVELS = {
  schema: 'needles.level-list/v1',
  levels: [
    {
      id: 'e2e-01',
      legacyNumericId: 1,
      chapterId: 'smoke',
      order: 1,
      title: '一针通过',
      instruction: '一针无障碍 · 用于稳定完成',
      objective: { insertCount: 1 },
      layoutRef: 'clear',
      rhythm: {
        segments: [{ durationMs: 4000, velocity: 0.3 }]
      },
      presentation: {
        tier: 1,
        milestone: false,
        focus: 'timing'
      },
      tags: ['e2e', 'success']
    },
    {
      id: 'e2e-02',
      legacyNumericId: 2,
      chapterId: 'smoke',
      order: 2,
      title: '命中障碍',
      instruction: '命中点放置障碍 · 用于稳定失败',
      objective: { insertCount: 1 },
      layoutRef: 'blocked',
      rhythm: {
        segments: [{ durationMs: 4000, velocity: 0.3 }]
      },
      presentation: {
        tier: 1,
        milestone: true,
        focus: 'zones'
      },
      tags: ['e2e', 'collision']
    }
  ]
};

async function installFixturePack(page) {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.route('**/packs/index.json', route => route.fulfill({ json: E2E_PACK_INDEX }));
  await page.route('**/packs/e2e/manifest.json', route => route.fulfill({ json: E2E_MANIFEST }));
  await page.route('**/packs/e2e/presets.json', route => route.fulfill({ json: E2E_PRESETS }));
  await page.route('**/packs/e2e/levels.json', route => route.fulfill({ json: E2E_LEVELS }));
}

function watchBrowserFailures(page) {
  const failures = {
    consoleErrors: [],
    pageErrors: [],
    requestFailures: []
  };

  page.on('console', message => {
    if (message.type() === 'error') failures.consoleErrors.push(message.text());
  });
  page.on('pageerror', error => failures.pageErrors.push(error.message));
  page.on('requestfailed', request => {
    const errorText = request.failure()?.errorText || '';
    if (errorText === 'net::ERR_ABORTED') return;
    failures.requestFailures.push(`${request.method()} ${request.url()} — ${errorText}`);
  });
  return failures;
}

async function waitForScene(page, sceneKey) {
  await page.waitForFunction(key => {
    try {
      return typeof game !== 'undefined' && Boolean(game?.scene?.isActive(key));
    } catch (error) {
      return false;
    }
  }, sceneKey, { timeout: 15_000 });
}

async function openFixtureApp(page) {
  const response = await page.goto('/', { waitUntil: 'domcontentloaded' });
  expect(response?.ok()).toBe(true);
  await expect(page.locator('#game-container canvas')).toBeVisible();
  await page.waitForFunction(() => {
    try {
      return typeof LEVEL_PACK_REGISTRY !== 'undefined'
        && LEVEL_PACK_REGISTRY.size === 3
        && typeof game !== 'undefined'
        && Boolean(game?.scene?.isActive('MenuScene'));
    } catch (error) {
      return false;
    }
  }, undefined, { timeout: 15_000 });
}

async function clickCanvasPoint(page, x, y) {
  const box = await page.locator('#game-container canvas').boundingBox();
  if (!box) throw new Error('Game canvas has no bounding box');
  await page.mouse.click(
    box.x + x / 600 * box.width,
    box.y + y / 800 * box.height
  );
}

async function expectCleanBrowser(failures) {
  expect(failures.consoleErrors, 'browser console errors').toEqual([]);
  expect(failures.pageErrors, 'uncaught page errors').toEqual([]);
  expect(failures.requestFailures, 'failed network requests').toEqual([]);
}

test.beforeEach(async ({ page }) => {
  await installFixturePack(page);
});

test('skin selection survives reload and the level browser switches packs', async ({ page }) => {
  const failures = watchBrowserFailures(page);
  await openFixtureApp(page);

  expect(await page.evaluate(() => new ThemeManager().activeThemeId))
    .toBe('clockwork-observatory');
  await page.keyboard.press('ArrowRight');
  await page.waitForFunction(() => new ThemeManager().activeThemeId === 'gilded-jewel-box');

  await page.reload({ waitUntil: 'domcontentloaded' });
  await waitForScene(page, 'MenuScene');
  expect(await page.evaluate(() => new ThemeManager().activeThemeId))
    .toBe('gilded-jewel-box');

  await page.keyboard.press('l');
  await waitForScene(page, 'LevelSelectScene');
  expect(await page.evaluate(() => game.scene.getScene('LevelSelectScene').packId))
    .toBe('e2e');

  await page.keyboard.press('ArrowDown');
  await page.waitForFunction(() => (
    game.scene.isActive('LevelSelectScene')
      && game.scene.getScene('LevelSelectScene').packId === 'balanced-v2'
  ));
  expect(await page.evaluate(() => APP_CONTEXT.progress.snapshot().activePackId))
    .toBe('balanced-v2');

  await page.keyboard.press('ArrowUp');
  await page.waitForFunction(() => (
    game.scene.isActive('LevelSelectScene')
      && game.scene.getScene('LevelSelectScene').packId === 'e2e'
  ));
  await expectCleanBrowser(failures);
});

test('test mode completes and retries without modifying progression', async ({ page }) => {
  const failures = watchBrowserFailures(page);
  await openFixtureApp(page);

  await page.keyboard.press('l');
  await waitForScene(page, 'LevelSelectScene');
  await clickCanvasPoint(page, 80, 342);
  await waitForScene(page, 'GameScene');

  expect(await page.evaluate(() => game.scene.getScene('GameScene').route))
    .toMatchObject({ packId: 'e2e', levelId: 'e2e-01', mode: 'test' });

  await page.keyboard.press('Space');
  await waitForScene(page, 'GameOverScene');
  expect(await page.evaluate(() => {
    const result = game.scene.getScene('GameOverScene');
    return { success: result.success, route: result.route };
  })).toMatchObject({
    success: true,
    route: { packId: 'e2e', levelId: 'e2e-01', mode: 'test' }
  });

  expect(await page.evaluate(() => (
    APP_CONTEXT.progress.getPackProgress(APP_CONTEXT.catalog.getPack('e2e'))
  ))).toMatchObject({ completedLevelIds: [], maxUnlockedOrder: 1 });

  await page.keyboard.press('Enter');
  await waitForScene(page, 'GameScene');
  expect(await page.evaluate(() => game.scene.getScene('GameScene').route))
    .toMatchObject({ packId: 'e2e', levelId: 'e2e-02', mode: 'test' });

  await page.keyboard.press('Space');
  await waitForScene(page, 'GameOverScene');
  expect(await page.evaluate(() => {
    const result = game.scene.getScene('GameOverScene');
    return { success: result.success, route: result.route };
  })).toMatchObject({
    success: false,
    route: { packId: 'e2e', levelId: 'e2e-02', mode: 'test' }
  });

  await page.keyboard.press('Enter');
  await waitForScene(page, 'GameScene');
  expect(await page.evaluate(() => game.scene.getScene('GameScene').route))
    .toMatchObject({ packId: 'e2e', levelId: 'e2e-02', mode: 'test' });
  expect(await page.evaluate(() => (
    APP_CONTEXT.progress.getPackProgress(APP_CONTEXT.catalog.getPack('e2e'))
  ))).toMatchObject({ completedLevelIds: [], maxUnlockedOrder: 1 });
  await expectCleanBrowser(failures);
});

test('progression unlocks the next stable id and survives reload', async ({ page }) => {
  const failures = watchBrowserFailures(page);
  await openFixtureApp(page);

  await page.keyboard.press('Enter');
  await waitForScene(page, 'GameScene');
  expect(await page.evaluate(() => game.scene.getScene('GameScene').route))
    .toMatchObject({ packId: 'e2e', levelId: 'e2e-01', mode: 'progression' });

  await page.keyboard.press('Space');
  await waitForScene(page, 'GameOverScene');
  expect(await page.evaluate(() => (
    APP_CONTEXT.progress.getPackProgress(APP_CONTEXT.catalog.getPack('e2e'))
  ))).toMatchObject({
    completedLevelIds: ['e2e-01'],
    maxUnlockedOrder: 2
  });

  await page.reload({ waitUntil: 'domcontentloaded' });
  await waitForScene(page, 'MenuScene');
  expect(await page.evaluate(() => APP_CONTEXT.getResumeRoute('e2e')))
    .toMatchObject({ packId: 'e2e', levelId: 'e2e-02', mode: 'progression' });

  await page.keyboard.press('Enter');
  await waitForScene(page, 'GameScene');
  expect(await page.evaluate(() => game.scene.getScene('GameScene').route))
    .toMatchObject({ packId: 'e2e', levelId: 'e2e-02', mode: 'progression' });

  await page.keyboard.press('Space');
  await waitForScene(page, 'GameOverScene');
  expect(await page.evaluate(() => game.scene.getScene('GameOverScene').success))
    .toBe(false);

  await page.keyboard.press('Enter');
  await waitForScene(page, 'GameScene');
  expect(await page.evaluate(() => game.scene.getScene('GameScene').route))
    .toMatchObject({ packId: 'e2e', levelId: 'e2e-02', mode: 'progression' });
  await expectCleanBrowser(failures);
});
