class GamePreferencesStore {
    constructor(options = {}) {
        this.storage = options.storage === undefined
            ? GamePreferencesStore.getDefaultStorage()
            : options.storage;
        this.storageKey = options.storageKey || 'needle_game_preferences';
        this.state = this.loadState();
    }

    static getDefaultStorage() {
        try {
            return typeof localStorage !== 'undefined' ? localStorage : null;
        } catch (error) {
            return null;
        }
    }

    static defaults() {
        return {
            version: 2,
            scoringEnabled: true,
            scoreHudEnabled: true,
            ghostEnabled: true,
            rewardTextEnabled: true,
            animationIntensity: 'full',
            soundEnabled: false,
            hapticsEnabled: false
        };
    }

    createEmptyState() {
        return { ...GamePreferencesStore.defaults() };
    }

    loadState() {
        if (!this.storage) return this.createEmptyState();
        try {
            const saved = this.storage.getItem(this.storageKey);
            return this.normalizeState(saved ? JSON.parse(saved) : null);
        } catch (error) {
            console.warn('无法读取游戏偏好:', error);
            return this.createEmptyState();
        }
    }

    normalizeState(value) {
        const defaults = GamePreferencesStore.defaults();
        if (!value || typeof value !== 'object') return { ...defaults };
        const intensity = ['full', 'reduced', 'off'].includes(value.animationIntensity)
            ? value.animationIntensity
            : defaults.animationIntensity;
        return {
            version: 2,
            scoringEnabled: value.scoringEnabled !== false,
            scoreHudEnabled: value.scoreHudEnabled !== false,
            ghostEnabled: value.ghostEnabled !== false,
            rewardTextEnabled: value.rewardTextEnabled !== false,
            animationIntensity: intensity,
            soundEnabled: value.soundEnabled === true,
            hapticsEnabled: value.hapticsEnabled === true
        };
    }

    isScoringEnabled() {
        return this.state.scoringEnabled;
    }

    setScoringEnabled(enabled) {
        return this.setBoolean('scoringEnabled', enabled);
    }

    toggleScoring() {
        return this.setScoringEnabled(!this.state.scoringEnabled);
    }

    isScoreHudEnabled() {
        return this.state.scoreHudEnabled;
    }

    setScoreHudEnabled(enabled) {
        return this.setBoolean('scoreHudEnabled', enabled);
    }

    toggleScoreHud() {
        return this.setScoreHudEnabled(!this.state.scoreHudEnabled);
    }

    isGhostEnabled() {
        return this.state.ghostEnabled;
    }

    setGhostEnabled(enabled) {
        return this.setBoolean('ghostEnabled', enabled);
    }

    toggleGhost() {
        return this.setGhostEnabled(!this.state.ghostEnabled);
    }

    isRewardTextEnabled() {
        return this.state.rewardTextEnabled;
    }

    setRewardTextEnabled(enabled) {
        return this.setBoolean('rewardTextEnabled', enabled);
    }

    toggleRewardText() {
        return this.setRewardTextEnabled(!this.state.rewardTextEnabled);
    }

    getAnimationIntensity() {
        return this.state.animationIntensity;
    }

    setAnimationIntensity(value) {
        const normalized = ['full', 'reduced', 'off'].includes(value)
            ? value
            : 'full';
        this.state.animationIntensity = normalized;
        this.persist();
        return normalized;
    }

    cycleAnimationIntensity() {
        const values = ['full', 'reduced', 'off'];
        const index = values.indexOf(this.state.animationIntensity);
        return this.setAnimationIntensity(values[(index + 1) % values.length]);
    }

    isSoundEnabled() {
        return this.state.soundEnabled;
    }

    setSoundEnabled(enabled) {
        return this.setBoolean('soundEnabled', enabled);
    }

    toggleSound() {
        return this.setSoundEnabled(!this.state.soundEnabled);
    }

    isHapticsEnabled() {
        return this.state.hapticsEnabled;
    }

    setHapticsEnabled(enabled) {
        return this.setBoolean('hapticsEnabled', enabled);
    }

    toggleHaptics() {
        return this.setHapticsEnabled(!this.state.hapticsEnabled);
    }

    getFeedbackSettings() {
        return Object.freeze({
            scoreHudEnabled: this.isScoreHudEnabled(),
            ghostEnabled: this.isGhostEnabled(),
            rewardTextEnabled: this.isRewardTextEnabled(),
            animationIntensity: this.getAnimationIntensity(),
            soundEnabled: this.isSoundEnabled(),
            hapticsEnabled: this.isHapticsEnabled()
        });
    }

