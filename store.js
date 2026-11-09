/* ============================================================
   青棠宗 · 拾茧  /  store.js
   跨页共用的茧库：同一枚茧在 裂缝 / 育茧畦 / 孵房 / 贩卖
   都保持拾到时的品类、颜色、纹理与大小。
   ============================================================ */
(function (w) {
  'use strict';

  var KEY = 'qt.save.v1';
  var KEY_BAD = KEY + '.bad';   /* 损坏存档的备份位，不再参与读取 */
  var SAVE_V = 2;               /* 存档结构版本：读档时以上限为准，超出即视为不认 */
  /* 神识 / 体力回复：75 秒一点（约 48 点/小时），不带后台计时器，按时间戳折算 */
  var SHEN_IV = 75000, TI_IV = 75000;

  /* —— 茧的五种品类：底色 / 亮面 / 暗面 / 纹理 / 纹路编号 —— */
  var KINDS = [
    { n: '青皮茧', y: '木', base: '#7E8C74', light: '#ABB79C', dark: '#525E49', tr: '丝直，纹从蒂起', pat: 0 },
    { n: '赭纹茧', y: '土', base: '#A5764F', light: '#C69E77', dark: '#6C4A2F', tr: '横纹绕壳，色沉', pat: 1 },
    { n: '白霜茧', y: '金', base: '#CDC5B2', light: '#E7E1D1', dark: '#968E7B', tr: '霜色覆壳，触之生寒', pat: 2 },
    { n: '朱砂茧', y: '火', base: '#9C3B31', light: '#C06A5E', dark: '#66211A', tr: '壳内似有火脉', pat: 3 },
    { n: '藕紫茧', y: '水', base: '#7A5F76', light: '#9E879A', dark: '#4E3A4B', tr: '紫而不艳，色近墨', pat: 2 }
  ];

  /* ============================================================
     茧的三维：品类（纹 · 属）× 品阶（衣 · 光）× 凶吉（征）
     一切"捡来的茧长什么样"都由这三轴定，孵房与图鉴共用。
     ============================================================ */
  var COCOON = {
    kinds: KINDS,
    grades: [null,
      { n: '凡', dur: 18, line: .30, sheen: 0,   s: '茧衣薄，指压即陷' },
      { n: '良', dur: 26, line: .36, sheen: 0,   s: '丝线匀，握之微沉' },
      { n: '珍', dur: 32, line: .42, sheen: .10, s: '茧衣紧实，光下有色' },
      { n: '秘', dur: 40, line: .48, sheen: .16, s: '壳外有暗纹，触之如瓷' },
      { n: '绝', dur: 52, line: .56, sheen: .22, s: '通体如一，不见缝口' }
    ],
    omens: {
      '凶': { vis: '裂', d: '壳上有一线暗裂，贴耳无声。', glow: 0, crack: 1 },
      '平': { vis: '净', d: '壳面干净，无裂无缝。', glow: 0, crack: 0 },
      '吉': { vis: '纹', d: '细纹如网，光下微亮。', glow: 1, crack: 0 }
    },
    /* 行 = 品阶 1..5，列 = 品类 0..4 */
    fort: [
      ['平', '凶', '平', '凶', '平'],
      ['平', '平', '吉', '平', '凶'],
      ['吉', '平', '吉', '吉', '平'],
      ['凶', '吉', '吉', '凶', '吉'],
      ['吉', '吉', '凶', '吉', '吉']
    ]
  };

  function cocoonOmen(kind, grade) {
    var row = COCOON.fort[(grade || 1) - 1] || COCOON.fort[0];
    return row[kind] || '平';
  }
  function cocoonName(kind, grade) {
    var K = KINDS[kind] || KINDS[0];
    var G = COCOON.grades[grade] || COCOON.grades[1];
    return K.n + ' · ' + G.n;
  }
  /* 三维 → 一组稳定的视觉与文案参数 */
  function phase(kind, grade) {
    var K = KINDS[kind] || KINDS[0];
    var G = COCOON.grades[grade] || COCOON.grades[1];
    var o = cocoonOmen(kind, grade);
    return {
      kind: kind, grade: grade, omen: o,
      pat: K.pat, line: G.line, sheen: G.sheen,
      glow: COCOON.omens[o].glow, crack: COCOON.omens[o].crack,
      dur: G.dur, name: cocoonName(kind, grade),
      text: K.tr + '；' + G.s + '。' + COCOON.omens[o].d
    };
  }

  var RAR = ['', '凡', '良', '珍', '秘', '绝'];
  /* 宗门明码价 */
  var PRICE = [0, 12, 30, 65, 120, 220];
  /* 同门建议价 */
  var SUGGEST = [0, 18, 42, 90, 168, 300];
  /* 同门基础成交率（按建议价挂出时）；四、五品须高于宗门价的期望，否则挂单无人问 */
  var BASE_P = [0, .90, .82, .72, .78, .76];

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
      src: src || 'rift'
    };
  }

  function seed() {
    var t = now(), D = 90 * 60000;
    S = {
      v: SAVE_V, seq: 0, savedAt: t,
      stone: 480, shen: 72, shenMax: 100, shenAt: t, ti: 64, tiMax: 100, tiAt: t,
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
    d.v = SAVE_V;
    d.rank = d.rank || 3;
    d.willMax = RANKS[d.rank].willMax;
    if (typeof d.will !== 'number') d.will = 62;
    if (!d.willAt) d.willAt = now();
    if (!d.shenAt) d.shenAt = now();
    if (!d.tiAt) d.tiAt = now();
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

  /* —— 神识 / 体力：按时间戳折回复，页面不跑后台计时器 —— */
  function vitals() {
    var dm = demo(), t = now();
    var gs = Math.floor((t - (S.shenAt || t)) / (SHEN_IV / dm));
    if (gs > 0) {
      S.shen = Math.min(S.shenMax, S.shen + gs);
      S.shenAt = Math.min(t, (S.shenAt || t) + gs * SHEN_IV / dm);
    }
    var gt = Math.floor((t - (S.tiAt || t)) / (TI_IV / dm));
    if (gt > 0) {
      S.ti = Math.min(S.tiMax, S.ti + gt);
      S.tiAt = Math.min(t, (S.tiAt || t) + gt * TI_IV / dm);
    }
    if (S.shen >= S.shenMax) S.shenAt = t;
    if (S.ti >= S.tiMax) S.tiAt = t;
  }
  function shenNow() {
    if (S.shen >= S.shenMax) return S.shenMax;
    var g = Math.floor((now() - (S.shenAt || now())) / (SHEN_IV / demo()));
    return Math.min(S.shenMax, S.shen + Math.max(0, g));
  }
  function tiNow() {
    if (S.ti >= S.tiMax) return S.tiMax;
    var g = Math.floor((now() - (S.tiAt || now())) / (TI_IV / demo()));
    return Math.min(S.tiMax, S.ti + Math.max(0, g));
  }

  /* —— 读档体检：版本、类型、缺字段、坏条目，全在这一处补齐或丢弃 —— */
  function num(v, def) { return (typeof v === 'number' && isFinite(v)) ? v : def; }
  function goodCocoon(c) {
    return !!c && typeof c === 'object' && typeof c.id === 'string'
      && typeof c.kind === 'number' && c.kind >= 0 && c.kind <= 4
      && typeof c.r === 'number' && c.r >= 1 && c.r <= 5;
  }
  function fit(d) {
    if (!d || typeof d !== 'object' || Object.prototype.toString.call(d) === '[object Array]') return null;
    var t = now();
    d.v = SAVE_V;
    d.seq = num(d.seq, 0);
    d.stone = Math.max(0, num(d.stone, 480));
    d.shenMax = Math.max(1, num(d.shenMax, 100));
    d.shen = clamp(num(d.shen, 72), 0, d.shenMax);
    d.tiMax = Math.max(1, num(d.tiMax, 100));
    d.ti = clamp(num(d.ti, 64), 0, d.tiMax);
    d.shenAt = num(d.shenAt, t);
    d.tiAt = num(d.tiAt, t);
    d.rank = clamp(Math.round(num(d.rank, 3)), 1, 6);
    d.willMax = RANKS[d.rank].willMax;
    d.will = clamp(num(d.will, 62), 0, d.willMax);
    d.willAt = num(d.willAt, t);
    d.clarityMax = Math.max(20, num(d.clarityMax, 100));
    d.clarity = clamp(num(d.clarity, 100), 0, d.clarityMax);
    if (!d.rift || typeof d.rift !== 'object') d.rift = { r: 34.2, at: t, tainted: false };
    d.rift.r = clamp(num(d.rift.r, 34.2), 0, 100);
    d.rift.at = num(d.rift.at, t);
    d.rift.tainted = !!d.rift.tainted;
    d.path = d.path === 'rift' || d.path === 'bond' ? d.path : null;
    d.debt = Math.max(0, num(d.debt, 0));
    d.incident = d.incident && typeof d.incident === 'object' && isFinite(d.incident.fine) ? d.incident : null;
    d.whispers = Math.max(0, num(d.whispers, 0));
    d.heard = Object.prototype.toString.call(d.heard) === '[object Array]' ? d.heard.slice(0, 40) : [];
    d.seen = d.seen && typeof d.seen === 'object' && Object.prototype.toString.call(d.seen) !== '[object Array]' ? d.seen : {};
    d.mends = Math.max(0, num(d.mends, 0));
    d.hadRift = !!d.hadRift;
    d.hadBond = !!d.hadBond;
    d.steals = Math.max(0, num(d.steals, 0));
    d.taints = Math.max(0, num(d.taints, 0));
    d.secrets = d.secrets && typeof d.secrets === 'object' ? d.secrets : {};
    ['stolen', 'hidden', 'hiddenW', 'fines', 'off'].forEach(function (k) {
      d.secrets[k] = Math.max(0, num(d.secrets[k], 0));
    });
    d.secrets.p = +(Math.max(0, d.secrets.hiddenW + 1.5 * d.secrets.stolen - d.secrets.off)).toFixed(1);
    d.gods = d.gods && typeof d.gods === 'object' ? d.gods : {};
    ['g1', 'g2', 'g3'].forEach(function (k) {
      var g = d.gods[k] && typeof d.gods[k] === 'object' ? d.gods[k] : {};
      g.favor = Math.max(0, num(g.favor, 0));
      g.kin = !!g.kin;
      g.ask = g.ask !== false;
      d.gods[k] = g;
    });
    d.pick = Math.max(0, num(d.pick, 0));
    d.codex = Object.prototype.toString.call(d.codex) === '[object Array]' ? d.codex.slice(0, 60) : [];
    d.bag = Object.prototype.toString.call(d.bag) === '[object Array]' ? d.bag.filter(goodCocoon) : [];
    d.plots = Object.prototype.toString.call(d.plots) === '[object Array]'
      ? d.plots.filter(function (p) { return p && goodCocoon(p.c) && isFinite(p.ripeAt); }) : [];
    d.house = Object.prototype.toString.call(d.house) === '[object Array]'
      ? d.house.filter(function (h) { return h && goodCocoon(h.c) && isFinite(h.at) && isFinite(h.dur); }) : [];
    d.listings = Object.prototype.toString.call(d.listings) === '[object Array]'
      ? d.listings.filter(function (l) { return l && goodCocoon(l.c) && isFinite(l.price) && isFinite(l.resolveAt); }) : [];
    d.vault = d.vault && typeof d.vault === 'object' ? d.vault : {};
    ['edge', 'shell', 'dan'].forEach(function (k) { d.vault[k] = Math.max(0, num(d.vault[k], 0)); });
    d.savedAt = t;
    return d;
  }

  function load() {
    if (S) return S;
    var raw = null;
    try { raw = w.localStorage.getItem(KEY); } catch (e) { raw = null; }
    if (raw) {
      var d = null;
      try { d = JSON.parse(raw); } catch (e) { d = null; }
      if (d && typeof d === 'object') {
        if (d.v === 1) d = migrate(d);
        if (typeof d.v !== 'number' || d.v <= SAVE_V) {
          d = fit(d);
          if (d) { S = d; return S; }
        }
      }
      /* 解析失败 / 结构不认：留一份坏档，回初始，并把好档写回去，下次不再撞坏 */
      try { w.localStorage.setItem(KEY_BAD, raw); } catch (e) {}
      try { w.localStorage.removeItem(KEY); } catch (e) {}
      S = seed();
      save();
      return S;
    }
    return seed();
  }

  function save() {
    if (!S) return;
    S.v = SAVE_V;
    S.savedAt = now();
    vitals();
    riftSync();
    willSync();
    try { w.localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {}
  }

  function reset() {
    try { w.localStorage.removeItem(KEY); w.localStorage.removeItem(KEY_BAD); } catch (e) {}
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

  /* —— 茧的样子：品类定纹，品阶定衣与光，凶吉定壳面征象 —— */
  function svg(c, opt) {
    opt = opt || {};
    var K = KINDS[c.kind] || KINDS[0];
    var ph = phase(c.kind, c.r);
    var wf = c.w || 1;
    var rx = 30 * wf, ry = 48 * wf, cy = 96;
    var s = wf;
    var gid = 'g' + c.id + (opt.sfx || '');
    var lid = gid + 'l';
    var pat = ph.pat;
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

    var glowDef = ph.glow
      ? '<defs><radialGradient id="' + lid + '">'
        + '<stop offset="0" stop-color="#fff" stop-opacity=".52"/>'
        + '<stop offset=".55" stop-color="' + K.light + '" stop-opacity=".20"/>'
        + '<stop offset="1" stop-color="' + K.light + '" stop-opacity="0"/></radialGradient></defs>'
      : '';
    var glow = ph.glow
      ? '<ellipse cx="60" cy="' + (cy + ry * .05).toFixed(1) + '" rx="' + (rx * .64).toFixed(1)
        + '" ry="' + (ry * .66).toFixed(1) + '" fill="url(#' + lid + ')"/>'
      : '';
    var crack = ph.crack
      ? '<path d="M78 68 L70 82 L76 86 L64 102" fill="none" stroke="' + K.dark
        + '" stroke-opacity=".62" stroke-width="1.2"/>'
      : '';
    var sheen = ph.sheen
      ? '<ellipse cx="' + (60 - rx * .30).toFixed(1) + '" cy="' + (cy - ry * .40).toFixed(1) + '" '
        + 'rx="' + (rx * .20).toFixed(1) + '" ry="' + (ry * .24).toFixed(1) + '" '
        + 'fill="rgba(255,255,255,' + ph.sheen + ')"/>'
      : '';

    return '<svg viewBox="0 0 120 168" role="img" aria-label="' + K.n + '">'
      + '<defs><linearGradient id="' + gid + '" x1="0" y1="0" x2="1" y2="1">'
      + '<stop offset="0" stop-color="' + K.light + '"/>'
      + '<stop offset=".55" stop-color="' + K.base + '"/>'
      + '<stop offset="1" stop-color="' + K.dark + '"/></linearGradient></defs>'
      + glowDef
      + '<g style="filter:hue-rotate(' + (c.h || 0) + 'deg)">'
      + '<line x1="60" y1="4" x2="60" y2="' + (cy - ry + 2).toFixed(1) + '" '
      + 'stroke="' + K.dark + '" stroke-width="1.1" opacity=".5"/>'
      + '<ellipse cx="60" cy="' + cy + '" rx="' + rx.toFixed(1) + '" ry="' + ry.toFixed(1) + '" '
      + 'fill="url(#' + gid + ')" stroke="' + K.dark + '" stroke-opacity=".5" stroke-width="1.1"/>'
      + glow
      + '<g transform="translate(60 ' + cy + ') scale(' + s.toFixed(3) + ') translate(-60 -' + cy + ')" '
      + 'fill="none" stroke="' + K.dark + '" stroke-opacity="' + ph.line + '" stroke-width=".95">'
      + '<path d="' + lines + '"/></g>'
      + crack
      + '<ellipse cx="' + (60 - rx * .34).toFixed(1) + '" cy="' + (cy - ry * .36).toFixed(1) + '" '
      + 'rx="' + (rx * .26).toFixed(1) + '" ry="' + (ry * .3).toFixed(1) + '" '
      + 'fill="rgba(255,255,255,.26)" transform="rotate(-16 ' + (60 - rx * .34).toFixed(1) + ' ' + (cy - ry * .36).toFixed(1) + ')"/>'
      + sheen
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
  /* 三位神各有两套用语：未成眷属时一套，成眷属后换一套。
     g1 垂听的：短句、少主语、像水；成眷属后用「我们」。
     g2 数名的：温柔、以丝线作喻、称「孩子」；成眷属后替你理线。
     g3 缝外的：交易口吻、饥饿、直接；成眷属后视你为已换之物。 */
  var GODS = {
    g1: {
      n: '垂听的',
      lines: [
        '再近些。',
        '冷。',
        '深处。有水。',
        '我在这里。',
        '你踩到我了。',
        '别抬头。',
        '听见了。',
        '水是旧的。',
        '下面还有一层。',
        '你的鞋湿了。',
        '再站一会儿。',
        '我记着你的脚步。',
        '缝在呼吸。',
        '往下。'
      ],
      kinLines: [
        '我们在这里。',
        '你听得见我，我听得到你。',
        '再往下，我们一起。',
        '我们的水。',
        '别怕，我们泡着。',
        '你已经凉了。',
        '我们一直听着。',
        '你回来时，我数过步子。',
        '上面太吵。',
        '我们不分。'
      ]
    },
    g2: {
      n: '数名的',
      lines: [
        '孩子，别急着拆。',
        '一根，两根，三根……剩下的我替你记着。',
        '线头在你袖口，我看见的。',
        '结不是坏事，结是记性。',
        '坐下来，我数给你听。',
        '你师门的匾上，有一根线松了。',
        '拆开它，就看见里头是什么了。慢一点。',
        '你的名字有四个结。',
        '夜里线会自己走。',
        '别剪，剪了要重数。',
        '我数到你了。',
        '孩子，手里那根别松。',
        '一根线绕过两个人。',
        '数不清，才叫多。'
      ],
      kinLines: [
        '孩子，你的线我替你理。',
        '我数过了，你身上没有断的。',
        '这根结我留着，那根给你。',
        '你睡的时候，线替你走路。',
        '我们数同一根。',
        '别动，我在拆。',
        '你的名字现在有五个结了。',
        '我替你把乱的那一段梳平。',
        '数到你这里，我就不数了。',
        '线归我，你归线。'
      ]
    },
    g3: {
      n: '缝外的',
      lines: [
        '换。',
        '你手里那枚，给我。',
        '我饿了。',
        '你有，我没有。',
        '拿你的，换我的。',
        '不够。',
        '再给一点。',
        '你给得起。',
        '门开着，你不敢进。',
        '我要的是你藏着的那枚。',
        '别问价，先给。',
        '你留不住的。',
        '外面冷，里面也冷，但我饱。',
        '你把什么藏在袖子里。'
      ],
      kinLines: [
        '你的，现在都是我的。',
        '进来。门不用关。',
        '我不饿了，可我还想要。',
        '你已经是我的那一份。',
        '我们换过，别装忘了。',
        '再给一枚，就一枚。',
        '你的手伸出来。',
        '我不吃你，我吃你给的。',
        '缝外给你留了位置。',
        '你走得再远，也算在里面。'
      ]
    }
  };

  function godLine(g) {
    var G = GODS[g];
    var pool = S.gods[g].kin ? G.kinLines : G.lines;
    return pool[Math.floor(Math.random() * pool.length)];
  }

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
      return { g: force, n: GODS[force].n, line: godLine(force) };
    }
    if (Math.random() >= whisperRate()) return null;
    var keys = ['g1', 'g2', 'g3'];
    var ws = keys.map(function (k) { return S.gods[k].kin ? 2 : 1; });
    var sum = ws[0] + ws[1] + ws[2], x = Math.random() * sum, g = 'g1';
    if (x > ws[0]) { g = x > ws[0] + ws[1] ? 'g3' : 'g2'; }
    return { g: g, n: GODS[g].n, line: godLine(g) };
  }
  function hear(g, line) {
    if (!S.gods[g]) return null;
    S.gods[g].favor += 1;
    S.gods[g].ask = true;
    S.clarity = Math.max(0, S.clarity - 3);
    S.whispers += 1;
    if (!S.heard) S.heard = [];
    S.heard.unshift({ g: g, at: now(), clarity: S.clarity, line: line || '' });
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
    COCOON: COCOON, phase: phase, cocoonOmen: cocoonOmen, cocoonName: cocoonName,
    load: load, save: save, reset: reset, seed: seed,
    SAVE_V: SAVE_V, vitals: vitals, shenNow: shenNow, tiNow: tiNow,
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
