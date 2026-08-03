const { analyzePlaytests } = require("./playtest-analysis");
const {
	evaluateCampaign,
	loadCampaign,
	planCampaign,
} = require("./playtest-campaign");
const { createPackReport } = require("./pack-toolkit");

function buildBalanceReview(
	rootDirectory,
	campaignPath,
	sources,
	options = {},
) {
	const loaded = loadCampaign(rootDirectory, campaignPath);
	const plan = planCampaign(loaded, {
		baseURL: options.baseURL,
		skinId: options.skinId,
	});
	const status = evaluateCampaign(loaded, sources);
	const campaignSources = sources.map((source) => {
		const bundle = source.bundle || source;
		const attempts = bundle.attempts.filter(
			(attempt) =>
				String(attempt.packId) === loaded.campaign.packId &&
				String(attempt.packVersion || "") === loaded.campaign.packVersion,
		);
		const filtered = {
			...bundle,
			attemptCount: attempts.length,
			attempts,
		};
		return source.bundle ? { ...source, bundle: filtered } : filtered;
	});
	const analysis = analyzePlaytests(campaignSources, {
		minSamples:
			options.minSamples || loaded.campaign.pilotTargets.attemptsPerLevel,
		clock: options.clock,
	});
	const packReport = createPackReport(rootDirectory, loaded.campaign.packId);
	const analysisPack = analysis.packs.find(
		(pack) => pack.packId === loaded.campaign.packId,
	) || { levels: [], adjacentJumps: [] };
	const actualById = new Map(
		analysisPack.levels.map((level) => [level.levelId, level]),
	);
	const actualByOrder = new Map(
		analysisPack.levels
			.filter((level) => Number.isInteger(level.order))
			.map((level) => [level.order, level]),
	);
	const statusById = new Map(
		status.anchors.map((anchor) => [anchor.levelId, anchor]),
	);
	const previewById = new Map(
		plan.anchors.map((anchor) => [anchor.levelId, anchor]),
	);
	const resolvedLevels = loaded.pack.resolved.levels;
	const resolvedById = new Map(
		resolvedLevels.map((level) => [stableLevelId(level), level]),
	);
	const resolvedByOrder = new Map(
		resolvedLevels.map((level) => [level.order, level]),
	);
	const predictedById = new Map(
		packReport.levels.map((level) => [level.levelId, level]),
	);

	const anchors = loaded.campaign.anchors.map((anchor) => {
		const readiness = statusById.get(anchor.levelId);
		const actual = actualById.get(anchor.levelId) || null;
		const resolved = resolvedById.get(anchor.levelId);
		const predicted = predictedById.get(anchor.levelId) || null;
		const previous = resolvedByOrder.get(anchor.order - 1) || null;
		const next = resolvedByOrder.get(anchor.order + 1) || null;
		const previousActual = actualByOrder.get(anchor.order - 1) || null;
		const nextActual = actualByOrder.get(anchor.order + 1) || null;
		const maxAdjacentFailureDelta = maximumFinite(
			[
				subtractNullable(actual?.failureRate, previousActual?.failureRate),
				subtractNullable(nextActual?.failureRate, actual?.failureRate),
			].map((value) => (Number.isFinite(value) ? Math.abs(value) : null)),
		);
		const rankDelta = actual?.rankDelta ?? null;

		return {
			levelId: anchor.levelId,
			order: anchor.order,
			reason: anchor.reason,
			pilotReady: readiness.pilotReady,
			status: readiness.status,
			gaps: { ...readiness.gaps },
			attempts: readiness.attempts,
			sources: readiness.sources,
			successes: readiness.successes,
			failures: readiness.failures,
			outcomeCoverage: {
				hasSuccess: readiness.hasSuccess,
				hasFailure: readiness.hasFailure,
			},
			previewURL: previewById.get(anchor.levelId)?.previewURL || null,
			comparison: previewById.get(anchor.levelId)?.comparison || null,
			predicted: {
				score: predicted?.score ?? null,
				drivers: predicted?.drivers || [],
			},
			observed: actual ? summarizeObserved(actual) : null,
			relativeAssessment: describeRankDelta(rankDelta),
			transparentSort: {
				absoluteRankDelta: Number.isFinite(rankDelta)
					? Math.abs(rankDelta)
					: null,
				maximumAdjacentFailureRateDelta: maxAdjacentFailureDelta,
				failureRate: actual?.failureRate ?? null,
				order: anchor.order,
			},
			parameters: summarizeLevelParameters(resolved),
			neighbors: {
				previous: previous
					? summarizeNeighbor(previous, previousActual, predictedById)
					: null,
				next: next ? summarizeNeighbor(next, nextActual, predictedById) : null,
			},
		};
	});

	const collectionQueue = anchors
		.filter((anchor) => !anchor.pilotReady)
		.sort(compareCollection)
		.map((anchor) => ({
			levelId: anchor.levelId,
			order: anchor.order,
			reason: anchor.reason,
			status: anchor.status,
			gaps: { ...anchor.gaps },
			attempts: anchor.attempts,
			sources: anchor.sources,
			previewURL: anchor.previewURL,
		}));
	const reviewQueue = anchors
		.filter((anchor) => anchor.pilotReady)
		.sort(compareReview)
		.map((anchor, index) => ({
			reviewOrder: index + 1,
			...anchor,
		}));

	return deepFreeze({
		schema: "needles.balance-review/v1",
		generatedAt: analysis.generatedAt,
		campaignId: loaded.campaign.id,
		packId: loaded.campaign.packId,
		packVersion: loaded.campaign.packVersion,
		pilotTargets: { ...loaded.campaign.pilotTargets },
		sourceCount: status.sourceCount,
		matchingAttemptCount: status.matchingAttemptCount,
		readyAnchorCount: status.readyAnchorCount,
		anchorCount: status.anchorCount,
		dataGate: status.complete ? "pilot-complete" : "collect-more-data",
		methodology: {
			collectionSort: [
				"readiness ascending",
				"remaining gap descending",
				"order ascending",
			],
			reviewSort: [
				"absolute rank delta descending",
				"maximum adjacent failure-rate delta descending",
				"failure rate descending",
				"order ascending",
			],
			parameterChangesGenerated: false,
		},
		collectionQueue,
		reviewQueue,
		anchors,
	});
}

