class LevelSelectScene extends Phaser.Scene {
    constructor() {
        super({ key: 'LevelSelectScene' });
    }

    init(data = {}) {
        this.requestedPackId = data.packId || null;
        this.requestedChapterId = data.chapterId || null;
        this.requestedPage = data.page || 1;
        this.pageSize = 10;
    }

    create() {
        this.layout = LayoutManager.getSceneLayout('levelSelect');
        this.pageSize = this.layout.pageSize;
        this.themeManager = new ThemeManager();
        this.packId = APP_CONTEXT.catalog.getPack(
            this.requestedPackId || APP_CONTEXT.getActivePackId()
        ).id;
        APP_CONTEXT.setActivePackId(this.packId);
        this.pack = APP_CONTEXT.catalog.getPack(this.packId);
        this.chapters = APP_CONTEXT.catalog.listChapters(this.packId);

        const resume = APP_CONTEXT.progress.getResumeLevel(this.pack);
        const resumeChapter = APP_CONTEXT.catalog.getChapterForLevel(
            this.packId,
            resume.packLevelId || resume.id
        );
        this.chapterId = this.resolveChapterId(
            this.requestedChapterId || resumeChapter?.id
        );
        this.page = this.clampPage(this.requestedPage);

        SceneUI.createBackdrop(this, 'menu');
        this.createHeader();
        this.createPackPicker();
        this.createChapterNavigator();
        this.createLevelGrid();
        this.createDetailPanel();
        this.createKeyboardBindings();
    }

    createKeyboardBindings() {
        this.input.keyboard.on('keydown-LEFT', () => this.switchChapterByOffset(-1));
        this.input.keyboard.on('keydown-RIGHT', () => this.switchChapterByOffset(1));
        this.input.keyboard.on('keydown-UP', () => this.switchPackByOffset(-1));
        this.input.keyboard.on('keydown-DOWN', () => this.switchPackByOffset(1));
        this.input.keyboard.on('keydown-PAGEUP', () => this.switchPage(this.page - 1));
        this.input.keyboard.on('keydown-PAGEDOWN', () => this.switchPage(this.page + 1));
        this.input.keyboard.once('keydown-ESC', () => APP_CONTEXT.router.startMenu(this));
    }

    createHeader() {
        const ui = SceneUI.getPalette();
        const header = this.layout.header;
        SceneUI.createButton(
            this,
            header.menuButton.x,
            header.menuButton.y,
            '← 菜单',
            () => APP_CONTEXT.router.startMenu(this),
            {
                width: 112,
                height: 40,
                variant: 'quiet',
                fontSize: '14px'
            }
        );

        this.add.text(header.title.x, header.title.y, '关卡实验室', {
            fontFamily: ui.DISPLAY_FONT,
            fontSize: '40px',
            color: ui.TEXT_COLOR,
            fontStyle: 'bold'
        });

        const note = this.add.text(
            header.note.x,
            header.note.y,
            '任意关卡可直达\n测试不会写入进度',
            {
                fontFamily: ui.BODY_FONT,
                fontSize: '12px',
                color: ui.TEXT_MUTED,
                align: 'right',
                lineSpacing: 5
            }
        );
        note.setOrigin(1, 0);
    }

    createPackPicker() {
        const packs = APP_CONTEXT.catalog.listPacks();
        const width = Math.min(232, Math.floor(500 / Math.max(1, packs.length)) - 12);
        const gap = 12;
        const totalWidth = packs.length * width + (packs.length - 1) * gap;
        const startX = 300 - totalWidth / 2 + width / 2;

        packs.forEach((pack, index) => {
            SceneUI.createButton(
                this,
                startX + index * (width + gap),
                this.layout.packPickerY,
                pack.name,
                () => this.switchPack(pack.id),
                {
                    width,
                    height: 48,
                    variant: pack.id === this.packId ? 'primary' : 'secondary',
                    fontSize: '15px'
                }
            );
        });
    }

