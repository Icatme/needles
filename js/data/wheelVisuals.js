const WHEEL_VISUALS = (() => {
    const chapters = [
        {
            family: 'calibration',
            familyName: '校准仪',
            materials: ['steel', 'paper-steel']
        },
        {
            family: 'geartrain',
            familyName: '齿轮列',
            materials: ['brass', 'brass-steel']
        },
        {
            family: 'escapement',
            familyName: '擒纵器',
            materials: ['verdigris', 'verdigris-steel']
        },
        {
            family: 'chronograph',
            familyName: '计时仪',
            materials: ['steel-brass', 'paper-steel']
        },
        {
            family: 'orrery',
            familyName: '天文钟',
            materials: ['celestial', 'brass-verdigris']
        }
    ];

    // 十种经过刻意错开的结构语法。相邻方案至少更换两个结构轴，
    // 避免只改颜色或旋转角度造成“换皮但看不出区别”。
    const variants = [
        {
            rimStyle: 'clean', tickStyle: 'radial', tickCount: 12, majorEvery: 3,
            ringRadii: [0.56], spokeCount: 4, hubStyle: 'bullseye'
        },
        {
            rimStyle: 'double', tickStyle: 'tangent', tickCount: 16, majorEvery: 4,
            ringRadii: [0.46, 0.68], spokeCount: 3, hubStyle: 'cross'
        },
        {
            rimStyle: 'notched', tickStyle: 'paired', tickCount: 10, majorEvery: 5,
            ringRadii: [0.38, 0.61], spokeCount: 5, hubStyle: 'plate'
        },
        {
            rimStyle: 'rail', tickStyle: 'radial', tickCount: 18, majorEvery: 3,
            ringRadii: [0.51, 0.70], spokeCount: 6, hubStyle: 'aperture'
        },
        {
            rimStyle: 'segmented', tickStyle: 'dot', tickCount: 15, majorEvery: 5,
            ringRadii: [0.63], spokeCount: 0, hubStyle: 'triangle'
        },
        {
            rimStyle: 'notched', tickStyle: 'tangent', tickCount: 20, majorEvery: 4,
            ringRadii: [0.43, 0.66], spokeCount: 4, hubStyle: 'cross'
        },
        {
            rimStyle: 'double', tickStyle: 'paired', tickCount: 14, majorEvery: 7,
            ringRadii: [0.35, 0.53, 0.70], spokeCount: 7, hubStyle: 'plate'
        },
        {
            rimStyle: 'rail', tickStyle: 'radial', tickCount: 24, majorEvery: 6,
            ringRadii: [0.47, 0.64], spokeCount: 8, hubStyle: 'aperture'
        },
        {
            rimStyle: 'segmented', tickStyle: 'dot', tickCount: 21, majorEvery: 3,
            ringRadii: [0.40, 0.58, 0.72], spokeCount: 5, hubStyle: 'bullseye'
        },
        {
            rimStyle: 'crown', tickStyle: 'paired', tickCount: 24, majorEvery: 4,
            ringRadii: [0.34, 0.50, 0.66], spokeCount: 8, hubStyle: 'crown'
        }
    ];

    return Object.freeze(chapters.flatMap((chapter, chapterIndex) => (
        variants.map((variant, variantIndex) => {
            const id = chapterIndex * 10 + variantIndex + 1;
            return Object.freeze({
                id,
                theme: 'clockwork-observatory',
                chapter: chapterIndex + 1,
                family: chapter.family,
                familyName: chapter.familyName,
                material: chapter.materials[variantIndex % chapter.materials.length],
                motifVariant: variantIndex + 1,
                rimStyle: variant.rimStyle,
                tickStyle: variant.tickStyle,
                tickCount: variant.tickCount,
                majorEvery: variant.majorEvery,
                ringRadii: Object.freeze([...variant.ringRadii]),
                spokeCount: variant.spokeCount,
                hubStyle: variant.hubStyle,
                accentAngle: ((id * 137.5) % 360) * Math.PI / 180,
                milestone: id % 10 === 0
            });
        })
    )));
})();