function summarizeObserved(actual) {
	return {
		sampleStatus: actual.sampleStatus,
		attempts: actual.attempts,
		completionRate: actual.completionRate,
		failureRate: actual.failureRate,
		medianAttemptsToComplete: actual.medianAttemptsToComplete,
		medianSuccessDurationMs: actual.medianSuccessDurationMs,
		medianFailureInsertedCount: actual.medianFailureInsertedCount,
		medianFailureProgress: actual.medianFailureProgress,
		medianShotIntervalMs: actual.medianShotIntervalMs,
		predictedRank: actual.predictedRank,
		observedRank: actual.observedRank,
		rankDelta: actual.rankDelta,
		failureNeedles: actual.failureNeedles,
		collisionTypes: actual.collisionTypes,
	};
}

function summarizeNeighbor(level, actual, predictedById) {
	const levelId = stableLevelId(level);
	const predicted = predictedById.get(levelId);
	return {
		levelId,
		order: level.order,
		title: level.name,
		predictedScore: predicted?.score ?? null,
		actual: actual ? summarizeObserved(actual) : null,
		parameters: summarizeLevelParameters(level),
	};
}

function summarizeLevelParameters(level) {
	const segments = level.rhythm?.segments || [];
	const speeds = segments.flatMap((segment) => {
		if (Number.isFinite(segment.velocity)) return [Math.abs(segment.velocity)];
		return [segment.fromVelocity, segment.toVelocity]
			.filter(Number.isFinite)
			.map(Math.abs);
	});
	const directionSigns = segments.map((segment) => {
		if (Number.isFinite(segment.velocity)) return Math.sign(segment.velocity);
		const from = Number(segment.fromVelocity) || 0;
		const to = Number(segment.toVelocity) || 0;
		return Math.sign(from + to);
	});
	let directionChanges = 0;
	for (let index = 1; index < directionSigns.length; index++) {
		if (
			directionSigns[index] !== 0 &&
			directionSigns[index - 1] !== 0 &&
			directionSigns[index] !== directionSigns[index - 1]
		) {
			directionChanges++;
		}
	}

	return {
		needleCount: level.needleCount,
		obstacleCount: level.layout?.obstacleAngles?.length || 0,
		layoutId: level.layout?.id || null,
		segmentCount: segments.length,
		shortestSegmentMs: minimumFinite(
			segments.map((segment) => segment.durationMs),
		),
		peakAbsSpeed: maximumFinite(speeds),
		directionChanges,
		shotModifier: level.rhythm?.shotModifier
			? JSON.parse(JSON.stringify(level.rhythm.shotModifier))
			: null,
		presentation: JSON.parse(
			JSON.stringify(level.presentation || level.designIntent || {}),
		),
		tags: [...(level.tags || [])],
	};
}

function describeRankDelta(value) {
	if (!Number.isFinite(value)) return "insufficient-relative-data";
	if (value > 0) return "harder-than-predicted-relative-position";
	if (value < 0) return "easier-than-predicted-relative-position";
	return "aligned-relative-position";
}

function compareCollection(a, b) {
	const readinessA = readinessRatio(a);
	const readinessB = readinessRatio(b);
	return (
		readinessA - readinessB ||
		b.gaps.attempts + b.gaps.sources - (a.gaps.attempts + a.gaps.sources) ||
		a.order - b.order
	);
}

