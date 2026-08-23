class ScoringFeedback {
    constructor(scene, levelVisual) {
        this.scene = scene;
        this.levelVisual = levelVisual;
        this.active = new Set();
        this.timers = new Set();
    }

    showInsertion(award, position) {
        if (!award?.enabled || !position) return;
        const ui = SceneUI.getPalette(this.levelVisual?.theme);
        const precisionLabel = {
            close: '贴边好针',
            threaded: '双侧穿隙'
        }[award.precision?.kind] || '';
        const comboLabel = {
            triple: '三连精准',
            hot: '精准连击升温',
            unstoppable: '精准势不可挡',
            mastery: '精准大师连击'
        }[award.comboMilestone] || '';
        const primary = comboLabel
            || (award.comboRestarted ? '精准链重启' : '')
            || precisionLabel
            || (award.comboBroken
                ? '精准链重启'
                : (award.combo > 1 ? `精准连击 ×${award.combo}` : '稳定命中'));
        const accentColor = award.precision?.kind === 'threaded'
            ? ui.TEXT_SUCCESS
            : (award.comboBroken ? ui.TEXT_ERROR : ui.TEXT_ACCENT);

        const container = this.scene.add.container(position.x, position.y - 28);
        container.setDepth(170);
        const label = this.scene.add.text(0, -15, primary, {
            fontFamily: ui.BODY_FONT,
            fontSize: award.precision?.kind === 'threaded' ? '16px' : '14px',
            color: accentColor,
            fontStyle: 'bold'
        });
        label.setOrigin(0.5);
        const points = this.scene.add.text(0, 7, `+${award.points}`, {
            fontFamily: ui.MONO_FONT,
            fontSize: '14px',
            color: ui.TEXT_COLOR,
            letterSpacing: 0.8
        });
        points.setOrigin(0.5);
        const marks = this.scene.add.graphics();
        marks.lineStyle(
            award.precision?.kind === 'threaded' ? 3 : 2,
            award.precision?.kind === 'threaded' ? ui.SUCCESS : ui.ACCENT,
            0.9
        );
        const sides = new Set(award.precision?.sides || []);
        if (sides.has('clockwise')) marks.lineBetween(-30, 4, -18, 4);
        if (sides.has('counterClockwise')) marks.lineBetween(18, 4, 30, 4);
        container.add([marks, label, points]);
        this.track(container);

        if (award.comboMilestone) this.showMilestoneRing(position, ui);

        if (SceneUI.prefersReducedMotion()) {
            this.destroyLater(container, 520);
            return;
        }
        this.scene.tweens.add({
            targets: container,
            y: container.y - 42,
            alpha: 0,
            duration: 720,
            ease: 'Cubic.easeOut',
            onComplete: () => this.destroy(container)
        });
    }

    showMilestoneRing(position, ui) {
        const ring = this.scene.add.circle(position.x, position.y, 16, ui.ACCENT, 0.04);
        ring.setStrokeStyle(3, ui.ACCENT, 0.78);
        ring.setDepth(165);
        this.track(ring);
        if (SceneUI.prefersReducedMotion()) {
            this.destroyLater(ring, 420);
            return;
        }
        this.scene.tweens.add({
            targets: ring,
            scale: 2.8,
            alpha: 0,
            duration: 560,
            ease: 'Quad.easeOut',
            onComplete: () => this.destroy(ring)
        });
    }

    showCompletion(award) {
        if (!award?.enabled || !(award.timeBonus?.points > 0)) return;
        const ui = SceneUI.getPalette(this.levelVisual?.theme);
        const panel = SceneUI.createPanel(
            this.scene,
            CONSTANTS.WIDTH / 2,
            CONSTANTS.HEIGHT / 2 + 118,
            248,
            58,
            {
                fillColor: ui.SURFACE,
                strokeColor: ui.SUCCESS,
                strokeWidth: 2,
                radius: 14,
                depth: 206
            }
        );
        const text = this.scene.add.text(
            CONSTANTS.WIDTH / 2,
            CONSTANTS.HEIGHT / 2 + 118,
            `速度奖励  +${award.timeBonus.points}`,
            {
                fontFamily: ui.DISPLAY_FONT,
                fontSize: '20px',
                color: ui.TEXT_SUCCESS,
                fontStyle: 'bold'
            }
        );
        text.setOrigin(0.5);
        text.setDepth(207);
        this.track(panel);
        this.track(text);
        if (!SceneUI.prefersReducedMotion()) {
            panel.setScale(0.94);
            text.setScale(0.94);
            this.scene.tweens.add({
                targets: [panel, text],
                scaleX: 1,
                scaleY: 1,
                duration: 180,
                ease: 'Back.easeOut'
            });
        }
        this.destroyLater(panel, 650);
        this.destroyLater(text, 650);
    }

    track(element) {
        this.active.add(element);
        return element;
    }

    destroyLater(element, delay) {
        const timer = this.scene.time.delayedCall(delay, () => {
            this.timers.delete(timer);
            this.destroy(element);
        });
        this.timers.add(timer);
    }

    destroy(element) {
        if (!element) return;
        this.active.delete(element);
        if (element.active) element.destroy();
    }

    destroyAll() {
        this.timers.forEach(timer => timer.remove(false));
        this.timers.clear();
        [...this.active].forEach(element => this.destroy(element));
    }
}
