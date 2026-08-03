class ThemeBackground {
	static getThemeId(explicitThemeId) {
		if (explicitThemeId) return explicitThemeId;
		try {
			return (
				localStorage.getItem(CONSTANTS.THEME_STORAGE_KEY) ||
				"clockwork-observatory"
			);
		} catch (error) {
			return "clockwork-observatory";
		}
	}

	static getMode(variant) {
		if (variant === "game") return "game";
		if (variant === "result" || variant === "game-over") return "game-over";
		return "menu";
	}

	static create(scene, variant = "default", explicitThemeId) {
		const themeId = ThemeBackground.getThemeId(explicitThemeId);
		const mode = ThemeBackground.getMode(variant);
		const reduced = SceneUI.prefersReducedMotion();
		const root = scene.add.container(0, 0).setDepth(-10);
		const animationTargets =
			themeId === "gilded-jewel-box"
				? ThemeBackground.drawJewelBox(scene, root, mode)
				: ThemeBackground.drawObservatory(scene, root, mode);
		const tweens =
			reduced || mode === "game-over"
				? []
				: ThemeBackground.animate(scene, themeId, animationTargets);

		root.themeId = themeId;
		root.mode = mode;
		root.animationCount = tweens.length;

		scene.events.once("shutdown", () => {
			tweens.forEach((tween) => tween?.remove());
			root.destroy(true);
		});
		return root;
	}

	static drawObservatory(scene, root, mode) {
		const base = ThemeBackground.addGraphics(scene, root);
		ThemeBackground.drawVerticalGradient(base, [
			{ at: 0, color: 0x15232b },
			{ at: 0.46, color: 0x11161b },
			{ at: 1, color: 0x0e1418 },
		]);
		base.fillStyle(0x1d3a42, 0.08);
		base.fillEllipse(300, 170, 460, 180);
		base.fillStyle(0x1d3a42, 0.06);
		base.fillEllipse(300, 170, 360, 125);

		const starGroup = scene.add.container(mode === "menu" ? -4 : 0, 0);
		root.add(starGroup);
		const stars = scene.add.graphics();
		starGroup.add(stars);
		const starMultiplier =
			mode === "menu" ? 1.3 : mode === "game-over" ? 0.65 : 1;
		const starPoints = [
			[58, 50, 1.5],
			[112, 78, 1],
			[176, 45, 1.5],
			[239, 87, 1],
			[324, 55, 1.5],
			[388, 92, 1],
			[447, 42, 1.5],
			[525, 74, 1],
			[90, 160, 1],
			[206, 142, 1.5],
			[352, 168, 1],
			[492, 145, 1.5],
		];
		stars.fillStyle(0x91aaa7, 0.18 * starMultiplier);
		starPoints.forEach(([x, y, radius]) => stars.fillCircle(x, y, radius));
		stars.lineStyle(1, 0x4e7b73, 0.12 * starMultiplier);
		stars.lineBetween(58, 50, 112, 78);
		stars.lineBetween(176, 45, 239, 87);
		stars.lineBetween(388, 92, 447, 42);
		stars.lineStyle(1, 0xa67c39, 0.1);
		ThemeBackground.strokeArc(stars, 300, 40, 220, 0.2, 2.94);

		const halo = ThemeBackground.addGraphics(scene, root);
		halo.lineStyle(34, 0x355c63, 0.04);
		halo.strokeCircle(300, 330, 160);
		halo.lineStyle(24, 0x355c63, 0.06);
		halo.strokeCircle(300, 330, 138);
		halo.lineStyle(14, 0x355c63, 0.09);
		halo.strokeCircle(300, 330, 116);
		if (mode === "menu") {
			halo.lineStyle(30, 0x355c63, 0.05);
			halo.strokeCircle(300, 330, 154);
		}

		const instruments = ThemeBackground.addGraphics(scene, root);
		instruments.lineStyle(2, 0xa67c39, mode === "menu" ? 0.21 : 0.18);
		ThemeBackground.strokeArc(instruments, 300, 330, 158, 3.48, 5.93);
		instruments.lineStyle(1, 0x4e7b73, mode === "menu" ? 0.16 : 0.14);
		ThemeBackground.strokeArc(instruments, 300, 330, 182, 3.3, 6.18);
		instruments.lineStyle(1, 0xa67c39, 0.12);
		ThemeBackground.strokeArc(instruments, 300, 330, 214, 2.78, 3.92);
		ThemeBackground.strokeArc(instruments, 300, 330, 214, 5.5, 6.62);
		instruments.lineStyle(1, 0xc89c52, 0.16);
		for (let index = 0; index < 24; index++) {
			const angle = (index / 24) * Math.PI * 2;
			instruments.lineBetween(
				300 + Math.cos(angle) * 174,
				330 + Math.sin(angle) * 174,
				300 + Math.cos(angle) * 182,
				330 + Math.sin(angle) * 182,
			);
		}
		instruments.lineStyle(2, 0xa67c39, 0.1);
		instruments.lineBetween(72, 250, 148, 470);
		instruments.lineStyle(2, 0xa67c39, 0.08);
		instruments.lineBetween(528, 230, 460, 455);

		const quietZones = ThemeBackground.addGraphics(scene, root);
		quietZones.fillStyle(0x0c1115, 0.3);
		quietZones.fillRect(252, 420, 96, 300);
		quietZones.lineStyle(1, 0x4e7b73, 0.1);
		quietZones.lineBetween(248, 452, 248, 720);
		quietZones.lineBetween(352, 452, 352, 720);
		ThemeBackground.drawBackings(quietZones, {
			hud: 0x0e1317,
			hudAlpha: 0.6,
			divider: 0xa67c39,
			dividerAlpha: 0.16,
			panel: 0x0d1216,
			panelAlpha: 0.82,
			panelStroke: 0xa67c39,
			panelStrokeAlpha: 0.18,
			panelRadius: 12,
		});

		if (mode === "game-over") {
			const result = ThemeBackground.addGraphics(scene, root);
			result.fillStyle(0x081015, 0.24);
			result.fillRect(0, 0, CONSTANTS.WIDTH, CONSTANTS.HEIGHT);
			result.lineStyle(2, 0xa67c39, 0.1);
			result.strokeCircle(300, 330, 124);
		}

		return { ambient: starGroup, focus: halo };
	}

	static drawJewelBox(scene, root, mode) {
		const base = ThemeBackground.addGraphics(scene, root);
		ThemeBackground.drawVerticalGradient(base, [
			{ at: 0, color: 0x341b2d },
			{ at: 0.46, color: 0x2a1624 },
			{ at: 1, color: 0x22101d },
		]);
		base.fillStyle(0x341b2d, 0.55);
		base.fillRoundedRect(18, 18, 564, 764, 28);
		base.lineStyle(2, 0x9a6b57, 0.28);
		base.strokeRoundedRect(18, 18, 564, 764, 28);
		base.lineStyle(1, 0xd7b27a, 0.1);
		base.strokeRoundedRect(24, 24, 552, 752, 24);
		base.fillStyle(0x4a2034, 0.16);
		base.fillEllipse(300, 180, 390, 150);
		base.fillStyle(0xe3b8b3, 0.08);
		base.fillEllipse(300, 210, 280, 90);
		base.fillStyle(0x4a2034, 0.18);
		base.fillEllipse(300, 330, 270, 200);

		const cradle = ThemeBackground.addGraphics(scene, root);
		cradle.lineStyle(28, 0xd7b27a, 0.04);
		cradle.strokeCircle(300, 330, 150);
		cradle.lineStyle(18, 0xd7b27a, 0.07);
		cradle.strokeCircle(300, 330, 132);
		cradle.lineStyle(10, 0xc38a89, 0.09);
		cradle.strokeCircle(300, 330, 116);
		if (mode === "menu") {
			cradle.lineStyle(28, 0xd7b27a, 0.05);
			cradle.strokeCircle(300, 330, 154);
		}

		const facets = ThemeBackground.addGraphics(scene, root);
		const facetMultiplier =
			mode === "menu" ? 1.25 : mode === "game-over" ? 0.7 : 1;
		facets.fillStyle(0xc38a89, 0.08 * facetMultiplier);
		facets.fillTriangle(34, 32, 92, 32, 70, 70);
		facets.fillTriangle(508, 32, 566, 32, 530, 70);
		facets.fillStyle(0xd7b27a, 0.06 * facetMultiplier);
		facets.fillTriangle(34, 32, 70, 70, 48, 98);
		facets.fillTriangle(566, 32, 552, 98, 530, 70);

		const trimMultiplier = mode === "menu" ? 1.2 : 1;
		const quietZones = ThemeBackground.addGraphics(scene, root);
		quietZones.fillStyle(0x9a6b57, 0.1 * trimMultiplier);
		quietZones.fillRect(34, 150, 12, 430);
		quietZones.fillRect(554, 150, 12, 430);
		quietZones.fillStyle(0x22101d, 0.34);
		quietZones.fillRoundedRect(248, 420, 104, 305, 30);
		quietZones.fillStyle(0x4a2034, 0.16);
		quietZones.fillEllipse(300, 467, 90, 70);
		quietZones.lineStyle(1, 0xc38a89, 0.12);
		quietZones.lineBetween(248, 448, 248, 710);
		quietZones.lineBetween(352, 448, 352, 710);
		ThemeBackground.drawBackings(quietZones, {
			hud: 0x201018,
			hudAlpha: 0.58,
			divider: 0xd7b27a,
			dividerAlpha: 0.12,
			panel: 0x24121d,
			panelAlpha: 0.84,
			panelStroke: 0xc38a89,
			panelStrokeAlpha: 0.18,
			panelRadius: 14,
		});

		if (mode === "game-over") {
			const result = ThemeBackground.addGraphics(scene, root);
			result.fillStyle(0x160a12, 0.22);
			result.fillRect(0, 0, CONSTANTS.WIDTH, CONSTANTS.HEIGHT);
			result.lineStyle(2, 0xd7b27a, 0.1);
			result.strokeCircle(300, 330, 124);
		}

		return { ambient: facets, focus: cradle };
	}

	static drawBackings(graphics, palette) {
		graphics.fillStyle(palette.hud, palette.hudAlpha);
		graphics.fillRect(0, 0, CONSTANTS.WIDTH, 120);
		graphics.lineStyle(1, palette.divider, palette.dividerAlpha);
		graphics.lineBetween(0, 119, CONSTANTS.WIDTH, 119);
		graphics.fillStyle(palette.panel, palette.panelAlpha);
		graphics.fillRoundedRect(16, 740, 568, 48, palette.panelRadius);
		graphics.lineStyle(1, palette.panelStroke, palette.panelStrokeAlpha);
		graphics.strokeRoundedRect(16, 740, 568, 48, palette.panelRadius);
	}

	static drawVerticalGradient(graphics, stops) {
		const height = CONSTANTS.HEIGHT;
		const stripeHeight = 8;
		for (let y = 0; y < height; y += stripeHeight) {
			const progress = y / Math.max(1, height - stripeHeight);
			let start = stops[0];
			let end = stops[stops.length - 1];
			for (let index = 1; index < stops.length; index++) {
				if (progress <= stops[index].at) {
					start = stops[index - 1];
					end = stops[index];
					break;
				}
			}
			const span = Math.max(0.0001, end.at - start.at);
			const localProgress = Math.max(
				0,
				Math.min(1, (progress - start.at) / span),
			);
			graphics.fillStyle(
				ThemeBackground.mixColor(start.color, end.color, localProgress),
				1,
			);
			graphics.fillRect(0, y, CONSTANTS.WIDTH, stripeHeight);
		}
	}

	static mixColor(start, end, amount) {
		const startRed = (start >> 16) & 0xff;
		const startGreen = (start >> 8) & 0xff;
		const startBlue = start & 0xff;
		const endRed = (end >> 16) & 0xff;
		const endGreen = (end >> 8) & 0xff;
		const endBlue = end & 0xff;
		const red = Math.round(startRed + (endRed - startRed) * amount);
		const green = Math.round(startGreen + (endGreen - startGreen) * amount);
		const blue = Math.round(startBlue + (endBlue - startBlue) * amount);
		return (red << 16) | (green << 8) | blue;
	}

	static strokeArc(graphics, x, y, radius, startAngle, endAngle) {
		graphics.beginPath();
		graphics.arc(x, y, radius, startAngle, endAngle, false);
		graphics.strokePath();
	}

	static addGraphics(scene, root) {
		const graphics = scene.add.graphics();
		root.add(graphics);
		return graphics;
	}

	static animate(scene, themeId, targets) {
		if (themeId === "gilded-jewel-box") {
			targets.ambient.setAlpha(0.6);
			targets.focus.setAlpha(0.88);
			return [
				scene.tweens.add({
					targets: targets.ambient,
					alpha: 1,
					duration: 6000,
					yoyo: true,
					repeat: -1,
					ease: "Sine.easeInOut",
				}),
				scene.tweens.add({
					targets: targets.focus,
					alpha: 1,
					duration: 4500,
					yoyo: true,
					repeat: -1,
					ease: "Sine.easeInOut",
				}),
			];
		}

		targets.ambient.setPosition(-4, 0);
		targets.focus.setAlpha(0.92);
		return [
			scene.tweens.add({
				targets: targets.ambient,
				x: 4,
				duration: 11000,
				yoyo: true,
				repeat: -1,
				ease: "Sine.easeInOut",
			}),
			scene.tweens.add({
				targets: targets.focus,
				alpha: 1,
				duration: 4000,
				yoyo: true,
				repeat: -1,
				ease: "Sine.easeInOut",
			}),
		];
	}
}
