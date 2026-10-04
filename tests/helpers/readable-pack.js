const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '../..');
const context = vm.createContext({ console, URL });
for (const [file, names] of [
    ['utils/constants', ['CONSTANTS']],
    ['managers/RhythmManager', ['RhythmManager']],
    ['managers/DifficultyManager', ['DifficultyManager']],
    ['managers/DifficultyModelV2', ['DifficultyModelV2']],
    ['core/AngularCollisionRules', ['AngularCollisionRules']],
    ['core/GameSession', ['GameSession']],
    ['packs/PackValidator', ['PackValidator']],
    ['packs/LevelResolver', ['LevelResolver']],
    ['packs/PackRegistry', ['PackRegistry', 'LEVEL_PACK_REGISTRY']],
    ['packs/PackLoader', ['PackLoader']]
]) {
    vm.runInContext(fs.readFileSync(path.join(root, `js/${file}.js`), 'utf8')
        + names.map(name => `\nthis.${name} = ${name};`).join(''), context);
}
const read = file => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));
const manifest = read('packs/readable-v3/manifest.json');
const presets = read('packs/readable-v3/presets.json');
const levelList = read('packs/readable-v3/levels.json');
const pack = new context.LevelResolver().resolvePack(manifest, presets, levelList);

const assert = require('node:assert/strict');
// Perfect-foresight feasibility only: preplan safe slots to avoid greedy fragmentation.
const C = context.CONSTANTS;
const flightMs = C.NEEDLE.FLY_DURATION_MS;
const lockMs = C.DIFFICULTY.INSERT_LOCK_MS;
assert.equal(flightMs, 86);
assert.equal(lockMs, 200);
const full = 2 * Math.PI;
const ringRadius = C.WHEEL.RADIUS + C.NEEDLE.LENGTH - C.NEEDLE.INSERT_DEPTH;
const clearancePx = 10;
const needleAngle = 2 * Math.asin((2 * C.NEEDLE.BALL_RADIUS + clearancePx) / (2 * ringRadius));
const mixedAngle = 2 * Math.asin((C.NEEDLE.BALL_RADIUS + C.OBSTACLE.RADIUS + clearancePx) / (2 * ringRadius));

function constructTargetSlots(level) {
    const obstacles = level.layout.obstacleAngles.map(degrees => degrees * Math.PI / 180).sort((a, b) => a - b);
    if (!obstacles.length) return Array.from({ length: level.needleCount }, (_, i) => i * full / level.needleCount);
    const slots = [];
    obstacles.forEach((start, index) => {
        let end = obstacles[(index + 1) % obstacles.length];
        if (end <= start) end += full;
        const freeAngle = end - start - 2 * mixedAngle;
        const count = freeAngle < 0 ? 0 : Math.floor((freeAngle + 1e-10) / needleAngle) + 1;
        const slack = freeAngle - (count - 1) * needleAngle;
        for (let j = 0; j < count; j++) {
            slots.push((start + mixedAngle + slack / 2 + j * needleAngle) % full);
        }
    });
    assert.ok(slots.length >= level.needleCount, `Not enough comfortable targets: ${level.id}`);
    return slots;
}

function earliestCrossing(rhythm, targetRotation, afterMs) {
    let time = afterMs;
    let rotation = rhythm.integrate(0, time, 0);
    for (let iteration = 0; iteration < 10000; iteration++) {
        const state = rhythm.getSegmentState(time);
        const end = time + state.segment.durationMs - state.segmentElapsedMs;
        const velocity = state.segment.velocity;
        assert.ok(Number.isFinite(velocity) && velocity !== 0, 'Audit supports nonzero fixed-speed segments');
        const turns = velocity > 0
            ? Math.ceil((rotation - targetRotation - 1e-10) / full)
            : Math.floor((rotation - targetRotation + 1e-10) / full);
        const destination = targetRotation + turns * full;
        const deltaMs = (destination - rotation) / velocity * 1000;
        if (deltaMs >= -1e-5 && deltaMs <= end - time + 1e-6) {
            return time + Math.max(0, deltaMs);
        }
        rotation += velocity * (end - time) / 1000;
        time = end;
    }
    throw new Error('No target crossing found within 10000 rhythm segments');
}

function simulate(level, startMs = 0) {
    assert.equal(level.rhythm.shotModifier, undefined, 'Audit assumes no shot modifiers');
    const game = new context.GameSession(level);
    const slots = constructTargetSlots(level);
    game.advance(startMs);
    let elapsedMs = startMs;
    let minClearance = Infinity;
    const shotTimes = [];
    for (let shot = 0; shot < level.needleCount; shot++) {
        let best = null;
        slots.forEach((slot, slotIndex) => {
            const impactMs = earliestCrossing(game.rhythmManager, game.impactAngle - slot, elapsedMs + flightMs);
            if (!best || impactMs < best.impactMs) best = { impactMs, slotIndex };
        });
        const fireMs = best.impactMs - flightMs;
        game.advance(fireMs - elapsedMs);
        assert.ok(game.beginShot().accepted, `Shot rejected: level ${level.id}`);
        game.advance(flightMs);
        const impact = game.resolveImpact();
        assert.equal(impact.collided, false, `Collision: level ${level.id}, shot ${shot + 1}`);
        const clearance = impact.placement.minimumClearance;
        if (clearance !== null) minClearance = Math.min(minClearance, clearance);
        assert.ok(clearance === null || clearance >= clearancePx - 1e-6, `Clearance shortfall: level ${level.id}`);
        shotTimes.push({ fireMs, impactMs: best.impactMs, clearancePx: clearance });
        slots.splice(best.slotIndex, 1);
        elapsedMs = best.impactMs;
        if (!impact.completed) {
            game.advance(lockMs);
            assert.ok(game.releaseShotLock().released);
            elapsedMs += lockMs;
        }
    }
    assert.equal(game.status, 'completed');
    return {
        level: level.id,
        packLevelId: level.packLevelId,
        startMs,
        completed: true,
        shots: shotTimes.length,
        elapsedMs: elapsedMs - startMs,
        minClearancePx: minClearance,
        shotTimes
    };
}
module.exports = { context, read, manifest, presets, levelList, pack, simulate };
