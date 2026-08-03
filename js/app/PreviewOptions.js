class PreviewOptions {
    constructor(values = {}) {
        this.packId = values.packId || null;
        this.levelId = values.levelId ?? null;
        this.mode = values.mode || 'test';
        this.skinId = values.skinId || null;
        this.lab = Boolean(values.lab);
        this.chapterId = values.chapterId || null;
        this.page = Number.isInteger(values.page) && values.page > 0
            ? values.page
            : 1;
        this.enabled = Boolean(
            this.packId
            || this.levelId !== null
            || this.skinId
            || this.lab
            || this.chapterId
        );
    }

    static fromLocation(locationObject = null) {
        const location = locationObject
            || (typeof window !== 'undefined' ? window.location : null);
        if (!location) return new PreviewOptions();
        const params = new URLSearchParams(location.search || '');
        const level = params.get('level');
        const page = Number(params.get('page'));
        return new PreviewOptions({
            packId: PreviewOptions.clean(params.get('pack')),
            levelId: level === null ? null : PreviewOptions.clean(level),
            mode: PreviewOptions.clean(params.get('mode')) || 'test',
            skinId: PreviewOptions.clean(params.get('skin')),
            lab: PreviewOptions.boolean(params.get('lab')),
            chapterId: PreviewOptions.clean(params.get('chapter')),
            page: Number.isInteger(page) ? page : 1
        });
    }

    static clean(value) {
        if (value === null || value === undefined) return null;
        const cleaned = String(value).trim();
        return cleaned.length ? cleaned : null;
    }

    static boolean(value) {
        return ['1', 'true', 'yes'].includes(String(value || '').toLowerCase());
    }

    resolve(appContext) {
        if (!this.enabled) {
            return Object.freeze({ scene: 'MenuScene', data: undefined });
        }
        if (!['test', 'progression'].includes(this.mode)) {
            throw new Error(`预览 mode 只支持 test 或 progression：${this.mode}`);
        }

        const packId = this.packId || appContext.getActivePackId();
        const pack = appContext.catalog.getPack(packId);
        if (this.skinId && !VISUAL_SKIN_REGISTRY.has(this.skinId)) {
            throw new Error(`未知预览皮肤：${this.skinId}`);
        }

        if (this.lab) {
            if (
                this.chapterId
                && !appContext.catalog.listChapters(pack.id)
                    .some(chapter => chapter.id === this.chapterId)
            ) {
                throw new Error(`关卡包 ${pack.id} 不存在章节 ${this.chapterId}`);
            }
            return Object.freeze({
                scene: 'LevelSelectScene',
                data: Object.freeze({
                    packId: pack.id,
                    ...(this.chapterId ? { chapterId: this.chapterId } : {}),
                    page: this.page
                })
            });
        }

        if (this.levelId !== null) {
            const level = appContext.catalog.getLevel(pack.id, this.levelId);
            return Object.freeze({
                scene: 'GameScene',
                data: Object.freeze({
                    route: appContext.router.createLevelRoute({
                        packId: pack.id,
                        levelId: level.packLevelId || level.id,
                        mode: this.mode
                    })
                })
            });
        }

        appContext.setActivePackId(pack.id);
        return Object.freeze({ scene: 'MenuScene', data: undefined });
    }
}

const PREVIEW_OPTIONS = PreviewOptions.fromLocation();
