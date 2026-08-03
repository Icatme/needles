const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');

function load(context, relativePath, names) {
    const source = fs.readFileSync(path.join(root, relativePath), 'utf8');
    const bridge = names.map(name => `this.${name} = ${name};`).join('\n');
    vm.runInContext(`${source}\n${bridge}`, context, { filename: relativePath });
}

function createStorage(initial = {}) {
    const values = new Map(Object.entries(initial));
    return {
        values,
        getItem(key) { return values.has(key) ? values.get(key) : null; },
        setItem(key, value) { values.set(key, String(value)); },
        removeItem(key) { values.delete(key); }
    };
}

function makeLevel(id, order, chapterId) {
    return Object.freeze({
        id: order,
        packLevelId: id,
        order,
        chapterId,
        chapter: chapterId === 'intro' ? 1 : 2,
        name: id,
        rule: '',
        needleCount: 5,
        layout: Object.freeze({ id: 'empty', obstacleAngles: Object.freeze([]) }),
        rhythm: Object.freeze({
            segments: Object.freeze([
                Object.freeze({ durationMs: 4000, velocity: 0.4 })
            ])
        }),
        designIntent: Object.freeze({ tier: 1, milestone: false })
    });
}

const irregularPack = Object.freeze({
    id: 'irregular-pack',
    version: '1.0.0',
    name: 'Irregular Pack',
    caption: '',
    difficultyModel: 'legacy-linear',
    chapters: Object.freeze(['Intro', 'Long Chapter']),
    chapterDescriptors: Object.freeze([
        Object.freeze({ id: 'intro', order: 1, title: 'Intro' }),
        Object.freeze({ id: 'long', order: 2, title: 'Long Chapter' })
    ]),
    levels: Object.freeze([
        makeLevel('irregular-a', 1, 'intro'),
        makeLevel('irregular-b', 2, 'intro'),
        ...Array.from({ length: 13 }, (_, index) => (
            makeLevel(`irregular-long-${index + 1}`, index + 3, 'long')
        ))
    ])
});

const context = vm.createContext({
    console,
    Math,
    Number,
    JSON,
    Object,
    Array,
    Map,
    Set
});
load(context, 'js/packs/PackRegistry.js', ['PackRegistry']);
load(context, 'js/app/ProgressStore.js', ['ProgressStore']);
load(context, 'js/app/LevelCatalogService.js', ['LevelCatalogService']);
load(context, 'js/app/AppRouter.js', ['AppRouter']);

function createServices(storage = createStorage()) {
    const registry = new context.PackRegistry();
    registry.register(irregularPack);
    registry.setDefault(irregularPack.id);
    const catalog = new context.LevelCatalogService({ registry });
    const progress = new context.ProgressStore({
        storage,
        storageKey: 'progress',
        legacyPackKey: 'legacy-pack'
    });
    const router = new context.AppRouter({ catalog });
    return { registry, catalog, progress, router };
}

test('catalog uses manifest chapters and arbitrary chapter sizes', () => {
    const { catalog } = createServices();
    assert.deepEqual(
        JSON.parse(JSON.stringify(catalog.listChapters(irregularPack.id))),
        [
            { id: 'intro', order: 1, title: 'Intro' },
            { id: 'long', order: 2, title: 'Long Chapter' }
        ]
    );
    assert.equal(catalog.listLevels(irregularPack.id, 'intro').length, 2);
    assert.equal(catalog.listLevels(irregularPack.id, 'long').length, 13);
    assert.equal(catalog.getNextLevel(irregularPack.id, 'irregular-b').packLevelId, 'irregular-long-1');
});

test('legacy numeric progress migrates to stable completed level ids', () => {
    const storage = createStorage({
        progress: JSON.stringify({
            maxLevel: 9,
            packs: { 'irregular-pack': 3 }
        }),
        'legacy-pack': 'irregular-pack'
    });
    const { progress } = createServices(storage);
    const record = progress.getPackProgress(irregularPack);

    assert.equal(progress.getActivePackId('missing', ['irregular-pack']), 'irregular-pack');
    assert.equal(record.maxUnlockedOrder, 3);
    assert.deepEqual(record.completedLevelIds, ['irregular-a', 'irregular-b']);

    const saved = JSON.parse(storage.getItem('progress'));
    assert.equal(saved.version, 2);
    assert.deepEqual(saved.packs['irregular-pack'].completedLevelIds, [
        'irregular-a',
        'irregular-b'
    ]);
});

test('test routes never modify persistent progress', () => {
    const storage = createStorage();
    const { progress } = createServices(storage);
    const before = progress.getPackProgress(irregularPack);
    progress.completeLevel(irregularPack, 'irregular-a', 'test');
    const afterTest = progress.getPackProgress(irregularPack);
    assert.deepEqual(afterTest, before);

    progress.completeLevel(irregularPack, 'irregular-a', 'progression');
    const afterProgression = progress.getPackProgress(irregularPack);
    assert.deepEqual(afterProgression.completedLevelIds, ['irregular-a']);
    assert.equal(afterProgression.maxUnlockedOrder, 2);
});

test('routes carry stable pack and level identity across retries and next levels', () => {
    const { router } = createServices();
    const testRoute = router.normalizeLevelRoute({
        packId: 'irregular-pack',
        levelId: 'irregular-b',
        mode: 'test'
    });
    assert.deepEqual(JSON.parse(JSON.stringify(testRoute)), {
        type: 'level',
        packId: 'irregular-pack',
        levelId: 'irregular-b',
        mode: 'test'
    });

    const next = router.nextLevelRoute(testRoute);
    assert.equal(next.levelId, 'irregular-long-1');
    assert.equal(next.mode, 'test');
});

test('legacy numeric route references remain bounded but string ids stay strict', () => {
    const { catalog, router } = createServices();
    assert.equal(catalog.getLevel('irregular-pack', 999).packLevelId, 'irregular-long-13');
    assert.equal(router.normalizeLevelRoute({
        packId: 'irregular-pack',
        level: -5
    }).levelId, 'irregular-a');
    assert.throws(
        () => catalog.getLevel('irregular-pack', 'misspelled-level'),
        /Unknown level/
    );
});

test('scenes do not access progress storage or hidden test-mode flags', () => {
    const files = [
        'js/managers/LevelManager.js',
        'js/scenes/EnhancedMenuScene.js',
        'js/scenes/LevelSelectScene.js',
        'js/scenes/GameScene.js',
        'js/scenes/GameOverScene.js'
    ];

    files.forEach(relativePath => {
        const source = fs.readFileSync(path.join(root, relativePath), 'utf8');
        assert.doesNotMatch(source, /localStorage/);
        assert.doesNotMatch(source, /sessionStorage/);
        assert.doesNotMatch(source, /needle_game_test_mode/);
    });
});

test('level browser has no fixed ten-level chapter arithmetic', () => {
    const source = fs.readFileSync(
        path.join(root, 'js/scenes/LevelSelectScene.js'),
        'utf8'
    );
    assert.doesNotMatch(source, /chapter\s*-\s*1\)\s*\*\s*10/);
    assert.doesNotMatch(source, /Math\.ceil\([^)]*levelCount[^)]*\/\s*10/);
    assert.match(source, /listLevels\(this\.packId, this\.chapterId\)/);
    assert.match(source, /getPageCount/);
});
