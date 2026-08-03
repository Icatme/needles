const fs = require("node:fs");
const path = require("node:path");

function resolveContainedPath(rootDirectory, candidate, label = "path") {
	if (typeof candidate !== "string" || candidate.length === 0) {
		throw new Error(`${label} must be a non-empty relative path`);
	}
	if (path.isAbsolute(candidate)) {
		throw new Error(`${label} must be relative to the repository root`);
	}
	const root = fs.realpathSync.native(path.resolve(rootDirectory));
	const resolved = path.resolve(root, candidate);
	const relative = path.relative(root, resolved);
	if (
		relative.startsWith(`..${path.sep}`) ||
		relative === ".." ||
		path.isAbsolute(relative)
	) {
		throw new Error(`${label} escapes the repository root`);
	}
	if (fs.existsSync(resolved)) {
		const real = fs.realpathSync.native(resolved);
		const realRelative = path.relative(root, real);
		if (
			realRelative.startsWith(`..${path.sep}`) ||
			realRelative === ".." ||
			path.isAbsolute(realRelative)
		) {
			throw new Error(`${label} resolves outside the repository root`);
		}
		return real;
	}
	return resolved;
}

module.exports = { resolveContainedPath };