    setBoolean(key, value) {
        this.state[key] = Boolean(value);
        this.persist();
        return this.state[key];
    }

    resetFeedback() {
        const scoringEnabled = this.state.scoringEnabled;
        this.state = this.createEmptyState();
        this.state.scoringEnabled = scoringEnabled;
        this.persist();
        return this.snapshot();
    }

    snapshot() {
        return JSON.parse(JSON.stringify(this.state));
    }

    persist() {
        if (!this.storage) return;
        try {
            this.storage.setItem(this.storageKey, JSON.stringify(this.state));
        } catch (error) {
            console.warn('无法保存游戏偏好:', error);
        }
    }
}

class FeedbackSignalController {
    constructor(preferences) {
        this.preferences = preferences;
    }

    motionMode() {
        const configured = this.preferences?.getAnimationIntensity?.() || 'full';
        if (configured === 'off') return 'off';
        if (
            configured === 'reduced'
            || (typeof SceneUI !== 'undefined' && SceneUI.prefersReducedMotion())
        ) {
            return 'reduced';
        }
        return 'full';
    }

    emit(kind) {
        this.playTone(kind);
        this.vibrate(kind);
    }

    playTone(kind) {
        if (!this.preferences?.isSoundEnabled?.()) return false;
        try {
            if (typeof window === 'undefined') return false;
            const AudioContextClass = window.AudioContext || window.webkitAudioContext;
            if (!AudioContextClass) return false;
            const context = FeedbackSignalController.audioContext
                || new AudioContextClass();
            FeedbackSignalController.audioContext = context;
            const oscillator = context.createOscillator();
            const gain = context.createGain();
            const frequencies = {
                close: 620,
                threaded: 820,
                combo: 700,
                complete: 920,
                fail: 180,
                insert: 480
            };
            const duration = kind === 'complete' ? 0.16 : 0.085;
            const now = context.currentTime;
            oscillator.type = kind === 'fail' ? 'sawtooth' : 'sine';
            oscillator.frequency.setValueAtTime(frequencies[kind] || 480, now);
            gain.gain.setValueAtTime(0.0001, now);
            gain.gain.exponentialRampToValueAtTime(0.045, now + 0.01);
            gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
            oscillator.connect(gain);
            gain.connect(context.destination);
            oscillator.start(now);
            oscillator.stop(now + duration + 0.01);
            return true;
        } catch (error) {
            return false;
        }
    }

    vibrate(kind) {
        if (!this.preferences?.isHapticsEnabled?.()) return false;
        try {
            if (typeof navigator === 'undefined' || !navigator.vibrate) return false;
            const patterns = {
                close: 18,
                threaded: [20, 24, 28],
                combo: [14, 18, 14],
                complete: [22, 32, 42],
                fail: 70,
                insert: 10
            };
            return Boolean(navigator.vibrate(patterns[kind] || 10));
        } catch (error) {
            return false;
        }
    }
}

FeedbackSignalController.audioContext = null;

class ConfigurableScoringFeedback {
    constructor(scene, levelVisual, preferences) {
        this.scene = scene;
        this.levelVisual = levelVisual;
        this.preferences = preferences;
        this.signals = new FeedbackSignalController(preferences);
        this.elements = new Set();
        this.timers = new Set();
    }

    showInsertion(award, position) {
        if (!award?.enabled) return;
        const kind = this.getInsertionKind(award);
        const label = this.getInsertionLabel(award, kind);
        const points = Math.max(0, Number(award.points) || 0);
        const target = position || this.scene.wheel?.getImpactEdgePosition?.() || {
            x: CONSTANTS.WIDTH / 2,
            y: CONSTANTS.HEIGHT / 2
        };

        if (this.preferences?.isRewardTextEnabled?.() && label) {
            this.createRewardText(target.x, target.y - 20, label, points, kind);
        }
        if (this.signals.motionMode() !== 'off') {
            this.createRewardRing(target.x, target.y, kind);
        }
        this.signals.emit(kind);
    }

