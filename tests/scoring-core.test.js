const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');

function load(context, relativePath, names) {
    const exports = Array.isArray(names) ? names : [names];
    const source = fs.readFileSync(path.join(root, relativePath), 'utf8');
    const bridge = exports.filter(Boolean)
        .map(name => `this.${name} = ${name};`)
        .join('\n');
    vm.runInContext(`${source}\n${bridge}`, context, { filename: relativePath });
}

const context = vm.createContext({
    console,
    Math,
    Number,
    Object,
    JSON,
    Array
});
load(context, 'js/core/AngularCollisionRules.js', 'AngularCollisionRules');
load(context, 'js/core/ScoreSession.js', 'ScoreSession');

function makeLevel(overrides = {}) {
    return {
        id: 1,
        needleCount: 6,
        layout: { obstacleAngles: [] },
        ...overrides
    };
}

test('clearance measurement separates clockwise and counter-clockwise blockers', () => {
    const rules = new context.AngularCollisionRules({
        ringRadius: 100,
        needleRadius: 10,
        obstacleRadius: 12
    });
    const result = rules.measureClearance(0, [
        { id: 'cw', wheelAngle: 0.25, radius: 10 },
        { id: 'ccw', wheelAngle: -0.3, radius: 10 }
    ]);

    assert.equal(result.nearest.clockwise.targetId, 'cw');
    assert.equal(result.nearest.counterClockwise.targetId, 'ccw');
    assert.ok(result.nearest.clockwise.clearance > 0);
    assert.equal(result.blockerCount, 2);
});

test('one blocker is never treated as a two-sided gap', () => {
    const score = new context.ScoreSession(makeLevel());
    score.start();
    const award = score.recordInsertion({
        nearest: {
            clockwise: { clearance: 5 },
            counterClockwise: null
        }
    });

    assert.equal(award.precision.kind, 'close');
    assert.equal(award.precisionPoints, 60);
    assert.equal(award.points, 160);
});

test('threaded precision and combo bonuses accumulate deterministically', () => {
    const score = new context.ScoreSession(makeLevel());
    score.start();
    score.recordInsertion({ nearest: {} });
    const second = score.recordInsertion({
        nearest: {
            clockwise: { clearance: 4 },
            counterClockwise: { clearance: 9 }
        }
    });

    assert.equal(second.precision.kind, 'threaded');
    assert.equal(second.precisionPoints, 180);
    assert.equal(second.comboPoints, 15);
    assert.equal(second.points, 295);
    assert.equal(second.totalScore, 395);
});

test('ordinary insertions restart the precision combo instead of advancing it', () => {
    const score = new context.ScoreSession(makeLevel());
    score.start();
    score.recordInsertion({ nearest: {} });
    const precision = score.recordInsertion({
        nearest: {
            clockwise: { clearance: 4 },
            counterClockwise: null
        }
    });
    const clear = score.recordInsertion({ nearest: {} });

    assert.equal(precision.combo, 2);
    assert.equal(precision.comboPoints, 15);
    assert.equal(clear.combo, 1);
    assert.equal(clear.comboPoints, 0);
    assert.equal(clear.comboContinued, false);
    assert.equal(clear.comboRestarted, true);
    assert.equal(clear.snapshot.comboPrecisionBreaks, 1);
    assert.equal(clear.snapshot.comboBreaks, 1);
});

test('direct scoring overrides are normalized to integer points', () => {
    const score = new context.ScoreSession(makeLevel({
        scoring: {
            baseInsertPoints: 100.5,
            closeBonus: 60.4,
            threadedBonus: 180.2,
            comboStepPoints: 15.6,
            comboBonusCap: 150.4,
            timeBonusTiers: [
                { maxRatio: 1, points: 99.5, kind: 'par' }
            ]
        }
    }));
    score.start();
    const first = score.recordInsertion({ nearest: {} });
    const second = score.recordInsertion({
        nearest: { clockwise: { clearance: 1 } }
    });

    assert.equal(first.points, 101);
    assert.equal(second.points, 177);
    assert.equal(Number.isInteger(second.totalScore), true);
    assert.equal(score.complete().points, 100);
});

test('time bonus depends on active play time and is frame-split invariant', () => {
    const a = new context.ScoreSession(
        makeLevel({ needleCount: 1 }),
        { parTimeMs: 10000 }
    );
    const b = new context.ScoreSession(
        makeLevel({ needleCount: 1 }),
        { parTimeMs: 10000 }
    );
    a.start();
    b.start();
    a.advance(6000);
    [1000, 2000, 3000].forEach(delta => b.advance(delta));
    a.recordInsertion({ nearest: {} });
    b.recordInsertion({ nearest: {} });
    const awardA = a.complete();
    const awardB = b.complete();

    assert.equal(awardA.timeBonus.kind, 'blazing');
    assert.equal(awardA.points, 500);
    assert.equal(awardA.totalScore, awardB.totalScore);
    assert.equal(awardA.elapsedMs, awardB.elapsedMs);
});

test('disabled scoring retains timing state but awards no points', () => {
    const score = new context.ScoreSession(makeLevel(), { enabled: false });
    score.start();
    score.advance(1200);
    const insertion = score.recordInsertion({
        nearest: {
            clockwise: { clearance: 1 },
            counterClockwise: { clearance: 2 }
        }
    });
    const completion = score.complete();

    assert.equal(insertion.points, 0);
    assert.equal(completion.points, 0);
    assert.equal(completion.snapshot.score, 0);
    assert.equal(completion.snapshot.elapsedMs, 1200);
});

test('game session exposes placement evidence on a successful impact', () => {
    const sessionContext = vm.createContext({
        console,
        Math,
        Number,
        Object,
        JSON,
        Array,
        RhythmManager: class {
            constructor() {
                this.elapsedMs = 0;
            }

            advance(deltaMs) {
                this.elapsedMs += deltaMs;
                return {
                    rotationDelta: 0,
                    angularVelocity: 1,
                    direction: 1
                };
            }

            getSnapshotAt() {
                return { angularVelocity: 1, direction: 1 };
            }

            recordSuccessfulInsert() {}
        }
    });
    load(sessionContext, 'js/core/AngularCollisionRules.js', 'AngularCollisionRules');
    load(sessionContext, 'js/core/GameSession.js', 'GameSession');
    const session = new sessionContext.GameSession({
        id: 1,
        needleCount: 1,
        layout: { obstacleAngles: [0] },
        rhythm: { segments: [{ durationMs: 1000, velocity: 1 }] }
    });

    session.beginShot();
    const outcome = session.resolveImpact();
    assert.equal(outcome.collided, false);
    assert.equal(outcome.placement.blockerCount, 1);
    assert.ok(
        outcome.placement.nearest.counterClockwise
        || outcome.placement.nearest.clockwise
    );
});

test('scoring core has no Phaser, scene, storage or rendering dependency', () => {
    [
        'js/core/AngularCollisionRules.js',
        'js/core/GameSession.js',
        'js/core/ScoreSession.js'
    ].forEach(relativePath => {
        const source = fs.readFileSync(path.join(root, relativePath), 'utf8');
        assert.doesNotMatch(source, /Phaser/);
        assert.doesNotMatch(source, /\.scene\b/);
        assert.doesNotMatch(source, /localStorage|sessionStorage/);
        assert.doesNotMatch(source, /add\.graphics|add\.text|tweens/);
    });
});
