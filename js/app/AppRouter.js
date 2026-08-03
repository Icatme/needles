class AppRouter {
    constructor(options = {}) {
        this.catalog = options.catalog;
    }

    createLevelRoute({ packId, levelId, mode = 'progression' }) {
        const pack = this.catalog.getPack(packId);
        const level = this.catalog.getLevel(pack.id, levelId);
        return Object.freeze({
            type: 'level',
            packId: pack.id,
            levelId: level.packLevelId || level.id,
            mode: mode === 'test' ? 'test' : 'progression'
        });
    }

    normalizeLevelRoute(data = {}, fallback = {}) {
        const source = data?.route || data || {};
        const packId = source.packId
            || fallback.packId
            || this.catalog.getDefaultPackId();
        const pack = this.catalog.getPack(packId);
        const levelRef = source.levelId
            ?? source.level
            ?? fallback.levelId
            ?? pack.levels[0].packLevelId
            ?? pack.levels[0].id;

        return this.createLevelRoute({
            packId: pack.id,
            levelId: levelRef,
            mode: source.mode || fallback.mode || 'progression'
        });
    }

    nextLevelRoute(route) {
        const normalized = this.normalizeLevelRoute(route);
        const next = this.catalog.getNextLevel(
            normalized.packId,
            normalized.levelId
        );
        return next
            ? this.createLevelRoute({
                packId: normalized.packId,
                levelId: next.packLevelId || next.id,
                mode: normalized.mode
            })
            : null;
    }

    startLevel(scene, route) {
        scene.scene.start('GameScene', {
            route: this.normalizeLevelRoute(route)
        });
    }

    startMenu(scene) {
        scene.scene.start('MenuScene');
    }

    startLevelBrowser(scene, options = {}) {
        scene.scene.start('LevelSelectScene', { ...options });
    }

    startResult(scene, payload) {
        scene.scene.start('GameOverScene', {
            ...payload,
            route: this.normalizeLevelRoute(payload.route)
        });
    }
}
