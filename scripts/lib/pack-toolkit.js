const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { resolveContainedPath } = require("./path-safety");
const {
	createSchemaValidators,
	createRuntimeValidator,
	readJson,
	validatePackRepository,
} = require("./pack-schema-validation");

function loadPack(rootDirectory, packId) {
	const root = path.resolve(rootDirectory);
	validatePackRepository(root);
	const indexPath = path.join(root, "packs/index.json");
	const index = readJson(indexPath);
	const entry = index.packs.find((candidate) => candidate.id === packId);
	if (!entry) throw new Error(`Unknown pack ${packId}`);

	const manifestPath = resolveContainedPath(
		root,
		path.relative(root, path.resolve(path.dirname(indexPath), entry.manifest)),
		`manifest for ${packId}`,
	);
	const manifest = readJson(manifestPath);
	const presetsPath = resolveContainedPath(
		root,
		path.relative(
			root,
			path.resolve(path.dirname(manifestPath), manifest.resources.presets),
		),
		`presets for ${packId}`,
	);
	const levelsPath = resolveContainedPath(
		root,
		path.relative(
			root,
			path.resolve(path.dirname(manifestPath), manifest.resources.levels),
		),
		`levels for ${packId}`,
	);
	const presets = readJson(presetsPath);
	const levelList = readJson(levelsPath);
	const runtime = createGameRuntime(root);
	const resolved = new runtime.LevelResolver().resolvePack(
		manifest,
		presets,
		levelList,
	);

	return {
		root,
		entry,
		manifest,
		presets,
		levelList,
		resolved,
		runtime,
		paths: { manifestPath, presetsPath, levelsPath },
	};
}

function auditPack(rootDirectory, packId) {
	const loaded = loadPack(rootDirectory, packId);
	const manager = createDifficultyManager(loaded);
	const levels = loaded.resolved.levels.map((level) => {
		const audit = manager.validate(JSON.parse(JSON.stringify(level)));
		return {
			levelId: level.packLevelId || String(level.id),
			order: level.order,
			title: level.name,
			chapterId: level.chapterId,
			valid: Boolean(audit.valid),
			errors: [...(audit.errors || [])],
			warnings: [...(audit.warnings || [])],
			score: finiteOrNull(audit.analysis?.score),
			drivers: summarizeDrivers(audit.analysis?.drivers),
			capacity: audit.analysis?.capacity
				? summarizeCapacity(audit.analysis.capacity)
				: null,
			opportunity: audit.analysis?.opportunity
				? summarizeOpportunity(audit.analysis.opportunity)
				: null,
		};
	});

	return deepFreeze({
		schema: "needles.pack-audit/v1",
		packId: loaded.manifest.id,
		version: loaded.manifest.version,
		difficultyModel: loaded.manifest.difficultyModel || "legacy-linear",
		levelCount: levels.length,
		validLevelCount: levels.filter((level) => level.valid).length,
		errorCount: sum(levels.map((level) => level.errors.length)),
		warningCount: sum(levels.map((level) => level.warnings.length)),
		levels,
	});
}

function scorePack(rootDirectory, packId) {
	const audit = auditPack(rootDirectory, packId);
	return deepFreeze({
		schema: "needles.pack-scores/v1",
		packId: audit.packId,
		version: audit.version,
		difficultyModel: audit.difficultyModel,
		levels: audit.levels.map((level) => ({
			levelId: level.levelId,
			order: level.order,
			title: level.title,
			chapterId: level.chapterId,
			valid: level.valid,
			score: level.score,
			drivers: level.drivers,
		})),
	});
}

