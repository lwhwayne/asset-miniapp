/*
 * 网页预览版逻辑：移植自小程序的 models/ 与 utils/，
 * 仅用于在浏览器中快速迭代 UI。数据存于 localStorage。
 */

// ---------- currency ----------
const CURRENCIES = [
  { code: "CNY", name: "人民币", defaultRate: 1 },
  { code: "HKD", name: "港币", defaultRate: 0.92 },
  { code: "USD", name: "美元", defaultRate: 7.2 },
  { code: "EUR", name: "欧元", defaultRate: 7.8 },
  { code: "JPY", name: "日元", defaultRate: 0.05 }
];

function getCurrency(code) {
  return CURRENCIES.find((c) => c.code === code) || CURRENCIES[0];
}
function getDefaultRate(code) {
  return getCurrency(code).defaultRate;
}
function toNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}
function roundMoney(value) {
  return Math.round(toNumber(value) * 100) / 100;
}
function toCny(amount, rate) {
  return roundMoney(toNumber(amount) * toNumber(rate, 1));
}
function formatMoney(value, currency = "CNY") {
  const amount = roundMoney(value);
  return `${currency} ${amount.toLocaleString("zh-CN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`;
}
function formatPercent(value) {
  return `${roundMoney(value)}%`;
}

const DISPLAY_CURRENCIES = ["CNY", "HKD", "USD"];
const DISPLAY_CURRENCY_KEY = "asset-miniapp.displayCurrency";