    showCompletion(completionAward) {
        if (!completionAward?.enabled) return;
        const bonus = Math.max(0, Number(completionAward.points) || 0);
        if (this.preferences?.isRewardTextEnabled?.()) {
            const tier = completionAward.timeBonus?.kind || 'complete';
            const label = bonus > 0
                ? `速度奖励 · +${bonus}`
                : '稳定完成';
            this.createRewardText(
                CONSTANTS.WIDTH / 2,
                CONSTANTS.HEIGHT / 2 - 96,
                label,
                0,
                tier === 'blazing' ? 'threaded' : 'complete'
            );
        }
        if (this.signals.motionMode() !== 'off') {
            this.createRewardRing(
                CONSTANTS.WIDTH / 2,
                CONSTANTS.HEIGHT / 2 - 46,
                'complete',
                1.8
            );
        }
        this.signals.emit('complete');
    }

    showFailure() {
        this.signals.emit('fail');
    }

    getInsertionKind(award) {
        if (award.comboMilestone || award.comboRestarted) return 'combo';
        if (award.precision?.kind === 'threaded') return 'threaded';
        if (award.precision?.kind === 'close') return 'close';
        return 'insert';
    }

    getInsertionLabel(award, kind) {
        if (award.comboMilestone) return `精准连击 ×${award.combo}`;
        if (award.comboRestarted) return `精准链重启 ×${award.combo}`;
        if (kind === 'threaded') return '双侧穿隙';
        if (kind === 'close') return '贴边好针';
        if (award.comboBroken) return '精准链中断';
        return award.combo >= 2 ? `精准连击 ×${award.combo}` : '';
    }

    createRewardText(x, y, label, points, kind) {
        const ui = SceneUI.getPalette(this.levelVisual?.theme);
        const color = kind === 'threaded' || kind === 'complete'
            ? ui.TEXT_SUCCESS
            : (kind === 'close' || kind === 'combo'
                ? ui.TEXT_ACCENT
                : ui.TEXT_MUTED);
        const copy = points > 0 ? `${label}  +${points}` : label;
        if (!copy) return;
        const text = this.scene.add.text(x, y, copy, {
            fontFamily: ui.DISPLAY_FONT,
            fontSize: kind === 'threaded' ? '20px' : '16px',
            color,
            fontStyle: 'bold',
            stroke: ui.TEXT_INVERSE,
            strokeThickness: 3
        });
        text.setOrigin(0.5);
        text.setDepth(180);
        this.track(text);

        const mode = this.signals.motionMode();
        if (mode === 'full') {
            text.setScale(0.82);
            this.scene.tweens.add({
                targets: text,
                y: y - 34,
                alpha: 0,
                scale: 1.06,
                duration: 720,
                ease: 'Cubic.easeOut',
                onComplete: () => this.destroyElement(text)
            });
        } else {
            const timer = this.scene.time.delayedCall(420, () => {
                this.destroyElement(text);
                this.timers.delete(timer);
            });
            this.timers.add(timer);
        }
    }

    createRewardRing(x, y, kind, scale = 1) {
        const ui = SceneUI.getPalette(this.levelVisual?.theme);
        const color = kind === 'threaded' || kind === 'complete'
            ? ui.SUCCESS
            : ui.ACCENT;
        const ring = this.scene.add.circle(x, y, 13 * scale, color, 0.04);
        ring.setStrokeStyle(kind === 'threaded' ? 3 : 2, color, 0.76);
        ring.setDepth(175);
        this.track(ring);
        const mode = this.signals.motionMode();
        const targetScale = mode === 'full' ? 2.7 : 1.65;
        const duration = mode === 'full' ? 430 : 220;
        this.scene.tweens.add({
            targets: ring,
            scale: targetScale,
            alpha: 0,
            duration,
            ease: 'Quad.easeOut',
            onComplete: () => this.destroyElement(ring)
        });
    }

    track(element) {
        this.elements.add(element);
        return element;
    }

    destroyElement(element) {
        if (element?.active) element.destroy();
        this.elements.delete(element);
    }

    destroyAll() {
        this.timers.forEach(timer => timer.remove(false));
        this.elements.forEach(element => {
            if (element?.active) element.destroy();
        });
        this.timers.clear();
        this.elements.clear();
    }
}

