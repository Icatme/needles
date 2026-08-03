class BootScene extends Phaser.Scene {
    constructor() {
        super({ key: 'BootScene' });
    }

    preload() {
        this.load.image(
            'jewel-wheel-specular',
            'assets/jewel-shine/wheel-specular-bold-512.png'
        );
        this.load.image(
            'jewel-gem-catchlight',
            'assets/jewel-shine/gem-catchlight-luminous-512.png'
        );
    }

    create() {
        const ui = SceneUI.getPalette();
        SceneUI.createBackdrop(this, 'boot');

        const mark = this.add.graphics();
        mark.setPosition(84, 302);
        mark.lineStyle(3, ui.INK, 1);
        mark.strokeCircle(0, 0, 28);
        mark.fillStyle(ui.ACCENT, 1);
        mark.fillCircle(0, 0, 7);
        mark.lineStyle(3, ui.INK, 1);
        mark.lineBetween(0, 42, 0, 96);
        mark.fillTriangle(-5, 44, 5, 44, 0, 33);
        mark.fillStyle(ui.SURFACE, 1);
        mark.fillCircle(0, 106, 10);
        mark.lineStyle(2, ui.INK, 1);
        mark.strokeCircle(0, 106, 10);

        const label = this.add.text(132, 264, 'NEEDLES / 01', {
            fontFamily: ui.MONO_FONT,
            fontSize: '12px',
            color: ui.TEXT_ACCENT,
            letterSpacing: 1.6
        });

        const title = this.add.text(128, 292, '见缝插针', {
            fontFamily: ui.DISPLAY_FONT,
            fontSize: '48px',
            color: ui.TEXT_COLOR,
            fontStyle: 'bold'
        });

        const status = this.add.text(132, 354, '正在校准转盘…', {
            fontFamily: ui.BODY_FONT,
            fontSize: '16px',
            color: ui.TEXT_MUTED
        });

        const track = this.add.rectangle(132, 398, 336, 4, ui.RULE);
        track.setOrigin(0, 0.5);
        const progress = this.add.rectangle(132, 398, 336, 4, ui.ACCENT);
        progress.setOrigin(0, 0.5);
        progress.setScale(0, 1);

        if (SceneUI.prefersReducedMotion()) {
            progress.setScale(1, 1);
        } else {
            this.tweens.add({
                targets: progress,
                scaleX: 1,
                duration: 360,
                ease: 'Sine.easeInOut'
            });
        }

        [mark, label, title, status, track, progress].forEach(element => element.setDepth(10));

        this.time.delayedCall(SceneUI.prefersReducedMotion() ? 80 : 430, () => {
            this.scene.start('MenuScene');
        });
    }
}