    createChapterNavigator() {
        const ui = SceneUI.getPalette();
        const chapterLayout = this.layout.chapter;
        const chapter = this.getCurrentChapter();
        const chapterIndex = this.chapters.findIndex(item => item.id === chapter.id);

        SceneUI.createButton(this, 84, chapterLayout.buttonY, '← 上一章', () => {
            this.switchChapterByOffset(-1);
        }, {
            width: 116,
            height: 42,
            variant: 'quiet',
            fontSize: '12px'
        });
        SceneUI.createButton(this, 516, chapterLayout.buttonY, '下一章 →', () => {
            this.switchChapterByOffset(1);
        }, {
            width: 116,
            height: 42,
            variant: 'quiet',
            fontSize: '12px'
        });

        const title = this.add.text(300, chapterLayout.titleY, chapter.title, {
            fontFamily: ui.DISPLAY_FONT,
            fontSize: '21px',
            color: ui.TEXT_COLOR,
            fontStyle: 'bold'
        });
        title.setOrigin(0.5);
        const counter = this.add.text(
            300,
            chapterLayout.counterY,
            `章节 ${chapterIndex + 1} / ${this.chapters.length}`,
            {
                fontFamily: ui.MONO_FONT,
                fontSize: '10px',
                color: ui.TEXT_MUTED,
                letterSpacing: 0.8
            }
        );
        counter.setOrigin(0.5);
    }

    createLevelGrid() {
        const levels = this.getChapterLevels();
        const pageLevels = levels.slice(
            (this.page - 1) * this.pageSize,
            this.page * this.pageSize
        );
        const grid = this.layout.grid;

        pageLevels.forEach((level, index) => {
            const column = index % grid.columns;
            const row = Math.floor(index / grid.columns);
            const x = grid.startX + column * grid.columnGap;
            const y = grid.startY + row * grid.rowGap;
            this.createLevelCard(level, x, y, index === 0);
        });

        const pageCount = this.getPageCount();
        if (pageCount > 1) {
            const ui = SceneUI.getPalette();
            SceneUI.createButton(this, 192, this.layout.paginationY, '← 上一页', () => {
                this.switchPage(this.page - 1);
            }, { width: 130, height: 38, variant: 'quiet', fontSize: '12px' });
            SceneUI.createButton(this, 408, this.layout.paginationY, '下一页 →', () => {
                this.switchPage(this.page + 1);
            }, { width: 130, height: 38, variant: 'quiet', fontSize: '12px' });
            const pageText = this.add.text(
                300,
                this.layout.paginationY,
                `${this.page} / ${pageCount}`,
                {
                    fontFamily: ui.MONO_FONT,
                    fontSize: '11px',
                    color: ui.TEXT_MUTED
                }
            );
            pageText.setOrigin(0.5);
        }
    }

    createLevelCard(level, x, y, initial = false) {
        const ui = SceneUI.getPalette();
        const config = APP_CONTEXT.catalog.getLevelConfig(this.packId, level.packLevelId || level.id);
        const unlocked = APP_CONTEXT.progress.isUnlocked(this.pack, config.packLevelId);
        const milestone = config.designIntent?.milestone;
        const container = this.add.container(x, y);
        const background = this.add.graphics();
        const number = this.add.text(0, -34, String(config.order).padStart(2, '0'), {
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
            background.fillStyle(hover ? ui.SURFACE : ui.BACKGROUND_ALT, hover ? 1 : 0.88);
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
            this.startTest(config.packLevelId);
        });
        draw(false);
        if (initial) this.initialDetailConfig = config;
    }

