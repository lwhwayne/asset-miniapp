const { CURRENCIES, getDefaultRate } = require("../../utils/currency");
const { getAssetById, upsertAsset, deleteAsset } = require("../../utils/storage");
const { CATEGORIES, normalizeAsset, validateAsset } = require("../../models/asset");

const defaultForm = {
  id: "",
  name: "",
  category: "cash",
  currency: "CNY",
  amount: "",
  exchangeRateToCny: 1,
  note: ""
};

Page({
  data: {
    form: { ...defaultForm },
    categories: CATEGORIES,
    currencies: CURRENCIES,
    categoryNames: CATEGORIES.map((item) => item.name),
    currencyNames: CURRENCIES.map((item) => `${item.name} ${item.code}`),
    categoryIndex: 0,
    currencyIndex: 0
  },

  onLoad(options) {
    if (options.id) {
      const asset = getAssetById(options.id);
      if (asset) {
        this.setForm(asset);
      }
    }
  },

  setForm(form) {
    const categoryIndex = Math.max(0, CATEGORIES.findIndex((item) => item.code === form.category));
    const currencyIndex = Math.max(0, CURRENCIES.findIndex((item) => item.code === form.currency));

    this.setData({
      form: {
        ...form,
        amount: String(form.amount),
        exchangeRateToCny: String(form.exchangeRateToCny)
      },
      categoryIndex,
      currencyIndex
    });
  },

  onInput(event) {
    const field = event.currentTarget.dataset.field;
    this.setData({
      [`form.${field}`]: event.detail.value
    });
  },

  onCategoryChange(event) {
    const categoryIndex = Number(event.detail.value);
    this.setData({
      categoryIndex,
      "form.category": CATEGORIES[categoryIndex].code
    });
  },

  onCurrencyChange(event) {
    const currencyIndex = Number(event.detail.value);
    const currency = CURRENCIES[currencyIndex].code;
    this.setData({
      currencyIndex,
      "form.currency": currency,
      "form.exchangeRateToCny": String(getDefaultRate(currency))
    });
  },

  saveAsset() {
    const asset = normalizeAsset(this.data.form);
    const error = validateAsset(asset);

    if (error) {
      wx.showToast({
        title: error,
        icon: "none"
      });
      return;
    }

    upsertAsset(asset);
    wx.showToast({
      title: "已保存",
      icon: "success"
    });
    wx.navigateBack();
  },

  confirmDelete() {
    wx.showModal({
      title: "删除资产",
      content: "删除后会更新资产快照，确定继续吗？",
      confirmColor: "#e11d48",
      success: (res) => {
        if (res.confirm) {
          deleteAsset(this.data.form.id);
          wx.navigateBack();
        }
      }
    });
  }
});
