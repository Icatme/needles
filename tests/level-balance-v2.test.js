const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const projectRoot = path.resolve(__dirname, '..');

function loadIntoContext(context, relativePath, exportNames) {
    const source = fs.readFileSync(path.join(projectRoot, relativePath), 'utf8');
    const exports = exportNames
        .map(name => `this.${name} = ${name};`)
        .join('\n');
    vm.runInContext(`${source}\n${exports}`, context, {
        filename: relativePath
    });
}

function createStorage() {
    const values = new Map();
    return {
        values,
        api: {
            getItem(key) { return values.get(key) || null; },
            setItem(key, value) { values.set(key, value); },
            removeItem(key) { values.delete(key); }
        }
    };
}

function readJson(relativePath) {
    return JSON.parse(fs.readFileSync(path.join(projectRoot, relativePath), 'utf8'));
}

const local = createStorage();
const context = vm.createContext({
    console,
    Math,
    Number,
    JSON,
    Object,
    Array,
    Map,
    Set,
    localStorage: local.api
});

loadIntoContext(context, 'js/utils/constants.js', ['CONSTANTS']);
loadIntoContext(context, 'js/data/levels.js', ['LEVEL_LAYOUTS', 'LEVEL_DEFINITIONS']);
loadIntoContext(context, 'js/data/balancedLevels.js', [
    'LEVEL_PACK_STORAGE_KEY',
    'DEFAULT_LEVEL_PACK_ID',
    'BALANCED_LEVEL_DEFINITIONS',
    'LEVEL_PACKS'
]);
loadIntoContext(context, 'js/managers/RhythmManager.js', ['RhythmManager']);
loadIntoContext(context, 'js/managers/DifficultyManager.js', ['DifficultyManager']);
loadIntoContext(context, 'js/managers/DifficultyModelV2.js', ['DifficultyModelV2']);
loadIntoContext(context, 'js/packs/LevelResolver.js', ['LevelResolver']);
loadIntoContext(context, 'js/packs/PackRegistry.js', [
    'PackRegistry',
    'LEVEL_PACK_REGISTRY'
]);

['balanced-v2', 'legacy'].forEach(packId => {
    const manifest = readJson(`packs/${packId}/manifest.json`);
    const presets = readJson(`packs/${packId}/presets.json`);
    const levels = readJson(`packs/${packId}/levels.json`);
    context.LEVEL_PACK_REGISTRY.register(
        new context.LevelResolver().resolvePack(manifest, presets, levels)
    );
});
context.LEVEL_PACK_REGISTRY.setDefault('balanced-v2');

loadIntoContext(context, 'js/app/ProgressStore.js', ['ProgressStore']);
loadIntoContext(context, 'js/app/LevelCatalogService.js', ['LevelCatalogService']);
loadIntoContext(context, 'js/app/AppRouter.js', ['AppRouter']);
loadIntoContext(context, 'js/app/AppContext.js', ['AppContext', 'APP_CONTEXT']);
loadIntoContext(context, 'js/managers/LevelManager.js', ['LevelManager']);

const balanced = Array.from(context.BALANCED_LEVEL_DEFINITIONS);
const legacy = Array.from(context.LEVEL_DEFINITIONS);
const model = new context.DifficultyModelV2();
const audits = balanced.map(level => model.validate(level));

test('balanced-v2 is an independent fifty-level pack beside the legacy catalog', () => {
    assert.equal(context.DEFAULT_LEVEL_PACK_ID, 'balanced-v2');
    assert.equal(context.LEVEL_PACKS['balanced-v2'].levels.length, 50);
    assert.equal(context.LEVEL_PACKS.legacy.levels.length, 50);
    assert.notEqual(
        context.LEVEL_PACKS['balanced-v2'].levels,
        context.LEVEL_PACKS.legacy.levels
    );
    assert.deepEqual(
        balanced.map(level => level.id),
        Array.from({ length: 50 }, (_, index) => index + 1)
    );
    assert.equal(new Set(balanced.map(level => level.name)).size, 50);
});

test('every balanced level remains geometrically valid and fully reachable', () => {
    audits.forEach((audit, index) => {
        assert.equal(
            audit.valid,
            true,
            `level ${index + 1}: ${audit.errors.join('; ')}`
        );
        assert.equal(audit.analysis.modelVersion, 'nonlinear-v2');
        assert.equal(audit.analysis.opportunity.allShotStatesReachable, true);
        assert.ok(audit.analysis.drivers.length >= 5);
    });
});

