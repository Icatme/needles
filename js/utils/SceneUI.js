const THEME_UI_PALETTES = Object.freeze({
	"clockwork-observatory": Object.freeze({
		...CONSTANTS.UI,
		BACKGROUND: 0x11161b,
		BACKGROUND_ALT: 0x1d2a30,
		SURFACE: 0x182329,
		INK: 0xe8efec,
		INK_SOFT: 0xc6d1ce,
		MUTED: 0xa5b5b1,
		RULE: 0x496065,
		ACCENT: 0xc89c52,
		ACCENT_DARK: 0xa67c39,
		SUCCESS: 0x6ec3a0,
		ERROR: 0xef7868,
		TEXT_COLOR: "#edf2ef",
		TEXT_INVERSE: "#11161b",
		TEXT_MUTED: "#9fb1ad",
		TEXT_ACCENT: "#d8ae67",
		TEXT_SUCCESS: "#81d3b0",
		TEXT_ERROR: "#ff9280",
		PRIMARY_FILL: 0xc89c52,
		PRIMARY_HOVER: 0xd9b66f,
		PRIMARY_STROKE: 0xe1c07e,
		PRIMARY_TEXT: "#11161b",
		SECONDARY_FILL: 0x182329,
		SECONDARY_HOVER: 0x223139,
		SECONDARY_STROKE: 0x829b97,
		SECONDARY_TEXT: "#edf2ef",
		QUIET_FILL: 0x11191d,
		QUIET_HOVER: 0x1c292f,
		QUIET_STROKE: 0x496065,
		QUIET_TEXT: "#9fb1ad",
		DANGER_FILL: 0x24191a,
		DANGER_HOVER: 0x342022,
		DANGER_STROKE: 0xef7868,
		DANGER_TEXT: "#ff9280",
		ACTION_INK: 0xdbe7e3,
		ACTION_OUTLINE: 0x94aaa5,
		ACTION_SHADOW: 0x080c0f,
		TARGET_RING: 0x77918c,
	}),
	"gilded-jewel-box": Object.freeze({
		...CONSTANTS.UI,
		BACKGROUND: 0x2a1624,
		BACKGROUND_ALT: 0x43233a,
		SURFACE: 0x351c2d,
		INK: 0xf2e7e1,
		INK_SOFT: 0xdfc5c6,
		MUTED: 0xc5aeb6,
		RULE: 0x744d5c,
		ACCENT: 0xd7b27a,
		ACCENT_DARK: 0xb8835f,
		SUCCESS: 0x82c7a6,
		ERROR: 0xf18187,
		TEXT_COLOR: "#f6ebe5",
		TEXT_INVERSE: "#24121d",
		TEXT_MUTED: "#c5aeb6",
		TEXT_ACCENT: "#e0b67d",
		TEXT_SUCCESS: "#99d8bb",
		TEXT_ERROR: "#ff9ca1",
		PRIMARY_FILL: 0xc38a89,
		PRIMARY_HOVER: 0xd8a09f,
		PRIMARY_STROKE: 0xe5b4b0,
		PRIMARY_TEXT: "#24121d",
		SECONDARY_FILL: 0x351c2d,
		SECONDARY_HOVER: 0x48253b,
		SECONDARY_STROKE: 0xb77d7e,
		SECONDARY_TEXT: "#f6ebe5",
		QUIET_FILL: 0x26131f,
		QUIET_HOVER: 0x3b1e31,
		QUIET_STROKE: 0x744d5c,
		QUIET_TEXT: "#c5aeb6",
		DANGER_FILL: 0x321720,
		DANGER_HOVER: 0x48202b,
		DANGER_STROKE: 0xf18187,
		DANGER_TEXT: "#ff9ca1",
		ACTION_INK: 0xead8d2,
		ACTION_OUTLINE: 0xc38a89,
		ACTION_SHADOW: 0x160a12,
		TARGET_RING: 0xd7b27a,
	}),
});

class SceneUI {
	static prefersReducedMotion() {
		return (
			typeof window !== "undefined" &&
			window.matchMedia &&
			window.matchMedia("(prefers-reduced-motion: reduce)").matches
		);
	}

	static getPalette(explicitThemeId) {
		const themeId = ThemeBackground.getThemeId(explicitThemeId);
		return THEME_UI_PALETTES[themeId] || THEME_UI_PALETTES["clockwork-observatory"];
	}

