const VISUAL_THEMES = Object.freeze([
    Object.freeze({
        id: 'clockwork-observatory',
        name: '机械天文台',
        caption: '刻度与机芯',
        catalog: WHEEL_VISUALS
    }),
    Object.freeze({
        id: 'gilded-jewel-box',
        name: '鎏光宝匣',
        caption: '彩宝与手镯',
        catalog: JEWEL_VISUALS
    })
]);

class ThemeManager {
    constructor() {
        this.activeThemeId = this.loadTheme();
    }

    getThemes() {
        return VISUAL_THEMES;
    }

    getActiveTheme() {
        return this.getTheme(this.activeThemeId);
    }

    getTheme(themeId) {
        return VISUAL_THEMES.find(theme => theme.id === themeId) || VISUAL_THEMES[0];
    }

    setActiveTheme(themeId) {
        const theme = VISUAL_THEMES.find(candidate => candidate.id === themeId);
        if (!theme) return false;

        this.activeThemeId = theme.id;
        try {
            localStorage.setItem(CONSTANTS.THEME_STORAGE_KEY, theme.id);
        } catch (error) {
            console.warn('无法保存视觉主题:', error);
        }
        return true;
    }

    getLevelVisual(levelId) {
        const theme = this.getActiveTheme();
        const parsed = Math.floor(Number(levelId) || 1);
        const index = Math.max(0, Math.min(parsed - 1, theme.catalog.length - 1));
        return theme.catalog[index];
    }

    loadTheme() {
        try {
            const saved = localStorage.getItem(CONSTANTS.THEME_STORAGE_KEY);
            if (VISUAL_THEMES.some(theme => theme.id === saved)) return saved;
        } catch (error) {
            console.warn('无法读取视觉主题:', error);
        }
        return VISUAL_THEMES[0].id;
    }
}