test('the authored curve is monotonic and removes the former level-ten cliff', () => {
    const scores = audits.map(audit => audit.analysis.score);

    for (let index = 1; index < scores.length; index++) {
        const jump = scores[index] - scores[index - 1];
        assert.ok(
            jump >= 0,
            `difficulty drops at ${index + 1}: ${scores[index - 1]} -> ${scores[index]}`
        );
        assert.ok(
            jump <= 4.1,
            `difficulty cliff at ${index + 1}: ${scores[index - 1]} -> ${scores[index]}`
        );
    }

    assert.ok(scores[9] - scores[8] <= 2.0);
    assert.ok(scores[9] - scores[0] >= 8);
    assert.ok(scores[49] > scores[39]);
});

test('density and speed pressures use accelerating nonlinear curves', () => {
    const steady = velocity => ({
        segments: [{ durationMs: 4000, velocity }]
    });
    const makeLevel = (needleCount, velocity) => ({
        id: 1,
        chapter: 1,
        name: 'synthetic',
        rule: '',
        needleCount,
        layout: { id: 'Z0', obstacleAngles: [] },
        rhythm: steady(velocity),
        designIntent: { tier: 1, milestone: false }
    });

    const density10 = model.analyze(makeLevel(10, 0.58)).pressure.density;
    const density12 = model.analyze(makeLevel(12, 0.58)).pressure.density;
    const density16 = model.analyze(makeLevel(16, 0.58)).pressure.density;
    const density18 = model.analyze(makeLevel(18, 0.58)).pressure.density;
    assert.ok(density12 - density10 < density18 - density16);

    const speed36 = model.analyze(makeLevel(12, 0.36)).pressure.speed;
    const speed52 = model.analyze(makeLevel(12, 0.52)).pressure.speed;
    const speed82 = model.analyze(makeLevel(12, 0.82)).pressure.speed;
    const speed110 = model.analyze(makeLevel(12, 1.10)).pressure.speed;
    assert.ok(speed52 - speed36 < speed110 - speed82);
});

test('combined density, speed, rhythm and state changes receive an interaction bonus', () => {
    const finale = audits[49].analysis;
    const opening = audits[0].analysis;

    assert.ok(finale.interactionBonus > opening.interactionBonus);
    assert.ok(finale.pressure.interaction > 0);
    assert.equal(finale.drivers[0].value >= finale.drivers[1].value, true);
});

test('balanced level ten teaches one compound step instead of stacking the old finale', () => {
    const oldTen = legacy[9];
    const newTen = balanced[9];
    const oldModifierCount = Object.keys(oldTen.rhythm.shotModifier || {}).length;
    const newModifierCount = Object.keys(newTen.rhythm.shotModifier || {}).length;

    assert.equal(oldTen.layout.obstacleAngles.length, 4);
    assert.equal(oldTen.rhythm.segments.length, 4);
    assert.ok(oldModifierCount > 0);

    assert.equal(newTen.layout.obstacleAngles.length, 3);
    assert.equal(newTen.rhythm.segments.length, 2);
    assert.equal(newModifierCount, 0);
});

test('level manager delegates pack selection and route mode to AppContext', () => {
    local.values.clear();
    context.APP_CONTEXT.resetProgress();
    context.APP_CONTEXT.setActivePackId('balanced-v2');

    const normalManager = new context.LevelManager('balanced-v2', {
        mode: 'progression'
    });
    normalManager.startLevel('balanced-v2-01');
    normalManager.completeLevel();
    assert.equal(normalManager.maxUnlockedLevel, 2);

    const testManager = new context.LevelManager('balanced-v2', { mode: 'test' });
    testManager.startLevel('balanced-v2-02');
    testManager.completeLevel();
    assert.equal(testManager.maxUnlockedLevel, 2);

    normalManager.setActivePack('legacy');
    assert.equal(normalManager.getLevelConfig('legacy-10').name, '基础合奏');
    assert.equal(context.APP_CONTEXT.getActivePackId(), 'legacy');
});

test('the browser entrypoint discovers packs and explicit application routes', () => {
    const index = fs.readFileSync(path.join(projectRoot, 'index.html'), 'utf8');
    const boot = fs.readFileSync(path.join(projectRoot, 'js/scenes/BootScene.js'), 'utf8');
    const main = fs.readFileSync(path.join(projectRoot, 'js/main.js'), 'utf8');
    const selector = fs.readFileSync(
        path.join(projectRoot, 'js/scenes/LevelSelectScene.js'),
        'utf8'
    );

    assert.doesNotMatch(index, /js\/data\/balancedLevels\.js/);
    assert.doesNotMatch(index, /js\/data\/levels\.js/);
    assert.match(index, /js\/packs\/PackLoader\.js/);
    assert.match(index, /js\/app\/AppContext\.js/);
    assert.match(index, /DifficultyModelV2\.js/);
    assert.match(index, /LevelSelectScene\.js/);
    assert.match(boot, /packs\/index\.json/);
    assert.match(main, /EnhancedMenuScene/);
    assert.match(main, /LevelSelectScene/);
    assert.doesNotMatch(selector, /needle_game_test_mode/);
    assert.match(selector, /mode:\s*'test'/);
});
