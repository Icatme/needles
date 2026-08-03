/* Hallmark · pre-emit critique: P5 H5 E4 S5 R4 V5 */
/* Hallmark · component: center wheel renderer · genre: playful · theme: 鎏光宝匣
 * Fine-jewelry forms stay inside the functional rim; no setting can masquerade as a hazard.
 */
class JewelWheelRenderer {
    static draw(graphics, radius, visual) {
        const metal = this.getMetal(visual.metal);
        const enamel = this.getEnamel(visual.enamel);

        graphics.clear();
        graphics.fillStyle(enamel, 1);
        graphics.fillCircle(0, 0, radius);

        this.drawHalos(graphics, radius, visual, metal);
        this.drawFamilyMotif(graphics, visual, metal);
        this.drawBracelet(graphics, radius, visual, metal);
        this.drawSettings(graphics, radius, visual, metal);
        this.drawCenterGem(graphics, visual, metal);

        graphics.lineStyle(3, metal.primary, 1);
        graphics.strokeCircle(0, 0, radius);
        graphics.lineStyle(1, metal.secondary, 0.72);
        graphics.strokeCircle(0, 0, radius - 5);
    }

    static getMetal(name) {
        if (name === 'rose-gold') {
            return {
                primary: CONSTANTS.JEWEL.METALS.ROSE_GOLD,
                secondary: CONSTANTS.JEWEL.METALS.PLATINUM
            };
        }
        if (name === 'yellow-gold') {
            return {
                primary: CONSTANTS.JEWEL.METALS.YELLOW_GOLD,
                secondary: CONSTANTS.JEWEL.METALS.PLATINUM
            };
        }
        return {
            primary: CONSTANTS.JEWEL.METALS.PLATINUM,
            secondary: CONSTANTS.JEWEL.METALS.ROSE_GOLD
        };
    }

    static getEnamel(name) {
        const key = String(name).toUpperCase();
        return CONSTANTS.JEWEL.ENAMELS[key] || CONSTANTS.JEWEL.ENAMELS.BLUSH;
    }

    static drawHalos(graphics, radius, visual, metal) {
        visual.haloRadii.forEach((ratio, index) => {
            graphics.lineStyle(
                index === visual.haloRadii.length - 1 ? 2 : 1,
                index % 2 === 0 ? metal.primary : metal.secondary,
                visual.milestone ? 0.52 : 0.30
            );
            graphics.strokeCircle(0, 0, radius * ratio);
        });
    }

