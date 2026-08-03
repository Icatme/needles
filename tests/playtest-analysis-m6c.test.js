const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const {
    analyzePlaytests,
    renderHtmlReport,
    validateBundle
} = require('../scripts/lib/playtest-analysis');

function attempt(options) {
    return {
        id: options.id,
        recordedAt: options.recordedAt,
        mode: 'test',
        packId: options.packId,
        packVersion: '1.0.0',
        levelId: options.levelId,
        order: options.order,
        predictedDifficulty: options.predictedDifficulty,
        difficultyDrivers: options.drivers || ['密度'],
        result: {
            status: options.success ? 'completed' : 'failed',
            success: options.success,
            durationMs: options.durationMs,
            insertedCount: options.insertedCount,
            totalCount: options.totalCount,
            failedNeedleNumber: options.success ? null : options.failedNeedleNumber,
            collisionType: options.success ? null : (options.collisionType || 'needle'),
            collisionTargetId: options.success ? null : 'target-1'
        },
        shots: {
            count: options.shotCount || 1,
            acceptedAtMs: options.acceptedAtMs || [0],
            intervalsMs: options.intervalsMs || []
        },
        replay: {
            schema: 'needles.replay/v1',
            digest: options.id.replace(/[^0-9a-f]/gi, '').slice(0, 8).padEnd(8, '0')
        }
    };
}

function bundle(attempts) {
    return {
        schema: 'needles.playtest-export/v1',
        exportedAt: '2026-08-03T15:00:00.000Z',
        attemptCount: attempts.length,
        attempts
    };
}

function makeSources() {
    return [
        {
            source: 'tester-a.json',
            bundle: bundle([
                attempt({ id: 'a1', recordedAt: '2026-08-03T10:00:00Z', packId: 'balanced-v2', levelId: 'balanced-v2-01', order: 1, predictedDifficulty: 10, success: false, durationMs: 900, insertedCount: 2, totalCount: 10, failedNeedleNumber: 8 }),
                attempt({ id: 'a2', recordedAt: '2026-08-03T10:01:00Z', packId: 'balanced-v2', levelId: 'balanced-v2-01', order: 1, predictedDifficulty: 10, success: true, durationMs: 1400, insertedCount: 10, totalCount: 10, intervalsMs: [400, 450] }),
                attempt({ id: 'a3', recordedAt: '2026-08-03T10:02:00Z', packId: 'balanced-v2', levelId: 'balanced-v2-02', order: 2, predictedDifficulty: 20, success: false, durationMs: 700, insertedCount: 1, totalCount: 10, failedNeedleNumber: 9, collisionType: 'obstacle' }),
                attempt({ id: 'a4', recordedAt: '2026-08-03T10:03:00Z', packId: 'legacy', levelId: 'legacy-01', order: 1, predictedDifficulty: 12, success: true, durationMs: 1300, insertedCount: 10, totalCount: 10 })
            ])
        },
        {
            source: 'tester-b.json',
            bundle: bundle([
                attempt({ id: 'b1', recordedAt: '2026-08-03T11:00:00Z', packId: 'balanced-v2', levelId: 'balanced-v2-01', order: 1, predictedDifficulty: 10, success: true, durationMs: 1200, insertedCount: 10, totalCount: 10, intervalsMs: [380] }),
                attempt({ id: 'b2', recordedAt: '2026-08-03T11:01:00Z', packId: 'balanced-v2', levelId: 'balanced-v2-02', order: 2, predictedDifficulty: 20, success: false, durationMs: 650, insertedCount: 1, totalCount: 10, failedNeedleNumber: 9, collisionType: 'obstacle' }),
                attempt({ id: 'b3', recordedAt: '2026-08-03T11:02:00Z', packId: 'balanced-v2', levelId: 'balanced-v2-02', order: 2, predictedDifficulty: 20, success: false, durationMs: 600, insertedCount: 0, totalCount: 10, failedNeedleNumber: 10, collisionType: 'obstacle' }),
                attempt({ id: 'b4', recordedAt: '2026-08-03T11:03:00Z', packId: 'legacy', levelId: 'legacy-01', order: 1, predictedDifficulty: 12, success: false, durationMs: 500, insertedCount: 2, totalCount: 10, failedNeedleNumber: 8 }),
                attempt({ id: 'b5', recordedAt: '2026-08-03T11:04:00Z', packId: 'legacy', levelId: 'legacy-01', order: 1, predictedDifficulty: 12, success: true, durationMs: 1500, insertedCount: 10, totalCount: 10 })
            ])
        }
    ];
}

