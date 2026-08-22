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
        EnhancedMenuScene: class {},
        APP_CONTEXT: {
            resetProgress() {}
        }
    });
    const source = fs.readFileSync(
        path.join(root, 'js/features/scoring/ScoringMenuScene.js'),
        'utf8'
    );
    vm.runInContext(
        `${source}\nthis.RunObjectiveTracker = RunObjectiveTracker;`
            + '\nthis.BadgeEvaluator = BadgeEvaluator;'
            + '\nthis.BadgeStore = BadgeStore;'
            + '\nthis.BADGE_DEFINITIONS = BADGE_DEFINITIONS;',
        context,
        { filename: 'js/features/scoring/ScoringMenuScene.js' }
    );
    return context;
}

function level(overrides = {}) {
    return {
        needleCount: 8,
        layout: { obstacleAngles: [] },
        designIntent: { focus: 'timing' },
        ...overrides
    };
}

test('run objectives derive a bounded tempo target and track progress', () => {
    const { RunObjectiveTracker } = loadSupport();
    const tracker = new RunObjectiveTracker(level());
    let snapshot = tracker.update({
        status: 'running',
        maxCombo: 3,
        precisionCounts: { close: 0, threaded: 0 }
    });
    const tempo = snapshot.objectives.find(item => item.id === 'tempo-chain');
    assert.equal(tempo.target, 4);
    assert.equal(tempo.progress, 3);
    assert.equal(tempo.completed, false);

    snapshot = tracker.complete({
        status: 'completed',
        maxCombo: 4,
        precisionCounts: { close: 0, threaded: 0 }
    }, { kind: 'par' });
    assert.equal(snapshot.completedCount, 3);
});

test('density levels receive a threaded-shot objective', () => {
    const { RunObjectiveTracker } = loadSupport();
    const tracker = new RunObjectiveTracker(level({
        designIntent: { focus: 'density' },
        layout: { obstacleAngles: [0, 180] }
    }));
    const snapshot = tracker.update({
        status: 'running',
        maxCombo: 1,
        precisionCounts: { close: 0, threaded: 1 }
    });
    const precision = snapshot.objectives.find(item => item.id === 'threaded-shot');
    assert.equal(precision.completed, true);
});

test('badge evaluator awards independent gameplay milestones', () => {
    const { BadgeEvaluator } = loadSupport();
    const badges = BadgeEvaluator.evaluate({
        score: {
            status: 'completed',
            insertedCount: 6,
            maxCombo: 6,
            comboBreaks: 0,
            precisionCounts: { close: 3, threaded: 2 }
        },
        timeBonus: { kind: 'blazing' },
        objectives: { completedCount: 3, totalCount: 3 }
    });

    [
        'first-clear',
        'edge-specialist',
        'thread-the-needle',
        'tempo-keeper',
        'full-chain',
        'blazing-clear',
        'precision-master',
        'objective-sweep'
    ].forEach(id => assert.ok(badges.includes(id), id));
});

test('failed runs cannot unlock badges', () => {
    const { BadgeEvaluator } = loadSupport();
    assert.deepEqual(
        Array.from(BadgeEvaluator.evaluate({
            score: { status: 'failed', precisionCounts: {} }
        })),
        []
    );
});

test('disabled scoring cannot unlock badges', () => {
    const { BadgeEvaluator } = loadSupport();
    assert.deepEqual(
        Array.from(BadgeEvaluator.evaluate({
            score: {
                enabled: false,
                status: 'completed',
                insertedCount: 8,
                maxCombo: 8,
                comboBreaks: 0,
                precisionCounts: { close: 8, threaded: 8 }
            },
            timeBonus: { kind: 'blazing' },
            objectives: { completedCount: 3, totalCount: 3 }
        })),
        []
    );
});

test('badge store unlocks once and persists objective bests', () => {
    const { BadgeStore } = loadSupport();
    const storage = createStorage();
    const input = {
        packId: 'pack',
        levelId: 'level-1',
        score: {
            status: 'completed',
            insertedCount: 5,
            maxCombo: 5,
            comboBreaks: 0,
            precisionCounts: { close: 0, threaded: 0 }
        },
        timeBonus: { kind: 'steady' },
        objectives: {
            completedCount: 2,
            totalCount: 3,
            objectives: [
                { id: 'complete', completed: true },
                { id: 'tempo-chain', completed: true },
                { id: 'close-pair', completed: false }
            ]
        }
    };
    const first = new BadgeStore({
        storage,
        clock: () => '2026-08-22T00:00:00.000Z'
    });
    const firstResult = first.recordCompletedRun(input);
    assert.ok(firstResult.newBadges.includes('first-clear'));
    assert.ok(firstResult.newBadges.includes('tempo-keeper'));
    assert.equal(first.getLevelObjectives('pack', 'level-1').completedCount, 2);

    const secondResult = first.recordCompletedRun(input);
    assert.equal(secondResult.newBadges.length, 0);

    const restored = new BadgeStore({ storage });
    assert.equal(restored.countUnlocked(), first.countUnlocked());
    assert.equal(restored.getLevelObjectives('pack', 'level-1').completedCount, 2);
});

test('all stored badge definitions have unique stable ids', () => {
    const { BADGE_DEFINITIONS } = loadSupport();
    const ids = Array.from(BADGE_DEFINITIONS, item => item.id);
    assert.equal(new Set(ids).size, ids.length);
    assert.ok(ids.every(id => /^[a-z0-9-]+$/.test(id)));
});