    createDetailPanel() {
        const ui = SceneUI.getPalette();
        const detail = this.layout.detail;
        SceneUI.createPanel(this, 300, detail.panelY, 492, detail.panelHeight, {
            fillColor: ui.SURFACE,
            strokeColor: ui.RULE,
            radius: 14,
            depth: 10
        });

        this.detailTitle = this.add.text(78, detail.titleY, '', {
            fontFamily: ui.DISPLAY_FONT,
            fontSize: '22px',
            color: ui.TEXT_COLOR,
            fontStyle: 'bold'
        });
        this.detailRule = this.add.text(78, detail.ruleY, '', {
            fontFamily: ui.BODY_FONT,
            fontSize: '14px',
            color: ui.TEXT_MUTED
        });
        this.detailMetrics = this.add.text(78, detail.metricsY, '', {
            fontFamily: ui.MONO_FONT,
            fontSize: '11px',
            color: ui.TEXT_ACCENT,
            letterSpacing: 0.4
        });
        [this.detailTitle, this.detailRule, this.detailMetrics]
            .forEach(element => element.setDepth(11));

        const footer = this.add.text(
            300,
            this.layout.footerY,
            '点击关卡立即测试 · ← → 章节 · ↑ ↓ 方案 · PgUp/PgDn 翻页',
            {
                fontFamily: ui.MONO_FONT,
                fontSize: '10px',
                color: ui.TEXT_MUTED,
                letterSpacing: 0.5
            }
        );
        footer.setOrigin(0.5);
        this.updateDetail(this.initialDetailConfig);
    }

    updateDetail(config) {
        if (!config || !this.detailTitle) return;
        const drivers = (config.difficulty.drivers || [])
            .slice(0, 2)
            .map(driver => driver.label)
            .join(' / ');
        this.detailTitle.setText(`第 ${String(config.order).padStart(2, '0')} 关 · ${config.name}`);
        this.detailRule.setText(config.rule);
        this.detailMetrics.setText(
            `难度 ${config.difficulty.score.toFixed(1)} / 100`
                + `  ·  主压力 ${drivers || '综合'}`
                + `  ·  ${config.needleCount} 针`
                + `  ·  ${config.layout.obstacleAngles.length} 障碍`
                + `  ·  ${config.rhythm.segments.length} 段`
        );
    }

    startTest(levelId) {
        APP_CONTEXT.router.startLevel(this, {
            packId: this.packId,
            levelId,
            mode: 'test'
        });
    }

    switchPack(packId) {
        APP_CONTEXT.setActivePackId(packId);
        this.scene.restart({ packId, page: 1 });
    }

    switchPackByOffset(offset) {
        const packs = APP_CONTEXT.catalog.listPacks();
        if (packs.length <= 1) return;
        const index = packs.findIndex(pack => pack.id === this.packId);
        const next = packs[(index + offset + packs.length) % packs.length];
        this.switchPack(next.id);
    }

    switchChapterByOffset(offset) {
        const index = this.chapters.findIndex(chapter => chapter.id === this.chapterId);
        const next = this.chapters[(index + offset + this.chapters.length) % this.chapters.length];
        this.scene.restart({ packId: this.packId, chapterId: next.id, page: 1 });
    }

    switchPage(page) {
        const clamped = Math.max(1, Math.min(page, this.getPageCount()));
        if (clamped === this.page) return;
        this.scene.restart({
            packId: this.packId,
            chapterId: this.chapterId,
            page: clamped
        });
    }

    resolveChapterId(chapterId) {
        return this.chapters.some(chapter => chapter.id === chapterId)
            ? chapterId
            : this.chapters[0].id;
    }

    getCurrentChapter() {
        return this.chapters.find(chapter => chapter.id === this.chapterId)
            || this.chapters[0];
    }

    getChapterLevels() {
        return APP_CONTEXT.catalog.listLevels(this.packId, this.chapterId);
    }

    getPageCount() {
        return Math.max(1, Math.ceil(this.getChapterLevels().length / this.pageSize));
    }

    clampPage(page) {
        return Math.max(1, Math.min(Math.floor(Number(page) || 1), this.getPageCount()));
    }
}
