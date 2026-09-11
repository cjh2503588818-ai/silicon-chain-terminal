/* ============================================================
   charts.js — small dependency-free SVG chart layer
   line / bar / stacked bar / diverging bar / heatmap / sparkline
   ============================================================ */
(function (global) {
  const NS = "http://www.w3.org/2000/svg";

  function E(tag, attrs, kids) {
    const n = document.createElementNS(NS, tag);
    if (attrs) for (const k in attrs) if (attrs[k] !== null && attrs[k] !== undefined) n.setAttribute(k, attrs[k]);
    (kids || []).forEach(c => n.appendChild(c));
    return n;
  }
  function txt(x, y, s, o) {
    o = o || {};
    const t = E("text", {
      x: x, y: y, fill: o.fill || "#6B7885", "font-size": o.size || 10,
      "text-anchor": o.anchor || "start", "font-weight": o.weight || 400,
      transform: o.transform || null, "letter-spacing": o.ls || null, opacity: o.opacity || null
    });
    t.textContent = s;
    return t;
  }
  const fmtNum = (v, d) => {
    if (v === null || v === undefined || isNaN(v)) return "–";
    const a = Math.abs(v);
    const dec = d !== undefined ? d : (a >= 1000 ? 0 : a >= 100 ? 1 : a >= 10 ? 1 : 2);
    return v.toLocaleString("zh-CN", { minimumFractionDigits: dec, maximumFractionDigits: dec });
  };
  const PALETTE = ["#C2410C", "#0E7490", "#B45309", "#64748B", "#2A9DB4", "#EA7B3C",
                   "#94A3B8", "#157F3D", "#7C3AED", "#CBD5E1"];

  function niceTicks(min, max, n) {
    n = n || 5;
    if (!isFinite(min) || !isFinite(max)) { min = 0; max = 1; }
    if (min === max) { max = min + 1; }
    const raw = (max - min) / n, mag = Math.pow(10, Math.floor(Math.log10(raw)));
    const norm = raw / mag, step = (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 2.5 ? 2.5 : norm <= 5 ? 5 : 10) * mag;
    const lo = Math.floor(min / step) * step, hi = Math.ceil(max / step) * step;
    const out = [];
    for (let v = lo; v <= hi + step * .5; v += step) out.push(+v.toFixed(10));
    return { ticks: out, lo: lo, hi: hi };
  }

  /* ---------- shared tooltip ---------- */
  let tipEl = null;
  function tip() {
    if (!tipEl) { tipEl = document.createElement("div"); tipEl.className = "tip"; document.body.appendChild(tipEl); }
    return tipEl;
  }
  function showTip(html, x, y) {
    const t = tip();
    t.innerHTML = html; t.classList.add("on");
    const r = t.getBoundingClientRect();
    let left = x + 14, top = y - r.height - 12;
    if (left + r.width > innerWidth - 8) left = x - r.width - 14;
    if (top < 8) top = y + 16;
    t.style.left = left + "px"; t.style.top = top + "px";
  }
  function hideTip() { if (tipEl) tipEl.classList.remove("on"); }

  function tipRows(items, title) {
    let h = title ? `<div class="tt">${title}</div>` : "";
    items.forEach(i => {
      h += `<div class="tr"><span class="sw" style="background:${i.color}"></span>
            <span class="tn">${i.name}</span><span class="tv">${i.val}</span></div>`;
    });
    return h;
  }

  /* ============================================================
     LINE / AREA
     cfg: { series:[{name,color,data:[[x,y]...],dash,area,width}], unit,
            yMin,yMax, yTicks, height, bands:[{from,to,color,label}],
            refs:[{y,label,color,dash}], xLabels:'sparse', zeroLine:bool,
            endLabels:bool, fmt:{dec} }
     ============================================================ */
  function line(host, cfg) {
    host.innerHTML = "";
    const W = Math.max(280, host.clientWidth || 640), H = cfg.height || 230;
    const m = Object.assign({ t: 16, r: 62, b: 26, l: 46 }, cfg.margin || {});
    const iw = W - m.l - m.r, ih = H - m.t - m.b;
    const svg = E("svg", { class: "chart", viewBox: `0 0 ${W} ${H}`, width: "100%", height: H,
                           preserveAspectRatio: "none", style: `height:${H}px` });

    // common x axis: union of every series' dates so mixed-frequency series align by date
    const _dset = new Set();
    cfg.series.forEach(s => s.data.forEach(d => _dset.add(String(d[0]))));
    const axis = Array.from(_dset).sort();
    const xAt = new Map(axis.map((d, i) => [d, i]));
    const n = axis.length || 1;
    const xs = cfg.series.flatMap(s => s.data.map(d => d[0]));
    const ys = cfg.series.flatMap(s => s.data.map(d => d[1])).filter(v => v !== null && !isNaN(v));
    (cfg.refs || []).forEach(r => ys.push(r.y));
    (cfg.bands || []).forEach(b => { ys.push(b.to); });
    let yMin = cfg.yMin !== undefined ? cfg.yMin : Math.min(...ys);
    let yMax = cfg.yMax !== undefined ? cfg.yMax : Math.max(...ys);
    if (cfg.zeroLine && yMin > 0) yMin = 0;
    const pad = (yMax - yMin) * .08 || 1;
    const T = niceTicks(cfg.yMin !== undefined && cfg.yMax !== undefined ? yMin : yMin - pad,
                        cfg.yMax !== undefined && cfg.yMax !== undefined ? yMax : yMax + pad,
                        cfg.yTicks || 5);
    const Y = v => m.t + ih - (v - T.lo) / (T.hi - T.lo) * ih;
    const X = i => m.l + (n <= 1 ? iw / 2 : i / (n - 1) * iw);

    // bands
    (cfg.bands || []).forEach(b => {
      const y0 = Y(b.from), y1 = Y(b.to);
      svg.appendChild(E("rect", { x: m.l, y: Math.min(y0, y1), width: iw, height: Math.abs(y1 - y0),
                                  fill: b.color, opacity: b.opacity || .5 }));
      if (b.label) svg.appendChild(txt(m.l + 6, Math.min(y0, y1) + 11, b.label, { size: 9.5, fill: "#8A6A50" }));
    });
    // gridlines + y labels
    T.ticks.forEach(v => {
      svg.appendChild(E("line", { x1: m.l, x2: m.l + iw, y1: Y(v), y2: Y(v),
                                  stroke: v === 0 ? "#D3DADF" : "#EEF1F3", "stroke-width": 1 }));
      svg.appendChild(txt(m.l - 8, Y(v) + 3.5, fmtNum(v, cfg.fmt ? cfg.fmt.dec : undefined),
                          { anchor: "end", size: 10 }));
    });
    // refs
    (cfg.refs || []).forEach((r, ri) => {
      const y = Y(r.y);
      svg.appendChild(E("line", { x1: m.l, x2: m.l + iw, y1: y, y2: y,
                                  stroke: r.color || "#B91C1C", "stroke-width": 1.2,
                                  "stroke-dasharray": r.dash || "5 4", opacity: .85 }));
      const lbl = txt(m.l + 5, y - 4 - (ri % 2) * 11, r.label,
                      { size: 9.5, fill: r.color || "#B91C1C", weight: 600, anchor: "start" });
      lbl.setAttribute("stroke", "#FFFFFF");
      lbl.setAttribute("stroke-width", "3");
      lbl.setAttribute("paint-order", "stroke");
      svg.appendChild(lbl);
    });
    // x labels (use first series' x values)
    const step = Math.max(1, Math.ceil(n / (cfg.xTicks || 8)));
    for (let i = 0; i < n; i += step) {
      svg.appendChild(txt(X(i), H - 8, String(axis[i]).slice(cfg.xLabelCut || 0), { anchor: "middle", size: 9.5, fill: "#9AA5AF" }));
    }
    // series
    const ends = [];
    cfg.series.forEach((s, si) => {
      const color = s.color || PALETTE[si % PALETTE.length];
      const pts = [];
      s.data.forEach(d => {
        const xi = xAt.get(String(d[0]));
        if (xi === undefined || typeof d[1] !== "number" || !isFinite(d[1])) return;
        pts.push([X(xi), Y(d[1])]);
      });
      if (!pts.length) return;
      const path = pts.map((p, i) => (i ? "L" : "M") + p[0].toFixed(1) + " " + p[1].toFixed(1)).join(" ");
      if (s.area) {
        const floor = cfg.zeroLine ? Y(0) : m.t + ih;
        svg.appendChild(E("path", { d: path + ` L${pts[pts.length-1][0].toFixed(1)} ${floor} L${pts[0][0].toFixed(1)} ${floor} Z`,
                                    fill: color, opacity: s.areaOpacity || .13, stroke: "none" }));
      }
      svg.appendChild(E("path", { d: path, fill: "none", stroke: color,
                                  "stroke-width": s.width || 1.7, "stroke-dasharray": s.dash || null,
                                  "stroke-linejoin": "round", "stroke-linecap": "round" }));
      if (cfg.endLabels !== false) {
        const p = pts[pts.length - 1];
        svg.appendChild(E("circle", { cx: p[0], cy: p[1], r: 2.6, fill: color }));
        ends.push({ x: p[0], y: p[1], name: s.name, color: color });
      }
    });
    // end labels, staggered so close series stay legible
    ends.sort((a, b2) => a.y - b2.y);
    const GAP = 14, top = m.t - 2, bot = m.t + ih + 4;
    let prevY = -99;
    // first pass: push down when crowded, then clamp the whole stack inside the plot
    ends.forEach(e => { e.ly = Math.max(e.y, prevY + GAP); prevY = e.ly; });
    if (ends.length && ends[ends.length - 1].ly > bot) {
      const shift = ends[ends.length - 1].ly - bot;
      ends.forEach(e => { e.ly -= shift; });
      for (let i = ends.length - 2; i >= 0; i--) ends[i].ly = Math.min(ends[i].ly, ends[i + 1].ly - GAP);
      ends.forEach(e => { e.ly = Math.max(e.ly, top); });
    }
    ends.forEach(e => {
      const ly = e.ly;
      const t = txt(e.x + 6, Math.min(ly, bot) + 3.5, e.name, { size: 9.5, fill: e.color, weight: 600 });
      t.setAttribute("stroke", "#FFFFFF"); t.setAttribute("stroke-width", "3");
      t.setAttribute("paint-order", "stroke");
      svg.appendChild(t);
    });

    // hover layer
    const hover = E("rect", { x: m.l, y: m.t, width: iw, height: ih, fill: "transparent" });
    const vline = E("line", { x1: 0, x2: 0, y1: m.t, y2: m.t + ih, stroke: "#0D1620", "stroke-width": .8,
                              opacity: 0, "stroke-dasharray": "3 3" });
    svg.appendChild(vline); svg.appendChild(hover);
    hover.addEventListener("mousemove", ev => {
      const r = svg.getBoundingClientRect();
      const px = (ev.clientX - r.left) / r.width * W;
      let i = Math.round((px - m.l) / (iw || 1) * (n - 1));
      i = Math.max(0, Math.min(n - 1, i));
      vline.setAttribute("x1", X(i)); vline.setAttribute("x2", X(i)); vline.setAttribute("opacity", .35);
      const key = String(axis[i]);
      const items = cfg.series.map(s => {
        const hit = s.data.find(d => String(d[0]) === key);
        if (!hit || typeof hit[1] !== "number") return null;
        return { color: s.color || PALETTE[cfg.series.indexOf(s) % PALETTE.length], name: s.name,
                 val: fmtNum(hit[1], cfg.fmt ? cfg.fmt.dec : undefined) + (cfg.unit ? " " + cfg.unit : "") };
      }).filter(Boolean);
      const lbl = key || "";
      if (items.length) showTip(tipRows(items, lbl), ev.clientX, ev.clientY);
    });
    hover.addEventListener("mouseleave", () => { hideTip(); vline.setAttribute("opacity", 0); });

    host.appendChild(svg);
  }

  /* ============================================================
     BAR (grouped or stacked, vertical)
     cfg: { cats:[], series:[{name,color,data:[]}], stacked, unit, height,
            refs:[{y,label,color}], fmt, yMin, yMax, valueLabels }
     ============================================================ */
  function bar(host, cfg) {
    host.innerHTML = "";
    const W = Math.max(280, host.clientWidth || 640), H = cfg.height || 230;
    const m = Object.assign({ t: 14, r: 16, b: 30, l: 46 }, cfg.margin || {});
    const iw = W - m.l - m.r, ih = H - m.t - m.b;
    const svg = E("svg", { class: "chart", viewBox: `0 0 ${W} ${H}`, width: "100%", height: H,
                           preserveAspectRatio: "none", style: `height:${H}px` });
    const cats = cfg.cats, nc = cats.length, ns = cfg.series.length;
    let lo = 0, hi = 0;
    if (cfg.stacked) {
      for (let i = 0; i < nc; i++) {
        let pos = 0, neg = 0;
        cfg.series.forEach(s => { const v = +s.data[i] || 0; v >= 0 ? pos += v : neg += v; });
        hi = Math.max(hi, pos); lo = Math.min(lo, neg);
      }
    } else {
      cfg.series.forEach(s => s.data.slice(0, nc).forEach(v => {
        if (typeof v === "number" && isFinite(v)) { hi = Math.max(hi, v); lo = Math.min(lo, v); }
      }));
    }
    (cfg.refs || []).forEach(r => { hi = Math.max(hi, r.y); lo = Math.min(lo, r.y); });
    const T = niceTicks(cfg.yMin !== undefined ? cfg.yMin : lo, cfg.yMax !== undefined ? cfg.yMax : hi, cfg.yTicks || 5);
    const Y = v => m.t + ih - (v - T.lo) / (T.hi - T.lo) * ih;
    T.ticks.forEach(v => {
      svg.appendChild(E("line", { x1: m.l, x2: m.l + iw, y1: Y(v), y2: Y(v), stroke: v === 0 ? "#D3DADF" : "#EEF1F3" }));
      svg.appendChild(txt(m.l - 8, Y(v) + 3.5, fmtNum(v, cfg.fmt ? cfg.fmt.dec : undefined), { anchor: "end", size: 10 }));
    });
    const slot = iw / nc;
    const bw = cfg.stacked ? slot * .74 : slot * .74 / ns;
    cats.forEach((c, i) => {
      const x0 = m.l + slot * i;
      if (cfg.stacked) {
        let acc = 0;
        cfg.series.forEach((s, si) => {
          const v = +s.data[i] || 0;
          const y1 = Y(acc + v), y0 = Y(acc);
          svg.appendChild(E("rect", { x: x0 + slot * .13, y: Math.min(y0, y1), width: bw,
                                      height: Math.max(1, Math.abs(y0 - y1)),
                                      fill: s.color || PALETTE[si % PALETTE.length] }));
          acc += v;
        });
      } else {
        cfg.series.forEach((s, si) => {
          const v = s.data[i];
          if (typeof v !== "number" || !isFinite(v)) return;
          svg.appendChild(E("rect", { x: x0 + slot * .13 + bw * si, y: Math.min(Y(v), Y(0)),
                                      width: bw * .92, height: Math.max(1, Math.abs(Y(v) - Y(0))),
                                      fill: s.color || PALETTE[si % PALETTE.length] }));
        });
      }
      const lbl = cfg.rotate ? null : c;
      const every = cfg.catStep || (nc > 26 ? 4 : nc > 18 ? 2 : 1);
      if (lbl && i % every === 0) svg.appendChild(txt(x0 + slot / 2, H - 9, lbl, { anchor: "middle", size: 9.5, fill: "#9AA5AF" }));
      else if (!lbl && i % (cfg.rotateStep || 3) === 0) {
        svg.appendChild(txt(x0 + slot / 2 + 3, H - 9, c, { anchor: "end", size: 9.5, fill: "#9AA5AF",
          transform: `rotate(-38 ${x0 + slot / 2 + 3} ${H - 9})` }));
      }
    });
    (cfg.refs || []).forEach(r => {
      svg.appendChild(E("line", { x1: m.l, x2: m.l + iw, y1: Y(r.y), y2: Y(r.y), stroke: r.color || "#B91C1C",
                                  "stroke-width": 1.2, "stroke-dasharray": r.dash || "5 4" }));
      svg.appendChild(txt(m.l + iw - 4, Y(r.y) - 5, r.label, { anchor: "end", size: 9.5, fill: r.color || "#B91C1C", weight: 600 }));
    });
    const hover = E("rect", { x: m.l, y: m.t, width: iw, height: ih, fill: "transparent" });
    svg.appendChild(hover);
    hover.addEventListener("mousemove", ev => {
      const r = svg.getBoundingClientRect();
      const px = (ev.clientX - r.left) / r.width * W;
      const i = Math.max(0, Math.min(nc - 1, Math.floor((px - m.l) / slot)));
      const items = cfg.series.map((s, si) => ({
        color: s.color || PALETTE[si % PALETTE.length], name: s.name,
        val: fmtNum(s.data[i], cfg.fmt ? cfg.fmt.dec : undefined) + (cfg.unit ? " " + cfg.unit : "")
      }));
      if (cfg.stacked) items.push({ color: "#0D1620", name: cfg.totalName || "合计",
        val: fmtNum(cfg.series.reduce((a, s) => a + (s.data[i] || 0), 0), 1) + (cfg.unit ? " " + cfg.unit : "") });
      showTip(tipRows(items, cats[i]), ev.clientX, ev.clientY);
    });
    hover.addEventListener("mouseleave", hideTip);
    host.appendChild(svg);
  }

  /* ============================================================
     DIVERGING BAR  cfg:{rows:[{label,pos,neg,note}], height, unit}
     ============================================================ */
  function diverge(host, cfg) {
    host.innerHTML = "";
    const W = Math.max(280, host.clientWidth || 620), rows = cfg.rows;
    const rh = cfg.rowH || 26, H = rows.length * rh + 34;
    const m = { t: 22, r: 14, b: 6, l: Math.max(84, cfg.labelW || 96) };
    const iw = W - m.l - m.r;
    const maxV = Math.max(...rows.flatMap(r => [Math.abs(r.pos || 0), Math.abs(r.neg || 0)]), .1);
    const mid = m.l + iw / 2;
    const svg = E("svg", { class: "chart", viewBox: `0 0 ${W} ${H}`, width: "100%", height: H,
                           preserveAspectRatio: "none", style: `height:${H}px` });
    svg.appendChild(txt(mid + iw / 4, 12, cfg.posName || "多头", { anchor: "middle", size: 10, fill: "#0E7490", weight: 700 }));
    svg.appendChild(txt(mid - iw / 4, 12, cfg.negName || "空头", { anchor: "middle", size: 10, fill: "#C2410C", weight: 700 }));
    svg.appendChild(E("line", { x1: mid, x2: mid, y1: m.t - 4, y2: H - 4, stroke: "#D3DADF" }));
    rows.forEach((r, i) => {
      const y = m.t + i * rh;
      svg.appendChild(txt(m.l - 10, y + rh / 2 + 3.5, r.label, { anchor: "end", size: 11, fill: "#3C4A57" }));
      const wPos = Math.abs(r.pos || 0) / maxV * (iw / 2 - 34);
      const wNeg = Math.abs(r.neg || 0) / maxV * (iw / 2 - 34);
      svg.appendChild(E("rect", { x: mid + 4, y: y + 4, width: Math.max(1, wPos), height: rh - 10, fill: "#0E7490", rx: 1 }));
      svg.appendChild(E("rect", { x: mid - 4 - Math.max(1, wNeg), y: y + 4, width: Math.max(1, wNeg), height: rh - 10, fill: "#C2410C", rx: 1, opacity: .92 }));
      svg.appendChild(txt(mid + 8 + Math.max(1, wPos), y + rh / 2 + 3.5, fmtNum(r.pos, 1), { size: 10, fill: "#0E7490" }));
      svg.appendChild(txt(mid - 8 - Math.max(1, wNeg), y + rh / 2 + 3.5, fmtNum(r.neg, 1), { anchor: "end", size: 10, fill: "#C2410C" }));
    });
    host.appendChild(svg);
  }

  /* ============================================================
     HEATMAP  cfg:{rows:[{label,vals:[]}], cols:[], unit, height,
                   lo,hi, palette:'amber'|'teal'}
     ============================================================ */
  function heat(host, cfg) {
    host.innerHTML = "";
    const rows = cfg.rows, cols = cfg.cols;
    const W = Math.max(280, host.clientWidth || 640);
    const labelW = cfg.labelW || 84, cw = (W - labelW - 6) / cols.length;
    const rh = cfg.rowH || 18, H = rows.length * rh + 26;
    const vals = rows.flatMap(r => r.vals).filter(v => v !== null && !isNaN(v));
    const lo = cfg.lo !== undefined ? cfg.lo : Math.min(...vals);
    const hi = cfg.hi !== undefined ? cfg.hi : Math.max(...vals);
    const stops = cfg.palette === "teal"
      ? ["#F2FAFB", "#BFE3EA", "#7FC4D2", "#2A9DB4", "#0E7490", "#0B5A6E"]
      : ["#FDF6F1", "#F8D9C2", "#F0B183", "#E27E45", "#C2410C", "#8C2E08"];
    function color(v) {
      if (v === null || v === undefined || isNaN(v)) return "#F7F9FA";
      let t = Math.max(0, Math.min(1, (v - lo) / (hi - lo || 1)));
      if (cfg.gamma) t = Math.pow(t, cfg.gamma);
      return stops[Math.min(stops.length - 1, Math.floor(t * (stops.length - 1) + .35))];
    }
    const svg = E("svg", { class: "chart", viewBox: `0 0 ${W} ${H}`, width: "100%", height: H,
                           preserveAspectRatio: "none", style: `height:${H}px` });
    cols.forEach((c, j) => {
      svg.appendChild(txt(labelW + cw * j + cw / 2, 10, c, { anchor: "middle", size: 9, fill: "#9AA5AF" }));
    });
    rows.forEach((r, i) => {
      const y = 16 + i * rh;
      svg.appendChild(txt(labelW - 8, y + rh / 2 + 3.5, r.label, { anchor: "end", size: 10.5, fill: "#3C4A57" }));
      r.vals.forEach((v, j) => {
        const rect = E("rect", { x: labelW + cw * j, y: y + 1, width: Math.max(1, cw - 1.5), height: rh - 3,
                                 fill: color(v), rx: 1 });
        svg.appendChild(rect);
        rect.addEventListener("mousemove", ev => showTip(tipRows([{ color: color(v), name: r.label + " · " + cols[j],
          val: fmtNum(v, cfg.dec === undefined ? 1 : cfg.dec) + (cfg.unit ? " " + cfg.unit : "") }], cols[j]), ev.clientX, ev.clientY));
        rect.addEventListener("mouseleave", hideTip);
      });
    });
    host.appendChild(svg);
    if (cfg.legend !== false) {
      const lg = document.createElement("div");
      lg.className = "hm-legend";
      lg.innerHTML = `<span>${fmtNum(lo, 1)}</span><span class="scale">${
        stops.map(s => `<i style="background:${s}"></i>`).join("")}</span><span>${fmtNum(hi, 1)} ${cfg.unit || ""}</span>`;
      host.appendChild(lg);
    }
  }

  /* ============================================================
     SPARKLINE  cfg:{vals:[], color, height, width, fill}
     ============================================================ */
  function spark(host, cfg) {
    const W = cfg.width || 92, H = cfg.height || 26, vals = cfg.vals.filter(v => v !== null && !isNaN(v));
    if (vals.length < 2) return;
    const lo = Math.min(...vals), hi = Math.max(...vals);
    const X = i => i / (vals.length - 1) * W, Y = v => H - 2 - (v - lo) / (hi - lo || 1) * (H - 4);
    const d = vals.map((v, i) => (i ? "L" : "M") + X(i).toFixed(1) + " " + Y(v).toFixed(1)).join(" ");
    const svg = E("svg", { viewBox: `0 0 ${W} ${H}`, width: W, height: H });
    if (cfg.fill !== false) svg.appendChild(E("path", { d: d + ` L${W} ${H} L0 ${H} Z`, fill: cfg.color, opacity: .12 }));
    svg.appendChild(E("path", { d: d, fill: "none", stroke: cfg.color, "stroke-width": 1.4 }));
    svg.appendChild(E("circle", { cx: X(vals.length - 1), cy: Y(vals[vals.length - 1]), r: 2, fill: cfg.color }));
    host.appendChild(svg);
  }

  /* ============================================================
     HORIZONTAL BAR  cfg:{rows:[{label,val}], unit, height, color, fmt}
     ============================================================ */
  function hBar(host, cfg) {
    host.innerHTML = "";
    const W = Math.max(260, host.clientWidth || 520), rows = cfg.rows;
    const rh = cfg.rowH || 20, H = rows.length * rh + 16;
    const lw = cfg.labelW || 68, vw = 58;
    const max = Math.max(...rows.map(r => r.val || 0), .0001);
    const svg = E("svg", { class: "chart", viewBox: `0 0 ${W} ${H}`, width: "100%", height: H,
                           preserveAspectRatio: "none", style: `height:${H}px` });
    const iw = W - lw - vw;
    rows.forEach((r, i) => {
      const y = 8 + i * rh, w = Math.max(1, (r.val || 0) / max * iw);
      svg.appendChild(txt(lw - 8, y + rh / 2 + 3.5, r.label, { anchor: "end", size: 10.5, fill: "#3C4A57" }));
      const rect = E("rect", { x: lw, y: y + 3, width: w, height: rh - 8, fill: r.color || cfg.color || "#C2410C", rx: 1 });
      svg.appendChild(rect);
      svg.appendChild(txt(lw + w + 6, y + rh / 2 + 3.5, fmtNum(r.val, cfg.dec === undefined ? 0 : cfg.dec) + (cfg.unit ? " " + cfg.unit : ""),
                          { size: 10, fill: "#6B7885" }));
      rect.addEventListener("mousemove", ev => showTip(tipRows([{ color: r.color || cfg.color || "#C2410C",
        name: r.label, val: fmtNum(r.val, 1) + (cfg.unit ? " " + cfg.unit : "") }], r.label), ev.clientX, ev.clientY));
      rect.addEventListener("mouseleave", hideTip);
    });
    host.appendChild(svg);
  }

  function legend(host, items) {
    const d = document.createElement("div");
    d.className = "legend";
    d.innerHTML = items.map(i => i.line
      ? `<span><i class="ln" style="background:${i.color}"></i>${i.name}</span>`
      : `<span><i style="background:${i.color}"></i>${i.name}</span>`).join("");
    host.appendChild(d);
  }

  global.CH = { line, bar, hBar, diverge, heat, spark, legend, fmtNum, niceTicks, PALETTE, hideTip };
})(window);