function getDisplayCurrency() {
  const saved = localStorage.getItem(DISPLAY_CURRENCY_KEY);
  return DISPLAY_CURRENCIES.includes(saved) ? saved : "CNY";
}
function setDisplayCurrency(code) {
  localStorage.setItem(DISPLAY_CURRENCY_KEY, code);
}
function convertFromCny(amountCny, targetCode) {
  const rate = getDefaultRate(targetCode);
  return rate > 0 ? roundMoney(amountCny / rate) : 0;
}
function formatDisplayAmount(totalCny, code = getActiveDisplayCurrency()) {
  const amount = convertFromCny(totalCny, code);
  return amount.toLocaleString("zh-CN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}
function getActiveDisplayCurrency() {
  return displayCurrency || getDisplayCurrency();
}
function formatDisplayMoney(amountCny, currency = getActiveDisplayCurrency()) {
  return formatMoney(convertFromCny(amountCny, currency), currency);
}
function convertDisplayToNative(displayAmount, displayCode, nativeCurrency) {
  const amountCny = toCny(displayAmount, getDefaultRate(displayCode));
  const nativeRate = getDefaultRate(nativeCurrency);
  return nativeRate > 0 ? roundMoney(amountCny / nativeRate) : 0;
}
function toDisplayAmount(amountCny, currency = getActiveDisplayCurrency()) {
  return convertFromCny(amountCny, currency);
}
function calcMonthGrowth(snapshots, currentTotal) {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const sorted = snapshots.slice().sort((a, b) => new Date(a.date) - new Date(b.date));
  const beforeMonth = sorted.filter((s) => new Date(s.date) < monthStart).pop();
  const firstInMonth = sorted.find((s) => new Date(s.date) >= monthStart);
  const baseline = beforeMonth || firstInMonth;
  if (!baseline || baseline.totalValueCny === 0) {
    return { hasData: false, percent: 0, deltaCny: 0, cls: "flat" };
  }
  const deltaCny = roundMoney(currentTotal - baseline.totalValueCny);
  const percent = roundMoney((deltaCny / baseline.totalValueCny) * 100);
  return {
    hasData: true,
    percent,
    deltaCny,
    cls: deltaCny > 0 ? "up" : deltaCny < 0 ? "down" : "flat"
  };
}

const GROWTH_METRICS = [
  { code: "rate", label: "本月增长率" },
  { code: "amount", label: "本月增长额" }
];
const GROWTH_METRIC_KEY = "asset-miniapp.growthMetric";

function getGrowthMetric() {
  const saved = localStorage.getItem(GROWTH_METRIC_KEY);
  return GROWTH_METRICS.some((m) => m.code === saved) ? saved : "rate";
}
function setGrowthMetric(code) {
  localStorage.setItem(GROWTH_METRIC_KEY, code);
}
function formatGrowthRate(percent) {
  const prefix = percent >= 0 ? "+" : "";
  return `${prefix}${formatPercent(percent)}`;
}
function formatGrowthAmount(deltaCny, currency) {
  const amount = convertFromCny(Math.abs(deltaCny), currency);
  const prefix = deltaCny >= 0 ? "+" : "-";
  return `${prefix}${amount.toLocaleString("zh-CN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`;
}
function getGrowthDisplay(monthGrowth, metric, currency) {
  const item = GROWTH_METRICS.find((m) => m.code === metric) || GROWTH_METRICS[0];
  if (!monthGrowth.hasData) {
    return { label: item.label, text: "暂无数据", cls: "flat" };
  }
  if (metric === "amount") {
    return { label: item.label, text: formatGrowthAmount(monthGrowth.deltaCny, currency), cls: monthGrowth.cls };
  }
  return { label: item.label, text: formatGrowthRate(monthGrowth.percent), cls: monthGrowth.cls };
}

// ---------- asset model ----------
const CATEGORIES = [
  { code: "stock", name: "股票" },
  { code: "fund", name: "基金" },
  { code: "gold", name: "黄金" },
  { code: "cash", name: "现金" },
  { code: "insurance", name: "保险" },
  { code: "housing", name: "公积金" }
];
const CATEGORY_LEGACY_MAP = {
  brokerage: "stock",
  payment: "cash",
  other: "cash"
};
const COLORS = ["#155eef", "#16a34a", "#f59e0b", "#8b5cf6", "#0ea5e9", "#ef4444"];
const RECURRING_INTERVALS = [
  { code: "day", label: "每天" },
  { code: "week", label: "每周" },
  { code: "month", label: "每月" },
  { code: "year", label: "每年" }
];

function createId(prefix = "asset") {
  return `${prefix}_${Date.now()}_${Math.floor(Math.random() * 100000)}`;
}
function resolveCategoryCode(code) {
  if (CATEGORIES.some((c) => c.code === code)) return code;
  return CATEGORY_LEGACY_MAP[code] || "cash";
}
function getCategory(code) {
  return CATEGORIES.find((c) => c.code === resolveCategoryCode(code));
}
function migrateCategoryValues(values = {}) {
  const result = {};
  Object.keys(values).forEach((code) => {
    const nextCode = resolveCategoryCode(code);
    result[nextCode] = roundMoney((result[nextCode] || 0) + values[code]);
  });
  return result;
}
function normalizeRecurring(input) {
  if (!input?.enabled) {
    return { enabled: false, interval: "month", amount: 0, lastAppliedAt: null };
  }
  const interval = RECURRING_INTERVALS.some((i) => i.code === input.interval) ? input.interval : "month";
  return {
    enabled: true,
    interval,
    amount: roundMoney(input.amount),
    lastAppliedAt: input.lastAppliedAt || null
  };
}
function mergeRecurringOnSave(prev, formRecurring) {
  const normalized = normalizeRecurring(formRecurring);
  if (!normalized.enabled) return normalized;
  const prevRecurring = prev?.recurring;
  if (
    prevRecurring?.enabled &&
    prevRecurring.interval === normalized.interval &&
    prevRecurring.amount === normalized.amount &&
    prevRecurring.lastAppliedAt
  ) {
    return { ...normalized, lastAppliedAt: prevRecurring.lastAppliedAt };
  }
  return { ...normalized, lastAppliedAt: new Date().toISOString() };
}
function countElapsedPeriods(fromDate, toDate, interval) {
  if (toDate <= fromDate) return 0;
  if (interval === "day") {
    return Math.floor((toDate - fromDate) / (24 * 60 * 60 * 1000));
  }
  if (interval === "week") {
    return Math.floor((toDate - fromDate) / (7 * 24 * 60 * 60 * 1000));
  }
  if (interval === "month") {
    let count = 0;
    let cursor = new Date(fromDate);
    while (true) {
      const next = new Date(cursor);
      next.setMonth(next.getMonth() + 1);
      if (next > toDate) break;
      count++;
      cursor = next;
    }
    return count;
  }
  if (interval === "year") {
    let count = 0;
    let cursor = new Date(fromDate);
    while (true) {
      const next = new Date(cursor);
      next.setFullYear(next.getFullYear() + 1);
      if (next > toDate) break;
      count++;
      cursor = next;
    }
    return count;
  }
  return 0;
}
function advanceByPeriods(fromDate, interval, periods) {
  const d = new Date(fromDate);
  if (interval === "day") d.setDate(d.getDate() + periods);
  else if (interval === "week") d.setDate(d.getDate() + periods * 7);
  else if (interval === "month") d.setMonth(d.getMonth() + periods);
  else if (interval === "year") d.setFullYear(d.getFullYear() + periods);
  return d;
}
function applyRecurringToAsset(asset) {
  const recurring = asset.recurring;
  if (!recurring?.enabled || recurring.amount <= 0) return asset;
  const now = new Date();
  const anchor = recurring.lastAppliedAt || asset.updatedAt;
  const lastApplied = new Date(anchor);
  const periods = countElapsedPeriods(lastApplied, now, recurring.interval);
  if (periods <= 0) return asset;
  const addAmount = roundMoney(recurring.amount * periods);
  const newLastApplied = advanceByPeriods(lastApplied, recurring.interval, periods).toISOString();
  return normalizeAsset({
    ...asset,
    amount: roundMoney(asset.amount + addAmount),
    recurring: { ...recurring, lastAppliedAt: newLastApplied },
    updatedAt: new Date().toISOString()
  });
}
function formatRecurringSummary(recurring, nativeCurrency = "CNY") {
  if (!recurring?.enabled || recurring.amount <= 0) return "";
  const interval = RECURRING_INTERVALS.find((i) => i.code === recurring.interval);
  const amountCny = toCny(recurring.amount, getDefaultRate(nativeCurrency));
  return `${interval?.label || ""} +${formatDisplayMoney(amountCny)}`;
}
function normalizeAsset(input = {}) {
  const now = new Date().toISOString();
  const currency = input.currency || "CNY";
  const rate = getDefaultRate(currency);
  const amount = roundMoney(input.amount);
  return {
    id: input.id || createId(),
    name: String(input.name || "").trim(),
    category: resolveCategoryCode(input.category || "cash"),
    currency,
    amount,
    exchangeRateToCny: rate,
    valueCny: toCny(amount, rate),
    updatedAt: input.updatedAt || now,
    recurring: normalizeRecurring(input.recurring)
  };
}
function validateAsset(asset) {
  if (!asset.name) return "请输入资产名称";
  if (asset.amount < 0) return "资产金额不能小于 0";
  return "";
}
function readRecurringFromForm(view, nativeCurrency) {
  const recurringToggle = view.querySelector("#f-recurring-enabled");
  if (!recurringToggle?.checked) return { enabled: false };
  const displayAmount = toNumber(view.querySelector("#f-recurring-amount").value);
  if (displayAmount <= 0) return { enabled: false };
  return {
    enabled: true,
    interval: view.querySelector("#f-recurring-interval").value,
    amount: convertDisplayToNative(displayAmount, getActiveDisplayCurrency(), nativeCurrency)
  };
}
function buildSegments(values, labeled) {
  const entries = Object.keys(values).map((code) => ({
    code,
    name: labeled ? getCategory(code).name : code,
    value: roundMoney(values[code])
  }));
  const total = entries.reduce((s, i) => roundMoney(s + i.value), 0);
  return entries
    .filter((i) => i.value > 0)
    .sort((a, b) => b.value - a.value)
    .map((i) => ({ ...i, percent: total > 0 ? roundMoney((i.value / total) * 100) : 0 }));
}
function summarizeAssets(assets = []) {
  const summary = assets.reduce(
    (res, a) => {
      const value = roundMoney(a.valueCny);
      res.totalValueCny = roundMoney(res.totalValueCny + value);
      res.categoryValues[a.category] = roundMoney((res.categoryValues[a.category] || 0) + value);
      res.currencyValues[a.currency] = roundMoney((res.currencyValues[a.currency] || 0) + value);
      return res;
    },
    { totalValueCny: 0, categoryValues: {}, currencyValues: {} }
  );
  return {
    ...summary,
    categorySegments: buildSegments(summary.categoryValues, true),
    currencySegments: buildSegments(summary.currencyValues, false)
  };
}

// ---------- snapshot ----------
function createSnapshot(assets = [], prev) {
  const summary = summarizeAssets(assets);
  const prevTotal = prev ? prev.totalValueCny : 0;
  const deltaCny = roundMoney(summary.totalValueCny - prevTotal);
  return {
    id: createId("snapshot"),
    date: new Date().toISOString(),
    totalValueCny: summary.totalValueCny,
    categoryValues: summary.categoryValues,
    currencyValues: summary.currencyValues,
    deltaCny,
    deltaPercent: prevTotal > 0 ? roundMoney((deltaCny / prevTotal) * 100) : 0
  };
}
function shouldCreateSnapshot(assets = [], latest) {
  if (!assets.length) return false;
  if (!latest) return true;
  return summarizeAssets(assets).totalValueCny !== latest.totalValueCny;
}
function buildTrendPoints(snapshots = []) {
  return snapshots
    .slice()
    .sort((a, b) => new Date(a.date) - new Date(b.date))
    .map((s) => {
      const d = new Date(s.date);
      return {
        id: s.id,
        label: `${d.getMonth() + 1}/${d.getDate()}`,
        value: s.totalValueCny,
        deltaCny: s.deltaCny,
        deltaPercent: s.deltaPercent
      };
    });
}

// ---------- storage (localStorage) ----------
const ASSETS_KEY = "asset-miniapp.assets";
const SNAPSHOTS_KEY = "asset-miniapp.snapshots";

function readJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (e) {
    return fallback;
  }
}
function writeJson(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}
function loadAssetsRaw() {
  return readJson(ASSETS_KEY, []).map((a) => normalizeAsset(a));
}
function recordSnapshotForAssets(assets) {
  const snapshots = getSnapshots();
  const latest = snapshots[snapshots.length - 1];
  if (!shouldCreateSnapshot(assets, latest)) return;
  const snapshot = createSnapshot(assets, latest);
  writeJson(SNAPSHOTS_KEY, snapshots.concat(snapshot).slice(-120));
}
function getAssets() {
  const raw = loadAssetsRaw();
  const applied = raw.map(applyRecurringToAsset);
  if (JSON.stringify(applied) !== JSON.stringify(raw)) {
    writeJson(ASSETS_KEY, applied);
    recordSnapshotForAssets(applied);
  }
  return applied;
}
function getSnapshots() {
  return readJson(SNAPSHOTS_KEY, []);
}
function saveAssets(assets) {
  const normalized = assets.map((a) => normalizeAsset(a));
  writeJson(ASSETS_KEY, normalized);
  recordSnapshotForAssets(normalized);
}
function upsertAsset(input) {
  const assets = getAssets();
  const prev = assets.find((a) => a.id === input.id);
  const recurring = mergeRecurringOnSave(prev, input.recurring);
  const next = normalizeAsset({ ...input, recurring, updatedAt: new Date().toISOString() });
  const idx = assets.findIndex((a) => a.id === next.id);
  if (idx >= 0) assets[idx] = next;
  else assets.unshift(next);
  saveAssets(assets);
  return next;
}
function deleteAsset(id) {
  saveAssets(getAssets().filter((a) => a.id !== id));
}
function clearAllData() {
  localStorage.removeItem(ASSETS_KEY);
  localStorage.removeItem(SNAPSHOTS_KEY);
}
function migrateStoredDataIfNeeded() {
  const assets = readJson(ASSETS_KEY, null);
  if (assets) {
    const migratedAssets = assets.map((a) => {
      const category = resolveCategoryCode(a.category);
      return category === a.category ? a : { ...a, category };
    });
    if (JSON.stringify(migratedAssets) !== JSON.stringify(assets)) {
      writeJson(ASSETS_KEY, migratedAssets);
    }
  }

  const snapshots = readJson(SNAPSHOTS_KEY, null);
  if (snapshots) {
    const migratedSnapshots = snapshots.map((s) => {
      const categoryValues = migrateCategoryValues(s.categoryValues || {});
      if (JSON.stringify(categoryValues) === JSON.stringify(s.categoryValues || {})) return s;
      return { ...s, categoryValues };
    });
    if (JSON.stringify(migratedSnapshots) !== JSON.stringify(snapshots)) {
      writeJson(SNAPSHOTS_KEY, migratedSnapshots);
    }
  }
}

// ---------- seed sample data on first run ----------
function seedIfEmpty() {
  if (readJson(ASSETS_KEY, null)) return;
  const sample = [
    { name: "富途港股账户", category: "stock", currency: "HKD", amount: 86000, exchangeRateToCny: 0.92 },
    { name: "指数基金", category: "fund", currency: "CNY", amount: 60000, exchangeRateToCny: 1 },
    { name: "积存金", category: "gold", currency: "CNY", amount: 15000, exchangeRateToCny: 1 },
    { name: "支付宝余额", category: "cash", currency: "CNY", amount: 18650, exchangeRateToCny: 1 },
    { name: "现金港币", category: "cash", currency: "HKD", amount: 42000, exchangeRateToCny: 0.92 },
    { name: "招商银行活期", category: "cash", currency: "CNY", amount: 32000, exchangeRateToCny: 1 },
    { name: "重疾险现金价值", category: "insurance", currency: "CNY", amount: 26000, exchangeRateToCny: 1 },
    { name: "住房公积金", category: "housing", currency: "CNY", amount: 48000, recurring: { enabled: true, interval: "month", amount: 2400 } }
  ].map((a) => normalizeAsset(a));
  writeJson(ASSETS_KEY, sample);

  // 构造几条历史快照，让趋势图有内容
  const base = summarizeAssets(sample).totalValueCny;
  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;
  const factors = [0.86, 0.9, 0.94, 0.97, 1];
  let prevTotal = 0;
  const snapshots = factors.map((f, i) => {
    const total = roundMoney(base * f);
    const deltaCny = roundMoney(total - prevTotal);
    const snap = {
      id: createId("snapshot"),
      date: new Date(now - (factors.length - 1 - i) * 7 * day).toISOString(),
      totalValueCny: total,
      categoryValues: {},
      currencyValues: {},
      deltaCny,
      deltaPercent: prevTotal > 0 ? roundMoney((deltaCny / prevTotal) * 100) : 0
    };
    prevTotal = total;
    return snap;
  });
  writeJson(SNAPSHOTS_KEY, snapshots);
}

// ---------- charts ----------
function drawTrendChart(canvas, points) {
  const ctx = canvas.getContext("2d");
  const dpr = window.devicePixelRatio || 1;
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, w, h);

  const pad = 28;
  ctx.strokeStyle = "#e5e7eb";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(pad, h - pad);
  ctx.lineTo(w - pad, h - pad);
  ctx.stroke();

  if (!points.length) return;

  const values = points.map((p) => p.value);
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const range = max - min || 1;
  const stepX = points.length > 1 ? (w - pad * 2) / (points.length - 1) : 0;
  const coords = points.map((p, i) => ({
    x: pad + stepX * i,
    y: pad + ((max - p.value) / range) * (h - pad * 2)
  }));

  // 渐变填充
  const grad = ctx.createLinearGradient(0, pad, 0, h - pad);
  grad.addColorStop(0, "rgba(31,111,235,0.22)");
  grad.addColorStop(1, "rgba(31,111,235,0)");
  ctx.beginPath();
  ctx.moveTo(coords[0].x, h - pad);
  coords.forEach((c) => ctx.lineTo(c.x, c.y));
  ctx.lineTo(coords[coords.length - 1].x, h - pad);
  ctx.closePath();
  ctx.fillStyle = grad;
  ctx.fill();

  ctx.strokeStyle = "#1f6feb";
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  coords.forEach((c, i) => (i === 0 ? ctx.moveTo(c.x, c.y) : ctx.lineTo(c.x, c.y)));
  ctx.stroke();

  coords.forEach((c) => {
    ctx.beginPath();
    ctx.fillStyle = "#ffffff";
    ctx.arc(c.x, c.y, 3.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#1f6feb";
    ctx.lineWidth = 2;
    ctx.stroke();
  });
}

// ---------- helpers ----------
function el(html) {
  const t = document.createElement("template");
  t.innerHTML = html.trim();
  return t.content.firstChild;
}
function decorateSegments(segments) {
  return segments.map((item) => {
    const categoryIndex = CATEGORIES.findIndex((c) => c.code === item.code);
    return {
      ...item,
      color: COLORS[categoryIndex >= 0 ? categoryIndex % COLORS.length : 0],
      valueText: formatDisplayMoney(item.value)
    };
  });
}
function decorateAssetSegments(segments) {
  return segments.map((item, index) => ({
    ...item,
    color: COLORS[index % COLORS.length],
    valueText: formatDisplayMoney(item.value)
  }));
}
function buildAssetSegments(assets = []) {
  const entries = assets.map((a) => ({
    code: a.id,
    name: a.name,
    amount: roundMoney(a.amount),
    currency: a.currency,
    value: roundMoney(a.valueCny)
  }));
  const chartTotal = entries.reduce(
    (sum, item) => roundMoney(sum + (item.value > 0 ? item.value : 0)),
    0
  );
  return entries
    .sort((a, b) => b.value - a.value)
    .map((item) => ({
      ...item,
      percent: chartTotal > 0 && item.value > 0 ? roundMoney((item.value / chartTotal) * 100) : 0
    }));
}
function buildStorageBreakdownMarkup(segments, options = {}) {
  const { dataAttr = "category", ariaPrefix = "查看", emptyText = "暂无数据", listAll = false } = options;
  const chartSegments = segments.filter((i) => i.value > 0);
  const listSegments = listAll ? segments : chartSegments;
  if (!listSegments.length) return `<div class="empty-small">${emptyText}</div>`;
  return `
    <div class="storage-bar" role="img" aria-label="占比条形图">
      ${chartSegments
        .map(
          (i) =>
            `<span class="storage-segment" style="width:${i.percent}%;background:${i.color}" title="${i.name} ${i.percent}%"></span>`
        )
        .join("")}
    </div>
    <div class="storage-legend">
      ${chartSegments
        .map(
          (i) =>
            `<span class="storage-legend-item"><span class="storage-legend-dot" style="background:${i.color}"></span>${i.name}</span>`
        )
        .join("")}
    </div>
    <div class="storage-list">
      ${listSegments
        .map(
          (i) =>
            `<div class="storage-row" data-${dataAttr}="${i.code}" role="button" tabindex="0" aria-label="${ariaPrefix}${i.name}">
              <div class="storage-row-main">
                <div class="storage-row-name">${i.name}<span class="storage-row-chevron" aria-hidden="true">›</span></div>
                <div class="muted storage-row-meta">${i.percent}%</div>
              </div>
              <div class="storage-row-value">${i.valueText}</div>
            </div>`
        )
        .join("")}
    </div>`;
}
function navigateAfterForm(options = {}) {
  const returnTab = options.returnTab || "assets";
  if (returnTab === "category") {
    const categoryCode = options.categoryCode || options.category;
    if (categoryCode) {
      renderCategoryDetail(categoryCode);
      return;
    }
  }
  switchTab(returnTab);
}
function pad2(v) {
  return String(v).padStart(2, "0");
}
function firstChar(value) {
  return String(value || "").trim().slice(0, 1) || "资";
}

function rerenderCurrentView() {
  if (view.querySelector(".form-page")) {
    const nav = activeFormNavigation || { returnTab: currentTab };
    if (editingId) openForm(editingId, nav);
    else openForm(null, nav);
    return;
  }
  if (activeCategoryCode) {
    renderCategoryDetail(activeCategoryCode);
    return;
  }
  const renderer = renderers[currentTab];
  if (renderer) renderer();
}

function openCurrencySheet() {
  closeOverlaySheet();
  const device = document.querySelector(".device");
  const overlay = document.createElement("div");
  overlay.className = "sheet-overlay";
  overlay.innerHTML = `
    <div class="action-sheet" role="dialog" aria-label="选择显示币种">
      <div class="sheet-handle"></div>
      <div class="sheet-title">选择显示币种</div>
      ${DISPLAY_CURRENCIES.map((code) => {
        const item = getCurrency(code);
        const active = code === displayCurrency ? " active" : "";
        return `<button class="sheet-option${active}" data-currency="${code}">
          <span>${item.name}</span>
          <span class="sheet-code">${code}</span>
        </button>`;
      }).join("")}
    </div>
  `;
  device.appendChild(overlay);
  requestAnimationFrame(() => overlay.classList.add("open"));

  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) closeOverlaySheet();
  });
  overlay.querySelectorAll("[data-currency]").forEach((btn) => {
    btn.onclick = () => {
      displayCurrency = btn.dataset.currency;
      setDisplayCurrency(displayCurrency);
      closeOverlaySheet();
      rerenderCurrentView();
    };
  });
}