class FeedbackSettingsModal {
    static open(scene, preferences) {
        if (!scene || scene.feedbackSettingsModal) return scene?.feedbackSettingsModal;
        const ui = SceneUI.getPalette();
        const centerY = CONSTANTS.HEIGHT / 2;
        const elements = [];
        const track = element => {
            elements.push(element);
            return element;
        };

        const close = () => {
            elements.forEach(element => {
                if (element?.active) element.destroy();
            });
            scene.feedbackSettingsModal = null;
            scene.closeFeedbackSettings = null;
        };
        const refresh = mutate => {
            mutate();
            close();
            scene.time.delayedCall(0, () => FeedbackSettingsModal.open(scene, preferences));
        };

        const overlay = track(scene.add.rectangle(
            CONSTANTS.WIDTH / 2,
            CONSTANTS.HEIGHT / 2,
            CONSTANTS.WIDTH,
            CONSTANTS.HEIGHT,
            ui.INK,
            0.76
        ));
        overlay.setDepth(500);
        overlay.setInteractive();
        track(SceneUI.createPanel(
            scene,
            300,
            centerY,
            500,
            570,
            {
                fillColor: ui.SURFACE,
                strokeColor: ui.INK,
                strokeWidth: 2,
                radius: 20,
                depth: 501
            }
        ));
        const kicker = track(scene.add.text(74, centerY - 248, 'FEEDBACK', {
            fontFamily: ui.MONO_FONT,
            fontSize: '11px',
            color: ui.TEXT_ACCENT,
            letterSpacing: 1.5
        }));
        kicker.setDepth(502);
        const title = track(scene.add.text(74, centerY - 216, '反馈与辅助设置', {
            fontFamily: ui.DISPLAY_FONT,
            fontSize: '30px',
            color: ui.TEXT_COLOR,
            fontStyle: 'bold'
        }));
        title.setDepth(502);
        const note = track(scene.add.text(
            74,
            centerY - 174,
            '计分规则不会随这些设置改变。系统“减少动态效果”优先级最高。',
            {
                fontFamily: ui.BODY_FONT,
                fontSize: '12px',
                color: ui.TEXT_MUTED,
                wordWrap: { width: 450 }
            }
        ));
        note.setDepth(502);

        const rows = [
            {
                label: '计分 HUD',
                value: preferences.isScoreHudEnabled() ? '显示' : '隐藏',
                action: () => preferences.toggleScoreHud()
            },
            {
                label: '个人最佳幽灵',
                value: preferences.isGhostEnabled() ? '显示' : '隐藏',
                action: () => preferences.toggleGhost()
            },
            {
                label: '奖励文字',
                value: preferences.isRewardTextEnabled() ? '显示' : '隐藏',
                action: () => preferences.toggleRewardText()
            },
            {
                label: '动画强度',
                value: FeedbackSettingsModal.intensityLabel(
                    preferences.getAnimationIntensity()
                ),
                action: () => preferences.cycleAnimationIntensity()
            },
            {
                label: '提示音',
                value: preferences.isSoundEnabled() ? '开启' : '关闭',
                action: () => preferences.toggleSound()
            },
            {
                label: '设备震动',
                value: preferences.isHapticsEnabled() ? '开启' : '关闭',
                action: () => preferences.toggleHaptics()
            }
        ];

        rows.forEach((row, index) => {
            const y = centerY - 116 + index * 58;
            const label = track(scene.add.text(82, y, row.label, {
                fontFamily: ui.BODY_FONT,
                fontSize: '15px',
                color: ui.TEXT_COLOR
            }));
            label.setOrigin(0, 0.5);
            label.setDepth(502);
            track(SceneUI.createButton(
                scene,
                438,
                y,
                row.value,
                () => refresh(row.action),
                {
                    width: 150,
                    height: 38,
                    variant: 'secondary',
                    depth: 503,
                    fontSize: '13px'
                }
            ));
        });

        track(SceneUI.createButton(
            scene,
            186,
            centerY + 238,
            '恢复反馈默认值',
            () => refresh(() => preferences.resetFeedback()),
            {
                width: 200,
                height: 44,
                variant: 'quiet',
                depth: 503,
                fontSize: '13px'
            }
        ));
        track(SceneUI.createButton(
            scene,
            414,
            centerY + 238,
            '完成',
            close,
            {
                width: 200,
                height: 44,
                variant: 'primary',
                depth: 503,
                fontSize: '14px'
            }
        ));
        overlay.on('pointerup', close);
        scene.feedbackSettingsModal = { elements, close };
        scene.closeFeedbackSettings = close;
        return scene.feedbackSettingsModal;
    }

    static intensityLabel(value) {
        return {
            full: '完整',
            reduced: '精简',
            off: '关闭'
        }[value] || '完整';
    }
}
