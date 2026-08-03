class LevelSelectScene extends Phaser.Scene {
    constructor() {
        super({ key: 'LevelSelectScene' });
    }

    init(data) {
        this.requestedPackId = data?.packId || null;
        this.requestedChapter = data?.chapter || null;
    }

    create() {
        this.themeManager = new ThemeManager();
        this.levelManager = new LevelManager(this.requestedPackId);

        if (this.requestedPackId) {
            this.levelManager.setActivePack(this.requestedPackId);
        }

        this.chapter = this.clampChapter(
            this.requestedChapter
                || Math.ceil(this.levelManager.maxUnlockedLevel / 10)
        );

        SceneUI.createBackdrop(this, 'menu');
        this.createHeader();
        this.createPackPicker();
        this.createChapterPicker();
        this.createLevelGrid();
        this.createDetailPanel();

        this.input.keyboard.on('keydown-LEFT', () => {
            this.switchChapter(this.chapter - 1);
        });
        this.input.keyboard.on('keydown-RIGHT', () => {
            this.switchChapter(this.chapter + 1);
        });
        this.input.keyboard.on('keydown-UP', () => this.switchPackByOffset(-1));
        this.input.keyboard.on('keydown-DOWN', () => this.switchPackByOffset(1));
        this.input.keyboard.once('keydown-ESC', () => this.scene.start('MenuScene'));
    }

    createHeader() {
        const ui = SceneUI.getPalette();
        SceneUI.createButton(this, 74, 50, '← 菜单', () => {
            this.scene.start('MenuScene');
        }, {
            width: 112,
            height: 40,
            variant: 'quiet',
            fontSize: '14px'
        });

        this.add.text(54, 82, '关卡实验室', {
            fontFamily: ui.DISPLAY_FONT,
            fontSize: '40px',
            color: ui.TEXT_COLOR,
            fontStyle: 'bold'
        });

        const note = this.add.text(546, 98, '任意关卡可直达\n测试不写入解锁进度', {
            fontFamily: ui.BODY_FONT,
            fontSize: '12px',
            color: ui.TEXT_MUTED,
            align: 'right',
            lineSpacing: 5
        });
        note.setOrigin(1, 0);
    }

    createPackPicker() {
        const packs = this.levelManager.getPacks();

        packs.forEach((pack, index) => {
            const active = pack.id === this.levelManager.activePackId;
            const x = packs.length === 1
                ? 300
                : 172 + index * 256;

            SceneUI.createButton(this, x, 164, pack.name, () => {
                this.switchPack(pack.id);
            }, {
                width: packs.length === 1 ? 280 : 232,
                height: 48,
                variant: active ? 'primary' : 'secondary',
                fontSize: '15px'
            });
        });
    }

    createChapterPicker() {
        const pack = this.levelManager.getActivePack();
        const ui = SceneUI.getPalette();
        const chapters = pack.chapters || [];

        chapters.forEach((name, index) => {
            const chapter = index + 1;
            const active = chapter === this.chapter;
            SceneUI.createButton(this, 78 + index * 111, 226, `${chapter} · ${name}`, () => {
                this.switchChapter(chapter);
            }, {
                width: 101,
                height: 42,
                variant: active ? 'primary' : 'quiet',
                fontSize: '12px'
            });
        });

        const hint = this.add.text(546, 259, '← → 章节  ·  ↑ ↓ 方案', {
            fontFamily: ui.MONO_FONT,
            fontSize: '10px',
            color: ui.TEXT_MUTED,
            letterSpacing: 0.7
        });
        hint.setOrigin(1, 0.5);
    }

    createLevelGrid() {
        const startLevel = (this.chapter - 1) * 10 + 1;

        for (let index = 0; index < 10; index++) {
            const levelId = startLevel + index;
            const column = index % 5;
            const row = Math.floor(index / 5);
            const x = 80 + column * 110;
            const y = 342 + row * 128;
            this.createLevelCard(levelId, x, y);
        }
    }

    createLevelCard(levelId, x, y) {
        const ui = SceneUI.getPalette();
        const config = this.levelManager.getLevelConfig(levelId);
        const unlocked = levelId <= this.levelManager.maxUnlockedLevel;
        const milestone = config.designIntent?.milestone;
        const container = this.add.container(x, y);
        const background = this.add.graphics();
        const number = this.add.text(0, -34, String(levelId).padStart(2, '0'), {
            fontFamily: ui.MONO_FONT,
            fontSize: '14px',
            color: milestone ? ui.TEXT_ACCENT : ui.TEXT_MUTED,
            letterSpacing: 1
        });
        const name = this.add.text(0, -5, config.name, {
            fontFamily: ui.DISPLAY_FONT,
            fontSize: '16px',
            color: ui.TEXT_COLOR,
            fontStyle: 'bold',
            align: 'center',
            wordWrap: { width: 88 }
        });
        const score = this.add.text(0, 34, `D ${config.difficulty.score.toFixed(1)}`, {
            fontFamily: ui.MONO_FONT,
            fontSize: '11px',
            color: ui.TEXT_MUTED
        });
        const status = this.add.text(38, -42, unlocked ? '●' : 'TEST', {
            fontFamily: ui.MONO_FONT,
            fontSize: unlocked ? '9px' : '8px',
            color: unlocked ? ui.TEXT_SUCCESS : ui.TEXT_ACCENT
        });

        [number, name, score].forEach(text => text.setOrigin(0.5));
        status.setOrigin(1, 0);
        container.add([background, number, name, score, status]);
        container.setSize(100, 112);
        container.setDepth(20);
        container.setInteractive({ useHandCursor: true });

        const draw = (hover = false) => {
            background.clear();
            background.fillStyle(
                hover ? ui.SURFACE : ui.BACKGROUND_ALT,
                hover ? 1 : 0.88
            );
            background.fillRoundedRect(-50, -56, 100, 112, 12);
            background.lineStyle(
                milestone ? 2 : 1,
                milestone ? ui.ACCENT : (hover ? ui.INK : ui.RULE),
                1
            );
            background.strokeRoundedRect(-50, -56, 100, 112, 12);
            if (milestone) {
                background.fillStyle(ui.ACCENT, 1);
                background.fillTriangle(40, -56, 50, -56, 50, -46);
            }
        };

        container.on('pointerover', () => {
            draw(true);
            this.updateDetail(config);
        });
        container.on('pointerout', () => {
            container.setScale(1);
            draw(false);
        });
        container.on('pointerdown', () => container.setScale(0.97));
        container.on('pointerup', () => {
            container.setScale(1);
            this.startTest(levelId);
        });
        draw(false);

        if (levelId === (this.chapter - 1) * 10 + 1) {
            this.initialDetailConfig = config;
        }
    }

    createDetailPanel() {
        const ui = SceneUI.getPalette();
        SceneUI.createPanel(this, 300, 626, 492, 126, {
            fillColor: ui.SURFACE,
            strokeColor: ui.RULE,
            radius: 14,
            depth: 10
        });

        this.detailTitle = this.add.text(78, 584, '', {
            fontFamily: ui.DISPLAY_FONT,
            fontSize: '22px',
            color: ui.TEXT_COLOR,
            fontStyle: 'bold'
        });
        this.detailRule = this.add.text(78, 616, '', {
            fontFamily: ui.BODY_FONT,
            fontSize: '14px',
            color: ui.TEXT_MUTED
        });
        this.detailMetrics = this.add.text(78, 652, '', {
            fontFamily: ui.MONO_FONT,
            fontSize: '11px',
            color: ui.TEXT_ACCENT,
            letterSpacing: 0.4
        });
        [this.detailTitle, this.detailRule, this.detailMetrics]
            .forEach(element => element.setDepth(11));

        const footer = this.add.text(300, 746, '点击关卡立即测试  ·  ESC 返回菜单', {
            fontFamily: ui.MONO_FONT,
            fontSize: '11px',
            color: ui.TEXT_MUTED,
            letterSpacing: 0.8
        });
        footer.setOrigin(0.5);

        this.updateDetail(this.initialDetailConfig);
    }

    updateDetail(config) {
        if (!config || !this.detailTitle) return;

        const drivers = (config.difficulty.drivers || [])
            .slice(0, 2)
            .map(driver => driver.label)
            .join(' / ');
        const segmentCount = config.rhythm.segments.length;
        const obstacleCount = config.layout.obstacleAngles.length;

        this.detailTitle.setText(
            `第 ${String(config.id).padStart(2, '0')} 关 · ${config.name}`
        );
        this.detailRule.setText(config.rule);
        this.detailMetrics.setText(
            `难度 ${config.difficulty.score.toFixed(1)} / 100`
                + `  ·  主压力 ${drivers || '综合'}`
                + `  ·  ${config.needleCount} 针`
                + `  ·  ${obstacleCount} 障碍`
                + `  ·  ${segmentCount} 段`
        );
    }

    startTest(levelId) {
        try {
            if (typeof sessionStorage !== 'undefined') {
                sessionStorage.setItem('needle_game_test_mode', '1');
            }
        } catch (error) {
            console.warn('无法进入测试模式:', error);
        }
        this.scene.start('GameScene', { level: levelId });
    }

    switchPack(packId) {
        this.levelManager.setActivePack(packId);
        this.scene.restart({
            packId,
            chapter: this.clampChapter(this.chapter)
        });
    }

    switchPackByOffset(offset) {
        const packs = this.levelManager.getPacks();
        if (packs.length <= 1) return;

        const currentIndex = packs.findIndex(pack => (
            pack.id === this.levelManager.activePackId
        ));
        const nextIndex = (currentIndex + offset + packs.length) % packs.length;
        this.switchPack(packs[nextIndex].id);
    }

    switchChapter(chapter) {
        const clamped = this.clampChapter(chapter);
        if (clamped === this.chapter) return;
        this.scene.restart({
            packId: this.levelManager.activePackId,
            chapter: clamped
        });
    }

    clampChapter(chapter) {
        const chapterCount = Math.ceil(this.levelManager.getLevelCount() / 10);
        return Math.max(1, Math.min(Math.floor(Number(chapter) || 1), chapterCount));
    }
}