function closeOverlaySheet() {
  document.querySelector(".sheet-overlay")?.remove();
}

function openGrowthSheet() {
  closeOverlaySheet();
  const device = document.querySelector(".device");
  const overlay = document.createElement("div");
  overlay.className = "sheet-overlay";
  overlay.innerHTML = `
    <div class="action-sheet" role="dialog" aria-label="选择增长指标">
      <div class="sheet-handle"></div>
      <div class="sheet-title">选择增长指标</div>
      ${GROWTH_METRICS.map((item) => {
        const active = item.code === growthMetric ? " active" : "";
        return `<button class="sheet-option${active}" data-growth-metric="${item.code}">
          <span>${item.label}</span>
        </button>`;
      }).join("")}
    </div>
  `;
  device.appendChild(overlay);
  requestAnimationFrame(() => overlay.classList.add("open"));

  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) closeOverlaySheet();
  });
  overlay.querySelectorAll("[data-growth-metric]").forEach((btn) => {
    btn.onclick = () => {
      growthMetric = btn.dataset.growthMetric;
      setGrowthMetric(growthMetric);
      closeOverlaySheet();
      if (currentTab === "dashboard") renderDashboard();
    };
  });
}

// ---------- views ----------
const view = document.getElementById("view");
const statusTitle = document.querySelector(".status-right");
let currentTab = "dashboard";
let editingId = null;
let activeCategoryCode = null;
let activeFormNavigation = null;
let displayCurrency = getDisplayCurrency();
let growthMetric = getGrowthMetric();
const TAB_TITLES = {
  dashboard: "资产总览",
  assets: "资产账户",
  trends: "资产趋势",
  settings: "数据设置"
};

