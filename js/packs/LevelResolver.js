class LevelResolver {
    resolvePack(manifest, presets, levelList) {
        const chapterDescriptors = [...manifest.chapters]
            .sort((a, b) => a.order - b.order)
            .map(chapter => Object.freeze({ ...chapter }));
        const chapterOrder = new Map(
            chapterDescriptors.map(chapter => [chapter.id, chapter.order])
        );
        const levels = [...levelList.levels]
            .sort((a, b) => a.order - b.order)
            .map(level => this.resolveLevel(level, presets, chapterOrder));

        return Object.freeze({
            id: manifest.id,
            version: manifest.version,
            name: manifest.title,
            caption: manifest.caption || '',
            engineCompatibility: manifest.engineCompatibility,
            difficultyModel: manifest.difficultyModel || 'legacy-linear',
            // Existing scenes consume chapter titles; M2 will consume descriptors directly.
            chapters: Object.freeze(chapterDescriptors.map(chapter => chapter.title)),
            chapterDescriptors: Object.freeze(chapterDescriptors),
            levels: Object.freeze(levels),
            source: Object.freeze({
                manifest: Object.freeze({ ...manifest }),
                presets: Object.freeze(JSON.parse(JSON.stringify(presets)))
            })
        });
    }

    resolveLevel(level, presets, chapterOrder) {
        const layout = presets.layouts[level.layoutRef];
        const numericId = Number.isInteger(level.legacyNumericId)
            ? level.legacyNumericId
            : level.order;
        const presentation = level.presentation || {};

        return Object.freeze({
            id: numericId,
            packLevelId: level.id,
            chapterId: level.chapterId,
            chapter: chapterOrder.get(level.chapterId),
            order: level.order,
            name: level.title,
            rule: level.instruction,
            needleCount: level.objective.insertCount,
            layout: Object.freeze({
                id: level.layoutRef,
                obstacleAngles: Object.freeze([...layout.obstacleAngles])
            }),
            rhythm: Object.freeze(JSON.parse(JSON.stringify(level.rhythm))),
            designIntent: Object.freeze({
                tier: presentation.tier ?? chapterOrder.get(level.chapterId),
                milestone: Boolean(presentation.milestone),
                ...(presentation.focus ? { focus: presentation.focus } : {})
            }),
            tags: Object.freeze([...(level.tags || [])])
        });
    }
}
