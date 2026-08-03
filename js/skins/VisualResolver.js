class VisualResolver {
    resolve(skin, level) {
        if (!skin?.presets?.length) {
            throw new Error('VisualResolver requires a registered skin');
        }
        if (!level || typeof level !== 'object') {
            throw new Error('VisualResolver requires a resolved level object');
        }

        const presentation = level.presentation || {};
        const intent = level.designIntent || {};
        const family = this.resolveFamily(skin, level, presentation, intent);
        const familyPresets = skin.presets.filter(preset => preset.family === family);
        const candidates = familyPresets.length > 0
            ? familyPresets
            : skin.presets;
        const explicitVariant = this.positiveInteger(
            presentation.variant
                ?? presentation.motifVariant
                ?? intent.variant
                ?? intent.motifVariant
        );

        if (explicitVariant !== null) {
            return candidates.find(preset => (
                preset.motifVariant === explicitVariant
                || preset.id === explicitVariant
            )) || candidates[(explicitVariant - 1) % candidates.length];
        }

        const order = this.positiveInteger(level.order ?? level.id);
        if (order !== null) {
            return candidates[(order - 1) % candidates.length];
        }

        const identity = level.packLevelId
            || level.id
            || level.name
            || JSON.stringify(level);
        return candidates[this.stableHash(String(identity)) % candidates.length];
    }

    resolveFamily(skin, level, presentation, intent) {
        const explicit = presentation.family || intent.family;
        if (explicit && skin.familyOrder.includes(explicit)) {
            return explicit;
        }

        const tier = this.positiveInteger(
            presentation.tier
                ?? intent.tier
                ?? level.chapter
        );
        if (tier !== null && skin.familyOrder.length > 0) {
            const index = Math.max(0, Math.min(tier - 1, skin.familyOrder.length - 1));
            return skin.familyOrder[index];
        }

        const semantic = presentation.focus
            || intent.focus
            || (Array.isArray(level.tags) ? level.tags[0] : null);
        if (semantic && skin.semanticFamilies[semantic]) {
            return skin.semanticFamilies[semantic];
        }

        if (level.chapterId) {
            const match = String(level.chapterId).match(/(\d+)$/);
            if (match && skin.familyOrder.length > 0) {
                const chapter = Number(match[1]);
                const index = Math.max(
                    0,
                    Math.min(chapter - 1, skin.familyOrder.length - 1)
                );
                return skin.familyOrder[index];
            }
        }

        return skin.familyOrder[0]
            || skin.presets.find(preset => preset.family)?.family
            || null;
    }

    positiveInteger(value) {
        const parsed = Math.floor(Number(value));
        return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
    }

    stableHash(value) {
        let hash = 2166136261;
        for (let index = 0; index < value.length; index++) {
            hash ^= value.charCodeAt(index);
            hash = Math.imul(hash, 16777619);
        }
        return hash >>> 0;
    }
}
