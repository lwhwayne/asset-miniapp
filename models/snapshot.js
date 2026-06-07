const { roundMoney } = require("../utils/currency");
const { createId, summarizeAssets } = require("./asset");

function createSnapshot(assets = [], previousSnapshot) {
  const summary = summarizeAssets(assets);
  const previousTotal = previousSnapshot ? previousSnapshot.totalValueCny : 0;
  const deltaCny = roundMoney(summary.totalValueCny - previousTotal);

  return {
    id: createId("snapshot"),
    date: new Date().toISOString(),
    totalValueCny: summary.totalValueCny,
    categoryValues: summary.categoryValues,
    currencyValues: summary.currencyValues,
    deltaCny,
    deltaPercent: previousTotal > 0 ? roundMoney((deltaCny / previousTotal) * 100) : 0
  };
}

function shouldCreateSnapshot(assets = [], latestSnapshot) {
  if (!assets.length) {
    return false;
  }

  if (!latestSnapshot) {
    return true;
  }

  const summary = summarizeAssets(assets);
  return summary.totalValueCny !== latestSnapshot.totalValueCny;
}

function buildTrendPoints(snapshots = []) {
  return snapshots
    .slice()
    .sort((a, b) => new Date(a.date) - new Date(b.date))
    .map((snapshot) => {
      const date = new Date(snapshot.date);
      return {
        id: snapshot.id,
        label: `${date.getMonth() + 1}/${date.getDate()}`,
        value: snapshot.totalValueCny,
        deltaCny: snapshot.deltaCny,
        deltaPercent: snapshot.deltaPercent
      };
    });
}

module.exports = {
  createSnapshot,
  shouldCreateSnapshot,
  buildTrendPoints
};
