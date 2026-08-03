const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { TextEncoder } = require('node:util');

const root = path.resolve(__dirname, '..');

function load(context, relativePath, names) {
    const exports = (Array.isArray(names) ? names : [names])
        .map(name => `this.${name} = ${name};`)
        .join('\n');
    const source = fs.readFileSync(path.join(root, relativePath), 'utf8');
    vm.runInContext(`${source}\n${exports}`, context, {
        filename: relativePath
    });
}

function createStorage() {
    const values = new Map();
    return {
        values,
        getItem(key) { return values.get(key) || null; },
        setItem(key, value) { values.set(key, value); },
        removeItem(key) { values.delete(key); }
    };
}

const context = vm.createContext({
    console,
    Math,
    Number,
    JSON,
    Object,
    Array,
    Map,
    Set,
    Date,
    TextEncoder
});

load(context, 'js/managers/RhythmManager.js', 'RhythmManager');
load(context, 'js/core/AngularCollisionRules.js', 'AngularCollisionRules');
load(context, 'js/core/GameSession.js', 'GameSession');
load(context, 'js/core/ReplayProtocol.js', 'ReplayProtocol');
load(context, 'js/core/ReplayRecorder.js', 'ReplayRecorder');
load(context, 'js/core/ReplayRunner.js', 'ReplayRunner');
load(context, 'js/app/PlaytestStore.js', ['PlaytestStore', 'PLAYTEST_STORE']);
load(context, 'js/app/PlaytestSession.js', 'PlaytestSession');

function makeLevel(overrides = {}) {
    return {
        id: 1,
        packId: 'test-pack',
        packVersion: '1.0.0',
        packLevelId: 'test-pack-01',
        order: 1,
        needleCount: 2,
        layout: { obstacleAngles: [] },
        rhythm: {
            segments: [{ durationMs: 4000, velocity: 0.5 }]
        },
        difficulty: {
            score: 12.5,
            drivers: [{ label: '节奏' }, { label: '密度' }]
        },
        ...overrides
    };
}

function createStore(options = {}) {
    return new context.PlaytestStore({
        storage: createStorage(),
        maxAttempts: options.maxAttempts || 250,
        clock: options.clock || (() => '2026-08-03T14:00:00.000Z')
    });
}

test('a successful test attempt stores timing, difficulty and a verifiable replay', () => {
    const level = makeLevel();
    const store = createStore();
    const session = new context.PlaytestSession(level, { store });

    session.advance(1000);
    assert.equal(session.beginShot().accepted, true);
    session.advance(120);
    assert.equal(session.resolveImpact().collided, false);
    session.advance(200);
    assert.equal(session.releaseShotLock().released, true);
    session.advance(850);
    assert.equal(session.beginShot().accepted, true);
    session.advance(120);
    assert.equal(session.resolveImpact().completed, true);

    assert.equal(store.count(), 1);
    const attempt = store.list()[0];
    assert.equal(attempt.mode, 'test');
    assert.equal(attempt.levelId, 'test-pack-01');
    assert.equal(attempt.predictedDifficulty, 12.5);
    assert.deepEqual(
        Array.from(attempt.difficultyDrivers),
        ['节奏', '密度']
    );
    assert.deepEqual(
        Array.from(attempt.shots.intervalsMs),
        [1170]
    );
    assert.deepEqual(attempt.result, {
        status: 'completed',
        success: true,
        durationMs: 2290,
        insertedCount: 2,
        totalCount: 2,
        failedNeedleNumber: null,
        collisionType: null,
        collisionTargetId: null
    });

    const replayResult = new context.ReplayRunner().run(
        attempt.replay,
        level
    );
    assert.equal(replayResult.verified, true);
    assert.equal(replayResult.final.status, 'completed');
});

test('a failed attempt records the failure needle and collision target', () => {
    const level = makeLevel({
        needleCount: 1,
        layout: { obstacleAngles: [90] },
        difficulty: { score: 20, drivers: [{ label: '障碍' }] }
    });
    const store = createStore();
    const session = new context.PlaytestSession(level, { store });

    session.beginShot();
    session.advance(100);
    const outcome = session.resolveImpact();
    const attempt = store.list()[0];

    assert.equal(outcome.collided, true);
    assert.equal(attempt.result.status, 'failed');
    assert.equal(attempt.result.success, false);
    assert.equal(attempt.result.failedNeedleNumber, 1);
    assert.equal(attempt.result.collisionType, 'obstacle');
    assert.equal(attempt.result.collisionTargetId, 'obstacle-1');
    assert.equal(attempt.shots.count, 1);
    assert.equal(
        new context.ReplayRunner().run(attempt.replay, level).verified,
        true
    );
});

test('local playtest storage is bounded and exports no identity fields', () => {
    let tick = 0;
    const store = createStore({
        maxAttempts: 2,
        clock: () => `2026-08-03T14:00:0${tick++}.000Z`
    });

    for (let index = 1; index <= 3; index++) {
        store.addAttempt({
            packId: 'pack',
            packVersion: '1.0.0',
            levelId: `level-${index}`,
            order: index,
            result: { status: 'failed', success: false },
            shots: { count: 1, acceptedAtMs: [0], intervalsMs: [] },
            replay: { digest: String(index) }
        });
    }

    assert.equal(store.count(), 2);
    assert.deepEqual(
        Array.from(store.list(), attempt => attempt.levelId),
        ['level-2', 'level-3']
    );
    const bundle = store.exportBundle();
    assert.equal(bundle.schema, 'needles.playtest-export/v1');
    assert.equal(bundle.attemptCount, 2);
    const serialized = JSON.stringify(bundle);
    assert.doesNotMatch(serialized, /email|userId|playerId|deviceId|ipAddress/i);

    store.clear();
    assert.equal(store.count(), 0);
});

test('GameScene records only explicit test routes', () => {
    const source = fs.readFileSync(
        path.join(root, 'js/scenes/GameScene.js'),
        'utf8'
    );
    assert.match(source, /this\.route\.mode === 'test'/);
    assert.match(source, /new PlaytestSession\(this\.levelConfig\)/);
    assert.match(source, /:\s*new GameSession\(this\.levelConfig\)/);
});

test('the level laboratory exposes local export and clear controls', () => {
    const source = fs.readFileSync(
        path.join(root, 'js/scenes/PlaytestLevelSelectScene.js'),
        'utf8'
    );
    const main = fs.readFileSync(path.join(root, 'js/main.js'), 'utf8');
    assert.match(source, /PLAYTEST_STORE\.exportBundle\(\)/);
    assert.match(source, /PLAYTEST_STORE\.clear\(\)/);
    assert.match(source, /keydown-E/);
    assert.match(source, /keydown-C/);
    assert.match(main, /PlaytestLevelSelectScene/);
});
