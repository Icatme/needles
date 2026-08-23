const BADGE_DEFINITIONS = Object.freeze([
    Object.freeze({
        id: 'first-clear',
        name: '初次校准',
        description: '首次完成开启计分的关卡'
    }),
    Object.freeze({
        id: 'edge-specialist',
        name: '贴边专家',
        description: '单局完成至少 3 次贴边好针'
    }),
    Object.freeze({
        id: 'thread-the-needle',
        name: '穿针引线',
        description: '单局完成至少 2 次双侧穿隙'
    }),
    Object.freeze({
        id: 'tempo-keeper',
        name: '稳拍者',
        description: '至少 5 针且精准连击从未超时'
    }),
    Object.freeze({
        id: 'precision-full-chain',
        name: '一气呵成',
        description: '除第一针外，每针都以精准命中延续连击'
    }),
    Object.freeze({
        id: 'blazing-clear',
        name: '疾速通关',
        description: '获得最高档速度奖励'
    }),
    Object.freeze({
        id: 'precision-master',
        name: '精准过半',
        description: '至少一半插针获得精准判定'
    }),
    Object.freeze({
        id: 'objective-sweep',
        name: '全目标达成',
        description: '同一局完成全部局内目标'
    })
]);

class RunObjectiveTracker {
    constructor(levelConfig) {
        this.level = JSON.parse(JSON.stringify(levelConfig || {}));
        this.failed = false;
        this.objectives = this.createObjectives();
        this.newlyCompleted = [];
    }

    createObjectives() {
        const needleCount = Math.max(1, Number(this.level.needleCount) || 1);
        const focus = this.level.presentation?.focus
            || this.level.designIntent?.focus
            || '';
        const comboTarget = Math.min(
            8,
            Math.max(3, Math.ceil(needleCount * 0.4))
        );
        const objectives = [
            {
                id: 'complete',
                label: '完成本关',
                kind: 'complete',
                target: 1,
                progress: 0,
                completed: false
            },
            {
                id: 'precision-chain',
                label: `精准连击达到 ×${comboTarget}`,
                kind: 'maxCombo',
                target: comboTarget,
                progress: 0,
                completed: false
            }
        ];

        if (['speed', 'rhythm', 'timing'].includes(focus)) {
            objectives.push({
                id: 'under-par',
                label: '在基准时间内通关',
                kind: 'underPar',
                target: 1,
                progress: 0,
                completed: false
            });
        } else if (
            ['zones', 'density'].includes(focus)
            || (this.level.layout?.obstacleAngles?.length || 0) >= 2
        ) {
            objectives.push({
                id: 'threaded-shot',
                label: '完成一次双侧穿隙',
                kind: 'threaded',
                target: 1,
                progress: 0,
                completed: false
            });
        } else {
            objectives.push({
                id: 'close-pair',
                label: '完成两次贴边好针',
                kind: 'close',
                target: 2,
                progress: 0,
                completed: false
            });
        }
        return objectives;
    }

    update(scoreSnapshot = {}, timeBonus = null) {
        const completedBefore = new Set(
            this.objectives.filter(item => item.completed).map(item => item.id)
        );
        this.objectives.forEach(objective => {
            if (objective.kind === 'maxCombo') {
                objective.progress = Math.max(
                    objective.progress,
                    Number(scoreSnapshot.maxCombo) || 0
                );
            } else if (objective.kind === 'close') {
                objective.progress = Number(scoreSnapshot.precisionCounts?.close) || 0;
            } else if (objective.kind === 'threaded') {
                objective.progress = Number(scoreSnapshot.precisionCounts?.threaded) || 0;
            } else if (objective.kind === 'underPar' && timeBonus) {
                objective.progress = ['blazing', 'fast', 'par'].includes(timeBonus.kind)
                    ? 1
                    : 0;
            } else if (objective.kind === 'complete') {
                objective.progress = scoreSnapshot.status === 'completed' ? 1 : 0;
            }
            objective.completed = objective.progress >= objective.target;
        });

        this.newlyCompleted = this.objectives
            .filter(item => item.completed && !completedBefore.has(item.id))
            .map(item => item.id);
        return this.snapshot();
    }

