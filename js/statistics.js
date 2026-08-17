/* ============================================================
   statistics.js
   ------------------------------------------------------------
   Small canvas-based chart helpers. We draw our own simple bar
   and donut charts instead of pulling in a charting library —
   it keeps the project dependency-free and easy to read for a
   beginner, and it works fully offline.
   ============================================================ */

const Statistics = {
  // Resizes a canvas's internal pixel grid to match its CSS size,
  // accounting for high-DPI screens so lines stay crisp.
  prepareCanvas(canvas) {
    const ratio = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * ratio;
    canvas.height = rect.height * ratio;
    const ctx = canvas.getContext("2d");
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    return { ctx, width: rect.width, height: rect.height };
  },

  // segments = [{ label, value, color }]
  drawDonut(canvas, segments) {
    const { ctx, width, height } = this.prepareCanvas(canvas);
    ctx.clearRect(0, 0, width, height);

    const total = segments.reduce((sum, s) => sum + s.value, 0);
    const cx = width / 2;
    const cy = height / 2;
    const radius = Math.min(width, height) / 2 - 8;
    const lineWidth = Math.max(radius * 0.32, 10);

    if (total === 0) {
      ctx.strokeStyle = "#E2E5EB";
      ctx.lineWidth = lineWidth;
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.stroke();
      return;
    }

    let start = -Math.PI / 2;
    segments.forEach((seg) => {
      if (seg.value <= 0) return;
      const angle = (seg.value / total) * Math.PI * 2;
      ctx.strokeStyle = seg.color;
      ctx.lineWidth = lineWidth;
      ctx.lineCap = "butt";
      ctx.beginPath();
      ctx.arc(cx, cy, radius, start, start + angle);
      ctx.stroke();
      start += angle;
    });

    // Center label: total count
    ctx.fillStyle = "#1B2A4A";
    ctx.font = "700 22px 'Space Grotesk', sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(String(total), cx, cy - 6);
    ctx.font = "500 11px 'Inter', sans-serif";
    ctx.fillStyle = "#7A8296";
    ctx.fillText("classes", cx, cy + 14);
  },

  // labels = ["Mon","Tue"...], series = [{name,color,values:[...]}]
  drawGroupedBars(canvas, labels, series, options = {}) {
    const { ctx, width, height } = this.prepareCanvas(canvas);
    ctx.clearRect(0, 0, width, height);

    const padding = { top: 16, right: 12, bottom: 28, left: 32 };
    const chartW = width - padding.left - padding.right;
    const chartH = height - padding.top - padding.bottom;

    const maxVal =
      options.max ||
      Math.max(
        1,
        ...series.flatMap((s) => s.values)
      );

    // gridlines
    ctx.strokeStyle = "#EEF0F4";
    ctx.lineWidth = 1;
    const gridLines = 4;
    for (let i = 0; i <= gridLines; i++) {
      const y = padding.top + (chartH / gridLines) * i;
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(width - padding.right, y);
      ctx.stroke();
      const val = Math.round(maxVal - (maxVal / gridLines) * i);
      ctx.fillStyle = "#9AA1B2";
      ctx.font = "500 10px 'Inter', sans-serif";
      ctx.textAlign = "right";
      ctx.textBaseline = "middle";
      ctx.fillText(String(val), padding.left - 6, y);
    }

    const groupCount = labels.length;
    const groupWidth = chartW / groupCount;
    const barGap = 4;
    const barWidth =
      (groupWidth - barGap * (series.length + 1)) / series.length;

    labels.forEach((label, gi) => {
      const groupX = padding.left + gi * groupWidth;
      series.forEach((s, si) => {
        const val = s.values[gi] || 0;
        const barH = (val / maxVal) * chartH;
        const x = groupX + barGap + si * (barWidth + barGap);
        const y = padding.top + chartH - barH;
        ctx.fillStyle = s.color;
        ctx.beginPath();
        const r = Math.min(4, barWidth / 2);
        // rounded top rect
        ctx.moveTo(x, y + r);
        ctx.arcTo(x, y, x + r, y, r);
        ctx.lineTo(x + barWidth - r, y);
        ctx.arcTo(x + barWidth, y, x + barWidth, y + r, r);
        ctx.lineTo(x + barWidth, y + barH);
        ctx.lineTo(x, y + barH);
        ctx.closePath();
        ctx.fill();
      });
      // x label
      ctx.fillStyle = "#5B6172";
      ctx.font = "500 10px 'Inter', sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      ctx.fillText(label, groupX + groupWidth / 2, height - padding.bottom + 8);
    });
  },

  // A single horizontal progress-style bar (used for percentages)
  drawPercentBar(canvas, percent, color) {
    const { ctx, width, height } = this.prepareCanvas(canvas);
    ctx.clearRect(0, 0, width, height);
    const r = height / 2;

    ctx.fillStyle = "#EEF0F4";
    this._roundRect(ctx, 0, 0, width, height, r);
    ctx.fill();

    const fillW = Math.max((percent / 100) * width, height);
    ctx.fillStyle = color;
    this._roundRect(ctx, 0, 0, fillW, height, r);
    ctx.fill();
  },

  _roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  },
};