    static drawBracelet(graphics, radius, visual, metal) {
        const style = visual.braceletStyle;
        const outer = radius - 14;

        graphics.lineStyle(2.5, metal.primary, 0.82);

        if (style === 'slender') {
            graphics.strokeCircle(0, 0, outer);
            return;
        }

        if (style === 'beaded') {
            graphics.lineStyle(1, metal.secondary, 0.60);
            graphics.strokeCircle(0, 0, outer - 2);
            for (let index = 0; index < 18; index++) {
                const angle = index * Math.PI * 2 / 18;
                graphics.fillStyle(metal.primary, 0.88);
                graphics.fillCircle(Math.cos(angle) * outer, Math.sin(angle) * outer, 2.4);
            }
            return;
        }

        if (style === 'twist') {
            this.drawSegmentedCircle(graphics, outer - 3, 8, 0.05, metal.primary, 0.82, 2);
            this.drawSegmentedCircle(graphics, outer + 2, 8, Math.PI / 8, metal.secondary, 0.64, 2);
            return;
        }

        if (style === 'hinged') {
            graphics.strokeCircle(0, 0, outer);
            graphics.lineStyle(3, metal.secondary, 0.88);
            graphics.lineBetween(-outer, -7, -outer, 7);
            graphics.lineBetween(outer, -7, outer, 7);
            return;
        }

        if (style === 'chain') {
            for (let index = 0; index < 20; index++) {
                const angle = index * Math.PI * 2 / 20;
                graphics.lineStyle(1.5, index % 2 === 0 ? metal.primary : metal.secondary, 0.76);
                graphics.strokeCircle(Math.cos(angle) * outer, Math.sin(angle) * outer, 3.2);
            }
            return;
        }

        if (style === 'double') {
            graphics.strokeCircle(0, 0, outer - 5);
            graphics.lineStyle(1.5, metal.secondary, 0.72);
            graphics.strokeCircle(0, 0, outer + 2);
            return;
        }

        if (style === 'open-cuff') {
            this.drawArc(graphics, 0, 0, outer, 0.38, Math.PI * 2 - 0.38, metal.primary, 0.86, 3);
            const endA = this.polarPoint(0.38, outer);
            const endB = this.polarPoint(-0.38, outer);
            GemRenderer.draw(graphics, endA.x, endA.y, 5, 'round', visual.stones[0], 0, {
                outlineColor: metal.primary,
                outlineWidth: 1,
                shadow: false
            });
            GemRenderer.draw(graphics, endB.x, endB.y, 5, 'round', visual.stones[1], 0, {
                outlineColor: metal.primary,
                outlineWidth: 1,
                shadow: false
            });
            return;
        }

        if (style === 'station') {
            graphics.lineStyle(1.5, metal.primary, 0.74);
            graphics.strokeCircle(0, 0, outer);
            for (let index = 0; index < 8; index++) {
                const point = this.polarPoint(index * Math.PI / 4, outer);
                GemRenderer.draw(
                    graphics,
                    point.x,
                    point.y,
                    3.8,
                    index % 2 === 0 ? 'princess' : 'round',
                    visual.stones[index % visual.stones.length],
                    index * Math.PI / 4,
                    { outlineColor: metal.primary, outlineWidth: 1, shadow: false }
                );
            }
            return;
        }

        if (style === 'tennis') {
            for (let index = 0; index < 24; index++) {
                const angle = index * Math.PI * 2 / 24;
                const point = this.polarPoint(angle, outer);
                graphics.fillStyle(index % 3 === 0 ? metal.secondary : metal.primary, 0.86);
                graphics.fillCircle(point.x, point.y, index % 3 === 0 ? 2.6 : 1.8);
            }
            return;
        }

        // 章末冠冕：两层手镯与向内的冠尖，全部收在真实轮廓中。
        graphics.strokeCircle(0, 0, outer + 2);
        graphics.lineStyle(1.5, metal.secondary, 0.72);
        graphics.strokeCircle(0, 0, outer - 7);
        for (let index = 0; index < 12; index++) {
            const angle = index * Math.PI * 2 / 12;
            const outerPoint = this.polarPoint(angle, outer + 1);
            const innerPoint = this.polarPoint(angle, outer - (index % 2 === 0 ? 12 : 8));
            graphics.lineStyle(2, index % 2 === 0 ? metal.primary : metal.secondary, 0.86);
            graphics.lineBetween(outerPoint.x, outerPoint.y, innerPoint.x, innerPoint.y);
        }
    }

    static drawSettings(graphics, radius, visual, metal) {
        const ringRadius = radius * 0.69;
        const accentIndex = Math.round(
            visual.accentAngle / (Math.PI * 2) * visual.settingCount
        ) % visual.settingCount;

        for (let index = 0; index < visual.settingCount; index++) {
            const angle = index * Math.PI * 2 / visual.settingCount;
            const point = this.polarPoint(angle, ringRadius);
            const isIndex = index === accentIndex;
            GemRenderer.draw(
                graphics,
                point.x,
                point.y,
                isIndex ? 4.6 : 3.2,
                isIndex ? 'marquise' : (index % 2 === 0 ? 'round' : 'princess'),
                isIndex ? 'ruby' : visual.stones[index % visual.stones.length],
                angle,
                {
                    outlineColor: metal.primary,
                    outlineWidth: 1,
                    shadow: false,
                    facetAlpha: 0.36
                }
            );
        }
    }

    static drawCenterGem(graphics, visual, metal) {
        const stone = visual.stones[(visual.motifVariant - 1) % visual.stones.length];
        GemRenderer.draw(
            graphics,
            0,
            0,
            visual.milestone ? 18 : 15,
            visual.centerCut,
            stone,
            visual.motifVariant * 0.16,
            {
                outlineColor: metal.primary,
                outlineWidth: visual.milestone ? 3 : 2,
                shadow: false,
                highlightAlpha: 0.52
            }
        );
    }

    static drawFamilyMotif(graphics, visual, metal) {
        if (visual.family === 'pearl-bangle') {
            this.drawPearlBangle(graphics, visual, metal);
        } else if (visual.family === 'floral-cluster') {
            this.drawFloralCluster(graphics, visual, metal);
        } else if (visual.family === 'prism-cut') {
            this.drawPrismCut(graphics, visual, metal);
        } else if (visual.family === 'celestial-charm') {
            this.drawCelestialCharm(graphics, visual, metal);
        } else {
            this.drawRoyalParure(graphics, visual, metal);
        }
    }

