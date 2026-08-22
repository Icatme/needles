class ScoringMenuScene extends EnhancedMenuScene {
    create() {
        if (!APP_CONTEXT.preferences) {
            APP_CONTEXT.preferences = new GamePreferencesStore();
        }
        super.create();
        this.createScoringToggle();
        this.input.keyboard.once('keydown-S', () => this.toggleScoring());
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

    toggleScoring() {
        APP_CONTEXT.preferences.toggleScoring();
        this.scene.restart();
    }
}
