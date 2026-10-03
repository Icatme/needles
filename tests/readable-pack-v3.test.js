const test = require('node:test');
const assert = require('node:assert/strict');
const { context, read, manifest, presets, levelList, pack, simulate } = require('./helpers/readable-pack');

test('readable-v3 is a separately versioned valid fifty-level pack; default stays unchanged', () => {
    const validator = new context.PackValidator();
    const index = read('packs/index.json');
    validator.validateIndex(index);
    validator.validateBundle(index.packs.find(p => p.id === 'readable-v3'), manifest, presets, levelList);
    assert.equal(index.defaultPackId, 'balanced-v2');
    assert.equal(manifest.version, '1.0.0');
    assert.equal(pack.levels.length, 50);
    assert.deepEqual(levelList.levels.map(l => l.order), Array.from({ length: 50 }, (_, i) => i + 1));
    assert.equal(new Set(levelList.levels.map(l => l.id)).size, 50);
});

test('first forty levels have at most two equal-duration, forward-only phases and no shot modifiers', () => {
    for (const level of pack.levels.slice(0, 40)) {
        assert.ok(level.rhythm.segments.length <= 2);
        assert.equal(new Set(level.rhythm.segments.map(s => s.durationMs)).size, 1);
        assert.ok(level.rhythm.segments.every(s => s.velocity > 0));
        assert.equal(level.rhythm.shotModifier, undefined);
    }
});

test('advanced rhythms isolate reversal from speed changes and stop at three phases', () => {
    let reversals = 0;
    for (const level of pack.levels.slice(40)) {
        const segments = level.rhythm.segments;
        assert.ok(segments.length <= 3);
        assert.equal(new Set(segments.map(s => s.durationMs)).size, 1);
        assert.equal(level.rhythm.shotModifier, undefined);
        if (segments.some(s => s.velocity < 0)) {
            reversals++;
            assert.equal(segments.length, 2);
            assert.equal(segments[0].velocity, -segments[1].velocity);
            // Each direction covers a full circle, avoiding a tiny back-and-forth dead zone.
            assert.ok(Math.abs(segments[0].velocity) * segments[0].durationMs / 1000 > Math.PI * 2);
        }
    }
    assert.equal(reversals, 3);
});

test('all fifty levels pass capacity and full-circle opportunity checks', () => {
    const model = new context.DifficultyModelV2();
    for (const level of pack.levels) {
        const audit = model.validate(level);
        assert.ok(audit.valid, `${level.id}: ${audit.errors.join('; ')}`);
        assert.ok(level.needleCount <= audit.analysis.capacity.layoutComfortable, `comfortable capacity ${level.id}`);
    }
});

test('all fifty levels have a collision-free timing witness at four starting phases', () => {
    for (const level of pack.levels) {
        const cycle = new context.RhythmManager(level.rhythm).cycleDurationMs;
        for (const phase of [0, .25, .5, .75]) {
            const result = simulate(level, cycle * phase);
            assert.ok(result.completed, `level ${level.id}, phase ${phase}: ${JSON.stringify(result)}`);
        }
    }
});

test('the existing index loader discovers the new pack alongside both previous packs', async () => {
    const registry = new context.PackRegistry();
    const loader = new context.PackLoader({ registry, fetchJson: async url => {
        const relative = new URL(url, 'https://needles.local/').pathname.slice(1);
        return read(relative);
    } });
    const result = await loader.loadIndex('packs/index.json');
    assert.equal(result.errors.length, 0);
    assert.equal(registry.get('readable-v3').levels.length, 50);
    assert.ok(registry.get('balanced-v2'));
    assert.ok(registry.get('legacy'));
    assert.equal(registry.defaultPackId, 'balanced-v2');
});
