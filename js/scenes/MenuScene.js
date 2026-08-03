class MenuScene extends Phaser.Scene {
    constructor() {
        super({ key: 'MenuScene' });
    }

    create() {
        this.levelManager = new LevelManager();
        this.themeManager = new ThemeManager();
        this.themeOptions = [];
        SceneUI.createBackdrop(this, 'menu');
        this.createBrandMark();
        this.createTitle();
        this.createProgressReadout();
        this.createThemePicker();
        this.createButtons();

        this.input.keyboard.once('keydown-ENTER', () => {
            this.startGame(this.levelManager.maxUnlockedLevel);
        });
        this.input.keyboard.on('keydown-LEFT', () => this.selectThemeByOffset(-1));
        this.input.keyboard.on('keydown-RIGHT', () => this.selectThemeByOffset(1));
    }

    createBrandMark() {
        this.brandGraphics = this.add.graphics();
        this.brandGraphics.setPosition(470, 198);
        this.drawBrandMark();
    }

    drawBrandMark() {
        const graphics = this.brandGraphics;
        const ui = SceneUI.getPalette();
        graphics.clear();

        if (this.themeManager.activeThemeId === 'gilded-jewel-box') {
            const metal = CONSTANTS.JEWEL.METALS.ROSE_GOLD;
            graphics.lineStyle(3, metal, 1);
            graphics.strokeCircle(0, 0, 54);
            graphics.lineStyle(1, CONSTANTS.JEWEL.METALS.PLATINUM, 0.78);
            graphics.strokeCircle(0, 0, 39);
            GemRenderer.draw(graphics, 0, 0, 20, 'princess', 'morganite', Math.PI / 4, {
                outlineColor: metal,
                outlineWidth: 2,
                shadow: false
            });
            graphics.lineStyle(4, ui.INK, 1);
            graphics.lineBetween(0, 72, 0, 120);
            graphics.lineStyle(1, metal, 1);
            graphics.lineBetween(0, 72, 0, 120);
            graphics.fillStyle(ui.INK, 1);
            graphics.fillTriangle(-6, 74, 6, 74, 0, 60);
            GemRenderer.draw(graphics, 0, 135, 13, 'pear', 'ruby', 0, {
                outlineColor: metal,
                outlineWidth: 2,
                shadow: true
            });
            return;
        }

        graphics.lineStyle(3, ui.INK, 1);
        graphics.strokeCircle(0, 0, 54);
        graphics.lineStyle(2, ui.RULE, 1);
        graphics.strokeCircle(0, 0, 38);
        graphics.fillStyle(ui.INK, 1);
        graphics.fillCircle(0, 0, 12);
        graphics.lineStyle(4, ui.INK, 1);
        graphics.lineBetween(0, 72, 0, 126);
        graphics.fillStyle(ui.ACCENT, 1);
        graphics.fillTriangle(-6, 74, 6, 74, 0, 60);
        graphics.fillCircle(0, 135, 12);
        graphics.lineStyle(2, ui.INK, 1);
        graphics.strokeCircle(0, 135, 12);
    }

    createThemePicker() {
        const ui = SceneUI.getPalette();
        const label = this.add.text(82, 454, '外观主题  ·  ← → 切换', {
            fontFamily: ui.BODY_FONT,
            fontSize: '13px',
            color: ui.TEXT_MUTED
        });
        label.setDepth(20);

        this.themeManager.getThemes().forEach((theme, index) => {
            this.themeOptions.push(this.createThemeOption(theme, index === 0 ? 190 : 410));
        });
    }

    createThemeOption(theme, x) {
        const ui = SceneUI.getPalette();
        const width = 204;
        const height = 52;
        const container = this.add.container(x, 494);
        const background = this.add.graphics();
        const icon = this.add.graphics();
        const title = this.add.text(-54, -9, theme.name, {
            fontFamily: ui.DISPLAY_FONT,
            fontSize: '16px',
            color: ui.TEXT_COLOR,
            fontStyle: 'bold'
        });
        const caption = this.add.text(-54, 10, theme.caption, {
            fontFamily: ui.BODY_FONT,
            fontSize: '11px',
            color: ui.TEXT_MUTED
        });

        icon.setPosition(-78, 0);
        title.setOrigin(0, 0.5);
        caption.setOrigin(0, 0.5);
        container.add([background, icon, title, caption]);
        container.setSize(width, height);
        container.setDepth(25);
        container.setInteractive({ useHandCursor: true });

        const draw = (state = 'default') => {
            const selected = this.themeManager.activeThemeId === theme.id;
            const isJewel = theme.id === 'gilded-jewel-box';
            const selectedColor = isJewel ? CONSTANTS.JEWEL.METALS.ROSE_GOLD : ui.INK;
            background.clear();
            background.fillStyle(
                state === 'hover' ? ui.BACKGROUND_ALT : (selected ? ui.SURFACE : ui.BACKGROUND),
                1
            );
            background.fillRoundedRect(-width / 2, -height / 2, width, height, 10);
            background.lineStyle(selected ? 2 : 1, selected ? selectedColor : ui.RULE, 1);
            background.strokeRoundedRect(-width / 2, -height / 2, width, height, 10);

            if (selected) {
                background.fillStyle(selectedColor, 1);
                background.fillTriangle(84, -4, 92, 0, 84, 4);
            }

            icon.clear();
            if (isJewel) {
                GemRenderer.draw(icon, 0, 0, 12, 'princess', 'morganite', Math.PI / 4, {
                    outlineColor: CONSTANTS.JEWEL.METALS.ROSE_GOLD,
                    outlineWidth: 2,
                    shadow: false
                });
            } else {
                icon.lineStyle(2, ui.INK, 1);
                icon.strokeCircle(0, 0, 12);
                icon.lineStyle(1, ui.STEEL, 0.82);
                icon.strokeCircle(0, 0, 7);
                for (let index = 0; index < 4; index++) {
                    const angle = index * Math.PI / 2;
                    icon.lineBetween(
                        Math.cos(angle) * 8,
                        Math.sin(angle) * 8,
                        Math.cos(angle) * 12,
                        Math.sin(angle) * 12
                    );
                }
                icon.fillStyle(ui.ACCENT, 1);
                icon.fillCircle(0, 0, 2.5);
            }
        };

        container.redraw = draw;
        container.on('pointerover', () => draw('hover'));
        container.on('pointerout', () => {
            container.setScale(1);
            draw();
        });
        container.on('pointerdown', () => container.setScale(0.98));
        container.on('pointerup', () => {
            container.setScale(1);
            this.selectTheme(theme.id);
        });
        draw();
        return container;
    }

    selectTheme(themeId) {
        if (!this.themeManager.setActiveTheme(themeId)) return;
        this.scene.restart();
    }

    selectThemeByOffset(offset) {
        const themes = this.themeManager.getThemes();
        const currentIndex = themes.findIndex(theme => (
            theme.id === this.themeManager.activeThemeId
        ));
        const nextIndex = (currentIndex + offset + themes.length) % themes.length;
        this.selectTheme(themes[nextIndex].id);
    }

    createTitle() {
        const ui = SceneUI.getPalette();

        this.kickerText = this.add.text(56, 92, 'OBSERVE · AIM · INSERT', {
            fontFamily: ui.MONO_FONT,
            fontSize: '12px',
            color: ui.TEXT_ACCENT,
            letterSpacing: 1.8
        });

        this.titleText = this.add.text(52, 126, '见缝\n插针', {
            fontFamily: ui.DISPLAY_FONT,
            fontSize: '68px',
            color: ui.TEXT_COLOR,
            fontStyle: 'bold',
            lineSpacing: -12
        });

        this.subtitleText = this.add.text(56, 292, '观察旋转，抓住空隙。\n一次一针。', {
            fontFamily: ui.BODY_FONT,
            fontSize: '18px',
            color: ui.TEXT_MUTED,
            lineSpacing: 8
        });

        if (!SceneUI.prefersReducedMotion()) {
            [this.kickerText, this.titleText, this.subtitleText].forEach(element => element.setAlpha(0));
            this.tweens.add({
                targets: [this.kickerText, this.titleText, this.subtitleText],
                alpha: 1,
                duration: 380,
                ease: 'Expo.easeOut'
            });
        }
    }

    createProgressReadout() {
        const ui = SceneUI.getPalette();
        const currentConfig = this.levelManager.getLevelConfig(
            this.levelManager.maxUnlockedLevel
        );
        SceneUI.createPanel(this, 300, 398, 488, 82, {
            fillColor: ui.SURFACE,
            strokeColor: ui.RULE,
            radius: 14,
            depth: 10
        });

        const label = this.add.text(82, 369, '当前进度', {
            fontFamily: ui.BODY_FONT,
            fontSize: '14px',
            color: ui.TEXT_MUTED
        });
        label.setDepth(11);

        const value = this.add.text(
            82,
            410,
            `第 ${this.levelManager.maxUnlockedLevel} 关 · ${currentConfig.name}`,
            {
            fontFamily: ui.DISPLAY_FONT,
            fontSize: '24px',
            color: ui.TEXT_COLOR,
            fontStyle: 'bold'
            }
        );
        value.setOrigin(0, 0.5);
        value.setDepth(11);

        const status = this.add.text(518, 398, currentConfig.rule, {
            fontFamily: ui.BODY_FONT,
            fontSize: '12px',
            color: ui.TEXT_ACCENT,
            letterSpacing: 1
        });
        status.setOrigin(1, 0.5);
        status.setDepth(11);
    }

    createButtons() {
        const ui = SceneUI.getPalette();
        const hasProgress = this.levelManager.maxUnlockedLevel > 1;
        const primaryLabel = hasProgress
            ? `继续第 ${this.levelManager.maxUnlockedLevel} 关`
            : '开始第 1 关';
        const primaryLevel = hasProgress ? this.levelManager.maxUnlockedLevel : 1;

        SceneUI.createButton(this, 300, 568, primaryLabel, () => {
            this.startGame(primaryLevel);
        }, { width: 300, variant: 'primary' });

        if (hasProgress) {
            SceneUI.createButton(this, 300, 632, '从第 1 关开始', () => {
                this.startGame(1);
            }, { width: 300, variant: 'secondary' });
        }

        SceneUI.createButton(this, 300, hasProgress ? 700 : 648, '重置进度', () => {
            this.confirmReset();
        }, { width: 170, height: 48, variant: 'quiet', fontSize: '15px' });

        const shortcut = this.add.text(300, 760, 'ENTER 开始  ·  SPACE 发射', {
            fontFamily: ui.MONO_FONT,
            fontSize: '11px',
            color: ui.TEXT_MUTED,
            letterSpacing: 1
        });
        shortcut.setOrigin(0.5);
    }

    startGame(level) {
        this.scene.start('GameScene', { level });
    }

    confirmReset() {
        if (this.resetModal) return;

        const ui = SceneUI.getPalette();
        const overlay = this.add.rectangle(
            CONSTANTS.WIDTH / 2,
            CONSTANTS.HEIGHT / 2,
            CONSTANTS.WIDTH,
            CONSTANTS.HEIGHT,
            ui.INK,
            0.66
        );
        overlay.setDepth(300);
        overlay.setInteractive();

        const panel = SceneUI.createPanel(this, 300, 390, 470, 260, {
            fillColor: ui.SURFACE,
            strokeColor: ui.INK,
            strokeWidth: 2,
            radius: 18,
            depth: 301
        });
        const label = this.add.text(96, 304, '清除本地记录', {
            fontFamily: ui.MONO_FONT,
            fontSize: '12px',
            color: ui.TEXT_ERROR,
            letterSpacing: 1.2
        });
        label.setDepth(302);
        const title = this.add.text(96, 338, '重置全部进度？', {
            fontFamily: ui.DISPLAY_FONT,
            fontSize: '30px',
            color: ui.TEXT_COLOR,
            fontStyle: 'bold'
        });
        title.setDepth(302);
        const description = this.add.text(96, 386, '已解锁的关卡会被清除，且无法撤销。', {
            fontFamily: ui.BODY_FONT,
            fontSize: '16px',
            color: ui.TEXT_MUTED
        });
        description.setDepth(302);

        const cleanup = () => {
            this.resetModal.forEach(element => element.destroy());
            this.resetModal = null;
        };

        const cancelButton = SceneUI.createButton(this, 190, 464, '保留进度', cleanup, {
            width: 176,
            height: 50,
            variant: 'secondary',
            depth: 302
        });
        const resetButton = SceneUI.createButton(this, 410, 464, '确认重置', () => {
            this.levelManager.resetProgress();
            cleanup();
            this.scene.restart();
        }, {
            width: 176,
            height: 50,
            variant: 'danger',
            depth: 302
        });

        this.resetModal = [overlay, panel, label, title, description, cancelButton, resetButton];
    }
}
