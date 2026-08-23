const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');

function load(context, relativePath, names) {
    const source = fs.readFileSync(path.join(root, relativePath), 'utf8');
    const exports = names.map(name => `this.${name} = ${name};`).join('\n');
    vm.runInContext(`${source}\n${exports}`, context, { filename: relativePath });
}

function loadDailySupport() {
    const context = vm.createContext({
        console,
        Math,
        Number,
        String,
        Boolean,
        JSON,
        Object,
        Array,
        Date,
        Map,
        Set,
        TextEncoder
    });
    load(context, 'js/utils/constants.js', ['CONSTANTS']);
    load(context, 'js/managers/RhythmManager.js', ['RhythmManager']);
    load(context, 'js/core/AngularCollisionRules.js', ['AngularCollisionRules']);
    load(context, 'js/core/GameSession.js', ['GameSession']);
    load(context, 'js/core/ReplayProtocol.js', ['ReplayProtocol']);
    load(context, 'js/core/ReplayRecorder.js', ['ReplayRecorder']);
    load(context, 'js/core/ScoreSession.js', ['ScoreSession']);

    const mainSource = fs.readFileSync(path.join(root, 'js/main.js'), 'utf8');
    const supportSource = mainSource.slice(0, mainSource.indexOf('const DAILY_CHALLENGES'));
    vm.runInContext(
        `${supportSource}\nthis.DailyChallengeStore = DailyChallengeStore;`
            + '\nthis.ScoreReplayVerifier = ScoreReplayVerifier;'
            + '\nthis.DailyChallengeService = DailyChallengeService;',
        context,
        { filename: 'js/main.js' }
    );
    return context;
}

function level() {
    return {
        id: 1,
        packId: 'pack',
        packVersion: '1.0.0',
        packLevelId: 'level-1',
        order: 1,
        name: 'One',
        rule: '',
        needleCount: 1,
        layout: { id: 'clear', obstacleAngles: [] },
        rhythm: { segments: [{ durationMs: 4000, velocity: 0.4 }] },
        designIntent: { tier: 1, milestone: false },
        scoring: {
            profileId: 'test-profile',
            parTimeMs: 10000,
            comboWindowMs: 3000
        }
    };
}

function challenge(overrides = {}) {
    const value = {
        schema: 'needles-daily-v1',
        dateKey: '2026-08-22',
        packId: 'pack',
        packVersion: '1.0.0',
        levelId: 'level-1',
        levelOrder: 1,
        levelName: 'One',
        seed: 1234,
        seedDigest: '1234abcd',
        ...overrides
    };
    value.id = [
        'daily',
        value.dateKey,
        `${value.packId}@${value.packVersion}`,
        value.levelId
    ].join(':');
    return value;
}

function storage() {
    const values = new Map();
    return {
        getItem(key) {
            return values.has(key) ? values.get(key) : null;
        },
        setItem(key, value) {
            values.set(key, String(value));
        },
        removeItem(key) {
            values.delete(key);
        }
    };
}

test('daily challenge selection is stable for UTC date and pack version', () => {
    const { DailyChallengeService } = loadDailySupport();
    let packVersion = '1.0.0';
    const levels = Array.from({ length: 12 }, (_, index) => ({
        id: index + 1,
        packLevelId: `level-${index + 1}`,
        order: index + 1,
        name: `Level ${index + 1}`
    }));
    const context = {
        getActivePackId: () => 'pack',
        catalog: {
            getPack: () => ({ id: 'pack', version: packVersion }),
            listLevels: () => levels
        },
        router: {
            startMenu() {},
            startLevelBrowser() {},
            startLevel() {}
        }
    };
    const service = new DailyChallengeService(context, {
        store: { getBest: () => null, listRecent: () => [] },
        activeStorage: null
    });
    const date = new Date('2026-08-22T23:59:00.000Z');
    const first = service.getToday('pack', date);
    const second = service.getToday('pack', date);
    assert.deepEqual(JSON.parse(JSON.stringify(first)), JSON.parse(JSON.stringify(second)));
    assert.equal(first.dateKey, '2026-08-22');
    assert.match(first.id, /^daily:2026-08-22:pack@1\.0\.0:level-/);

    packVersion = '2.0.0';
    const nextVersion = service.getToday('pack', date);
    assert.notEqual(nextVersion.id, first.id);
    assert.equal(nextVersion.packVersion, '2.0.0');
});

test('daily challenge starts in its isolated route mode', () => {
    const { DailyChallengeService } = loadDailySupport();
    let started = null;
    const context = {
        getActivePackId: () => 'pack',
        catalog: {
            getPack: () => ({ id: 'pack', version: '1.0.0' }),
            listLevels: () => [{
                id: 1,
                packLevelId: 'level-1',
                order: 1,
                name: 'One'
            }]
        },
        router: {
            startMenu() {},
            startLevelBrowser() {},
            startLevel(scene, route) {
                started = route;
            }
        }
    };
    const service = new DailyChallengeService(context, {
        store: { getBest: () => null, listRecent: () => [] },
        activeStorage: null
    });
    service.start({}, 'pack');
    assert.equal(started.mode, 'daily');
    assert.equal(service.matchRoute(started).levelId, 'level-1');
    assert.equal(service.matchRoute({ ...started, mode: 'test' }), null);
});