    complete(scoreSnapshot = {}, timeBonus = null) {
        const snapshot = {
            ...scoreSnapshot,
            status: 'completed'
        };
        return this.update(snapshot, timeBonus);
    }

    fail(scoreSnapshot = {}) {
        this.failed = true;
        return this.update(scoreSnapshot, null);
    }

    snapshot() {
        return Object.freeze({
            failed: this.failed,
            newlyCompleted: Object.freeze([...this.newlyCompleted]),
            completedCount: this.objectives.filter(item => item.completed).length,
            totalCount: this.objectives.length,
            objectives: Object.freeze(this.objectives.map(item => Object.freeze({
                ...item,
                progress: Math.min(item.progress, item.target)
            })))
        });
    }
}

class ObjectiveHUD {
    constructor(scene, initialSnapshot = null) {
        this.scene = scene;
        this.layout = LayoutManager.getSceneLayout('game');
        const ui = SceneUI.getPalette();
        this.text = this.scene.add.text(
            CONSTANTS.WIDTH / 2,
            this.layout.hud.progressY + 12,
            '局内目标',
            {
                fontFamily: ui.BODY_FONT,
                fontSize: '10px',
                color: ui.TEXT_MUTED
            }
        );
        this.text.setOrigin(0.5, 0);
        this.text.setDepth(104);
        this.update(initialSnapshot);
    }

    update(snapshot) {
        if (!snapshot || !this.text) return;
        const ui = SceneUI.getPalette();
        const active = snapshot.objectives.find(item => !item.completed);
        if (!active) {
            this.text.setText('目标完成 · 3 / 3');
            this.text.setColor(ui.TEXT_SUCCESS);
            return;
        }
        const progress = `${Math.min(active.progress, active.target)} / ${active.target}`;
        this.text.setText(`目标 · ${active.label}  ${progress}`);
        this.text.setColor(ui.TEXT_MUTED);
    }

    destroy() {
        if (this.text?.active) this.text.destroy();
        this.text = null;
    }
}

class BadgeEvaluator {
    static evaluate(input = {}) {
        const score = input.score || {};
        const timeBonus = input.timeBonus || {};
        const objectives = input.objectives || {};
        if (score.status !== 'completed' || score.enabled === false) {
            return Object.freeze([]);
        }

        const close = Number(score.precisionCounts?.close) || 0;
        const threaded = Number(score.precisionCounts?.threaded) || 0;
        const insertedCount = Number(score.insertedCount) || 0;
        const maxCombo = Number(score.maxCombo) || 0;
        const comboTimeouts = Number(score.comboTimeouts) || 0;
        const earned = ['first-clear'];

        if (close >= 3) earned.push('edge-specialist');
        if (threaded >= 2) earned.push('thread-the-needle');
        if (insertedCount >= 5 && comboTimeouts === 0) earned.push('tempo-keeper');
        if (insertedCount >= 5 && maxCombo >= insertedCount) {
            earned.push('precision-full-chain');
        }
        if (timeBonus.kind === 'blazing') earned.push('blazing-clear');
        if (
            insertedCount > 0
            && close + threaded >= Math.ceil(insertedCount / 2)
        ) {
            earned.push('precision-master');
        }
        if (
            objectives.totalCount > 0
            && objectives.completedCount >= objectives.totalCount
        ) {
            earned.push('objective-sweep');
        }
        return Object.freeze([...new Set(earned)]);
    }

    static definitions() {
        return BADGE_DEFINITIONS.map(definition => ({ ...definition }));
    }
}

class BadgeStore {
    constructor(options = {}) {
        this.storage = options.storage === undefined
            ? BadgeStore.getDefaultStorage()
            : options.storage;
        this.storageKey = options.storageKey || 'needle_game_badges';
        this.clock = typeof options.clock === 'function'
            ? options.clock
            : () => new Date();
        this.state = this.loadState();
    }

    static getDefaultStorage() {
        try {
            return typeof localStorage !== 'undefined' ? localStorage : null;
        } catch (error) {
            return null;
        }
    }

    createEmptyState() {
        return {
            version: 2,
            unlocked: {},
            levelObjectives: {}
        };
    }

