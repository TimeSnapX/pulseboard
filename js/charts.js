const PALETTE = ["#f7931a", "#5dcaa5", "#7eb8d4", "#e06c75", "#e8b86d", "#c084fc", "#8b93a7", "#ffb347"];
const instances = [];

function tipEl() {
  let el = document.getElementById("chart-tip");
  if (!el) {
    el = document.createElement("div");
    el.id = "chart-tip";
    el.className = "chart-tip";
    el.hidden = true;
    document.body.appendChild(el);
  }
  return el;
}

function showTip(html, x, y) {
  const el = tipEl();
  el.innerHTML = html;
  el.hidden = false;
  const pad = 12;
  const r = el.getBoundingClientRect();
  let left = x + 14;
  let top = y + 14;
  if (left + r.width > innerWidth - pad) left = x - r.width - 10;
  if (top + r.height > innerHeight - pad) top = y - r.height - 10;
  el.style.left = left + "px";
  el.style.top = top + "px";
}

function hideTip() {
  const el = document.getElementById("chart-tip");
  if (el) el.hidden = true;
}

function layout(canvas) {
  const dpr = Math.max(1, window.devicePixelRatio || 1);
  const rect = canvas.getBoundingClientRect();
  const w = Math.max(120, rect.width);
  const h = Math.max(80, rect.height);
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
  const ctx = canvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { ctx, w, h };
}

function niceMax(v) {
  if (v <= 0) return 1;
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  const n = v / p;
  const m = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10;
  return m * p;
}

function fmtDefault(v) {
  if (Math.abs(v) >= 1000) return v.toLocaleString("en-AU", { maximumFractionDigits: 0 });
  if (Math.abs(v) >= 10) return v.toLocaleString("en-AU", { maximumFractionDigits: 1 });
  return v.toLocaleString("en-AU", { maximumFractionDigits: 2 });
}

function drawAxes(ctx, plot, yMax, yMin, labels, format) {
  const { x, y, w, h } = plot;
  ctx.strokeStyle = "rgba(244, 234, 216, 0.08)";
  ctx.lineWidth = 1;
  ctx.fillStyle = "#6e6558";
  ctx.font = "11px Outfit, system-ui, sans-serif";
  ctx.textAlign = "right";
  ctx.textBaseline = "middle";
  const ticks = 4;
  for (let i = 0; i <= ticks; i++) {
    const t = i / ticks;
    const yy = y + h - t * h;
    const val = yMin + (yMax - yMin) * t;
    ctx.beginPath();
    ctx.moveTo(x, yy);
    ctx.lineTo(x + w, yy);
    ctx.stroke();
    ctx.fillText(format(val), x - 8, yy);
  }
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  const step = labels.length > 14 ? Math.ceil(labels.length / 7) : labels.length > 8 ? 2 : 1;
  labels.forEach((lb, i) => {
    if (i % step !== 0 && i !== labels.length - 1) return;
    const xx = x + ((i + 0.5) * w) / labels.length;
    ctx.fillText(String(lb), xx, y + h + 8);
  });
}

function plotBox(w, h, pad) {
  return { x: pad.l, y: pad.t, w: w - pad.l - pad.r, h: h - pad.t - pad.b };
}

