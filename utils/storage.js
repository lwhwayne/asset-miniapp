const { normalizeAsset } = require("../models/asset");
const { createSnapshot, shouldCreateSnapshot } = require("../models/snapshot");

const ASSETS_KEY = "asset-miniapp.assets";
const SNAPSHOTS_KEY = "asset-miniapp.snapshots";

function readJson(key, fallback) {
  try {
    const value = wx.getStorageSync(key);
    return value || fallback;
  } catch (error) {
    return fallback;
  }
}

function writeJson(key, value) {
  wx.setStorageSync(key, value);
}

function getAssets() {
  return readJson(ASSETS_KEY, []).map((asset) => normalizeAsset(asset));
}

function saveAssets(assets) {
  writeJson(ASSETS_KEY, assets.map((asset) => normalizeAsset(asset)));
  recordSnapshotIfNeeded();
}

function getAssetById(id) {
  return getAssets().find((asset) => asset.id === id);
}

function upsertAsset(input) {
  const nextAsset = normalizeAsset({
    ...input,
    updatedAt: new Date().toISOString()
  });
  const assets = getAssets();
  const index = assets.findIndex((asset) => asset.id === nextAsset.id);

  if (index >= 0) {
    assets[index] = nextAsset;
  } else {
    assets.unshift(nextAsset);
  }

  saveAssets(assets);
  return nextAsset;
}

function deleteAsset(id) {
  saveAssets(getAssets().filter((asset) => asset.id !== id));
}

function getSnapshots() {
  return readJson(SNAPSHOTS_KEY, []);
}

function saveSnapshots(snapshots) {
  writeJson(SNAPSHOTS_KEY, snapshots);
}

function recordSnapshotIfNeeded() {
  const assets = getAssets();
  const snapshots = getSnapshots();
  const latestSnapshot = snapshots[snapshots.length - 1];

  if (!shouldCreateSnapshot(assets, latestSnapshot)) {
    return latestSnapshot;
  }

  const snapshot = createSnapshot(assets, latestSnapshot);
  const nextSnapshots = snapshots.concat(snapshot).slice(-120);
  saveSnapshots(nextSnapshots);
  return snapshot;
}

function exportData() {
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    assets: getAssets(),
    snapshots: getSnapshots()
  };
}

function importData(data) {
  if (!data || !Array.isArray(data.assets)) {
    throw new Error("导入数据格式不正确");
  }

  const assets = data.assets.map((asset) => normalizeAsset(asset));
  const snapshots = Array.isArray(data.snapshots) ? data.snapshots : [];
  writeJson(ASSETS_KEY, assets);
  writeJson(SNAPSHOTS_KEY, snapshots);
  recordSnapshotIfNeeded();
}

function clearAllData() {
  wx.removeStorageSync(ASSETS_KEY);
  wx.removeStorageSync(SNAPSHOTS_KEY);
}

module.exports = {
  getAssets,
  saveAssets,
  getAssetById,
  upsertAsset,
  deleteAsset,
  getSnapshots,
  saveSnapshots,
  recordSnapshotIfNeeded,
  exportData,
  importData,
  clearAllData
};
