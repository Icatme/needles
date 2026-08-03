'use strict';

const REPORT_SCHEMA = 'needles.playtest-report/v1';
const EXPORT_SCHEMA = 'needles.playtest-export/v1';

function analyzePlaytests(sources, options = {}) {
    const minSamples = positiveInteger(options.minSamples, 5);
    const clock = options.clock || (() => new Date());
    const normalizedSources = sources.map((source, index) => normalizeSource(source, index));
    const attempts = normalizedSources.flatMap(source => source.attempts);
    const groups = groupBy(attempts, attempt => `${attempt.packId}\u0000${attempt.levelId}`);
    const levelMetrics = [...groups.values()].map(group => (
        buildLevelMetrics(group, normalizedSources, minSamples)
    ));
    const packs = [...groupBy(levelMetrics, metric => metric.packId).entries()]
        .map(([packId, metrics]) => buildPackReport(packId, metrics, minSamples))
        .sort((a, b) => a.packId.localeCompare(b.packId));

    return deepFreeze({
        schema: REPORT_SCHEMA,
        generatedAt: toIsoString(clock()),
        minSamples,
        sourceCount: normalizedSources.length,
        attemptCount: attempts.length,
        summary: buildSummary(attempts, levelMetrics),
        packs,
        comparisons: buildPackComparisons(packs)
    });
}

function normalizeSource(source, index) {
    const bundle = source?.bundle || source;
    const sourceName = source?.source || `source-${index + 1}`;
    validateBundle(bundle, sourceName);
    return {
        source: sourceName,
        attempts: bundle.attempts.map((attempt, attemptIndex) => (
            normalizeAttempt(attempt, sourceName, attemptIndex)
        ))
    };
}

function validateBundle(bundle, sourceName = 'input') {
    if (!bundle || typeof bundle !== 'object' || Array.isArray(bundle)) {
        throw new Error(`${sourceName}: playtest export must be an object`);
    }
    if (bundle.schema !== EXPORT_SCHEMA) {
        throw new Error(`${sourceName}: unsupported schema ${bundle.schema}`);
    }
    if (!Array.isArray(bundle.attempts)) {
        throw new Error(`${sourceName}: attempts must be an array`);
    }
    if (
        Number.isInteger(bundle.attemptCount)
        && bundle.attemptCount !== bundle.attempts.length
    ) {
        throw new Error(`${sourceName}: attemptCount does not match attempts.length`);
    }
    return true;
}

function normalizeAttempt(attempt, sourceName, sourceIndex) {
    if (!attempt || typeof attempt !== 'object') {
        throw new Error(`${sourceName}: attempt ${sourceIndex + 1} must be an object`);
    }
    if (!attempt.packId || !attempt.levelId || !attempt.result) {
        throw new Error(`${sourceName}: attempt ${sourceIndex + 1} lacks identity or result`);
    }

    const result = attempt.result;
    const success = Boolean(result.success || result.status === 'completed');
    const totalCount = finiteOrNull(result.totalCount);
    const insertedCount = finiteOrNull(result.insertedCount);
    const failureProgress = !success && totalCount > 0 && insertedCount !== null
        ? clamp(insertedCount / totalCount, 0, 1)
        : null;

    return {
        source: sourceName,
        sourceIndex,
        id: attempt.id || `${sourceName}:${sourceIndex + 1}`,
        recordedAt: attempt.recordedAt || null,
        packId: String(attempt.packId),
        packVersion: attempt.packVersion ?? null,
        levelId: String(attempt.levelId),
        order: integerOrNull(attempt.order),
        predictedDifficulty: finiteOrNull(attempt.predictedDifficulty),
        difficultyDrivers: Array.isArray(attempt.difficultyDrivers)
            ? attempt.difficultyDrivers.map(String).slice(0, 3)
            : [],
        success,
        status: success ? 'completed' : 'failed',
        durationMs: finiteOrNull(result.durationMs),
        insertedCount,
        totalCount,
        failureProgress,
        failedNeedleNumber: integerOrNull(result.failedNeedleNumber),
        collisionType: result.collisionType || null,
        collisionTargetId: result.collisionTargetId ?? null,
        acceptedAtMs: Array.isArray(attempt.shots?.acceptedAtMs)
            ? attempt.shots.acceptedAtMs.filter(Number.isFinite).map(Number)
            : [],
        intervalsMs: Array.isArray(attempt.shots?.intervalsMs)
            ? attempt.shots.intervalsMs.filter(Number.isFinite).map(Number)
            : [],
        replayDigest: attempt.replay?.digest || null
    };
}

