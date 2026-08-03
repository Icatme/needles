const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const {
    buildBalanceReview,
    renderBalanceReviewHtml,
    summarizeLevelParameters
} = require('../scripts/lib/balance-review');

const root = path.resolve(__dirname, '..');
const campaignPath = 'playtests/campaigns/balanced-v2-anchor-v1.json';

function createAttempt(options) {
    return {
        id: options.id,
        recordedAt: options.recordedAt,
        mode: 'test',
        packId: 'balanced-v2',
        packVersion: '1.0.0',
        levelId: options.levelId,
        order: options.order,
        predictedDifficulty: options.predictedDifficulty,
        difficultyDrivers: options.drivers || ['密度'],
        result: {
            status: options.success ? 'completed' : 'failed',
            success: options.success,
            durationMs: options.durationMs || 1000,
            insertedCount: options.success ? 10 : (options.insertedCount ?? 2),
            totalCount: 10,
            failedNeedleNumber: options.success ? null : (options.failedNeedleNumber || 8),
            collisionType: options.success ? null : (options.collisionType || 'needle'),
            collisionTargetId: options.success ? null : 1
        },
        shots: {
            count: 1,
            acceptedAtMs: [0],
            intervalsMs: options.intervalsMs || []
        },
        replay: { schema: 'needles.replay/v1', digest: '00000000' }
    };
}

function bundle(attempts) {
    return {
        schema: 'needles.playtest-export/v1',
        exportedAt: '2026-08-03T18:00:00.000Z',
        attemptCount: attempts.length,
        attempts
    };
}

function sources() {
    return [
        {
            source: 'tester-a.json',
            bundle: bundle([
                createAttempt({ id: 'a1', recordedAt: '2026-08-03T10:00:00Z', levelId: 'balanced-v2-01', order: 1, predictedDifficulty: 10, success: false, insertedCount: 1 }),
                createAttempt({ id: 'a2', recordedAt: '2026-08-03T10:01:00Z', levelId: 'balanced-v2-01', order: 1, predictedDifficulty: 10, success: false, insertedCount: 2 }),
                createAttempt({ id: 'a3', recordedAt: '2026-08-03T10:02:00Z', levelId: 'balanced-v2-01', order: 1, predictedDifficulty: 10, success: true, durationMs: 1800 }),
                createAttempt({ id: 'a4', recordedAt: '2026-08-03T10:03:00Z', levelId: 'balanced-v2-10', order: 10, predictedDifficulty: 20, success: true, durationMs: 900 }),
                createAttempt({ id: 'a5', recordedAt: '2026-08-03T10:04:00Z', levelId: 'balanced-v2-10', order: 10, predictedDifficulty: 20, success: true, durationMs: 950 })
            ])
        },
        {
            source: 'tester-b.json',
            bundle: bundle([
                createAttempt({ id: 'b1', recordedAt: '2026-08-03T11:00:00Z', levelId: 'balanced-v2-01', order: 1, predictedDifficulty: 10, success: false, insertedCount: 1 }),
                createAttempt({ id: 'b2', recordedAt: '2026-08-03T11:01:00Z', levelId: 'balanced-v2-01', order: 1, predictedDifficulty: 10, success: false, insertedCount: 1 }),
                createAttempt({ id: 'b3', recordedAt: '2026-08-03T11:02:00Z', levelId: 'balanced-v2-10', order: 10, predictedDifficulty: 20, success: true, durationMs: 800 }),
                createAttempt({ id: 'b4', recordedAt: '2026-08-03T11:03:00Z', levelId: 'balanced-v2-10', order: 10, predictedDifficulty: 20, success: true, durationMs: 850 }),
                createAttempt({ id: 'b5', recordedAt: '2026-08-03T11:04:00Z', levelId: 'balanced-v2-10', order: 10, predictedDifficulty: 20, success: false, insertedCount: 9 })
            ])
        }
    ];
}

test('separates missing-data collection from pilot-ready manual review', () => {
    const review = buildBalanceReview(root, campaignPath, sources(), {
        clock: () => new Date('2026-08-03T19:00:00.000Z')
    });

    assert.equal(review.schema, 'needles.balance-review/v1');
    assert.equal(review.dataGate, 'collect-more-data');
    assert.equal(review.anchorCount, 15);
    assert.equal(review.readyAnchorCount, 2);
    assert.equal(review.reviewQueue.length, 2);
    assert.equal(review.collectionQueue.length, 13);
    assert.equal(review.methodology.parameterChangesGenerated, false);
    assert.equal(review.collectionQueue[0].levelId, 'balanced-v2-03');
    assert.equal(review.collectionQueue[0].gaps.attempts, 5);
    assert.equal(review.reviewQueue[0].levelId, 'balanced-v2-01');
});

