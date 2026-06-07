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

// ---------- asset model ----------
const CATEGORIES = [
  { code: "cash", name: "现金" },
  { code: "payment", name: "支付账户" },
  { code: "brokerage", name: "证券" },
  { code: "fund", name: "基金" },
  { code: "insurance", name: "保险" },
  { code: "other", name: "其他" }
];
const COLORS = ["#155eef", "#16a34a", "#f59e0b", "#8b5cf6", "#0ea5e9", "#ef4444", "#64748b"];

function createId(prefix = "asset") {
  return `${prefix}_${Date.now()}_${Math.floor(Math.random() * 100000)}`;
}
function getCategory(code) {
  return CATEGORIES.find((c) => c.code === code) || CATEGORIES[CATEGORIES.length - 1];
}
function normalizeAsset(input = {}) {
  const now = new Date().toISOString();
  const currency = input.currency || "CNY";
  const rate = toNumber(input.exchangeRateToCny, getDefaultRate(currency));
  const amount = roundMoney(input.amount);
  return {
    id: input.id || createId(),
    name: String(input.name || "").trim(),
    category: input.category || "other",
    currency,
    amount,
    exchangeRateToCny: rate,
    valueCny: toCny(amount, rate),
    updatedAt: input.updatedAt || now,
    note: String(input.note || "").trim()
  };
}
function validateAsset(asset) {
  if (!asset.name) return "请输入资产名称";
  if (asset.amount < 0) return "资产金额不能小于 0";
  if (asset.exchangeRateToCny <= 0) return "汇率必须大于 0";
  return "";
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
function getAssets() {
  return readJson(ASSETS_KEY, []).map((a) => normalizeAsset(a));
}
function getSnapshots() {
  return readJson(SNAPSHOTS_KEY, []);
}
function recordSnapshotIfNeeded() {
  const assets = getAssets();
  const snapshots = getSnapshots();
  const latest = snapshots[snapshots.length - 1];
  if (!shouldCreateSnapshot(assets, latest)) return;
  const snapshot = createSnapshot(assets, latest);
  writeJson(SNAPSHOTS_KEY, snapshots.concat(snapshot).slice(-120));
}
function saveAssets(assets) {
  writeJson(ASSETS_KEY, assets.map((a) => normalizeAsset(a)));
  recordSnapshotIfNeeded();
}
function upsertAsset(input) {
  const next = normalizeAsset({ ...input, updatedAt: new Date().toISOString() });
  const assets = getAssets();
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

// ---------- seed sample data on first run ----------
function seedIfEmpty() {
  if (readJson(ASSETS_KEY, null)) return;
  const sample = [
    { name: "支付宝余额", category: "payment", currency: "CNY", amount: 18650, exchangeRateToCny: 1 },
    { name: "现金港币", category: "cash", currency: "HKD", amount: 42000, exchangeRateToCny: 0.92 },
    { name: "富途港股账户", category: "brokerage", currency: "HKD", amount: 86000, exchangeRateToCny: 0.92 },
    { name: "招商银行活期", category: "cash", currency: "CNY", amount: 32000, exchangeRateToCny: 1 },
    { name: "重疾险现金价值", category: "insurance", currency: "CNY", amount: 26000, exchangeRateToCny: 1 }
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
function drawPieChart(canvas, segments) {
  const ctx = canvas.getContext("2d");
  const dpr = window.devicePixelRatio || 1;
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, w, h);

  const cx = w / 2;
  const cy = h / 2;
  const radius = Math.min(w, h) / 2 - 12;
  const total = segments.reduce((s, i) => s + i.value, 0);

  if (!total) {
    ctx.fillStyle = "#e5e7eb";
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fill();
    return;
  }

  let start = -Math.PI / 2;
  segments.forEach((seg, i) => {
    const angle = (seg.value / total) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.fillStyle = COLORS[i % COLORS.length];
    ctx.arc(cx, cy, radius, start, start + angle);
    ctx.closePath();
    ctx.fill();
    start += angle;
  });
  ctx.beginPath();
  ctx.fillStyle = "#ffffff";
  ctx.arc(cx, cy, radius * 0.58, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#1f2937";
  ctx.font = "600 14px -apple-system, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("分类", cx, cy - 8);
  ctx.fillStyle = "#7a8499";
  ctx.font = "12px -apple-system, sans-serif";
  ctx.fillText(`${segments.length} 类`, cx, cy + 10);
}

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
  return segments.map((item, i) => ({
    ...item,
    color: COLORS[i % COLORS.length],
    valueText: formatMoney(item.value)
  }));
}
function pad2(v) {
  return String(v).padStart(2, "0");
}
function firstChar(value) {
  return String(value || "").trim().slice(0, 1) || "资";
}

// ---------- views ----------
const view = document.getElementById("view");
const statusTitle = document.querySelector(".status-right");
let currentTab = "dashboard";
let editingId = null;
const TAB_TITLES = {
  dashboard: "资产总览",
  assets: "资产账户",
  trends: "资产趋势",
  settings: "数据设置"
};

function renderDashboard() {
  recordSnapshotIfNeeded();
  const assets = getAssets();
  const snapshots = getSnapshots();
  const summary = summarizeAssets(assets);
  const latest = snapshots[snapshots.length - 1];
  const categorySegments = decorateSegments(summary.categorySegments);
  const currencySegments = decorateSegments(summary.currencySegments);
  const trendPoints = buildTrendPoints(snapshots).slice(-8);
  const topCategory = categorySegments[0];
  const topCurrency = currencySegments[0];

  let deltaText = "暂无变化记录";
  if (latest) {
    const prefix = latest.deltaCny >= 0 ? "+" : "";
    deltaText = `较上次 ${prefix}${formatMoney(latest.deltaCny)} (${prefix}${formatPercent(latest.deltaPercent)})`;
  }

  view.innerHTML = `
    <div class="hero-card">
      <div class="hero-top">
        <div>
          <div class="hero-title">总资产</div>
        </div>
        <div class="hero-pill">${assets.length} 个账户</div>
      </div>
      <div class="total">${formatMoney(summary.totalValueCny)}</div>
      <div class="delta">${deltaText}</div>
      <div class="hero-stat-grid">
        <div class="hero-stat">
          <div class="label">主力分类</div>
          <div class="value">${topCategory ? topCategory.name : "暂无"}</div>
        </div>
        <div class="hero-stat">
          <div class="label">主币种</div>
          <div class="value">${topCurrency ? topCurrency.name : "暂无"}</div>
        </div>
        <div class="hero-stat">
          <div class="label">快照</div>
          <div class="value">${snapshots.length} 条</div>
        </div>
      </div>
    </div>
    <div class="quick-actions">
      <button class="btn button-primary" data-act="create">+ 新增资产</button>
      <button class="btn button-secondary" data-act="goAssets">查看明细</button>
    </div>
    <div class="card trend-summary">
      <div class="section-header">
        <div>
          <div class="section-title">分类占比</div>
          <div class="section-subtitle">按人民币折算后的资产结构</div>
        </div>
      </div>
      <canvas id="pie" class="chart"></canvas>
      ${categorySegments.length ? "" : '<div class="empty-small">暂无资产数据</div>'}
      ${categorySegments
        .map(
          (i) => `<div class="legend-row">
            <div class="legend-left"><span class="legend-dot" style="background:${i.color}"></span>${i.name}</div>
            <span>${i.percent}% · ${i.valueText}</span>
          </div>`
        )
        .join("")}
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

  if (categorySegments.length) drawPieChart(view.querySelector("#pie"), categorySegments);
  if (trendPoints.length) drawTrendChart(view.querySelector("#trend"), trendPoints);

  view.querySelector('[data-act="create"]').onclick = () => openForm(null);
  view.querySelector('[data-act="goAssets"]').onclick = () => switchTab("assets");
  view.querySelector('[data-act="goTrends"]').onclick = () => switchTab("trends");
}

function renderAssets() {
  const assets = getAssets().map((a) => ({
    ...a,
    categoryName: getCategory(a.category).name,
    amountText: formatMoney(a.amount, a.currency),
    valueCnyText: formatMoney(a.valueCny)
  }));

  view.innerHTML = `
    <div class="asset-header">
      <div>
        <div class="title">资产账户</div>
        <div class="muted">维护支付宝、现金、券商、保险等资产</div>
      </div>
    </div>
    <button class="btn button-primary add-button" data-act="create" aria-label="新增资产">+</button>
    <div class="asset-list">
    ${
      assets.length
        ? ""
        : `<div class="card empty"><div>还没有资产记录</div>
            <button class="btn button-primary" style="margin-top:14px" data-act="create">添加第一笔资产</button></div>`
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
            <div class="asset-value">${a.valueCnyText}</div>
          </div>
          <div class="asset-meta"><span>${a.amountText}</span><span>汇率 ${a.exchangeRateToCny}</span></div>
          ${a.note ? `<div class="asset-note">${a.note}</div>` : ""}
        </div>`
      )
      .join("")}
    </div>
  `;

  view.querySelectorAll('[data-act="create"]').forEach((b) => (b.onclick = () => openForm(null)));
  view.querySelectorAll(".asset-card").forEach((c) => (c.onclick = () => openForm(c.dataset.id)));
}

function openForm(id) {
  editingId = id;
  const asset = id ? getAssets().find((a) => a.id === id) : null;
  const form = asset || { name: "", category: "cash", currency: "CNY", amount: "", exchangeRateToCny: 1, note: "" };

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
        <div class="field"><div class="label">资产分类</div>
          <select id="f-category">${CATEGORIES.map(
            (c) => `<option value="${c.code}" ${c.code === form.category ? "selected" : ""}>${c.name}</option>`
          ).join("")}</select></div>
        <div class="field"><div class="label">币种</div>
          <select id="f-currency">${CURRENCIES.map(
            (c) => `<option value="${c.code}" ${c.code === form.currency ? "selected" : ""}>${c.name} ${c.code}</option>`
          ).join("")}</select></div>
        <div class="field"><div class="label">原币金额</div>
          <input id="f-amount" type="number" value="${form.amount}" placeholder="0.00" /></div>
        <div class="field"><div class="label">兑人民币汇率</div>
          <input id="f-rate" type="number" value="${form.exchangeRateToCny}" placeholder="1.00" /></div>
        <div class="field"><div class="label">备注</div>
          <textarea id="f-note" placeholder="可记录账户说明或保单信息">${form.note}</textarea></div>
      </div>
      <button class="btn button-primary save-button" data-act="save">保存资产</button>
      ${id ? '<button class="btn delete-button" data-act="delete">删除资产</button>' : ""}
    </div>
  `;

  view.querySelector('[data-act="back"]').onclick = () => switchTab("assets");
  view.querySelector("#f-currency").onchange = (e) => {
    view.querySelector("#f-rate").value = getDefaultRate(e.target.value);
  };
  view.querySelector('[data-act="save"]').onclick = () => {
    const next = normalizeAsset({
      id: id || undefined,
      name: view.querySelector("#f-name").value,
      category: view.querySelector("#f-category").value,
      currency: view.querySelector("#f-currency").value,
      amount: view.querySelector("#f-amount").value,
      exchangeRateToCny: view.querySelector("#f-rate").value,
      note: view.querySelector("#f-note").value
    });
    const err = validateAsset(next);
    if (err) {
      alert(err);
      return;
    }
    upsertAsset(next);
    switchTab("assets");
  };
  const delBtn = view.querySelector('[data-act="delete"]');
  if (delBtn)
    delBtn.onclick = () => {
      if (confirm("删除后会更新资产快照，确定继续吗？")) {
        deleteAsset(id);
        switchTab("assets");
      }
    };
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
        totalText: formatMoney(s.totalValueCny),
        deltaText: `${prefix}${formatMoney(s.deltaCny)}`,
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
          <div class="value">${latest ? formatMoney(latest.totalValueCny) : "暂无"}</div>
        </div>
        <div class="trend-meta-item">
          <div class="label">累计变化</div>
          <div class="value">${latest ? `${totalDeltaPrefix}${formatMoney(totalDelta)}` : "暂无"}</div>
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
      recordSnapshotIfNeeded();
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
  currentTab = tab;
  statusTitle.textContent = TAB_TITLES[tab] || "资产总览";
  document.querySelectorAll(".tab-item").forEach((b) => b.classList.toggle("active", b.dataset.tab === tab));
  view.scrollTop = 0;
  renderers[tab]();
}

document.querySelectorAll(".tab-item").forEach((b) => {
  b.onclick = () => switchTab(b.dataset.tab);
});

seedIfEmpty();
switchTab("dashboard");