function readinessRatio(anchor) {
	const attemptsTarget = anchor.attempts + anchor.gaps.attempts;
	const sourcesTarget = anchor.sources + anchor.gaps.sources;
	return Math.min(
		attemptsTarget > 0 ? anchor.attempts / attemptsTarget : 1,
		sourcesTarget > 0 ? anchor.sources / sourcesTarget : 1,
	);
}

function compareReview(a, b) {
	return (
		nullableForDescending(b.transparentSort.absoluteRankDelta) -
			nullableForDescending(a.transparentSort.absoluteRankDelta) ||
		nullableForDescending(b.transparentSort.maximumAdjacentFailureRateDelta) -
			nullableForDescending(
				a.transparentSort.maximumAdjacentFailureRateDelta,
			) ||
		nullableForDescending(b.transparentSort.failureRate) -
			nullableForDescending(a.transparentSort.failureRate) ||
		a.order - b.order
	);
}

function nullableForDescending(value) {
	return Number.isFinite(value) ? value : -1;
}

function stableLevelId(level) {
	return level.packLevelId || String(level.id);
}

function subtractNullable(a, b) {
	return Number.isFinite(a) && Number.isFinite(b)
		? Number((a - b).toFixed(6))
		: null;
}

function minimumFinite(values) {
	const finite = values.filter(Number.isFinite);
	return finite.length ? Math.min(...finite) : null;
}

function maximumFinite(values) {
	const finite = values.filter(Number.isFinite);
	return finite.length ? Math.max(...finite) : null;
}

function renderBalanceReviewHtml(review) {
	const collectionRows = review.collectionQueue
		.map(
			(item) => `<tr>
<td>${item.order}</td><td>${escapeHtml(item.levelId)}</td><td>${escapeHtml(item.reason)}</td>
<td>${item.attempts}</td><td>${item.sources}</td><td>${item.gaps.attempts}</td><td>${item.gaps.sources}</td>
<td><a href="${escapeHtml(item.previewURL)}">继续采集</a></td></tr>`,
		)
		.join("\n");
	const reviewRows = review.reviewQueue
		.map(
			(item) => `<tr>
<td>${item.reviewOrder}</td><td>${item.order}</td><td>${escapeHtml(item.levelId)}</td>
<td>${formatNumber(item.predicted.score)}</td><td>${formatPercent(item.observed?.completionRate)}</td>
<td>${formatNumber(item.observed?.medianAttemptsToComplete)}</td><td>${formatPercent(item.observed?.medianFailureProgress)}</td>
<td>${formatSigned(item.observed?.rankDelta)}</td><td>${escapeHtml(item.relativeAssessment)}</td>
<td><a href="${escapeHtml(item.previewURL)}">复查</a></td></tr>`,
		)
		.join("\n");

	return `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Needles 难度人工复查工作表</title>
<style>body{font-family:system-ui,sans-serif;margin:0;background:#11161b;color:#edf2ef}main{max-width:1180px;margin:auto;padding:32px 20px}section{background:#182329;border:1px solid #496065;border-radius:14px;padding:20px;margin:18px 0}table{width:100%;border-collapse:collapse;font-size:13px}th,td{padding:9px;border-bottom:1px solid #34474c;text-align:left}th{color:#9fb1ad}a{color:#d8ae67}.notice{color:#d8ae67}</style></head>
<body><main><h1>Needles 难度人工复查工作表</h1><p>${escapeHtml(review.packId)}@${escapeHtml(review.packVersion)} · 数据门禁 <strong>${escapeHtml(review.dataGate)}</strong></p>
<p class="notice">本报告不生成自动参数修改值。未达 pilot 的关卡只进入采集队列。</p>
<section><h2>数据采集队列</h2><table><thead><tr><th>序</th><th>关卡</th><th>原因</th><th>尝试</th><th>来源</th><th>缺尝试</th><th>缺来源</th><th>入口</th></tr></thead><tbody>${collectionRows || '<tr><td colspan="8">全部锚点达到 pilot 操作门槛</td></tr>'}</tbody></table></section>
<section><h2>人工复查队列</h2><table><thead><tr><th>优先</th><th>序</th><th>关卡</th><th>预测</th><th>完成率</th><th>完成尝试</th><th>失败进度</th><th>排名偏差</th><th>相对判断</th><th>入口</th></tr></thead><tbody>${reviewRows || '<tr><td colspan="10">尚无达到 pilot 门槛的锚点</td></tr>'}</tbody></table></section>
</main></body></html>`;
}

function formatNumber(value) {
	return Number.isFinite(value) ? String(value) : "—";
}

function formatPercent(value) {
	return Number.isFinite(value) ? `${(value * 100).toFixed(1)}%` : "—";
}

function formatSigned(value) {
	return Number.isFinite(value) ? `${value > 0 ? "+" : ""}${value}` : "—";
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
	buildBalanceReview,
	compareCollection,
	compareReview,
	renderBalanceReviewHtml,
	summarizeLevelParameters,
};
