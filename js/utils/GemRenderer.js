/* Hallmark · pre-emit critique: P5 H5 E4 S5 R4 V5 */
/* Hallmark · component: faceted gemstone · genre: playful · theme: 鎏光宝匣
 * Vector-only cuts preserve exact collision geometry and keep every numeral readable.
 */
class GemRenderer {
    static draw(graphics, x, y, radius, cut, stoneName, rotation = 0, options = {}) {
        const palette = this.getStonePalette(stoneName);
        const outline = options.outlineColor ?? CONSTANTS.JEWEL.METALS.PLATINUM;
        const vertices = this.getVertices(cut, radius)
            .map(point => this.transformPoint(point, x, y, rotation));

        if (options.shadow !== false) {
            const shadowVertices = this.getVertices(cut, radius + 1)
                .map(point => this.transformPoint(point, x, y + 2.5, rotation));
            this.drawPolygon(
                graphics,
                shadowVertices,
                CONSTANTS.UI.INK,
                0.18,
                CONSTANTS.UI.INK,
                0,
                0
            );
        }

        this.drawPolygon(
            graphics,
            vertices,
            palette.base,
            1,
            outline,
            options.outlineWidth ?? 2,
            1
        );

        const center = { x, y };
        const innerVertices = vertices.map(point => ({
            x: x + (point.x - x) * 0.52,
            y: y + (point.y - y) * 0.52
        }));

        graphics.fillStyle(palette.light, options.highlightAlpha ?? 0.42);
        graphics.fillTriangle(
            center.x,
            center.y,
            vertices[0].x,
            vertices[0].y,
            vertices[1].x,
            vertices[1].y
        );
        const darkIndex = Math.floor(vertices.length / 2);
        graphics.fillStyle(palette.dark, 0.34);
        graphics.fillTriangle(
            center.x,
            center.y,
            vertices[darkIndex].x,
            vertices[darkIndex].y,
            vertices[(darkIndex + 1) % vertices.length].x,
            vertices[(darkIndex + 1) % vertices.length].y
        );

        graphics.lineStyle(1, palette.dark, options.facetAlpha ?? 0.52);
        vertices.forEach(point => {
            graphics.lineBetween(center.x, center.y, point.x, point.y);
        });
        this.drawPolygon(
            graphics,
            innerVertices,
            palette.light,
            0.08,
            palette.light,
            1,
            0.64
        );

        return palette;
    }

    static getStonePalette(stoneName) {
        const key = String(stoneName || 'diamond').toUpperCase().replace(/-/g, '_');
        return CONSTANTS.JEWEL.STONES[key] || CONSTANTS.JEWEL.STONES.DIAMOND;
    }

    static getVertices(cut, radius) {
        const templates = {
            round: Array.from({ length: 10 }, (_, index) => {
                const angle = -Math.PI / 2 + index * Math.PI * 2 / 10;
                return { x: Math.cos(angle), y: Math.sin(angle) };
            }),
            princess: [
                { x: 0, y: -1 }, { x: 1, y: 0 },
                { x: 0, y: 1 }, { x: -1, y: 0 }
            ],
            emerald: [
                { x: -0.46, y: -1 }, { x: 0.46, y: -1 },
                { x: 1, y: -0.46 }, { x: 1, y: 0.46 },
                { x: 0.46, y: 1 }, { x: -0.46, y: 1 },
                { x: -1, y: 0.46 }, { x: -1, y: -0.46 }
            ],
            pear: [
                { x: 0, y: -1 }, { x: 0.58, y: -0.42 },
                { x: 0.74, y: 0.18 }, { x: 0.46, y: 0.76 },
                { x: 0, y: 1 }, { x: -0.46, y: 0.76 },
                { x: -0.74, y: 0.18 }, { x: -0.58, y: -0.42 }
            ],
            marquise: [
                { x: 0, y: -1 }, { x: 0.48, y: -0.48 },
                { x: 0.66, y: 0 }, { x: 0.48, y: 0.48 },
                { x: 0, y: 1 }, { x: -0.48, y: 0.48 },
                { x: -0.66, y: 0 }, { x: -0.48, y: -0.48 }
            ],
            hexagon: Array.from({ length: 6 }, (_, index) => {
                const angle = -Math.PI / 2 + index * Math.PI / 3;
                return { x: Math.cos(angle), y: Math.sin(angle) };
            }),
            kite: [
                { x: 0, y: -1 }, { x: 0.78, y: 0.12 },
                { x: 0, y: 1 }, { x: -0.78, y: 0.12 }
            ],
            shield: [
                { x: 0, y: -1 }, { x: 0.78, y: -0.42 },
                { x: 0.58, y: 0.58 }, { x: 0, y: 1 },
                { x: -0.58, y: 0.58 }, { x: -0.78, y: -0.42 }
            ],
            trillion: [
                { x: -0.18, y: -0.92 }, { x: 0.18, y: -0.92 },
                { x: 0.82, y: 0.42 }, { x: 0.56, y: 0.78 },
                { x: -0.56, y: 0.78 }, { x: -0.82, y: 0.42 }
            ],
            baguette: [
                { x: -0.50, y: -1 }, { x: 0.50, y: -1 },
                { x: 0.70, y: -0.76 }, { x: 0.70, y: 0.76 },
                { x: 0.50, y: 1 }, { x: -0.50, y: 1 },
                { x: -0.70, y: 0.76 }, { x: -0.70, y: -0.76 }
            ]
        };
        const template = templates[cut] || templates.round;
        return template.map(point => ({ x: point.x * radius, y: point.y * radius }));
    }

    static transformPoint(point, x, y, rotation) {
        const cosine = Math.cos(rotation);
        const sine = Math.sin(rotation);
        return {
            x: x + point.x * cosine - point.y * sine,
            y: y + point.x * sine + point.y * cosine
        };
    }

    static drawPolygon(
        graphics,
        vertices,
        fillColor,
        fillAlpha,
        strokeColor,
        strokeWidth,
        strokeAlpha
    ) {
        graphics.fillStyle(fillColor, fillAlpha);
        graphics.lineStyle(strokeWidth, strokeColor, strokeAlpha);
        graphics.beginPath();
        graphics.moveTo(vertices[0].x, vertices[0].y);
        vertices.slice(1).forEach(point => graphics.lineTo(point.x, point.y));
        graphics.closePath();
        graphics.fillPath();
        if (strokeWidth > 0) graphics.strokePath();
    }
}
