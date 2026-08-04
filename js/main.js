// 在 Phaser 创建渲染器前选择显示模板并应用逻辑画布尺寸。
LayoutManager.bootstrap();
HiDPIRenderer.install();

const scaleBounds = LayoutManager.getScaleBounds();

// Phaser 游戏配置
const config = {
    type: Phaser.AUTO,
    width: HiDPIRenderer.getBackingWidth(),
    height: HiDPIRenderer.getBackingHeight(),
    parent: 'game-container',
    backgroundColor: CONSTANTS.UI.BACKGROUND,
    scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
        autoRound: true,
        min: scaleBounds.min,
        max: scaleBounds.max
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
        EnhancedMenuScene,
        PlaytestLevelSelectScene,
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
    document.addEventListener('touchmove', (event) => {
        event.preventDefault();
    }, { passive: false });

    document.addEventListener('gesturestart', (event) => {
        event.preventDefault();
    });

    document.addEventListener('gesturechange', (event) => {
        event.preventDefault();
    });

    document.addEventListener('gestureend', (event) => {
        event.preventDefault();
    });
});

let resizeTimer = null;

function handleViewportChange() {
    if (resizeTimer) window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(() => {
        const change = LayoutManager.inspectViewportChange();

        // 逻辑画布尺寸跨模板变化时，完整重建 Phaser，避免运行时相机和纹理残留旧尺寸。
        if (change.changed) {
            window.location.reload();
            return;
        }

        requestAnimationFrame(() => {
            if (game?.scale) game.scale.refresh();
        });
    }, 140);
}

window.addEventListener('resize', handleViewportChange);
window.addEventListener('orientationchange', handleViewportChange);