test('replay verifier recomputes an identical score from gameplay commands', () => {
    const {
        ReplayRecorder,
        ScoreSession,
        ScoreReplayVerifier
    } = loadDailySupport();
    const config = level();
    const recorder = new ReplayRecorder(config);
    recorder.advance(5000);
    assert.equal(recorder.beginShot().accepted, true);
    recorder.advance(100);
    const outcome = recorder.resolveImpact();
    assert.equal(outcome.completed, true);
    recorder.advance(300);
    const replay = recorder.export();

    const score = new ScoreSession(config, { enabled: true });
    score.start();
    score.advance(100);
    score.recordInsertion(outcome.placement);
    score.complete();

    const verification = new ScoreReplayVerifier().verify({
        replay,
        levelConfig: config,
        score: score.getSnapshot(),
        challenge: challenge()
    });
    assert.equal(verification.verified, true);
    assert.equal(verification.score.elapsedMs, 100);
    assert.equal(typeof verification.verificationDigest, 'string');
});

test('replay verifier rejects a claimed score changed after the run', () => {
    const {
        ReplayRecorder,
        ScoreSession,
        ScoreReplayVerifier
    } = loadDailySupport();
    const config = level();
    const recorder = new ReplayRecorder(config);
    recorder.beginShot();
    recorder.advance(100);
    const outcome = recorder.resolveImpact();
    const replay = recorder.export();
    const score = new ScoreSession(config, { enabled: true });
    score.start();
    score.advance(100);
    score.recordInsertion(outcome.placement);
    score.complete();
    const claimed = JSON.parse(JSON.stringify(score.getSnapshot()));
    claimed.score += 9999;

    const verification = new ScoreReplayVerifier().verify({
        replay,
        levelConfig: config,
        score: claimed,
        challenge: challenge()
    });
    assert.equal(verification.verified, false);
    assert.equal(verification.reason, 'score-mismatch');
});

test('replay verifier rejects a valid but incomplete replay', () => {
    const {
        ReplayRecorder,
        ScoreSession,
        ScoreReplayVerifier
    } = loadDailySupport();
    const config = level();
    const replay = new ReplayRecorder(config).export();
    const score = new ScoreSession(config, { enabled: true }).getSnapshot();

    const verification = new ScoreReplayVerifier().verify({
        replay,
        levelConfig: config,
        score,
        challenge: challenge()
    });
    assert.equal(verification.verified, false);
    assert.equal(verification.reason, 'incomplete-replay');
});

test('replay verifier validates the protocol before executing commands', () => {
    const {
        ReplayProtocol,
        ReplayRecorder,
        ScoreSession,
        ScoreReplayVerifier
    } = loadDailySupport();
    const config = level();
    const replay = JSON.parse(JSON.stringify(new ReplayRecorder(config).export()));
    replay.schema = 'needles.replay/unsupported';
    replay.digest = ReplayProtocol.digest(replay);

    const verification = new ScoreReplayVerifier().verify({
        replay,
        levelConfig: config,
        score: new ScoreSession(config, { enabled: true }).getSnapshot(),
        challenge: challenge()
    });
    assert.equal(verification.verified, false);
    assert.equal(verification.reason, 'invalid-replay');
    assert.match(verification.detail, /unsupported replay schema/);
});

test('replay verifier rejects rehashed client geometry instead of trusting it', () => {
    const {
        ReplayRecorder,
        ScoreSession,
        ScoreReplayVerifier
    } = loadDailySupport();
    const config = level();
    config.needleCount = 2;
    const recorder = new ReplayRecorder(config, {
        geometry: {
            ringRadius: 172,
            needleRadius: 0.0001,
            obstacleRadius: 0.0001
        }
    });
    recorder.beginShot();
    recorder.advance(100);
    assert.equal(recorder.resolveImpact().collided, false);
    recorder.releaseShotLock();
    recorder.beginShot();
    recorder.advance(1);
    assert.equal(recorder.resolveImpact().completed, true);

    const verification = new ScoreReplayVerifier().verify({
        replay: recorder.export(),
        levelConfig: config,
        score: new ScoreSession(config, { enabled: true }).getSnapshot(),
        challenge: challenge()
    });
    assert.equal(verification.verified, false);
    assert.equal(verification.reason, 'invalid-replay');
    assert.match(verification.detail, /geometry does not match/);
});

