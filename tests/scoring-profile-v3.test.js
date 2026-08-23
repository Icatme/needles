const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');

function load(context, relativePath, names) {
    const exports = Array.isArray(names) ? names : [names];
    const source = fs.readFileSync(path.join(root, relativePath), 'utf8');
    const bridge = exports.map(name => `this.${name} = ${name};`).join('\n');
    vm.runInContext(`${source}\n${bridge}`, context, { filename: relativePath });
}

const context = vm.createContext({ console, Math, Number, Object, JSON, Array });
load(context, 'js/core/ScoringProfileResolver.js', 'ScoringProfileResolver');
load(context, 'js/core/ScoreSession.js', 'ScoreSession');

function makeLevel(overrides = {}) {
    return {
        id: 1,
        packId: 'pack',
        packLevelId: 'level-1',
        needleCount: 10,
        layout: { obstacleAngles: [0, 180] },
        rhythm: { segments: [{ durationMs: 4000, velocity: 0.5 }] },
        difficulty: {
            rating: 5,
            capacity: { densityRatio: 0.8 },
            speedExposure: { average: 0.5 },
            opportunity: { worstCoverageMs: 12000 },
            pressure: { rhythm: 0.2, state: 0 }
        },
        ...overrides
    };
}

test('resolver creates deterministic per-level timing and precision-combo rules', () => {
    const profile = context.ScoringProfileResolver.resolve(makeLevel());
    assert.equal(profile.schema, 'needles.scoring-profile/v3');
    assert.match(
        profile.profileId,
        /^pack@legacy:level-1:score-v3:[0-9a-f]{8}$/
    );
    assert.ok(profile.comboWindowMs >= 2200 && profile.comboWindowMs <= 5000);
    assert.ok(profile.parTimeMs >= 10000);
    assert.ok(profile.precisionClearancePx >= 9);
    assert.equal(Object.isFrozen(profile), true);
});

test('slower opportunity cycles receive a wider combo window and par time', () => {
    const fast = context.ScoringProfileResolver.resolve(makeLevel({
        packLevelId: 'fast',
        difficulty: {
            rating: 5,
            capacity: { densityRatio: 0.8 },
            speedExposure: { average: 0.95 },
            opportunity: { worstCoverageMs: 6500 },
            pressure: { rhythm: 0.1, state: 0 }
        }
    }));
    const slow = context.ScoringProfileResolver.resolve(makeLevel({
        packLevelId: 'slow',
        difficulty: {
            rating: 5,
            capacity: { densityRatio: 0.8 },
            speedExposure: { average: 0.35 },
            opportunity: { worstCoverageMs: 18000 },
            pressure: { rhythm: 0.4, state: 0.4 }
        }
    }));
    assert.ok(slow.comboWindowMs > fast.comboWindowMs);
    assert.ok(slow.parTimeMs > fast.parTimeMs);
});

test('authored level scoring overrides derived values without losing identity', () => {
    const profile = context.ScoringProfileResolver.resolve(makeLevel({
        scoring: {
            comboWindowMs: 2750,
            parTimeMs: 22200,
            precisionClearancePx: 7
        }
    }));
    assert.equal(profile.source, 'authored+derived');
    assert.equal(profile.comboWindowMs, 2750);
    assert.equal(profile.parTimeMs, 22200);
    assert.equal(profile.precisionClearancePx, 7);
});

test('profile identity changes with pack version and resolved scoring rules', () => {
    const original = context.ScoringProfileResolver.resolve(makeLevel({
        packVersion: '1.0.0'
    }));
    const newPack = context.ScoringProfileResolver.resolve(makeLevel({
        packVersion: '2.0.0'
    }));
    const newRules = context.ScoringProfileResolver.resolve(makeLevel({
        packVersion: '1.0.0',
        scoring: { comboWindowMs: 2800 }
    }));

    assert.notEqual(original.profileId, newPack.profileId);
    assert.notEqual(original.profileId, newRules.profileId);
});

test('precision combo expires at the resolved deadline', () => {
    const profile = context.ScoringProfileResolver.resolve(makeLevel(), {
        comboWindowMs: 2000,
        comboPrecisionGraceMs: 0
    });
    const score = new context.ScoreSession(
        makeLevel({ scoring: profile }),
        { parTimeMs: profile.parTimeMs }
    );
    score.start();
    const first = score.recordInsertion({ nearest: {} });
    score.advance(1500);
    const second = score.recordInsertion({
        nearest: { clockwise: { clearance: 3 } }
    });
    score.advance(2000);
    const third = score.recordInsertion({
        nearest: { clockwise: { clearance: 3 } }
    });

    assert.equal(first.combo, 1);
    assert.equal(second.combo, 2);
    assert.equal(second.comboPoints, profile.comboStepPoints);
    assert.equal(third.combo, 1);
    assert.equal(third.comboPoints, 0);
    assert.equal(third.comboBroken, true);
    assert.equal(third.snapshot.comboBreaks, 1);
    assert.equal(third.snapshot.comboTimeouts, 1);
});

test('precision extends the active tempo window', () => {
    const score = new context.ScoreSession(makeLevel({
        scoring: {
            comboWindowMs: 2000,
            comboPrecisionGraceMs: 600
        }
    }));
    score.start();
    score.recordInsertion({
        nearest: {
            clockwise: { clearance: 3 },
            counterClockwise: { clearance: 4 }
        }
    });
    score.advance(2400);
    const second = score.recordInsertion({
        nearest: { clockwise: { clearance: 3 } }
    });
    assert.equal(second.combo, 2);
    assert.equal(second.comboContinued, true);
});

test('catalog attaches a resolved scoring profile to every level config', () => {
    const catalogContext = vm.createContext({
        console,
        Math,
        Number,
        Object,
        JSON,
        Array,
        Map,
        ScoringProfileResolver: context.ScoringProfileResolver,
        DifficultyManager: class {},
        DifficultyModelV2: undefined
    });
    load(catalogContext, 'js/app/LevelCatalogService.js', 'LevelCatalogService');
    const level = makeLevel({ scoring: { comboWindowMs: 2875 } });
    const pack = {
        id: 'pack',
        version: '1.0.0',
        difficultyModel: 'legacy-linear',
        levels: [level],
        chapters: []
    };
    const registry = {
        defaultPackId: 'pack',
        resolveId: value => value || 'pack',
        get: () => pack,
        getAll: () => [pack]
    };
    const catalog = new catalogContext.LevelCatalogService({ registry });
    catalog.getDifficultyManager = () => ({
        validate: () => ({
            valid: true,
            errors: [],
            analysis: level.difficulty
        })
    });
    const config = catalog.getLevelConfig('pack', 'level-1');
    assert.match(
        config.scoring.profileId,
        /^pack@1\.0\.0:level-1:score-v3:[0-9a-f]{8}$/
    );
    assert.equal(config.scoring.comboWindowMs, 2875);
    assert.ok(config.scoring.parTimeMs > 0);
});
