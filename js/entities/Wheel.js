/* Hallmark · pre-emit critique: P5 H5 E4 S5 R4 V5 */
/* Hallmark · component: center wheel · genre: modern-minimal + playful
 * Themes: Clockwork Observatory + Gilded Jewel Box. Both renderers share one exact
 * collision silhouette. Jewel highlights use ChatGPT-designed SCREEN textures.
 */
class Wheel {
    constructor(scene, x, y, radius, visual) {
        const supportedThemes = ['clockwork-observatory', 'gilded-jewel-box'];
        if (!visual || !supportedThemes.includes(visual.theme)) {
            throw new Error('Wheel requires an authored visual theme');
        }

        this.scene = scene;
        this.x = x;
        this.y = y;
        this.radius = radius;
        this.visual = visual;
        this.rotation = 0;
        this.reducedMotion = typeof SceneUI !== 'undefined'
            && SceneUI.prefersReducedMotion();

        this.createGraphics();
    }

    createGraphics() {
        this.graphics = this.scene.add.graphics();
        this.graphics.setPosition(this.x, this.y);
        // 转盘盖住插入盘内的部分，针尖不会浮在盘面上。
        this.graphics.setDepth(12);
        this.draw();
        this.createSpecularImage();
    }

    createSpecularImage() {
        if (this.visual.theme !== 'gilded-jewel-box') return;

        // 生成纹理中的发光圆占画布约 91.6%，按此反推显示尺寸以贴合 88px 真实轮廓。
        const displaySize = this.radius * 2 / 0.916;
        this.specularImage = this.scene.add.image(
            this.x,
            this.y,
            'jewel-wheel-specular'
        );
        this.specularImage.setDisplaySize(displaySize, displaySize);
        this.specularImage.setBlendMode('SCREEN');
        this.specularImage.setDepth(13);
        this.updateSpecular();
    }

    updateSpecular() {
        if (!this.specularImage) return;

        if (this.reducedMotion) {
            this.specularImage.setAlpha(0.88);
            return;
        }

        // 亮度只随实体转动变化；高光方向固定在屏幕左上方，不做独立循环动画。
        const phase = this.rotation + this.visual.motifVariant * 0.19;
        const catchLight = (Math.cos(phase * 2) + 1) / 2;
        this.specularImage.setAlpha(0.82 + catchLight * 0.18);
    }

    draw() {
        if (this.visual.theme === 'gilded-jewel-box') {
            JewelWheelRenderer.draw(this.graphics, this.radius, this.visual);
            return;
        }

        const graphics = this.graphics;
        const radius = this.radius;
        const palette = this.getPalette();

        graphics.clear();

        // 阴影和真实圆形轮廓保持所有关卡一致，避免视觉欺骗碰撞边界。
        graphics.fillStyle(CONSTANTS.UI.INK, 0.12);
        graphics.fillCircle(0, 5, radius + 5);
        graphics.fillStyle(CONSTANTS.WHEEL.COLOR, 1);
        graphics.fillCircle(0, 0, radius);

        this.drawSpokes(palette);
        this.drawFamilyMotif(palette);
        this.drawRings(palette);
        this.drawRim(palette);
        this.drawTicks(palette);
        this.drawHub(palette);

        graphics.lineStyle(
            CONSTANTS.WHEEL.OUTLINE_WIDTH,
            CONSTANTS.WHEEL.OUTLINE_COLOR,
            1
        );
        graphics.strokeCircle(0, 0, radius);
    }

    getPalette() {
        const palettes = {
            steel: {
                primary: CONSTANTS.UI.STEEL,
                secondary: CONSTANTS.WHEEL.DETAIL_COLOR
            },
            'paper-steel': {
                primary: CONSTANTS.WHEEL.DETAIL_COLOR,
                secondary: CONSTANTS.UI.STEEL
            },
            brass: {
                primary: CONSTANTS.UI.BRASS,
                secondary: CONSTANTS.UI.BRASS_DARK
            },
            'brass-steel': {
                primary: CONSTANTS.UI.BRASS,
                secondary: CONSTANTS.UI.STEEL
            },
            verdigris: {
                primary: CONSTANTS.UI.VERDIGRIS,
                secondary: CONSTANTS.UI.VERDIGRIS_DARK
            },
            'verdigris-steel': {
                primary: CONSTANTS.UI.VERDIGRIS,
                secondary: CONSTANTS.UI.STEEL
            },
            'steel-brass': {
                primary: CONSTANTS.UI.STEEL,
                secondary: CONSTANTS.UI.BRASS
            },
            celestial: {
                primary: CONSTANTS.UI.BRASS,
                secondary: CONSTANTS.UI.VERDIGRIS
            },
            'brass-verdigris': {
                primary: CONSTANTS.UI.VERDIGRIS,
                secondary: CONSTANTS.UI.BRASS
            }
        };

        return palettes[this.visual.material];
    }

