const { getAssets } = require("../../utils/storage");
const { formatMoney } = require("../../utils/currency");
const { getCategory } = require("../../models/asset");

Page({
  data: {
    assets: []
  },

  onShow() {
    this.loadAssets();
  },

  loadAssets() {
    const assets = getAssets().map((asset) => ({
      ...asset,
      categoryName: getCategory(asset.category).name,
      amountText: formatMoney(asset.amount, asset.currency),
      valueCnyText: formatMoney(asset.valueCny)
    }));

    this.setData({ assets });
  },

  goCreate() {
    wx.navigateTo({
      url: "/pages/asset-form/asset-form"
    });
  },

  goEdit(event) {
    const id = event.currentTarget.dataset.id;
    wx.navigateTo({
      url: `/pages/asset-form/asset-form?id=${id}`
    });
  }
});
