class ScoringProfileResolver {
    static schema() {
        return 'needles.scoring-profile/v2';
    }

    static defaults() {
        return Object.freeze({
            baseInsertPoints: 100,
            precisionClearancePx: 12,
            closeBonus: 60,
            threadedBonus: 180,
            comboStepPoints: 15,
            comboBonusCap: 150,
            comboWindowMs: 3200,
            comboPrecisionGraceMs: 450,
            minimumParTimeMs: 10000,
            parTimePerNeedleMs: 1800,
            parTimePerObstacleMs: 350,
            timeBonusTiers: Object.freeze([
                Object.freeze({ maxRatio: 0.65, points: 500, kind: 'blazing' }),
                Object.freeze({ maxRatio: 0.85, points: 350, kind: 'fast' }),
                Object.freeze({ maxRatio: 1, points: 200, kind: 'par' }),
                Object.freeze({ maxRatio: 1.2, points: 100, kind: 'steady' })
            ])
        });
    }

    static resolve(levelConfig, optionOverrides = {}) {
        if (!levelConfig || typeof levelConfig !== 'object') {
            throw new Error('ScoringProfileResolver requires a level config');
        }

        const defaults = ScoringProfileResolver.defaults();
        const derived = ScoringProfileResolver.derive(levelConfig, defaults);
        const authored = levelConfig.scoring
            && typeof levelConfig.scoring === 'object'
            ? levelConfig.scoring
            : {};
        const options = optionOverrides && typeof optionOverrides === 'object'
            ? optionOverrides
            : {};
        const merged = {
            ...defaults,
            ...derived.rules,
            ...authored,
            ...options
        };
        const timeBonusTiers = ScoringProfileResolver.normalizeTiers(
            merged.timeBonusTiers,
            defaults.timeBonusTiers
        );
        const profile = {
            schema: ScoringProfileResolver.schema(),
            profileId: ScoringProfileResolver.profileId(levelConfig),
            source: Object.keys(authored).length > 0 ? 'authored+derived' : 'derived',
            baseInsertPoints: ScoringProfileResolver.nonNegative(
                merged.baseInsertPoints,
                defaults.baseInsertPoints
            ),
            precisionClearancePx: ScoringProfileResolver.clamp(
                ScoringProfileResolver.nonNegative(
                    merged.precisionClearancePx,
                    defaults.precisionClearancePx
                ),
                0,
                30
            ),
            closeBonus: ScoringProfileResolver.nonNegative(
                merged.closeBonus,
                defaults.closeBonus
            ),
            threadedBonus: ScoringProfileResolver.nonNegative(
                merged.threadedBonus,
                defaults.threadedBonus
            ),
            comboStepPoints: ScoringProfileResolver.nonNegative(
                merged.comboStepPoints,
                defaults.comboStepPoints
            ),
            comboBonusCap: ScoringProfileResolver.nonNegative(
                merged.comboBonusCap,
                defaults.comboBonusCap
            ),
            comboWindowMs: ScoringProfileResolver.clamp(
                ScoringProfileResolver.positive(
                    merged.comboWindowMs,
                    defaults.comboWindowMs
                ),
                800,
                10000
            ),
            comboPrecisionGraceMs: ScoringProfileResolver.clamp(
                ScoringProfileResolver.nonNegative(
                    merged.comboPrecisionGraceMs,
                    defaults.comboPrecisionGraceMs
                ),
                0,
                3000
            ),
            minimumParTimeMs: ScoringProfileResolver.positive(
                merged.minimumParTimeMs,
                defaults.minimumParTimeMs
            ),
            parTimePerNeedleMs: ScoringProfileResolver.positive(
                merged.parTimePerNeedleMs,
                defaults.parTimePerNeedleMs
            ),
            parTimePerObstacleMs: ScoringProfileResolver.nonNegative(
                merged.parTimePerObstacleMs,
                defaults.parTimePerObstacleMs
            ),
            parTimeMs: ScoringProfileResolver.positive(
                merged.parTimeMs,
                derived.rules.parTimeMs
            ),
            timeBonusTiers,
            diagnostics: Object.freeze({ ...derived.diagnostics })
        };
        return ScoringProfileResolver.deepFreeze(profile);
    }

