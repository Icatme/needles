class ReplayRunner {
    constructor(options = {}) {
        this.sessionFactory = options.sessionFactory || ((level, sessionOptions) => (
            new GameSession(level, sessionOptions)
        ));
    }

    run(replay, levelConfig, options = {}) {
        ReplayProtocol.validate(replay);
        const descriptor = ReplayProtocol.createLevelDescriptor(levelConfig);
        this.verifyLevelIdentity(replay.level, descriptor, options);

        const geometry = replay.geometry || {};
        const session = this.sessionFactory(levelConfig, {
            impactAngle: geometry.impactAngle,
            geometry: {
                ringRadius: geometry.ringRadius,
                needleRadius: geometry.needleRadius,
                obstacleRadius: geometry.obstacleRadius
            }
        });
        const events = [];
        const outcomes = [];
        let elapsedMs = 0;

        replay.commands.forEach(command => {
            const deltaMs = command.atMs - elapsedMs;
            session.advance(deltaMs);
            elapsedMs = command.atMs;

            const result = this.execute(session, command.type);
            const actual = ReplayRecorder.summarizeOutcome(
                command.type,
                result
            );
            outcomes.push(ReplayProtocol.canonicalize({
                sequence: command.sequence,
                atMs: command.atMs,
                type: command.type,
                actual
            }));
            if (result?.event) {
                events.push(ReplayRecorder.summarizeEvent(result.event));
            }

            if (options.verifyOutcomes !== false) {
                this.verifyEqual(
                    command.expected,
                    actual,
                    `command ${command.sequence} (${command.type}) outcome`
                );
            }
        });

        session.advance(replay.durationMs - elapsedMs);
        const final = ReplayRecorder.createFinalSummary(session, events);
        const verified = ReplayProtocol.stableStringify(final)
            === ReplayProtocol.stableStringify(replay.final);

        if (!verified && options.verifyFinal !== false) {
            throw new Error('Replay final summary does not match');
        }

        return ReplayProtocol.deepFreeze(
            ReplayProtocol.canonicalize({
                verified,
                elapsedMs: replay.durationMs,
                level: descriptor,
                outcomes,
                final,
                snapshot: session.getSnapshot()
            })
        );
    }

    execute(session, type) {
        if (type === 'begin-shot') return session.beginShot();
        if (type === 'resolve-impact') return session.resolveImpact();
        if (type === 'release-shot-lock') return session.releaseShotLock();
        throw new Error(`Unsupported replay command ${type}`);
    }

    verifyLevelIdentity(expected, actual, options) {
        const mismatches = [];
        if (expected.levelId !== actual.levelId) {
            mismatches.push(`levelId ${expected.levelId} != ${actual.levelId}`);
        }
        if (expected.packId !== actual.packId) {
            mismatches.push(`packId ${expected.packId} != ${actual.packId}`);
        }
        if (
            options.ignorePackVersion !== true
            && expected.packVersion !== actual.packVersion
        ) {
            mismatches.push(
                `packVersion ${expected.packVersion} != ${actual.packVersion}`
            );
        }
        if (expected.contentHash !== actual.contentHash) {
            mismatches.push(
                `contentHash ${expected.contentHash} != ${actual.contentHash}`
            );
        }
        if (mismatches.length) {
            throw new Error(`Replay level mismatch: ${mismatches.join('; ')}`);
        }
    }

    verifyEqual(expected, actual, label) {
        if (
            ReplayProtocol.stableStringify(expected)
            !== ReplayProtocol.stableStringify(actual)
        ) {
            throw new Error(`${label} does not match recorded replay`);
        }
    }
}