    drawSpokes(palette) {
        const count = this.visual.spokeCount;
        if (count === 0) return;

        const phase = this.visual.motifVariant * 0.17;
        this.drawRadialMarks(
            count,
            20,
            this.radius * 0.57,
            phase,
            palette.secondary,
            0.23,
            this.visual.milestone ? 2 : 1
        );
    }

    drawRings(palette) {
        this.visual.ringRadii.forEach((ratio, index) => {
            this.graphics.lineStyle(
                index === this.visual.ringRadii.length - 1 ? 2 : 1,
                index % 2 === 0 ? palette.primary : palette.secondary,
                this.visual.milestone ? 0.46 : 0.30
            );
            this.graphics.strokeCircle(0, 0, this.radius * ratio);
        });
    }

    drawRim(palette) {
        const radius = this.radius;
        const style = this.visual.rimStyle;
        const graphics = this.graphics;

        graphics.lineStyle(1.5, palette.primary, 0.46);

        if (style === 'clean') {
            graphics.strokeCircle(0, 0, radius - 7);
            return;
        }

        if (style === 'double') {
            graphics.strokeCircle(0, 0, radius - 6);
            graphics.lineStyle(1, palette.secondary, 0.34);
            graphics.strokeCircle(0, 0, radius - 12);
            return;
        }

        if (style === 'notched') {
            graphics.strokeCircle(0, 0, radius - 10);
            this.drawRadialMarks(20, radius - 15, radius - 7, 0.08, palette.secondary, 0.44, 1);
            return;
        }

        if (style === 'rail') {
            graphics.strokeCircle(0, 0, radius - 6);
            graphics.strokeCircle(0, 0, radius - 13);
            this.drawRadialMarks(8, radius - 13, radius - 6, 0, palette.secondary, 0.48, 2);
            return;
        }

        if (style === 'segmented') {
            for (let index = 0; index < 8; index++) {
                const start = index * Math.PI / 4 + 0.08;
                this.drawArc(0, 0, radius - 8, start, start + 0.53);
            }
            return;
        }

        // 每章第十关使用更密的三层表冠，仍然完全收在碰撞圆内。
        graphics.strokeCircle(0, 0, radius - 5);
        graphics.strokeCircle(0, 0, radius - 10);
        graphics.lineStyle(1, palette.secondary, 0.52);
        graphics.strokeCircle(0, 0, radius - 15);
        this.drawRadialMarks(12, radius - 15, radius - 6, 0, palette.primary, 0.62, 2);
    }

    drawTicks(palette) {
        const count = this.visual.tickCount;
        const accentIndex = Math.round(
            this.visual.accentAngle / (Math.PI * 2) * count
        ) % count;

        for (let index = 0; index < count; index++) {
            const angle = index / count * Math.PI * 2;
            const major = index % this.visual.majorEvery === 0;
            const accent = index === accentIndex;
            const color = accent
                ? CONSTANTS.UI.ACCENT
                : (major ? palette.primary : palette.secondary);
            const alpha = accent ? 1 : (major ? 0.78 : 0.42);
            const width = accent ? 3 : (major ? 2 : 1);
            const outer = this.radius - 7;
            const inner = this.radius - (major ? 22 : 16);

            this.graphics.lineStyle(width, color, alpha);

            if (this.visual.tickStyle === 'dot') {
                this.graphics.fillStyle(color, alpha);
                this.graphics.fillCircle(
                    Math.cos(angle) * (this.radius - 12),
                    Math.sin(angle) * (this.radius - 12),
                    accent ? 2.5 : (major ? 2 : 1.25)
                );
            } else if (this.visual.tickStyle === 'tangent') {
                const centerRadius = this.radius - (major ? 15 : 12);
                const halfLength = major ? 5 : 3;
                const centerX = Math.cos(angle) * centerRadius;
                const centerY = Math.sin(angle) * centerRadius;
                const tangentX = -Math.sin(angle) * halfLength;
                const tangentY = Math.cos(angle) * halfLength;
                this.graphics.lineBetween(
                    centerX - tangentX,
                    centerY - tangentY,
                    centerX + tangentX,
                    centerY + tangentY
                );
            } else if (this.visual.tickStyle === 'paired') {
                [-0.018, 0.018].forEach(offset => {
                    this.drawRadialLine(angle + offset, inner, outer);
                });
            } else {
                this.drawRadialLine(angle, inner, outer);
            }
        }
    }