    static derive(level, defaults) {
        const difficulty = level.difficulty || {};
        const averageSpeed = ScoringProfileResolver.firstFinite(
            difficulty.speedExposure?.average,
            ScoringProfileResolver.estimateAverageSpeed(level.rhythm),
            0.55
        );
        const fullRotationMs = averageSpeed > 0
            ? Math.PI * 2 / averageSpeed * 1000
            : 12000;
        const coverageMs = ScoringProfileResolver.firstFinite(
            difficulty.opportunity?.worstCoverageMs,
            difficulty.opportunity?.coverageMs,
            fullRotationMs
        );
        const rhythmPressure = ScoringProfileResolver.clamp(
            ScoringProfileResolver.firstFinite(
                difficulty.pressure?.rhythm,
                difficulty.rhythmDetails?.segmentPressure,
                0
            ),
            0,
            1
        );
        const statePressure = ScoringProfileResolver.clamp(
            ScoringProfileResolver.firstFinite(
                difficulty.pressure?.state,
                level.rhythm?.shotModifier ? 0.4 : 0,
                0
            ),
            0,
            1
        );
        const densityRatio = ScoringProfileResolver.clamp(
            ScoringProfileResolver.firstFinite(
                difficulty.capacity?.densityRatio,
                0.75
            ),
            0.35,
            1.5
        );
        const rating = ScoringProfileResolver.clamp(
            ScoringProfileResolver.firstFinite(difficulty.rating, 5),
            1,
            10
        );
        const needleCount = Math.max(1, Math.round(Number(level.needleCount) || 1));
        const obstacleCount = Array.isArray(level.layout?.obstacleAngles)
            ? level.layout.obstacleAngles.length
            : 0;

        const waitAllowance = ScoringProfileResolver.clamp(
            (coverageMs - 7000) * 0.12,
            -300,
            1100
        );
        const speedAllowance = ScoringProfileResolver.clamp(
            (0.65 - averageSpeed) * 900,
            -450,
            600
        );
        const rhythmAllowance = (rhythmPressure + statePressure) * 350;
        const comboWindowMs = ScoringProfileResolver.roundTo(
            ScoringProfileResolver.clamp(
                defaults.comboWindowMs
                    + waitAllowance
                    + speedAllowance
                    + rhythmAllowance,
                2200,
                5000
            ),
            50
        );
        const comboPrecisionGraceMs = ScoringProfileResolver.roundTo(
            ScoringProfileResolver.clamp(
                300 + rhythmPressure * 250 + statePressure * 200,
                250,
                750
            ),
            50
        );
        const precisionClearancePx = Math.round(
            ScoringProfileResolver.clamp(13 - densityRatio * 3.2, 9, 13)
        );
        const comboStepPoints = Math.round(
            ScoringProfileResolver.clamp(12 + rating * 0.6, 12, 18)
        );
        const opportunityPerNeedleMs = ScoringProfileResolver.clamp(
            coverageMs / 7,
            450,
            2400
        );
        const parTimePerNeedleMs = ScoringProfileResolver.roundTo(
            ScoringProfileResolver.clamp(
                950
                    + opportunityPerNeedleMs
                    + rhythmPressure * 550
                    + statePressure * 350,
                1500,
                3400
            ),
            50
        );
        const parTimeMs = ScoringProfileResolver.roundTo(
            Math.max(
                defaults.minimumParTimeMs,
                needleCount * parTimePerNeedleMs
                    + obstacleCount * defaults.parTimePerObstacleMs
            ),
            100
        );

        return {
            rules: {
                precisionClearancePx,
                comboStepPoints,
                comboWindowMs,
                comboPrecisionGraceMs,
                parTimePerNeedleMs,
                parTimeMs
            },
            diagnostics: {
                averageSpeed: ScoringProfileResolver.roundTo(averageSpeed, 0.001),
                coverageMs: Math.round(coverageMs),
                rhythmPressure: ScoringProfileResolver.roundTo(rhythmPressure, 0.001),
                statePressure: ScoringProfileResolver.roundTo(statePressure, 0.001),
                densityRatio: ScoringProfileResolver.roundTo(densityRatio, 0.001),
                rating
            }
        };
    }

    static profileId(level) {
        const packId = level.packId || 'standalone';
        const levelId = level.packLevelId || level.id || level.order || 'unknown';
        return `${packId}:${levelId}:score-v2`;
    }

    static estimateAverageSpeed(rhythm = {}) {
        const segments = Array.isArray(rhythm?.segments) ? rhythm.segments : [];
        let duration = 0;
        let weighted = 0;
        segments.forEach(segment => {
            const segmentDuration = Math.max(0, Number(segment.durationMs) || 0);
            const velocity = Number.isFinite(segment.velocity)
                ? Math.abs(segment.velocity)
                : (
                    Math.abs(Number(segment.fromVelocity) || 0)
                    + Math.abs(Number(segment.toVelocity) || 0)
                ) / 2;
            duration += segmentDuration;
            weighted += velocity * segmentDuration;
        });
        return duration > 0 ? weighted / duration : 0.55;
    }

    static normalizeTiers(value, fallback) {
        const tiers = Array.isArray(value)
            ? value
                .filter(tier => Number.isFinite(tier?.maxRatio)
                    && Number.isFinite(tier?.points))
                .map(tier => ({
                    maxRatio: Number(tier.maxRatio),
                    points: Math.max(0, Math.round(tier.points)),
                    kind: String(tier.kind || 'timed')
                }))
                .sort((left, right) => left.maxRatio - right.maxRatio)
            : [];
        const source = tiers.length > 0 ? tiers : fallback;
        return Object.freeze(source.map(tier => Object.freeze({ ...tier })));
    }

    static firstFinite(...values) {
        const match = values.find(value => (
            value !== null
            && value !== ''
            && typeof value !== 'boolean'
            && Number.isFinite(Number(value))
        ));
        return match === undefined ? 0 : Number(match);
    }

    static roundTo(value, step) {
        const safeStep = Number(step) || 1;
        return Math.round(Number(value) / safeStep) * safeStep;
    }

    static clamp(value, minimum, maximum) {
        return Math.max(minimum, Math.min(Number(value), maximum));
    }

    static positive(value, fallback) {
        return Number.isFinite(Number(value)) && Number(value) > 0
            ? Number(value)
            : fallback;
    }

    static nonNegative(value, fallback) {
        return Number.isFinite(Number(value)) && Number(value) >= 0
            ? Number(value)
            : fallback;
    }

    static deepFreeze(value) {
        if (!value || typeof value !== 'object' || Object.isFrozen(value)) {
            return value;
        }
        Object.values(value).forEach(item => ScoringProfileResolver.deepFreeze(item));
        return Object.freeze(value);
    }
}
