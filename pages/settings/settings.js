const { exportData, importData, clearAllData } = require("../../utils/storage");

Page({
  data: {
    importText: ""
  },

  copyExportData() {
    const text = JSON.stringify(exportData(), null, 2);
    wx.setClipboardData({
      data: text,
      success: () => {
        wx.showToast({
          title: "已复制备份",
          icon: "success"
        });
      }
    });
  },

  onImportInput(event) {
    this.setData({
      importText: event.detail.value
    });
  },

  confirmImport() {
    if (!this.data.importText.trim()) {
      wx.showToast({
        title: "请先粘贴备份 JSON",
        icon: "none"
      });
      return;
    }

    wx.showModal({
      title: "导入数据",
      content: "导入会覆盖当前本地资产和快照，确定继续吗？",
      success: (res) => {
        if (res.confirm) {
          this.importBackup();
        }
      }
    });
  },

  importBackup() {
    try {
      importData(JSON.parse(this.data.importText));
      this.setData({ importText: "" });
      wx.showToast({
        title: "导入成功",
        icon: "success"
      });
    } catch (error) {
      wx.showToast({
        title: error.message || "导入失败",
        icon: "none"
      });
    }
  },

  confirmClear() {
    wx.showModal({
      title: "清空数据",
      content: "该操作无法撤销，确定清空本地资产数据吗？",
      confirmColor: "#e11d48",
      success: (res) => {
        if (res.confirm) {
          clearAllData();
          wx.showToast({
            title: "已清空",
            icon: "success"
          });
        }
      }
    });
  }
});
