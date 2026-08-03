class GameSession {
    constructor(levelConfig, options = {}) {
        this.level = GameSession.cloneLevel(levelConfig);
        this.validateLevel(this.level);

        this.impactAngle = Number.isFinite(options.impactAngle)
            ? Number(options.impactAngle)
            : GameSession.defaultImpactAngle();
        this.rhythmManager = options.rhythmManager
            || new RhythmManager(this.level.rhythm, this.level.needleCount);
        this.collisionRules = options.collisionRules
            || new AngularCollisionRules(options.geometry);
        this.wheelRotation = 0;
        this.status = 'ready';
        this.insertedNeedles = [];
        this.obstacles = this.level.layout.obstacleAngles.map((degrees, index) => (
            Object.freeze({
                id: `obstacle-${index + 1}`,
                angle: degrees * Math.PI / 180,
                radius: this.collisionRules.obstacleRadius
            })
        ));
        this.eventSequence = 0;
        this.events = [];
    }

    static cloneLevel(levelConfig) {
        if (!levelConfig || typeof levelConfig !== 'object') {
            throw new Error('GameSession requires a resolved level config');
        }
        return JSON.parse(JSON.stringify(levelConfig));
    }

    static defaultImpactAngle() {
        return typeof CONSTANTS === 'undefined'
            ? Math.PI / 2
            : CONSTANTS.WHEEL.IMPACT_ANGLE;
    }

    validateLevel(level) {
        if (!Number.isInteger(level.needleCount) || level.needleCount <= 0) {
            throw new Error('GameSession level requires a positive needleCount');
        }
        if (!Array.isArray(level.layout?.obstacleAngles)) {
            throw new Error('GameSession level requires obstacleAngles');
        }
        if (!level.rhythm?.segments?.length) {
            throw new Error('GameSession level requires rhythm segments');
        }
    }

    advance(deltaMs) {
        const safeDelta = Math.max(0, Number(deltaMs) || 0);
        if (this.status === 'failed') {
            const rhythm = this.rhythmManager.getSnapshotAt(
                this.rhythmManager.elapsedMs,
                this.insertedNeedles.length
            );
            return Object.freeze({
                rotationDelta: 0,
                rhythm: Object.freeze({ ...rhythm }),
                snapshot: this.getSnapshot()
            });
        }

        const rhythm = this.rhythmManager.advance(safeDelta);
        this.wheelRotation = (
            this.wheelRotation + rhythm.rotationDelta
        ) % (Math.PI * 2);

        return Object.freeze({
            rotationDelta: rhythm.rotationDelta,
            rhythm: Object.freeze({ ...rhythm }),
            snapshot: this.getSnapshot()
        });
    }

    beginShot() {
        if (!this.canShoot()) {
            return Object.freeze({
                accepted: false,
                reason: this.status,
                snapshot: this.getSnapshot()
            });
        }

        const needleNumber = this.getCurrentNeedleNumber();
        this.status = 'in-flight';
        const event = this.emit('shot-started', {
            needleNumber,
            remainingCount: this.getRemainingCount()
        });
        return Object.freeze({
            accepted: true,
            needleNumber,
            event,
            snapshot: this.getSnapshot()
        });
    }

    resolveImpact() {
        if (this.status !== 'in-flight') {
            throw new Error(
                `Cannot resolve impact while session is ${this.status}`
            );
        }

        const wheelAngle = this.normalize(
            this.impactAngle - this.wheelRotation
        );
        const needleNumber = this.getCurrentNeedleNumber();
        const collision = this.collisionRules.checkShot(
            wheelAngle,
            this.insertedNeedles,
            this.obstacles
        );

        if (collision.collided) {
            this.status = 'failed';
            const event = this.emit('collision', {
                needleNumber,
                wheelAngle,
                collision,
                insertedCount: this.insertedNeedles.length
            });
            return Object.freeze({
                collided: true,
                completed: false,
                needleNumber,
                wheelAngle,
                collision,
                event,
                snapshot: this.getSnapshot()
            });
        }

        const inserted = Object.freeze({
            id: needleNumber,
            wheelAngle,
            radius: this.collisionRules.needleRadius
        });
        this.insertedNeedles.push(inserted);
        this.rhythmManager.recordSuccessfulInsert();

        const completed = this.insertedNeedles.length >= this.level.needleCount;
        this.status = completed ? 'completed' : 'locked';
        const event = this.emit(
            completed ? 'level-completed' : 'needle-inserted',
            {
                needle: inserted,
                insertedCount: this.insertedNeedles.length,
                remainingCount: this.getRemainingCount()
            }
        );

        return Object.freeze({
            collided: false,
            completed,
            needleNumber,
            wheelAngle,
            inserted,
            event,
            snapshot: this.getSnapshot()
        });
    }

    releaseShotLock() {
        if (this.status !== 'locked') {
            return Object.freeze({
                released: false,
                reason: this.status,
                snapshot: this.getSnapshot()
            });
        }

        this.status = 'ready';
        const event = this.emit('shot-ready', {
            needleNumber: this.getCurrentNeedleNumber(),
            remainingCount: this.getRemainingCount()
        });
        return Object.freeze({
            released: true,
            event,
            snapshot: this.getSnapshot()
        });
    }

    canShoot() {
        return this.status === 'ready' && this.getRemainingCount() > 0;
    }

    getCurrentNeedleNumber() {
        return Math.max(
            0,
            this.level.needleCount - this.insertedNeedles.length
        );
    }

    getRemainingCount() {
        return Math.max(
            0,
            this.level.needleCount - this.insertedNeedles.length
        );
    }

    getSnapshot() {
        return Object.freeze({
            status: this.status,
            wheelRotation: this.wheelRotation,
            insertedCount: this.insertedNeedles.length,
            remainingCount: this.getRemainingCount(),
            currentNeedleNumber: this.getCurrentNeedleNumber(),
            canShoot: this.canShoot(),
            insertedNeedles: Object.freeze(
                this.insertedNeedles.map(needle => Object.freeze({ ...needle }))
            ),
            obstacles: Object.freeze(
                this.obstacles.map(obstacle => Object.freeze({ ...obstacle }))
            )
        });
    }

    drainEvents() {
        const events = Object.freeze([...this.events]);
        this.events.length = 0;
        return events;
    }

    emit(type, payload = {}) {
        const event = Object.freeze({
            sequence: ++this.eventSequence,
            type,
            ...payload
        });
        this.events.push(event);
        return event;
    }

    normalize(angle) {
        const full = Math.PI * 2;
        return ((Number(angle) % full) + full) % full;
    }
}
