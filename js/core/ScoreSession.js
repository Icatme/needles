class ScoreSession {
    constructor(levelConfig, options = {}) {
        this.level = ScoreSession.cloneLevel(levelConfig);
        this.enabled = options.enabled !== false;
        this.rules = ScoreSession.resolveRules(
            this.level.scoring,
            options.rules
        );
        this.parTimeMs = ScoreSession.resolveParTimeMs(
            this.level,
            options.parTimeMs,
            this.rules
        );
        this.status = 'idle';
        this.elapsedMs = 0;
        this.score = 0;
        this.combo = 0;
        this.maxCombo = 0;
        this.insertedCount = 0;
        this.breakdown = {
            base: 0,
            precision: 0,
            combo: 0,
            time: 0
        };
        this.precisionCounts = {
            close: 0,
            threaded: 0
        };
        this.completionAward = null;
    }

    static cloneLevel(levelConfig) {
        if (!levelConfig || typeof levelConfig !== 'object') {
            throw new Error('ScoreSession requires a level config');
        }
        return JSON.parse(JSON.stringify(levelConfig));
    }

    static defaultRules() {
        return {
            baseInsertPoints: 100,
            precisionClearancePx: 12,
            closeBonus: 60,
            threadedBonus: 180,
            comboStepPoints: 15,
            comboBonusCap: 150,
            minimumParTimeMs: 10000,
            parTimePerNeedleMs: 1800,
            parTimePerObstacleMs: 350,
            timeBonusTiers: [
                { maxRatio: 0.65, points: 500, kind: 'blazing' },
                { maxRatio: 0.85, points: 350, kind: 'fast' },
                { maxRatio: 1, points: 200, kind: 'par' },
                { maxRatio: 1.2, points: 100, kind: 'steady' }
            ]
        };
    }

    static resolveRules(levelRules = {}, optionRules = {}) {
        const defaults = ScoreSession.defaultRules();
        const merged = {
            ...defaults,
            ...(levelRules && typeof levelRules === 'object' ? levelRules : {}),
            ...(optionRules && typeof optionRules === 'object' ? optionRules : {})
        };
        const tiers = Array.isArray(merged.timeBonusTiers)
            ? merged.timeBonusTiers
                .filter(tier => Number.isFinite(tier?.maxRatio)
                    && Number.isFinite(tier?.points))
                .map(tier => Object.freeze({
                    maxRatio: Number(tier.maxRatio),
                    points: Math.max(0, Math.round(tier.points)),
                    kind: String(tier.kind || 'timed')
                }))
                .sort((a, b) => a.maxRatio - b.maxRatio)
            : defaults.timeBonusTiers.map(tier => Object.freeze({ ...tier }));

        return Object.freeze({
            baseInsertPoints: ScoreSession.nonNegative(
                merged.baseInsertPoints,
                defaults.baseInsertPoints
            ),
            precisionClearancePx: ScoreSession.nonNegative(
                merged.precisionClearancePx,
                defaults.precisionClearancePx
            ),
            closeBonus: ScoreSession.nonNegative(
                merged.closeBonus,
                defaults.closeBonus
            ),
            threadedBonus: ScoreSession.nonNegative(
                merged.threadedBonus,
                defaults.threadedBonus
            ),
            comboStepPoints: ScoreSession.nonNegative(
                merged.comboStepPoints,
                defaults.comboStepPoints
            ),
            comboBonusCap: ScoreSession.nonNegative(
                merged.comboBonusCap,
                defaults.comboBonusCap
            ),
            minimumParTimeMs: ScoreSession.positive(
                merged.minimumParTimeMs,
                defaults.minimumParTimeMs
            ),
            parTimePerNeedleMs: ScoreSession.positive(
                merged.parTimePerNeedleMs,
                defaults.parTimePerNeedleMs
            ),
            parTimePerObstacleMs: ScoreSession.nonNegative(
                merged.parTimePerObstacleMs,
                defaults.parTimePerObstacleMs
            ),
            timeBonusTiers: Object.freeze(tiers)
        });
    }

    static resolveParTimeMs(level, optionValue, rules) {
        const authored = Number(level?.scoring?.parTimeMs);
        const explicit = Number(optionValue);
        if (Number.isFinite(explicit) && explicit > 0) return explicit;
        if (Number.isFinite(authored) && authored > 0) return authored;

        const needleCount = Math.max(1, Number(level?.needleCount) || 1);
        const obstacleCount = Array.isArray(level?.layout?.obstacleAngles)
            ? level.layout.obstacleAngles.length
            : 0;
        return Math.max(
            rules.minimumParTimeMs,
            needleCount * rules.parTimePerNeedleMs
                + obstacleCount * rules.parTimePerObstacleMs
        );
    }

    start() {
        if (this.status === 'idle') this.status = 'running';
        return this.getSnapshot();
    }

    advance(deltaMs) {
        if (this.status === 'running') {
            this.elapsedMs += Math.max(0, Number(deltaMs) || 0);
        }
        return this.getSnapshot();
    }

    recordInsertion(placement = null) {
        if (this.status === 'idle') this.start();
        if (this.status !== 'running') {
            throw new Error(`Cannot score insertion while session is ${this.status}`);
        }

        this.insertedCount++;
        this.combo++;
        this.maxCombo = Math.max(this.maxCombo, this.combo);

        const precision = this.evaluatePrecision(placement);
        const basePoints = this.enabled ? this.rules.baseInsertPoints : 0;
        const precisionPoints = this.enabled ? precision.bonus : 0;
        const comboPoints = this.enabled
            ? Math.min(
                Math.max(0, this.combo - 1) * this.rules.comboStepPoints,
                this.rules.comboBonusCap
            )
            : 0;
        const points = basePoints + precisionPoints + comboPoints;

        this.breakdown.base += basePoints;
        this.breakdown.precision += precisionPoints;
        this.breakdown.combo += comboPoints;
        this.score += points;
        if (precision.kind === 'close' || precision.kind === 'threaded') {
            this.precisionCounts[precision.kind]++;
        }

        return Object.freeze({
            type: 'insertion-score',
            enabled: this.enabled,
            points,
            basePoints,
            precisionPoints,
            comboPoints,
            totalScore: this.score,
            combo: this.combo,
            maxCombo: this.maxCombo,
            precision,
            comboMilestone: ScoreSession.comboMilestone(this.combo),
            snapshot: this.getSnapshot()
        });
    }

    fail() {
        if (this.status === 'completed') return this.getSnapshot();
        this.status = 'failed';
        this.combo = 0;
        return this.getSnapshot();
    }

    complete() {
        if (this.completionAward) return this.completionAward;
        if (this.status === 'idle') this.start();
        if (this.status === 'failed') {
            throw new Error('Cannot complete a failed score session');
        }

        const timeBonus = this.evaluateTimeBonus();
        const points = this.enabled ? timeBonus.points : 0;
        this.breakdown.time += points;
        this.score += points;
        this.status = 'completed';
        this.completionAward = Object.freeze({
            type: 'completion-score',
            enabled: this.enabled,
            points,
            totalScore: this.score,
            elapsedMs: this.elapsedMs,
            parTimeMs: this.parTimeMs,
            timeBonus: Object.freeze({
                ...timeBonus,
                points
            }),
            snapshot: this.getSnapshot()
        });
        return this.completionAward;
    }

    evaluatePrecision(placement) {
        const sides = ['clockwise', 'counterClockwise'];
        const nearSides = sides.filter(side => {
            const clearance = placement?.nearest?.[side]?.clearance;
            return Number.isFinite(clearance)
                && clearance >= 0
                && clearance <= this.rules.precisionClearancePx;
        });
        const clearances = nearSides.map(side => (
            placement.nearest[side].clearance
        ));
        const kind = nearSides.length === 2
            ? 'threaded'
            : (nearSides.length === 1 ? 'close' : 'clear');
        const bonus = kind === 'threaded'
            ? this.rules.threadedBonus
            : (kind === 'close' ? this.rules.closeBonus : 0);

        return Object.freeze({
            kind,
            bonus,
            sides: Object.freeze([...nearSides]),
            closestClearancePx: clearances.length > 0
                ? Math.min(...clearances)
                : null,
            thresholdPx: this.rules.precisionClearancePx
        });
    }

    evaluateTimeBonus() {
        const ratio = this.parTimeMs > 0
            ? this.elapsedMs / this.parTimeMs
            : Infinity;
        const tier = this.rules.timeBonusTiers.find(candidate => (
            ratio <= candidate.maxRatio
        ));
        return Object.freeze({
            kind: tier?.kind || 'none',
            points: tier?.points || 0,
            ratio
        });
    }

    getSnapshot() {
        return Object.freeze({
            enabled: this.enabled,
            status: this.status,
            score: this.score,
            combo: this.combo,
            maxCombo: this.maxCombo,
            insertedCount: this.insertedCount,
            elapsedMs: this.elapsedMs,
            parTimeMs: this.parTimeMs,
            breakdown: Object.freeze({ ...this.breakdown }),
            precisionCounts: Object.freeze({ ...this.precisionCounts })
        });
    }

    static comboMilestone(combo) {
        if (combo === 3) return 'triple';
        if (combo === 5) return 'hot';
        if (combo === 8) return 'unstoppable';
        if (combo >= 10 && combo % 5 === 0) return 'mastery';
        return null;
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
}
