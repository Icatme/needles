const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const projectRoot = path.resolve(__dirname, '..');

function loadIntoContext(context, relativePath, exportName) {
    const source = fs.readFileSync(path.join(projectRoot, relativePath), 'utf8');
    vm.runInContext(`${source}\nthis.${exportName} = ${exportName};`, context, {
        filename: relativePath
    });
}

const storage = new Map();
const context = vm.createContext({
    console,
    Math,
    Number,
    JSON,
    localStorage: {
        getItem(key) { return storage.get(key) || null; },
        setItem(key, value) { storage.set(key, value); },
        removeItem(key) { storage.delete(key); }
    }
});

loadIntoContext(context, 'js/utils/constants.js', 'CONSTANTS');
loadIntoContext(context, 'js/data/wheelVisuals.js', 'WHEEL_VISUALS');
loadIntoContext(context, 'js/data/levels.js', 'LEVEL_DEFINITIONS');
loadIntoContext(context, 'js/managers/RhythmManager.js', 'RhythmManager');
loadIntoContext(context, 'js/managers/DifficultyManager.js', 'DifficultyManager');
loadIntoContext(context, 'js/managers/LevelManager.js', 'LevelManager');

const levels = Array.from(context.LEVEL_DEFINITIONS);
const difficultyManager = new context.DifficultyManager();
const audits = levels.map(level => difficultyManager.validate(level));

function closeTo(actual, expected, epsilon = 1e-9) {
    assert.ok(Math.abs(actual - expected) <= epsilon, `${actual} should be close to ${expected}`);
}

test('geometry exposes theoretical, comfortable and provisional normal limits', () => {
    const capacity = difficultyManager.getCapacityMetrics();

    assert.equal(capacity.ringRadius, 172);
    assert.equal(capacity.theoreticalCapacity, 35);
    assert.equal(capacity.comfortableCapacity, 26);
    assert.equal(capacity.normalCapacity, 22);
    assert.ok(capacity.theoreticalAngle < capacity.comfortableAngle);
});

test('preset blockers are packed per sector instead of subtracted from a global limit', () => {
    const eightA = difficultyManager.getLayoutCapacity(
        levels[31].layout.obstacleAngles,
        context.CONSTANTS.DIFFICULTY.COMFORT_GAP
    );
    const eightB = difficultyManager.getLayoutCapacity(
        levels[39].layout.obstacleAngles,
        context.CONSTANTS.DIFFICULTY.COMFORT_GAP
    );

    assert.equal(levels[31].layout.obstacleAngles.length, 8);
    assert.equal(levels[39].layout.obstacleAngles.length, 8);
    assert.equal(eightA.total, eightA.sectors.reduce((sum, count) => sum + count, 0));
    assert.equal(eightB.total, eightB.sectors.reduce((sum, count) => sum + count, 0));
    assert.equal(eightA.total, 16);
    assert.equal(eightB.total, 15);
    assert.notEqual(
        eightA.total,
        difficultyManager.getCapacityMetrics().comfortableCapacity - 8
    );
});

test('difficulty output exposes every sector capacity used by the level audit', () => {
    const analysis = audits[39].analysis;
    const sectors = analysis.capacity.sectorCapacities;

    assert.equal(sectors.length, 8);
    assert.equal(
        sectors.reduce((sum, sector) => sum + sector.theoretical, 0),
        analysis.capacity.layoutTheoretical
    );
    assert.equal(
        sectors.reduce((sum, sector) => sum + sector.comfortable, 0),
        analysis.capacity.layoutComfortable
    );
});

test('catalog contains exactly fifty authored levels in five chapters', () => {
    assert.equal(levels.length, 50);
    assert.deepEqual(levels.map(level => level.id), Array.from({ length: 50 }, (_, i) => i + 1));
    assert.equal(new Set(levels.map(level => level.name)).size, 50);

    for (let chapter = 1; chapter <= 5; chapter++) {
        const chapterLevels = levels.filter(level => level.chapter === chapter);
        assert.equal(chapterLevels.length, 10);
        assert.equal(chapterLevels.at(-1).designIntent.milestone, true);
        chapterLevels.slice(0, -1).forEach(level => {
            assert.equal(level.designIntent.milestone, false);
        });
    }
});

test('the opening chapter starts with at least ten playable needles per level', () => {
    levels.slice(0, 10).forEach(level => {
        assert.ok(
            level.needleCount >= 10,
            `level ${level.id} exposes only ${level.needleCount} playable needles`
        );
    });
});

test('every level passes capacity, timing and full-angle opportunity audits', () => {
    audits.forEach((audit, index) => {
        const level = levels[index];
        assert.equal(
            audit.valid,
            true,
            `level ${level.id} (${level.name}): ${audit.errors.join('; ')}`
        );
        assert.ok(level.needleCount <= audit.analysis.capacity.layoutTheoretical);
        assert.equal(audit.analysis.opportunity.allShotStatesReachable, true);
        assert.ok(
            audit.analysis.opportunity.worstCoverageMs
                <= context.CONSTANTS.DIFFICULTY.MAX_COVERAGE_MS
        );
    });
});