function cartesian(canvas, spec) {
  const { ctx, w, h } = layout(canvas);
  const pad = spec.pad || { t: 18, r: 16, b: 32, l: 46 };
  const plot = plotBox(w, h, pad);
  const labels = spec.labels || [];
  const series = spec.series || [];
  const format = spec.format || fmtDefault;
  const all = series.flatMap((s) => s.data.map(Number).filter(Number.isFinite));
  const minAll = all.length ? Math.min(...all) : 0;
  const maxAll = all.length ? Math.max(...all) : 1;
  let yMin = spec.yMin != null ? spec.yMin : Math.min(0, minAll);
  let yMax = spec.yMax != null ? spec.yMax : Math.max(1, maxAll);
  if (yMax === yMin) yMax = yMin + 1;
  if (spec.yMin == null && spec.yMax == null) {
    if (minAll >= 0) {
      yMin = 0;
      yMax = niceMax(yMax);
    } else {
      const m = niceMax(Math.max(Math.abs(minAll), Math.abs(maxAll)));
      yMin = -m;
      yMax = m;
    }
  } else if (spec.yMax == null) {
    yMax = niceMax(yMax);
  }
  ctx.clearRect(0, 0, w, h);
  drawAxes(ctx, plot, yMax, yMin, labels, format);

  const n = labels.length || series[0]?.data.length || 0;
  const xAt = (i) => plot.x + ((i + 0.5) * plot.w) / Math.max(1, n);
  const yAt = (v) => plot.y + plot.h - ((v - yMin) / (yMax - yMin)) * plot.h;
  const zeroY = yAt(0);

  const hit = [];

  series.forEach((s, si) => {
    const color = s.color || PALETTE[si % PALETTE.length];
    const data = s.data.map(Number);
    if (spec.type === "bar") {
      const group = series.length;
      const slot = plot.w / Math.max(1, n);
      const bw = Math.min(28, slot * 0.7) / group;
      data.forEach((v, i) => {
        const x = xAt(i) - (bw * group) / 2 + si * bw;
        const y = yAt(v);
        const top = Math.min(y, zeroY);
        const bh = Math.max(1, Math.abs(y - zeroY));
        ctx.fillStyle = color;
        ctx.globalAlpha = 0.92;
        ctx.beginPath();
        const r = Math.min(4, bw / 2);
        roundRect(ctx, x + 1, top, bw - 2, bh, r);
        ctx.fill();
        ctx.globalAlpha = 1;
        hit.push({ x: x, y: top, w: bw, h: bh, i, si, v, label: labels[i], name: s.name, color });
      });
    } else {
      ctx.beginPath();
      data.forEach((v, i) => {
        const x = xAt(i);
        const y = yAt(v);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      if (spec.type === "area" || s.fill) {
        ctx.save();
        ctx.lineTo(xAt(data.length - 1), zeroY);
        ctx.lineTo(xAt(0), zeroY);
        ctx.closePath();
        const g = ctx.createLinearGradient(0, plot.y, 0, plot.y + plot.h);
        g.addColorStop(0, color + "55");
        g.addColorStop(1, color + "08");
        ctx.fillStyle = g;
        ctx.fill();
        ctx.restore();
        ctx.beginPath();
        data.forEach((v, i) => {
          const x = xAt(i);
          const y = yAt(v);
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        });
      }
      ctx.strokeStyle = color;
      ctx.lineWidth = 2.2;
      ctx.lineJoin = "round";
      ctx.lineCap = "round";
      ctx.stroke();
      data.forEach((v, i) => {
        const x = xAt(i);
        const y = yAt(v);
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(x, y, 2.6, 0, Math.PI * 2);
        ctx.fill();
        hit.push({ x: x - 10, y: y - 10, w: 20, h: 20, i, si, v, label: labels[i], name: s.name, color, cx: x, cy: y });
      });
    }
  });

  return { hit, series, labels, format, type: spec.type };
}

function roundRect(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

function pie(canvas, spec) {
  const { ctx, w, h } = layout(canvas);
  ctx.clearRect(0, 0, w, h);
  const cx = w * 0.38;
  const cy = h / 2;
  const r = Math.min(cx, cy) - 16;
  const inner = spec.type === "donut" ? r * 0.58 : 0;
  const slices = (spec.slices || []).filter((s) => s.value > 0);
  const total = slices.reduce((a, s) => a + s.value, 0) || 1;
  let a0 = -Math.PI / 2;
  const hit = [];
  slices.forEach((s, i) => {
    const ang = (s.value / total) * Math.PI * 2;
    const a1 = a0 + ang;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, r, a0, a1);
    ctx.closePath();
    ctx.fillStyle = s.color || PALETTE[i % PALETTE.length];
    ctx.fill();
    hit.push({ a0, a1, slice: s, i, value: s.value, color: s.color || PALETTE[i % PALETTE.length] });
    a0 = a1;
  });
  if (inner) {
    ctx.globalCompositeOperation = "destination-out";
    ctx.beginPath();
    ctx.arc(cx, cy, inner, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalCompositeOperation = "source-over";
    ctx.fillStyle = "#f4ead8";
    ctx.font = "600 16px Outfit, system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(spec.center || (spec.format || fmtDefault)(total), cx, cy - 7);
    ctx.fillStyle = "#6e6558";
    ctx.font = "11px Outfit, system-ui, sans-serif";
    ctx.fillText(spec.centerSub || "total", cx, cy + 12);
  }
  const lx = w * 0.68;
  let ly = Math.max(16, cy - slices.length * 12);
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.font = "12px Outfit, system-ui, sans-serif";
  slices.forEach((s, i) => {
    const c = s.color || PALETTE[i % PALETTE.length];
    ctx.fillStyle = c;
    ctx.beginPath();
    ctx.arc(lx, ly, 4.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#cfc3ae";
    const pct = Math.round((s.value / total) * 100);
    ctx.fillText(`${s.label}  ${pct}%`, lx + 12, ly);
    ly += 22;
  });
  return { hit, cx, cy, r, inner, total, format: spec.format || fmtDefault, type: spec.type };
}

function bind(canvas, model) {
  const onMove = (e) => {
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    if (model.type === "donut" || model.type === "pie") {
      const dx = x - model.cx;
      const dy = y - model.cy;
      const dist = Math.hypot(dx, dy);
      if (dist > model.r || dist < (model.inner || 0)) {
        hideTip();
        canvas.style.cursor = "default";
        return;
      }
      let ang = Math.atan2(dy, dx);
      if (ang < -Math.PI / 2) ang += Math.PI * 2;
      const slice = model.hit.find((h) => ang >= h.a0 && ang < h.a1);
      if (!slice) {
        hideTip();
        return;
      }
      canvas.style.cursor = "pointer";
      showTip(
        `<strong>${slice.slice.label}</strong><br>${model.format(slice.value)}`,
        e.clientX,
        e.clientY
      );
      return;
    }
    const h = model.hit.find((b) => x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h);
    if (!h) {
      hideTip();
      canvas.style.cursor = "default";
      return;
    }
    canvas.style.cursor = "pointer";
    const name = h.name ? `${h.name}: ` : "";
    showTip(`<strong>${h.label}</strong><br>${name}${model.format(h.v)}`, e.clientX, e.clientY);
  };
  const onLeave = () => {
    hideTip();
    canvas.style.cursor = "default";
  };
  canvas.addEventListener("pointermove", onMove);
  canvas.addEventListener("pointerleave", onLeave);
  return () => {
    canvas.removeEventListener("pointermove", onMove);
    canvas.removeEventListener("pointerleave", onLeave);
  };
}

export function clearCharts() {
  instances.splice(0).forEach((i) => i.destroy());
  hideTip();
}

export function drawChart(canvas, spec) {
  if (!canvas) return;
  let model = spec.type === "donut" || spec.type === "pie" ? pie(canvas, spec) : cartesian(canvas, spec);
  let unbind = bind(canvas, model);
  const redraw = () => {
    unbind();
    model = spec.type === "donut" || spec.type === "pie" ? pie(canvas, spec) : cartesian(canvas, spec);
    unbind = bind(canvas, model);
  };
  const ro = new ResizeObserver(() => redraw());
  ro.observe(canvas.parentElement || canvas);
  const inst = {
    destroy() {
      ro.disconnect();
      unbind();
    },
  };
  instances.push(inst);
  return inst;
}

export { PALETTE };
