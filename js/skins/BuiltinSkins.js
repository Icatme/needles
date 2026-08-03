VISUAL_SKIN_REGISTRY.register({
    id: 'clockwork-observatory',
    name: '机械天文台',
    caption: '刻度与机芯',
    version: '1.0.0',
    uiThemeId: 'clockwork-observatory',
    backgroundThemeId: 'clockwork-observatory',
    presets: WHEEL_VISUALS,
    familyOrder: [
        'calibration',
        'geartrain',
        'escapement',
        'chronograph',
        'orrery'
    ],
    semanticFamilies: {
        timing: 'calibration',
        density: 'geartrain',
        zones: 'escapement',
        direction: 'escapement',
        speed: 'chronograph',
        rhythm: 'chronograph',
        modifier: 'orrery',
        coupling: 'orrery'
    }
});

VISUAL_SKIN_REGISTRY.register({
    id: 'gilded-jewel-box',
    name: '鎏光宝匣',
    caption: '彩宝与手镯',
    version: '1.0.0',
    uiThemeId: 'gilded-jewel-box',
    backgroundThemeId: 'gilded-jewel-box',
    presets: JEWEL_VISUALS,
    familyOrder: [
        'pearl-bangle',
        'floral-cluster',
        'prism-cut',
        'celestial-charm',
        'royal-parure'
    ],
    semanticFamilies: {
        timing: 'pearl-bangle',
        density: 'floral-cluster',
        zones: 'floral-cluster',
        direction: 'prism-cut',
        speed: 'prism-cut',
        rhythm: 'celestial-charm',
        modifier: 'royal-parure',
        coupling: 'royal-parure'
    }
});

VISUAL_SKIN_REGISTRY.setDefault('clockwork-observatory');
