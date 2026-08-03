class DifficultyModelV2 extends DifficultyManager {
    analyze(level) {
        const base = super.analyze(level);
        const speedExposure = this.getSpeedExposure(level);
        const rhythmDetails = this.getRhythmDetails(level, base.rhythm, speedExposure);
        const comfortableCapacity = Math.max(1, base.capacity.layoutComfortable);
        const densityRatio = level.needleCount / comfortableCapacity;

        const density = Math.pow(
            this.normalize(densityRatio, 0.48, 1.18),
            1.75
        );
        const averageSpeedPressure = Math.pow(
            this.normalize(speedExposure.average, 0.40, 1.05),
            1.80
        );
        const peakSpeedPressure = Math.pow(
            this.normalize(speedExposure.maximum, 0.55, 1.22),
            1.70
        );
        const speed = averageSpeedPressure * 0.58 + peakSpeedPressure * 0.42;

        const rhythm = Math.min(
            1,
            rhythmDetails.segmentPressure * 0.22
                + rhythmDetails.shortPhasePressure * 0.20
                + rhythmDetails.directionPressure * 0.22
                + rhythmDetails.contrastPressure * 0.18
                + rhythmDetails.abruptnessPressure * 0.12
                + base.rhythm.durationIrregularity * 0.06
        );

        const modifier = level.rhythm.shotModifier || {};
        const state = Math.min(
            1,
            (modifier.speedStep ? 0.28 : 0)
                + (modifier.flipEvery ? 0.32 : 0)
                + (modifier.phaseShiftEvery ? 0.36 : 0)
        );
        const zones = Math.min(
            1,
            base.spatial.requiredRatio * 0.55
                + this.normalize(base.spatial.zoneCount, 1, 8) * 0.18
                + base.spatial.imbalance * 0.12
        );
        const prediction = Math.pow(
            this.normalize(base.opportunity.lockRotationDegrees, 7, 22),
            1.50
        );
        const endurance = Math.pow(
            this.normalize(level.needleCount, 10, 19),
            1.40
        );
        const opportunityFriction = base.opportunity.worstCoverageMs === null
            ? 1
            : Math.pow(
                this.normalize(base.opportunity.worstCoverageMs, 7000, 60000),
                1.20
            );

        const core = density * 0.25
            + speed * 0.19
            + rhythm * 0.17
            + zones * 0.08
            + prediction * 0.10
            + state * 0.08
            + endurance * 0.06;
        const interaction = density * speed * 0.07
            + density * zones * 0.04
            + speed * rhythm * 0.04
            + density * state * 0.03;
        const score = Math.min(100, 8 + 90 * Math.min(1, core + interaction));
        const pressures = {
            density,
            speed,
            rhythm,
            zones,
            prediction,
            state,
            endurance
        };
        const labels = {
            density: '密度',
            speed: '转速',
            rhythm: '节奏',
            zones: '分区',
            prediction: '提前量',
            state: '击中后变化',
            endurance: '连续稳定性'
        };
        const drivers = Object.entries(pressures)
            .map(([key, value]) => ({
                key,
                label: labels[key],
                value: Math.round(value * 1000) / 1000
            }))
            .sort((a, b) => b.value - a.value);

        return {
            ...base,
            modelVersion: 'nonlinear-v2',
            score: Math.round(score * 10) / 10,
            rating: Math.max(1, Math.min(10, Math.ceil(score / 10))),
            capacity: {
                ...base.capacity,
                densityRatio
            },
            pressure: {
                ...pressures,
                opportunityFriction,
                interaction: Math.round(interaction * 1000) / 1000
            },
            interactionBonus: Math.round(interaction * 90 * 10) / 10,
            drivers,
            speedExposure,
            rhythmDetails,
            legacyAnalysis: {
                score: base.score,
                pressure: base.pressure
            }
        };
    }

    getSpeedExposure(level) {
        const rhythm = new RhythmManager(level.rhythm, level.needleCount);
        const insertedStates = [...new Set([
            0,
            Math.floor(Math.max(0, level.needleCount - 1) / 2),
            Math.max(0, level.needleCount - 1)
        ])];
        const samplesPerState = 120;
        const speeds = [];

        insertedStates.forEach(insertedCount => {
            for (let index = 0; index < samplesPerState; index++) {
                const elapsedMs = rhythm.cycleDurationMs * index / samplesPerState;
                speeds.push(Math.abs(
                    rhythm.getSnapshotAt(elapsedMs, insertedCount).angularVelocity
                ));
            }
        });

        return {
            minimum: Math.min(...speeds),
            maximum: Math.max(...speeds),
            average: speeds.reduce((sum, speed) => sum + speed, 0) / speeds.length,
            sampledInsertedStates: insertedStates,
            sampleCount: speeds.length
        };
    }

    getRhythmDetails(level, metrics, speedExposure) {
        const segments = level.rhythm.segments;
        const minimumSegmentSeconds = metrics.minimumSegmentMs === null
            ? 4
            : metrics.minimumSegmentMs / 1000;
        const abruptness = this.getMaximumBoundaryJump(level);
        const contrast = speedExposure.maximum - speedExposure.minimum;

        return {
            segmentPressure: Math.pow(
                this.normalize(metrics.segmentCount, 1, 5),
                1.20
            ),
            shortPhasePressure: Math.pow(
                1 - this.normalize(minimumSegmentSeconds, 0.55, 2.0),
                1.30
            ),
            directionPressure: Math.pow(
                this.normalize(metrics.directionChanges, 0, 3),
                0.90
            ),
            contrastPressure: Math.pow(
                this.normalize(contrast, 0.12, 0.80),
                1.20
            ),
            abruptnessPressure: this.normalize(abruptness, 0.30, 1.40),
            abruptness,
            speedContrast: contrast,
            segmentCount: segments.length,
            minimumSegmentMs: metrics.minimumSegmentMs,
            durationIrregularity: metrics.durationIrregularity
        };
    }

    getMaximumBoundaryJump(level) {
        const rhythm = new RhythmManager(level.rhythm, level.needleCount);
        const segments = level.rhythm.segments;
        const insertedStates = [...new Set([
            0,
            Math.floor(Math.max(0, level.needleCount - 1) / 2),
            Math.max(0, level.needleCount - 1)
        ])];
        let maximumJump = 0;

        insertedStates.forEach(insertedCount => {
            segments.forEach((segment, index) => {
                const next = segments[(index + 1) % segments.length];
                const endVelocity = Number.isFinite(segment.velocity)
                    ? segment.velocity
                    : segment.toVelocity;
                const nextVelocity = Number.isFinite(next.velocity)
                    ? next.velocity
                    : next.fromVelocity;
                const adjustedEnd = rhythm.applyShotModifier(
                    endVelocity,
                    insertedCount
                );
                const adjustedNext = rhythm.applyShotModifier(
                    nextVelocity,
                    insertedCount
                );
                maximumJump = Math.max(
                    maximumJump,
                    Math.abs(adjustedEnd - adjustedNext)
                );
            });
        });

        return maximumJump;
    }
}