    drawFamilyMotif(palette) {
        if (this.visual.family === 'calibration') {
            this.drawCalibration(palette);
        } else if (this.visual.family === 'geartrain') {
            this.drawGeartrain(palette);
        } else if (this.visual.family === 'escapement') {
            this.drawEscapement(palette);
        } else if (this.visual.family === 'chronograph') {
            this.drawChronograph(palette);
        } else {
            this.drawOrrery(palette);
        }
    }

    drawCalibration(palette) {
        const variant = this.visual.motifVariant;
        const phase = variant * Math.PI / 11;
        const sweep = 1.25 + (variant % 3) * 0.34;

        this.graphics.lineStyle(2, palette.primary, 0.55);
        this.drawArc(0, 0, 48, phase, phase + sweep);
        this.graphics.lineStyle(1, palette.secondary, 0.48);
        this.drawArc(0, 0, 41, phase + Math.PI, phase + Math.PI + sweep * 0.72);
        this.drawRadialMarks(
            3 + (variant % 4),
            27,
            51,
            phase,
            palette.primary,
            0.35,
            1
        );

        const chordAngle = phase + Math.PI / 2;
        const chordOffset = (variant % 3 - 1) * 8;
        const tangentX = Math.cos(chordAngle) * 38;
        const tangentY = Math.sin(chordAngle) * 38;
        const normalX = Math.cos(phase) * chordOffset;
        const normalY = Math.sin(phase) * chordOffset;
        this.graphics.lineStyle(1, palette.secondary, 0.42);
        this.graphics.lineBetween(
            normalX - tangentX,
            normalY - tangentY,
            normalX + tangentX,
            normalY + tangentY
        );
    }

    drawGeartrain(palette) {
        const variant = this.visual.motifVariant;
        const count = 2 + (variant % 3);
        const phase = variant * 0.41;

        for (let index = 0; index < count; index++) {
            const angle = phase + index * Math.PI * 2 / count;
            const distance = count === 4 ? 26 : 24;
            const gearRadius = 10 + ((variant + index) % 3) * 3;
            this.drawGear(
                Math.cos(angle) * distance,
                Math.sin(angle) * distance,
                gearRadius,
                6 + ((variant + index) % 4) * 2,
                index % 2 === 0 ? palette.primary : palette.secondary
            );
        }
    }

    drawGear(centerX, centerY, radius, teeth, color) {
        this.graphics.lineStyle(1.5, color, 0.55);
        this.graphics.strokeCircle(centerX, centerY, radius);
        this.graphics.lineStyle(1, color, 0.42);

        for (let index = 0; index < teeth; index++) {
            const angle = index / teeth * Math.PI * 2;
            this.graphics.lineBetween(
                centerX + Math.cos(angle) * (radius - 3),
                centerY + Math.sin(angle) * (radius - 3),
                centerX + Math.cos(angle) * (radius + 2),
                centerY + Math.sin(angle) * (radius + 2)
            );
        }

        this.graphics.fillStyle(color, 0.60);
        this.graphics.fillCircle(centerX, centerY, 2.5);
    }

