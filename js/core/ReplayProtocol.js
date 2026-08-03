class ReplayProtocol {
    static schema() {
        return 'needles.replay/v1';
    }

    static engineVersion() {
        return 'classic-v1';
    }

    static supportedCommands() {
        return Object.freeze([
            'begin-shot',
            'resolve-impact',
            'release-shot-lock'
        ]);
    }

    static createLevelDescriptor(level) {
        const gameplay = ReplayProtocol.gameplayDescriptor(level);
        return Object.freeze({
            packId: level.packId || null,
            packVersion: level.packVersion || null,
            levelId: level.packLevelId || String(level.id),
            order: Number.isInteger(level.order) ? level.order : Number(level.id) || null,
            contentHash: ReplayProtocol.hashValue(gameplay)
        });
    }

    static gameplayDescriptor(level) {
        return {
            needleCount: level.needleCount,
            layout: {
                obstacleAngles: [...(level.layout?.obstacleAngles || [])]
            },
            rhythm: JSON.parse(JSON.stringify(level.rhythm || {}))
        };
    }

    static createGeometry(session) {
        return Object.freeze({
            impactAngle: ReplayProtocol.normalizeNumber(session.impactAngle),
            ringRadius: ReplayProtocol.normalizeNumber(
                session.collisionRules.ringRadius
            ),
            needleRadius: ReplayProtocol.normalizeNumber(
                session.collisionRules.needleRadius
            ),
            obstacleRadius: ReplayProtocol.normalizeNumber(
                session.collisionRules.obstacleRadius
            )
        });
    }

    static normalizeNumber(value) {
        if (!Number.isFinite(value)) return value;
        return Number(Number(value).toFixed(12));
    }

    static canonicalize(value) {
        if (Array.isArray(value)) {
            return value.map(item => ReplayProtocol.canonicalize(item));
        }
        if (value && typeof value === 'object') {
            return Object.keys(value)
                .sort()
                .reduce((result, key) => {
                    if (value[key] !== undefined) {
                        result[key] = ReplayProtocol.canonicalize(value[key]);
                    }
                    return result;
                }, {});
        }
        if (typeof value === 'number') {
            return ReplayProtocol.normalizeNumber(value);
        }
        return value;
    }

    static stableStringify(value) {
        return JSON.stringify(ReplayProtocol.canonicalize(value));
    }

    static hashValue(value) {
        const source = ReplayProtocol.stableStringify(value);
        const bytes = typeof TextEncoder !== 'undefined'
            ? new TextEncoder().encode(source)
            : Array.from(source).map(character => character.charCodeAt(0) & 0xff);
        let hash = 0x811c9dc5;
        bytes.forEach(byte => {
            hash ^= byte;
            hash = Math.imul(hash, 0x01000193) >>> 0;
        });
        return hash.toString(16).padStart(8, '0');
    }

    static withoutDigest(replay) {
        const clone = JSON.parse(JSON.stringify(replay));
        delete clone.digest;
        return clone;
    }

    static digest(replay) {
        return ReplayProtocol.hashValue(
            ReplayProtocol.withoutDigest(replay)
        );
    }

    static validate(replay) {
        const errors = [];
        if (!replay || typeof replay !== 'object' || Array.isArray(replay)) {
            throw new Error('Replay must be an object');
        }
        if (replay.schema !== ReplayProtocol.schema()) {
            errors.push(`unsupported replay schema ${replay.schema}`);
        }
        if (replay.engineVersion !== ReplayProtocol.engineVersion()) {
            errors.push(`unsupported engine version ${replay.engineVersion}`);
        }
        if (!replay.level?.levelId || !replay.level?.contentHash) {
            errors.push('replay level identity is incomplete');
        }
        if (!Number.isFinite(replay.durationMs) || replay.durationMs < 0) {
            errors.push('durationMs must be non-negative');
        }
        if (!Array.isArray(replay.commands)) {
            errors.push('commands must be an array');
        }

        let lastTime = 0;
        (replay.commands || []).forEach((command, index) => {
            if (command.sequence !== index + 1) {
                errors.push(`command ${index + 1} has invalid sequence`);
            }
            if (!ReplayProtocol.supportedCommands().includes(command.type)) {
                errors.push(`command ${index + 1} has unsupported type ${command.type}`);
            }
            if (!Number.isFinite(command.atMs) || command.atMs < lastTime) {
                errors.push(`command ${index + 1} has non-monotonic time`);
            }
            lastTime = Number(command.atMs) || lastTime;
        });
        if (Number.isFinite(replay.durationMs) && replay.durationMs < lastTime) {
            errors.push('durationMs is before the final command');
        }
        if (!replay.final || typeof replay.final !== 'object') {
            errors.push('final summary is required');
        }
        if (typeof replay.digest !== 'string' || replay.digest.length === 0) {
            errors.push('digest is required');
        } else if (replay.digest !== ReplayProtocol.digest(replay)) {
            errors.push('replay digest does not match content');
        }

        if (errors.length) {
            throw new Error(`Invalid replay: ${errors.join('; ')}`);
        }
        return true;
    }

    static deepFreeze(value) {
        if (!value || typeof value !== 'object' || Object.isFrozen(value)) {
            return value;
        }
        Object.values(value).forEach(item => ReplayProtocol.deepFreeze(item));
        return Object.freeze(value);
    }
}
