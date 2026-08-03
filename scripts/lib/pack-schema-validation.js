const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { resolveContainedPath } = require("./path-safety");
const Ajv2020 = require("ajv/dist/2020");

const SCHEMA_FILES = Object.freeze({
	index: "schemas/pack-index.v1.schema.json",
	manifest: "schemas/level-pack.v1.schema.json",
	presets: "schemas/level-presets.v1.schema.json",
	levels: "schemas/level-list.v1.schema.json",
});

function validatePackRepository(rootDirectory) {
	const root = path.resolve(rootDirectory);
	const validators = createSchemaValidators(root);
	const runtime = createRuntimeValidator(root);
	const indexPath = path.join(root, "packs/index.json");
	const index = readJson(indexPath);

	assertSchema(validators.index, index, relative(root, indexPath));
	runtime.validateIndex(index);

	const packs = index.packs.map((entry) => {
		const manifestPath = resolveContainedPath(
			root,
			path.relative(
				root,
				path.resolve(path.dirname(indexPath), entry.manifest),
			),
			`manifest for ${entry.id}`,
		);
		const manifest = readJson(manifestPath);
		assertSchema(validators.manifest, manifest, relative(root, manifestPath));

		const presetsPath = resolveContainedPath(
			root,
			path.relative(
				root,
				path.resolve(path.dirname(manifestPath), manifest.resources.presets),
			),
			`presets for ${entry.id}`,
		);
		const levelsPath = resolveContainedPath(
			root,
			path.relative(
				root,
				path.resolve(path.dirname(manifestPath), manifest.resources.levels),
			),
			`levels for ${entry.id}`,
		);
		const presets = readJson(presetsPath);
		const levels = readJson(levelsPath);
		assertSchema(validators.presets, presets, relative(root, presetsPath));
		assertSchema(validators.levels, levels, relative(root, levelsPath));
		runtime.validateBundle(entry, manifest, presets, levels);

		return {
			id: manifest.id,
			version: manifest.version,
			chapterCount: manifest.chapters.length,
			layoutCount: Object.keys(presets.layouts).length,
			levelCount: levels.levels.length,
			files: {
				manifest: relative(root, manifestPath),
				presets: relative(root, presetsPath),
				levels: relative(root, levelsPath),
			},
		};
	});

	return {
		valid: true,
		defaultPackId: index.defaultPackId,
		packCount: packs.length,
		levelCount: packs.reduce((total, pack) => total + pack.levelCount, 0),
		packs,
	};
}

function createSchemaValidators(root) {
	const ajv = new Ajv2020({
		allErrors: true,
		strict: true,
		validateFormats: false,
	});
	return Object.fromEntries(
		Object.entries(SCHEMA_FILES).map(([key, relativePath]) => {
			const schema = readJson(path.join(root, relativePath));
			return [key, ajv.compile(schema)];
		}),
	);
}

function createRuntimeValidator(root) {
	const source = fs.readFileSync(
		path.join(root, "js/packs/PackValidator.js"),
		"utf8",
	);
	const context = vm.createContext({ console, Error, Object, Array, Set });
	vm.runInContext(
		`${source}\nthis.PackValidator = PackValidator; this.PackValidationError = PackValidationError;`,
		context,
		{ filename: "js/packs/PackValidator.js" },
	);
	return new context.PackValidator();
}

function assertSchema(validate, value, label) {
	if (validate(value)) return true;
	const details = (validate.errors || []).map((error) => {
		const location = error.instancePath || "/";
		return `${location} ${error.message}`;
	});
	throw new Error(
		`${label} failed JSON Schema validation: ${details.join("; ")}`,
	);
}

function readJson(filePath) {
	try {
		return JSON.parse(fs.readFileSync(filePath, "utf8"));
	} catch (error) {
		throw new Error(`${filePath}: ${error.message}`);
	}
}

function relative(root, filePath) {
	return path.relative(root, filePath).split(path.sep).join("/");
}

module.exports = {
	SCHEMA_FILES,
	assertSchema,
	createRuntimeValidator,
	createSchemaValidators,
	readJson,
	validatePackRepository,
};
