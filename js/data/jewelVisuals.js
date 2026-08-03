const JEWEL_VISUALS = (() => {
    const chapters = [
        {
            family: 'pearl-bangle',
            familyName: '晨露珍珠',
            enamel: 'blush',
            metals: ['rose-gold', 'platinum'],
            stones: ['pearl', 'morganite', 'aquamarine']
        },
        {
            family: 'floral-cluster',
            familyName: '花冠彩宝',
            enamel: 'forest',
            metals: ['yellow-gold', 'rose-gold'],
            stones: ['emerald', 'citrine', 'ruby']
        },
        {
            family: 'prism-cut',
            familyName: '棱镜切工',
            enamel: 'amethyst',
            metals: ['platinum', 'rose-gold'],
            stones: ['amethyst', 'sapphire', 'aquamarine']
        },
        {
            family: 'celestial-charm',
            familyName: '星月手镯',
            enamel: 'midnight',
            metals: ['platinum', 'yellow-gold'],
            stones: ['sapphire', 'moonstone', 'amethyst']
        },
        {
            family: 'royal-parure',
            familyName: '王冠珠宝',
            enamel: 'garnet',
            metals: ['yellow-gold', 'platinum'],
            stones: ['diamond', 'ruby', 'emerald']
        }
    ];

    const variants = [
        {
            braceletStyle: 'slender', settingCount: 4, haloRadii: [0.50],
            centerCut: 'round', facetStyle: 'radial',
            needleCuts: ['round', 'princess']
        },
        {
            braceletStyle: 'beaded', settingCount: 6, haloRadii: [0.42, 0.64],
            centerCut: 'princess', facetStyle: 'step',
            needleCuts: ['princess', 'hexagon', 'round']
        },
        {
            braceletStyle: 'twist', settingCount: 5, haloRadii: [0.38, 0.58],
            centerCut: 'emerald', facetStyle: 'step',
            needleCuts: ['emerald', 'baguette']
        },
        {
            braceletStyle: 'hinged', settingCount: 8, haloRadii: [0.54],
            centerCut: 'pear', facetStyle: 'kite',
            needleCuts: ['pear', 'marquise', 'round']
        },
        {
            braceletStyle: 'chain', settingCount: 7, haloRadii: [0.44, 0.66],
            centerCut: 'marquise', facetStyle: 'star',
            needleCuts: ['marquise', 'pear', 'hexagon']
        },
        {
            braceletStyle: 'double', settingCount: 10, haloRadii: [0.36, 0.52, 0.68],
            centerCut: 'hexagon', facetStyle: 'radial',
            needleCuts: ['hexagon', 'princess', 'emerald']
        },
        {
            braceletStyle: 'open-cuff', settingCount: 6, haloRadii: [0.46, 0.63],
            centerCut: 'kite', facetStyle: 'kite',
            needleCuts: ['kite', 'shield', 'marquise']
        },
        {
            braceletStyle: 'station', settingCount: 12, haloRadii: [0.40, 0.57, 0.70],
            centerCut: 'shield', facetStyle: 'step',
            needleCuts: ['shield', 'emerald', 'baguette']
        },
        {
            braceletStyle: 'tennis', settingCount: 9, haloRadii: [0.35, 0.50, 0.65],
            centerCut: 'trillion', facetStyle: 'star',
            needleCuts: ['trillion', 'kite', 'princess']
        },
        {
            braceletStyle: 'tiara', settingCount: 16, haloRadii: [0.32, 0.46, 0.60, 0.72],
            centerCut: 'baguette', facetStyle: 'crown',
            needleCuts: ['baguette', 'shield', 'trillion', 'emerald']
        }
    ];

    return Object.freeze(chapters.flatMap((chapter, chapterIndex) => (
        variants.map((variant, variantIndex) => {
            const id = chapterIndex * 10 + variantIndex + 1;
            return Object.freeze({
                id,
                theme: 'gilded-jewel-box',
                chapter: chapterIndex + 1,
                family: chapter.family,
                familyName: chapter.familyName,
                enamel: chapter.enamel,
                metal: chapter.metals[variantIndex % chapter.metals.length],
                stones: Object.freeze([...chapter.stones]),
                motifVariant: variantIndex + 1,
                braceletStyle: variant.braceletStyle,
                settingCount: variant.settingCount,
                haloRadii: Object.freeze([...variant.haloRadii]),
                centerCut: variant.centerCut,
                facetStyle: variant.facetStyle,
                needleCuts: Object.freeze([...variant.needleCuts]),
                accentAngle: ((id * 137.5) % 360) * Math.PI / 180,
                milestone: id % 10 === 0
            });
        })
    )));
})();
