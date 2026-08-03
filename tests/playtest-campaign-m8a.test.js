const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const {
    evaluateCampaign,
    loadCampaign,
    planCampaign,
    renderCampaignHtml
} = require('../scripts/lib/playtest-campaign');

const root = path.resolve(__dirname, '..');
const campaignPath = 'playtests/campaigns/balanced-v2-anchor-v1.json';

function attempt(id, levelId, success, version = '1.0.0') {
    return {
        id,
        recordedAt: `2026-08-03T15:00:${String(Number(id.replace(/\D/g, '')) || 0).padStart(2, '0')}Z`,
        mode: 'test',
        packId: 'balanced-v2',
        packVersion: version,
        levelId,
        order: Number(levelId.slice(-2)),
        predictedDifficulty: 10,
        difficultyDrivers: ['密度'],
        result: {
            status: success ? 'completed' : 'failed',
            success,
            durationMs: 1000,
            insertedCount: success ? 10 : 2,
            totalCount: 10,
            failedNeedleNumber: success ? null : 8,
            collisionType: success ? null : 'needle',
            collisionTargetId: success ? null : 1
        },
        shots: { count: 1, acceptedAtMs: [0], intervalsMs: [] },
        replay: { schema: 'needles.replay/v1', digest: '00000000' }
    };
}

function bundle(attempts) {
    return {
        schema: 'needles.playtest-export/v1',
        exportedAt: '2026-08-03T16:00:00.000Z',
        attemptCount: attempts.length,
        attempts
    };
}

test('campaign anchors resolve to the current pack and comparison orders', () => {
    const loaded = loadCampaign(root, campaignPath);
    const plan = planCampaign(loaded, {
        baseURL: 'http://127.0.0.1:4173/'
    });

    assert.equal(loaded.campaign.packId, 'balanced-v2');
    assert.equal(loaded.campaign.packVersion, '1.0.0');
    assert.equal(plan.anchorCount, 15);
    assert.deepEqual(
        plan.anchors.map(anchor => anchor.order),
        [1, 3, 5, 7, 9, 10, 12, 15, 20, 25, 30, 35, 40, 45, 50]
    );
    plan.anchors.forEach(anchor => {
        const url = new URL(anchor.previewURL);
        assert.equal(url.searchParams.get('pack'), 'balanced-v2');
        assert.equal(url.searchParams.get('level'), anchor.levelId);
        assert.equal(url.searchParams.get('mode'), 'test');
        assert.equal(url.searchParams.get('skin'), 'clockwork-observatory');
        assert.equal(anchor.comparison.packId, 'legacy');
        assert.equal(anchor.comparison.order, anchor.order);
    });
});

test('empty campaign status starts at the first anchor with explicit gaps', () => {
    const loaded = loadCampaign(root, campaignPath);
    const status = evaluateCampaign(loaded, []);

    assert.equal(status.complete, false);
    assert.equal(status.readyAnchorCount, 0);
    assert.equal(status.matchingAttemptCount, 0);
    assert.deepEqual(status.nextAnchor, {
        levelId: 'balanced-v2-01',
        order: 1,
        reason: '首关基线与输入理解',
        gaps: { attempts: 5, sources: 2 }
    });
    assert.equal(status.anchors[0].status, 'unstarted');
});

test('pilot readiness requires both attempt and anonymous-source targets', () => {
    const loaded = loadCampaign(root, campaignPath);
    const sources = [
        {
            source: 'a.json',
            bundle: bundle([
                attempt('a1', 'balanced-v2-01', false),
                attempt('a2', 'balanced-v2-01', true),
                attempt('a3', 'balanced-v2-01', true),
                attempt('a4', 'balanced-v2-03', false)
            ])
        },
        {
            source: 'b.json',
            bundle: bundle([
                attempt('b1', 'balanced-v2-01', false),
                attempt('b2', 'balanced-v2-01', true),
                attempt('b3', 'balanced-v2-03', true),
                attempt('b4', 'balanced-v2-03', false),
                attempt('b5', 'balanced-v2-03', true, '0.9.0')
            ])
        }
    ];
    const status = evaluateCampaign(loaded, sources);
    const first = status.anchors.find(anchor => anchor.order === 1);
    const third = status.anchors.find(anchor => anchor.order === 3);

    assert.equal(first.pilotReady, true);
    assert.equal(first.status, 'pilot-ready');
    assert.equal(first.attempts, 5);
    assert.equal(first.sources, 2);
    assert.equal(first.successes, 3);
    assert.equal(first.failures, 2);

    assert.equal(third.pilotReady, false);
    assert.equal(third.attempts, 3);
    assert.equal(third.sources, 2);
    assert.equal(third.staleVersionAttempts, 1);
    assert.deepEqual(third.gaps, { attempts: 2, sources: 0 });
    assert.equal(status.staleVersionAttemptCount, 1);
    assert.equal(status.nextAnchor.levelId, 'balanced-v2-05');
});

test('HTML campaign report is a checklist with preview and comparison links', () => {
    const loaded = loadCampaign(root, campaignPath);
    const plan = planCampaign(loaded);
    const status = evaluateCampaign(loaded, []);
    const html = renderCampaignHtml(plan, status);

    assert.match(html, /Balanced V2 锚点试玩 Pilot/);
    assert.match(html, /pilot 目标每关 5 次 \/ 2 个匿名来源/);
    assert.match(html, /balanced-v2-10/);
    assert.match(html, />试玩<\/a>/);
    assert.match(html, />旧版<\/a>/);
});

test('campaign CLI writes plan and recommends the next anchor', () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'needles-campaign-'));
    const planPath = path.join(directory, 'plan.json');
    const htmlPath = path.join(directory, 'plan.html');
    const plan = spawnSync(process.execPath, [
        path.join(root, 'scripts/campaign.js'),
        'plan',
        campaignPath,
        '--root',
        root,
        '--json',
        planPath,
        '--html',
        htmlPath
    ], { encoding: 'utf8' });
    assert.equal(plan.status, 0, plan.stderr);
    assert.equal(JSON.parse(fs.readFileSync(planPath, 'utf8')).anchorCount, 15);
    assert.match(fs.readFileSync(htmlPath, 'utf8'), /<!doctype html>/);

    const next = spawnSync(process.execPath, [
        path.join(root, 'scripts/campaign.js'),
        'next',
        campaignPath,
        '--root',
        root
    ], { encoding: 'utf8' });
    assert.equal(next.status, 0, next.stderr);
    const result = JSON.parse(next.stdout);
    assert.equal(result.complete, false);
    assert.equal(result.next.levelId, 'balanced-v2-01');
    assert.match(result.next.previewURL, /balanced-v2-01/);
});