function renderDashboard() {
  const assets = getAssets();
  recordSnapshotForAssets(assets);
  const snapshots = getSnapshots();
  const summary = summarizeAssets(assets);
  const categorySegments = decorateSegments(summary.categorySegments);
  const currencySegments = decorateSegments(summary.currencySegments);
  const trendPoints = buildTrendPoints(snapshots).slice(-8);
  const monthGrowth = calcMonthGrowth(snapshots, summary.totalValueCny);
  const growthDisplay = getGrowthDisplay(monthGrowth, growthMetric, displayCurrency);

  view.innerHTML = `
    <div class="hero-card">
      <div class="hero-sheen"></div>
      <div class="hero-body">
        <div class="hero-title">总资产</div>
        <div class="hero-metrics">
          <div class="total">
            <span class="total-amount">${formatDisplayAmount(summary.totalValueCny, displayCurrency)}</span>
            <button class="currency-trigger" data-act="openCurrencySheet" aria-label="切换显示币种">
              <span class="currency-code">${displayCurrency}</span>
              <span class="currency-chevron" aria-hidden="true">▾</span>
            </button>
          </div>
          <button class="hero-add-btn" data-act="create" aria-label="新增资产">+</button>
          <div class="hero-divider"></div>
          <button class="growth-trigger" data-act="openGrowthSheet" aria-label="切换增长指标">
            <span class="growth-label">${growthDisplay.label}</span>
            <span class="currency-chevron" aria-hidden="true">▾</span>
          </button>
          <span class="hero-growth-value ${growthDisplay.cls}">${growthDisplay.text}</span>
        </div>
      </div>
    </div>
    <div class="card trend-summary">
      <div class="section-header">
        <div>
          <div class="section-title">分类占比</div>
          <div class="section-subtitle">按当前显示币种折算后的资产结构</div>
        </div>
      </div>
      ${
        categorySegments.length
          ? buildStorageBreakdownMarkup(categorySegments, {
              dataAttr: "category",
              ariaPrefix: "查看",
              emptyText: "暂无资产数据"
            })
          : '<div class="empty-small">暂无资产数据</div>'
      }
    </div>
    <div class="card">
      <div class="section-title">币种分布</div>
      <div class="section-subtitle">查看外币敞口和人民币占比</div>
      ${currencySegments.length ? "" : '<div class="empty-small">暂无币种数据</div>'}
      ${currencySegments
        .map(
          (i) => `<div class="ratio-row">
            <div class="ratio-info"><span>${i.name}</span><span class="muted">${i.percent}%</span></div>
            <div class="ratio-track"><div class="ratio-bar" style="width:${i.percent}%;background:${i.color}"></div></div>
            <div class="ratio-value">${i.valueText}</div>
          </div>`
        )
        .join("")}
    </div>
    <div class="card">
      <div class="section-header">
        <div>
          <div class="section-title">资产趋势</div>
          <div class="section-subtitle">最近 ${trendPoints.length} 次快照</div>
        </div>
        <span class="link" data-act="goTrends">更多</span>
      </div>
      <canvas id="trend" class="chart"></canvas>
      ${trendPoints.length ? "" : '<div class="empty-small">新增资产后会自动记录趋势</div>'}
    </div>
  `;

  if (trendPoints.length) drawTrendChart(view.querySelector("#trend"), trendPoints);

  view.querySelector('[data-act="create"]').onclick = () => openForm(null, { returnTab: "dashboard" });
  view.querySelector('[data-act="goTrends"]').onclick = () => switchTab("trends");
  view.querySelector('[data-act="openCurrencySheet"]').onclick = openCurrencySheet;
  view.querySelector('[data-act="openGrowthSheet"]').onclick = openGrowthSheet;
  view.querySelectorAll(".storage-row[data-category]").forEach((row) => {
    row.onclick = () => openCategoryDetail(row.dataset.category);
  });
}