    loadState() {
        if (!this.storage) return this.createEmptyState();
        try {
            const saved = this.storage.getItem(this.storageKey);
            return this.normalizeState(saved ? JSON.parse(saved) : null);
        } catch (error) {
            console.warn('无法读取徽章记录:', error);
            return this.createEmptyState();
        }
    }

    normalizeState(value) {
        const state = this.createEmptyState();
        if (!value || typeof value !== 'object' || value.version !== 2) {
            return state;
        }
        const validIds = new Set(BADGE_DEFINITIONS.map(item => item.id));
        Object.entries(value.unlocked || {}).forEach(([id, record]) => {
            if (!validIds.has(id)) return;
            state.unlocked[id] = {
                id,
                unlockedAt: BadgeStore.normalizeDate(record?.unlockedAt),
                packId: typeof record?.packId === 'string' ? record.packId : null,
                levelId: typeof record?.levelId === 'string' ? record.levelId : null
            };
        });
        state.levelObjectives = value.levelObjectives
            && typeof value.levelObjectives === 'object'
            ? JSON.parse(JSON.stringify(value.levelObjectives))
            : {};
        return state;
    }

    recordCompletedRun(input = {}) {
        const earnedBadges = BadgeEvaluator.evaluate(input);
        const newBadges = [];
        earnedBadges.forEach(id => {
            if (this.state.unlocked[id]) return;
            this.state.unlocked[id] = {
                id,
                unlockedAt: this.nowIso(),
                packId: input.packId || null,
                levelId: input.levelId || null
            };
            newBadges.push(id);
        });

        this.recordObjectives(
            input.packId,
            input.levelId,
            input.objectives
        );
        this.persist();
        return Object.freeze({
            earnedBadges,
            newBadges: Object.freeze(newBadges),
            totalUnlocked: this.countUnlocked(),
            objectives: input.objectives || null
        });
    }

    recordObjectives(packId, levelId, objectives) {
        if (!packId || !levelId || !objectives) return;
        if (!this.state.levelObjectives[packId]) {
            this.state.levelObjectives[packId] = {};
        }
        const previous = this.state.levelObjectives[packId][levelId] || {
            completedCount: 0,
            totalCount: objectives.totalCount || 0,
            completedIds: []
        };
        const completedIds = objectives.objectives
            .filter(item => item.completed)
            .map(item => item.id);
        if (completedIds.length >= previous.completedCount) {
            this.state.levelObjectives[packId][levelId] = {
                completedCount: completedIds.length,
                totalCount: objectives.totalCount,
                completedIds,
                updatedAt: this.nowIso()
            };
        }
    }

    listDefinitions() {
        return BADGE_DEFINITIONS.map(definition => ({
            ...definition,
            unlocked: Boolean(this.state.unlocked[definition.id]),
            record: this.state.unlocked[definition.id]
                ? { ...this.state.unlocked[definition.id] }
                : null
        }));
    }

    listUnlocked() {
        return this.listDefinitions().filter(item => item.unlocked);
    }

    countUnlocked() {
        return Object.keys(this.state.unlocked).length;
    }

    getLevelObjectives(packId, levelId) {
        const value = this.state.levelObjectives[packId]?.[levelId] || null;
        return value ? JSON.parse(JSON.stringify(value)) : null;
    }

    reset() {
        this.state = this.createEmptyState();
        if (!this.storage) return;
        try {
            this.storage.removeItem(this.storageKey);
        } catch (error) {
            console.warn('无法清除徽章记录:', error);
        }
    }

    persist() {
        if (!this.storage) return;
        try {
            this.storage.setItem(this.storageKey, JSON.stringify(this.state));
        } catch (error) {
            console.warn('无法保存徽章记录:', error);
        }
    }

    nowIso() {
        const value = this.clock();
        return BadgeStore.normalizeDate(
            value instanceof Date ? value.toISOString() : value
        );
    }

    static normalizeDate(value) {
        const date = new Date(value);
        return Number.isNaN(date.getTime())
            ? new Date(0).toISOString()
            : date.toISOString();
    }
}