function createPackReport(rootDirectory, packId) {
	const loaded = loadPack(rootDirectory, packId);
	const audit = auditPack(rootDirectory, packId);
	const chapters = loaded.manifest.chapters
		.map((chapter) => {
			const levels = audit.levels.filter(
				(level) => level.chapterId === chapter.id,
			);
			const scores = levels.map((level) => level.score).filter(Number.isFinite);
			return {
				id: chapter.id,
				order: chapter.order,
				title: chapter.title,
				levelCount: levels.length,
				minimumScore: scores.length ? Math.min(...scores) : null,
				maximumScore: scores.length ? Math.max(...scores) : null,
				averageScore: scores.length ? round(sum(scores) / scores.length) : null,
				invalidLevelCount: levels.filter((level) => !level.valid).length,
			};
		})
		.sort((a, b) => a.order - b.order);
	const scores = audit.levels
		.map((level) => level.score)
		.filter(Number.isFinite);
	const adjacentChanges = [];
	for (let index = 1; index < audit.levels.length; index++) {
		const previous = audit.levels[index - 1];
		const current = audit.levels[index];
		adjacentChanges.push({
			fromLevelId: previous.levelId,
			toLevelId: current.levelId,
			fromOrder: previous.order,
			toOrder: current.order,
			scoreDelta:
				Number.isFinite(previous.score) && Number.isFinite(current.score)
					? round(current.score - previous.score)
					: null,
		});
	}

	return deepFreeze({
		schema: "needles.pack-report/v1",
		packId: audit.packId,
		version: audit.version,
		title: loaded.manifest.title,
		caption: loaded.manifest.caption || "",
		difficultyModel: audit.difficultyModel,
		levelCount: audit.levelCount,
		chapterCount: chapters.length,
		layoutCount: Object.keys(loaded.presets.layouts).length,
		valid: audit.errorCount === 0,
		scoreRange: {
			minimum: scores.length ? Math.min(...scores) : null,
			maximum: scores.length ? Math.max(...scores) : null,
		},
		chapters,
		levels: audit.levels,
		adjacentChanges,
	});
}

function renderPackReportHtml(report) {
	const rows = report.levels
		.map(
			(level) => `<tr class="${level.valid ? "" : "invalid"}">
<td>${escapeHtml(level.order)}</td>
<td>${escapeHtml(level.levelId)}</td>
<td>${escapeHtml(level.title)}</td>
<td>${formatNumber(level.score)}</td>
<td>${escapeHtml(level.drivers.map((driver) => driver.label).join(" / ") || "—")}</td>
<td>${level.valid ? "通过" : escapeHtml(level.errors.join("；"))}</td>
</tr>`,
		)
		.join("\n");
	const chapterRows = report.chapters
		.map(
			(chapter) => `<tr>
<td>${escapeHtml(chapter.order)}</td><td>${escapeHtml(chapter.title)}</td><td>${chapter.levelCount}</td>
<td>${formatNumber(chapter.minimumScore)}</td><td>${formatNumber(chapter.maximumScore)}</td><td>${formatNumber(chapter.averageScore)}</td>
</tr>`,
		)
		.join("\n");

	return `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(report.title)} · 关卡包报告</title>
<style>body{font-family:system-ui,sans-serif;margin:0;background:#11161b;color:#edf2ef}main{max-width:1100px;margin:auto;padding:32px 20px}section{background:#182329;border:1px solid #496065;border-radius:14px;padding:20px;margin:18px 0}table{width:100%;border-collapse:collapse;font-size:13px}th,td{padding:9px;border-bottom:1px solid #34474c;text-align:left}th{color:#9fb1ad}.invalid{color:#ff9280}.metric{display:inline-block;margin-right:24px;color:#d8ae67}</style></head>
<body><main><h1>${escapeHtml(report.title)}</h1><p>${escapeHtml(report.caption)}</p>
<section><span class="metric">${report.levelCount} 关</span><span class="metric">${report.chapterCount} 章</span><span class="metric">${report.layoutCount} 布局</span><span class="metric">难度 ${formatNumber(report.scoreRange.minimum)}–${formatNumber(report.scoreRange.maximum)}</span></section>
<section><h2>章节</h2><table><thead><tr><th>序</th><th>章节</th><th>关卡</th><th>最低</th><th>最高</th><th>平均</th></tr></thead><tbody>${chapterRows}</tbody></table></section>
<section><h2>关卡曲线</h2><table><thead><tr><th>序</th><th>ID</th><th>名称</th><th>难度</th><th>主压力</th><th>校验</th></tr></thead><tbody>${rows}</tbody></table></section>
</main></body></html>`;
}

