class HiDPIRenderer {
    static getRenderScale() {
        return HiDPIRenderer.renderScale;
    }

    static getBackingWidth() {
        return Math.round(CONSTANTS.WIDTH * HiDPIRenderer.getRenderScale());
    }

    static getBackingHeight() {
        return Math.round(CONSTANTS.HEIGHT * HiDPIRenderer.getRenderScale());
    }

    static getCameraScrollX() {
        return (CONSTANTS.WIDTH / 2) * (1 - HiDPIRenderer.getRenderScale());
    }

    static getCameraScrollY() {
        return (CONSTANTS.HEIGHT / 2) * (1 - HiDPIRenderer.getRenderScale());
    }

    static configureCamera(camera) {
        camera.setViewport(
            0,
            0,
            HiDPIRenderer.getBackingWidth(),
            HiDPIRenderer.getBackingHeight()
        );
        camera.setZoom(HiDPIRenderer.getRenderScale());
        camera.setScroll(
            HiDPIRenderer.getCameraScrollX(),
            HiDPIRenderer.getCameraScrollY()
        );
        return camera;
    }

    static installCameraFactory() {
        const prototype = Phaser.Cameras.Scene2D.CameraManager.prototype;
        const originalAdd = prototype.add;

        prototype.add = function (...args) {
            const defaultViewport = args.length === 0
                || args.slice(0, 4).every(value => value === undefined);
            const camera = originalAdd.apply(this, args);
            return defaultViewport
                ? HiDPIRenderer.configureCamera(camera)
                : camera;
        };
    }

    static installTextFactory() {
        const prototype = Phaser.GameObjects.GameObjectFactory.prototype;
        const originalText = prototype.text;

        prototype.text = function (x, y, text, style) {
            const nextStyle = style && typeof style === 'object'
                ? { ...style }
                : {};

            if (!Object.prototype.hasOwnProperty.call(nextStyle, 'resolution')) {
                nextStyle.resolution = HiDPIRenderer.getRenderScale();
            }

            return originalText.call(this, x, y, text, nextStyle);
        };
    }

    static install() {
        if (HiDPIRenderer.installed) return;
        HiDPIRenderer.installCameraFactory();
        HiDPIRenderer.installTextFactory();
        HiDPIRenderer.installed = true;
    }
}

const rawDevicePixelRatio = typeof window === 'undefined'
    ? 1
    : Number(window.devicePixelRatio) || 1;
const clampedDevicePixelRatio = Math.max(1, Math.min(rawDevicePixelRatio, 2));

// Quantizing upward to 1/8 keeps the 600 × 800 backing buffer integral while
// avoiding a large, wasteful jump for uncommon fractional display scales.
HiDPIRenderer.renderScale = Math.ceil(clampedDevicePixelRatio * 8) / 8;
HiDPIRenderer.installed = false;