function installBadgeStore(context) {
    if (!context) return null;
    if (!context.badges) context.badges = new BadgeStore();
    if (!context.__badgeResetWrapped) {
        const originalReset = context.resetProgress.bind(context);
        context.resetProgress = () => {
            const result = originalReset();
            context.badges?.reset();
            return result;
        };
        context.__badgeResetWrapped = true;
    }
    return context.badges;
}

if (typeof APP_CONTEXT !== 'undefined') {
    installBadgeStore(APP_CONTEXT);
}

class ScoringMenuScene extends EnhancedMenuScene {
    create() {
        if (!APP_CONTEXT.preferences) {
            APP_CONTEXT.preferences = new GamePreferencesStore();
        }
        if (!APP_CONTEXT.scores && typeof ScoreStore !== 'undefined') {
            APP_CONTEXT.scores = new ScoreStore();
        }
        installBadgeStore(APP_CONTEXT);
        super.create();
        this.createBadgeButton();
        this.createDailyButton();
        this.createScoringToggle();
        this.createFeedbackButton();
        this.input.keyboard.on('keydown-S', () => this.toggleScoring());
        this.input.keyboard.on('keydown-B', () => {
            if (this.scoreboardModal) {
                this.closeScoreboard();
            } else {
                this.showScoreboard();
            }
        });
        this.input.keyboard.on('keydown-A', () => {
            if (this.badgeModal) {
                this.closeBadgeCollection();
            } else {
                this.showBadgeCollection();
            }
        });
        this.input.keyboard.on('keydown-D', () => this.startDailyChallenge());
        this.input.keyboard.on('keydown-F', () => this.showFeedbackSettings());
        this.input.keyboard.on('keydown-ESC', () => {
            if (this.scoreboardModal) this.closeScoreboard();
            if (this.badgeModal) this.closeBadgeCollection();
            if (this.feedbackSettingsModal) this.closeFeedbackSettings?.();
        });
    }

    createBadgeButton() {
        const count = APP_CONTEXT.badges?.countUnlocked() || 0;
        this.badgeButton = SceneUI.createButton(
            this,
            142,
            this.layout.theme.labelY,
            `A · 徽章 ${count}/${BADGE_DEFINITIONS.length}`,
            () => this.showBadgeCollection(),
            {
                width: 154,
                height: 34,
                variant: count > 0 ? 'secondary' : 'quiet',
                depth: 30,
                fontSize: '12px'
            }
        );
    }

    createDailyButton() {
        if (typeof DAILY_CHALLENGES === 'undefined') return;
        const challenge = DAILY_CHALLENGES.getToday(this.levelManager.activePackId);
        this.dailyButton = SceneUI.createButton(
            this,
            300,
            this.layout.theme.labelY,
            `D · 每日 ${String(challenge.levelOrder).padStart(2, '0')}`,
            () => this.startDailyChallenge(),
            {
                width: 146,
                height: 34,
                variant: 'secondary',
                depth: 30,
                fontSize: '12px'
            }
        );
    }

    createScoringToggle() {
        const enabled = APP_CONTEXT.preferences.isScoringEnabled();
        this.scoringToggleButton = SceneUI.createButton(
            this,
            458,
            this.layout.theme.labelY,
            `S · 计分挑战 ${enabled ? '开' : '关'}`,
            () => this.toggleScoring(),
            {
                width: 154,
                height: 34,
                variant: enabled ? 'secondary' : 'quiet',
                depth: 30,
                fontSize: '12px'
            }
        );
    }

    createFeedbackButton() {
        if (typeof FeedbackSettingsModal === 'undefined') return;
        this.feedbackButton = SceneUI.createButton(
            this,
            542,
            38,
            'F · 反馈',
            () => this.showFeedbackSettings(),
            {
                width: 94,
                height: 30,
                variant: 'quiet',
                depth: 40,
                fontSize: '11px'
            }
        );
    }

