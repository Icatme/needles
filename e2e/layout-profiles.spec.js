const { test, expect } = require('@playwright/test');

async function waitForScene(page, sceneKey) {
  await page.waitForFunction(key => {
    try {
      return typeof game !== 'undefined' && Boolean(game?.scene?.isActive(key));
    } catch (error) {
      return false;
    }
  }, sceneKey, { timeout: 15_000 });
}

async function openApp(page, path = '/') {
  const response = await page.goto(path, { waitUntil: 'domcontentloaded' });
  expect(response?.ok()).toBe(true);
  await expect(page.locator('#game-container canvas')).toBeVisible();
  await waitForScene(page, 'MenuScene');
}

test('automatically applies the 9:16 phone template across menu, level select, and game', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 640 });
  await openApp(page);

  const menuMetrics = await page.evaluate(() => {
    const canvas = document.querySelector('#game-container canvas');
    const bounds = canvas.getBoundingClientRect();
    const scene = game.scene.getScene('MenuScene');
    return {
      profileId: LayoutManager.getProfileId(),
      family: document.documentElement.dataset.layoutFamily,
      logicalWidth: CONSTANTS.WIDTH,
      logicalHeight: CONSTANTS.HEIGHT,
      backingWidth: canvas.width,
      backingHeight: canvas.height,
      displayWidth: bounds.width,
      displayHeight: bounds.height,
      menuPrimaryY: scene.layout.buttons.primaryY,
      titleY: scene.titleText.y
    };
  });

  expect(menuMetrics).toMatchObject({
    profileId: 'phone-9-16',
    family: 'phone',
    logicalWidth: 600,
    logicalHeight: 1064,
    backingWidth: 600,
    backingHeight: 1064,
    menuPrimaryY: 720,
    titleY: 142
  });
  expect(menuMetrics.displayWidth / menuMetrics.displayHeight)
    .toBeCloseTo(600 / 1064, 2);

  await page.keyboard.press('l');
  await waitForScene(page, 'LevelSelectScene');
  const levelSelectMetrics = await page.evaluate(() => {
    const scene = game.scene.getScene('LevelSelectScene');
    return {
      gridStartY: scene.layout.grid.startY,
      detailPanelY: scene.layout.detail.panelY,
      footerY: scene.layout.footerY
    };
  });
  expect(levelSelectMetrics).toEqual({
    gridStartY: 430,
    detailPanelY: 820,
    footerY: 1008
  });

  await page.keyboard.press('Escape');
  await waitForScene(page, 'MenuScene');
  await page.keyboard.press('Enter');
  await waitForScene(page, 'GameScene');
  const gameMetrics = await page.evaluate(() => {
    const scene = game.scene.getScene('GameScene');
    return {
      wheelY: scene.wheel.y,
      readyNeedleY: scene.layout.readyNeedleY,
      footerPanelY: scene.uiManager.layout.footer.panelCenterY,
      snapshotY: scene.layout.failureSnapshotArea.y
    };
  });
  expect(gameMetrics).toEqual({
    wheelY: 430,
    readyNeedleY: 900,
    footerPanelY: 1018,
    snapshotY: 220
  });
});

test('automatically selects the tall-phone template for modern long displays', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openApp(page);

  const metrics = await page.evaluate(() => ({
    profileId: LayoutManager.getProfileId(),
    logicalHeight: CONSTANTS.HEIGHT,
    menuFooterY: game.scene.getScene('MenuScene').layout.buttons.footerY
  }));

  expect(metrics).toEqual({
    profileId: 'phone-tall',
    logicalHeight: 1200,
    menuFooterY: 1145
  });
});

test('layout query parameter provides a deterministic visual-review override', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openApp(page, '/?layout=classic');

  expect(await page.evaluate(() => ({
    profileId: LayoutManager.getProfileId(),
    logicalHeight: CONSTANTS.HEIGHT
  }))).toEqual({
    profileId: 'classic',
    logicalHeight: 800
  });
});