    drawEscapement(palette) {
        const variant = this.visual.motifVariant;
        const phase = variant * 0.29;
        const balanceRadius = 36 + (variant % 3) * 4;

        this.graphics.lineStyle(2, palette.primary, 0.54);
        this.drawArc(0, 0, balanceRadius, phase + 0.25, phase + 2.48);
        this.drawArc(0, 0, balanceRadius, phase + Math.PI + 0.25, phase + Math.PI + 2.48);

        const leftAngle = phase + 2.12;
        const rightAngle = phase - 2.12;
        const left = this.polarPoint(leftAngle, 45);
        const right = this.polarPoint(rightAngle, 45);
        const pivot = this.polarPoint(phase, 10 + (variant % 2) * 6);

        this.graphics.lineStyle(3, palette.secondary, 0.58);
        this.graphics.lineBetween(left.x, left.y, pivot.x, pivot.y);
        this.graphics.lineBetween(pivot.x, pivot.y, right.x, right.y);
        this.graphics.fillStyle(palette.primary, 0.65);
        this.graphics.fillTriangle(
            left.x, left.y,
            left.x + Math.cos(leftAngle + 0.7) * 8,
            left.y + Math.sin(leftAngle + 0.7) * 8,
            left.x + Math.cos(leftAngle - 0.7) * 8,
            left.y + Math.sin(leftAngle - 0.7) * 8
        );
        this.graphics.fillTriangle(
            right.x, right.y,
            right.x + Math.cos(rightAngle + 0.7) * 8,
            right.y + Math.sin(rightAngle + 0.7) * 8,
            right.x + Math.cos(rightAngle - 0.7) * 8,
            right.y + Math.sin(rightAngle - 0.7) * 8
        );
    }

    drawChronograph(palette) {
        const variant = this.visual.motifVariant;
        const count = 2 + (variant % 2);
        const phase = variant * 0.33 - Math.PI / 2;
        const dialRadius = 12 + (variant % 3);

        for (let index = 0; index < count; index++) {
            const angle = phase + index * Math.PI * 2 / count;
            const centerX = Math.cos(angle) * 29;
            const centerY = Math.sin(angle) * 29;
            const handAngle = phase * 1.7 + index * 1.23;

            this.graphics.lineStyle(1.5, index === 0 ? palette.primary : palette.secondary, 0.58);
            this.graphics.strokeCircle(centerX, centerY, dialRadius);
            this.graphics.lineStyle(1, palette.primary, 0.42);
            this.graphics.lineBetween(
                centerX,
                centerY,
                centerX + Math.cos(handAngle) * (dialRadius - 3),
                centerY + Math.sin(handAngle) * (dialRadius - 3)
            );
            this.graphics.fillStyle(palette.primary, 0.58);
            this.graphics.fillCircle(centerX, centerY, 2);
        }

        if (variant >= 7) {
            this.graphics.lineStyle(2, palette.primary, 0.44);
            this.drawArc(0, 0, 51, phase, phase + 2.1);
        }
    }

    drawOrrery(palette) {
        const variant = this.visual.motifVariant;
        const orbitCount = 2 + (variant % 3);
        const phase = variant * 0.37;

        for (let index = 0; index < orbitCount; index++) {
            const orbitRadius = 20 + index * 13;
            const offset = (index - 1) * 2;
            const nodeAngle = phase * (index + 1) + index * 0.8;

            this.graphics.lineStyle(
                index === orbitCount - 1 ? 2 : 1,
                index % 2 === 0 ? palette.primary : palette.secondary,
                0.43
            );
            this.graphics.strokeCircle(
                Math.cos(phase) * offset,
                Math.sin(phase) * offset,
                orbitRadius
            );
            this.graphics.fillStyle(index % 2 === 0 ? palette.primary : palette.secondary, 0.78);
            this.graphics.fillCircle(
                Math.cos(phase) * offset + Math.cos(nodeAngle) * orbitRadius,
                Math.sin(phase) * offset + Math.sin(nodeAngle) * orbitRadius,
                index === orbitCount - 1 ? 3.5 : 2.5
            );
        }

        const meridianStart = this.polarPoint(phase, 16);
        const meridianEnd = this.polarPoint(phase + Math.PI, 55);
        this.graphics.lineStyle(1, palette.secondary, 0.38);
        this.graphics.lineBetween(
            meridianStart.x,
            meridianStart.y,
            meridianEnd.x,
            meridianEnd.y
        );
    }