	static createBackdrop(scene, variant = "default") {
		const themeId = ThemeBackground.getThemeId();
		const ui = SceneUI.getPalette(themeId);
		const background = ThemeBackground.create(scene, variant, themeId);
		const graphics = scene.add.graphics();
		graphics.setDepth(1);
		graphics.lineStyle(2, ui.INK, 0.72);
		graphics.lineBetween(28, 24, 92, 24);
		graphics.lineStyle(2, ui.ACCENT, 1);
		graphics.lineBetween(28, 24, 48, 24);

		if (variant === "game") {
			const x = CONSTANTS.WHEEL.CENTER_X;
			const y = CONSTANTS.WHEEL.CENTER_Y;
			const radius = CONSTANTS.WHEEL.RADIUS + 38;

			graphics.lineStyle(1, ui.TARGET_RING, 0.32);
			graphics.strokeCircle(x, y, radius);
			graphics.lineStyle(2, ui.INK, 0.56);
			graphics.lineBetween(x - radius - 10, y, x - radius + 5, y);
			graphics.lineBetween(x + radius - 5, y, x + radius + 10, y);
			graphics.lineBetween(x, y - radius - 10, x, y - radius + 5);
			graphics.lineBetween(x, y + radius - 5, x, y + radius + 10);
		}

		return { background, graphics };
	}

	static createPanel(scene, x, y, width, height, options = {}) {
		const ui = SceneUI.getPalette(options.themeId);
		const graphics = scene.add.graphics();
		const fillColor = options.fillColor ?? ui.SURFACE;
		const fillAlpha = options.fillAlpha ?? 1;
		const strokeColor = options.strokeColor ?? ui.RULE;
		const radius = options.radius ?? 16;

		graphics.fillStyle(fillColor, fillAlpha);
		graphics.fillRoundedRect(-width / 2, -height / 2, width, height, radius);
		graphics.lineStyle(
			options.strokeWidth ?? 1,
			strokeColor,
			options.strokeAlpha ?? 1,
		);
		graphics.strokeRoundedRect(-width / 2, -height / 2, width, height, radius);
		graphics.setPosition(x, y);
		graphics.setDepth(options.depth ?? 20);
		return graphics;
	}

	static createButton(scene, x, y, label, callback, options = {}) {
		const ui = SceneUI.getPalette(options.themeId);
		const width = options.width ?? 232;
		const height = options.height ?? ui.BUTTON_HEIGHT;
		const variant = options.variant ?? "primary";
		const depth = options.depth ?? 50;
		const container = scene.add.container(x, y);
		const background = scene.add.graphics();
		const text = scene.add.text(0, 0, label, {
			fontFamily: ui.BODY_FONT,
			fontSize: options.fontSize ?? "18px",
			color: ui.TEXT_COLOR,
			fontStyle: "bold",
		});

		text.setOrigin(0.5);
		container.add([background, text]);
		container.setSize(width, height);
		container.setDepth(depth);
		container.setInteractive({ useHandCursor: true });

		const palette = {
			primary: {
				fill: ui.PRIMARY_FILL,
				hoverFill: ui.PRIMARY_HOVER,
				stroke: ui.PRIMARY_STROKE,
				text: ui.PRIMARY_TEXT,
			},
			secondary: {
				fill: ui.SECONDARY_FILL,
				hoverFill: ui.SECONDARY_HOVER,
				stroke: ui.SECONDARY_STROKE,
				text: ui.SECONDARY_TEXT,
			},
			quiet: {
				fill: ui.QUIET_FILL,
				hoverFill: ui.QUIET_HOVER,
				stroke: ui.QUIET_STROKE,
				text: ui.QUIET_TEXT,
			},
			danger: {
				fill: ui.DANGER_FILL,
				hoverFill: ui.DANGER_HOVER,
				stroke: ui.DANGER_STROKE,
				text: ui.DANGER_TEXT,
			},
		}[variant];

		const draw = (state = "default") => {
			background.clear();
			const fill = state === "hover" ? palette.hoverFill : palette.fill;
			background.fillStyle(fill, 1);
			background.fillRoundedRect(
				-width / 2,
				-height / 2,
				width,
				height,
				ui.BUTTON_RADIUS,
			);
			background.lineStyle(2, palette.stroke, 1);
			background.strokeRoundedRect(
				-width / 2,
				-height / 2,
				width,
				height,
				ui.BUTTON_RADIUS,
			);
			text.setColor(palette.text);
		};

		draw();
		container.on("pointerover", () => draw("hover"));
		container.on("pointerout", () => {
			draw();
			container.setScale(1);
		});
		container.on("pointerdown", () => container.setScale(0.98));
		container.on("pointerup", () => {
			container.setScale(1);
			if (callback) callback();
		});

		container.setEnabled = (enabled) => {
			if (enabled) {
				container.setAlpha(1);
				container.setInteractive({ useHandCursor: true });
			} else {
				container.setAlpha(0.5);
				container.disableInteractive();
			}
		};

		return container;
	}
}
