class LayoutManager {
    static getViewportInfo() {
        const hostWindow = typeof window !== 'undefined' ? window : null;
        const hostDocument = typeof document !== 'undefined' ? document : null;
        const hostNavigator = typeof navigator !== 'undefined' ? navigator : null;
        const hostScreen = typeof screen !== 'undefined' ? screen : null;
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
        const coarsePointer = Boolean(
            hostWindow?.matchMedia?.('(pointer: coarse)')?.matches
        );
        const touchCapable = Number(hostNavigator?.maxTouchPoints || 0) > 0
            || coarsePointer;
        const screenWidth = Number(hostScreen?.width || 0);
        const screenHeight = Number(hostScreen?.height || 0);
        const useStablePhoneRatio = touchCapable
            && height >= width
            && screenWidth > 0
            && screenHeight > 0;
        const matchWidth = useStablePhoneRatio
            ? Math.min(screenWidth, screenHeight)
            : width;
        const matchHeight = useStablePhoneRatio
            ? Math.max(screenWidth, screenHeight)
            : height;

        return {
            width,
            height,
            matchWidth,
            matchHeight,
            ratio: matchHeight / Math.max(matchWidth, 1)
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

    static getNeedleFlightMetrics(profile = LayoutManager.getProfile()) {
        const design = profile.design;
        const game = profile.game;
        const needleLength = Number(CONSTANTS.NEEDLE.LENGTH) || 100;
        const insertDepth = Number(CONSTANTS.NEEDLE.INSERT_DEPTH) || 16;
        const durationMs = Math.max(
            1,
            Number(CONSTANTS.NEEDLE.FLY_DURATION_MS) || 86
        );
        const startX = design.width / 2;
        const startY = game.readyNeedleY;
        const targetX = game.wheel.x;
        const targetY = game.wheel.y
            + game.wheel.radius
            + needleLength
            - insertDepth;
        const distance = Math.hypot(targetX - startX, targetY - startY);

        return Object.freeze({
            startX,
            startY,
            targetX,
            targetY,
            distance,
            durationMs,
            speed: distance / (durationMs / 1000)
        });
    }

    static applyRuntimeConstants(profile) {
        const design = profile.design;
        const game = profile.game;
        const flight = LayoutManager.getNeedleFlightMetrics(profile);

        CONSTANTS.WIDTH = design.width;
        CONSTANTS.HEIGHT = design.height;
        CONSTANTS.WHEEL.CENTER_X = game.wheel.x;
        CONSTANTS.WHEEL.CENTER_Y = game.wheel.y;
        CONSTANTS.WHEEL.RADIUS = game.wheel.radius;
        CONSTANTS.NEEDLE.READY_Y = game.readyNeedleY;
        CONSTANTS.NEEDLE.FLY_SPEED = flight.speed;
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
