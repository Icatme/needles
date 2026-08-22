const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');

function createStorage() {
    const values = new Map();
    return {
        getItem(key) {
            return values.has(key) ? values.get(key) : null;
        },
        setItem(key, value) {
            values.set(key, String(value));
        },
        removeItem(key) {
            values.delete(key);
        }
    };
}

function loadSupport() {
    const context = vm.createContext({
        console,
        Math,
        Number,
        String,
        Boolean,
        JSON,
        Object,
        Array,
        Date,
        Map,
        Set,
        GameScene: class {},
        APP_CONTEXT: {
            resetProgress() {}
        }
    });
    const source = fs.readFileSync(
        path.join(root, 'js/features/scoring/ScoringGameScene.js'),
        'utf8'
    );
    vm.runInContext(
        `${source}\nthis.BestRunStore = BestRunStore;`
            + '\nthis.BestRunComparisonHUD = BestRunComparisonHUD;'
            + '\nthis.BestRunGhost = BestRunGhost;',
        context,
        { filename: 'js/features/scoring/ScoringGameScene.js' }
    );
    return context;
}

test('best-run store accepts only a personal-best completed score', () => {
    const { BestRunStore } = loadSupport();
    const store = new BestRunStore({ storage: null });
    const base = {
        packId: 'pack',
        levelId: 'level-1',
        levelOrder: 1,
        levelName: 'First',
        score: {
            status: 'completed',
            score: 1000,
            elapsedMs: 8500,
            maxCombo: 5
        },
        trajectory: [
            { index: 0, atMs: 1000, wheelAngle: 1.2 },
            { index: 1, atMs: 2200, wheelAngle: 2.1, precisionKind: 'close' }
        ]
    };

    assert.equal(store.recordBest({
        ...base,
        scoreRecord: { accepted: true, isPersonalBest: false }
    }).reason, 'not-best');
    const accepted = store.recordBest({
        ...base,
        scoreRecord: { accepted: true, isPersonalBest: true }
    });
    assert.equal(accepted.accepted, true);
    assert.equal(store.getBest('pack', 'level-1').trajectory.length, 2);
});

test('trajectory entries are normalized, sorted and bounded', () => {
    const { BestRunStore } = loadSupport();
    const store = new BestRunStore({ storage: null, maxTrajectoryEntries: 2 });
    store.recordBest({
        packId: 'pack',
        levelId: 'level-1',
        scoreRecord: { accepted: true, isPersonalBest: true },
        score: { status: 'completed', score: 10, elapsedMs: 20, maxCombo: 1 },
        trajectory: [
            { index: 2, atMs: 20, wheelAngle: -1 },
            { index: 0, atMs: 5, wheelAngle: Math.PI * 3 },
            { index: 1, atMs: 10, wheelAngle: 2 }
        ]
    });

    const best = store.getBest('pack', 'level-1');
    assert.deepEqual(best.trajectory.map(entry => entry.index), [0, 1]);
    assert.ok(best.trajectory.every(entry => entry.wheelAngle >= 0));
    assert.ok(best.trajectory.every(entry => entry.wheelAngle < Math.PI * 2));
});

test('best-run records persist and reset independently', () => {
    const { BestRunStore } = loadSupport();
    const storage = createStorage();
    const first = new BestRunStore({
        storage,
        clock: () => '2026-08-22T00:00:00.000Z'
    });
    first.recordBest({
        packId: 'pack',
        levelId: 'level-1',
        scoreRecord: { accepted: true, isPersonalBest: true },
        score: { status: 'completed', score: 20, elapsedMs: 30, maxCombo: 1 },
        trajectory: [{ index: 0, atMs: 30, wheelAngle: 1 }]
    });

    const second = new BestRunStore({ storage });
    assert.equal(second.getBest('pack', 'level-1').score, 20);
    second.reset();
    assert.equal(second.getBest('pack', 'level-1'), null);
});

test('split formatter clearly distinguishes ahead and behind', () => {
    const { BestRunComparisonHUD } = loadSupport();
    assert.equal(BestRunComparisonHUD.formatDelta(-420), '−0.4s');
    assert.equal(BestRunComparisonHUD.formatDelta(650), '+0.7s');
    assert.equal(BestRunComparisonHUD.formatDelta(0), '±0.0s');
});

test('ghost renderer is display-only and never mutates gameplay state', () => {
    const source = fs.readFileSync(
        path.join(root, 'js/features/scoring/ScoringGameScene.js'),
        'utf8'
    );
    const start = source.indexOf('class BestRunGhost');
    const end = source.indexOf('function installBestRunStore');
    const ghostSource = source.slice(start, end);
    assert.doesNotMatch(ghostSource, /beginShot|resolveImpact|releaseShotLock/);
    assert.doesNotMatch(ghostSource, /insertedNeedles\.push|obstacles\.push/);
    assert.match(ghostSource, /graphics/);
});