function buildLevelMetrics(group, sources, minSamples) {
    const attempts = [...group].sort(compareAttempts);
    const successes = attempts.filter(attempt => attempt.success);
    const failures = attempts.filter(attempt => !attempt.success);
    const attemptsToCompletion = calculateAttemptsToCompletion(attempts, sources);
    const predictedValues = attempts
        .map(attempt => attempt.predictedDifficulty)
        .filter(Number.isFinite);
    const orders = attempts.map(attempt => attempt.order).filter(Number.isInteger);
    const versions = unique(attempts.map(attempt => attempt.packVersion).filter(Boolean));
    const drivers = countValues(attempts.flatMap(attempt => attempt.difficultyDrivers));

    return {
        packId: attempts[0].packId,
        packVersions: versions,
        levelId: attempts[0].levelId,
        order: orders.length ? median(orders) : null,
        sampleStatus: attempts.length >= minSamples ? 'usable' : 'low-sample',
        attempts: attempts.length,
        successes: successes.length,
        failures: failures.length,
        completionRate: ratio(successes.length, attempts.length),
        failureRate: ratio(failures.length, attempts.length),
        completedRuns: attemptsToCompletion.completedRuns,
        incompleteRuns: attemptsToCompletion.incompleteRuns,
        medianAttemptsToComplete: medianOrNull(attemptsToCompletion.values),
        medianSuccessDurationMs: medianOrNull(
            successes.map(attempt => attempt.durationMs).filter(Number.isFinite)
        ),
        medianFailureInsertedCount: medianOrNull(
            failures.map(attempt => attempt.insertedCount).filter(Number.isFinite)
        ),
        medianFailureProgress: medianOrNull(
            failures.map(attempt => attempt.failureProgress).filter(Number.isFinite)
        ),
        medianShotIntervalMs: medianOrNull(
            attempts.flatMap(attempt => attempt.intervalsMs)
        ),
        medianPredictedDifficulty: medianOrNull(predictedValues),
        failureNeedles: countValues(
            failures.map(attempt => attempt.failedNeedleNumber).filter(Number.isInteger)
        ),
        collisionTypes: countValues(
            failures.map(attempt => attempt.collisionType || 'unknown')
        ),
        difficultyDrivers: drivers,
        sourceCount: unique(attempts.map(attempt => attempt.source)).length,
        predictedRank: null,
        observedRank: null,
        rankDelta: null
    };
}

function calculateAttemptsToCompletion(attempts, sources) {
    const sourceOrder = new Map(sources.map((source, index) => [source.source, index]));
    const bySource = groupBy(attempts, attempt => attempt.source);
    const values = [];
    let incompleteRuns = 0;

    [...bySource.entries()]
        .sort((a, b) => sourceOrder.get(a[0]) - sourceOrder.get(b[0]))
        .forEach(([, sourceAttempts]) => {
            let current = 0;
            [...sourceAttempts].sort(compareAttempts).forEach(attempt => {
                current++;
                if (attempt.success) {
                    values.push(current);
                    current = 0;
                }
            });
            if (current > 0) incompleteRuns++;
        });

    return {
        values,
        completedRuns: values.length,
        incompleteRuns
    };
}

function buildPackReport(packId, metrics, minSamples) {
    const levels = metrics
        .map(metric => ({ ...metric }))
        .sort(compareLevels);
    applyRelativeRanks(levels);

    return {
        packId,
        packVersions: unique(levels.flatMap(level => level.packVersions)),
        levelCount: levels.length,
        attemptCount: sum(levels.map(level => level.attempts)),
        usableLevelCount: levels.filter(level => level.attempts >= minSamples).length,
        levels,
        adjacentJumps: buildAdjacentJumps(levels, minSamples)
    };
}