    drawHub(palette) {
        const style = this.visual.hubStyle;
        const graphics = this.graphics;

        graphics.fillStyle(CONSTANTS.WHEEL.INNER_COLOR, 1);
        graphics.fillCircle(0, 0, style === 'crown' ? 19 : 16);
        graphics.lineStyle(style === 'crown' ? 3 : 2, palette.primary, 0.82);
        graphics.strokeCircle(0, 0, style === 'crown' ? 17 : 14);

        if (style === 'bullseye') {
            graphics.lineStyle(1, palette.secondary, 0.62);
            graphics.strokeCircle(0, 0, 8);
        } else if (style === 'cross') {
            graphics.lineStyle(2, palette.secondary, 0.72);
            graphics.lineBetween(-9, 0, 9, 0);
            graphics.lineBetween(0, -9, 0, 9);
        } else if (style === 'plate') {
            graphics.fillStyle(palette.secondary, 0.72);
            for (let index = 0; index < 3; index++) {
                const angle = index * Math.PI * 2 / 3 - Math.PI / 2;
                graphics.fillCircle(Math.cos(angle) * 8, Math.sin(angle) * 8, 1.7);
            }
        } else if (style === 'aperture') {
            graphics.lineStyle(1.5, palette.secondary, 0.68);
            for (let index = 0; index < 3; index++) {
                const angle = index * Math.PI * 2 / 3 + 0.4;
                const point = this.polarPoint(angle, 10);
                graphics.lineBetween(0, 0, point.x, point.y);
            }
        } else if (style === 'triangle') {
            const top = this.polarPoint(-Math.PI / 2, 10);
            const left = this.polarPoint(Math.PI * 5 / 6, 10);
            const right = this.polarPoint(Math.PI / 6, 10);
            graphics.lineStyle(2, palette.secondary, 0.75);
            graphics.lineBetween(top.x, top.y, left.x, left.y);
            graphics.lineBetween(left.x, left.y, right.x, right.y);
            graphics.lineBetween(right.x, right.y, top.x, top.y);
        } else {
            graphics.lineStyle(2, palette.secondary, 0.72);
            graphics.strokeCircle(0, 0, 9);
            graphics.lineBetween(-11, 0, 11, 0);
            graphics.lineBetween(0, -11, 0, 11);
        }

        graphics.fillStyle(CONSTANTS.UI.ACCENT, 1);
        graphics.fillCircle(0, 0, 3.5);
    }

    drawRadialMarks(count, innerRadius, outerRadius, phase, color, alpha, width) {
        this.graphics.lineStyle(width, color, alpha);
        for (let index = 0; index < count; index++) {
            this.drawRadialLine(
                phase + index / count * Math.PI * 2,
                innerRadius,
                outerRadius
            );
        }
    }

    drawRadialLine(angle, innerRadius, outerRadius) {
        this.graphics.lineBetween(
            Math.cos(angle) * innerRadius,
            Math.sin(angle) * innerRadius,
            Math.cos(angle) * outerRadius,
            Math.sin(angle) * outerRadius
        );
    }

    drawArc(centerX, centerY, radius, startAngle, endAngle) {
        this.graphics.beginPath();
        this.graphics.arc(centerX, centerY, radius, startAngle, endAngle, false);
        this.graphics.strokePath();
    }

    polarPoint(angle, radius) {
        return {
            x: Math.cos(angle) * radius,
            y: Math.sin(angle) * radius
        };
    }

    rotateBy(deltaAngle) {
        this.rotation = (this.rotation + deltaAngle) % (Math.PI * 2);
        this.graphics.setRotation(this.rotation);
        this.updateSpecular();
    }

    getEdgePosition(angle) {
        const x = this.x + Math.cos(angle) * this.radius;
        const y = this.y + Math.sin(angle) * this.radius;
        return { x, y, angle };
    }

    // 待发射针位于下方，因此命中点固定在转盘六点钟方向。
    getImpactEdgePosition() {
        return this.getEdgePosition(CONSTANTS.WHEEL.IMPACT_ANGLE);
    }

    destroy() {
        if (this.graphics) this.graphics.destroy();
        if (this.specularImage) this.specularImage.destroy();
    }
}
