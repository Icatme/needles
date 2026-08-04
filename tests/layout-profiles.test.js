const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function loadLayoutRuntime({
  width = 600,
  height = 800,
  search = '',
  screenWidth = 0,
  screenHeight = 0,
  maxTouchPoints = 0
} = {}) {
  const styleValues = new Map();
  const context = vm.createContext({
    console,
    URLSearchParams,
    window: {
      innerWidth: width,
      innerHeight: height,
      visualViewport: null,
      location: { search },
      matchMedia: () => ({ matches: maxTouchPoints > 0 })
    },
    navigator: { maxTouchPoints },
    screen: { width: screenWidth, height: screenHeight },
    document: {
      documentElement: {
        clientWidth: width,
        clientHeight: height,
        dataset: {},
        style: {
          setProperty(name, value) {
            styleValues.set(name, value);
          }
        }
      }
    },
    CONSTANTS: {
      WIDTH: 600,
      HEIGHT: 800,
      WHEEL: { CENTER_X: 300, CENTER_Y: 330, RADIUS: 88 },
      NEEDLE: {
        LENGTH: 100,
        INSERT_DEPTH: 16,
        READY_Y: 700,
        FLY_DURATION_MS: 86,
        FLY_SPEED: 2300
      }
    }
  });

  const root = path.resolve(__dirname, '..');
  const profilesSource = fs.readFileSync(
    path.join(root, 'js/app/LayoutProfiles.js'),
    'utf8'
  );
  const managerSource = fs.readFileSync(
    path.join(root, 'js/app/LayoutManager.js'),
    'utf8'
  );

  vm.runInContext(profilesSource, context);
  vm.runInContext(managerSource, context);
  vm.runInContext(
    'globalThis.__profiles = LAYOUT_PROFILES; globalThis.__manager = LayoutManager;',
    context
  );

  return {
    context,
    profiles: context.__profiles,
    manager: context.__manager,
    styleValues
  };
}

function closeTo(actual, expected, epsilon = 1e-9) {
  assert.ok(
    Math.abs(actual - expected) <= epsilon,
    `${actual} should be close to ${expected}`
  );
}

test('auto-selects classic, 9:16, and tall phone profiles by viewport ratio', () => {
  const { manager } = loadLayoutRuntime();

  assert.equal(
    manager.resolveProfileId({ width: 600, height: 800, ratio: 4 / 3 }, null),
    'classic'
  );
  assert.equal(
    manager.resolveProfileId({ width: 360, height: 640, ratio: 16 / 9 }, null),
    'phone-9-16'
  );
  assert.equal(
    manager.resolveProfileId({ width: 390, height: 844, ratio: 844 / 390 }, null),
    'phone-tall'
  );
});

test('uses stable physical screen ratio on touch phones to ignore browser chrome changes', () => {
  const { manager } = loadLayoutRuntime({
    width: 390,
    height: 740,
    screenWidth: 390,
    screenHeight: 844,
    maxTouchPoints: 5
  });

  const viewport = manager.getViewportInfo();
  assert.equal(viewport.ratio, 844 / 390);
  assert.equal(manager.resolveProfileId(viewport, null), 'phone-tall');
});

test('query override selects a deterministic preview profile', () => {
  const { manager } = loadLayoutRuntime({ search: '?layout=phone-9-16' });
  assert.equal(manager.resolveProfileId(), 'phone-9-16');
  assert.equal(
    manager.resolveProfileId({ width: 1200, height: 800, ratio: 2 / 3 }),
    'phone-9-16'
  );
});

test('bootstrap applies logical dimensions, gameplay anchors, flight speed, and CSS metadata', () => {
  const { context, manager, styleValues } = loadLayoutRuntime({
    width: 360,
    height: 640
  });

  const profile = manager.bootstrap();
  const flight = manager.getNeedleFlightMetrics(profile);
  assert.equal(profile.id, 'phone-9-16');
  assert.equal(context.CONSTANTS.WIDTH, 600);
  assert.equal(context.CONSTANTS.HEIGHT, 1064);
  assert.equal(context.CONSTANTS.WHEEL.CENTER_Y, 430);
  assert.equal(context.CONSTANTS.NEEDLE.READY_Y, 900);
  closeTo(context.CONSTANTS.NEEDLE.FLY_SPEED, flight.speed);
  assert.equal(context.document.documentElement.dataset.layoutProfile, 'phone-9-16');
  assert.equal(context.document.documentElement.dataset.layoutFamily, 'phone');
  assert.equal(styleValues.get('--layout-height'), '1064');
});

test('needle flight duration stays identical while visual distance changes by profile', () => {
  const { profiles, manager } = loadLayoutRuntime();
  const metrics = [
    profiles.classic,
    profiles['phone-9-16'],
    profiles['phone-tall']
  ].map(profile => manager.getNeedleFlightMetrics(profile));

  assert.deepEqual(metrics.map(metric => metric.distance), [198, 298, 358]);
  metrics.forEach(metric => {
    assert.equal(metric.durationMs, 86);
    closeTo(metric.distance / metric.speed * 1000, 86);
  });
  assert.ok(metrics[0].speed < metrics[1].speed);
  assert.ok(metrics[1].speed < metrics[2].speed);
});

test('all profiles preserve a 600-wide coordinate system and integral eighth-scale heights', () => {
  const { profiles } = loadLayoutRuntime();

  Object.values(profiles).forEach(profile => {
    assert.equal(profile.design.width, 600);
    assert.equal(profile.design.height % 8, 0);
    assert.ok(profile.game.readyNeedleY < profile.design.height);
    assert.ok(profile.result.failure.footerY < profile.design.height);
    assert.ok(profile.levelSelect.footerY < profile.design.height);
  });
});