function renderCategoryDetail(categoryCode) {
  activeCategoryCode = categoryCode;
  const category = getCategory(categoryCode);
  const categoryIndex = CATEGORIES.findIndex((c) => c.code === categoryCode);
  const categoryColor = COLORS[categoryIndex >= 0 ? categoryIndex % COLORS.length : 0];
  const assets = getAssets()
    .filter((a) => a.category === categoryCode)
    .sort((a, b) => b.valueCny - a.valueCny);
  const totalCny = roundMoney(assets.reduce((sum, a) => roundMoney(sum + a.valueCny), 0));
  const assetSegments = decorateAssetSegments(buildAssetSegments(assets));

  currentTab = "dashboard";
  statusTitle.textContent = category.name;
  document.querySelectorAll(".tab-item").forEach((b) => b.classList.toggle("active", b.dataset.tab === "dashboard"));
  view.scrollTop = 0;

  view.innerHTML = `
    <div class="category-detail-page">
      <div class="category-detail-head">
        <button type="button" class="link category-detail-back" data-act="back">返回概览</button>
        <div class="category-detail-title">
          <span class="category-detail-dot" style="background:${categoryColor}"></span>
          <span class="title">${category.name}</span>
        </div>
        <div class="muted category-detail-meta">
          ${assets.length} 项 · 合计 ${formatDisplayMoney(totalCny)}
        </div>
      </div>
      <div class="card">
        <div class="section-header">
          <div>
            <div class="section-title">明细占比</div>
            <div class="section-subtitle">占比按当前显示币种折算</div>
          </div>
        </div>
        ${buildStorageBreakdownMarkup(assetSegments, {
          dataAttr: "asset-id",
          ariaPrefix: "编辑",
          emptyText: "该分类下暂无资产",
          listAll: true
        })}
      </div>
      <button type="button" class="btn button-primary category-detail-add" data-act="create">新增${category.name}</button>
    </div>
  `;

  view.querySelector('[data-act="back"]').onclick = () => switchTab("dashboard");
  view.querySelector('[data-act="create"]').onclick = () =>
    openForm(null, { returnTab: "category", categoryCode, category: categoryCode });
  view.querySelectorAll(".storage-row[data-asset-id]").forEach((row) => {
    row.onclick = () =>
      openForm(row.dataset.assetId, { returnTab: "category", categoryCode });
  });
}

