const { getDefaultRate, roundMoney, toCny, toNumber } = require("../utils/currency");

const CATEGORIES = [
  { code: "cash", name: "现金" },
  { code: "payment", name: "支付账户" },
  { code: "brokerage", name: "证券" },
  { code: "fund", name: "基金" },
  { code: "insurance", name: "保险" },
  { code: "other", name: "其他" }
];

function createId(prefix = "asset") {
  return `${prefix}_${Date.now()}_${Math.floor(Math.random() * 100000)}`;
}

function getCategory(code) {
  return CATEGORIES.find((item) => item.code === code) || CATEGORIES[CATEGORIES.length - 1];
}

function normalizeAsset(input = {}) {
  const now = new Date().toISOString();
  const currency = input.currency || "CNY";
  const exchangeRateToCny = toNumber(input.exchangeRateToCny, getDefaultRate(currency));
  const amount = roundMoney(input.amount);

  return {
    id: input.id || createId(),
    name: String(input.name || "").trim(),
    category: input.category || "other",
    currency,
    amount,
    exchangeRateToCny,
    valueCny: toCny(amount, exchangeRateToCny),
    updatedAt: input.updatedAt || now,
    note: String(input.note || "").trim()
  };
}

function validateAsset(asset) {
  if (!asset.name) {
    return "请输入资产名称";
  }

  if (asset.amount < 0) {
    return "资产金额不能小于 0";
  }

  if (asset.exchangeRateToCny <= 0) {
    return "汇率必须大于 0";
  }

  return "";
}

function summarizeAssets(assets = []) {
  const summary = assets.reduce(
    (result, asset) => {
      const value = roundMoney(asset.valueCny);
      result.totalValueCny = roundMoney(result.totalValueCny + value);
      result.categoryValues[asset.category] = roundMoney((result.categoryValues[asset.category] || 0) + value);
      result.currencyValues[asset.currency] = roundMoney((result.currencyValues[asset.currency] || 0) + value);
      return result;
    },
    {
      totalValueCny: 0,
      categoryValues: {},
      currencyValues: {}
    }
  );

  return {
    ...summary,
    categorySegments: buildSegments(summary.categoryValues, CATEGORIES),
    currencySegments: buildSegments(summary.currencyValues)
  };
}

function buildSegments(values, labels) {
  const entries = Object.keys(values).map((code) => {
    const label = labels ? getCategory(code).name : code;
    return {
      code,
      name: label,
      value: roundMoney(values[code])
    };
  });
  const total = entries.reduce((sum, item) => roundMoney(sum + item.value), 0);

  return entries
    .filter((item) => item.value > 0)
    .sort((a, b) => b.value - a.value)
    .map((item) => ({
      ...item,
      percent: total > 0 ? roundMoney((item.value / total) * 100) : 0
    }));
}

module.exports = {
  CATEGORIES,
  createId,
  getCategory,
  normalizeAsset,
  validateAsset,
  summarizeAssets,
  buildSegments
};
