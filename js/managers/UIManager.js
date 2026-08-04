class UIManager {
    constructor(scene, totalCount) {
        this.scene = scene;
        this.totalCount = totalCount;
        this.layout = LayoutManager.getSceneLayout('game');
        this.elements = [];
        this.outcomeElements = [];
        this.createUI();
    }

    track(...elements) {
        this.elements.push(...elements);
        return elements[elements.length - 1];
    }

    createUI() {
        const ui = SceneUI.getPalette();
        const hud = this.layout.hud;
        const footer = this.layout.footer;

        this.brandText = this.track(this.scene.add.text(hud.leftX, hud.brandY, 'NEEDLES / 01', {
            fontFamily: ui.MONO_FONT,
            fontSize: '12px',
            color: ui.TEXT_MUTED,
            letterSpacing: 1.5
        }));
        this.brandText.setDepth(100);

        this.levelCaption = this.track(this.scene.add.text(hud.leftX, hud.captionY, '关卡', {
            fontFamily: ui.BODY_FONT,
            fontSize: '14px',
            color: ui.TEXT_MUTED
        }));
        this.levelCaption.setDepth(100);

        this.levelText = this.track(this.scene.add.text(hud.leftX, hud.valueY, '01', {
            fontFamily: ui.DISPLAY_FONT,
            fontSize: '34px',
            color: ui.TEXT_COLOR,
            fontStyle: 'bold'
        }));
        this.levelText.setOrigin(0, 0.5);
        this.levelText.setDepth(100);

        this.remainingCaption = this.track(this.scene.add.text(hud.rightX, hud.captionY, '待插', {
            fontFamily: ui.BODY_FONT,
            fontSize: '14px',
            color: ui.TEXT_MUTED
        }));
        this.remainingCaption.setOrigin(1, 0);
        this.remainingCaption.setDepth(100);

        this.remainingText = this.track(this.scene.add.text(hud.rightX, hud.valueY, '00', {
            fontFamily: ui.DISPLAY_FONT,
            fontSize: '34px',
            color: ui.TEXT_ACCENT,
            fontStyle: 'bold'
        }));
        this.remainingText.setOrigin(1, 0.5);
        this.remainingText.setDepth(100);

        this.progressTrack = this.track(this.scene.add.rectangle(
            hud.leftX,
            hud.progressY,
            hud.progressWidth,
            4,
            ui.RULE
        ));
        this.progressTrack.setOrigin(0, 0.5);
        this.progressTrack.setDepth(100);

        this.progressFill = this.track(this.scene.add.rectangle(
            hud.leftX,
            hud.progressY,
            hud.progressWidth,
            4,
            ui.ACCENT
        ));
        this.progressFill.setOrigin(0, 0.5);
        this.progressFill.setScale(0, 1);
        this.progressFill.setDepth(101);

        this.hintPanel = this.track(SceneUI.createPanel(
            this.scene,
            CONSTANTS.WIDTH / 2,
            footer.panelCenterY,
            footer.panelWidth,
            footer.panelHeight,
            { fillColor: ui.SURFACE, strokeColor: ui.RULE, radius: 18, depth: 100 }
        ));

        this.hintDot = this.track(this.scene.add.circle(
            footer.dotX,
            footer.upperY,
            5,
            ui.ACCENT
        ));
        this.hintDot.setDepth(101);

        this.mechanicText = this.track(this.scene.add.text(
            footer.textX,
            footer.upperY,
            '校准 · 匀速顺时针',
            {
                fontFamily: ui.BODY_FONT,
                fontSize: '14px',
                color: ui.TEXT_COLOR,
                fontStyle: 'bold'
            }
        ));
        this.mechanicText.setOrigin(0, 0.5);
        this.mechanicText.setDepth(101);

        this.motionText = this.track(this.scene.add.text(
            footer.textX,
            footer.lowerY,
            '顺时针 · 0.46',
            {
                fontFamily: ui.MONO_FONT,
                fontSize: '11px',
                color: ui.TEXT_ACCENT,
                letterSpacing: 1
            }
        ));
        this.motionText.setOrigin(0, 0.5);
        this.motionText.setDepth(101);

        this.motionTrack = this.track(this.scene.add.rectangle(
            footer.motionTrackX,
            footer.lowerY,
            footer.motionTrackWidth,
            2,
            ui.RULE
        ));
        this.motionTrack.setOrigin(0, 0.5);
        this.motionTrack.setDepth(101);
        this.motionTrack.setVisible(false);

        this.motionFill = this.track(this.scene.add.rectangle(
            footer.motionTrackX,
            footer.lowerY,
            footer.motionTrackWidth,
            2,
            ui.ACCENT
        ));
        this.motionFill.setOrigin(0, 0.5);
        this.motionFill.setScale(0, 1);
        this.motionFill.setDepth(102);
        this.motionFill.setVisible(false);

        this.keyText = this.track(this.scene.add.text(
            footer.keyX,
            footer.upperY,
            '轻触 / SPACE',
            {
                fontFamily: ui.MONO_FONT,
                fontSize: '10px',
                color: ui.TEXT_MUTED,
                letterSpacing: 1
            }
        ));
        this.keyText.setOrigin(1, 0.5);
        this.keyText.setDepth(101);
    }

    updateLevel(level, name, rule) {
        this.brandText.setText(`NEEDLES / ${String(level).padStart(2, '0')}`);
        this.levelText.setText(String(level).padStart(2, '0'));
        this.mechanicText.setText(`${name} · ${rule}`);
    }

    updateRhythm(snapshot) {
        const direction = snapshot.direction >= 0 ? '顺时针' : '逆时针';
        const label = `${direction} · ${Math.abs(snapshot.angularVelocity).toFixed(2)}`;

        if (label !== this.motionLabel) {
            this.motionText.setText(label);
            this.motionLabel = label;
        }

        const hasPhase = Number.isFinite(snapshot.displayPhase);
        this.motionTrack.setVisible(hasPhase);
        this.motionFill.setVisible(hasPhase);

        if (hasPhase) {
            this.motionFill.setScale(
                Math.max(0, Math.min(snapshot.displayPhase, 1)),
                1
            );
        }
    }

    updateRemaining(count) {
        const remaining = Math.max(0, count);
        const placed = Math.max(0, this.totalCount - remaining);
        const progress = this.totalCount === 0 ? 1 : placed / this.totalCount;

        this.remainingText.setText(String(remaining).padStart(2, '0'));
        this.progressFill.setScale(progress, 1);
    }

    showSuccess(callback) {
        this.showOutcome('success', callback);
    }

    showFail(callback) {
        this.showOutcome('fail', callback);
    }

    showOutcome(type, callback) {
        const ui = SceneUI.getPalette();
        const outcome = this.layout.outcome;
        const success = type === 'success';
        const accentColor = success ? ui.SUCCESS : ui.ERROR;
        const accentText = success ? ui.TEXT_SUCCESS : ui.TEXT_ERROR;
        const delay = SceneUI.prefersReducedMotion() ? 180 : (success ? 700 : 900);

        const overlay = this.scene.add.rectangle(
            CONSTANTS.WIDTH / 2,
            CONSTANTS.HEIGHT / 2,
            CONSTANTS.WIDTH,
            CONSTANTS.HEIGHT,
            ui.INK,
            0.62
        );
        overlay.setDepth(200);
        overlay.setInteractive();

        const panel = SceneUI.createPanel(
            this.scene,
            CONSTANTS.WIDTH / 2,
            outcome.centerY,
            outcome.panelWidth,
            outcome.panelHeight,
            { fillColor: ui.SURFACE, strokeColor: ui.INK, strokeWidth: 2, depth: 201 }
        );
        const rule = this.scene.add.rectangle(
            outcome.ruleX,
            outcome.centerY - 54,
            7,
            44,
            accentColor
        );
        rule.setOrigin(0, 0.5);
        rule.setDepth(202);

        const label = this.scene.add.text(
            outcome.textX,
            outcome.centerY - 67,
            success ? '精准命中' : '发生碰撞',
            {
                fontFamily: ui.MONO_FONT,
                fontSize: '12px',
                color: accentText,
                letterSpacing: 1.5
            }
        );
        label.setDepth(202);

        const title = this.scene.add.text(
            outcome.textX,
            outcome.centerY - 34,
            success ? '这一圈完成了' : '针帽撞在一起',
            {
                fontFamily: ui.DISPLAY_FONT,
                fontSize: '30px',
                color: ui.TEXT_COLOR,
                fontStyle: 'bold'
            }
        );
        title.setDepth(202);

        const next = this.scene.add.text(
            outcome.textX,
            outcome.centerY + 28,
            '正在进入结算…',
            {
                fontFamily: ui.BODY_FONT,
                fontSize: '15px',
                color: ui.TEXT_MUTED
            }
        );
        next.setDepth(202);

        this.outcomeElements = [overlay, panel, rule, label, title, next];
        panel.setScale(0.97);
        [panel, rule, label, title, next].forEach(element => element.setAlpha(0));

        this.scene.tweens.add({
            targets: [panel, rule, label, title, next],
            alpha: 1,
            scaleX: 1,
            scaleY: 1,
            duration: SceneUI.prefersReducedMotion() ? 100 : 260,
            ease: 'Expo.easeOut'
        });

        this.outcomeTimer = this.scene.time.delayedCall(delay, () => {
            this.outcomeElements.forEach(element => element.destroy());
            this.outcomeElements = [];
            if (callback) callback();
        });
    }

    destroy() {
        if (this.outcomeTimer) this.outcomeTimer.remove(false);
        this.elements.forEach(element => element.destroy());
        this.outcomeElements.forEach(element => element.destroy());
        this.elements = [];
        this.outcomeElements = [];
    }
}
