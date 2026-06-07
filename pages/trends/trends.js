const { getSnapshots } = require("../../utils/storage");
const { drawTrendChart } = require("../../utils/chart");
const { formatMoney, formatPercent } = require("../../utils/currency");
const { buildTrendPoints } = require("../../models/snapshot");

Page({
  data: {
    snapshots: [],
    trendPoints: []
  },

  onShow() {
    this.loadTrends();
  },

  loadTrends() {
    const snapshots = getSnapshots();
    const trendPoints = buildTrendPoints(snapshots);
    const displaySnapshots = snapshots
      .slice()
      .reverse()
      .map((snapshot) => {
        const date = new Date(snapshot.date);
        const prefix = snapshot.deltaCny >= 0 ? "+" : "";
        return {
          ...snapshot,
          dateText: `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()} ${pad(date.getHours())}:${pad(date.getMinutes())}`,
          totalText: formatMoney(snapshot.totalValueCny),
          deltaText: `${prefix}${formatMoney(snapshot.deltaCny)}`,
          deltaPercentText: `${prefix}${formatPercent(snapshot.deltaPercent)}`,
          deltaClass: snapshot.deltaCny >= 0 ? "delta-up" : "delta-down"
        };
      });

    this.setData(
      {
        snapshots: displaySnapshots,
        trendPoints
      },
      () => drawTrendChart("fullTrendChart", trendPoints)
    );
  }
});

function pad(value) {
  return String(value).padStart(2, "0");
}