    createButtons() {
        const ui = SceneUI.getPalette();
        const buttonLayout = this.layout.buttons;
        const resume = APP_CONTEXT.getResumeRoute(this.levelManager.activePackId);
        const config = APP_CONTEXT.catalog.getLevelConfig(
            resume.packId,
            resume.levelId
        );
        const hasProgress = config.order > 1;
        const primaryLabel = hasProgress
            ? `继续第 ${config.order} 关`
            : '开始第 1 关';

        SceneUI.createButton(this, 300, buttonLayout.primaryY, primaryLabel, () => {
            APP_CONTEXT.router.startLevel(this, resume);
        }, { width: 300, variant: 'primary' });

        SceneUI.createButton(
            this,
            300,
            buttonLayout.secondaryY,
            '选关测试 · A/B 对照',
            () => {
                APP_CONTEXT.router.startLevelBrowser(this, {
                    packId: this.levelManager.activePackId
                });
            },
            { width: 300, variant: 'secondary' }
        );

        const packId = this.levelManager.activePackId;
        const contractIds = this.getScoreContractIds(packId);
        const scoreCount = APP_CONTEXT.scores?.countBest(packId, {
            contractIds
        }) || 0;
        SceneUI.createButton(
            this,
            194,
            buttonLayout.resetY,
            `B · 本机分数表 (${scoreCount})`,
            () => this.showScoreboard(),
            {
                width: 190,
                height: 48,
                variant: 'quiet',
                fontSize: '14px'
            }
        );
        SceneUI.createButton(
            this,
            406,
            buttonLayout.resetY,
            '重置全部进度',
            () => this.confirmReset(),
            {
                width: 190,
                height: 48,
                variant: 'quiet',
                fontSize: '14px'
            }
        );

        const shortcut = this.add.text(
            300,
            buttonLayout.footerY,
            'ENTER 开始 · L 选关 · B 分数 · A 徽章 · D 每日 · S 计分',
            {
                fontFamily: ui.MONO_FONT,
                fontSize: '9px',
                color: ui.TEXT_MUTED,
                letterSpacing: 0.5
            }
        );
        shortcut.setOrigin(0.5);
    }

    toggleScoring() {
        APP_CONTEXT.preferences.toggleScoring();
        this.scene.restart();
    }

    startDailyChallenge() {
        if (typeof DAILY_CHALLENGES === 'undefined') return;
        DAILY_CHALLENGES.start(this, this.levelManager.activePackId);
    }

    showFeedbackSettings() {
        if (typeof FeedbackSettingsModal === 'undefined') return;
        FeedbackSettingsModal.open(this, APP_CONTEXT.preferences);
    }

