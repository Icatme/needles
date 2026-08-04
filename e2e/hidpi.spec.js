const { test, expect } = require('@playwright/test');

test.use({
  viewport: { width: 1070, height: 994 },
  deviceScaleFactor: 1.25
});

test('uses a high-DPI backing buffer without changing the 600 × 800 layout', async ({ page }) => {
  const response = await page.goto('./', { waitUntil: 'domcontentloaded' });
  expect(response?.ok(), 'index.html should load successfully').toBe(true);

  await page.waitForFunction(() => {
    try {
      return typeof HiDPIRenderer !== 'undefined'
        && typeof game !== 'undefined'
        && Boolean(game?.scene?.isActive('MenuScene'));
    } catch (error) {
      return false;
    }
  }, undefined, { timeout: 15_000 });

  await page.waitForTimeout(100);

  const metrics = await page.evaluate(() => {
    const canvas = document.querySelector('#game-container canvas');
    const scene = game.scene.getScene('MenuScene');
    const camera = scene.cameras.main;
    const text = scene.children.list.find(child => child.type === 'Text');
    const bounds = canvas.getBoundingClientRect();

    return {
      renderScale: HiDPIRenderer.getRenderScale(),
      backingWidth: canvas.width,
      backingHeight: canvas.height,
      displayWidth: bounds.width,
      displayHeight: bounds.height,
      cameraWidth: camera.width,
      cameraHeight: camera.height,
      cameraZoomX: camera.zoomX,
      cameraZoomY: camera.zoomY,
      cameraScrollX: camera.scrollX,
      cameraScrollY: camera.scrollY,
      worldView: {
        x: camera.worldView.x,
        y: camera.worldView.y,
        width: camera.worldView.width,
        height: camera.worldView.height
      },
      textResolution: text?.style?.resolution
    };
  });

  expect(metrics.renderScale).toBe(1.25);
  expect(metrics.backingWidth).toBe(750);
  expect(metrics.backingHeight).toBe(1000);
  expect(metrics.displayWidth).toBeCloseTo(600, 1);
  expect(metrics.displayHeight).toBeCloseTo(800, 1);
  expect(metrics.backingWidth / metrics.displayWidth).toBeCloseTo(1.25, 2);
  expect(metrics.backingHeight / metrics.displayHeight).toBeCloseTo(1.25, 2);

  expect(metrics.cameraWidth).toBe(750);
  expect(metrics.cameraHeight).toBe(1000);
  expect(metrics.cameraZoomX).toBeCloseTo(1.25, 5);
  expect(metrics.cameraZoomY).toBeCloseTo(1.25, 5);
  expect(metrics.cameraScrollX).toBeCloseTo(-75, 5);
  expect(metrics.cameraScrollY).toBeCloseTo(-100, 5);
  expect(metrics.worldView.x).toBeCloseTo(0, 5);
  expect(metrics.worldView.y).toBeCloseTo(0, 5);
  expect(metrics.worldView.width).toBeCloseTo(600, 5);
  expect(metrics.worldView.height).toBeCloseTo(800, 5);
  expect(metrics.textResolution).toBeCloseTo(1.25, 5);
});
