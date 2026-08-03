class PackValidationError extends Error {
    constructor(message, details = []) {
        super(message);
        this.name = 'PackValidationError';
        this.details = details;
    }
}

class PackValidator {
    validateIndex(index) {
        const errors = [];
        this.requireObject(index, 'index', errors);
        if (!index || typeof index !== 'object') return this.fail('Invalid pack index', errors);

        this.expect(index.schema === 'needles.pack-index/v1', 'index.schema must be needles.pack-index/v1', errors);
        this.expect(this.isId(index.defaultPackId), 'index.defaultPackId must be a valid id', errors);
        this.expect(Array.isArray(index.packs) && index.packs.length > 0, 'index.packs must be a non-empty array', errors);

        const ids = new Set();
        (index.packs || []).forEach((entry, position) => {
            const prefix = `index.packs[${position}]`;
            this.requireObject(entry, prefix, errors);
            this.expect(this.isId(entry?.id), `${prefix}.id must be a valid id`, errors);
            this.expect(typeof entry?.manifest === 'string' && entry.manifest.length > 0, `${prefix}.manifest is required`, errors);
            if (entry?.id) {
                this.expect(!ids.has(entry.id), `${prefix}.id duplicates ${entry.id}`, errors);
                ids.add(entry.id);
            }
        });

        this.expect(ids.has(index.defaultPackId), 'default pack is not listed', errors);
        return this.finish('Invalid pack index', errors);
    }

    validateBundle(entry, manifest, presets, levelList) {
        const errors = [];
        this.validateManifest(entry, manifest, errors);
        this.validatePresets(presets, errors);
        this.validateLevels(manifest, presets, levelList, errors);
        return this.finish(`Invalid level pack ${entry?.id || 'unknown'}`, errors);
    }

    validateManifest(entry, manifest, errors) {
        this.requireObject(manifest, 'manifest', errors);
        if (!manifest || typeof manifest !== 'object') return;

        this.expect(manifest.schema === 'needles.level-pack/v1', 'manifest.schema must be needles.level-pack/v1', errors);
        this.expect(this.isId(manifest.id), 'manifest.id must be a valid id', errors);
        this.expect(manifest.id === entry?.id, 'manifest.id must match index entry id', errors);
        this.expect(typeof manifest.version === 'string' && manifest.version.length > 0, 'manifest.version is required', errors);
        this.expect(typeof manifest.title === 'string' && manifest.title.length > 0, 'manifest.title is required', errors);
        this.expect(manifest.engineCompatibility === 'classic-v1', 'unsupported engineCompatibility', errors);
        this.expect(Array.isArray(manifest.chapters) && manifest.chapters.length > 0, 'manifest.chapters must be non-empty', errors);
        this.requireObject(manifest.resources, 'manifest.resources', errors);
        this.expect(typeof manifest.resources?.presets === 'string', 'manifest.resources.presets is required', errors);
        this.expect(typeof manifest.resources?.levels === 'string', 'manifest.resources.levels is required', errors);

        const chapterIds = new Set();
        (manifest.chapters || []).forEach((chapter, position) => {
            const prefix = `manifest.chapters[${position}]`;
            this.requireObject(chapter, prefix, errors);
            this.expect(this.isId(chapter?.id), `${prefix}.id must be valid`, errors);
            this.expect(Number.isInteger(chapter?.order) && chapter.order > 0, `${prefix}.order must be positive`, errors);
            this.expect(typeof chapter?.title === 'string' && chapter.title.length > 0, `${prefix}.title is required`, errors);
            if (chapter?.id) {
                this.expect(!chapterIds.has(chapter.id), `${prefix}.id duplicates ${chapter.id}`, errors);
                chapterIds.add(chapter.id);
            }
        });
    }

