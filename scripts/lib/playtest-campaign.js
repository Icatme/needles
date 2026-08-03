const fs = require("node:fs");
const path = require("node:path");
const Ajv2020 = require("ajv/dist/2020");
const { loadPack } = require("./pack-toolkit");
const { validateBundle } = require("./playtest-analysis");

function loadCampaign(rootDirectory, campaignPath) {
	const root = path.resolve(rootDirectory);
	const absolutePath = path.resolve(root, campaignPath);
	const campaign = JSON.parse(fs.readFileSync(absolutePath, "utf8"));
	const schema = JSON.parse(
		fs.readFileSync(
			path.join(root, "schemas/playtest-campaign.v1.schema.json"),
			"utf8",
		),
	);
	const validate = new Ajv2020({
		allErrors: true,
		strict: true,
		validateFormats: false,
	}).compile(schema);
	if (!validate(campaign)) {
		const details = (validate.errors || [])
			.map((error) => `${error.instancePath || "/"} ${error.message}`)
			.join("; ");
		throw new Error(`Invalid playtest campaign: ${details}`);
	}

	const pack = loadPack(root, campaign.packId);
	if (pack.manifest.version !== campaign.packVersion) {
		throw new Error(
			`Campaign pack version ${campaign.packVersion} does not match ${pack.manifest.version}`,
		);
	}
	const levelsById = new Map(
		pack.resolved.levels.map((level) => [
			level.packLevelId || String(level.id),
			level,
		]),
	);
	const seenOrders = new Set();
	campaign.anchors.forEach((anchor) => {
		const level = levelsById.get(anchor.levelId);
		if (!level)
			throw new Error(
				`Campaign anchor is missing from pack: ${anchor.levelId}`,
			);
		if (level.order !== anchor.order) {
			throw new Error(
				`Campaign anchor order mismatch for ${anchor.levelId}: ${anchor.order} != ${level.order}`,
			);
		}
		if (seenOrders.has(anchor.order)) {
			throw new Error(`Campaign anchor order is duplicated: ${anchor.order}`);
		}
		seenOrders.add(anchor.order);
	});

	let comparison = null;
	if (campaign.comparisonPackId) {
		comparison = loadPack(root, campaign.comparisonPackId);
		const comparisonOrders = new Set(
			comparison.resolved.levels.map((level) => level.order),
		);
		campaign.anchors.forEach((anchor) => {
			if (!comparisonOrders.has(anchor.order)) {
				throw new Error(
					`Campaign comparison pack ${campaign.comparisonPackId}` +
						` is missing level order ${anchor.order}`,
				);
			}
		});
	}

	return {
		root,
		path: absolutePath,
		campaign: JSON.parse(JSON.stringify(campaign)),
		pack,
		comparison,
	};
}

function planCampaign(loaded, options = {}) {
	const baseURL = ensureTrailingSlash(
		options.baseURL || "http://127.0.0.1:4173/",
	);
	const skinId = options.skinId || loaded.campaign.defaultSkinId || null;
	const comparisonByOrder = loaded.comparison
		? new Map(
				loaded.comparison.resolved.levels.map((level) => [level.order, level]),
			)
		: new Map();

	const anchors = loaded.campaign.anchors.map((anchor) => {
		const previewURL = createPreviewURL(baseURL, {
			packId: loaded.campaign.packId,
			levelId: anchor.levelId,
			skinId,
		});
		const comparison = comparisonByOrder.get(anchor.order);
		return {
			...anchor,
			previewURL,
			comparison: comparison
				? {
						packId: loaded.comparison.manifest.id,
						levelId: comparison.packLevelId || String(comparison.id),
						order: comparison.order,
						previewURL: createPreviewURL(baseURL, {
							packId: loaded.comparison.manifest.id,
							levelId: comparison.packLevelId || String(comparison.id),
							skinId,
						}),
					}
				: null,
		};
	});

	return deepFreeze({
		schema: "needles.playtest-campaign-plan/v1",
		campaignId: loaded.campaign.id,
		title: loaded.campaign.title,
		purpose: loaded.campaign.purpose,
		packId: loaded.campaign.packId,
		packVersion: loaded.campaign.packVersion,
		comparisonPackId: loaded.campaign.comparisonPackId || null,
		pilotTargets: { ...loaded.campaign.pilotTargets },
		anchorCount: anchors.length,
		anchors,
	});
}

