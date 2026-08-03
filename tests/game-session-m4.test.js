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

function readJson(relativePath) {
    return JSON.parse(fs.readFileSync(path.join(root, relativePath), 'utf8'));
}

const context = vm.createContext({
    console,
    Math,
    Number,
    Object,
    JSON,
    Array,
    Map,
    Set
});
load(context, 'js/utils/constants.js', 'CONSTANTS');
load(context, 'js/managers/RhythmManager.js', 'RhythmManager');
load(context, 'js/core/AngularCollisionRules.js', 'AngularCollisionRules');
load(context, 'js/core/GameSession.js', 'GameSession');
load(context, 'js/packs/LevelResolver.js', 'LevelResolver');

function makeLevel(overrides = {}) {
    return {
        id: 1,
        packLevelId: 'test-level',
        order: 1,
        name: 'Test',
        rule: '',
        needleCount: 2,
        layout: { id: 'test', obstacleAngles: [] },
        rhythm: {
            segments: [{ durationMs: 4000, velocity: 1 }]
        },
        designIntent: { tier: 1, milestone: false },
        ...overrides
    };
}

function closeTo(actual, expected, epsilon = 1e-9) {
    assert.ok(
        Math.abs(actual - expected) <= epsilon,
        `${actual} should be close to ${expected}`
    );
}

test('angular collision is exactly equivalent to world-space circle collision', () => {
    const rules = new context.AngularCollisionRules();
    const radii = [
        [rules.needleRadius, rules.needleRadius],
        [rules.needleRadius, rules.obstacleRadius]
    ];

    radii.forEach(([radiusA, radiusB]) => {
        for (let step = 0; step <= 360; step += 3) {
            const angleA = Math.PI / 2;
            const angleB = step * Math.PI / 180;
            const pointA = {
                x: Math.cos(angleA) * rules.ringRadius,
                y: Math.sin(angleA) * rules.ringRadius
            };
            const pointB = {
                x: Math.cos(angleB) * rules.ringRadius,
                y: Math.sin(angleB) * rules.ringRadius
            };
            const distance = Math.hypot(
                pointA.x - pointB.x,
                pointA.y - pointB.y
            );
            assert.equal(
                rules.collides(angleA, radiusA, angleB, radiusB),
                distance < radiusA + radiusB
            );
        }
    });
});

test('a shot collides with an obstacle at the impact angle', () => {
    const session = new context.GameSession(makeLevel({
        needleCount: 1,
        layout: { id: 'blocked', obstacleAngles: [90] }
    }));

    assert.equal(session.beginShot().accepted, true);
    const outcome = session.resolveImpact();
    assert.equal(outcome.collided, true);
    assert.equal(outcome.collision.type, 'obstacle');
    assert.equal(session.getSnapshot().status, 'failed');
    assert.equal(session.getSnapshot().insertedCount, 0);
});

test('inserting twice at the same wheel angle collides with the first needle', () => {
    const session = new context.GameSession(makeLevel());

    session.beginShot();
    const first = session.resolveImpact();
    assert.equal(first.collided, false);
    assert.equal(first.completed, false);
    assert.equal(first.needleNumber, 2);
    assert.equal(session.getSnapshot().status, 'locked');
    assert.equal(session.beginShot().accepted, false);

    assert.equal(session.releaseShotLock().released, true);
    session.beginShot();
    const second = session.resolveImpact();
    assert.equal(second.collided, true);
    assert.equal(second.collision.type, 'needle');
    assert.equal(second.collision.targetId, 2);
});

test('rotating to a clear angle allows completion', () => {
    const session = new context.GameSession(makeLevel());

    session.beginShot();
    const first = session.resolveImpact();
    closeTo(first.wheelAngle, Math.PI / 2);
    session.releaseShotLock();

    const frame = session.advance(1000);
    closeTo(frame.rotationDelta, 1);
    closeTo(session.getSnapshot().wheelRotation, 1);

    session.beginShot();
    const second = session.resolveImpact();
    assert.equal(second.collided, false);
    assert.equal(second.completed, true);
    assert.equal(second.needleNumber, 1);
    assert.equal(session.getSnapshot().status, 'completed');
    assert.equal(session.getSnapshot().remainingCount, 0);
});

test('session rhythm and rotation are invariant to frame splitting', () => {
    const level = makeLevel({
        rhythm: {
            segments: [
                { durationMs: 900, velocity: 0.4 },
                { durationMs: 600, velocity: 1.0 },
                { durationMs: 700, velocity: -0.5 }
            ]
        }
    });
    const single = new context.GameSession(level);
    const split = new context.GameSession(level);
    const total = 12345;
    const chunks = [16, 33, 250, 999, 11047];

    const singleDelta = single.advance(total).rotationDelta;
    const splitDelta = chunks.reduce(
        (sum, chunk) => sum + split.advance(chunk).rotationDelta,
        0
    );
    closeTo(singleDelta, splitDelta);
    closeTo(single.getSnapshot().wheelRotation, split.getSnapshot().wheelRotation);
});

test('shot modifiers change only after a successful core insertion', () => {
    const session = new context.GameSession(makeLevel({
        needleCount: 3,
        rhythm: {
            segments: [{ durationMs: 4000, velocity: 0.4 }],
            shotModifier: { speedStep: 0.1, maxAbsSpeed: 0.8 }
        }
    }));

    assert.equal(session.advance(100).rhythm.angularVelocity, 0.4);
    session.beginShot();
    session.resolveImpact();
    assert.equal(session.advance(100).rhythm.angularVelocity, 0.5);
});

test('session emits ordered domain events without display objects', () => {
    const session = new context.GameSession(makeLevel());
    session.beginShot();
    session.resolveImpact();
    session.releaseShotLock();
    const events = session.drainEvents();

    assert.deepEqual(
        Array.from(events, event => event.type),
        ['shot-started', 'needle-inserted', 'shot-ready']
    );
    assert.deepEqual(
        Array.from(events, event => event.sequence),
        [1, 2, 3]
    );
    assert.equal(session.drainEvents().length, 0);
});

test('all one hundred authored levels construct as headless sessions', () => {
    ['balanced-v2', 'legacy'].forEach(packId => {
        const manifest = readJson(`packs/${packId}/manifest.json`);
        const presets = readJson(`packs/${packId}/presets.json`);
        const levels = readJson(`packs/${packId}/levels.json`);
        const pack = new context.LevelResolver().resolvePack(
            manifest,
            presets,
            levels
        );

        pack.levels.forEach(level => {
            const session = new context.GameSession(level);
            const snapshot = session.getSnapshot();
            assert.equal(snapshot.status, 'ready');
            assert.equal(snapshot.remainingCount, level.needleCount);
            assert.equal(snapshot.obstacles.length, level.layout.obstacleAngles.length);
        });
    });
});

test('pure core has no Phaser, scene, browser storage or rendering dependency', () => {
    ['js/core/AngularCollisionRules.js', 'js/core/GameSession.js']
        .forEach(relativePath => {
            const source = fs.readFileSync(path.join(root, relativePath), 'utf8');
            assert.doesNotMatch(source, /Phaser/);
            assert.doesNotMatch(source, /\.scene\b/);
            assert.doesNotMatch(source, /localStorage|sessionStorage/);
            assert.doesNotMatch(source, /add\.graphics|add\.text|tweens/);
        });
});