function openCategoryDetail(categoryCode) {
  renderCategoryDetail(categoryCode);
}

function renderAssets() {
  const assets = getAssets().map((a) => ({
    ...a,
    categoryName: getCategory(a.category).name,
    displayValueText: formatDisplayMoney(a.valueCny),
    recurringText: formatRecurringSummary(a.recurring, a.currency)
  }));

  view.innerHTML = `
    <div class="asset-header">
      <div>
        <div class="title">资产账户</div>
        <div class="muted">维护股票、基金、黄金、现金、保险、公积金等资产</div>
      </div>
    </div>
    <button class="btn button-primary add-button" data-act="create" aria-label="新增资产">+</button>
    <div class="asset-list">
    ${
      assets.length
        ? ""
        : `<div class="card empty"><div>还没有资产记录</div>
            <button class="btn button-primary" style="margin-top:16px" data-act="create">添加第一笔资产</button></div>`
    }
    ${assets
      .map(
        (a, index) => `<div class="card asset-card ${index === 0 ? "trend-summary" : ""}" data-id="${a.id}">
          <div class="asset-top">
            <div class="asset-main">
              <div class="asset-badge">${firstChar(a.categoryName)}</div>
              <div>
                <div class="asset-name">${a.name}</div>
                <div class="muted">${a.categoryName} · ${a.currency}</div>
              </div>
            </div>
            <div class="asset-value">${a.displayValueText}</div>
          </div>
          ${a.recurringText ? `<div class="asset-meta"><span class="recurring-tag">${a.recurringText}</span></div>` : ""}
        </div>`
      )
      .join("")}
    </div>
  `;

  view.querySelectorAll('[data-act="create"]').forEach((b) => (b.onclick = () => openForm(null)));
  view.querySelectorAll(".asset-card").forEach((c) => (c.onclick = () => openForm(c.dataset.id)));
}