    static drawPearlBangle(graphics, visual, metal) {
        const count = 4 + (visual.motifVariant % 5);
        const phase = visual.motifVariant * 0.21;
        for (let index = 0; index < count; index++) {
            const angle = phase + index * Math.PI * 2 / count;
            const point = this.polarPoint(angle, 35 + (index % 2) * 6);
            GemRenderer.draw(graphics, point.x, point.y, 4.2, 'round', 'pearl', angle, {
                outlineColor: index % 2 === 0 ? metal.primary : metal.secondary,
                outlineWidth: 1,
                shadow: false
            });
        }
    }

    static drawFloralCluster(graphics, visual, metal) {
        const petals = 5 + (visual.motifVariant % 3);
        const phase = visual.motifVariant * 0.18;
        for (let index = 0; index < petals; index++) {
            const angle = phase + index * Math.PI * 2 / petals;
            const point = this.polarPoint(angle, 27);
            GemRenderer.draw(
                graphics,
                point.x,
                point.y,
                8,
                'marquise',
                visual.stones[index % visual.stones.length],
                angle + Math.PI / 2,
                { outlineColor: metal.primary, outlineWidth: 1, shadow: false }
            );
        }
    }

    static drawPrismCut(graphics, visual, metal) {
        const rays = 4 + (visual.motifVariant % 5);
        const phase = visual.motifVariant * 0.15;
        const stone = GemRenderer.getStonePalette(visual.stones[0]);
        for (let index = 0; index < rays; index++) {
            const angle = phase + index * Math.PI * 2 / rays;
            const left = this.polarPoint(angle - 0.08, 50);
            const right = this.polarPoint(angle + 0.08, 50);
            graphics.fillStyle(index % 2 === 0 ? stone.base : stone.light, 0.12);
            graphics.fillTriangle(0, 0, left.x, left.y, right.x, right.y);
            graphics.lineStyle(1, index % 2 === 0 ? metal.primary : metal.secondary, 0.42);
            graphics.lineBetween(0, 0, Math.cos(angle) * 52, Math.sin(angle) * 52);
        }
    }

    static drawCelestialCharm(graphics, visual, metal) {
        const phase = visual.motifVariant * 0.27;
        graphics.lineStyle(1.5, metal.secondary, 0.46);
        graphics.strokeCircle(0, 0, 31);
        this.drawArc(graphics, -7, 0, 24, phase + 0.4, phase + 4.8, metal.primary, 0.60, 2);
        const count = 3 + (visual.motifVariant % 3);
        for (let index = 0; index < count; index++) {
            const angle = phase + index * Math.PI * 2 / count;
            const point = this.polarPoint(angle, 43);
            GemRenderer.draw(
                graphics,
                point.x,
                point.y,
                5,
                index % 2 === 0 ? 'trillion' : 'princess',
                visual.stones[index % visual.stones.length],
                angle,
                { outlineColor: metal.primary, outlineWidth: 1, shadow: false }
            );
        }
    }

    static drawRoyalParure(graphics, visual, metal) {
        const width = 44;
        const baseline = 23;
        const peak = -31 - (visual.motifVariant % 3) * 3;
        graphics.lineStyle(2.5, metal.primary, 0.72);
        graphics.beginPath();
        graphics.moveTo(-width, baseline);
        graphics.lineTo(-30, -9);
        graphics.lineTo(-15, 5);
        graphics.lineTo(0, peak);
        graphics.lineTo(15, 5);
        graphics.lineTo(30, -9);
        graphics.lineTo(width, baseline);
        graphics.strokePath();
        graphics.lineStyle(1.5, metal.secondary, 0.56);
        graphics.lineBetween(-width, baseline, width, baseline);

        [-30, 0, 30].forEach((x, index) => {
            const y = index === 1 ? peak : -9;
            GemRenderer.draw(
                graphics,
                x,
                y,
                index === 1 ? 6 : 4.5,
                index === 1 ? 'pear' : 'round',
                visual.stones[index % visual.stones.length],
                0,
                { outlineColor: metal.primary, outlineWidth: 1, shadow: false }
            );
        });
    }

    static drawSegmentedCircle(graphics, radius, count, phase, color, alpha, width) {
        const segment = Math.PI * 2 / count;
        for (let index = 0; index < count; index++) {
            const start = phase + index * segment;
            this.drawArc(graphics, 0, 0, radius, start, start + segment * 0.66, color, alpha, width);
        }
    }

    static drawArc(graphics, x, y, radius, start, end, color, alpha, width) {
        graphics.lineStyle(width, color, alpha);
        graphics.beginPath();
        graphics.arc(x, y, radius, start, end, false);
        graphics.strokePath();
    }

    static polarPoint(angle, radius) {
        return { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius };
    }
}
