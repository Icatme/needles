class PlaytestLevelSelectScene extends LevelSelectScene {
    createKeyboardBindings() {
        super.createKeyboardBindings();
        this.input.keyboard.on('keydown-E', () => this.exportPlaytests());
        this.input.keyboard.on('keydown-C', () => this.clearPlaytests());
    }

    createHeader() {
        super.createHeader();
        const ui = SceneUI.getPalette();
        const attemptCount = PLAYTEST_STORE.count();

        SceneUI.createButton(this, 416, 46, '导出记录', () => {
            this.exportPlaytests();
        }, {
            width: 112,
            height: 38,
            variant: 'secondary',
            fontSize: '12px'
        });
        SceneUI.createButton(this, 532, 46, '清空记录', () => {
            this.clearPlaytests();
        }, {
            width: 104,
            height: 38,
            variant: 'quiet',
            fontSize: '12px'
        });

        const count = this.add.text(
            546,
            72,
            `本地试玩记录 ${attemptCount} 条 · E 导出 · C 清空`,
            {
                fontFamily: ui.MONO_FONT,
                fontSize: '9px',
                color: attemptCount > 0 ? ui.TEXT_ACCENT : ui.TEXT_MUTED,
                letterSpacing: 0.4
            }
        );
        count.setOrigin(1, 0);
        count.setDepth(20);
    }

    exportPlaytests() {
        const bundle = PLAYTEST_STORE.exportBundle();
        const date = bundle.exportedAt.slice(0, 10);
        const fileName = `needles-playtests-${date}.json`;
        const json = JSON.stringify(bundle, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName;
        link.style.display = 'none';
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
    }

    clearPlaytests() {
        PLAYTEST_STORE.clear();
        this.scene.restart({
            packId: this.packId,
            chapterId: this.chapterId,
            page: this.page
        });
    }
}