function applyRelativeRanks(levels) {
    const predicted = levels
        .filter(level => Number.isFinite(level.medianPredictedDifficulty))
        .sort((a, b) => (
            a.medianPredictedDifficulty - b.medianPredictedDifficulty
            || compareLevels(a, b)
        ));
    predicted.forEach((level, index) => {
        level.predictedRank = index + 1;
    });

    const observed = [...levels].sort((a, b) => (
        a.failureRate - b.failureRate
        || nullableNumber(a.medianAttemptsToComplete, Infinity)
            - nullableNumber(b.medianAttemptsToComplete, Infinity)
        || failureDepthHardness(a) - failureDepthHardness(b)
        || nullableNumber(a.medianSuccessDurationMs, Infinity)
            - nullableNumber(b.medianSuccessDurationMs, Infinity)
        || compareLevels(a, b)
    ));
    observed.forEach((level, index) => {
        level.observedRank = index + 1;
        level.rankDelta = Number.isInteger(level.predictedRank)
            ? level.observedRank - level.predictedRank
            : null;
    });
}

function buildAdjacentJumps(levels, minSamples) {
    const jumps = [];
    for (let index = 1; index < levels.length; index++) {
        const previous = levels[index - 1];
        const current = levels[index];
        jumps.push({
            fromLevelId: previous.levelId,
            fromOrder: previous.order,
            toLevelId: current.levelId,
            toOrder: current.order,
            comparable: previous.attempts >= minSamples && current.attempts >= minSamples,
            predictedDifficultyDelta: subtractNullable(
                current.medianPredictedDifficulty,
                previous.medianPredictedDifficulty
            ),
            failureRateDelta: round(current.failureRate - previous.failureRate),
            medianAttemptsDelta: subtractNullable(
                current.medianAttemptsToComplete,
                previous.medianAttemptsToComplete
            ),
            medianFailureProgressDelta: subtractNullable(
                current.medianFailureProgress,
                previous.medianFailureProgress
            ),
            observedRankDelta: current.observedRank - previous.observedRank
        });
    }
    return jumps;
}

function buildPackComparisons(packs) {
    const balanced = packs.find(pack => pack.packId === 'balanced-v2');
    const legacy = packs.find(pack => pack.packId === 'legacy');
    if (!balanced || !legacy) return [];

    const legacyByOrder = new Map(
        legacy.levels
            .filter(level => Number.isInteger(level.order))
            .map(level => [level.order, level])
    );
    return balanced.levels
        .filter(level => Number.isInteger(level.order) && legacyByOrder.has(level.order))
        .map(level => {
            const other = legacyByOrder.get(level.order);
            return {
                order: level.order,
                balancedLevelId: level.levelId,
                legacyLevelId: other.levelId,
                balancedAttempts: level.attempts,
                legacyAttempts: other.attempts,
                completionRateDelta: round(
                    level.completionRate - other.completionRate
                ),
                medianAttemptsDelta: subtractNullable(
                    level.medianAttemptsToComplete,
                    other.medianAttemptsToComplete
                ),
                medianSuccessDurationDeltaMs: subtractNullable(
                    level.medianSuccessDurationMs,
                    other.medianSuccessDurationMs
                )
            };
        });
}

function buildSummary(attempts, levelMetrics) {
    const successes = attempts.filter(attempt => attempt.success);
    return {
        packCount: unique(attempts.map(attempt => attempt.packId)).length,
        levelCount: levelMetrics.length,
        successes: successes.length,
        failures: attempts.length - successes.length,
        completionRate: ratio(successes.length, attempts.length),
        medianSuccessDurationMs: medianOrNull(
            successes.map(attempt => attempt.durationMs).filter(Number.isFinite)
        )
    };
}