function openForm(id, options = {}) {
  const formNavigation = {
    returnTab: options.returnTab || "assets",
    categoryCode: options.categoryCode || options.category,
    category: options.category
  };
  const lockCategory = formNavigation.returnTab === "category" && formNavigation.categoryCode;
  activeFormNavigation = formNavigation;
  editingId = id;
  const asset = id ? getAssets().find((a) => a.id === id) : null;
  const recurring = asset?.recurring || { enabled: false, interval: "month", amount: 0 };
  const formCategory = lockCategory ? formNavigation.categoryCode : asset?.category || formNavigation.category || "cash";
  const form = asset
    ? { ...asset, category: formCategory }
    : {
        name: "",
        category: formCategory,
        currency: "CNY"
      };
  const formDisplayAmount = asset ? toDisplayAmount(asset.valueCny) : "";
  const recurringDisplayAmount = recurring.enabled
    ? toDisplayAmount(toCny(recurring.amount, getDefaultRate(form.currency)))
    : "";
  const categoryFieldHtml = lockCategory
    ? `<div class="field">
        <div class="label">资产分类</div>
        <div class="field-locked">${getCategory(formNavigation.categoryCode).name}</div>
      </div>`
    : `<div class="field"><div class="label">资产分类</div>
        <select id="f-category">${CATEGORIES.map(
          (c) => `<option value="${c.code}" ${c.code === form.category ? "selected" : ""}>${c.name}</option>`
        ).join("")}</select></div>`;

  view.innerHTML = `
    <div class="form-page">
      <div class="card form-card">
        <div class="form-card-head">
          <div>
            <div class="title">${id ? "编辑资产" : "新增资产"}</div>
          </div>
          <span class="link" data-act="back">返回</span>
        </div>
        <div class="field"><div class="label">资产名称</div>
          <input id="f-name" value="${form.name}" placeholder="例如：支付宝余额" /></div>
        ${categoryFieldHtml}
        <div class="field"><div class="label">币种</div>
          <select id="f-currency">${CURRENCIES.map(
            (c) => `<option value="${c.code}" ${c.code === form.currency ? "selected" : ""}>${c.name} ${c.code}</option>`
          ).join("")}</select></div>
        <div class="field"><div class="label">当前金额（${getActiveDisplayCurrency()}）</div>
          <input id="f-amount" type="number" value="${formDisplayAmount}" placeholder="0.00" /></div>
        <div class="recurring-section">
          <label class="recurring-toggle">
            <input type="checkbox" id="f-recurring-enabled" ${recurring.enabled ? "checked" : ""} />
            <span class="recurring-toggle-ui" aria-hidden="true"></span>
            <span class="recurring-toggle-label">定时增加</span>
          </label>
          <p class="recurring-hint">适合工资、公积金等固定入账，打开应用时按周期自动累加</p>
          <div class="recurring-fields" id="recurring-fields" ${recurring.enabled ? "" : "hidden"}>
            <div class="field"><div class="label">增加频率</div>
              <select id="f-recurring-interval">${RECURRING_INTERVALS.map(
                (i) =>
                  `<option value="${i.code}" ${i.code === recurring.interval ? "selected" : ""}>${i.label}</option>`
              ).join("")}</select></div>
            <div class="field"><div class="label">每次增加金额（${getActiveDisplayCurrency()}）</div>
              <input id="f-recurring-amount" type="number" value="${recurringDisplayAmount}" placeholder="0.00" /></div>
          </div>
        </div>
      </div>
      <div class="form-footer">
        <button type="button" class="btn button-primary save-button" data-act="save">保存资产</button>
        ${id ? '<button type="button" class="btn delete-button" data-act="delete">删除资产</button>' : ""}
      </div>
    </div>
  `;

  const recurringFields = view.querySelector("#recurring-fields");
  const recurringToggle = view.querySelector("#f-recurring-enabled");
  const recurringAmountInput = view.querySelector("#f-recurring-amount");
  const amountInput = view.querySelector("#f-amount");
  recurringToggle.onchange = () => {
    recurringFields.hidden = !recurringToggle.checked;
    if (recurringToggle.checked && !recurringAmountInput.value && amountInput.value) {
      recurringAmountInput.value = amountInput.value;
    }
  };

  view.querySelector('[data-act="back"]').onclick = () => navigateAfterForm(formNavigation);
  view.querySelector('[data-act="save"]').onclick = () => {
    const category = lockCategory
      ? formNavigation.categoryCode
      : view.querySelector("#f-category").value;
    const nativeCurrency = view.querySelector("#f-currency").value;
    const next = normalizeAsset({
      id: id || undefined,
      name: view.querySelector("#f-name").value,
      category,
      currency: nativeCurrency,
      amount: convertDisplayToNative(amountInput.value, getActiveDisplayCurrency(), nativeCurrency),
      recurring: readRecurringFromForm(view, nativeCurrency)
    });
    const err = validateAsset(next);
    if (err) {
      alert(err);
      return;
    }
    upsertAsset(next);
    navigateAfterForm(formNavigation);
  };
  const delBtn = view.querySelector('[data-act="delete"]');
  if (delBtn)
    delBtn.onclick = () => {
      if (confirm("删除后会更新资产快照，确定继续吗？")) {
        deleteAsset(id);
        navigateAfterForm(formNavigation);
      }
    };

  view.scrollTop = 0;
}

