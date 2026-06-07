const COLORS = ["#1f6feb", "#22c55e", "#f97316", "#a855f7", "#14b8a6", "#ef4444", "#64748b"];

function drawPieChart(canvasId, segments = [], options = {}) {
  const ctx = wx.createCanvasContext(canvasId);
  const width = options.width || 320;
  const height = options.height || 220;
  const radius = options.radius || 78;
  const centerX = width / 2;
  const centerY = height / 2;
  const total = segments.reduce((sum, item) => sum + item.value, 0);
  let startAngle = -Math.PI / 2;

  ctx.clearRect(0, 0, width, height);

  if (!total) {
    ctx.setFillStyle("#e5e7eb");
    ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.draw();
    return;
  }

  segments.forEach((segment, index) => {
    const angle = (segment.value / total) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(centerX, centerY);
    ctx.setFillStyle(COLORS[index % COLORS.length]);
    ctx.arc(centerX, centerY, radius, startAngle, startAngle + angle);
    ctx.closePath();
    ctx.fill();
    startAngle += angle;
  });

  ctx.beginPath();
  ctx.setFillStyle("#ffffff");
  ctx.arc(centerX, centerY, radius * 0.55, 0, Math.PI * 2);
  ctx.fill();
  ctx.draw();
}

function drawTrendChart(canvasId, points = [], options = {}) {
  const ctx = wx.createCanvasContext(canvasId);
  const width = options.width || 320;
  const height = options.height || 220;
  const padding = 32;
  const values = points.map((point) => point.value);
  const maxValue = Math.max.apply(null, values.concat([1]));
  const minValue = Math.min.apply(null, values.concat([0]));
  const range = maxValue - minValue || 1;

  ctx.clearRect(0, 0, width, height);
  ctx.setStrokeStyle("#e5e7eb");
  ctx.setLineWidth(1);
  ctx.beginPath();
  ctx.moveTo(padding, height - padding);
  ctx.lineTo(width - padding, height - padding);
  ctx.stroke();

  if (!points.length) {
    ctx.draw();
    return;
  }

  const stepX = points.length > 1 ? (width - padding * 2) / (points.length - 1) : 0;
  const coords = points.map((point, index) => ({
    x: padding + stepX * index,
    y: padding + ((maxValue - point.value) / range) * (height - padding * 2)
  }));

  ctx.setStrokeStyle("#1f6feb");
  ctx.setLineWidth(3);
  ctx.beginPath();
  coords.forEach((coord, index) => {
    if (index === 0) {
      ctx.moveTo(coord.x, coord.y);
    } else {
      ctx.lineTo(coord.x, coord.y);
    }
  });
  ctx.stroke();

  coords.forEach((coord) => {
    ctx.beginPath();
    ctx.setFillStyle("#ffffff");
    ctx.arc(coord.x, coord.y, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.setStrokeStyle("#1f6feb");
    ctx.stroke();
  });

  ctx.draw();
}

module.exports = {
  COLORS,
  drawPieChart,
  drawTrendChart
};