function renderHtmlReport(report) {
    const packSections = report.packs.map(renderPackSection).join('\n');
    const comparisons = report.comparisons.length
        ? renderComparisonSection(report.comparisons)
        : '<p class="muted">没有同时包含 balanced-v2 与 legacy 的同关号数据。</p>';

    return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Needles 试玩报告</title>
<style>
:root { color-scheme: light dark; font-family: Inter, system-ui, sans-serif; }
body { margin: 0; background: #11161b; color: #edf2ef; }
main { max-width: 1180px; margin: 0 auto; padding: 32px 20px 64px; }
h1, h2, h3 { margin: 0 0 12px; }
header, section { background: #182329; border: 1px solid #496065; border-radius: 14px; padding: 20px; margin-bottom: 18px; }
.summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 10px; }
.card { background: #11191d; border-radius: 10px; padding: 12px; }
.card strong { display: block; font-size: 24px; color: #d8ae67; }
.table-wrap { overflow-x: auto; }
table { width: 100%; border-collapse: collapse; font-size: 13px; }
th, td { padding: 9px 8px; border-bottom: 1px solid #34474c; text-align: right; white-space: nowrap; }
th:first-child, td:first-child, th:nth-child(2), td:nth-child(2) { text-align: left; }
th { color: #9fb1ad; font-weight: 600; }
.low { opacity: .58; }
.positive { color: #ff9280; }
.negative { color: #81d3b0; }
.muted { color: #9fb1ad; }
code { color: #d8ae67; }
</style>
</head>
<body>
<main>
<header>
<h1>Needles 试玩报告</h1>
<p class="muted">生成时间 ${escapeHtml(report.generatedAt)} · ${report.sourceCount} 个匿名导出文件 · 最低可比较样本 ${report.minSamples}</p>
<div class="summary">
${summaryCard('尝试', report.attemptCount)}
${summaryCard('关卡', report.summary.levelCount)}
${summaryCard('完成率', formatPercent(report.summary.completionRate))}
${summaryCard('成功耗时中位数', formatDuration(report.summary.medianSuccessDurationMs))}
</div>
</header>
${packSections}
<section>
<h2>balanced-v2 / legacy 同关号对照</h2>
${comparisons}
</section>
</main>
</body>
</html>`;
}

function renderPackSection(pack) {
    const levelRows = pack.levels.map(level => {
        const deltaClass = level.rankDelta > 0
            ? 'positive'
            : (level.rankDelta < 0 ? 'negative' : '');
        return `<tr class="${level.sampleStatus === 'low-sample' ? 'low' : ''}">
<td>${escapeHtml(level.levelId)}</td>
<td>${formatNullable(level.order)}</td>
<td>${level.attempts}</td>
<td>${formatPercent(level.completionRate)}</td>
<td>${formatNullable(level.medianAttemptsToComplete)}</td>
<td>${formatDuration(level.medianSuccessDurationMs)}</td>
<td>${formatPercent(level.medianFailureProgress)}</td>
<td>${formatDuration(level.medianShotIntervalMs)}</td>
<td>${formatNullable(level.medianPredictedDifficulty)}</td>
<td>${formatNullable(level.observedRank)}</td>
<td class="${deltaClass}">${formatSigned(level.rankDelta)}</td>
</tr>`;
    }).join('\n');
    const jumpRows = pack.adjacentJumps.map(jump => `<tr class="${jump.comparable ? '' : 'low'}">
<td>${escapeHtml(jump.fromLevelId)} → ${escapeHtml(jump.toLevelId)}</td>
<td>${formatSigned(jump.predictedDifficultyDelta)}</td>
<td>${formatSignedPercent(jump.failureRateDelta)}</td>
<td>${formatSigned(jump.medianAttemptsDelta)}</td>
<td>${formatSignedPercent(jump.medianFailureProgressDelta)}</td>
<td>${formatSigned(jump.observedRankDelta)}</td>
</tr>`).join('\n');

    return `<section>
<h2>${escapeHtml(pack.packId)}</h2>
<p class="muted">${pack.attemptCount} 次尝试 · ${pack.levelCount} 个关卡 · ${pack.usableLevelCount} 个达到样本门槛</p>
<div class="table-wrap"><table>
<thead><tr><th>关卡</th><th>顺序</th><th>尝试</th><th>完成率</th><th>完成所需尝试</th><th>成功耗时</th><th>失败进度</th><th>出针间隔</th><th>预测难度</th><th>实际排名</th><th>排名偏差</th></tr></thead>
<tbody>${levelRows}</tbody>
</table></div>
<h3 style="margin-top:22px">相邻关跳幅</h3>
<div class="table-wrap"><table>
<thead><tr><th>关卡</th><th>预测差</th><th>失败率差</th><th>尝试数差</th><th>失败进度差</th><th>实际排名差</th></tr></thead>
<tbody>${jumpRows || '<tr><td colspan="6" class="muted">数据不足</td></tr>'}</tbody>
</table></div>
</section>`;
}

function renderComparisonSection(rows) {
    return `<div class="table-wrap"><table>
<thead><tr><th>关号</th><th>V2 尝试</th><th>旧版尝试</th><th>完成率差</th><th>完成尝试差</th><th>成功耗时差</th></tr></thead>
<tbody>${rows.map(row => `<tr>
<td>${row.order}</td>
<td>${row.balancedAttempts}</td>
<td>${row.legacyAttempts}</td>
<td>${formatSignedPercent(row.completionRateDelta)}</td>
<td>${formatSigned(row.medianAttemptsDelta)}</td>
<td>${formatSignedDuration(row.medianSuccessDurationDeltaMs)}</td>
</tr>`).join('\n')}</tbody>
</table></div>`;
}

function compareAttempts(a, b) {
    const timeA = Date.parse(a.recordedAt || '') || 0;
    const timeB = Date.parse(b.recordedAt || '') || 0;
    return timeA - timeB || a.sourceIndex - b.sourceIndex;
}

function compareLevels(a, b) {
    return nullableNumber(a.order, Infinity) - nullableNumber(b.order, Infinity)
        || a.levelId.localeCompare(b.levelId);
}

function failureDepthHardness(level) {
    return level.failures > 0 && Number.isFinite(level.medianFailureProgress)
        ? 1 - level.medianFailureProgress
        : 0;
}

function groupBy(values, keyOf) {
    const groups = new Map();
    values.forEach(value => {
        const key = keyOf(value);
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(value);
    });
    return groups;
}

function countValues(values) {
    return [...values.reduce((counts, value) => {
        const key = String(value);
        counts.set(key, (counts.get(key) || 0) + 1);
        return counts;
    }, new Map()).entries()]
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
        .map(([value, count]) => ({ value, count }));
}

function median(values) {
    const sorted = [...values].sort((a, b) => a - b);
    const middle = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 1
        ? sorted[middle]
        : (sorted[middle - 1] + sorted[middle]) / 2;
}

function medianOrNull(values) {
    return values.length ? round(median(values)) : null;
}

function ratio(numerator, denominator) {
    return denominator > 0 ? round(numerator / denominator) : 0;
}

function subtractNullable(a, b) {
    return Number.isFinite(a) && Number.isFinite(b) ? round(a - b) : null;
}

function finiteOrNull(value) {
    return Number.isFinite(value) ? Number(value) : null;
}

function integerOrNull(value) {
    return Number.isInteger(value) ? value : null;
}

function positiveInteger(value, fallback) {
    return Number.isInteger(value) && value > 0 ? value : fallback;
}

function nullableNumber(value, fallback) {
    return Number.isFinite(value) ? value : fallback;
}

function unique(values) {
    return [...new Set(values)];
}

function sum(values) {
    return values.reduce((total, value) => total + value, 0);
}

function clamp(value, minimum, maximum) {
    return Math.max(minimum, Math.min(value, maximum));
}

function round(value) {
    return Number.isFinite(value) ? Number(value.toFixed(6)) : value;
}

function toIsoString(value) {
    const date = value instanceof Date ? value : new Date(value);
    return Number.isNaN(date.getTime())
        ? new Date(0).toISOString()
        : date.toISOString();
}

function deepFreeze(value) {
    if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
    Object.values(value).forEach(deepFreeze);
    return Object.freeze(value);
}

function escapeHtml(value) {
    return String(value)
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;');
}

function summaryCard(label, value) {
    return `<div class="card"><span class="muted">${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`;
}

function formatPercent(value) {
    return Number.isFinite(value) ? `${(value * 100).toFixed(1)}%` : '—';
}

function formatSignedPercent(value) {
    return Number.isFinite(value)
        ? `${value > 0 ? '+' : ''}${(value * 100).toFixed(1)}%`
        : '—';
}

function formatDuration(value) {
    return Number.isFinite(value) ? `${Math.round(value)} ms` : '—';
}

function formatSignedDuration(value) {
    return Number.isFinite(value)
        ? `${value > 0 ? '+' : ''}${Math.round(value)} ms`
        : '—';
}

function formatNullable(value) {
    return Number.isFinite(value) ? String(value) : '—';
}

function formatSigned(value) {
    return Number.isFinite(value) ? `${value > 0 ? '+' : ''}${value}` : '—';
}

module.exports = {
    EXPORT_SCHEMA,
    REPORT_SCHEMA,
    analyzePlaytests,
    renderHtmlReport,
    validateBundle
};