test('difficulty rises inside each chapter and milestone levels are chapter peaks', () => {
    const chapterAverages = [];

    for (let chapter = 1; chapter <= 5; chapter++) {
        const scores = audits
            .filter((_, index) => levels[index].chapter === chapter)
            .map(audit => audit.analysis.score);

        for (let index = 1; index < scores.length; index++) {
            assert.ok(
                scores[index] >= scores[index - 1],
                `chapter ${chapter} drops from ${scores[index - 1]} to ${scores[index]}`
            );
        }
        assert.equal(scores.at(-1), Math.max(...scores));
        chapterAverages.push(scores.reduce((sum, score) => sum + score, 0) / scores.length);
    }

    for (let index = 1; index < chapterAverages.length; index++) {
        assert.ok(chapterAverages[index] > chapterAverages[index - 1]);
    }
});

test('rhythm integration is invariant to frame splitting', () => {
    const config = levels[49].rhythm;
    const singleFrame = new context.RhythmManager(config, levels[49].needleCount);
    const splitFrames = new context.RhythmManager(config, levels[49].needleCount);

    for (let inserted = 0; inserted < 7; inserted++) {
        singleFrame.recordSuccessfulInsert();
        splitFrames.recordSuccessfulInsert();
    }

    const totalMs = 12345;
    const singleRotation = singleFrame.advance(totalMs).rotationDelta;
    const chunks = [16, 33, 250, 999, 11047];
    const splitRotation = chunks.reduce(
        (sum, deltaMs) => sum + splitFrames.advance(deltaMs).rotationDelta,
        0
    );

    assert.equal(chunks.reduce((sum, value) => sum + value, 0), totalMs);
    closeTo(splitRotation, singleRotation);
});

test('smooth ramps use exact integration instead of endpoint Euler updates', () => {
    const linear = new context.RhythmManager({
        segments: [{
            durationMs: 2000,
            fromVelocity: 0,
            toVelocity: 2,
            easing: 'linear'
        }]
    });
    const sine = new context.RhythmManager({
        segments: [{
            durationMs: 2000,
            fromVelocity: 0,
            toVelocity: 2,
            easing: 'sine'
        }]
    });

    closeTo(linear.integrate(0, 2000), 2);
    closeTo(sine.integrate(0, 2000), 2);
});

test('equal timed reversals expose the fixed-angle trap while drift restores reachability', () => {
    const trapped = new context.RhythmManager({
        segments: [
            { durationMs: 2600, velocity: 0.68 },
            { durationMs: 2600, velocity: -0.68 }
        ]
    });
    const drifting = new context.RhythmManager({
        segments: [
            { durationMs: 2600, velocity: 0.68 },
            { durationMs: 2600, velocity: -0.42 }
        ]
    });

    assert.equal(trapped.getWorstCoverageTime(0, 60000, 20), null);
    assert.ok(drifting.getWorstCoverageTime(0, 60000, 20) <= 60000);
});

test('shot modifiers change only after a successful insert is recorded', () => {
    const rhythm = new context.RhythmManager({
        segments: [{ durationMs: 4000, velocity: 0.4 }],
        shotModifier: { speedStep: 0.1, maxAbsSpeed: 0.8 }
    }, 5);

    assert.equal(rhythm.advance(200).angularVelocity, 0.4);
    assert.equal(rhythm.advance(200).angularVelocity, 0.4);
    rhythm.recordSuccessfulInsert();
    assert.equal(rhythm.advance(200).angularVelocity, 0.5);
});

test('level manager returns fresh audited configs and stops after level fifty', () => {
    storage.clear();
    const manager = new context.LevelManager();
    const first = manager.getLevelConfig(4);
    first.layout.obstacleAngles.push(90);
    first.rhythm.segments[0].velocity = 99;

    const second = manager.getLevelConfig(4);
    assert.deepEqual(Array.from(second.layout.obstacleAngles), [348.75, 191.25]);
    assert.equal(second.rhythm.segments[0].velocity, 0.58);
    assert.ok(Number.isFinite(second.difficulty.score));

    manager.startLevel(50);
    assert.equal(manager.hasNextLevel(), false);
    assert.equal(manager.getNextLevel(), null);
    manager.completeLevel();
    assert.equal(manager.maxUnlockedLevel, 1);
    assert.equal(manager.getLevelConfig(999).id, 50);
});

test('legacy progress beyond the finite catalog is clamped to level fifty', () => {
    storage.set(context.CONSTANTS.STORAGE_KEY, JSON.stringify({ maxLevel: 999 }));
    const manager = new context.LevelManager();
    assert.equal(manager.maxUnlockedLevel, 50);
});
