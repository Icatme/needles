class DifficultyManager {
    getCapacityMetrics() {
        const ringRadius = CONSTANTS.WHEEL.RADIUS
            + CONSTANTS.NEEDLE.LENGTH
            - CONSTANTS.NEEDLE.INSERT_DEPTH;
        const theoreticalAngle = this.minimumAngle(
            CONSTANTS.NEEDLE.BALL_RADIUS,
            CONSTANTS.NEEDLE.BALL_RADIUS,
            0,
            ringRadius
        );
        const comfortableAngle = this.minimumAngle(
            CONSTANTS.NEEDLE.BALL_RADIUS,
            CONSTANTS.NEEDLE.BALL_RADIUS,
            CONSTANTS.DIFFICULTY.COMFORT_GAP,
            ringRadius
        );
        const comfortableCapacity = Math.floor(Math.PI * 2 / comfortableAngle);

        return {
            ringRadius,
            theoreticalCapacity: Math.floor(Math.PI * 2 / theoreticalAngle),
            comfortableCapacity,
            normalCapacity: Math.floor(
                comfortableCapacity * CONSTANTS.DIFFICULTY.NORMAL_FACTOR
            ),
            theoreticalAngle,
            comfortableAngle
        };
    }

    getLayoutCapacity(obstacleAngles, clearance = 0) {
        const { ringRadius } = this.getCapacityMetrics();
        const needleAngle = this.minimumAngle(
            CONSTANTS.NEEDLE.BALL_RADIUS,
            CONSTANTS.NEEDLE.BALL_RADIUS,
            clearance,
            ringRadius
        );
        const mixedAngle = this.minimumAngle(
            CONSTANTS.NEEDLE.BALL_RADIUS,
            CONSTANTS.OBSTACLE.RADIUS,
            clearance,
            ringRadius
        );

        if (obstacleAngles.length === 0) {
            return {
                total: Math.floor(Math.PI * 2 / needleAngle),
                sectors: [Math.floor(Math.PI * 2 / needleAngle)],
                sectorSpansRadians: [Math.PI * 2],
                freeSectorRadians: [Math.PI * 2],
                usableRadians: Math.PI * 2,
                needleAngle,
                mixedAngle
            };
        }

        const sorted = [...obstacleAngles]
            .sort((a, b) => a - b)
            .map(angle => angle * Math.PI / 180);
        const sectorSpansRadians = sorted.map((angle, index) => {
            const next = sorted[(index + 1) % sorted.length];
            return (next - angle + Math.PI * 2) % (Math.PI * 2) || Math.PI * 2;
        });
        const freeSectorRadians = sectorSpansRadians.map(gap => (
            Math.max(0, gap - mixedAngle * 2)
        ));
        const sectors = freeSectorRadians.map(freeAngle => (
            freeAngle < 0
                ? 0
                : Math.max(0, 1 + Math.floor((freeAngle + 1e-10) / needleAngle))
        ));

        return {
            total: sectors.reduce((sum, count) => sum + count, 0),
            sectors,
            sectorSpansRadians,
            freeSectorRadians,
            usableRadians: freeSectorRadians.reduce((sum, angle) => sum + angle, 0),
            needleAngle,
            mixedAngle
        };
    }

    analyze(level) {
        const capacity = this.getCapacityMetrics();
        const theoreticalLayout = this.getLayoutCapacity(level.layout.obstacleAngles, 0);
        const comfortableLayout = this.getLayoutCapacity(
            level.layout.obstacleAngles,
            CONSTANTS.DIFFICULTY.COMFORT_GAP
        );
        const normalLayoutCapacity = Math.floor(
            comfortableLayout.total * CONSTANTS.DIFFICULTY.NORMAL_FACTOR
        );
        const sectorCapacities = theoreticalLayout.sectors.map((theoretical, index) => ({
            index: index + 1,
            spanDegrees: theoreticalLayout.sectorSpansRadians[index] * 180 / Math.PI,
            theoretical,
            comfortable: comfortableLayout.sectors[index]
        }));
        const rhythm = new RhythmManager(level.rhythm, level.needleCount);
        const rhythmMetrics = rhythm.getMetrics();
        const shotCoverageTimes = [];

        for (let insertedCount = 0; insertedCount < level.needleCount; insertedCount++) {
            shotCoverageTimes.push(rhythm.getWorstCoverageTime(
                insertedCount,
                CONSTANTS.DIFFICULTY.MAX_COVERAGE_MS,
                20
            ));
        }

        const allShotStatesReachable = shotCoverageTimes.every(Number.isFinite);
        const worstPhaseCoverageMs = allShotStatesReachable
            ? Math.max(...shotCoverageTimes)
            : null;
        const worstCoverageMs = worstPhaseCoverageMs;
        const spatial = this.getSpatialMetrics(
            level.needleCount,
            comfortableLayout
        );
        const maximumSpeed = rhythmMetrics.maximumSpeed;
        const averageSpacing = theoreticalLayout.usableRadians / level.needleCount;
        const legalWindowRadians = Math.max(
            0,
            averageSpacing - theoreticalLayout.needleAngle
        );
        const estimatedReactionWindowMs = maximumSpeed === 0
            ? Infinity
            : legalWindowRadians / maximumSpeed * 1000;
        const flightDistance = CONSTANTS.NEEDLE.READY_Y
            - (
                CONSTANTS.WHEEL.CENTER_Y
                + capacity.ringRadius
            );
        const actionCycleMs = flightDistance / CONSTANTS.NEEDLE.FLY_SPEED * 1000
            + CONSTANTS.DIFFICULTY.INSERT_LOCK_MS;
        const lockRotationDegrees = maximumSpeed * actionCycleMs / 1000 * 180 / Math.PI;
        const densityRatio = level.needleCount / Math.max(1, normalLayoutCapacity);
        const cycleLearning = rhythmMetrics.cycleDurationMs === 0
            ? 0
            : this.normalize(rhythmMetrics.cycleDurationMs, 1800, 9000);
        const rhythmPressure = (
            this.normalize(
                rhythmMetrics.complexity,
                0,
                CONSTANTS.DIFFICULTY.MAX_COMPLEXITY
            ) * 0.55
            + cycleLearning * 0.25
            + rhythmMetrics.durationIrregularity * 0.20
        );
        const pressure = {
            geometry: this.normalize(densityRatio, 0.25, 1),
            reaction: 1 - this.normalize(estimatedReactionWindowMs, 100, 500),
            rhythm: rhythmPressure,
            zones: spatial.pressure,
            coverage: worstCoverageMs === null
                ? 1
                : this.normalize(worstCoverageMs, 7000, CONSTANTS.DIFFICULTY.MAX_COVERAGE_MS),
            coupling: this.normalize(lockRotationDegrees, 5, 22),
            endurance: this.normalize(
                level.needleCount,
                CONSTANTS.DIFFICULTY.MIN_NEEDLES,
                capacity.normalCapacity
            )
        };
        const weighted = pressure.geometry * 0.30
            + pressure.reaction * 0.22
            + pressure.rhythm * 0.16
            + pressure.zones * 0.12
            + pressure.coverage * 0.08
            + pressure.coupling * 0.07
            + pressure.endurance * 0.05;
        const score = Math.min(
            100,
            (weighted + pressure.geometry * pressure.reaction * 0.05) * 100
        );

        return {
            score: Math.round(score * 10) / 10,
            rating: Math.max(1, Math.min(10, Math.ceil(score / 10))),
            capacity: {
                ...capacity,
                layoutTheoretical: theoreticalLayout.total,
                layoutComfortable: comfortableLayout.total,
                layoutNormal: normalLayoutCapacity,
                sectorCapacities,
                densityRatio
            },
            spatial,
            rhythm: rhythmMetrics,
            opportunity: {
                shotCoverageTimes,
                allShotStatesReachable,
                worstPhaseCoverageMs,
                worstCoverageMs,
                estimatedReactionWindowMs,
                actionCycleMs,
                lockRotationDegrees
            },
            pressure
        };
    }

    validate(level) {
        const errors = [];
        let analysis;

        try {
            analysis = this.analyze(level);
        } catch (error) {
            return { valid: false, errors: [error.message], analysis: null };
        }

        if (level.needleCount > analysis.capacity.layoutTheoretical) {
            errors.push(
                `待插 ${level.needleCount} 针超过该布局理论容量 ${analysis.capacity.layoutTheoretical}`
            );
        }
        if (!analysis.opportunity.allShotStatesReachable) {
            errors.push('至少一个插针状态无法覆盖完整圆周');
        }
        if (analysis.opportunity.worstPhaseCoverageMs === null) {
            errors.push('至少一个循环起始相位无法覆盖完整圆周');
        }
        if (
            analysis.rhythm.minimumSegmentMs !== null
            && analysis.rhythm.minimumSegmentMs < CONSTANTS.DIFFICULTY.MIN_SEGMENT_MS
        ) {
            errors.push(`节奏分段短于 ${CONSTANTS.DIFFICULTY.MIN_SEGMENT_MS}ms`);
        }
        if (analysis.rhythm.maximumSpeed > CONSTANTS.DIFFICULTY.MAX_SPEED) {
            errors.push(`最大速度超过 ${CONSTANTS.DIFFICULTY.MAX_SPEED}rad/s`);
        }

        const angles = level.layout.obstacleAngles;
        const obstacleSeparation = this.minimumAngle(
            CONSTANTS.OBSTACLE.RADIUS,
            CONSTANTS.OBSTACLE.RADIUS,
            CONSTANTS.DIFFICULTY.COMFORT_GAP,
            analysis.capacity.ringRadius
        ) * 180 / Math.PI;

        angles.forEach(angle => {
            if (!(angle >= 0 && angle < 360)) {
                errors.push(`障碍角度 ${angle} 不在 0–360° 内`);
            }
            if (this.circularDistance(angle, 90) < CONSTANTS.DIFFICULTY.OPENING_CLEARANCE_DEGREES) {
                errors.push(`障碍角度 ${angle} 过于靠近初始发射点`);
            }
        });

        for (let i = 0; i < angles.length; i++) {
            for (let j = i + 1; j < angles.length; j++) {
                if (this.circularDistance(angles[i], angles[j]) < obstacleSeparation) {
                    errors.push(`障碍 ${angles[i]}° 与 ${angles[j]}° 没有舒适间距`);
                }
            }
        }

        return { valid: errors.length === 0, errors, analysis };
    }

    getSpatialMetrics(needleCount, comfortableLayout) {
        const capacities = comfortableLayout.sectors;
        const sorted = [...capacities].sort((a, b) => b - a);
        let accumulated = 0;
        let requiredZones = 0;

        for (const capacity of sorted) {
            if (accumulated >= needleCount) break;
            accumulated += capacity;
            requiredZones++;
        }

        const total = capacities.reduce((sum, capacity) => sum + capacity, 0);
        const entropy = capacities.length <= 1 || total === 0
            ? 1
            : -capacities.reduce((sum, capacity) => {
                if (capacity === 0) return sum;
                const probability = capacity / total;
                return sum + probability * Math.log(probability);
            }, 0) / Math.log(capacities.length);
        const zoneCount = capacities.length;
        const requiredRatio = zoneCount <= 1
            ? 0
            : (requiredZones - 1) / (zoneCount - 1);
        const zoneCountPressure = this.normalize(
            zoneCount,
            1,
            CONSTANTS.DIFFICULTY.MAX_ZONES
        );

        return {
            zoneCount,
            requiredZones,
            requiredRatio,
            capacityEntropy: entropy,
            imbalance: 1 - entropy,
            minimumFreeSectorDegrees: Math.min(...comfortableLayout.freeSectorRadians)
                * 180 / Math.PI,
            pressure: requiredRatio * 0.65
                + zoneCountPressure * 0.25
                + (1 - entropy) * 0.10
        };
    }

    minimumAngle(radiusA, radiusB, clearance, ringRadius) {
        return 2 * Math.asin((radiusA + radiusB + clearance) / (ringRadius * 2));
    }

    circularDistance(a, b) {
        const difference = Math.abs(a - b) % 360;
        return Math.min(difference, 360 - difference);
    }

    normalize(value, minimum, maximum) {
        return Math.max(0, Math.min((value - minimum) / (maximum - minimum), 1));
    }
}
