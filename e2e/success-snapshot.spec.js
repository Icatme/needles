const { test, expect } = require('@playwright/test');

const PACK_INDEX = {
  schema: 'needles.pack-index/v1',
  defaultPackId: 'success-snapshot',
  packs: [
    { id: 'success-snapshot', manifest: 'success-snapshot/manifest.json' }
  ]
};

const MANIFEST = {
  schema: 'needles.level-pack/v1',
  id: 'success-snapshot',
  version: '1.0.0',
  title: '成功截图测试包',
  caption: '仅用于浏览器回归测试',
  engineCompatibility: 'classic-v1',
  difficultyModel: 'legacy-linear',
  chapters: [
    { id: 'smoke', order: 1, title: '成功截图' }
  ],
  resources: {
    presets: 'presets.json',
    levels: 'levels.json'
  }
};

const PRESETS = {
  schema: 'needles.level-presets/v1',
  layouts: {
    clear: { obstacleAngles: [] }
  }
};

const LEVELS = {
  schema: 'needles.level-list/v1',
  levels: [
    {
      id: 'success-01',
      legacyNumericId: 1,
      chapterId: 'smoke',
      order: 1,
      title: '最终一针',
      instruction: '完成后截取最终排布',
      objective: { insertCount: 1 },
      layoutRef: 'clear',
      rhythm: {
        segments: [{ durationMs: 4000, velocity: 0.3 }]
      },
      presentation: {
        tier: 1,
        milestone: true,
        focus: 'timing'
      },
      tags: ['e2e', 'success', 'snapshot']
    }
  ]
};

async function waitForScene(page, sceneKey) {
  await page.waitForFunction(key => {
    try {
      return typeof game !== 'undefined' && Boolean(game?.scene?.isActive(key));
    } catch (error) {
      return false;
    }
  }, sceneKey, { timeout: 15_000 });
}

async function installFixture(page) {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.route('**/packs/index.json', route => route.fulfill({ json: PACK_INDEX }));
  await page.route('**/packs/success-snapshot/manifest.json', route => (
    route.fulfill({ json: MANIFEST })
  ));
  await page.route('**/packs/success-snapshot/presets.json', route => (
    route.fulfill({ json: PRESETS })
  ));
  await page.route('**/packs/success-snapshot/levels.json', route => (
    route.fulfill({ json: LEVELS })
  ));
}

test('shows and releases the actual final frame on successful completion', async ({ page }) => {
  await installFixture(page);

  const consoleErrors = [];
  const pageErrors = [];
  page.on('console', message => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('pageerror', error => pageErrors.push(error.message));

  const response = await page.goto('/?layout=classic', { waitUntil: 'domcontentloaded' });
  expect(response?.ok()).toBe(true);
  await waitForScene(page, 'MenuScene');

  await page.keyboard.press('Enter');
  await waitForScene(page, 'GameScene');
  await page.keyboard.press('Space');
  await waitForScene(page, 'GameOverScene');

  const presentation = await page.evaluate(() => {
    const result = game.scene.getScene('GameOverScene');
    const snapshot = result.successSnapshot;
    const hasOldHeadline = result.children.list.some(child => (
      child.type === 'Text'
        && (child.text.includes('漂亮') || child.text.includes('这一圈完成了'))
    ));

    return {
      success: result.success,
      completedAll: result.completedAll,
      snapshotWidth: Number(snapshot?.naturalWidth || snapshot?.width || 0),
      snapshotHeight: Number(snapshot?.naturalHeight || snapshot?.height || 0),
      previewActive: Boolean(result.successPreviewImage?.active),
      previewDisplayWidth: result.successPreviewImage?.displayWidth || 0,
      previewDisplayHeight: result.successPreviewImage?.displayHeight || 0,
      resultTitle: result.resultTitle,
      textureKey: result.resultSnapshotTextureKey,
      hasOldHeadline
    };
  });

  expect(presentation.success).toBe(true);
  expect(presentation.completedAll).toBe(true);
  expect(presentation.snapshotWidth).toBeGreaterThan(0);
  expect(presentation.snapshotHeight).toBeGreaterThan(0);
  expect(presentation.previewActive).toBe(true);
  expect(presentation.previewDisplayWidth).toBeCloseTo(360, 1);
  expect(presentation.previewDisplayHeight).toBeCloseTo(252, 1);
  expect(presentation.resultTitle).toBeNull();
  expect(presentation.hasOldHeadline).toBe(false);
  expect(presentation.textureKey).toMatch(/^result-snapshot-success-/);

  await page.keyboard.press('Enter');
  await waitForScene(page, 'MenuScene');
  expect(await page.evaluate(textureKey => game.textures.exists(textureKey), presentation.textureKey))
    .toBe(false);

  expect(consoleErrors).toEqual([]);
  expect(pageErrors).toEqual([]);
});
