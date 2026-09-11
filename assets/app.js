/* ============================================================
   app.js — silicon value-chain terminal, organised by segment
   pages: ov / si / ps / wf / cl / md / model
   ============================================================ */
(function (g) {
  "use strict";
  const D = g.DATA;
  const $ = s => document.querySelector(s);
  const CH = g.CH;

  /* ---------------- helpers ---------------- */
  const last = a => (a || []).filter(v => v !== null && v !== undefined).slice(-1)[0];
  const pct = (a, b) => (a === null || b === null || !b ? null : (a - b) / Math.abs(b) * 100);
  const round = (v, n) => v === null || v === undefined ? null : Math.round(v * Math.pow(10, n)) / Math.pow(10, n);

  const SER = k => (D.smm && D.smm[k]) || null;
  const zip = s => s.dates.map((d, i) => [d, s.vals[i]]);
  function ser(k, name, color, opt) {
    const s = SER(k);
    if (!s) return null;
    return Object.assign({ name: name || s.label, color, data: zip(s) }, opt || {});
  }
  function pick(keys) { return keys.map(k => SER(k)).filter(Boolean); }
  function empty(host, msg) {
    if (host) host.innerHTML = `<div class="no-data">${msg || "该序列在 SMM 终端暂无可用数据"}</div>`;
  }

  /* KPI tiles -------------------------------------------------- */
  function tile(label, key, o) {
    o = o || {};
    const s = SER(key);
    if (!s) return null;
    const v = last(s.vals);
    const span = o.span || 6;                        // look-back window for delta
    const prev = s.vals.length > span ? s.vals[s.vals.length - 1 - span] : s.vals[0];
    const d = o.delta === "abs" ? (v - prev) : pct(v, prev);
    return {
      label, badge: o.badge || s.freq_cn || "", unit: o.unit || s.unit,
      value: v, delta: d, deltaMode: o.delta || "pct",
      invert: !!o.invert, spark: s.vals.slice(-o.spark || 40), color: o.color,
      note: o.note || (s.dates[s.dates.length - 1] || "").slice(0, 10)
    };
  }
  function autoVal(v) {
    const a = Math.abs(v || 0);
    if (a >= 1000) return CH.fmtNum(v, 0);
    if (a >= 100) return CH.fmtNum(v, 1);
    if (a < 1) return CH.fmtNum(v, 3);
    return CH.fmtNum(v, 2);
  }
  function renderKpis(host, tiles) {
    if (!host) return;
    const ok = tiles.filter(Boolean);
    host.innerHTML = ok.map(t => {
      const up = t.delta === null ? null : t.delta > 0;
      let cls = "";
      if (up !== null && Math.abs(t.delta) > 1e-9) {
        cls = t.invert ? (up ? "down" : "up") : (up ? "up" : "down");   // css: .up = red (涨)
      }
      const ds = t.delta === null ? "—"
        : (t.deltaMode === "abs" ? (t.delta > 0 ? "+" : "") + CH.fmtNum(t.delta, 0)
          : (t.delta > 0 ? "+" : "") + t.delta.toFixed(2) + "%");
      return `<div class="kpi${t.color ? " accent" : ""}">
        <div class="kpi-head"><span class="kpi-label">${t.label}</span>
          <span class="kpi-badge">${t.badge}</span></div>
        <div class="kpi-val">${autoVal(t.value)}
          <span class="kpi-unit">${t.unit}</span></div>
        <div class="kpi-foot">
          <span class="delta ${cls}">${ds}</span>
          <span class="kpi-note">${t.note}</span>
        </div>
        <svg class="spark" viewBox="0 0 100 26" preserveAspectRatio="none">
          ${sparkPath(t.spark, t.color || "#C2410C")}
        </svg>
      </div>`;
    }).join("");
  }
  function sparkPath(vals, color) {
    const v = vals.filter(x => x !== null && x !== undefined);
    if (v.length < 2) return "";
    const lo = Math.min(...v), hi = Math.max(...v), span = (hi - lo) || 1;
    const pts = v.map((x, i) => `${(i / (v.length - 1) * 100).toFixed(2)},${(24 - (x - lo) / span * 20).toFixed(2)}`);
    return `<polyline points="${pts.join(" ")}" fill="none" stroke="${color}" stroke-width="1.6"
      vector-effect="non-scaling-stroke" stroke-linejoin="round"/>`;
  }

  /* generic card renderers ------------------------------------ */
  function lineInto(host, cfg) { if (!host) return; CH.line(host, cfg); CH.legend(host, cfg.series.map(s => ({ name: s.name, color: s.color, line: s.dash ? 2 : 1, area: !!s.area }))); }
  function barInto(host, cfg) {
    if (!host) return;
    CH.bar(host, cfg);
    if (cfg.series.length > 1) CH.legend(host, cfg.series.map(s => ({ name: s.name, color: s.color })));
  }

  /* ============================ 01 overview ============================ */
  function renderOverview() {
    renderKpis($("#kpi-ov"), [
      tile("工业硅 553#（华东）", "si553_smm", { badge: "日度", spark: 60 }),
      tile("多晶硅 N型复投料", "ps_price", { badge: "日度", spark: 60 }),
      tile("硅片 N型183mm", "wf183", { badge: "日度", spark: 60 }),
      tile("电池片 Topcon-183", "cl_183", { badge: "日度", spark: 60 }),
      tile("组件 Topcon-210（分布式）", "md_210", { badge: "日度", spark: 60 }),
      tile("组件出口量", "md_exp", { badge: "月度", unit: "GW", delta: "pct", spark: 18 })
    ]);

    // price indices, 2025-01 = 100
    const defs = [
      ["si553_smm", "工业硅", "#94A3B8"], ["ps_price", "多晶硅", "#C2410C"],
      ["wf183", "硅片", "#0E7490"], ["cl_183", "电池片", "#B45309"], ["md_210", "组件", "#6D28D9"]
    ];
    const series = defs.map(([k, name, color]) => {
      const s = SER(k);
      if (!s) return null;
      const base = s.vals.find(v => v) || 1;
      return { name, color, data: s.dates.map((d, i) => [d, s.vals[i] / base * 100]) };
    }).filter(Boolean);
    lineInto($("#c-ov-index"), { height: 300, unit: "指数", series, zeroLine: false, endLabels: false, refs: [{ y: 100, label: "基期 2025-01 = 100", color: "#B6BFC7" }] });

    // cross-segment spreads (元/吨 vs 元/瓦 → keep units explicit, use per-unit price ratios instead)
    const sp = [
      ["ps_price", "wf183", "多晶硅 → 硅片", "#0E7490"],
      ["wf183", "cl_183", "硅片 → 电池片", "#B45309"],
      ["cl_183", "md_210", "电池片 → 组件", "#6D28D9"]
    ].map(([a, b, name, color]) => {
      const A = SER(a), B = SER(b);
      if (!A || !B) return null;
      const map = new Map(A.dates.map((d, i) => [d, A.vals[i]]));
      const raw = B.dates.filter(d => map.has(d)).map(d => [d, B.vals[B.dates.indexOf(d)] / map.get(d)]);
      const b0 = (raw.find(r => isFinite(r[1])) || [null, 1])[1];
      return { name, color, data: raw.map(r => [r[0], r[1] / b0 * 100]) };
    }).filter(Boolean);
    lineInto($("#c-ov-spread"), { height: 260, unit: "指数", series: sp, refs: [{ y: 100, label: "基期 = 100", color: "#B6BFC7" }] });

    // monthly output by segment
    const out = [
      ["wf_prodm", "硅片", "#0E7490", 1],
      ["cl_prod", "电池片", "#B45309", 1], ["md_prod", "组件", "#6D28D9", 1]
    ].map(([k, name, color]) => {
      const s = SER(k);
      if (!s) return null;
      return { name, color, data: zip(s) };
    }).filter(Boolean);
    lineInto($("#c-ov-output"), { height: 250, unit: "GW", series: out, endLabels: false });

    // inventories
    const inv = [
      ["si_inv", "工业硅（万吨）", "#94A3B8"], ["ps_inv", "多晶硅（万吨）", "#C2410C"],
      ["wf_invw", "硅片（GW）", "#0E7490"], ["cl_inv", "电池片（GW）", "#B45309"],
      ["md_inv", "组件（GW）", "#6D28D9"]
    ].map(([k, name, color]) => { const s = SER(k); return s ? { name, color, data: zip(s), area: false } : null; }).filter(Boolean);
    lineInto($("#c-ov-inv"), { height: 250, unit: "万吨 / GW", series: inv, endLabels: false });

    // exports
    const exp = [
      ["si_exp", "工业硅（万吨）", "#94A3B8"], ["wf_exp", "硅片（万吨）", "#0E7490"],
      ["cl_exp", "电池片（亿个）", "#B45309"], ["md_exp", "组件（GW）", "#6D28D9"]
    ].map(([k, name, color]) => { const s = SER(k); return s ? { name, color, data: zip(s) } : null; }).filter(Boolean);
    lineInto($("#c-ov-exp"), { height: 250, unit: "口径各异", series: exp, endLabels: false });

    // commentary
    const cell = $("#calls");
    if (cell) {
      const p553 = last(SER("si553_smm").vals), cost = D.cost.monthly.slice(-1)[0];
      const psP = last(SER("ps_price").vals), psC = last(SER("ps_cost") ? SER("ps_cost").vals : []);
      const mdP = last(SER("md_210").vals), mdC = SER("md_cost210") ? last(SER("md_cost210").vals) : null;
      const inv = D.pc.monthly.slice(-1);
      cell.innerHTML = [
        ["工业硅：成本线是价格的地板", [
          `553# 华东 <b>${CH.fmtNum(p553, 0)}</b> 元/吨，全国 553 现金成本 <b>${CH.fmtNum(cost["全国553成本"], 0)}</b> 元/吨。`,
          "西南丰水期结束后电价抬升，成本重心上移，供给弹性下降。"
        ]],
        ["多晶硅：利润最厚，库存仍高", [
          `N 型复投料 <b>${CH.fmtNum(psP, 2)}</b> 元/千克${psC ? `，行业平均成本 <b>${CH.fmtNum(psC, 2)}</b> 元/千克` : ""}。`,
          `厂家库存 <b>${CH.fmtNum(inv[0].inv_china, 1)}</b> 万吨，9 月产量回到 <b>11.8</b> 万吨。`
        ]],
        ["组件：技术溢价是唯一利润来源", [
          `TOPCon 210 分布式 <b>${CH.fmtNum(mdP, 3)}</b> 元/瓦${mdC ? `，总成本 <b>${CH.fmtNum(mdC, 3)}</b> 元/瓦` : ""}。`,
          "集中式招标价格贴成本运行，HJT / BC 的技术溢价决定了结构性机会。"
        ]]
      ].map(([t, items]) => `<div class="call"><div class="call-t">${t}</div><ul>${items.map(i => `<li>${i}</li>`).join("")}</ul></div>`).join("");
    }
  }

  /* ============================ 02 工业硅 ============================ */
  function renderSi() {
    renderKpis($("#kpi-si"), [
      tile("553#（华东）", "si553_smm", { badge: "现货", spark: 60 }),
      tile("421#（昆明）", "si421_km", { badge: "现货", spark: 60 }),
      tile("社会库存", "si_inv", { badge: "周度", unit: "万吨", invert: true }),
      tile("全国开工率", "si_oprate", { badge: "月度", unit: "%", invert: true }),
      tile("期货主力收盘", "si_fut", { badge: "GFEX", spark: 60 }),
      tile("金属硅出口量", "si_exp", { badge: "月度", unit: "万吨" })
    ]);

    const px = pick(["si553_smm", "si421_km", "si553_km", "si_fut"]).map((s, i) =>
      ({ key: s.id, name: (s.label || "").slice(0, 22) }));
    lineInto($("#c-si-price"), {
      height: 300, unit: "元/吨",
      series: [
        ser("si553_smm", "553#（华东）", "#C2410C"),
        ser("si421_km", "421#（昆明）", "#0E7490"),
        ser("si_fut", "期货主力", "#B45309", { dash: 4 })
      ].filter(Boolean)
    });

    const cost = D.cost.monthly.slice(-54);
    lineInto($("#c-si-cost"), {
      height: 264, unit: "元/吨", margin: { r: 82 },
      refs: [{ y: last(cost.map(m => m["全国553成本"])), label: "全国553现金成本", color: "#94A3B8" }],
      series: [
        { name: "全国553成本", color: "#94A3B8", data: cost.map(m => [m.d, m["全国553成本"]]) },
        { name: "通氧553#价格", color: "#C2410C", data: cost.map(m => [m.d, m["通氧553价格"]]) },
        { name: "全国421成本", color: "#B9C2CB", data: cost.map(m => [m.d, m["全国421成本"]]) },
        { name: "421#（昆明）价格", color: "#0E7490", data: cost.map(m => [m.d, m["421#价格"]]) }
      ]
    });

    const pr = cost.slice(-24);
    barInto($("#c-si-profit"), {
      cats: pr.map(m => m.d.slice(0, 7)), height: 264, unit: "元/吨",
      series: [
        { name: "553 现金利润", color: "#C2410C", data: pr.map(m => m["553盈利"]) },
        { name: "421 现金利润", color: "#0E7490", data: pr.map(m => m["421盈利"]) }
      ]
    });

    lineInto($("#c-si-power"), {
      height: 264, unit: "元/千瓦时", endLabels: true,
      series: [
        { name: "新疆石河子", color: "#C2410C", data: cost.map(m => [m.d, m["石河子电价"]]) },
        { name: "云南", color: "#0E7490", data: cost.map(m => [m.d, m["云南电价"]]) },
        { name: "四川", color: "#B45309", data: cost.map(m => [m.d, m["四川电价"]]) },
        { name: "福建三明", color: "#94A3B8", data: cost.map(m => [m.d, m["福建三明电价"]]) }
      ]
    });

    renderGyScenario();
    renderGyMix();
    gyAnnualTable();
    lineInto($("#c-si-inv"), {
      height: 260, unit: "万吨",
      series: [
        ser("si_inv", "社会库存合计", "#C2410C", { area: true }),
        ser("si_inv_km", "昆明", "#0E7490"),
        ser("si_inv_tj", "天津港", "#B45309"),
        ser("si_inv_hp", "黄埔港", "#94A3B8")
      ].filter(Boolean)
    });
    lineInto($("#c-si-op"), {
      height: 250, unit: "%",
      series: [
        ser("si_oprate", "全国", "#C2410C"),
        ser("si_op_xj", "新疆", "#0E7490"),
        ser("si_op_sc", "四川", "#B45309"),
        ser("si_op_yn", "云南", "#94A3B8")
      ].filter(Boolean)
    });
    const e = SER("si_exp");
    if (e) barInto($("#c-si-exp"), { cats: e.dates.map(d => d.slice(0, 7)), height: 240, unit: "万吨",
      series: [{ name: "金属硅出口量", color: "#94A3B8", data: e.vals }] });
    else empty($("#c-si-exp"));
  }

  function renderGyScenario() {
    const box = $("#si-scen");
    if (!box) return;
    const modes = [["landed", "成本政策落地"], ["not_landed", "政策不落地"]];
    box.innerHTML = modes.map(([k, n]) =>
      `<button class="seg${box.dataset.active === k ? " on" : ""}" data-scen="${k}">${n}</button>`).join("");
    const paint = key => {
      const d = D.derived["gy_" + key];
      if (!d) return;
      const months = d.months;
      lineInto($("#c-si-balance"), {
        height: 300, unit: "万吨", zeroLine: true, endLabels: false,
        series: [{ name: "供需差", color: "#B45309", area: true, data: months.map((m, i) => [m, d.balance[i]]) }],
        refs: []
      });
      const host = $("#c-si-balance");
      const cap = host.parentNode.querySelector(".chart-note");
      if (cap) cap.remove();
      const note = document.createElement("div");
      note.className = "chart-note";
      note.textContent = `情形：${modes.find(m => m[0] === key)[1]}`;
      host.parentNode.insertBefore(note, host);
    };
    box.querySelectorAll("button").forEach(b => b.addEventListener("click", () => {
      box.dataset.active = b.dataset.scen;
      box.querySelectorAll("button").forEach(x => x.classList.toggle("on", x === b));
      paint(b.dataset.scen);
    }));
    paint(box.dataset.active || "landed");
  }

  function renderGyMix() {
    const d = D.derived.gy_landed;
    if (!d) return;
    const months = d.months.slice(-24);
    const off = d.months.length - months.length;
    const stack = (obj) => Object.keys(obj).map((k, i) => ({
      name: k, color: CH.PALETTE[i % CH.PALETTE.length], data: obj[k].slice(off)
    }));
    barInto($("#c-si-mix"), {
      cats: months.map(m => m.slice(2)), stacked: true, height: 240, unit: "万吨",
      rotate: true, margin: { b: 40 }, series: stack(d.mix)
    });
    if (d.use) barInto($("#c-si-use"), {
      cats: months.map(m => m.slice(2)), stacked: true, height: 240, unit: "万吨",
      rotate: true, margin: { b: 40 }, series: stack(d.use)
    });
  }

  function gyAnnualTable() {
    const host = $("#t-si-annual");
    if (!host) return;
    const L = D.derived.gy_landed.annual, N = D.derived.gy_not_landed.annual;
    const ys = Object.keys(L);
    let html = '<table class="tbl"><thead><tr><th>年度</th><th>供应（政策落地）</th><th>需求</th><th>供需差</th>'
      + '<th>供应（不落地）</th><th>供需差</th></tr></thead><tbody>';
    ys.forEach(y => {
      const l = L[y], n = N[y];
      const cls = v => v > 0 ? "neg" : "pos";
      html += `<tr><td class="k">${y}</td><td>${CH.fmtNum(l.supply, 1)}</td><td>${CH.fmtNum(l.demand, 1)}</td>`
        + `<td class="${cls(l.balance)}">${l.balance > 0 ? "+" : ""}${CH.fmtNum(l.balance, 1)}</td>`
        + `<td>${CH.fmtNum(n.supply, 1)}</td><td class="${cls(n.balance)}">${n.balance > 0 ? "+" : ""}${CH.fmtNum(n.balance, 1)}</td></tr>`;
    });
    host.innerHTML = html + '</tbody></table><div class="tnote">单位：万吨。正值 = 过剩（累库），负值 = 短缺（去库）。</div>';
  }

  /* ============================ 03 多晶硅 ============================ */
  function renderPs() {
    renderKpis($("#kpi-ps"), [
      tile("N型复投料", "ps_price", { badge: "现货", spark: 60 }),
      tile("N型颗粒硅", "ps_gr", { badge: "现货", spark: 60 }),
      tile("厂家库存", "ps_inv", { badge: "周度", unit: "万吨", invert: true }),
      tile("开工率", "ps_oi", { badge: "月度", unit: "%" }),
      tile("周度产量", "ps_prodw", { badge: "周度", unit: "吨" }),
      tile("行业平均成本", "ps_cost", { badge: "日度", spark: 60, color: 1 })
    ]);

    lineInto($("#c-ps-price"), {
      height: 300, unit: "元/千克",
      refs: [{ y: 38.48, label: "对标价格 38.48", color: "#0E7490" }],
      series: [
        ser("ps_price", "N型复投料", "#C2410C"),
        ser("ps_gr", "N型颗粒硅", "#0E7490"),
        ser("ps_mix", "N型混包料", "#94A3B8")
      ].filter(Boolean)
    });
    lineInto($("#c-ps-cost"), {
      height: 300, unit: "元/千克",
      series: [
        ser("ps_price", "N型复投料价格", "#C2410C"),
        ser("ps_cost", "行业平均成本", "#94A3B8", { dash: 4 })
      ].filter(Boolean)
    });

    const s = D.derived.pc_monthly;
    if (s) {
      barInto($("#c-ps-balance"), {
        cats: s.months.map(m => m.slice(2)), height: 300, unit: "万吨", rotate: true, margin: { b: 44 },
        series: [
          { name: "中国产量", color: "#C2410C", data: s.prod_china },
          { name: "中国需求", color: "#0E7490", data: s.dem_china }
        ]
      });
      const balHost = $("#c-ps-balance");
      const gap = document.createElement("div");
      gap.id = "c-ps-gap";
      balHost.parentNode.insertBefore(gap, balHost.nextSibling);
      lineInto(gap, {
        height: 230, unit: "万吨", zeroLine: true, endLabels: false,
        series: [{ name: "供需差", color: "#B45309", area: true, data: s.months.map((m, i) => [m, s.balance_china[i]]) }]
      });
      CH.legend(gap, [{ name: "供需差（产量 − 需求）", color: "#B45309", line: 1, area: true }]);
    }
    lineInto($("#c-ps-op"), {
      height: 210, unit: "%",
      series: [ser("ps_oi", "多晶硅开工率", "#C2410C")].filter(Boolean)
    });
    lineInto($("#c-ps-op2"), {
      height: 200, unit: "吨",
      series: [ser("ps_prodw", "周度产量", "#0E7490", { area: true })].filter(Boolean)
    });
    // stage inventory + company heat
    const inv = D.inventory_co;
    if (inv) {
      const agg = new Set(["总计"]);
      const stage = ["上游总计", "中游总计", "下游总计"].map((n, i) => ({
        name: n.replace("总计", ""), color: ["#C2410C", "#EA7B3C", "#94A3B8"][i],
        data: (inv.rows.find(r => r.company === n) || { values: [] }).values
      }));
      barInto($("#c-ps-invstage"), {
        cats: inv.months.map(m => m.slice(2)), stacked: true, height: 280, unit: "万吨",
        series: stage
      });
      const rows = inv.rows.filter(r => !agg.has(r.company) && !r.company.endsWith("总计") && r.values.some(v => v))
        .sort((a, b) => (last(b.values) || 0) - (last(a.values) || 0)).slice(0, 14);
      CH.heat($("#c-ps-invheat"), {
        cols: inv.months.map(m => m.slice(2, 7)), rows: rows.map(r => ({ label: r.company, vals: r.values })),
        unit: "万吨", lo: 0, hi: 6, gamma: 0.85, rowH: 17, dec: 2
      });
      CH.legend($("#c-ps-invheat"), [{ name: "0 万吨", color: "#FDF6EF" }, { name: "3", color: "#F0A97A" }, { name: "6+", color: "#C2410C" }]);
    }
    // annual balance table
    const ann = D.derived.pc_annual, host2 = $("#t-ps-annual");
    if (ann && host2) {
      const ys = Object.keys(ann).filter(y => +y.slice(0, 4) >= 2023);
      host2.innerHTML = '<table class="tbl"><thead><tr><th>年度</th><th>产量</th><th>需求</th><th>供需差</th></tr></thead><tbody>'
        + ys.map(y => {
          const a = ann[y], b = a.balance_china;
          return `<tr><td class="k">${y}</td><td>${CH.fmtNum(a.prod_china, 1)}</td><td>${CH.fmtNum(a.dem_china, 1)}</td>`
            + `<td class="${b > 0 ? "neg" : "pos"}">${b > 0 ? "+" : ""}${CH.fmtNum(b, 1)}</td></tr>`;
        }).join("") + '</tbody></table><div class="tnote">单位：万吨。2026 年 9 月起为模型预测值。</div>';
    }
    // trade (workbook customs)
    const tr = D.trade;
    if (tr && $("#c-ps-trade")) {
      const im = tr.imports, ex = tr.exports;
      barInto($("#c-ps-trade"), {
        cats: (ex && ex.data ? ex.data : []).map(r => r.d.slice(0, 7)), height: 260, unit: "万吨",
        series: [
          { name: "出口量", color: "#C2410C", data: (ex && ex.data ? ex.data : []).map(r => r.v) },
          { name: "进口量", color: "#94A3B8", data: (ex && ex.data ? ex.data.map(r => {
              const hit = (im && im.data || []).find(x => x.d === r.d); return hit ? hit.v : null;
            }) : []) }
        ]
      });
    } else empty($("#c-ps-trade"), "海关序列缺失");
    // company production heat
    const S = D.supply;
    if (S && $("#c-ps-prod")) {
      const drop = new Set(["总计", "企业简称"]);
      const map = new Map();
      S.rows.forEach(r => {
        const n = (r.company || "").trim();
        if (!n || drop.has(n)) return;
        const cur = map.get(n) || S.months.map(() => null);
        r.values.forEach((v, i) => { if (v !== null && v !== undefined) cur[i] = round((cur[i] || 0) + v, 1); });
        map.set(n, cur);
      });
      const rows = Array.from(map, ([k, v]) => ({ label: k, vals: v }))
        .sort((a, b) => (last(b.vals) || 0) - (last(a.vals) || 0)).slice(0, 14);
      CH.heat($("#c-ps-prod"), {
        cols: S.months.map(m => m.slice(2, 7)), rows, unit: "吨", lo: 0, hi: 55000, gamma: 0.85, rowH: 17, dec: 0
      });
      CH.legend($("#c-ps-prod"), [{ name: "0", color: "#FDF6EF" }, { name: "2.5 万吨", color: "#F0A97A" }, { name: "5.5 万吨+", color: "#C2410C" }]);
    }
  }

  /* ============================ 04 硅片 ============================ */
  function renderWf() {
    renderKpis($("#kpi-wf"), [
      tile("N型183mm", "wf183", { badge: "现货", spark: 60 }),
      tile("N型210mm", "wf210", { badge: "现货", spark: 60 }),
      tile("硅片库存", "wf_invw", { badge: "周度", unit: "GW", invert: true }),
      tile("开工率", "wf_op", { badge: "月度", unit: "%" }),
      tile("月度产量", "wf_prodm", { badge: "月度", unit: "GW" }),
      tile("N183 单瓦利润", "wf_pt183", { badge: "日度", unit: "元/片", spark: 60, color: 1 })
    ]);
    lineInto($("#c-wf-price"), {
      height: 300, unit: "元/片",
      series: [
        ser("wf183", "N型183mm", "#C2410C"),
        ser("wf210", "N型210mm", "#0E7490"),
        ser("wf_idx", "N型硅片价格指数", "#94A3B8", { dash: 4 })
      ].filter(Boolean)
    });
    lineInto($("#c-wf-cost"), {
      height: 300, unit: "元/片", endLabels: true,
      series: [
        ser("wf_cost183", "N183 总成本", "#94A3B8"),
        ser("wf183", "N183 价格", "#C2410C"),
        ser("wf_pt183", "N183 利润", "#0E7490")
      ].filter(Boolean)
    });
    lineInto($("#c-wf-prod"), {
      height: 280, unit: "GW",
      series: [ser("wf_prodm", "月度产量", "#C2410C", { area: true }), ser("wf_prodw", "周度产量", "#94A3B8")].filter(Boolean)
    });
    lineInto($("#c-wf-op"), {
      height: 280, unit: "%",
      series: [ser("wf_op", "开工率", "#C2410C"), ser("wf_opf", "预测开工率", "#94A3B8", { dash: 4 })].filter(Boolean)
    });
    lineInto($("#c-wf-inv"), {
      height: 280, unit: "GW",
      series: [ser("wf_invw", "硅片库存（周度）", "#C2410C", { area: true }), ser("wf_invm", "企业硅片库存（月度）", "#94A3B8")].filter(Boolean)
    });
    const e = SER("wf_exp");
    e ? barInto($("#c-wf-exp"), { cats: e.dates.map(d => d.slice(0, 7)), height: 250, unit: e.unit,
      series: [{ name: "单晶硅片出口量", color: "#0E7490", data: e.vals }] }) : empty($("#c-wf-exp"));
    // company output heat
    const Q = D.demand;
    if (Q && $("#c-wf-heat")) {
      const map = new Map();
      const drop = new Set(["总计", "企业简称", "其他"]);
      Q.rows.forEach(r => {
        const n = (r.company || "").trim();
        if (!n || drop.has(n)) return;
        const cur = map.get(n) || Q.months.map(() => null);
        r.values.forEach((v, i) => { if (v !== null && v !== undefined) cur[i] = round((cur[i] || 0) + v, 2); });
        map.set(n, cur);
      });
      const rows = Array.from(map, ([k, v]) => ({ label: k, vals: v }))
        .sort((a, b) => (last(b.vals) || 0) - (last(a.vals) || 0)).slice(0, 16);
      CH.heat($("#c-wf-heat"), {
        cols: Q.months.map(m => m.slice(2, 7)), rows, unit: "GW", lo: 0, hi: 8, gamma: 0.85, rowH: 17, dec: 2
      });
      CH.legend($("#c-wf-heat"), [{ name: "0", color: "#FDF6EF" }, { name: "4 GW", color: "#F0A97A" }, { name: "8 GW+", color: "#C2410C" }]);
    }
    lineInto($("#c-wf-psinvin"), {
      height: 280, unit: "万吨",
      series: [ser("wf_psinvm", "硅片企业多晶硅库存", "#C2410C", { area: true })].filter(Boolean)
    });
    if (!SER("wf_psinvm")) empty($("#c-wf-psinvin"));
  }

  /* ============================ 05 电池片 ============================ */
  function renderCl() {
    renderKpis($("#kpi-cl"), [
      tile("Topcon 183mm", "cl_183", { badge: "现货", spark: 60 }),
      tile("Topcon 210mm", "cl_210", { badge: "现货", spark: 60 }),
      tile("厂内库存", "cl_inv", { badge: "周度", unit: "GW", invert: true }),
      tile("开工率", "cl_op", { badge: "月度", unit: "%" }),
      tile("月度产量", "cl_prod", { badge: "月度", unit: "GW" }),
      tile("N183 单瓦利润", "cl_pt183", { badge: "日度", unit: "元/瓦", spark: 60, color: 1 })
    ]);
    lineInto($("#c-cl-price"), {
      height: 300, unit: "元/瓦",
      series: [
        ser("cl_183", "Topcon 183mm", "#C2410C"),
        ser("cl_210", "Topcon 210mm", "#0E7490"),
        ser("cl_210r", "Topcon 210R", "#B45309")
      ].filter(Boolean)
    });
    lineInto($("#c-cl-cost"), {
      height: 300, unit: "元/瓦", endLabels: true,
      series: [
        ser("cl_cost183", "N183 总成本", "#94A3B8"),
        ser("cl_183", "N183 价格", "#C2410C"),
        ser("cl_pt183", "N183 利润", "#0E7490")
      ].filter(Boolean)
    });
    lineInto($("#c-cl-prod"), {
      height: 280, unit: "GW",
      series: [ser("cl_prod", "月度产量", "#C2410C", { area: true }), ser("cl_cap", "产能（GW/月）", "#94A3B8", { dash: 4 })].filter(Boolean)
    });
    lineInto($("#c-cl-op"), {
      height: 280, unit: "%",
      series: [ser("cl_op", "光伏电池开工率", "#C2410C"), ser("wf_op", "硅片开工率（对照）", "#94A3B8")].filter(Boolean)
    });
    lineInto($("#c-cl-inv"), {
      height: 280, unit: "GW",
      series: [ser("cl_inv", "电池厂库存", "#C2410C", { area: true })].filter(Boolean)
    });
    const e = SER("cl_exp");
    e ? barInto($("#c-cl-exp"), { cats: e.dates.map(d => d.slice(0, 7)), height: 250, unit: e.unit,
      series: [{ name: "电池片出口量（" + e.unit + "）", color: "#B45309", data: e.vals }] }) : empty($("#c-cl-exp"));
  }

  /* ============================ 06 组件 ============================ */
  function renderMd() {
    renderKpis($("#kpi-md"), [
      tile("Topcon-210（分布式）", "md_210", { badge: "现货", spark: 60 }),
      tile("Topcon-210R（分布式）", "md_210r", { badge: "现货", spark: 60 }),
      tile("中标均价", "md_bid", { badge: "周度", spark: 40 }),
      tile("成品库存", "md_inv", { badge: "周度", unit: "GW", invert: true }),
      tile("境内开工率", "md_opdom", { badge: "月度", unit: "%" }),
      tile("出口量", "md_exp", { badge: "月度", unit: "GW" })
    ]);
    lineInto($("#c-md-price"), {
      height: 300, unit: "元/瓦",
      series: [
        ser("md_210", "Topcon 210（分布式）", "#C2410C"),
        ser("md_210r", "Topcon 210R（分布式）", "#0E7490"),
        ser("md_hjt", "HJT 210（分布式）", "#B45309"),
        ser("md_bc", "BC 210R（分布式）", "#6D28D9")
      ].filter(Boolean)
    });
    const bid = SER("md_bid");
    lineInto($("#c-md-price2"), {
      height: 300, unit: "元/瓦",
      series: [ser("md_210rc", "TOPCon 210R（集中式）", "#C2410C"),
               bid ? { name: "中标均价（周度）", color: "#0E7490", data: zip(bid) } : null].filter(Boolean)
    });
    lineInto($("#c-md-cost"), {
      height: 300, unit: "元/瓦", endLabels: true,
      series: [
        ser("md_cost210", "N210 总成本", "#94A3B8"),
        ser("md_210", "N210 价格（分布式）", "#C2410C"),
        ser("md_pt210", "N210 利润", "#0E7490")
      ].filter(Boolean)
    });
    const prodS = SER("md_prod"), prodN = SER("md_prodn"), plan = SER("md_plan");
    if (prodS) barInto($("#c-md-prod"), {
      cats: prodS.dates.map(d => d.slice(0, 7)), height: 300, unit: "GW",
      series: [
        { name: "总产量", color: "#C2410C", data: prodS.vals },
        prodN ? { name: "其中 N 型", color: "#EA7B3C", data: prodN.vals } : null,
        plan ? { name: "境内排产", color: "#94A3B8", data: plan.vals } : null
      ].filter(Boolean)
    }); else empty($("#c-md-prod"));
    lineInto($("#c-md-op"), {
      height: 280, unit: "%",
      series: [ser("md_op", "整体开工率", "#C2410C"), ser("md_opdom", "境内", "#0E7490"), ser("md_opovs", "境外", "#B45309")].filter(Boolean)
    });
    lineInto($("#c-md-inv"), {
      height: 280, unit: "GW",
      series: [ser("md_inv", "国内成品库存（周度）", "#C2410C", { area: true }), ser("md_inveu", "欧洲库存（月度）", "#0E7490")].filter(Boolean)
    });
    const e = SER("md_exp");
    e ? barInto($("#c-md-exp"), { cats: e.dates.map(d => d.slice(0, 7)), height: 250, unit: "GW",
      series: [{ name: "组件出口量（GW）", color: "#6D28D9", data: e.vals }] }) : empty($("#c-md-exp"));
    const i = SER("md_inst");
    i ? lineInto($("#c-md-inst"), { height: 250, unit: "GW", series: [{ name: "全球新增装机", color: "#0E7490", area: true, data: zip(i) }] })
      : empty($("#c-md-inst"));
  }

  /* ============================ 07 model ============================ */
  function renderModel() {
    const all = D.score || [];
    const scored = all.filter(r => r.item && (r.bull_score || r.bear_score));
    const unscored = all.filter(r => r.item && !r.bull_score && !r.bear_score)
      .map(r => (r.group ? r.group + "·" : "") + r.item);
    CH.diverge($("#c-score"), {
      rows: scored.map(r => ({ label: (r.group ? r.group + "·" : "") + r.item, pos: +r.bull_score || 0, neg: +r.bear_score || 0 })),
      posName: "多头分数", negName: "空头分数", height: 30
    });
    CH.legend($("#c-score"), [{ name: "多头分数（右）", color: "#0E7490" }, { name: "空头分数（左）", color: "#C2410C" }]);
    const note = $("#score-note");
    if (note) note.textContent = unscored.length
      ? `下列维度在模型中暂无打分数据，未计入合计：${unscored.join("、")}。`
      : "";
    const host = $("#t-score");
    if (host) {
      host.innerHTML = '<table class="tbl"><thead><tr><th>板块</th><th>因子</th><th>权重</th><th>当前值</th>'
        + '<th>均值</th><th>多头系数</th><th>空头系数</th><th>多头分</th><th>空头分</th></tr></thead><tbody>'
        + scored.map(r => `<tr><td>${r.group || "—"}</td><td class="k">${r.item}</td><td>${CH.fmtNum(r.weight, 2)}</td>`
          + `<td>${CH.fmtNum(r.current, 2)}</td><td>${CH.fmtNum(r.avg, 2)}</td><td>${CH.fmtNum(r.bull_k, 2)}</td>`
          + `<td>${CH.fmtNum(r.bear_k, 2)}</td><td>${CH.fmtNum(r.bull_score, 2)}</td><td>${CH.fmtNum(r.bear_score, 2)}</td></tr>`).join("")
        + '</tbody></table>';
    }
    const sumB = scored.reduce((a, r) => a + (r.bull_score || 0), 0);
    const sumS = scored.reduce((a, r) => a + (r.bear_score || 0), 0);
    const src = $("#t-sources");
    if (src) src.innerHTML = `<ul class="list">
      <li><b>SMM 终端数据库</b>：现货价格（工业硅、多晶硅、硅片、电池片、组件）、库存、开工率、成本与利润、产量、进出口。经 MCP / API 直取，日度与月度序列。</li>
      <li><b>内部平衡表与成本模型</b>：工业硅两种情形的供需平衡、多晶硅供需平衡（2023–2030）、成本要素（电价、硅石、电极）与现金利润、企业产量与库存矩阵、海关进出口、因子评分表。</li>
      <li><b>更新频率</b>：日度序列随 SMM 更新，月度平衡表按月刷新。</li>
    </ul>
    <div class="tnote">合计：多头 ${CH.fmtNum(sumB, 2)} / 空头 ${CH.fmtNum(sumS, 2)}（净信号 ${CH.fmtNum(sumB - sumS, 2)}，正值偏多）。</div>`;
    const method = $("#t-method");
    if (method) method.innerHTML = `<ul class="list">
      <li>价格为 SMM 现货含税均价，日度为工作日更新；库存与开工率按 SMM 口径（周度 / 月度）。</li>
      <li>热力图为量级对比，颜色上下限为固定值（多晶硅产量 0–5.5 万吨、硅片产量 0–8 GW、库存 0–6 万吨），超出上限会饱和。</li>
      <li>工业硅供需平衡表为内部模型：情形一为成本与能耗政策落地（落后产能出清），情形二为政策不落地。</li>
      <li>多晶硅年度表自 2023 年起——内部模型对更早年份的需求数据缺失；2026 年 9 月起为预测值。</li>
      <li>本页数据仅供研究参考，不构成任何投资建议；预测值依赖模型假设，实际结果可能存在重大偏差。</li>
    </ul>`;
  }

  /* ============================ router ============================ */
  const RENDER = { ov: renderOverview, si: renderSi, ps: renderPs, wf: renderWf, cl: renderCl, md: renderMd, model: renderModel };
  const done = {};
  function show(key) {
    document.querySelectorAll(".page").forEach(p => p.classList.toggle("active", p.dataset.key === key));
    document.querySelectorAll(".tab").forEach(b => b.classList.toggle("active", b.dataset.page === key));
    if (!done[key]) { (RENDER[key] || (() => {}))(); done[key] = true; }
    else { document.querySelectorAll(".page.active .chart").forEach(sv => sv.dispatchEvent(new Event("chart-rerender"))); }
    // re-measure charts in the newly visible page (widths were 0 while hidden)
    document.querySelectorAll(".page.active [id^=c-]").forEach(() => {});
    window.scrollTo({ top: 0, behavior: "instant" in document.documentElement.style ? "instant" : "auto" });
    location.hash = key;
  }
  g.showPage = show;

  function boot() {
    const asof = (D.meta && D.meta.asof) || "";
    const el = $("#m-asof");
    if (el) el.textContent = asof || "—";
    document.querySelectorAll(".tab").forEach(b => b.addEventListener("click", () => show(b.dataset.page)));
    const start = (location.hash || "").replace("#", "");
    show(RENDER[start] ? start : "ov");
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})(window);
