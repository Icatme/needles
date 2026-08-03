const LEVEL_PACK_STORAGE_KEY = 'needle_game_level_pack';
const DEFAULT_LEVEL_PACK_ID = 'balanced-v2';

const BALANCED_LEVEL_DEFINITIONS = (() => {
    const hold = (seconds, velocity) => ({ durationMs: seconds * 1000, velocity });
    const ramp = (seconds, fromVelocity, toVelocity) => ({
        durationMs: seconds * 1000,
        fromVelocity,
        toVelocity,
        easing: 'sine'
    });
    const steady = velocity => ({ segments: [hold(4, velocity)] });
    const cycle = (segments, shotModifier) => ({
        segments,
        ...(shotModifier ? { shotModifier } : {})
    });
    const breathing = (minimum, maximum, periodSeconds) => cycle([
        ramp(periodSeconds / 2, minimum, maximum),
        ramp(periodSeconds / 2, maximum, minimum)
    ]);
    const define = ({ id, name, rule, needleCount, layoutId, rhythm, focus }) => ({
        id,
        chapter: Math.ceil(id / 10),
        name,
        rule,
        needleCount,
        layout: {
            id: layoutId,
            obstacleAngles: [...LEVEL_LAYOUTS[layoutId]]
        },
        rhythm,
        designIntent: {
            tier: Math.ceil(id / 10),
            milestone: id % 10 === 0,
            focus
        }
    });

    return [
        define({
            id: 1,
            name: "起针校准",
            rule: "匀速顺时针 · 学习发射",
            needleCount: 10,
            layoutId: "Z0",
            rhythm: steady(0.36),
            focus: "timing"
        }),
        define({
            id: 2,
            name: "留白加一",
            rule: "只增加一针 · 感受密度",
            needleCount: 11,
            layoutId: "Z0",
            rhythm: steady(0.36),
            focus: "density"
        }),
        define({
            id: 3,
            name: "单门巡航",
            rule: "加入一枚锁针",
            needleCount: 11,
            layoutId: "Z1",
            rhythm: steady(0.46),
            focus: "zones"
        }),
        define({
            id: 4,
            name: "单门提速",
            rule: "单门中稍微提速",
            needleCount: 12,
            layoutId: "Z1",
            rhythm: steady(0.52),
            focus: "speed"
        }),
        define({
            id: 5,
            name: "双门定拍",
            rule: "两个分区 · 固定节拍",
            needleCount: 12,
            layoutId: "Z2A",
            rhythm: steady(0.58),
            focus: "zones"
        }),
        define({
            id: 6,
            name: "双门呼吸",
            rule: "长周期平滑变速",
            needleCount: 12,
            layoutId: "Z2A",
            rhythm: breathing(0.40, 0.62, 4.8),
            focus: "speed"
        }),
        define({
            id: 7,
            name: "长短双拍",
            rule: "长慢拍接短快拍",
            needleCount: 12,
            layoutId: "Z1",
            rhythm: cycle([hold(1.8, 0.42), hold(1.2, 0.64)]),
            focus: "rhythm"
        }),
        define({
            id: 8,
            name: "逐针升速",
            rule: "每插一针轻微加速",
            needleCount: 12,
            layoutId: "Z2A",
            rhythm: cycle([hold(4, 0.42)], { speedStep: 0.02, maxAbsSpeed: 0.64 }),
            focus: "modifier"
        }),
        define({
            id: 9,
            name: "三区双拍",
            rule: "三区中保持双拍",
            needleCount: 12,
            layoutId: "Z3A",
            rhythm: cycle([hold(1.8, 0.42), hold(1.2, 0.64)]),
            focus: "coupling"
        }),
        define({
            id: 10,
            name: "漂移转身",
            rule: "长去程接短回摆",
            needleCount: 12,
            layoutId: "Z3A",
            rhythm: cycle([hold(2.0, 0.56), hold(1.5, -0.24)]),
            focus: "direction"
        }),
        define({
            id: 11,
            name: "三区进阶",
            rule: "三区双拍 · 小幅提速",
            needleCount: 13,
            layoutId: "Z3A",
            rhythm: cycle([hold(1.7, 0.46), hold(1.1, 0.72)]),
            focus: "density"
        }),
        define({
            id: 12,
            name: "四区呼吸",
            rule: "四区中平滑变速",
            needleCount: 13,
            layoutId: "Z4B",
            rhythm: breathing(0.46, 0.80, 4.4),
            focus: "zones"
        }),
        define({
            id: 13,
            name: "四区增密",
            rule: "保持节奏 · 增加一针",
            needleCount: 14,
            layoutId: "Z4B",
            rhythm: cycle([hold(1.7, 0.46), hold(1.1, 0.72)]),
            focus: "density"
        }),
        define({
            id: 14,
            name: "四区长摆",
            rule: "四区漂移回摆",
            needleCount: 14,
            layoutId: "Z4B",
            rhythm: cycle([hold(1.8, 0.64), hold(1.3, -0.30)]),
            focus: "direction"
        }),
        define({
            id: 15,
            name: "五区巡航",
            rule: "五区匀速巡航",
            needleCount: 14,
            layoutId: "Z5A",
            rhythm: steady(0.70),
            focus: "zones"
        }),
        define({
            id: 16,
            name: "五区呼吸",
            rule: "五区高幅呼吸",
            needleCount: 14,
            layoutId: "Z5A",
            rhythm: breathing(0.46, 0.80, 4.4),
            focus: "speed"
        }),
        define({
            id: 17,
            name: "五区高速",
            rule: "保持五区 · 再增一针",
            needleCount: 15,
            layoutId: "Z5A",
            rhythm: steady(0.76),
            focus: "density"
        }),
        define({
            id: 18,
            name: "三相穿门",
            rule: "慢快中三相循环",
            needleCount: 14,
            layoutId: "Z5A",
            rhythm: cycle([hold(1.3, 0.48), hold(0.9, 0.82), hold(1.4, 0.60)]),
            focus: "rhythm"
        }),
        define({
            id: 19,
            name: "五针换向",
            rule: "双拍运行 · 每五针翻转",
            needleCount: 14,
            layoutId: "Z5A",
            rhythm: cycle([hold(1.5, 0.48), hold(1.0, 0.78)], { flipEvery: 5 }),
            focus: "modifier"
        }),
        define({
            id: 20,
            name: "密区漂移",
            rule: "十五针 · 漂移回摆",
            needleCount: 15,
            layoutId: "Z5A",
            rhythm: cycle([hold(1.6, 0.72), hold(1.1, -0.36)]),
            focus: "coupling"
        }),
        define({
            id: 21,
            name: "六区高速",
            rule: "六区高速巡航",
            needleCount: 15,
            layoutId: "Z6A",
            rhythm: steady(0.88),
            focus: "speed"
        }),
        define({
            id: 22,
            name: "短拍双速",
            rule: "缩短双拍持续时间",
            needleCount: 15,
            layoutId: "Z5A",
            rhythm: cycle([hold(1.3, 0.52), hold(0.9, 0.92)]),
            focus: "rhythm"
        }),
        define({
            id: 23,
            name: "六区呼吸",
            rule: "六区短周期呼吸",
            needleCount: 15,
            layoutId: "Z6A",
            rhythm: breathing(0.52, 1.00, 3.8),
            focus: "zones"
        }),
        define({
            id: 24,
            name: "六区三相",
            rule: "六区三相循环",
            needleCount: 15,
            layoutId: "Z6A",
            rhythm: cycle([hold(1.2, 0.52), hold(0.8, 0.94), hold(1.3, 0.66)]),
            focus: "rhythm"
        }),
        define({
            id: 25,
            name: "七区巡航",
            rule: "七区高速巡航",
            needleCount: 15,
            layoutId: "Z7A",
            rhythm: steady(0.88),
            focus: "zones"
        }),
        define({
            id: 26,
            name: "四针移相",
            rule: "每四针改变循环起点",
            needleCount: 15,
            layoutId: "Z7A",
            rhythm: cycle([hold(1.4, 0.48), hold(1.0, 0.82), hold(1.5, 0.60)], { phaseShiftEvery: 4, phaseShiftMs: 500 }),
            focus: "modifier"
        }),
        define({
            id: 27,
            name: "密环呼吸",
            rule: "十六针 · 高幅呼吸",
            needleCount: 16,
            layoutId: "Z7A",
            rhythm: breathing(0.50, 0.90, 4.0),
            focus: "density"
        }),
        define({
            id: 28,
            name: "四相初见",
            rule: "首次完整四相循环",
            needleCount: 15,
            layoutId: "Z7A",
            rhythm: cycle([hold(1.2, 0.48), hold(0.9, 0.88), hold(1.2, -0.32), hold(1.5, 0.64)]),
            focus: "rhythm"
        }),
        define({
            id: 29,
            name: "密环三相",
            rule: "十六针 · 三相短拍",
            needleCount: 16,
            layoutId: "Z7A",
            rhythm: cycle([hold(1.2, 0.52), hold(0.8, 0.94), hold(1.3, 0.66)]),
            focus: "coupling"
        }),
        define({
            id: 30,
            name: "四相合奏",
            rule: "十六针 · 四相循环",
            needleCount: 16,
            layoutId: "Z7A",
            rhythm: cycle([hold(1.2, 0.48), hold(0.9, 0.88), hold(1.2, -0.32), hold(1.5, 0.64)]),
            focus: "coupling"
        }),
        define({
            id: 31,
            name: "八区呼吸",
            rule: "八区高幅呼吸",
            needleCount: 16,
            layoutId: "Z8A",
            rhythm: breathing(0.52, 1.00, 3.8),
            focus: "zones"
        }),
        define({
            id: 32,
            name: "八区极速",
            rule: "八区匀速高压",
            needleCount: 16,
            layoutId: "Z8A",
            rhythm: steady(0.94),
            focus: "speed"
        }),
        define({
            id: 33,
            name: "窄区巡航",
            rule: "更碎的八区布局",
            needleCount: 16,
            layoutId: "Z8B",
            rhythm: steady(0.88),
            focus: "zones"
        }),
        define({
            id: 34,
            name: "窄区移相",
            rule: "窄区三相 · 每四针移相",
            needleCount: 16,
            layoutId: "Z8B",
            rhythm: cycle([hold(1.4, 0.48), hold(1.0, 0.82), hold(1.5, 0.60)], { phaseShiftEvery: 4, phaseShiftMs: 500 }),
            focus: "modifier"
        }),
        define({
            id: 35,
            name: "窄区长摆",
            rule: "窄区高速漂移回摆",
            needleCount: 16,
            layoutId: "Z8B",
            rhythm: cycle([hold(1.5, 0.80), hold(1.0, -0.42)]),
            focus: "direction"
        }),
        define({
            id: 36,
            name: "窄区呼吸",
            rule: "窄区短周期呼吸",
            needleCount: 16,
            layoutId: "Z8B",
            rhythm: breathing(0.52, 1.00, 3.8),
            focus: "speed"
        }),
        define({
            id: 37,
            name: "窄区三相",
            rule: "窄区三相短拍",
            needleCount: 16,
            layoutId: "Z8B",
            rhythm: cycle([hold(1.2, 0.52), hold(0.8, 0.94), hold(1.3, 0.66)]),
            focus: "rhythm"
        }),
        define({
            id: 38,
            name: "窄区高速",
            rule: "窄区匀速高压",
            needleCount: 16,
            layoutId: "Z8B",
            rhythm: steady(0.94),
            focus: "density"
        }),
        define({
            id: 39,
            name: "四相门阵",
            rule: "窄区四相方向切换",
            needleCount: 16,
            layoutId: "Z8B",
            rhythm: cycle([hold(1.2, 0.48), hold(0.9, 0.88), hold(1.2, -0.32), hold(1.5, 0.64)]),
            focus: "coupling"
        }),
        define({
            id: 40,
            name: "极限双速",
            rule: "窄区短拍双速",
            needleCount: 16,
            layoutId: "Z8B",
            rhythm: cycle([hold(1.1, 0.56), hold(0.75, 1.04)]),
            focus: "speed"
        }),
        define({
            id: 41,
            name: "高密双速",
            rule: "十七针 · 八区双速",
            needleCount: 17,
            layoutId: "Z8A",
            rhythm: cycle([hold(1.1, 0.56), hold(0.75, 1.04)]),
            focus: "density"
        }),
        define({
            id: 42,
            name: "高密呼吸",
            rule: "十七针 · 窄区呼吸",
            needleCount: 17,
            layoutId: "Z8B",
            rhythm: breathing(0.52, 1.00, 3.8),
            focus: "density"
        }),
        define({
            id: 43,
            name: "高密巡航",
            rule: "十七针 · 窄区高速",
            needleCount: 17,
            layoutId: "Z8B",
            rhythm: steady(0.94),
            focus: "density"
        }),
        define({
            id: 44,
            name: "四相换向",
            rule: "四相循环 · 每六针翻转",
            needleCount: 16,
            layoutId: "Z8A",
            rhythm: cycle([hold(1.0, 0.52), hold(0.75, 1.02), hold(1.0, -0.40), hold(1.4, 0.70)], { flipEvery: 6 }),
            focus: "modifier"
        }),
        define({
            id: 45,
            name: "高密四相",
            rule: "十七针 · 八区四相",
            needleCount: 17,
            layoutId: "Z8A",
            rhythm: cycle([hold(1.0, 0.52), hold(0.75, 1.02), hold(1.0, -0.40), hold(1.4, 0.70)]),
            focus: "coupling"
        }),
        define({
            id: 46,
            name: "窄区换向",
            rule: "窄区四相 · 每六针翻转",
            needleCount: 16,
            layoutId: "Z8B",
            rhythm: cycle([hold(1.0, 0.52), hold(0.75, 1.02), hold(1.0, -0.40), hold(1.4, 0.70)], { flipEvery: 6 }),
            focus: "modifier"
        }),
        define({
            id: 47,
            name: "窄区四相",
            rule: "十七针 · 窄区四相",
            needleCount: 17,
            layoutId: "Z8B",
            rhythm: cycle([hold(1.0, 0.52), hold(0.75, 1.02), hold(1.0, -0.40), hold(1.4, 0.70)]),
            focus: "coupling"
        }),
        define({
            id: 48,
            name: "五相连奏",
            rule: "五相循环 · 无额外修改",
            needleCount: 17,
            layoutId: "Z8B",
            rhythm: cycle([hold(1.0, 0.52), hold(0.75, 1.04), hold(1.0, -0.40), hold(0.85, 0.84), hold(1.4, 0.68)]),
            focus: "rhythm"
        }),
        define({
            id: 49,
            name: "五相移位",
            rule: "五相循环 · 每四针移相",
            needleCount: 17,
            layoutId: "Z8B",
            rhythm: cycle([hold(1.0, 0.52), hold(0.75, 1.04), hold(1.0, -0.40), hold(0.85, 0.84), hold(1.4, 0.68)], { phaseShiftEvery: 4, phaseShiftMs: 500 }),
            focus: "modifier"
        }),
        define({
            id: 50,
            name: "全环终曲",
            rule: "五相终曲 · 移相并翻转",
            needleCount: 17,
            layoutId: "Z8B",
            rhythm: cycle([hold(1.0, 0.52), hold(0.75, 1.06), hold(1.0, -0.42), hold(0.85, 0.86), hold(1.4, 0.68)], { phaseShiftEvery: 4, phaseShiftMs: 500, flipEvery: 6 }),
            focus: "coupling"
        }),
    ];
})();

const LEVEL_PACKS = Object.freeze({
    'balanced-v2': Object.freeze({
        id: 'balanced-v2',
        name: '平滑曲线 V2',
        caption: '非线性密度与节奏耦合 · 推荐试玩',
        difficultyModel: 'nonlinear-v2',
        chapters: Object.freeze([
            "校准与留白",
            "分区判断",
            "节奏控制",
            "复合压力",
            "专家终曲",
        ]),
        levels: BALANCED_LEVEL_DEFINITIONS
    }),
    legacy: Object.freeze({
        id: 'legacy',
        name: '旧版 50 关',
        caption: '原始方案 · 用于 A/B 对照',
        difficultyModel: 'legacy-linear',
        chapters: Object.freeze(['读盘基础', '分区和拍点', '复合循环', '密度控制', '专家综合']),
        levels: LEVEL_DEFINITIONS
    })
});
