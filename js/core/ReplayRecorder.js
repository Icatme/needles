class ReplayRecorder {
    constructor(levelConfig, options = {}) {
        this.session = options.session || new GameSession(levelConfig, {
            impactAngle: options.impactAngle,
            geometry: options.geometry
        });
        this.levelDescriptor = ReplayProtocol.createLevelDescriptor(
            this.session.level
        );
        this.geometry = ReplayProtocol.createGeometry(this.session);
        this.elapsedMs = 0;
        this.commands = [];
        this.events = [];
    }

    advance(deltaMs) {
        const safeDelta = Math.max(0, Number(deltaMs) || 0);
        this.elapsedMs += safeDelta;
        return this.session.advance(safeDelta);
    }

    beginShot() {
        return this.recordCommand(
            'begin-shot',
            () => this.session.beginShot()
        );
    }

    resolveImpact() {
        return this.recordCommand(
            'resolve-impact',
            () => this.session.resolveImpact()
        );
    }

    releaseShotLock() {
        return this.recordCommand(
            'release-shot-lock',
            () => this.session.releaseShotLock()
        );
    }

    recordCommand(type, execute) {
        const result = execute();
        const command = {
            sequence: this.commands.length + 1,
            atMs: this.elapsedMs,
            type,
            expected: ReplayRecorder.summarizeOutcome(type, result)
        };
        this.commands.push(command);
        if (result?.event) {
            this.events.push(ReplayRecorder.summarizeEvent(result.event));
        }
        return result;
    }

    export() {
        const replay = {
            schema: ReplayProtocol.schema(),
            engineVersion: ReplayProtocol.engineVersion(),
            level: this.levelDescriptor,
            geometry: this.geometry,
            durationMs: this.elapsedMs,
            commands: this.commands.map(command => ({
                sequence: command.sequence,
                atMs: command.atMs,
                type: command.type,
                expected: ReplayProtocol.canonicalize(command.expected)
            })),
            final: ReplayRecorder.createFinalSummary(
                this.session,
                this.events
            )
        };
        replay.digest = ReplayProtocol.digest(replay);
        return ReplayProtocol.deepFreeze(replay);
    }

    static summarizeOutcome(type, result) {
        if (type === 'begin-shot') {
            return ReplayProtocol.canonicalize({
                accepted: Boolean(result?.accepted),
                reason: result?.reason || null,
                needleNumber: Number.isFinite(result?.needleNumber)
                    ? result.needleNumber
                    : null
            });
        }
        if (type === 'release-shot-lock') {
            return ReplayProtocol.canonicalize({
                released: Boolean(result?.released),
                reason: result?.reason || null
            });
        }
        if (type === 'resolve-impact') {
            return ReplayProtocol.canonicalize({
                collided: Boolean(result?.collided),
                completed: Boolean(result?.completed),
                needleNumber: result?.needleNumber,
                wheelAngle: result?.wheelAngle,
                collision: result?.collision
                    ? ReplayRecorder.summarizeCollision(result.collision)
                    : null,
                inserted: result?.inserted
                    ? ReplayRecorder.summarizeNeedle(result.inserted)
                    : null
            });
        }
        throw new Error(`Unsupported replay command ${type}`);
    }

    static summarizeEvent(event) {
        const summary = {
            sequence: event.sequence,
            type: event.type
        };
        [
            'needleNumber',
            'remainingCount',
            'insertedCount',
            'wheelAngle'
        ].forEach(key => {
            if (event[key] !== undefined) summary[key] = event[key];
        });
        if (event.needle) {
            summary.needle = ReplayRecorder.summarizeNeedle(event.needle);
        }
        if (event.collision) {
            summary.collision = ReplayRecorder.summarizeCollision(
                event.collision
            );
        }
        return ReplayProtocol.canonicalize(summary);
    }

    static summarizeNeedle(needle) {
        return ReplayProtocol.canonicalize({
            id: needle.id,
            wheelAngle: needle.wheelAngle,
            radius: needle.radius
        });
    }

    static summarizeCollision(collision) {
        return ReplayProtocol.canonicalize({
            collided: Boolean(collision.collided),
            type: collision.type || null,
            targetIndex: Number.isInteger(collision.targetIndex)
                ? collision.targetIndex
                : null,
            targetId: collision.targetId ?? null,
            targetAngle: collision.targetAngle,
            distance: collision.distance
        });
    }

    static createFinalSummary(session, events = []) {
        const snapshot = session.getSnapshot();
        const normalizedEvents = events.map(event => (
            ReplayProtocol.canonicalize(event)
        ));
        return ReplayProtocol.canonicalize({
            status: snapshot.status,
            wheelRotation: snapshot.wheelRotation,
            insertedCount: snapshot.insertedCount,
            remainingCount: snapshot.remainingCount,
            currentNeedleNumber: snapshot.currentNeedleNumber,
            insertedNeedles: snapshot.insertedNeedles.map(needle => (
                ReplayRecorder.summarizeNeedle(needle)
            )),
            events: normalizedEvents,
            eventDigest: ReplayProtocol.hashValue(normalizedEvents)
        });
    }
}
