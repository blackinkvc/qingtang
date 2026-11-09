/* ============================================================
   青棠宗 · 拾茧  /  store.js
   跨页共用的茧库：同一枚茧在 裂缝 / 育茧畦 / 孵房 / 贩卖
   都保持拾到时的品类、颜色、纹理与大小。
   ============================================================ */
(function (w) {
  'use strict';

  var KEY = 'qt.save.v1';

  /* —— 茧的五种品类：底色 / 亮面 / 暗面 —— */
  var KINDS = [
    { n: '青皮茧', y: '木', base: '#7E8C74', light: '#ABB79C', dark: '#525E49' },
    { n: '赭纹茧', y: '土', base: '#A5764F', light: '#C69E77', dark: '#6C4A2F' },
    { n: '白霜茧', y: '金', base: '#CDC5B2', light: '#E7E1D1', dark: '#968E7B' },
    { n: '朱砂茧', y: '火', base: '#9C3B31', light: '#C06A5E', dark: '#66211A' },
    { n: '藕紫茧', y: '水', base: '#7A5F76', light: '#9E879A', dark: '#4E3A4B' }
  ];

  var RAR = ['', '凡', '良', '珍', '秘', '绝'];
  /* 宗门明码价 */
  var PRICE = [0, 12, 30, 65, 120, 220];
  /* 同门建议价 */
  var SUGGEST = [0, 18, 42, 90, 168, 300];
  /* 同门基础成交率（按建议价挂出时） */
  var BASE_P = [0, .90, .82, .72, .62, .50];

  /* —— 缝势四段：增速（点/分钟）与区间名 —— */
  var RIFT = [
    { max: 39,  rate: .28, n: '平静' },
    { max: 69,  rate: .38, n: '扩张' },
    { max: 89,  rate: .50, n: '将启' },
    { max: 99,  rate: .65, n: '欲开' },
    { max: 100, rate: 0,   n: '魔染' }
  ];

  /* —— 六境：意志上限 / 单次弥合 / 回复间隔（秒） —— */
  var RANKS = [
    null,
    { n: '凡俗', willMax: 40,  dr: 4,  regen: 90 },
    { n: '引气', willMax: 55,  dr: 6,  regen: 80 },
    { n: '筑基', willMax: 75,  dr: 9,  regen: 70 },
    { n: '开光', willMax: 100, dr: 13, regen: 60 },
    { n: '结丹', willMax: 135, dr: 18, regen: 50 },
    { n: '化神', willMax: 180, dr: 24, regen: 40 }
  ];

  var DEMO_KEY = 'qt.demo';

  var STAGES = [
    { k: '初敛', d: '茧衣新结，尚在收气；触之微凉，丝线未紧。' },
    { k: '温热', d: '内里生温，隔衣可觉；丝线渐松，隐约有气。' },
    { k: '将动', d: '偶有轻颤，壳上现一线细裂；贴耳可闻细响。' },
    { k: '欲破', d: '裂口透光，内物欲出；再候一刻，便要自破。' }
  ];

  var S = null;

  function now() { return Date.now(); }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function rnd(a, b) { return a + Math.random() * (b - a); }

  function mk(kind, r, src) {
    S.seq++;
    if (!S.seen) S.seen = {};
    S.seen['c:' + kind + ':' + r] = 1;
    return {
      id: 'q' + S.seq,
      kind: kind,
      r: r,
      w: +rnd(.88, 1.13).toFixed(2),   /* 大小差异 */
      h: Math.round(rnd(-9, 9)),        /* 色相偏移 */
      pat: Math.floor(Math.random() * 4), /* 纹理 */
      src: src || 'rift'
    };
  }

  function seed() {
    var t = now(), D = 90 * 60000;
    S = {
      v: 2, seq: 0,
      stone: 480, shen: 72, shenMax: 100, ti: 64, tiMax: 100,
      rank: 3, will: 62, willMax: 75, willAt: t,
      rift: { r: 34.2, at: t, tainted: false },
      clarity: 100, clarityMax: 100,
      path: null, debt: 0, incident: null,
      whispers: 0,
      heard: [],
      seen: {}, mends: 0, hadRift: false, hadBond: false, steals: 0, taints: 0,
      secrets: { p: 0, stolen: 0, hidden: 0, hiddenW: 0, fines: 0, off: 0 },
      gods: { g1: { favor: 0, kin: false, ask: true }, g2: { favor: 0, kin: false, ask: true }, g3: { favor: 0, kin: false, ask: true } },
      pick: 0,
      codex: [],
      bag: [], plots: [], house: [], listings: [], vault: { edge: 1, shell: 2, dan: 0 }
    };
    /* 囊中：四枚，品阶与来历不同，贩卖页一进去就有货 */
    S.bag.push(mk(0, 1, 'rift'));
    S.bag.push(mk(1, 2, 'rift'));
    S.bag.push(mk(3, 2, 'stolen'));
    S.bag.push(mk(4, 3, 'plot'));
    /* 畦中：两格，一格已熟 */
    S.plots.push({ c: mk(1, 2, 'rift'), at: t - 40000, ripeAt: t - 12000 });
    S.plots.push({ c: mk(0, 1, 'rift'), at: t - 2000, ripeAt: t + 4000 });
    /* 孵房：四枚，正处四段，各有各的长相 */
    var off = [3 * 60000, 34 * 60000, 57 * 60000, 80 * 60000];
    var kinds = [2, 1, 0, 4], ranks = [1, 2, 2, 4];
    for (var i = 0; i < 4; i++) {
      S.house.push({ c: mk(kinds[i], ranks[i], i === 3 ? 'stolen' : 'rift'),
                     at: t - off[i], dur: D });
    }
    return S;
  }

  function migrate(d) {
    d.v = 2;
    d.rank = d.rank || 3;
    d.willMax = RANKS[d.rank].willMax;
    if (typeof d.will !== 'number') d.will = 62;
    if (!d.willAt) d.willAt = now();
    if (!d.rift) d.rift = { r: 34.2, at: now(), tainted: false };
    if (typeof d.clarity !== 'number') d.clarity = 100;
    if (!d.secrets) d.secrets = { p: 0, stolen: 0, hidden: 0, hiddenW: 0, fines: 0, off: 0 };
    if (!d.gods) d.gods = { g1: { favor: 0, kin: false }, g2: { favor: 0, kin: false }, g3: { favor: 0, kin: false } };
    if (typeof d.clarityMax !== 'number') d.clarityMax = 100;
    if (typeof d.secrets.hiddenW !== 'number') d.secrets.hiddenW = d.secrets.hidden || 0;
    if (typeof d.secrets.off !== 'number') d.secrets.off = 0;
    if (!d.codex) d.codex = [];
    if (typeof d.whispers !== 'number') d.whispers = 0;
    if (!d.heard) d.heard = [];
    if (typeof d.path === 'undefined') d.path = null;
    if (typeof d.debt !== 'number') d.debt = 0;
    if (!d.incident) d.incident = null;
    if (!d.seen) d.seen = {};
    if (typeof d.mends !== 'number') d.mends = 0;
    if (typeof d.hadRift !== 'boolean') d.hadRift = false;
    if (typeof d.hadBond !== 'boolean') d.hadBond = false;
    if (typeof d.steals !== 'number') d.steals = 0;
    if (typeof d.taints !== 'number') d.taints = 0;
    return d;
  }

  function load() {
    if (S) return S;
    try {
      var raw = w.localStorage.getItem(KEY);
      if (raw) {
        var d = JSON.parse(raw);
        if (d && d.v === 2) { S = d; return S; }
        if (d && d.v === 1) { S = migrate(d); return S; }
      }
    } catch (e) {}
    return seed();
  }

  function save() {
    if (S) { riftSync(); willSync(); }
    try { w.localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {}
  }

  function reset() {
    try { w.localStorage.removeItem(KEY); } catch (e) {}
    S = null; return load(), save(), S;
  }

  /* —— 成熟度 —— */
  function prog(h) { return clamp((now() - h.at) / h.dur, 0, 1); }
  function stageOf(h) {
    var p = prog(h);
    var i = p < .25 ? 0 : p < .5 ? 1 : p < .75 ? 2 : 3;
    return { i: i, p: p, k: STAGES[i].k, d: STAGES[i].d, left: Math.max(0, h.at + h.dur - now()) };
  }
  function fmt(ms) {
    var s = Math.max(0, Math.round(ms / 1000));
    var h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), x = s % 60;
    var p2 = function (n) { return ('0' + n).slice(-2); };
    return h ? h + ':' + p2(m) + ':' + p2(x) : p2(m) + ':' + p2(x);
  }

  /* —— 演示倍率：只在本地生效，线上恒为 1 —— */
  function isLocal() {
    var h = w.location.hostname;
    return w.location.protocol === 'file:' || h === 'localhost' || h === '127.0.0.1' || h === '';
  }
  function demo() {
    if (!isLocal()) return 1;
    var v = +(w.localStorage.getItem(DEMO_KEY) || 1);
    return (v >= 1 && v <= 12) ? v : 1;
  }
  function setDemo(v) {
    try { w.localStorage.setItem(DEMO_KEY, String(v)); } catch (e) {}
  }

  /* —— 缝势 —— */
  function rateAt(r) {
    if (r >= 100) return 0;
    if (r < 40) return .28;
    if (r < 70) return .38;
    if (r < 90) return .50;
    return .65;
  }
  function applyRate(r, mins) {
    var guard = 0;
    while (mins > 1e-9 && r < 100 && guard++ < 20) {
      var rt = rateAt(r);
      if (!rt) break;
      var bound = r < 40 ? 40 : r < 70 ? 70 : r < 90 ? 90 : 100;
      var need = (bound - r) / rt;
      if (mins >= need) { r = bound; mins -= need; }
      else { r += rt * mins; mins = 0; }
    }
    return Math.min(100, r);
  }
  function riftNow() {
    var mins = (now() - S.rift.at) / 60000 * demo();
    return applyRate(S.rift.r, mins);
  }
  function riftSync() {
    if (!S || !S.rift) return;
    if (S.rift.r >= 100 && !S.rift.tainted) S.taints = (S.taints || 0) + 1;
    S.rift.r = +riftNow().toFixed(2);
    S.rift.at = now();
    S.rift.tainted = S.rift.r >= 100 ? true : (S.rift.tainted && S.rift.r >= 70);
  }
  function isTainted() {
    var r = riftNow();
    return r >= 100 || (S.rift.tainted && r >= 70);
  }
  function riftStage() {
    var r = riftNow();
    var n = r >= 100 ? '魔染' : r >= 90 ? '欲开' : r >= 70 ? '将启' : r >= 40 ? '扩张' : '平静';
    return { r: +r.toFixed(1), n: n, tainted: isTainted() };
  }
  /* 茧速：只由缝势决定；魔染时再快一档 */
  function intervalSec() {
    var r = riftNow();
    var s = 12 * (1 - .62 * Math.pow(r / 100, 1.15));
    if (isTainted()) s = Math.max(4.2, s / 1.25);
    return s;
  }

  /* —— 意志与弥合 —— */
  function willNow() {
    var R = RANKS[S.rank] || RANKS[3];
    if (S.will >= R.willMax) return R.willMax;
    var iv = R.regen * 1000 / demo();
    var g = Math.floor((now() - (S.willAt || now())) / iv);
    return Math.min(R.willMax, S.will + g);
  }
  function willSync() {
    if (!S) return;
    var R = RANKS[S.rank] || RANKS[3];
    S.willMax = R.willMax;
    S.will = Math.floor(willNow());
    S.willAt = now();
  }
  function mend() {
    var R = RANKS[S.rank] || RANKS[3];
    var w0 = Math.floor(willNow());
    if (w0 < 10) return { ok: false, why: '意志不足' };
    var before = +riftNow().toFixed(1);
    S.rift.r = before; S.rift.at = now();
    S.will = w0 - 10; S.willAt = now();
    S.rift.r = Math.max(0, +(S.rift.r - R.dr).toFixed(2));
    S.rift.tainted = S.rift.r >= 100 ? true : (S.rift.tainted && S.rift.r >= 70);
    S.mends = (S.mends || 0) + 1;
    save();
    return { ok: true, before: before, after: +S.rift.r.toFixed(1), dr: R.dr, will: S.will };
  }
  function setRank(n) {
    n = clamp(Math.round(n), 1, 6);
    S.rank = n;
    S.willMax = RANKS[n].willMax;
    if (S.will > S.willMax) S.will = S.willMax;
    S.willAt = now();
    save();
    return S.rank;
  }

  /* —— 风险 —— */
  function riskOf(c) {
    var s = c.r + (c.src === 'stolen' ? 2 : 0) + (c.r >= 4 ? 1 : 0);
    if (s <= 2) return { t: '低', cls: 'safe', d: '常见品类，多半是死物。' };
    if (s <= 4) return { t: '中', cls: 'warn', d: '来历清楚，未必安分。' };
    if (s <= 5) return { t: '高', cls: 'bad', d: '此品阶少见，开前须备镇压。' };
    return { t: '凶', cls: 'bad', d: '来路不正，或为活物，开前须备镇压。' };
  }

  /* —— 同门挂单：概率与等待 —— */
  function quote(c, price) {
    var sug = SUGGEST[c.r] || 12;
    var base = BASE_P[c.r] || .5;
    var dev = (price - sug) / sug;
    var adj = dev >= 0 ? Math.exp(-2.1 * dev)
                       : 1 + Math.min(.14, (-dev) * .55);
    var p = clamp(base * adj + (c.r >= 4 ? .03 : 0), .03, .95);
    var lo = clamp(p - .07, .01, .97), hi = clamp(p + .07, .03, .99);
    var wLo = Math.round(8 + (1 - p) * 10), wHi = Math.round(wLo + 10 + (1 - p) * 9);
    return { sug: sug, p: p, lo: lo, hi: hi, wLo: wLo, wHi: wHi };
  }

  /* —— 茧的样子：按拾到时的品类 / 大小 / 色相 / 纹理画 —— */
  function svg(c, opt) {
    opt = opt || {};
    var K = KINDS[c.kind] || KINDS[0];
    var wf = c.w || 1;
    var rx = 30 * wf, ry = 48 * wf, cy = 96;
    var s = wf;
    var gid = 'g' + c.id + (opt.sfx || '');
    var pat = c.pat || 0;
    var lines = '';

    if (pat === 0) {
      lines = 'M45 58 C41 92 43 128 49 148M52 52 C48 90 48 130 53 152'
            + 'M60 50 C58 90 58 132 60 154M68 52 C72 90 72 130 67 152'
            + 'M75 58 C79 92 77 128 71 148';
    } else if (pat === 1) {
      lines = 'M33 76 C50 87 70 87 87 76M31 96 C50 108 70 108 89 96'
            + 'M33 116 C50 128 70 128 87 116M37 134 C52 143 68 143 83 134';
    } else if (pat === 2) {
      lines = 'M36 66 C50 100 60 132 70 148M44 56 C58 92 70 124 80 144'
            + 'M52 50 C66 86 78 118 88 134M56 66 C42 100 34 130 30 146';
    } else {
      lines = 'M36 66 C50 100 60 132 70 148M44 56 C58 92 70 124 80 144'
            + 'M84 66 C70 100 60 132 50 148M76 56 C62 92 50 124 40 144'
            + 'M33 96 C50 106 70 106 87 96';
    }

    return '<svg viewBox="0 0 120 168" role="img" aria-label="' + K.n + '">'
      + '<defs><linearGradient id="' + gid + '" x1="0" y1="0" x2="1" y2="1">'
      + '<stop offset="0" stop-color="' + K.light + '"/>'
      + '<stop offset=".55" stop-color="' + K.base + '"/>'
      + '<stop offset="1" stop-color="' + K.dark + '"/></linearGradient></defs>'
      + '<g style="filter:hue-rotate(' + (c.h || 0) + 'deg)">'
      + '<line x1="60" y1="4" x2="60" y2="' + (cy - ry + 2).toFixed(1) + '" '
      + 'stroke="' + K.dark + '" stroke-width="1.1" opacity=".5"/>'
      + '<ellipse cx="60" cy="' + cy + '" rx="' + rx.toFixed(1) + '" ry="' + ry.toFixed(1) + '" '
      + 'fill="url(#' + gid + ')" stroke="' + K.dark + '" stroke-opacity=".5" stroke-width="1.1"/>'
      + '<g transform="translate(60 ' + cy + ') scale(' + s.toFixed(3) + ') translate(-60 -' + cy + ')" '
      + 'fill="none" stroke="' + K.dark + '" stroke-opacity=".42" stroke-width=".95">'
      + '<path d="' + lines + '"/></g>'
      + '<ellipse cx="' + (60 - rx * .34).toFixed(1) + '" cy="' + (cy - ry * .36).toFixed(1) + '" '
      + 'rx="' + (rx * .26).toFixed(1) + '" ry="' + (ry * .3).toFixed(1) + '" '
      + 'fill="rgba(255,255,255,.26)" transform="rotate(-16 ' + (60 - rx * .34).toFixed(1) + ' ' + (cy - ry * .36).toFixed(1) + ')"/>'
      + '</g></svg>';
  }

  /* ============================================================
     阶段二 · 鉴定 / 私藏 / 罚金 / 两条负债路
     ============================================================ */

  function appCost(r) { return 4 + 3 * r; }
  function floor5(v) { return Math.max(5, Math.round(v / 5) * 5); }

  /* 私藏记：已鉴 1 记，未鉴 1.3 记；偷取 1.5 记；缴罚清去一半 */
  function secretP() {
    var s = S.secrets;
    return Math.max(0, (s.hiddenW || 0) + 1.5 * (s.stolen || 0) - (s.off || 0));
  }
  function syncP() { S.secrets.p = +secretP().toFixed(1); return S.secrets.p; }

  function appraise(c) {
    var fee = appCost(c.r);
    if (S.stone < fee) return { ok: false, why: '灵石不足（需 ' + fee + '）' };
    var cl = S.clarity;
    var e = .15 + (100 - cl) / 100 * .45;
    if (typeof c._t !== 'number') c._t = Math.random();
    var truth = c._t;
    if (S.gods.g1.kin || S.gods.g2.kin || S.gods.g3.kin) truth = Math.min(.995, truth + .08);
    var real = truth < .22 ? '凶' : truth > .78 ? '吉' : '平';
    var mis = (100 - cl) / 100 * .35;
    var say = real;
    if (Math.random() < mis) {
      var alt = ['凶', '平', '吉'].filter(function (x) { return x !== real; });
      say = alt[Math.floor(Math.random() * alt.length)];
    }
    var V = PRICE[c.r] * rnd(.55, 1.45);
    var lo = floor5(V * (1 - e)), hi = floor5(V * (1 + e));
    S.stone -= fee;
    c.appraised = { v: say, lo: lo, hi: hi, fee: fee, at: now(), rift: +riftNow().toFixed(1), e: +e.toFixed(2) };
    S.codex.unshift({
      id: c.id, kind: c.kind, r: c.r, v: say, lo: lo, hi: hi,
      fee: fee, at: c.appraised.at, rift: c.appraised.rift
    });
    if (S.codex.length > 60) S.codex.length = 60;
    save();
    return { ok: true, a: c.appraised };
  }

  /* 私藏：移入孵房，记一笔，并作一次判定 */
  function hide(c) {
    var i = -1;
    for (var k = 0; k < S.bag.length; k++) if (S.bag[k].id === c.id) { i = k; break; }
    if (i < 0) return { ok: false, why: '囊中无此茧' };
    S.bag.splice(i, 1);
    S.secrets.hidden += 1;
    S.secrets.hiddenW += c.appraised ? 1 : 1.3;
    c.hidden = true;
    S.house.push({ c: c, at: now(), dur: 90 * 60000, secret: true });
    syncP();
    var chk = foundCheck(c.r);
    if (chk.found) S.incident = { fine: chk.fine, r: c.r, kind: 'hide', at: now() };
    save();
    return { ok: true, chk: chk };
  }

  function pFound(r) {
    var P = secretP();
    return clamp(.03 + .028 * P + .06 * (r - 1) - .012 * S.rank
      + .0015 * (100 - S.clarity) + rnd(-.02, .02), .01, .92);
  }

  function fineOf(P, r) {
    return Math.max(5, Math.round(PRICE[r] * (1 + .35 * P) * rnd(.8, 1.2) / 5) * 5);
  }

  /* 每次私藏 / 偷取各一次。测试钩子：window.__qtfound = 'yes' | 'no' */
  function foundCheck(r) {
    var p = pFound(r);
    var force = w.__qtfound;
    var hit = force === 'yes' ? true : force === 'no' ? false : Math.random() < p;
    if (!hit) { save(); return { found: false, p: +p.toFixed(3) }; }
    var F = fineOf(secretP(), r);
    return { found: true, p: +p.toFixed(3), fine: F, pay: S.stone >= F };
  }

  function payFine() {
    var inc = S.incident;
    if (!inc) return { ok: false };
    if (S.stone < inc.fine) return { ok: false, why: '灵石不足' };
    S.stone -= inc.fine;
    S.secrets.fines += 1;
    var half = secretP() * .5;
    S.secrets.off += half;
    syncP();
    S.incident = null;
    save();
    return { ok: true, fine: inc.fine, p: S.secrets.p };
  }

  /* —— 两条负债路 —— */
  function enterRift() {
    S.path = 'rift';
    S.hadRift = true;
    S.stone = 0; S.rank = 1; S.willMax = RANKS[1].willMax; S.will = 0; S.willAt = now();
    S.bag = []; S.plots = []; S.house = []; S.listings = [];
    S.incident = null;
    S.secrets.off += secretP();
    S.secrets.stolen = 0; S.secrets.hiddenW = 0; S.secrets.hidden = 0;
    syncP();
    save();
    return S.path;
  }

  function signBond(F) {
    S.path = 'bond';
    S.hadBond = true;
    S.debt = F;
    S.stone = 0;
    S.secrets.fines += 1;
    S.secrets.off += secretP() * .5;
    syncP();
    S.incident = null;
    save();
    return S.path;
  }

  /* 杂役：拾茧时抵去部分债 */
  function bondWork() {
    if (S.path !== 'bond' || S.debt <= 0) return { done: false };
    var cut = Math.min(S.debt, 3);
    S.debt -= cut;
    var freed = S.debt <= 0;
    if (freed) { S.path = null; S.debt = 0; }
    save();
    return { done: true, cut: cut, freed: freed };
  }

  function sectPrice(r) {
    var v = PRICE[r] || 0;
    return S.path === 'bond' ? Math.max(1, Math.round(v * .7)) : v;
  }

  /* —— 偷取：得茧 / 失手，各作一次判定 —— */
  function steal() {
    if (S.ti < 8) return { ok: false, why: '体力不足（需 8）' };
    S.ti -= 8;
    S.steals = (S.steals || 0) + 1;
    var got = Math.random() < .55, c = null;
    if (got) {
      c = mk(Math.floor(Math.random() * 5), 1 + Math.floor(Math.random() * 3), 'stolen');
      S.bag.push(c);
      S.secrets.stolen += 1;
      syncP();
    }
    var chk = S.path === 'rift' ? { found: false, p: 0 } : foundCheck(c ? c.r : 1);
    if (chk.found) S.incident = { fine: chk.fine, r: c ? c.r : 1, kind: 'steal', at: now() };
    save();
    return { ok: true, got: got, c: c, chk: chk };
  }

  /* ============================================================
     阶段三 · 低语 / 眷属 / 清明
     ============================================================ */
  var GODS = {
    g1: {
      n: '垂听的',
      lines: [
        '再近些。',
        '这里的回声是旧的。',
        '你站的地方，从前有水。',
        '冷吗。我也冷。',
        '我在下面，一直听着。',
        '你把茧拿来时，我听见了。'
      ]
    },
    g2: {
      n: '数名的',
      lines: [
        '孩子，线乱了。',
        '一根，两根……你数不清的。',
        '把结拆开，就看见我了。',
        '你的线头，我替你留着。',
        '慢慢来，我有的是时候数。',
        '这根线，绕过你师门的匾。'
      ]
    },
    g3: {
      n: '缝外的',
      lines: [
        '换。',
        '你手里那枚，给我。',
        '我饿了很久。',
        '拿你的，换我的。',
        '你给得起。',
        '再多一点，就够了。'
      ]
    }
  };

  function kinN() {
    return (S.gods.g1.kin ? 1 : 0) + (S.gods.g2.kin ? 1 : 0) + (S.gods.g3.kin ? 1 : 0);
  }
  function whisperRate() {
    return Math.min(.45, .06 + .004 * (100 - S.clarity) + .02 * kinN()
      + (isTainted() ? .08 : 0));
  }
  function rollWhisper() {
    var force = w.__qtwhisper;
    if (force === 'no') return null;
    if (force === 'g1' || force === 'g2' || force === 'g3') {
      var G0 = GODS[force];
      return { g: force, n: G0.n, line: G0.lines[Math.floor(Math.random() * G0.lines.length)] };
    }
    if (Math.random() >= whisperRate()) return null;
    var keys = ['g1', 'g2', 'g3'];
    var ws = keys.map(function (k) { return S.gods[k].kin ? 2 : 1; });
    var sum = ws[0] + ws[1] + ws[2], x = Math.random() * sum, g = 'g1';
    if (x > ws[0]) { g = x > ws[0] + ws[1] ? 'g3' : 'g2'; }
    var G = GODS[g];
    return { g: g, n: G.n, line: G.lines[Math.floor(Math.random() * G.lines.length)] };
  }
  function hear(g) {
    if (!S.gods[g]) return null;
    S.gods[g].favor += 1;
    S.gods[g].ask = true;
    S.clarity = Math.max(0, S.clarity - 3);
    S.whispers += 1;
    if (!S.heard) S.heard = [];
    S.heard.unshift({ g: g, at: now(), clarity: S.clarity });
    if (S.heard.length > 40) S.heard.length = 40;
    save();
    return {
      favor: S.gods[g].favor,
      kin: S.gods[g].kin,
      ask: S.gods[g].favor >= 7 && !S.gods[g].kin && S.gods[g].ask
    };
  }
  function declineKin(g) {
    if (S.gods[g]) S.gods[g].ask = false;
    save();
  }
  function becomeKin(g) {
    var G = S.gods[g];
    if (!G || G.kin) return false;
    G.kin = true;
    S.clarityMax = Math.max(20, S.clarityMax - 20);
    S.clarity = Math.max(0, S.clarity - 20);
    save();
    return true;
  }

  /* 图鉴解锁打点：'f:凶' / 'f:平' / 'f:吉' 等 */
  function mark(key) {
    if (!key) return;
    if (!S.seen) S.seen = {};
    S.seen[key] = 1;
    save();
  }

  w.QT = {
    KINDS: KINDS, RAR: RAR, PRICE: PRICE, SUGGEST: SUGGEST, STAGES: STAGES,
    RIFT: RIFT, RANKS: RANKS,
    load: load, save: save, reset: reset, seed: seed,
    mk: mk, prog: prog, stageOf: stageOf, fmt: fmt, riskOf: riskOf,
    quote: quote, svg: svg,
    isLocal: isLocal, demo: demo, setDemo: setDemo,
    riftNow: riftNow, riftStage: riftStage, intervalSec: intervalSec,
    willNow: willNow, mend: mend, setRank: setRank,
    appCost: appCost, appraise: appraise, hide: hide,
    secretP: secretP, syncP: syncP, pFound: pFound, payFine: payFine,
    enterRift: enterRift, signBond: signBond, bondWork: bondWork, sectPrice: sectPrice,
    steal: steal,
    GODS: GODS, whisperRate: whisperRate, rollWhisper: rollWhisper,
    hear: hear, declineKin: declineKin, becomeKin: becomeKin, kinN: kinN,
    mark: mark,
    get s() { return load(); }
  };
})(window);
