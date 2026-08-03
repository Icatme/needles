class RhythmManager {
    constructor(config, needleCount = 0) {
        this.config = config;
        this.needleCount = needleCount;
        this.validateConfig();
        this.cycleDurationMs = this.config.segments.reduce(
            (total, segment) => total + segment.durationMs,
            0
        );
        this.reset();
    }

    validateConfig() {
        if (!this.config || !Array.isArray(this.config.segments) || this.config.segments.length === 0) {
            throw new Error('节奏配置至少需要一个分段');
        }

        this.config.segments.forEach((segment, index) => {
            const hasVelocity = Number.isFinite(segment.velocity);
            const hasRamp = Number.isFinite(segment.fromVelocity)
                && Number.isFinite(segment.toVelocity);

            if (!(segment.durationMs > 0)) {
                throw new Error(`节奏分段 ${index + 1} 的持续时间必须大于 0`);
            }
            if (hasVelocity === hasRamp) {
                throw new Error(`节奏分段 ${index + 1} 必须定义 velocity 或速度区间`);
            }
            if (segment.easing && !['linear', 'sine'].includes(segment.easing)) {
                throw new Error(`节奏分段 ${index + 1} 使用了未知缓动`);
            }
        });

        if (
            this.config.shotModifier?.speedStep
            && this.config.segments.some(segment => !Number.isFinite(segment.velocity))
        ) {
            throw new Error('逐针加速只能用于定速分段');
        }

        const modifier = this.config.shotModifier;
        if (!modifier) return;

        ['flipEvery', 'phaseShiftEvery'].forEach(field => {
            if (field in modifier && (!Number.isInteger(modifier[field]) || modifier[field] <= 0)) {
                throw new Error(`${field} 必须是正整数`);
            }
        });
        if ('speedStep' in modifier && !(modifier.speedStep > 0)) {
            throw new Error('speedStep 必须大于 0');
        }
        if (modifier.speedStep && !(modifier.maxAbsSpeed > 0)) {
            throw new Error('逐针加速必须定义大于 0 的 maxAbsSpeed');
        }
        if (modifier.phaseShiftEvery && !Number.isFinite(modifier.phaseShiftMs)) {
            throw new Error('移相节奏必须定义 phaseShiftMs');
        }
    }

    reset() {
        this.elapsedMs = 0;
        this.successfulInserts = 0;
        this.lastDirection = Math.sign(this.getSnapshotAt(0, 0).angularVelocity) || 1;
    }

    recordSuccessfulInsert() {
        this.successfulInserts++;
    }

    advance(deltaMs) {
        const safeDelta = Math.max(0, deltaMs);
        const startMs = this.elapsedMs;
        const endMs = startMs + safeDelta;
        const rotationDelta = this.integrate(startMs, endMs, this.successfulInserts);
        this.elapsedMs = endMs;

        const snapshot = this.getSnapshotAt(this.elapsedMs, this.successfulInserts);
        if (snapshot.angularVelocity !== 0) {
            this.lastDirection = Math.sign(snapshot.angularVelocity);
        }

        return {
            ...snapshot,
            direction: this.lastDirection,
            rotationDelta
        };
    }

    getSnapshotAt(elapsedMs = 0, insertedCount = 0) {
        const safeElapsed = Math.max(0, elapsedMs);
        const safeInserted = Math.max(0, insertedCount);
        const patternElapsed = safeElapsed + this.getPatternOffset(safeInserted);
        const segmentState = this.getSegmentState(patternElapsed);
        const rawVelocity = this.getSegmentVelocity(
            segmentState.segment,
            segmentState.segmentProgress
        );
        const angularVelocity = this.applyShotModifier(rawVelocity, safeInserted);

        return {
            angularVelocity,
            direction: Math.sign(angularVelocity) || 1,
            cyclePhase: segmentState.cycleProgress,
            segmentIndex: segmentState.index,
            segmentPhase: segmentState.segmentProgress,
            shotPhase: this.getShotPhase(safeInserted),
            displayPhase: this.getDisplayPhase(segmentState, safeInserted)
        };
    }

    getSegmentState(elapsedMs) {
        const cycleElapsed = elapsedMs % this.cycleDurationMs;
        let segmentStart = 0;

        for (let index = 0; index < this.config.segments.length; index++) {
            const segment = this.config.segments[index];
            const segmentEnd = segmentStart + segment.durationMs;

            if (cycleElapsed < segmentEnd || index === this.config.segments.length - 1) {
                return {
                    segment,
                    index,
                    segmentElapsedMs: cycleElapsed - segmentStart,
                    segmentProgress: (cycleElapsed - segmentStart) / segment.durationMs,
                    cycleProgress: cycleElapsed / this.cycleDurationMs
                };
            }

            segmentStart = segmentEnd;
        }
    }

    getSegmentVelocity(segment, progress) {
        if (Number.isFinite(segment.velocity)) {
            return segment.velocity;
        }

        const eased = segment.easing === 'sine'
            ? (1 - Math.cos(Math.PI * progress)) / 2
            : progress;
        return segment.fromVelocity
            + (segment.toVelocity - segment.fromVelocity) * eased;
    }

    applyShotModifier(velocity, insertedCount) {
        const modifier = this.config.shotModifier;
        if (!modifier) return velocity;

        let adjusted = velocity;

        if (modifier.speedStep) {
            const magnitude = Math.min(
                Math.abs(adjusted) + modifier.speedStep * insertedCount,
                modifier.maxAbsSpeed
            );
            adjusted = (Math.sign(adjusted) || 1) * magnitude;
        }

        if (modifier.flipEvery) {
            const flips = Math.floor(insertedCount / modifier.flipEvery);
            if (flips % 2 === 1) adjusted *= -1;
        }

        return adjusted;
    }

    integrate(startMs, endMs, insertedCount = 0) {
        const patternOffset = this.getPatternOffset(insertedCount);
        let cursor = startMs + patternOffset;
        const patternEnd = endMs + patternOffset;
        let rotation = 0;

        while (cursor < patternEnd) {
            const state = this.getSegmentState(cursor);
            const availableMs = state.segment.durationMs - state.segmentElapsedMs;
            const chunkMs = Math.min(availableMs, patternEnd - cursor);
            rotation += this.integrateSegment(
                state.segment,
                state.segmentElapsedMs,
                state.segmentElapsedMs + chunkMs,
                insertedCount
            );
            cursor += chunkMs;
        }

        return rotation;
    }

    getPatternOffset(insertedCount) {
        const modifier = this.config.shotModifier;
        if (!modifier?.phaseShiftEvery) return 0;

        return Math.floor(insertedCount / modifier.phaseShiftEvery)
            * modifier.phaseShiftMs;
    }

    integrateSegment(segment, startOffsetMs, endOffsetMs, insertedCount) {
        const durationSeconds = segment.durationMs / 1000;
        const start = startOffsetMs / segment.durationMs;
        const end = endOffsetMs / segment.durationMs;

        if (Number.isFinite(segment.velocity)) {
            const velocity = this.applyShotModifier(segment.velocity, insertedCount);
            return velocity * (endOffsetMs - startOffsetMs) / 1000;
        }

        const from = segment.fromVelocity;
        const difference = segment.toVelocity - from;
        let rawIntegral;

        if (segment.easing === 'sine') {
            const midpoint = from + difference / 2;
            rawIntegral = midpoint * (end - start)
                - difference / (2 * Math.PI)
                * (Math.sin(Math.PI * end) - Math.sin(Math.PI * start));
        } else {
            rawIntegral = from * (end - start)
                + difference * (end * end - start * start) / 2;
        }

        const flipEvery = this.config.shotModifier?.flipEvery;
        const flip = flipEvery && Math.floor(insertedCount / flipEvery) % 2 === 1 ? -1 : 1;
        return rawIntegral * durationSeconds * flip;
    }

    getDisplayPhase(segmentState, insertedCount) {
        const hasTimePattern = this.config.segments.length > 1
            || !Number.isFinite(this.config.segments[0].velocity);

        if (hasTimePattern) return segmentState.cycleProgress;

        const shotPhase = this.getShotPhase(insertedCount);
        return shotPhase === null ? null : shotPhase;
    }

    getShotPhase(insertedCount) {
        const modifier = this.config.shotModifier;
        if (!modifier) return null;

        if (modifier.flipEvery) {
            return (insertedCount % modifier.flipEvery) / modifier.flipEvery;
        }

        if (modifier.speedStep) {
            return Math.min(insertedCount / Math.max(1, this.needleCount - 1), 1);
        }

        if (modifier.phaseShiftEvery) {
            return (insertedCount % modifier.phaseShiftEvery) / modifier.phaseShiftEvery;
        }

        return null;
    }

    getMetrics() {
        const segments = this.config.segments;
        let directionChanges = 0;
        let speedChanges = 0;
        let curveChanges = 0;

        segments.forEach((segment, index) => {
            const next = segments[(index + 1) % segments.length];
            const startVelocity = Number.isFinite(segment.velocity)
                ? segment.velocity
                : segment.fromVelocity;
            const endVelocity = Number.isFinite(segment.velocity)
                ? segment.velocity
                : segment.toVelocity;
            const nextVelocity = Number.isFinite(next.velocity)
                ? next.velocity
                : next.fromVelocity;

            if (startVelocity * endVelocity < 0) directionChanges++;
            if (segments.length > 1 && Math.sign(endVelocity) !== Math.sign(nextVelocity)) {
                directionChanges++;
            }
            if (Math.abs(startVelocity) !== Math.abs(endVelocity)) speedChanges++;
            if (segments.length > 1 && Math.abs(endVelocity) !== Math.abs(nextVelocity)) {
                speedChanges++;
            }
            if (!Number.isFinite(segment.velocity)) curveChanges++;
        });

        const modifier = this.config.shotModifier;
        const modifierCount = modifier
            ? [modifier.flipEvery, modifier.speedStep, modifier.phaseShiftEvery].filter(Boolean).length
            : 0;
        const complexity = Math.max(0, segments.length - 1)
            + directionChanges * 1.5
            + speedChanges * 0.75
            + curveChanges
            + modifierCount * 1.25;
        const sampleStepMs = 10;
        let speedTotal = 0;
        let minimumSpeed = Infinity;
        let maximumSpeed = 0;
        let samples = 0;

        for (let elapsedMs = 0; elapsedMs < this.cycleDurationMs; elapsedMs += sampleStepMs) {
            const speed = Math.abs(this.getSnapshotAt(elapsedMs, 0).angularVelocity);
            speedTotal += speed;
            minimumSpeed = Math.min(minimumSpeed, speed);
            maximumSpeed = Math.max(maximumSpeed, speed);
            samples++;
        }

        if (this.config.shotModifier?.maxAbsSpeed) {
            maximumSpeed = Math.max(maximumSpeed, this.config.shotModifier.maxAbsSpeed);
        }

        const hasTimePattern = segments.length > 1
            || segments.some(segment => !Number.isFinite(segment.velocity));
        const durations = segments.map(segment => segment.durationMs);
        const meanDuration = this.cycleDurationMs / durations.length;
        const durationVariance = durations.reduce((sum, duration) => (
            sum + (duration - meanDuration) ** 2
        ), 0) / durations.length;
        const durationIrregularity = meanDuration === 0
            ? 0
            : Math.min(Math.sqrt(durationVariance) / meanDuration, 1);

        return {
            cycleDurationMs: hasTimePattern ? this.cycleDurationMs : 0,
            segmentCount: segments.length,
            directionChanges,
            speedChanges,
            curveChanges,
            modifierCount,
            complexity,
            durationIrregularity,
            minimumSegmentMs: hasTimePattern
                ? Math.min(...segments.map(segment => segment.durationMs))
                : null,
            minimumSpeed,
            maximumSpeed,
            averageSpeed: speedTotal / samples,
            netCycleAngle: this.integrate(0, this.cycleDurationMs, 0)
        };
    }

    getCoverageTime(
        insertedCount = 0,
        maxDurationMs = 90000,
        stepMs = 10,
        startOffsetMs = 0
    ) {
        let angle = 0;
        let minimum = 0;
        let maximum = 0;

        for (let elapsedMs = 0; elapsedMs <= maxDurationMs; elapsedMs += stepMs) {
            angle += this.integrate(
                startOffsetMs + elapsedMs,
                startOffsetMs + elapsedMs + stepMs,
                insertedCount
            );
            minimum = Math.min(minimum, angle);
            maximum = Math.max(maximum, angle);

            if (maximum - minimum >= Math.PI * 2) {
                return elapsedMs + stepMs;
            }
        }

        return null;
    }

    getWorstCoverageTime(insertedCount = 0, maxDurationMs = 90000, stepMs = 20) {
        const hasTimePattern = this.config.segments.length > 1
            || this.config.segments.some(segment => !Number.isFinite(segment.velocity));
        if (!hasTimePattern) {
            return this.getCoverageTime(insertedCount, maxDurationMs, stepMs, 0);
        }

        const offsets = Array.from(
            { length: 8 },
            (_, index) => this.cycleDurationMs * index / 8
        );
        let segmentStart = 0;

        this.config.segments.forEach(segment => {
            offsets.push(segmentStart, segmentStart + segment.durationMs / 2);
            segmentStart += segment.durationMs;
        });

        let worstTime = 0;
        for (const offset of [...new Set(offsets)]) {
            const coverageTime = this.getCoverageTime(
                insertedCount,
                maxDurationMs,
                stepMs,
                offset
            );
            if (coverageTime === null) return null;
            worstTime = Math.max(worstTime, coverageTime);
        }

        return worstTime;
    }
}
