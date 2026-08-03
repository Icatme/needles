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

const context = vm.createContext({
    console,
    Math,
    Number,
    JSON,
    Object,
    Array,
    Map,
    Set,
    TextEncoder
});

load(context, 'js/managers/RhythmManager.js', 'RhythmManager');
load(context, 'js/core/AngularCollisionRules.js', 'AngularCollisionRules');
load(context, 'js/core/GameSession.js', 'GameSession');
load(context, 'js/core/ReplayProtocol.js', 'ReplayProtocol');
load(context, 'js/core/ReplayRecorder.js', 'ReplayRecorder');
load(context, 'js/core/ReplayRunner.js', 'ReplayRunner');

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
        ...overrides
    };
}

function recordCompletedReplay() {
    const level = makeLevel();
    const recorder = new context.ReplayRecorder(level);

    recorder.advance(1000);
    assert.equal(recorder.beginShot().accepted, true);
    recorder.advance(120);
    assert.equal(recorder.resolveImpact().collided, false);
    recorder.advance(200);
    assert.equal(recorder.releaseShotLock().released, true);
    recorder.advance(850);
    assert.equal(recorder.beginShot().accepted, true);
    recorder.advance(120);
    const finalImpact = recorder.resolveImpact();
    assert.equal(finalImpact.completed, true);
    recorder.advance(300);

    return { level, replay: recorder.export() };
}

test('a compact command timeline reproduces a completed session exactly', () => {
    const { level, replay } = recordCompletedReplay();
    const serialized = JSON.stringify(replay);
    const parsed = JSON.parse(serialized);
    const result = new context.ReplayRunner().run(parsed, level);

    assert.equal(result.verified, true);
    assert.equal(result.final.status, 'completed');
    assert.equal(result.final.insertedCount, 2);
    assert.deepEqual(
        Array.from(parsed.commands, command => command.type),
        [
            'begin-shot',
            'resolve-impact',
            'release-shot-lock',
            'begin-shot',
            'resolve-impact'
        ]
    );
    assert.equal(parsed.durationMs, 2590);
    assert.equal(parsed.digest, context.ReplayProtocol.digest(parsed));
    assert.equal(
        result.final.eventDigest,
        parsed.final.eventDigest
    );
});

test('collision type and target identity survive replay', () => {
    const level = makeLevel({
        needleCount: 1,
        layout: { obstacleAngles: [90] },
        rhythm: {
            segments: [{ durationMs: 4000, velocity: 0.3 }]
        }
    });
    const recorder = new context.ReplayRecorder(level);
    recorder.beginShot();
    recorder.advance(100);
    const collision = recorder.resolveImpact();
    const replay = recorder.export();
    const result = new context.ReplayRunner().run(replay, level);

    assert.equal(collision.collided, true);
    assert.equal(collision.collision.type, 'obstacle');
    assert.equal(collision.collision.targetId, 'obstacle-1');
    assert.equal(result.final.status, 'failed');
    assert.equal(
        result.outcomes.at(-1).actual.collision.targetId,
        'obstacle-1'
    );
});

test('digest and outcome verification reject replay tampering', () => {
    const { level, replay } = recordCompletedReplay();
    const changedWithoutDigest = JSON.parse(JSON.stringify(replay));
    changedWithoutDigest.commands[0].atMs += 1;

    assert.throws(
        () => new context.ReplayRunner().run(changedWithoutDigest, level),
        /digest does not match/
    );

    const changedWithDigest = JSON.parse(JSON.stringify(replay));
    changedWithDigest.commands[0].expected.accepted = false;
    changedWithDigest.digest = context.ReplayProtocol.digest(changedWithDigest);
    assert.throws(
        () => new context.ReplayRunner().run(changedWithDigest, level),
        /outcome does not match/
    );
});

test('a replay cannot silently run against changed level content', () => {
    const { level, replay } = recordCompletedReplay();
    const changedLevel = makeLevel({
        rhythm: {
            segments: [{ durationMs: 4000, velocity: 0.55 }]
        }
    });

    assert.throws(
        () => new context.ReplayRunner().run(replay, changedLevel),
        /contentHash/
    );
    assert.equal(
        context.ReplayProtocol.createLevelDescriptor(level).levelId,
        replay.level.levelId
    );
});

test('replay core has no Phaser, DOM or storage dependency', () => {
    [
        'js/core/ReplayProtocol.js',
        'js/core/ReplayRecorder.js',
        'js/core/ReplayRunner.js'
    ].forEach(relativePath => {
        const source = fs.readFileSync(path.join(root, relativePath), 'utf8');
        assert.doesNotMatch(source, /\bPhaser\b/);
        assert.doesNotMatch(source, /\blocalStorage\b/);
        assert.doesNotMatch(source, /\bsessionStorage\b/);
        assert.doesNotMatch(source, /\bdocument\b/);
        assert.doesNotMatch(source, /\bwindow\b/);
    });
});