function renderTrends() {
  const snapshots = getSnapshots();
  const trendPoints = buildTrendPoints(snapshots);
  const latest = snapshots[snapshots.length - 1];
  const first = snapshots[0];
  const totalDelta = latest && first ? roundMoney(latest.totalValueCny - first.totalValueCny) : 0;
  const totalDeltaPrefix = totalDelta >= 0 ? "+" : "";
  const rows = snapshots
    .slice()
    .reverse()
    .map((s) => {
      const d = new Date(s.date);
      const prefix = s.deltaCny >= 0 ? "+" : "";
      return {
        dateText: `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`,
        totalText: formatDisplayMoney(s.totalValueCny),
        deltaText: `${prefix}${formatDisplayMoney(s.deltaCny)}`,
        deltaPercentText: `${prefix}${formatPercent(s.deltaPercent)}`,
        cls: s.deltaCny >= 0 ? "delta-up" : "delta-down"
      };
    });

  view.innerHTML = `
    <div class="asset-header">
      <div>
        <div class="title">资产趋势</div>
        <div class="muted">自动记录每次资产总额变化</div>
      </div>
    </div>
    <div class="card trend-summary">
      <div class="section-title">总资产变化</div>
      <div class="section-subtitle">历史快照形成的资产曲线</div>
      <canvas id="fullTrend" class="chart" style="height:240px"></canvas>
      ${trendPoints.length ? "" : '<div class="empty-small">暂无趋势数据</div>'}
      <div class="trend-meta">
        <div class="trend-meta-item">
          <div class="label">最新总额</div>
          <div class="value">${latest ? formatDisplayMoney(latest.totalValueCny) : "暂无"}</div>
        </div>
        <div class="trend-meta-item">
          <div class="label">累计变化</div>
          <div class="value">${latest ? `${totalDeltaPrefix}${formatDisplayMoney(totalDelta)}` : "暂无"}</div>
        </div>
      </div>
    </div>
    <div class="card">
      <div class="section-title">历史快照</div>
      ${rows.length ? "" : '<div class="empty-small">新增或修改资产后自动生成快照</div>'}
      ${rows
        .map(
          (r) => `<div class="snapshot-row">
            <div><div class="snapshot-date">${r.dateText}</div><div class="muted">${r.totalText}</div></div>
            <div class="${r.cls}"><div>${r.deltaText}</div><div class="delta-percent">${r.deltaPercentText}</div></div>
          </div>`
        )
        .join("")}
    </div>
  `;
  if (trendPoints.length) drawTrendChart(view.querySelector("#fullTrend"), trendPoints);
}

function renderSettings() {
  view.innerHTML = `
    <div class="settings">
      <div class="asset-header">
        <div>
          <div class="title">数据设置</div>
          <div class="muted">管理预览版本地数据</div>
        </div>
      </div>
      <div class="card">
        <div class="settings-title">数据备份</div>
        <div class="muted desc">预览版数据保存在浏览器 localStorage，建议定期导出备份。</div>
        <button class="btn button-primary save-button" data-act="export">导出到剪贴板</button>
      </div>
      <div class="card">
        <div class="settings-title">导入备份</div>
        <div class="muted desc">粘贴此前导出的 JSON，导入后会覆盖当前数据。</div>
        <textarea id="importText" placeholder="粘贴备份 JSON"></textarea>
        <button class="btn button-secondary save-button" data-act="import">导入数据</button>
      </div>
      <div class="card danger-card">
        <div class="settings-title">清空数据</div>
        <div class="muted desc">删除浏览器中保存的所有资产和历史快照。</div>
        <button class="btn danger-button" data-act="clear">清空数据</button>
      </div>
    </div>
  `;
  view.querySelector('[data-act="export"]').onclick = () => {
    const data = { version: 1, exportedAt: new Date().toISOString(), assets: getAssets(), snapshots: getSnapshots() };
    const text = JSON.stringify(data, null, 2);
    navigator.clipboard?.writeText(text).then(() => alert("已复制备份")).catch(() => alert(text));
  };
  view.querySelector('[data-act="import"]').onclick = () => {
    const raw = view.querySelector("#importText").value.trim();
    if (!raw) return alert("请先粘贴备份 JSON");
    try {
      const data = JSON.parse(raw);
      if (!Array.isArray(data.assets)) throw new Error("导入数据格式不正确");
      writeJson(ASSETS_KEY, data.assets.map((a) => normalizeAsset(a)));
      writeJson(SNAPSHOTS_KEY, Array.isArray(data.snapshots) ? data.snapshots : []);
      recordSnapshotForAssets(loadAssetsRaw());
      alert("导入成功");
      switchTab("dashboard");
    } catch (e) {
      alert(e.message || "导入失败");
    }
  };
  view.querySelector('[data-act="clear"]').onclick = () => {
    if (confirm("该操作无法撤销，确定清空数据吗？")) {
      clearAllData();
      seedIfEmpty();
      switchTab("dashboard");
    }
  };
}

// ---------- router ----------
const renderers = {
  dashboard: renderDashboard,
  assets: renderAssets,
  trends: renderTrends,
  settings: renderSettings
};

function switchTab(tab) {
  closeOverlaySheet();
  const renderer = renderers[tab];
  if (!renderer) {
    switchTab("dashboard");
    return;
  }
  currentTab = tab;
  statusTitle.textContent = TAB_TITLES[tab] || "资产总览";
  document.querySelectorAll(".tab-item").forEach((b) => b.classList.toggle("active", b.dataset.tab === tab));
  view.scrollTop = 0;
  renderers[tab]();
}

document.querySelectorAll(".tab-item").forEach((b) => {
  b.onclick = () => switchTab(b.dataset.tab);
});

migrateStoredDataIfNeeded();
seedIfEmpty();
switchTab("dashboard");