function diffPacks(rootDirectory, leftRef, rightRef) {
	const left = loadPackReference(rootDirectory, leftRef);
	const right = loadPackReference(rootDirectory, rightRef);
	const leftLevels = new Map(
		left.resolved.levels.map((level) => [stableLevelId(level), level]),
	);
	const rightLevels = new Map(
		right.resolved.levels.map((level) => [stableLevelId(level), level]),
	);
	const added = [];
	const removed = [];
	const changed = [];

	rightLevels.forEach((level, id) => {
		if (!leftLevels.has(id)) {
			added.push(levelSummary(level));
			return;
		}
		const previous = leftLevels.get(id);
		const fields = changedFields(previous, level);
		if (fields.length) {
			changed.push({
				levelId: id,
				beforeOrder: previous.order,
				afterOrder: level.order,
				fields,
				beforeHash: hashValue(levelComparable(previous)),
				afterHash: hashValue(levelComparable(level)),
			});
		}
	});
	leftLevels.forEach((level, id) => {
		if (!rightLevels.has(id)) removed.push(levelSummary(level));
	});

	return deepFreeze({
		schema: "needles.pack-diff/v1",
		left: packIdentity(left),
		right: packIdentity(right),
		added: added.sort(compareLevelSummary),
		removed: removed.sort(compareLevelSummary),
		changed: changed.sort((a, b) => a.afterOrder - b.afterOrder),
		summary: {
			added: added.length,
			removed: removed.length,
			changed: changed.length,
			unchanged: rightLevels.size - added.length - changed.length,
		},
	});
}

function createStarterPack(rootDirectory, packId, options = {}) {
	if (!/^[a-z0-9][a-z0-9-]*$/.test(packId)) {
		throw new Error("Pack ID must match ^[a-z0-9][a-z0-9-]*$");
	}
	const root = path.resolve(rootDirectory);
	const directory = path.join(root, "packs", packId);
	if (fs.existsSync(directory))
		throw new Error(`Pack directory already exists: ${directory}`);
	const title = options.title || packId;
	const manifest = {
		schema: "needles.level-pack/v1",
		id: packId,
		version: "0.1.0",
		title,
		caption: options.caption || "Starter level pack",
		engineCompatibility: "classic-v1",
		difficultyModel: options.difficultyModel || "nonlinear-v2",
		chapters: [{ id: "chapter-1", order: 1, title: "第一章" }],
		resources: { presets: "presets.json", levels: "levels.json" },
	};
	const presets = {
		schema: "needles.level-presets/v1",
		layouts: { clear: { obstacleAngles: [] } },
	};
	const levels = {
		schema: "needles.level-list/v1",
		levels: [
			{
				id: `${packId}-01`,
				legacyNumericId: 1,
				chapterId: "chapter-1",
				order: 1,
				title: "第一关",
				instruction: "一针无障碍",
				objective: { insertCount: 1 },
				layoutRef: "clear",
				rhythm: { segments: [{ durationMs: 4000, velocity: 0.3 }] },
				presentation: { tier: 1, milestone: true, focus: "timing" },
				tags: ["starter"],
			},
		],
	};

	fs.mkdirSync(directory, { recursive: true });
	writeJson(path.join(directory, "manifest.json"), manifest);
	writeJson(path.join(directory, "presets.json"), presets);
	writeJson(path.join(directory, "levels.json"), levels);

	const schemas = createSchemaValidators(root);
	if (
		!schemas.manifest(manifest) ||
		!schemas.presets(presets) ||
		!schemas.levels(levels)
	) {
		fs.rmSync(directory, { recursive: true, force: true });
		throw new Error("Generated starter pack does not satisfy schemas");
	}

	if (options.register) {
		const indexPath = path.join(root, "packs/index.json");
		const index = readJson(indexPath);
		if (index.packs.some((entry) => entry.id === packId)) {
			throw new Error(`Pack ${packId} is already registered`);
		}
		index.packs.push({ id: packId, manifest: `${packId}/manifest.json` });
		writeJson(indexPath, index);
		createRuntimeValidator(root).validateIndex(index);
	}

	return {
		packId,
		directory,
		registered: Boolean(options.register),
		files: ["manifest.json", "presets.json", "levels.json"],
	};
}

