class CollisionManager {
    constructor() {
        this.collisionPairs = [];
    }

    // 计算两点之间的距离
    distance(x1, y1, x2, y2) {
        const dx = x2 - x1;
        const dy = y2 - y1;
        return Math.sqrt(dx * dx + dy * dy);
    }

    // 圆形碰撞检测
    circleCollision(pos1, radius1, pos2, radius2) {
        const dist = this.distance(pos1.x, pos1.y, pos2.x, pos2.y);
        return dist < (radius1 + radius2);
    }

    // 检测针与已插入针的碰撞
    checkNeedleCollision(newNeedle, insertedNeedles) {
        const newPos = newNeedle.getBallPosition();
        const newRadius = newNeedle.getBallRadius();

        for (let needle of insertedNeedles) {
            const pos = needle.getBallPosition();
            const radius = needle.getBallRadius();

            if (this.circleCollision(newPos, newRadius, pos, radius)) {
                return {
                    collided: true,
                    type: 'needle',
                    object: needle
                };
            }
        }

        return { collided: false };
    }

    // 检测针与障碍物的碰撞
    checkObstacleCollision(newNeedle, obstacles) {
        const newPos = newNeedle.getBallPosition();
        const newRadius = newNeedle.getBallRadius();

        for (let obstacle of obstacles) {
            const pos = obstacle.getPosition();
            const radius = obstacle.getRadius();

            if (this.circleCollision(newPos, newRadius, pos, radius)) {
                return {
                    collided: true,
                    type: 'obstacle',
                    object: obstacle
                };
            }
        }

        return { collided: false };
    }

    // 综合碰撞检测
    checkAllCollisions(newNeedle, insertedNeedles, obstacles) {
        // 检测与已插入针的碰撞
        const needleCollision = this.checkNeedleCollision(newNeedle, insertedNeedles);
        if (needleCollision.collided) {
            return needleCollision;
        }

        // 检测与障碍物的碰撞
        const obstacleCollision = this.checkObstacleCollision(newNeedle, obstacles);
        if (obstacleCollision.collided) {
            return obstacleCollision;
        }

        return { collided: false };
    }

    // 检测两个已插入针之间的碰撞（用于验证）
    validateInsertedNeedles(insertedNeedles) {
        for (let i = 0; i < insertedNeedles.length; i++) {
            for (let j = i + 1; j < insertedNeedles.length; j++) {
                const pos1 = insertedNeedles[i].getBallPosition();
                const radius1 = insertedNeedles[i].getBallRadius();
                const pos2 = insertedNeedles[j].getBallPosition();
                const radius2 = insertedNeedles[j].getBallRadius();

                if (this.circleCollision(pos1, radius1, pos2, radius2)) {
                    return {
                        valid: false,
                        needle1: insertedNeedles[i],
                        needle2: insertedNeedles[j]
                    };
                }
            }
        }
        return { valid: true };
    }
}
