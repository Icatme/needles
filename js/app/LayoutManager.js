class LayoutManager {
    static getViewportInfo() {
        const hostWindow = typeof window !== 'undefined' ? window : null;
        const hostDocument = typeof document !== 'undefined' ? document : null;
        const visualViewport = hostWindow?.visualViewport || null;
        const width = Number(
            visualViewport?.width
                || hostWindow?.innerWidth
                || hostDocument?.documentElement?.clientWidth
                || 600
        );
        const height = Number(
            visualViewport?.height
                || hostWindow?.innerHeight
                || hostDocument?.documentElement?.clientHeight
                || 800
        );

        return {
            width,
            height,
            ratio: height / Math.max(width, 1)
        };
    }

    static getRequestedProfileId() {
        if (typeof window === 'undefined' || !window.location) return null;

        try {
            const value = new URLSearchParams(window.location.search).get('layout');
            return value && value !== 'auto' && LAYOUT_PROFILES[value]
                ? value
                : null;
        } catch (error) {
            return null;
        }
    }

    static resolveProfileId(viewport = LayoutManager.getViewportInfo(), overrideId) {
        const requested = overrideId === undefined
            ? LayoutManager.getRequestedProfileId()
            : overrideId;
        if (requested && LAYOUT_PROFILES[requested]) return requested;

        const ratio = Number(viewport?.ratio)
            || Number(viewport?.height) / Math.max(Number(viewport?.width) || 1, 1);

        if (!Number.isFinite(ratio) || ratio < 1.5) return 'classic';
        if (ratio >= 1.95) return 'phone-tall';
        return 'phone-9-16';
    }

    static bootstrap() {
        if (LayoutManager.currentProfile) return LayoutManager.currentProfile;

        const profileId = LayoutManager.resolveProfileId();
        LayoutManager.currentProfile = LAYOUT_PROFILES[profileId]
            || LAYOUT_PROFILES.classic;
        LayoutManager.applyRuntimeConstants(LayoutManager.currentProfile);
        LayoutManager.applyDocumentMetadata(LayoutManager.currentProfile);
        return LayoutManager.currentProfile;
    }

    static applyRuntimeConstants(profile) {
        const design = profile.design;
        const game = profile.game;

        CONSTANTS.WIDTH = design.width;
        CONSTANTS.HEIGHT = design.height;
        CONSTANTS.WHEEL.CENTER_X = game.wheel.x;
        CONSTANTS.WHEEL.CENTER_Y = game.wheel.y;
        CONSTANTS.WHEEL.RADIUS = game.wheel.radius;
        CONSTANTS.NEEDLE.READY_Y = game.readyNeedleY;
        CONSTANTS.LAYOUT_PROFILE_ID = profile.id;
    }

    static applyDocumentMetadata(profile = LayoutManager.getProfile()) {
        if (typeof document === 'undefined') return;

        const root = document.documentElement;
        root.dataset.layoutProfile = profile.id;
        root.dataset.layoutFamily = profile.family;
        root.style.setProperty('--layout-width', String(profile.design.width));
        root.style.setProperty('--layout-height', String(profile.design.height));
        root.style.setProperty(
            '--layout-aspect',
            String(profile.design.width / profile.design.height)
        );
        root.style.setProperty(
            '--layout-max-width',
            `${Math.min(profile.design.width, profile.design.maxDisplayWidth)}px`
        );
    }

    static getProfile() {
        return LayoutManager.currentProfile || LayoutManager.bootstrap();
    }

    static getProfileId() {
        return LayoutManager.getProfile().id;
    }

    static getDimensions() {
        const { width, height } = LayoutManager.getProfile().design;
        return { width, height };
    }

    static getSceneLayout(sceneName) {
        const profile = LayoutManager.getProfile();
        return profile[sceneName] || LAYOUT_PROFILES.classic[sceneName] || {};
    }

    static getBackgroundLayout(mode) {
        const background = LayoutManager.getProfile().background;
        return {
            ...background,
            mode: background.modes[mode] || background.modes.menu
        };
    }

    static getScaleBounds() {
        const design = LayoutManager.getProfile().design;
        const aspect = design.height / design.width;
        return {
            min: {
                width: design.minDisplayWidth,
                height: Math.round(design.minDisplayWidth * aspect)
            },
            max: {
                width: design.maxDisplayWidth,
                height: Math.round(design.maxDisplayWidth * aspect)
            }
        };
    }

    static inspectViewportChange() {
        const current = LayoutManager.getProfile();
        const nextProfileId = LayoutManager.resolveProfileId();
        LayoutManager.applyDocumentMetadata(current);
        return {
            changed: nextProfileId !== current.id,
            currentProfileId: current.id,
            nextProfileId
        };
    }
}

LayoutManager.currentProfile = null;
