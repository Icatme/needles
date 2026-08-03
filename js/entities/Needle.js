class Needle {
    constructor(scene, id, visual) {
        if (!visual || !['clockwork-observatory', 'gilded-jewel-box'].includes(visual.theme)) {
            throw new Error('Needle requires the active authored visual');
        }

        this.scene = scene;
        this.id = id;
        this.visual = visual;
        this.ui = SceneUI.getPalette(visual.theme);
        this.isInserted = false;
        this.wheelAngle = null;  // 相对转盘的固定径向角
        this.heading = -Math.PI / 2; // 针尖的世界朝向
        this.ballX = 0;
        this.ballY = 0;
        this.flying = false;
        this.flyProgress = 0;
        this.flyDistance = 0;
        this.travelDistance = 0;
        this.startX = 0;
        this.startY = 0;
        this.targetX = 0;
        this.targetY = 0;
        this.reducedMotion = typeof SceneUI !== 'undefined'
            && SceneUI.prefersReducedMotion();
        this.catchlightFlashing = false;
        this.catchlightTargetAlpha = 0;

        this.createGraphics();
    }

    createGraphics() {
        // 创建针的图形
        this.graphics = this.scene.add.graphics();
        this.graphics.setDepth(10);

        // 数字文本
        this.numberText = this.scene.add.text(0, 0, this.id.toString(), {
            fontFamily: CONSTANTS.NEEDLE.TEXT_FONT,
            fontSize: CONSTANTS.NEEDLE.TEXT_SIZE,
            color: CONSTANTS.NEEDLE.TEXT_COLOR,
            fontStyle: 'bold'
        });
        this.numberText.setOrigin(0.5);
        this.numberText.setDepth(11);

        if (this.visual.theme === 'gilded-jewel-box') {
            const narrowCuts = ['pear', 'marquise', 'kite', 'baguette'];
            const displaySize = narrowCuts.includes(this.getJewelCut()) ? 21 : 30;

            this.catchlightImage = this.scene.add.image(
                0,
                0,
                'jewel-gem-catchlight'
            );
            this.catchlightImage.setDisplaySize(displaySize, displaySize);
            this.catchlightImage.setBlendMode('SCREEN');
            this.catchlightImage.setDepth(10.6);
        }

        this.hide();
    }

    // 本地坐标系中，针帽位于原点，针尖永远沿 -Y 方向。
    draw() {
        this.graphics.clear();

        const length = CONSTANTS.NEEDLE.LENGTH;
        const ballRadius = CONSTANTS.NEEDLE.BALL_RADIUS;
        const tipLength = CONSTANTS.NEEDLE.TIP_LENGTH;
        const isJewel = this.visual.theme === 'gilded-jewel-box';

        // 针杆从针帽边缘延伸到尖端根部。
        this.graphics.lineStyle(CONSTANTS.NEEDLE.LINE_WIDTH, this.ui.ACTION_INK, 1);
        this.graphics.beginPath();
        this.graphics.moveTo(0, -ballRadius + 2);
        this.graphics.lineTo(0, -length + tipLength);
        this.graphics.strokePath();

        // 明确画出朝向转盘的针尖，避免视觉上再出现“倒插”。
        this.graphics.fillStyle(this.ui.ACTION_INK, 1);
        this.graphics.fillTriangle(
            -5, -length + tipLength,
            5, -length + tipLength,
            0, -length
        );

        if (isJewel) {
            const metal = this.getJewelMetal();
            this.graphics.lineStyle(1, metal, 0.92);
            this.graphics.lineBetween(0, -ballRadius + 2, 0, -length + tipLength - 1);
            this.drawJewelCap(metal);
            return;
        }

        const ballColor = this.isInserted
            ? CONSTANTS.NEEDLE.BALL_COLOR
            : CONSTANTS.NEEDLE.ACTIVE_BALL_COLOR;

        // 针帽阴影与主体。
        this.graphics.fillStyle(this.ui.ACTION_SHADOW, 0.28);
        this.graphics.fillCircle(0, 3, ballRadius + 1);
        this.graphics.fillStyle(ballColor, 1);
        this.graphics.fillCircle(0, 0, ballRadius);

        this.graphics.lineStyle(2, this.ui.ACTION_OUTLINE, 1);
        this.graphics.strokeCircle(0, 0, ballRadius);

        this.numberText.setColor(
            this.isInserted
                ? CONSTANTS.NEEDLE.TEXT_COLOR
                : CONSTANTS.NEEDLE.ACTIVE_TEXT_COLOR
        );
    }

    drawJewelCap(metal) {
        const cut = this.getJewelCut();
        const stone = this.getJewelStone();

        // 细托座准确标出 15px 圆形碰撞包络；窄切型不会产生“看着没碰却判撞”。
        this.graphics.lineStyle(1, metal, this.isInserted ? 0.52 : 0.82);
        this.graphics.strokeCircle(0, 0, CONSTANTS.NEEDLE.BALL_RADIUS);
        for (let index = 0; index < 4; index++) {
            const angle = index * Math.PI / 2;
            this.graphics.lineBetween(
                Math.cos(angle) * (CONSTANTS.NEEDLE.BALL_RADIUS - 3),
                Math.sin(angle) * (CONSTANTS.NEEDLE.BALL_RADIUS - 3),
                Math.cos(angle) * CONSTANTS.NEEDLE.BALL_RADIUS,
                Math.sin(angle) * CONSTANTS.NEEDLE.BALL_RADIUS
            );
        }

        const palette = GemRenderer.draw(
            this.graphics,
            0,
            0,
            CONSTANTS.NEEDLE.BALL_RADIUS - 1,
            cut,
            stone,
            (this.id % 4) * Math.PI / 8,
            {
                outlineColor: this.isInserted ? metal : CONSTANTS.JEWEL.STONES.RUBY.base,
                outlineWidth: this.isInserted ? 2 : 3,
                shadow: true,
                highlightAlpha: this.isInserted ? 0.38 : 0.54
            }
        );

        if (!this.isInserted) {
            this.graphics.lineStyle(2, metal, 0.94);
            [-1, 1].forEach(direction => {
                this.graphics.lineBetween(
                    direction * 11,
                    -11,
                    direction * 15,
                    -15
                );
            });
        }

        this.numberText.setColor(palette.text);
    }

    getJewelCut() {
        const cuts = this.visual.needleCuts;
        return cuts[(this.id - 1) % cuts.length];
    }

    getJewelStone() {
        const stones = this.visual.stones;
        return stones[(this.id + this.visual.motifVariant - 2) % stones.length];
    }

    getJewelMetal() {
        if (this.visual.metal === 'rose-gold') return CONSTANTS.JEWEL.METALS.ROSE_GOLD;
        if (this.visual.metal === 'yellow-gold') return CONSTANTS.JEWEL.METALS.YELLOW_GOLD;
        return CONSTANTS.JEWEL.METALS.PLATINUM;
    }

    // 设置位置
    // x,y: 小球位置（世界坐标）
    // heading: 针尖朝向（弧度，-PI/2 表示向上）
    setPosition(x, y, heading, lightAngle = null) {
        this.ballX = x;
        this.ballY = y;
        this.heading = heading;

        // 绘制针
        this.draw();

        // 设置图形位置（以小球为中心）
        this.graphics.setPosition(x, y);

        // 本地图形默认朝上，旋转到实际针尖朝向。
        this.graphics.setRotation(heading + Math.PI / 2);

        // 数字是界面信息，不随转盘倒置。
        this.numberText.setPosition(x, y);
        this.numberText.setRotation(0);

        if (this.catchlightImage) {
            this.catchlightImage.setPosition(x, y);
            this.updateCatchlight(lightAngle);
        }

        this.show();
    }

    updateCatchlight(worldAngle = null) {
        if (!this.catchlightImage) return;

        let alpha;
        if (this.reducedMotion) {
            alpha = this.isInserted ? 0.72 : 0.90;
        } else if (!this.isInserted || worldAngle === null) {
            alpha = 0.98;
        } else {
            const fixedLightAngle = -Math.PI * 0.72;
            const difference = Math.atan2(
                Math.sin(worldAngle - fixedLightAngle),
                Math.cos(worldAngle - fixedLightAngle)
            );
            const rawIntensity = (Math.cos(difference) + 1) / 2;
            const intensity = rawIntensity * rawIntensity * (3 - 2 * rawIntensity);
            alpha = 0.64 + intensity * 0.34;
        }

        this.catchlightTargetAlpha = alpha;
        if (!this.catchlightFlashing) {
            this.catchlightImage.setAlpha(alpha);
        }
    }

    playInsertionCatchlight() {
        if (!this.catchlightImage || this.reducedMotion) return;

        this.catchlightFlashing = true;
        this.catchlightImage.setAlpha(1);
        this.scene.tweens.add({
            targets: this.catchlightImage,
            alpha: this.catchlightTargetAlpha,
            duration: 160,
            ease: 'Quad.easeOut',
            onComplete: () => {
                this.catchlightFlashing = false;
                this.catchlightImage.setAlpha(this.catchlightTargetAlpha);
            }
        });
    }

    // 设置待发射位置（底部）
    setReadyPosition(x, y) {
        this.startX = x;
        this.startY = y;
        this.isInserted = false;
        this.wheelAngle = null;
        this.setPosition(x, y, -Math.PI / 2);
    }

    // 发射
    launch(targetX, targetY) {
        this.flying = true;
        this.flyProgress = 0;
        this.flyDistance = 0;
        this.startX = this.ballX;
        this.startY = this.ballY;
        this.targetX = targetX;
        this.targetY = targetY;
        this.travelDistance = Math.hypot(targetX - this.startX, targetY - this.startY);
    }

    // 更新
    update(delta) {
        if (!this.flying) return false;

        const dt = delta / 1000;
        this.flyDistance += CONSTANTS.NEEDLE.FLY_SPEED * dt;
        this.flyProgress = this.travelDistance === 0
            ? 1
            : Math.min(this.flyDistance / this.travelDistance, 1);

        if (this.flyProgress >= 1) {
            this.setPosition(this.targetX, this.targetY, -Math.PI / 2);
            this.flying = false;
            return true; // 到达目标
        }

        // 插值计算当前位置
        const currentX = this.startX + (this.targetX - this.startX) * this.flyProgress;
        const currentY = this.startY + (this.targetY - this.startY) * this.flyProgress;

        // 保持针朝上
        this.setPosition(currentX, currentY, -Math.PI / 2);

        return false;
    }

    // 附加到转盘
    attachToWheel(wheel, wheelAngle) {
        this.isInserted = true;
        this.wheelAngle = wheelAngle;
        this.flying = false;
        this.updateOnWheel(wheel);
    }

    // 更新在转盘上的位置
    updateOnWheel(wheel) {
        if (!this.isInserted) return;

        const radialAngle = this.wheelAngle + wheel.rotation;

        // 针帽向内推进 INSERT_DEPTH，让完整针尖进入并隐藏在转盘下方。
        const distance = wheel.radius
            + CONSTANTS.NEEDLE.LENGTH
            - CONSTANTS.NEEDLE.INSERT_DEPTH;
        const ballX = wheel.x + Math.cos(radialAngle) * distance;
        const ballY = wheel.y + Math.sin(radialAngle) * distance;
        const inwardHeading = radialAngle + Math.PI;

        this.setPosition(ballX, ballY, inwardHeading, radialAngle);
    }

    show() {
        this.graphics.setVisible(true);
        this.numberText.setVisible(true);
        if (this.catchlightImage) this.catchlightImage.setVisible(true);
    }

    hide() {
        this.graphics.setVisible(false);
        this.numberText.setVisible(false);
        if (this.catchlightImage) this.catchlightImage.setVisible(false);
    }

    getBallPosition() {
        return { x: this.ballX, y: this.ballY };
    }

    getBallRadius() {
        return CONSTANTS.NEEDLE.BALL_RADIUS;
    }

    getTipPosition() {
        return {
            x: this.ballX + Math.cos(this.heading) * CONSTANTS.NEEDLE.LENGTH,
            y: this.ballY + Math.sin(this.heading) * CONSTANTS.NEEDLE.LENGTH
        };
    }

    destroy() {
        if (this.graphics) this.graphics.destroy();
        if (this.numberText) this.numberText.destroy();
        if (this.catchlightImage) this.catchlightImage.destroy();
    }
}