    showBadgeCollection() {
        if (this.badgeModal) return;
        const ui = SceneUI.getPalette();
        const definitions = APP_CONTEXT.badges.listDefinitions();
        const centerY = CONSTANTS.HEIGHT / 2;
        const elements = [];
        const track = element => {
            elements.push(element);
            return element;
        };

        const overlay = track(this.add.rectangle(
            CONSTANTS.WIDTH / 2,
            CONSTANTS.HEIGHT / 2,
            CONSTANTS.WIDTH,
            CONSTANTS.HEIGHT,
            ui.INK,
            0.74
        ));
        overlay.setDepth(420);
        overlay.setInteractive();
        track(SceneUI.createPanel(
            this,
            300,
            centerY,
            520,
            556,
            {
                fillColor: ui.SURFACE,
                strokeColor: ui.INK,
                strokeWidth: 2,
                radius: 20,
                depth: 421
            }
        ));

        const kicker = track(this.add.text(68, centerY - 244, 'ACHIEVEMENTS', {
            fontFamily: ui.MONO_FONT,
            fontSize: '11px',
            color: ui.TEXT_ACCENT,
            letterSpacing: 1.5
        }));
        kicker.setDepth(422);
        const title = track(this.add.text(68, centerY - 212, '徽章收藏', {
            fontFamily: ui.DISPLAY_FONT,
            fontSize: '30px',
            color: ui.TEXT_COLOR,
            fontStyle: 'bold'
        }));
        title.setDepth(422);
        const count = track(this.add.text(
            532,
            centerY - 202,
            `${APP_CONTEXT.badges.countUnlocked()} / ${definitions.length}`,
            {
                fontFamily: ui.MONO_FONT,
                fontSize: '13px',
                color: ui.TEXT_MUTED
            }
        ));
        count.setOrigin(1, 0.5);
        count.setDepth(422);

        definitions.forEach((definition, index) => {
            const column = index % 2;
            const row = Math.floor(index / 2);
            const x = column === 0 ? 74 : 310;
            const y = centerY - 138 + row * 82;
            const width = 216;
            const panel = track(SceneUI.createPanel(
                this,
                x + width / 2,
                y,
                width,
                66,
                {
                    fillColor: definition.unlocked ? ui.BACKGROUND_ALT : ui.BACKGROUND,
                    fillAlpha: definition.unlocked ? 1 : 0.55,
                    strokeColor: definition.unlocked ? ui.SUCCESS : ui.RULE,
                    strokeWidth: definition.unlocked ? 2 : 1,
                    radius: 12,
                    depth: 422
                }
            ));
            panel.setAlpha(definition.unlocked ? 1 : 0.72);
            const mark = track(this.add.text(x + 13, y - 14, definition.unlocked ? '◆' : '◇', {
                fontFamily: ui.MONO_FONT,
                fontSize: '15px',
                color: definition.unlocked ? ui.TEXT_SUCCESS : ui.TEXT_MUTED
            }));
            mark.setDepth(423);
            const name = track(this.add.text(x + 38, y - 16, definition.name, {
                fontFamily: ui.BODY_FONT,
                fontSize: '14px',
                color: definition.unlocked ? ui.TEXT_COLOR : ui.TEXT_MUTED,
                fontStyle: 'bold'
            }));
            name.setDepth(423);
            const description = track(this.add.text(x + 13, y + 8, definition.description, {
                fontFamily: ui.BODY_FONT,
                fontSize: '10px',
                color: ui.TEXT_MUTED,
                wordWrap: { width: 190 }
            }));
            description.setDepth(423);
        });

        const note = track(this.add.text(
            300,
            centerY + 202,
            '徽章不增加分数，只记录玩法里程碑',
            {
                fontFamily: ui.BODY_FONT,
                fontSize: '12px',
                color: ui.TEXT_MUTED
            }
        ));
        note.setOrigin(0.5);
        note.setDepth(423);
        track(SceneUI.createButton(
            this,
            300,
            centerY + 242,
            '关闭徽章收藏',
            () => this.closeBadgeCollection(),
            {
                width: 210,
                height: 44,
                variant: 'secondary',
                depth: 424
            }
        ));
        overlay.on('pointerup', () => this.closeBadgeCollection());
        this.badgeModal = elements;
    }

    closeBadgeCollection() {
        if (!this.badgeModal) return;
        this.badgeModal.forEach(element => element.destroy());
        this.badgeModal = null;
    }

