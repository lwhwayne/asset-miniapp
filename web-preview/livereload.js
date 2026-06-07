/*
 * 轻量热重载：轮询关键文件的 Last-Modified，发生变化时自动刷新页面。
 * 不依赖任何 npm 包，配合 python http.server 即可使用。
 */
(function () {
  var files = ["index.html", "preview.css", "preview.js", "livereload.js"];
  var signature = null;

  async function stamp() {
    var parts = [];
    for (var i = 0; i < files.length; i++) {
      try {
        var res = await fetch(files[i] + "?t=" + Date.now(), { method: "HEAD", cache: "no-store" });
        parts.push(res.headers.get("last-modified") || res.headers.get("etag") || "");
      } catch (e) {
        parts.push("err");
      }
    }
    return parts.join("|");
  }

  async function tick() {
    var current = await stamp();
    if (signature === null) {
      signature = current;
    } else if (current !== signature) {
      location.reload();
      return;
    }
    setTimeout(tick, 1000);
  }

  tick();
})();