test('aggregates anonymous exports into explainable per-level metrics', () => {
    const report = analyzePlaytests(makeSources(), {
        minSamples: 3,
        clock: () => new Date('2026-08-03T16:00:00.000Z')
    });
    const balanced = report.packs.find(pack => pack.packId === 'balanced-v2');
    const level1 = balanced.levels.find(level => level.order === 1);
    const level2 = balanced.levels.find(level => level.order === 2);

    assert.equal(report.schema, 'needles.playtest-report/v1');
    assert.equal(report.sourceCount, 2);
    assert.equal(report.attemptCount, 9);
    assert.equal(level1.attempts, 3);
    assert.equal(level1.successes, 2);
    assert.equal(level1.completionRate, 0.666667);
    assert.equal(level1.medianAttemptsToComplete, 1.5);
    assert.equal(level1.completedRuns, 2);
    assert.equal(level1.incompleteRuns, 0);
    assert.equal(level1.medianSuccessDurationMs, 1300);
    assert.equal(level1.medianFailureProgress, 0.2);
    assert.equal(level1.medianShotIntervalMs, 400);
    assert.equal(level1.sampleStatus, 'usable');

    assert.equal(level2.attempts, 3);
    assert.equal(level2.completionRate, 0);
    assert.equal(level2.medianAttemptsToComplete, null);
    assert.equal(level2.incompleteRuns, 2);
    assert.equal(level2.medianFailureProgress, 0.1);
    assert.deepEqual(level2.collisionTypes, [{ value: 'obstacle', count: 3 }]);
    assert.equal(level2.observedRank > level1.observedRank, true);
});

test('reports adjacent jumps, low samples and balanced/legacy comparisons', () => {
    const report = analyzePlaytests(makeSources(), { minSamples: 4 });
    const balanced = report.packs.find(pack => pack.packId === 'balanced-v2');
    const jump = balanced.adjacentJumps[0];

    assert.equal(balanced.usableLevelCount, 0);
    assert.equal(jump.comparable, false);
    assert.equal(jump.predictedDifficultyDelta, 10);
    assert.equal(jump.failureRateDelta, 0.666667);
    assert.equal(report.comparisons.length, 1);
    assert.equal(report.comparisons[0].order, 1);
    assert.equal(report.comparisons[0].balancedAttempts, 3);
    assert.equal(report.comparisons[0].legacyAttempts, 3);
    assert.equal(report.comparisons[0].completionRateDelta, 0);
});

test('HTML report escapes data and contains all report sections', () => {
    const sources = makeSources();
    sources[0].bundle.attempts[0].packId = '<script>alert(1)</script>';
    const report = analyzePlaytests(sources, { minSamples: 2 });
    const html = renderHtmlReport(report);

    assert.match(html, /Needles 试玩报告/);
    assert.match(html, /相邻关跳幅/);
    assert.match(html, /balanced-v2 \/ legacy/);
    assert.doesNotMatch(html, /<script>alert\(1\)<\/script>/);
    assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
});

test('validates export metadata before analysis', () => {
    const valid = bundle([]);
    assert.equal(validateBundle(valid, 'valid.json'), true);
    assert.throws(
        () => validateBundle({ ...valid, schema: 'unknown' }, 'bad.json'),
        /unsupported schema/
    );
    assert.throws(
        () => validateBundle({ ...valid, attemptCount: 1 }, 'bad-count.json'),
        /attemptCount/
    );
});

test('CLI writes deterministic JSON and a standalone HTML report', () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'needles-report-'));
    const inputA = path.join(directory, 'a.json');
    const inputB = path.join(directory, 'b.json');
    const jsonPath = path.join(directory, 'out', 'report.json');
    const htmlPath = path.join(directory, 'out', 'report.html');
    const sources = makeSources();
    fs.writeFileSync(inputA, JSON.stringify(sources[0].bundle));
    fs.writeFileSync(inputB, JSON.stringify(sources[1].bundle));

    const result = spawnSync(process.execPath, [
        path.join(root, 'scripts/analyze-playtests.js'),
        inputA,
        inputB,
        '--json',
        jsonPath,
        '--html',
        htmlPath,
        '--min-samples',
        '3'
    ], { encoding: 'utf8' });

    assert.equal(result.status, 0, result.stderr);
    assert.equal(fs.existsSync(jsonPath), true);
    assert.equal(fs.existsSync(htmlPath), true);
    const report = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
    assert.equal(report.attemptCount, 9);
    assert.match(fs.readFileSync(htmlPath, 'utf8'), /<!doctype html>/);
});