    showScoreboard() {
        if (this.scoreboardModal) return;
        const ui = SceneUI.getPalette();
        const packId = this.levelManager.activePackId;
        const pack = this.levelManager.getActivePack();
        const contractIds = this.getScoreContractIds(packId);
        const records = APP_CONTEXT.scores.listBest(packId, {
            limit: 6,
            contractIds
        });
        const total = APP_CONTEXT.scores.countBest(packId, { contractIds });
        const centerY = CONSTANTS.HEIGHT / 2;
        const elements = [];
        const track = element => {
            elements.push(element);
            return element;
        };

        const overlay = track(this.add.rectangle(
            CONSTANTS.WIDTH / 2,
            CONSTANTS.HEIGHT / 2,
            CONSTANTS.WIDTH,
            CONSTANTS.HEIGHT,
            ui.INK,
            0.72
        ));
        overlay.setDepth(400);
        overlay.setInteractive();

        track(SceneUI.createPanel(
            this,
            300,
            centerY,
            510,
            500,
            {
                fillColor: ui.SURFACE,
                strokeColor: ui.INK,
                strokeWidth: 2,
                radius: 20,
                depth: 401
            }
        ));

        const kicker = track(this.add.text(72, centerY - 216, 'LOCAL BESTS', {
            fontFamily: ui.MONO_FONT,
            fontSize: '11px',
            color: ui.TEXT_ACCENT,
            letterSpacing: 1.5
        }));
        kicker.setDepth(402);
        const title = track(this.add.text(72, centerY - 184, '本机分数表', {
            fontFamily: ui.DISPLAY_FONT,
            fontSize: '30px',
            color: ui.TEXT_COLOR,
            fontStyle: 'bold'
        }));
        title.setDepth(402);
        const subtitle = track(this.add.text(
            528,
            centerY - 176,
            `${pack.name} · 最近刷新 ${Math.min(total, 6)} / ${total}`,
            {
                fontFamily: ui.BODY_FONT,
                fontSize: '12px',
                color: ui.TEXT_MUTED
            }
        ));
        subtitle.setOrigin(1, 0.5);
        subtitle.setDepth(402);

        const columnY = centerY - 126;
        [
            [76, '关卡', 0],
            [316, '最佳得分', 1],
            [432, '用时', 1],
            [524, '连击', 1]
        ].forEach(([x, label, origin]) => {
            const header = track(this.add.text(x, columnY, label, {
                fontFamily: ui.BODY_FONT,
                fontSize: '12px',
                color: ui.TEXT_MUTED
            }));
            header.setOrigin(origin, 0.5);
            header.setDepth(402);
        });

        if (records.length === 0) {
            const empty = track(this.add.text(
                300,
                centerY + 12,
                '完成开启计分的正式关卡后，\n最佳成绩会出现在这里。',
                {
                    fontFamily: ui.BODY_FONT,
                    fontSize: '16px',
                    color: ui.TEXT_MUTED,
                    align: 'center',
                    lineSpacing: 8
                }
            ));
            empty.setOrigin(0.5);
            empty.setDepth(402);
        } else {
            records.forEach((record, index) => {
                const y = centerY - 92 + index * 42;
                const separator = track(this.add.rectangle(
                    300,
                    y + 20,
                    444,
                    1,
                    ui.RULE
                ));
                separator.setDepth(402);
                const levelLabel = `第 ${String(record.levelOrder || 0).padStart(2, '0')} 关`;
                const name = record.levelName.length > 12
                    ? `${record.levelName.slice(0, 12)}…`
                    : record.levelName;
                const level = track(this.add.text(76, y, `${levelLabel} · ${name}`, {
                    fontFamily: ui.BODY_FONT,
                    fontSize: '13px',
                    color: ui.TEXT_COLOR
                }));
                level.setOrigin(0, 0.5);
                level.setDepth(402);
                const score = track(this.add.text(316, y, String(record.score), {
                    fontFamily: ui.MONO_FONT,
                    fontSize: '14px',
                    color: ui.TEXT_ACCENT,
                    fontStyle: 'bold'
                }));
                score.setOrigin(1, 0.5);
                score.setDepth(402);
                const time = track(this.add.text(
                    432,
                    y,
                    ScoringHUD.formatElapsed(record.elapsedMs),
                    {
                        fontFamily: ui.MONO_FONT,
                        fontSize: '12px',
                        color: ui.TEXT_COLOR
                    }
                ));
                time.setOrigin(1, 0.5);
                time.setDepth(402);
                const combo = track(this.add.text(524, y, `×${record.maxCombo}`, {
                    fontFamily: ui.MONO_FONT,
                    fontSize: '12px',
                    color: ui.TEXT_COLOR
                }));
                combo.setOrigin(1, 0.5);
                combo.setDepth(402);
            });
        }

        const note = track(this.add.text(
            300,
            centerY + 174,
            '不同关卡不混排 · 同关同分时，用时更短优先',
            {
                fontFamily: ui.BODY_FONT,
                fontSize: '12px',
                color: ui.TEXT_MUTED
            }
        ));
        note.setOrigin(0.5);
        note.setDepth(402);

        track(SceneUI.createButton(
            this,
            300,
            centerY + 214,
            '关闭分数表',
            () => this.closeScoreboard(),
            {
                width: 210,
                height: 46,
                variant: 'secondary',
                depth: 403
            }
        ));

        overlay.on('pointerup', () => this.closeScoreboard());
        this.scoreboardModal = elements;
    }

    closeScoreboard() {
        if (!this.scoreboardModal) return;
        this.scoreboardModal.forEach(element => element.destroy());
        this.scoreboardModal = null;
    }

    getScoreContractIds(packId) {
        return new Set(APP_CONTEXT.catalog.listLevels(packId).map(level => {
            const levelId = level.packLevelId || level.id;
            const config = APP_CONTEXT.catalog.getLevelConfig(packId, levelId);
            return ScoreStore.contractId(config);
        }));
    }
}
