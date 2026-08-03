// Phaser 游戏配置
const config = {
    type: Phaser.AUTO,
    width: CONSTANTS.WIDTH,
    height: CONSTANTS.HEIGHT,
    parent: 'game-container',
    backgroundColor: CONSTANTS.UI.BACKGROUND,
    scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
        min: {
            width: 320,
            height: 480
        },
        max: {
            width: 1200,
            height: 1600
        }
    },
    physics: {
        default: 'arcade',
        arcade: {
            gravity: { y: 0 },
            debug: false
        }
    },
    scene: [
        BootScene,
        MenuScene,
        GameScene,
        GameOverScene
    ],
    input: {
        touch: true,
        mouse: true
    },
    render: {
        antialias: true,
        pixelArt: false
    }
};

// 初始化游戏
let game;

document.addEventListener('DOMContentLoaded', () => {
    game = new Phaser.Game(config);

    // 防止移动端页面滚动和缩放
    document.addEventListener('touchmove', (e) => {
        e.preventDefault();
    }, { passive: false });

    document.addEventListener('gesturestart', (e) => {
        e.preventDefault();
    });

    document.addEventListener('gesturechange', (e) => {
        e.preventDefault();
    });

    document.addEventListener('gestureend', (e) => {
        e.preventDefault();
    });
});

// 处理窗口大小变化
window.addEventListener('resize', () => {
    requestAnimationFrame(() => {
        if (game && game.scale) {
            game.scale.refresh();
        }
    });
});
