class AngularCollisionRules {
    constructor(options = {}) {
        this.ringRadius = this.positive(
            options.ringRadius,
            AngularCollisionRules.defaultRingRadius()
        );
        this.needleRadius = this.positive(
            options.needleRadius,
            AngularCollisionRules.defaultNeedleRadius()
        );
        this.obstacleRadius = this.positive(
            options.obstacleRadius,
            AngularCollisionRules.defaultObstacleRadius()
        );
    }

    static defaultRingRadius() {
        if (typeof CONSTANTS === 'undefined') return 172;
        return CONSTANTS.WHEEL.RADIUS
            + CONSTANTS.NEEDLE.LENGTH
            - CONSTANTS.NEEDLE.INSERT_DEPTH;
    }

    static defaultNeedleRadius() {
        return typeof CONSTANTS === 'undefined'
            ? 15
            : CONSTANTS.NEEDLE.BALL_RADIUS;
    }

    static defaultObstacleRadius() {
        return typeof CONSTANTS === 'undefined'
            ? 17
            : CONSTANTS.OBSTACLE.RADIUS;
    }

    checkShot(wheelAngle, insertedNeedles = [], obstacles = []) {
        for (let index = 0; index < insertedNeedles.length; index++) {
            const needle = insertedNeedles[index];
            const angle = this.angleOf(needle);
            const radius = this.radiusOf(needle, this.needleRadius);
            if (this.collides(
                wheelAngle,
                this.needleRadius,
                angle,
                radius
            )) {
                return Object.freeze({
                    collided: true,
                    type: 'needle',
                    targetIndex: index,
                    targetId: needle?.id ?? index,
                    targetAngle: angle,
                    distance: this.chordDistance(wheelAngle, angle)
                });
            }
        }

        for (let index = 0; index < obstacles.length; index++) {
            const obstacle = obstacles[index];
            const angle = this.angleOf(obstacle);
            const radius = this.radiusOf(obstacle, this.obstacleRadius);
            if (this.collides(
                wheelAngle,
                this.needleRadius,
                angle,
                radius
            )) {
                return Object.freeze({
                    collided: true,
                    type: 'obstacle',
                    targetIndex: index,
                    targetId: obstacle?.id ?? index,
                    targetAngle: angle,
                    distance: this.chordDistance(wheelAngle, angle)
                });
            }
        }

        return Object.freeze({ collided: false });
    }

    collides(angleA, radiusA, angleB, radiusB) {
        return this.chordDistance(angleA, angleB) < radiusA + radiusB;
    }

    chordDistance(angleA, angleB) {
        const delta = this.circularDistance(angleA, angleB);
        return 2 * this.ringRadius * Math.sin(delta / 2);
    }

    circularDistance(angleA, angleB) {
        const full = Math.PI * 2;
        const difference = Math.abs(
            this.normalize(angleA) - this.normalize(angleB)
        );
        return Math.min(difference, full - difference);
    }

    minimumAngle(radiusA = this.needleRadius, radiusB = this.needleRadius) {
        return 2 * Math.asin((radiusA + radiusB) / (this.ringRadius * 2));
    }

    normalize(angle) {
        const full = Math.PI * 2;
        return ((Number(angle) % full) + full) % full;
    }

    angleOf(value) {
        if (Number.isFinite(value)) return Number(value);
        if (Number.isFinite(value?.wheelAngle)) return Number(value.wheelAngle);
        if (Number.isFinite(value?.angle)) return Number(value.angle);
        throw new Error('Collision object requires angle or wheelAngle');
    }

    radiusOf(value, fallback) {
        return this.positive(value?.radius, fallback);
    }

    positive(value, fallback) {
        return Number.isFinite(value) && value > 0 ? Number(value) : fallback;
    }
}