test('replay verifier rejects a rehashed final summary that differs from execution', () => {
    const {
        ReplayProtocol,
        ReplayRecorder,
        ScoreSession,
        ScoreReplayVerifier
    } = loadDailySupport();
    const config = level();
    const recorder = new ReplayRecorder(config);
    recorder.beginShot();
    recorder.advance(100);
    const outcome = recorder.resolveImpact();
    const replay = JSON.parse(JSON.stringify(recorder.export()));
    replay.final.insertedCount = 0;
    replay.digest = ReplayProtocol.digest(replay);

    const score = new ScoreSession(config, { enabled: true });
    score.start();
    score.advance(100);
    score.recordInsertion(outcome.placement);
    score.complete();

    const verification = new ScoreReplayVerifier().verify({
        replay,
        levelConfig: config,
        score: score.getSnapshot(),
        challenge: challenge()
    });
    assert.equal(verification.verified, false);
    assert.equal(verification.reason, 'replay-final');
});

test('daily store accepts verified runs and applies deterministic tie-breaks', () => {
    const {
        DailyChallengeStore,
        ReplayProtocol,
        ScoreReplayVerifier
    } = loadDailySupport();
    const store = new DailyChallengeStore({
        storage: storage(),
        clock: () => '2026-08-22T00:00:00.000Z'
    });
    const dailyChallenge = challenge();
    const createVerification = (replayDigest, score) => ({
        verified: true,
        replayDigest,
        profileId: 'profile-a',
        challenge: dailyChallenge,
        score,
        verificationDigest: ReplayProtocol.hashValue({
            replayDigest,
            profileId: 'profile-a',
            challenge: dailyChallenge,
            score: ScoreReplayVerifier.scoreSummary(score)
        })
    });
    const verification = createVerification('replay-a', {
            status: 'completed',
            score: 1000,
            elapsedMs: 5000,
            maxCombo: 4
    });
    const first = store.recordVerified({ verification });
    assert.equal(first.accepted, true);
    assert.equal(first.isDailyBest, true);
    assert.equal(first.record.packVersion, '1.0.0');
    assert.equal(first.record.seed, 1234);

    const slower = store.recordVerified({
        verification: createVerification('replay-b', {
            status: 'completed',
            score: 1000,
            elapsedMs: 6000,
            maxCombo: 5
        })
    });
    assert.equal(slower.isDailyBest, false);
    assert.equal(store.getBest(dailyChallenge.id).elapsedMs, 5000);
});

test('daily service rejects caller-supplied challenge metadata', () => {
    const { DailyChallengeService } = loadDailySupport();
    const config = level();
    const context = {
        getActivePackId: () => 'pack',
        catalog: {
            getPack: () => ({ id: 'pack', version: '1.0.0' }),
            listLevels: () => [config]
        },
        router: {
            startMenu() {},
            startLevelBrowser() {},
            startLevel() {}
        }
    };
    const service = new DailyChallengeService(context, {
        store: {
            getBest: () => null,
            listRecent: () => [],
            recordVerified() {
                throw new Error('store must not receive a forged challenge');
            }
        },
        verifier: {
            verify() {
                throw new Error('verifier must not receive a forged challenge');
            }
        },
        activeStorage: null
    });
    const active = service.start({}, 'pack');
    const result = service.recordVerifiedRun({
        challenge: { ...active, levelName: 'Forged' },
        levelConfig: config,
        replay: {},
        score: {}
    });

    assert.equal(result.accepted, false);
    assert.equal(result.reason, 'challenge-mismatch');
});

test('daily service stores only the canonical active challenge identity', () => {
    const {
        DailyChallengeService,
        ReplayRecorder,
        ScoreSession
    } = loadDailySupport();
    const config = level();
    const context = {
        getActivePackId: () => 'pack',
        catalog: {
            getPack: () => ({ id: 'pack', version: '1.0.0' }),
            listLevels: () => [config]
        },
        router: {
            startMenu() {},
            startLevelBrowser() {},
            startLevel() {}
        }
    };
    const service = new DailyChallengeService(context, {
        activeStorage: null,
        storeOptions: {
            storage: storage(),
            clock: () => '2026-08-22T00:00:00.000Z'
        }
    });
    const active = service.start({}, 'pack');
    const recorder = new ReplayRecorder(config);
    recorder.beginShot();
    recorder.advance(100);
    const outcome = recorder.resolveImpact();
    const score = new ScoreSession(config, { enabled: true });
    score.start();
    score.advance(100);
    score.recordInsertion(outcome.placement);
    score.complete();

    const result = service.recordVerifiedRun({
        challenge: active,
        levelConfig: config,
        replay: recorder.export(),
        score: score.getSnapshot()
    });

    assert.equal(result.accepted, true);
    assert.equal(result.record.challengeId, active.id);
    assert.equal(result.record.packVersion, active.packVersion);
    assert.equal(result.record.seedDigest, active.seedDigest);
    assert.deepEqual(
        JSON.parse(JSON.stringify(result.verification.challenge)),
        JSON.parse(JSON.stringify(active))
    );
});

test('daily store refuses an incomplete score even if a caller marks it verified', () => {
    const { DailyChallengeStore } = loadDailySupport();
    const store = new DailyChallengeStore({ storage: storage() });
    const result = store.recordVerified({
        challenge: { id: 'daily:test' },
        verification: {
            verified: true,
            score: { status: 'running', score: 100 }
        }
    });
    assert.equal(result.accepted, false);
    assert.equal(result.reason, 'incomplete-replay');
});
