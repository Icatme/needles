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

function makePack(id, version, levels) {
    return Object.freeze({
        id,
        version,
        levels: Object.freeze(levels.map(([levelId, order]) => (
            makeLevel(levelId, order, 'intro')
        )))
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

function createStoredProgress(packId, record, version = 3) {
    const storage = createStorage({
        progress: JSON.stringify({
            version,
            activePackId: packId,
            packs: { [packId]: record }
        })
    });
    return {
        storage,
        progress: new context.ProgressStore({ storage, storageKey: 'progress' })
    };
}

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
    assert.equal(record.resumeLevelId, 'irregular-long-1');
    assert.deepEqual(record.completedLevelIds, ['irregular-a', 'irregular-b']);

    const saved = JSON.parse(storage.getItem('progress'));
    assert.equal(saved.version, 3);
    assert.deepEqual(saved.packs['irregular-pack'].completedLevelIds, [
        'irregular-a',
        'irregular-b'
    ]);
});

test('non-progression routes never modify persistent progress', () => {
    const storage = createStorage();
    const { progress } = createServices(storage);
    const before = progress.getPackProgress(irregularPack);
    progress.completeLevel(irregularPack, 'irregular-a', 'test');
    const afterTest = progress.getPackProgress(irregularPack);
    assert.deepEqual(afterTest, before);

    progress.completeLevel(irregularPack, 'irregular-a', 'daily');
    const afterDaily = progress.getPackProgress(irregularPack);
    assert.deepEqual(afterDaily, before);

    progress.completeLevel(irregularPack, 'irregular-a', 'progression');
    const afterProgression = progress.getPackProgress(irregularPack);
    assert.deepEqual(afterProgression.completedLevelIds, ['irregular-a']);
    assert.equal(afterProgression.resumeLevelId, 'irregular-b');
});

test('v2 progress migrates by stable ids when level orders become sparse', () => {
    const pack = makePack('stable-pack', '2.0.0', [
        ['stable-a', 10],
        ['stable-b', 20],
        ['stable-c', 30]
    ]);
    const { progress, storage } = createStoredProgress('stable-pack', {
        packVersion: '1.0.0',
        completedLevelIds: ['stable-a'],
        maxUnlockedOrder: 2
    }, 2);

    const record = progress.getPackProgress(pack);

    assert.deepEqual(record.completedLevelIds, ['stable-a']);
    assert.equal(record.resumeLevelId, 'stable-b');
    assert.equal(progress.getResumeLevel(pack).packLevelId, 'stable-b');
    assert.equal(Object.hasOwn(record, 'maxUnlockedOrder'), false);

    const saved = JSON.parse(storage.getItem('progress'));
    assert.equal(saved.version, 3);
    assert.equal(saved.packs['stable-pack'].resumeLevelId, 'stable-b');
    assert.equal(Object.hasOwn(saved.packs['stable-pack'], 'maxUnlockedOrder'), false);
});

test('legacy numeric progress means the Nth level rather than an order value', () => {
    const pack = makePack('stable-pack', '2.0.0', [
        ['stable-a', 10],
        ['stable-b', 20],
        ['stable-c', 30]
    ]);
    const storage = createStorage({
        progress: JSON.stringify({
            maxLevel: 999,
            packs: { 'stable-pack': 2 }
        })
    });
    const progress = new context.ProgressStore({ storage, storageKey: 'progress' });

    const record = progress.getPackProgress(pack);

    assert.deepEqual(record.completedLevelIds, ['stable-a']);
    assert.equal(record.resumeLevelId, 'stable-b');
});

test('stable resume identity survives reordering and inserted levels', () => {
    const pack = makePack('stable-pack', '2.0.0', [
        ['inserted-before', 5],
        ['stable-b', 10],
        ['stable-a', 40],
        ['stable-c', 70]
    ]);
    const { progress } = createStoredProgress('stable-pack', {
        packVersion: '1.0.0',
        completedLevelIds: ['stable-a'],
        resumeLevelId: 'stable-b'
    });

    assert.equal(progress.getResumeLevel(pack).packLevelId, 'stable-b');
    assert.equal(progress.isUnlocked(pack, 'inserted-before'), true);
    assert.equal(progress.isUnlocked(pack, 'stable-b'), true);
    assert.equal(progress.isUnlocked(pack, 'stable-a'), true);
    assert.equal(progress.isUnlocked(pack, 'stable-c'), false);

    const completed = progress.completeLevel(pack, 'stable-b');
    assert.equal(completed.resumeLevelId, 'stable-c');
});

test('removed resume levels fall forward to the first unfinished stable id', () => {
    const pack = makePack('stable-pack', '2.0.0', [
        ['stable-a', 10],
        ['inserted-c', 20],
        ['stable-d', 50]
    ]);
    const { progress } = createStoredProgress('stable-pack', {
        packVersion: '1.0.0',
        completedLevelIds: ['stable-a'],
        resumeLevelId: 'removed-b'
    });

    assert.equal(progress.getResumeLevel(pack).packLevelId, 'inserted-c');
    assert.equal(progress.isUnlocked(pack, 'inserted-c'), true);
    assert.equal(progress.isUnlocked(pack, 'stable-d'), false);
});

test('new levels after a completed resume point become the next progression target', () => {
    const pack = makePack('stable-pack', '2.0.0', [
        ['stable-a', 10],
        ['stable-b', 20],
        ['new-c', 35]
    ]);
    const { progress } = createStoredProgress('stable-pack', {
        packVersion: '1.0.0',
        completedLevelIds: ['stable-a', 'stable-b'],
        resumeLevelId: 'stable-b'
    });

    assert.equal(progress.getResumeLevel(pack).packLevelId, 'new-c');
    assert.equal(progress.isUnlocked(pack, 'new-c'), true);
});

test('new earlier levels become resumable after the former pack was completed', () => {
    const pack = makePack('stable-pack', '2.0.0', [
        ['new-before', 5],
        ['stable-a', 10],
        ['stable-b', 20]
    ]);
    const { progress } = createStoredProgress('stable-pack', {
        packVersion: '1.0.0',
        completedLevelIds: ['stable-a', 'stable-b'],
        resumeLevelId: 'stable-b'
    });

    assert.equal(progress.getResumeLevel(pack).packLevelId, 'new-before');
    assert.equal(progress.isUnlocked(pack, 'new-before'), true);
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

    const dailyRoute = router.normalizeLevelRoute({
        packId: 'irregular-pack',
        levelId: 'irregular-b',
        mode: 'daily'
    });
    assert.equal(dailyRoute.mode, 'daily');
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
