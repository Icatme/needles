class Obstacle {
    constructor(scene, angle, visual) {
        if (!visual || !['clockwork-observatory', 'gilded-jewel-box'].includes(visual.theme)) {
            throw new Error('Obstacle requires the active authored visual');
        }

        this.scene = scene;
        this.angle = angle;
        this.visual = visual;
        this.ui = SceneUI.getPalette(visual.theme);
        this.x = 0;
        this.y = 0;

        this.createGraphics();
    }

    createGraphics() {
        this.graphics = this.scene.add.graphics();
        this.graphics.setDepth(9);
        this.draw();
    }

    draw() {
        this.graphics.clear();

        // 障碍物是一枚已经锁定的危险针，与正常针共享几何语义。
        const length = CONSTANTS.NEEDLE.LENGTH;
        const tipLength = CONSTANTS.NEEDLE.TIP_LENGTH;
        this.graphics.lineStyle(CONSTANTS.NEEDLE.LINE_WIDTH, this.ui.ACTION_INK, 1);
        this.graphics.lineBetween(0, -CONSTANTS.OBSTACLE.RADIUS + 2, 0, -length + tipLength);
        this.graphics.fillStyle(this.ui.ACTION_INK, 1);
        this.graphics.fillTriangle(-5, -length + tipLength, 5, -length + tipLength, 0, -length);

        if (this.visual.theme === 'gilded-jewel-box') {
            const metal = this.visual.metal === 'yellow-gold'
                ? CONSTANTS.JEWEL.METALS.YELLOW_GOLD
                : (this.visual.metal === 'rose-gold'
                    ? CONSTANTS.JEWEL.METALS.ROSE_GOLD
                    : CONSTANTS.JEWEL.METALS.PLATINUM);
            this.graphics.lineStyle(1, metal, 0.92);
            this.graphics.lineBetween(
                0,
                -CONSTANTS.OBSTACLE.RADIUS + 2,
                0,
                -length + tipLength - 1
            );
            this.graphics.lineStyle(2, metal, 0.82);
            this.graphics.strokeCircle(0, 0, CONSTANTS.OBSTACLE.RADIUS);
            GemRenderer.draw(
                this.graphics,
                0,
                0,
                CONSTANTS.OBSTACLE.RADIUS - 1,
                'shield',
                'ruby',
                0,
                { outlineColor: metal, outlineWidth: 3, shadow: true }
            );
            this.drawLockMark();
            return;
        }

        this.graphics.fillStyle(this.ui.ACTION_SHADOW, 0.28);
        this.graphics.fillCircle(0, 3, CONSTANTS.OBSTACLE.RADIUS + 1);
        this.graphics.fillStyle(CONSTANTS.OBSTACLE.COLOR, 1);
        this.graphics.fillCircle(0, 0, CONSTANTS.OBSTACLE.RADIUS);

        // 边框
        this.graphics.lineStyle(CONSTANTS.OBSTACLE.OUTLINE_WIDTH, this.ui.ACTION_OUTLINE, 1);
        this.graphics.strokeCircle(0, 0, CONSTANTS.OBSTACLE.RADIUS);

        this.drawLockMark();
    }

    drawLockMark() {
        this.graphics.lineStyle(3, CONSTANTS.WHEEL.DETAIL_COLOR, 1);
        this.graphics.lineBetween(-5, -5, 5, 5);
        this.graphics.lineBetween(5, -5, -5, 5);
    }

    updatePosition(wheel) {
        const totalAngle = this.angle + wheel.rotation;
        const distance = wheel.radius
            + CONSTANTS.NEEDLE.LENGTH
            - CONSTANTS.NEEDLE.INSERT_DEPTH;
        this.x = wheel.x + Math.cos(totalAngle) * distance;
        this.y = wheel.y + Math.sin(totalAngle) * distance;

        this.graphics.setPosition(this.x, this.y);
        this.graphics.setRotation(totalAngle + Math.PI * 1.5);
    }

    getPosition() {
        return { x: this.x, y: this.y };
    }

    getRadius() {
        return CONSTANTS.OBSTACLE.RADIUS;
    }

    destroy() {
        if (this.graphics) this.graphics.destroy();
    }
}