    validatePresets(presets, errors) {
        this.requireObject(presets, 'presets', errors);
        if (!presets || typeof presets !== 'object') return;
        this.expect(presets.schema === 'needles.level-presets/v1', 'presets.schema must be needles.level-presets/v1', errors);
        this.requireObject(presets.layouts, 'presets.layouts', errors);

        Object.entries(presets.layouts || {}).forEach(([id, layout]) => {
            const prefix = `presets.layouts.${id}`;
            this.expect(this.isId(id), `${prefix} has an invalid id`, errors);
            this.requireObject(layout, prefix, errors);
            this.expect(Array.isArray(layout?.obstacleAngles), `${prefix}.obstacleAngles must be an array`, errors);
            (layout?.obstacleAngles || []).forEach((angle, index) => {
                this.expect(Number.isFinite(angle) && angle >= 0 && angle < 360, `${prefix}.obstacleAngles[${index}] must be in 0..360`, errors);
            });
        });
    }

    validateLevels(manifest, presets, levelList, errors) {
        this.requireObject(levelList, 'levels', errors);
        if (!levelList || typeof levelList !== 'object') return;
        this.expect(levelList.schema === 'needles.level-list/v1', 'levels.schema must be needles.level-list/v1', errors);
        this.expect(Array.isArray(levelList.levels) && levelList.levels.length > 0, 'levels.levels must be non-empty', errors);

        const chapterIds = new Set((manifest?.chapters || []).map(chapter => chapter.id));
        const levelIds = new Set();
        const orders = new Set();
        const layouts = presets?.layouts || {};

        (levelList.levels || []).forEach((level, position) => {
            const prefix = `levels.levels[${position}]`;
            this.requireObject(level, prefix, errors);
            this.expect(this.isId(level?.id), `${prefix}.id must be valid`, errors);
            this.expect(!levelIds.has(level?.id), `${prefix}.id duplicates ${level?.id}`, errors);
            this.expect(Number.isInteger(level?.order) && level.order > 0, `${prefix}.order must be positive`, errors);
            this.expect(!orders.has(level?.order), `${prefix}.order duplicates ${level?.order}`, errors);
            this.expect(chapterIds.has(level?.chapterId), `${prefix}.chapterId is unknown`, errors);
            this.expect(typeof level?.title === 'string' && level.title.length > 0, `${prefix}.title is required`, errors);
            this.expect(typeof level?.instruction === 'string', `${prefix}.instruction must be a string`, errors);
            this.expect(Number.isInteger(level?.objective?.insertCount) && level.objective.insertCount > 0, `${prefix}.objective.insertCount must be positive`, errors);
            this.expect(typeof level?.layoutRef === 'string' && layouts[level.layoutRef], `${prefix}.layoutRef is unknown`, errors);
            this.validateRhythm(level?.rhythm, `${prefix}.rhythm`, errors);

            if (level?.id) levelIds.add(level.id);
            if (Number.isInteger(level?.order)) orders.add(level.order);
        });
    }

    validateRhythm(rhythm, prefix, errors) {
        this.requireObject(rhythm, prefix, errors);
        this.expect(Array.isArray(rhythm?.segments) && rhythm.segments.length > 0, `${prefix}.segments must be non-empty`, errors);
        (rhythm?.segments || []).forEach((segment, index) => {
            const path = `${prefix}.segments[${index}]`;
            this.requireObject(segment, path, errors);
            this.expect(Number.isFinite(segment?.durationMs) && segment.durationMs > 0, `${path}.durationMs must be positive`, errors);
            const fixed = Number.isFinite(segment?.velocity);
            const ramp = Number.isFinite(segment?.fromVelocity) && Number.isFinite(segment?.toVelocity);
            this.expect(fixed !== ramp, `${path} must define velocity or from/to velocity`, errors);
            if (segment?.easing !== undefined) {
                this.expect(['linear', 'sine'].includes(segment.easing), `${path}.easing is unsupported`, errors);
            }
        });
    }

    requireObject(value, path, errors) {
        this.expect(Boolean(value) && typeof value === 'object' && !Array.isArray(value), `${path} must be an object`, errors);
    }

    isId(value) {
        return typeof value === 'string' && /^[a-z0-9][a-z0-9-]*$/.test(value);
    }

    expect(condition, message, errors) {
        if (!condition) errors.push(message);
    }

    finish(message, errors) {
        if (errors.length) this.fail(message, errors);
        return true;
    }

    fail(message, errors) {
        throw new PackValidationError(message, errors);
    }
}