function loadPackReference(rootDirectory, reference) {
	const root = path.resolve(rootDirectory);
	const candidate = resolveContainedPath(root, reference, "pack reference");
	if (!fs.existsSync(candidate)) return loadPack(root, reference);
	const candidateStats = fs.statSync(candidate);
	const directory = candidateStats.isDirectory()
		? candidate
		: path.dirname(candidate);
	const manifestPath = resolveContainedPath(
		root,
		path.relative(
			root,
			candidateStats.isDirectory()
				? path.join(directory, "manifest.json")
				: candidate,
		),
		"pack manifest",
	);
	const manifest = readJson(manifestPath);
	const presetsPath = resolveContainedPath(
		root,
		path.relative(
			root,
			path.resolve(path.dirname(manifestPath), manifest.resources.presets),
		),
		"pack presets",
	);
	const levelsPath = resolveContainedPath(
		root,
		path.relative(
			root,
			path.resolve(path.dirname(manifestPath), manifest.resources.levels),
		),
		"pack levels",
	);
	const presets = readJson(presetsPath);
	const levelList = readJson(levelsPath);
	const schemas = createSchemaValidators(root);
	if (
		!schemas.manifest(manifest) ||
		!schemas.presets(presets) ||
		!schemas.levels(levelList)
	) {
		throw new Error(`Pack reference ${reference} fails JSON Schema validation`);
	}
	const entry = { id: manifest.id, manifest: path.basename(manifestPath) };
	createRuntimeValidator(root).validateBundle(
		entry,
		manifest,
		presets,
		levelList,
	);
	const runtime = createGameRuntime(root);
	return {
		manifest,
		presets,
		levelList,
		resolved: new runtime.LevelResolver().resolvePack(
			manifest,
			presets,
			levelList,
		),
	};
}

function createGameRuntime(root) {
	const context = vm.createContext({
		console,
		Math,
		Number,
		JSON,
		Object,
		Array,
		Map,
		Set,
		Error,
	});
	loadScript(root, context, "js/utils/constants.js", ["CONSTANTS"]);
	loadScript(root, context, "js/managers/RhythmManager.js", ["RhythmManager"]);
	loadScript(root, context, "js/managers/DifficultyManager.js", [
		"DifficultyManager",
	]);
	loadScript(root, context, "js/managers/DifficultyModelV2.js", [
		"DifficultyModelV2",
	]);
	loadScript(root, context, "js/packs/LevelResolver.js", ["LevelResolver"]);
	return context;
}

function loadScript(root, context, relativePath, names) {
	const source = fs.readFileSync(path.join(root, relativePath), "utf8");
	const bridge = names.map((name) => `this.${name} = ${name};`).join("\n");
	vm.runInContext(`${source}\n${bridge}`, context, { filename: relativePath });
}

function createDifficultyManager(loaded) {
	return loaded.manifest.difficultyModel === "nonlinear-v2"
		? new loaded.runtime.DifficultyModelV2()
		: new loaded.runtime.DifficultyManager();
}

