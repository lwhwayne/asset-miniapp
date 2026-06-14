# 资产小程序 · 网页预览版

这是个人资产管理小程序的**网页预览版**，用于在浏览器里快速迭代 UI，所见即所得。
它不是最终产品：真正的小程序界面在项目的 `pages/` 目录下。这里只用于把界面调到满意，
之后再统一翻译成小程序格式（`.wxml` / `.wxss`）。

## 当前工作约定

- 现阶段**只改 `web-preview/` 下的文件**，先不要同步到小程序。
- UI 定稿后，再统一回写到 `pages/` 下各页面。

## 启动预览

预览用 Python 自带的静态服务器，无需安装任何依赖：

```bash
cd /Users/loboluo/asset-miniapp/web-preview && nohup python3 -m http.server 5050 --bind 127.0.0.1 > /tmp/asset-preview-py.log 2>&1 &
```

然后在浏览器（或 Cursor 内置浏览器）打开：

```
http://127.0.0.1:5050/index.html
```

保存 `web-preview/` 下任意文件后，页面会在 1 秒内自动刷新（仅本地预览）。

## 在线预览（GitHub Pages）

推送 `web-preview/` 后，GitHub Actions 会把内容发布到 `gh-pages` 分支。

### 第一次启用（按顺序做）

1. 打开 https://github.com/lwhwayne/asset-miniapp/settings/pages
2. **Build and deployment → Source** 选 **Deploy from a branch**
3. **Branch** 选 `gh-pages`，文件夹选 **/ (root)**，点 Save
4. 打开 https://github.com/lwhwayne/asset-miniapp/actions
5. 左侧选 **Deploy web preview to GitHub Pages**，点 **Run workflow** → Run workflow
6. 等约 1–2 分钟，看到绿色勾后再访问下方链接

若还没有 `gh-pages` 分支，先完成第 5 步跑一遍 workflow，分支会自动创建。

### 访问地址

```
https://lwhwayne.github.io/asset-miniapp/
```

### 常见问题

- **404**：Pages 源未设为 `gh-pages`，或 workflow 还没跑成功
- **私有仓库**：Settings → Pages → 把可见性设为 **Public**（免费账号私有仓需先公开 Pages 或升级套餐）
- **更新不生效**：push 代码后等 Actions 跑完，浏览器强制刷新

## 文件说明

| 文件 | 作用 |
| --- | --- |
| `index.html` | 手机外壳 + 底部四个标签（总览 / 资产 / 趋势 / 设置） |
| `preview.css` | 全部样式；设计 token（颜色、圆角等）在文件顶部的 `:root` |
| `preview.js` | 四个页面的渲染、资产表单、图表（饼图 / 趋势折线），数据存浏览器 `localStorage` |
| `livereload.js` | 轮询文件变化并自动刷新，**不要改动** |

## 数据说明

- 预览数据保存在浏览器 `localStorage`，和真实小程序的缓存相互独立。
- 首次打开会写入一份示例数据（支付宝、港币现金、富途、招行、保险）。
- 在「设置」页可以导出 / 导入 / 清空数据。

## 与小程序的对应关系（定稿后转换时参考）

| 网页 | 小程序 |
| --- | --- |
| `div` | `view` |
| 文本 / `span` | `text` |
| `select` | `picker` |
| `onclick` | `bindtap` |
| `oninput` | `bindinput` |
| `px`（设计宽 750） | `rpx`，约 `1px → 2rpx` |
| 浏览器 `canvas` | `wx.createCanvasContext`（见 `utils/chart.js`） |
| `localStorage` | `wx.setStorageSync`（见 `utils/storage.js`） |

真实小程序页面：`pages/dashboard`、`pages/assets`、`pages/asset-form`、`pages/trends`、`pages/settings`；
核心逻辑：`models/`、`utils/`（预览版逻辑是它们的浏览器移植）。