test('shows relative mismatch without generating parameter edits', () => {
    const review = buildBalanceReview(root, campaignPath, sources());
    const level1 = review.anchors.find(anchor => anchor.levelId === 'balanced-v2-01');
    const level10 = review.anchors.find(anchor => anchor.levelId === 'balanced-v2-10');
    const serialized = JSON.stringify(review);

    assert.equal(level1.pilotReady, true);
    assert.equal(level1.relativeAssessment, 'harder-than-predicted-relative-position');
    assert.equal(level1.observed.rankDelta > 0, true);
    assert.equal(level10.relativeAssessment, 'easier-than-predicted-relative-position');
    assert.equal(level10.observed.rankDelta < 0, true);
    assert.doesNotMatch(serialized, /suggestedNeedleCount|suggestedSpeed|recommendedVelocity|automaticPatch/i);
});

test('review rows include current and neighboring parameter context', () => {
    const review = buildBalanceReview(root, campaignPath, sources());
    const level10 = review.anchors.find(anchor => anchor.levelId === 'balanced-v2-10');

    assert.equal(Number.isInteger(level10.parameters.needleCount), true);
    assert.equal(Number.isInteger(level10.parameters.obstacleCount), true);
    assert.equal(Number.isInteger(level10.parameters.segmentCount), true);
    assert.equal(Number.isFinite(level10.parameters.shortestSegmentMs), true);
    assert.equal(Number.isFinite(level10.parameters.peakAbsSpeed), true);
    assert.equal(level10.neighbors.previous.levelId, 'balanced-v2-09');
    assert.equal(level10.neighbors.next.levelId, 'balanced-v2-11');
    assert.equal(Number.isFinite(level10.neighbors.previous.predictedScore), true);
    assert.equal(Number.isFinite(level10.neighbors.next.predictedScore), true);
});

test('parameter summary describes mechanics without Phaser objects', () => {
    const summary = summarizeLevelParameters({
        needleCount: 4,
        layout: { id: 'test', obstacleAngles: [0, 180] },
        rhythm: {
            segments: [
                { durationMs: 2000, velocity: 0.4 },
                { durationMs: 1000, fromVelocity: -0.2, toVelocity: -0.6 }
            ],
            shotModifier: { flipEvery: 2 }
        },
        presentation: { tier: 2 },
        tags: ['zones']
    });

    assert.deepEqual(summary, {
        needleCount: 4,
        obstacleCount: 2,
        layoutId: 'test',
        segmentCount: 2,
        shortestSegmentMs: 1000,
        peakAbsSpeed: 0.6,
        directionChanges: 1,
        shotModifier: { flipEvery: 2 },
        presentation: { tier: 2 },
        tags: ['zones']
    });
});

test('HTML and CLI produce a non-editing worksheet', () => {
    const review = buildBalanceReview(root, campaignPath, sources());
    const html = renderBalanceReviewHtml(review);
    assert.match(html, /数据采集队列/);
    assert.match(html, /人工复查队列/);
    assert.match(html, /不生成自动参数修改值/);

    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'needles-review-'));
    const sourceA = path.join(directory, 'a.json');
    const sourceB = path.join(directory, 'b.json');
    const jsonPath = path.join(directory, 'review.json');
    const htmlPath = path.join(directory, 'review.html');
    const inputs = sources();
    fs.writeFileSync(sourceA, JSON.stringify(inputs[0].bundle));
    fs.writeFileSync(sourceB, JSON.stringify(inputs[1].bundle));

    const result = spawnSync(process.execPath, [
        path.join(root, 'scripts/review-balance.js'),
        campaignPath,
        sourceA,
        sourceB,
        '--root',
        root,
        '--json',
        jsonPath,
        '--html',
        htmlPath
    ], { encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(JSON.parse(fs.readFileSync(jsonPath, 'utf8')).readyAnchorCount, 2);
    assert.match(fs.readFileSync(htmlPath, 'utf8'), /<!doctype html>/);
});
