const CONSTANTS = {
    // 游戏画面尺寸
    WIDTH: 600,
    HEIGHT: 800,

    // 转盘配置
    WHEEL: {
        RADIUS: 88,
        CENTER_X: 300,
        CENTER_Y: 330,
        COLOR: 0x172126,
        INNER_COLOR: 0x314149,
        DETAIL_COLOR: 0xfffbf4,
        OUTLINE_COLOR: 0x172126,
        OUTLINE_WIDTH: 3,
        IMPACT_ANGLE: Math.PI / 2
    },

    // 针配置
    NEEDLE: {
        LENGTH: 100,              // 针尖到针帽中心的距离
        TIP_LENGTH: 13,
        INSERT_DEPTH: 16,         // 插入转盘的深度，需完整覆盖针尖
        BALL_RADIUS: 15,
        READY_Y: 700,
        LINE_WIDTH: 4,
        LINE_COLOR: 0x172126,
        BALL_COLOR: 0xfffbf4,
        ACTIVE_BALL_COLOR: 0xe55a3c,
        BALL_OUTLINE: 0x172126,
        TEXT_COLOR: '#172126',
        ACTIVE_TEXT_COLOR: '#172126',
        TEXT_SIZE: '14px',
        TEXT_FONT: '"Bahnschrift SemiCondensed", "Microsoft YaHei UI", sans-serif',
        FLY_DURATION_MS: 86,      // 点击到命中的固定逻辑时长，保留经典布局原有手感
        FLY_SPEED: 2300           // 启动时按当前显示模板重算，确保各模板飞行时长一致
    },

    // 障碍物配置
    OBSTACLE: {
        RADIUS: 17,
        COLOR: 0xe55a3c,
        OUTLINE_COLOR: 0x172126,
        OUTLINE_WIDTH: 3
    },

    // “鎏光宝匣”主题使用命名材质，不在绘制代码中临时发明颜色。
    JEWEL: {
        ENAMELS: {
            BLUSH: 0x3b2836,
            FOREST: 0x193b36,
            AMETHYST: 0x342743,
            MIDNIGHT: 0x1d2b45,
            GARNET: 0x45242d
        },
        METALS: {
            ROSE_GOLD: 0xd4a094,
            YELLOW_GOLD: 0xd3ad5f,
            PLATINUM: 0xc6d0d3,
            SHADOW: 0x75626a
        },
        STONES: {
            PEARL: { base: 0xf2e9de, light: 0xfff8ec, dark: 0xb9aeb0, text: '#2f202c' },
            MORGANITE: { base: 0xd9999b, light: 0xf2c8c2, dark: 0x9a5e68, text: '#2f202c' },
            AQUAMARINE: { base: 0x73aeb8, light: 0xb9d9da, dark: 0x416f7d, text: '#172126' },
            EMERALD: { base: 0x3c816d, light: 0x8ab6a6, dark: 0x205344, text: '#fffbf4' },
            CITRINE: { base: 0xc79645, light: 0xebcf83, dark: 0x825f29, text: '#2f202c' },
            RUBY: { base: 0xb63f60, light: 0xe48699, dark: 0x70253f, text: '#fffbf4' },
            AMETHYST: { base: 0x7d5a91, light: 0xb49ac0, dark: 0x4c365c, text: '#fffbf4' },
            SAPPHIRE: { base: 0x3b619c, light: 0x89a5ca, dark: 0x223b67, text: '#fffbf4' },
            MOONSTONE: { base: 0xc7d5e2, light: 0xeff4f2, dark: 0x8493a8, text: '#172126' },
            DIAMOND: { base: 0xdce8e7, light: 0xfffbf4, dark: 0x93a5aa, text: '#172126' }
        }
    },

    // UI 配置
    UI: {
        BACKGROUND: 0xf5f1e8,
        BACKGROUND_ALT: 0xeee8dc,
        SURFACE: 0xfffbf4,
        INK: 0x172126,
        INK_SOFT: 0x314149,
        MUTED: 0x566467,
        RULE: 0xd7d1c5,
        ACCENT: 0xe55a3c,
        ACCENT_DARK: 0xb83b25,
        STEEL: 0x95a5a9,
        BRASS: 0xc3a35e,
        BRASS_DARK: 0x82693d,
        VERDIGRIS: 0x67958b,
        VERDIGRIS_DARK: 0x3d6861,
        SUCCESS: 0x268262,
        ERROR: 0xc94b3c,
        TEXT_COLOR: '#172126',
        TEXT_INVERSE: '#fffbf4',
        TEXT_MUTED: '#566467',
        TEXT_ACCENT: '#b83b25',
        TEXT_SUCCESS: '#17674e',
        TEXT_ERROR: '#9e3328',
        DISPLAY_FONT: '"Bahnschrift SemiCondensed", "Aptos Narrow", "Microsoft YaHei UI", sans-serif',
        BODY_FONT: '"Microsoft YaHei UI", "PingFang SC", "Noto Sans CJK SC", sans-serif',
        MONO_FONT: '"Cascadia Mono", "SFMono-Regular", monospace',
        BUTTON_HEIGHT: 54,
        BUTTON_RADIUS: 12
    },

    // 难度模型采用几何推导值；NORMAL_FACTOR 是待试玩校准的设计假设。
    DIFFICULTY: {
        COMFORT_GAP: 10,
        NORMAL_FACTOR: 0.85,
        MIN_NEEDLES: 5,
        MIN_SPEED: 0.38,
        MAX_SPEED: 1.30,
        MAX_ZONES: 8,
        MAX_COMPLEXITY: 14,
        MIN_SEGMENT_MS: 320,
        MAX_COVERAGE_MS: 60000,
        OPENING_CLEARANCE_DEGREES: 18,
        INSERT_LOCK_MS: 200
    },

    // 粒子效果
    PARTICLES: {
        COLORS: [0xe55a3c, 0x172126, 0x6f797b, 0xd7d1c5]
    },

    // 存储键
    STORAGE_KEY: 'needle_game_progress',
    THEME_STORAGE_KEY: 'needle_game_visual_theme'
};