function evaluateCampaign(loaded, sources) {
	const normalizedSources = sources.map((source, index) => {
		const bundle = source.bundle || source;
		const name = source.source || `source-${index + 1}`;
		validateBundle(bundle, name);
		return {
			source: name,
			attempts: bundle.attempts.map((attempt) => ({
				source: name,
				packId: String(attempt.packId),
				packVersion: attempt.packVersion ?? null,
				levelId: String(attempt.levelId),
				success: Boolean(
					attempt.result?.success || attempt.result?.status === "completed",
				),
			})),
		};
	});
	const allAttempts = normalizedSources.flatMap((source) => source.attempts);
	const targets = loaded.campaign.pilotTargets;
	const anchors = loaded.campaign.anchors.map((anchor) => {
		const matching = allAttempts.filter(
			(attempt) =>
				attempt.packId === loaded.campaign.packId &&
				attempt.levelId === anchor.levelId &&
				attempt.packVersion === loaded.campaign.packVersion,
		);
		const stale = allAttempts.filter(
			(attempt) =>
				attempt.packId === loaded.campaign.packId &&
				attempt.levelId === anchor.levelId &&
				attempt.packVersion !== loaded.campaign.packVersion,
		);
		const sourceCount = new Set(matching.map((attempt) => attempt.source)).size;
		const successes = matching.filter((attempt) => attempt.success).length;
		const failures = matching.length - successes;
		const attemptsGap = Math.max(0, targets.attemptsPerLevel - matching.length);
		const sourcesGap = Math.max(0, targets.sourcesPerLevel - sourceCount);
		const pilotReady = attemptsGap === 0 && sourcesGap === 0;
		const readiness = Math.min(
			1,
			matching.length / targets.attemptsPerLevel,
			sourceCount / targets.sourcesPerLevel,
		);
		return {
			...anchor,
			status: pilotReady
				? "pilot-ready"
				: matching.length === 0
					? "unstarted"
					: "collecting",
			pilotReady,
			readiness: round(readiness),
			attempts: matching.length,
			sources: sourceCount,
			successes,
			failures,
			hasSuccess: successes > 0,
			hasFailure: failures > 0,
			staleVersionAttempts: stale.length,
			gaps: {
				attempts: attemptsGap,
				sources: sourcesGap,
			},
		};
	});

	const nextAnchor = selectNextAnchor(anchors);
	return deepFreeze({
		schema: "needles.playtest-campaign-status/v1",
		campaignId: loaded.campaign.id,
		packId: loaded.campaign.packId,
		packVersion: loaded.campaign.packVersion,
		sourceCount: normalizedSources.length,
		matchingAttemptCount: sum(anchors.map((anchor) => anchor.attempts)),
		staleVersionAttemptCount: sum(
			anchors.map((anchor) => anchor.staleVersionAttempts),
		),
		pilotTargets: { ...targets },
		readyAnchorCount: anchors.filter((anchor) => anchor.pilotReady).length,
		anchorCount: anchors.length,
		complete: anchors.every((anchor) => anchor.pilotReady),
		nextAnchor: nextAnchor
			? {
					levelId: nextAnchor.levelId,
					order: nextAnchor.order,
					reason: nextAnchor.reason,
					gaps: { ...nextAnchor.gaps },
				}
			: null,
		anchors,
	});
}

function selectNextAnchor(anchors) {
	return (
		[...anchors]
			.filter((anchor) => !anchor.pilotReady)
			.sort(
				(a, b) =>
					a.readiness - b.readiness ||
					b.gaps.attempts +
						b.gaps.sources -
						(a.gaps.attempts + a.gaps.sources) ||
					a.order - b.order,
			)[0] || null
	);
}

function renderCampaignHtml(plan, status = null) {
	const statusById = new Map(
		(status?.anchors || []).map((anchor) => [anchor.levelId, anchor]),
	);
	const rows = plan.anchors
		.map((anchor) => {
			const metric = statusById.get(anchor.levelId);
			const state = metric?.status || "unstarted";
			return `<tr class="${state}">
<td>${anchor.order}</td>
<td>${escapeHtml(anchor.levelId)}</td>
<td>${escapeHtml(anchor.reason)}</td>
<td>${metric ? metric.attempts : 0} / ${plan.pilotTargets.attemptsPerLevel}</td>
<td>${metric ? metric.sources : 0} / ${plan.pilotTargets.sourcesPerLevel}</td>
<td>${metric ? metric.successes : 0} / ${metric ? metric.failures : 0}</td>
<td>${escapeHtml(state)}</td>
<td><a href="${escapeHtml(anchor.previewURL)}">试玩</a>${anchor.comparison ? ` · <a href="${escapeHtml(anchor.comparison.previewURL)}">旧版</a>` : ""}</td>
</tr>`;
		})
		.join("\n");

	return `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(plan.title)}</title>
<style>body{font-family:system-ui,sans-serif;margin:0;background:#11161b;color:#edf2ef}main{max-width:1100px;margin:auto;padding:32px 20px}section{background:#182329;border:1px solid #496065;border-radius:14px;padding:20px}table{width:100%;border-collapse:collapse;font-size:13px}th,td{padding:9px;border-bottom:1px solid #34474c;text-align:left}th{color:#9fb1ad}a{color:#d8ae67}.pilot-ready{color:#81d3b0}.collecting{color:#d8ae67}.unstarted{opacity:.66}</style></head>
<body><main><h1>${escapeHtml(plan.title)}</h1><p>${escapeHtml(plan.purpose)}</p>
<p>锚点 ${plan.anchorCount} · pilot 目标每关 ${plan.pilotTargets.attemptsPerLevel} 次 / ${plan.pilotTargets.sourcesPerLevel} 个匿名来源${status ? ` · 已就绪 ${status.readyAnchorCount}` : ""}</p>
<section><table><thead><tr><th>序</th><th>关卡</th><th>原因</th><th>尝试</th><th>来源</th><th>成功/失败</th><th>状态</th><th>入口</th></tr></thead><tbody>${rows}</tbody></table></section>
</main></body></html>`;
}

function createPreviewURL(baseURL, values) {
	const url = new URL(baseURL);
	url.searchParams.set("pack", values.packId);
	url.searchParams.set("level", values.levelId);
	url.searchParams.set("mode", "test");
	if (values.skinId) url.searchParams.set("skin", values.skinId);
	return url.toString();
}

function ensureTrailingSlash(value) {
	return String(value).endsWith("/") ? String(value) : `${value}/`;
}

function sum(values) {
	return values.reduce((total, value) => total + value, 0);
}

function round(value) {
	return Number.isFinite(value) ? Number(value.toFixed(6)) : value;
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
	evaluateCampaign,
	loadCampaign,
	planCampaign,
	renderCampaignHtml,
	selectNextAnchor,
};
