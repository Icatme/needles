class ThemeManager {
    constructor(options = {}) {
        this.registry = options.registry || VISUAL_SKIN_REGISTRY;
        this.resolver = options.resolver || new VisualResolver();
        this.storage = options.storage === undefined
            ? ThemeManager.getDefaultStorage()
            : options.storage;
        this.activeThemeId = this.loadTheme();
    }

    static getDefaultStorage() {
        try {
            return typeof localStorage !== 'undefined' ? localStorage : null;
        } catch (error) {
            return null;
        }
    }

    getThemes() {
        return this.registry.getSummaries();
    }

    getActiveTheme() {
        return this.getTheme(this.activeThemeId);
    }

    getTheme(themeId) {
        return this.registry.get(this.registry.resolveId(themeId));
    }

    setActiveTheme(themeId) {
        const theme = this.registry.get(themeId);
        if (!theme) return false;

        this.activeThemeId = theme.id;
        if (this.storage) {
            try {
                this.storage.setItem(CONSTANTS.THEME_STORAGE_KEY, theme.id);
            } catch (error) {
                console.warn('无法保存视觉主题:', error);
            }
        }
        return true;
    }

    getLevelVisual(levelOrId) {
        const skin = this.getActiveTheme();
        const level = levelOrId && typeof levelOrId === 'object'
            ? levelOrId
            : this.createLegacyLevelReference(skin, levelOrId);
        return this.resolver.resolve(skin, level);
    }

    getUIThemeId(themeId = this.activeThemeId) {
        return this.registry.getChannelThemeId(themeId, 'ui');
    }

    getBackgroundThemeId(themeId = this.activeThemeId) {
        return this.registry.getChannelThemeId(themeId, 'background');
    }

    createLegacyLevelReference(skin, levelId) {
        const parsed = Math.floor(Number(levelId) || 1);
        const maximum = Math.max(
            1,
            ...skin.presets.map((preset, index) => (
                Number.isFinite(Number(preset.id)) ? Number(preset.id) : index + 1
            ))
        );
        const order = Math.max(1, Math.min(parsed, maximum));
        const familyCount = Math.max(1, skin.familyOrder.length);
        const variantsPerFamily = Math.max(
            1,
            Math.ceil(skin.presets.length / familyCount)
        );
        const tier = Math.max(
            1,
            Math.min(Math.ceil(order / variantsPerFamily), familyCount)
        );

        return {
            id: order,
            order,
            packLevelId: `legacy-visual-${order}`,
            chapter: tier,
            chapterId: `chapter-${tier}`,
            presentation: {
                tier,
                milestone: order % variantsPerFamily === 0
            },
            designIntent: {
                tier,
                milestone: order % variantsPerFamily === 0
            }
        };
    }

    loadTheme() {
        let saved = null;
        if (this.storage) {
            try {
                saved = this.storage.getItem(CONSTANTS.THEME_STORAGE_KEY);
            } catch (error) {
                console.warn('无法读取视觉主题:', error);
            }
        }
        return this.registry.resolveId(saved);
    }
}
