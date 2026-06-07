const { getAssets, getSnapshots, recordSnapshotIfNeeded } = require("../../utils/storage");
const { COLORS, drawPieChart, drawTrendChart } = require("../../utils/chart");
const { formatMoney, formatPercent } = require("../../utils/currency");
const { summarizeAssets } = require("../../models/asset");
const { buildTrendPoints } = require("../../models/snapshot");

Page({
  data: {
    totalValueText: "CNY 0.00",
    latestDeltaText: "暂无变化记录",
    latestDeltaClass: "",
    categorySegments: [],
    currencySegments: [],
    trendPoints: []
  },

  onShow() {
    this.loadDashboard();
  },

  loadDashboard() {
    const assets = getAssets();
    recordSnapshotIfNeeded();
    const snapshots = getSnapshots();
    const summary = summarizeAssets(assets);
    const latestSnapshot = snapshots[snapshots.length - 1];

    const categorySegments = decorateSegments(summary.categorySegments);
    const currencySegments = decorateSegments(summary.currencySegments);
    const trendPoints = buildTrendPoints(snapshots).slice(-8);

    this.setData(
      {
        totalValueText: formatMoney(summary.totalValueCny),
        latestDeltaText: getDeltaText(latestSnapshot),
        latestDeltaClass: latestSnapshot && latestSnapshot.deltaCny >= 0 ? "positive" : "negative",
        categorySegments,
        currencySegments,
        trendPoints
      },
      () => {
        drawPieChart("categoryPie", categorySegments);
        drawTrendChart("trendChart", trendPoints);
      }
    );
  },

  goCreateAsset() {
    wx.navigateTo({
      url: "/pages/asset-form/asset-form"
    });
  },

  goAssets() {
    wx.switchTab({
      url: "/pages/assets/assets"
    });
  },

  goTrends() {
    wx.switchTab({
      url: "/pages/trends/trends"
    });
  }
});

function decorateSegments(segments) {
  return segments.map((item, index) => ({
    ...item,
    color: COLORS[index % COLORS.length],
    valueText: formatMoney(item.value)
  }));
}

function getDeltaText(snapshot) {
  if (!snapshot) {
    return "暂无变化记录";
  }

  const prefix = snapshot.deltaCny >= 0 ? "+" : "";
  return `较上次 ${prefix}${formatMoney(snapshot.deltaCny)} (${prefix}${formatPercent(snapshot.deltaPercent)})`;
}