function summarizeDrivers(drivers) {
	return (drivers || []).slice(0, 3).map((driver) => ({
		key: driver.key || null,
		label: driver.label || driver.key || "unknown",
		value: finiteOrNull(driver.value ?? driver.score),
	}));
}

function summarizeCapacity(capacity) {
	return {
		theoretical: finiteOrNull(
			capacity.layoutTheoretical ?? capacity.theoretical,
		),
		comfortable: finiteOrNull(
			capacity.layoutComfortable ?? capacity.comfortable,
		),
		utilization: finiteOrNull(capacity.utilization),
	};
}

function summarizeOpportunity(opportunity) {
	return {
		allShotStatesReachable: opportunity.allShotStatesReachable ?? null,
		worstCoverageMs: finiteOrNull(opportunity.worstCoverageMs),
	};
}

function packIdentity(pack) {
	return {
		id: pack.manifest.id,
		version: pack.manifest.version,
		levelCount: pack.resolved.levels.length,
	};
}

function levelSummary(level) {
	return {
		levelId: stableLevelId(level),
		order: level.order,
		title: level.name,
	};
}

function compareLevelSummary(a, b) {
	return a.order - b.order || a.levelId.localeCompare(b.levelId);
}

function stableLevelId(level) {
	return level.packLevelId || String(level.id);
}

function changedFields(left, right) {
	const fields = [
		["order", left.order, right.order],
		["chapterId", left.chapterId, right.chapterId],
		["title", left.name, right.name],
		["instruction", left.rule, right.rule],
		["needleCount", left.needleCount, right.needleCount],
		["layout", left.layout, right.layout],
		["rhythm", left.rhythm, right.rhythm],
		[
			"presentation",
			left.presentation || left.designIntent,
			right.presentation || right.designIntent,
		],
		["tags", left.tags, right.tags],
	];
	return fields
		.filter(
			([, before, after]) => stableStringify(before) !== stableStringify(after),
		)
		.map(([name]) => name);
}

function levelComparable(level) {
	return {
		order: level.order,
		chapterId: level.chapterId,
		name: level.name,
		rule: level.rule,
		needleCount: level.needleCount,
		layout: level.layout,
		rhythm: level.rhythm,
		presentation: level.presentation || level.designIntent,
		tags: level.tags,
	};
}

function stableStringify(value) {
	if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
	if (value && typeof value === "object") {
		return `{${Object.keys(value)
			.sort()
			.map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`)
			.join(",")}}`;
	}
	return JSON.stringify(value);
}

function hashValue(value) {
	const source = stableStringify(value);
	let hash = 0x811c9dc5;
	for (let index = 0; index < source.length; index++) {
		hash ^= source.charCodeAt(index) & 0xff;
		hash = Math.imul(hash, 0x01000193) >>> 0;
	}
	return hash.toString(16).padStart(8, "0");
}

function writeJson(filePath, value) {
	fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function finiteOrNull(value) {
	return Number.isFinite(value) ? Number(value) : null;
}

function sum(values) {
	return values.reduce((total, value) => total + value, 0);
}

function round(value) {
	return Number.isFinite(value) ? Number(value.toFixed(6)) : value;
}

function formatNumber(value) {
	return Number.isFinite(value) ? Number(value).toFixed(1) : "—";
}

function escapeHtml(value) {
	return String(value)
		.replaceAll("&", "&amp;")
		.replaceAll("<", "&lt;")
		.replaceAll(">", "&gt;")
		.replaceAll('"', "&quot;")
		.replaceAll("'", "&#39;");
}

function deepFreeze(value) {
	if (!value || typeof value !== "object" || Object.isFrozen(value))
		return value;
	Object.values(value).forEach(deepFreeze);
	return Object.freeze(value);
}

module.exports = {
	auditPack,
	createPackReport,
	createStarterPack,
	diffPacks,
	loadPack,
	renderPackReportHtml,
	scorePack,
};
