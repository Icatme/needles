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
        const layout = LayoutManager.getSceneLayout('boot');
        this.layout = layout;
        SceneUI.createBackdrop(this, 'boot');

        const mark = this.add.graphics();
        mark.setPosition(layout.mark.x, layout.mark.y);
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

        const label = this.add.text(layout.label.x, layout.label.y, 'NEEDLES / 01', {
            fontFamily: ui.MONO_FONT,
            fontSize: '12px',
            color: ui.TEXT_ACCENT,
            letterSpacing: 1.6
        });

        const title = this.add.text(layout.title.x, layout.title.y, '见缝插针', {
            fontFamily: ui.DISPLAY_FONT,
            fontSize: '48px',
            color: ui.TEXT_COLOR,
            fontStyle: 'bold'
        });

        const status = this.add.text(layout.status.x, layout.status.y, '正在读取关卡包…', {
            fontFamily: ui.BODY_FONT,
            fontSize: '16px',
            color: ui.TEXT_MUTED
        });

        const track = this.add.rectangle(
            layout.track.x,
            layout.track.y,
            layout.track.width,
            4,
            ui.RULE
        );
        track.setOrigin(0, 0.5);
        const progress = this.add.rectangle(
            layout.track.x,
            layout.track.y,
            layout.track.width,
            4,
            ui.ACCENT
        );
        progress.setOrigin(0, 0.5);
        progress.setScale(0.04, 1);

        [mark, label, title, status, track, progress]
            .forEach(element => element.setDepth(10));
        this.loadLevelPacks(status, progress, ui);
    }

    async loadLevelPacks(status, progress, ui) {
        const loader = new PackLoader({ registry: LEVEL_PACK_REGISTRY });

        try {
            const result = await loader.loadIndex('packs/index.json', state => {
                if (state.phase !== 'packs') return;
                const ratio = state.total > 0 ? state.completed / state.total : 0;
                progress.setScale(Math.max(0.04, ratio), 1);
                status.setText(`正在校验关卡包 ${state.completed} / ${state.total}…`);
            });

            progress.setScale(1, 1);
            const levelCount = result.loadedPacks.reduce(
                (sum, pack) => sum + pack.levels.length,
                0
            );
            const destination = PREVIEW_OPTIONS.resolve(APP_CONTEXT);
            status.setText(
                PREVIEW_OPTIONS.enabled
                    ? this.getPreviewStatus(destination)
                    : (result.errors.length > 0
                        ? `已载入 ${result.loadedPacks.length} 个包；${result.errors.length} 个包不可用`
                        : `已载入 ${result.loadedPacks.length} 个关卡包 · ${levelCount} 关`)
            );

            this.time.delayedCall(SceneUI.prefersReducedMotion() ? 80 : 260, () => {
                this.scene.start(destination.scene, destination.data);
            });
        } catch (error) {
            console.error('关卡包启动失败:', error);
            status.setColor(ui.TEXT_ERROR);
            status.setText(
                PREVIEW_OPTIONS.enabled
                    ? `预览启动失败：${error.message}`
                    : '关卡包加载失败，请检查文件或刷新重试。'
            );
            progress.setFillStyle(ui.ERROR);
            progress.setScale(1, 1);

            SceneUI.createButton(this, 300, this.layout.retryY, '重新加载', () => {
                this.scene.restart();
            }, {
                width: 220,
                height: 50,
                variant: 'danger'
            });
        }
    }

    getPreviewStatus(destination) {
        if (destination.scene === 'GameScene') {
            return `预览关卡 · ${destination.data.route.packId} / ${destination.data.route.levelId}`;
        }
        if (destination.scene === 'LevelSelectScene') {
            return `预览实验室 · ${destination.data.packId}`;
        }
        return PREVIEW_OPTIONS.packId
            ? `预览关卡包 · ${PREVIEW_OPTIONS.packId}`
            : '预览外观已应用';
    }
}
