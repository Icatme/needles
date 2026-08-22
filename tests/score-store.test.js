const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');

function loadStore() {
    const context = vm.createContext({
        console,
        JSON,
        Object,
        Array,
        Number,
        Math,
        Date
    });
    const source = fs.readFileSync(
        path.join(root, 'js/app/ScoreStore.js'),
        'utf8'
    );
    vm.runInContext(`${source}\nthis.ScoreStore = ScoreStore;`, context, {
        filename: 'js/app/ScoreStore.js'
    });
    return context.ScoreStore;
}

function createStorage(initial = {}) {
    const values = new Map(Object.entries(initial));
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

function makeRun(overrides = {}) {
    const run = {
        packId: 'pack-a',
        packVersion: '1.0.0',
        levelId: 'level-1',
        levelOrder: 1,
        levelName: 'Calibration',
        mode: 'progression',
        success: true,
        scoreEligible: true,
        score: {
            status: 'completed',
            score: 1000,
            elapsedMs: 12000,
            maxCombo: 6,
            breakdown: {
                base: 600,
                precision: 180,
                combo: 120,
                time: 100
            },
            precisionCounts: { close: 2, threaded: 1 }
        },
        ...overrides
    };
    run.contractId = overrides.contractId
        || `${run.packId}@${run.packVersion}:${run.levelId}:score-v1`;
    return run;
}

test('only completed eligible progression runs enter the score store', () => {
    const ScoreStore = loadStore();
    const store = new ScoreStore({ storage: null });

    assert.equal(store.recordRun(makeRun({ mode: 'test' })).reason, 'mode');
    assert.equal(store.recordRun(makeRun({ success: false })).reason, 'incomplete');
    assert.equal(store.recordRun(makeRun({ scoreEligible: false })).reason, 'disabled');
    assert.equal(store.countBest('pack-a'), 0);
});

test('same-level best uses score, then time, then maximum combo', () => {
    const ScoreStore = loadStore();
    const timestamps = [
        '2026-08-22T00:00:00.000Z',
        '2026-08-22T00:01:00.000Z',
        '2026-08-22T00:02:00.000Z',
        '2026-08-22T00:03:00.000Z'
    ];
    const store = new ScoreStore({
        storage: null,
        clock: () => timestamps.shift()
    });

    assert.equal(store.recordRun(makeRun()).isPersonalBest, true);
    assert.equal(store.recordRun(makeRun({
        score: { ...makeRun().score, score: 900, elapsedMs: 8000 }
    })).isPersonalBest, false);
    assert.equal(store.recordRun(makeRun({
        score: { ...makeRun().score, elapsedMs: 11000, maxCombo: 4 }
    })).isPersonalBest, true);
    assert.equal(store.recordRun(makeRun({
        score: { ...makeRun().score, elapsedMs: 11000, maxCombo: 8 }
    })).isPersonalBest, true);

    const best = store.getBest('pack-a', 'level-1');
    assert.equal(best.score, 1000);
    assert.equal(best.elapsedMs, 11000);
    assert.equal(best.maxCombo, 8);
});

test('best table is isolated by pack and sorted by latest refresh', () => {
    const ScoreStore = loadStore();
    const timestamps = [
        '2026-08-22T00:00:00.000Z',
        '2026-08-22T00:01:00.000Z',
        '2026-08-22T00:02:00.000Z'
    ];
    const store = new ScoreStore({
        storage: null,
        clock: () => timestamps.shift()
    });

    store.recordRun(makeRun());
    store.recordRun(makeRun({
        levelId: 'level-2',
        levelOrder: 2,
        score: { ...makeRun().score, score: 1500 }
    }));
    store.recordRun(makeRun({
        packId: 'pack-b',
        levelId: 'other-1'
    }));

    const table = store.listBest('pack-a', { limit: 6 });
    assert.deepEqual(table.map(record => record.levelId), ['level-2', 'level-1']);
    assert.equal(store.countBest('pack-a'), 2);
    assert.equal(store.countBest('pack-b'), 1);
});

test('scores persist, reload and clear independently from preferences', () => {
    const ScoreStore = loadStore();
    const storage = createStorage();
    const first = new ScoreStore({
        storage,
        clock: () => '2026-08-22T00:00:00.000Z'
    });
    first.recordRun(makeRun());

    const second = new ScoreStore({ storage });
    assert.equal(second.getBest('pack-a', 'level-1').score, 1000);
    second.clearPack('pack-a');
    assert.equal(second.countBest('pack-a'), 0);

    second.recordRun(makeRun());
    second.reset();
    assert.equal(second.countBest('pack-a'), 0);
});

test('best records are isolated by immutable scoring contract', () => {
    const ScoreStore = loadStore();
    const store = new ScoreStore({ storage: null });
    const original = makeRun({
        contractId: 'pack-a@1.0.0:level-1:score-v1',
        score: { ...makeRun().score, score: 9000 }
    });
    const revised = makeRun({
        packVersion: '2.0.0',
        contractId: 'pack-a@2.0.0:level-1:score-v2',
        score: { ...makeRun().score, score: 500 }
    });

    store.recordRun(original);
    assert.equal(store.getBest(
        'pack-a',
        'level-1',
        revised.contractId
    ), null);
    assert.equal(store.countBest('pack-a', {
        contractIds: new Set([revised.contractId])
    }), 0);

    const result = store.recordRun(revised);
    assert.equal(result.isPersonalBest, true);
    assert.equal(store.getBest('pack-a', 'level-1').score, 500);
});
