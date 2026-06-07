const CURRENCIES = [
  { code: "CNY", name: "人民币", defaultRate: 1 },
  { code: "HKD", name: "港币", defaultRate: 0.92 },
  { code: "USD", name: "美元", defaultRate: 7.2 },
  { code: "EUR", name: "欧元", defaultRate: 7.8 },
  { code: "JPY", name: "日元", defaultRate: 0.05 }
];

function getCurrency(code) {
  return CURRENCIES.find((item) => item.code === code) || CURRENCIES[0];
}

function getDefaultRate(code) {
  return getCurrency(code).defaultRate;
}

function toNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function roundMoney(value) {
  return Math.round(toNumber(value) * 100) / 100;
}

function toCny(amount, exchangeRateToCny) {
  return roundMoney(toNumber(amount) * toNumber(exchangeRateToCny, 1));
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

module.exports = {
  CURRENCIES,
  getCurrency,
  getDefaultRate,
  toNumber,
  roundMoney,
  toCny,
  formatMoney,
  formatPercent
};
