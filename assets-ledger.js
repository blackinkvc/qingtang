/* ============================================================
   青棠宗 · 素材台账前端（唯一数据源 = assets-ledger.csv）
   页面只需引入本文件，然后 QTLedger.placeholder / QTLedger.detail
   不要在 HTML 里写死任何素材条目。
   ============================================================ */
(function (w, d) {
  'use strict';

  var ROWS = [], READY = false, WAIT = [], CSV_URL = 'assets-ledger.csv';

  /* ---------- CSV：支持 BOM / 引号 / 字段内逗号 ---------- */
  function parseCSV(text) {
    text = text.replace(/^\uFEFF/, '');
    var rows = [], row = [], field = '', q = false;
    for (var i = 0; i < text.length; i++) {
      var c = text[i];
      if (q) {
        if (c === '"') {
          if (text[i + 1] === '"') { field += '"'; i++; }
          else q = false;
        } else field += c;
      } else if (c === '"') q = true;
      else if (c === ',') { row.push(field); field = ''; }
      else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
      else if (c !== '\r') field += c;
    }
    if (field.length || row.length) { row.push(field); rows.push(row); }
    var head = rows.shift() || [];
    return rows.filter(function (r) { return r.length > 1; }).map(function (r) {
      var o = {}; head.forEach(function (h, i) { o[h] = r[i] || ''; }); return o;
    });
  }

  /* ---------- 样式：注入一次，所有页面共用 ---------- */
  var CSS = [
    '.qph{background:#DCD6C8;border:1px dashed #B9AF98;border-radius:6px;position:relative;',
    'display:flex;flex-direction:column;justify-content:space-between;gap:4px;padding:8px 9px;',
    'cursor:pointer;color:#6E6656;font-size:11px;line-height:1.45;overflow:hidden;transition:.15s;text-align:left}',
    '.qph:hover{border-color:#9C3B31;background:#E4DED0}',
    '.qph .qc{font-family:ui-monospace,Consolas,monospace;font-size:9.5px;letter-spacing:.06em;color:#8A8272}',
    '.qph .qn{font-size:12.5px;font-weight:600;color:#1D1B17;line-height:1.3}',
    '.qph .qw{font-size:10.5px;color:#6E6656;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
    '.qph .qf{font-size:10px;color:#9C3B31;display:flex;justify-content:space-between;gap:6px}',
    '.qph .qf i{font-style:normal;color:#8A8272}',
    '.qph.sq{aspect-ratio:1/1;justify-content:center;align-items:center;text-align:center}',
    '.qph.sq .qw{display:none}',
    '.qph-mini{background:#DCD6C8;border:1px dashed #B9AF98;border-radius:4px;padding:3px 5px;',
    'font-size:9px;color:#6E6656;cursor:pointer;line-height:1.35;overflow:hidden}',
    '.qph-mini:hover{border-color:#9C3B31;color:#9C3B31}',
    '.qph-mini b{display:block;font-weight:600;color:#3B372F;font-size:9.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
    '.qph-mini span{display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
    '.qmask{position:fixed;inset:0;background:rgba(29,27,23,.42);z-index:900;opacity:0;pointer-events:none;transition:.18s}',
    '.qmask.on{opacity:1;pointer-events:auto}',
    '.qdraw{position:fixed;top:0;right:0;height:100%;width:min(440px,92vw);background:#F2ECDF;',
    'border-left:1px solid #C3B69D;z-index:901;transform:translateX(100%);transition:transform .24s cubic-bezier(.22,.61,.36,1);',
    'display:flex;flex-direction:column;box-shadow:-18px 0 42px rgba(29,27,23,.16)}',
    '.qdraw.on{transform:translateX(0)}',
    '.qdraw .hd{padding:16px 18px 12px;border-bottom:1px solid #D6CBB6;display:flex;justify-content:space-between;align-items:flex-start;gap:12px}',
    '.qdraw .hd .code{font-family:ui-monospace,Consolas,monospace;font-size:10.5px;letter-spacing:.08em;color:#8A8272}',
    '.qdraw .hd h3{margin:4px 0 0;font-size:19px;font-weight:400;color:#1D1B17;line-height:1.35}',
    '.qdraw .hd button{background:none;border:1px solid #C3B69D;border-radius:4px;width:28px;height:28px;',
    'cursor:pointer;color:#6E6656;font-size:15px;line-height:1;flex:none}',
    '.qdraw .hd button:hover{border-color:#9C3B31;color:#9C3B31}',
    '.qdraw .bd{padding:14px 18px 24px;overflow:auto;flex:1}',
    '.qdraw .empty{background:#DCD6C8;border:1px dashed #B9AF98;border-radius:6px;padding:26px 16px;',
    'text-align:center;color:#8A8272;font-size:12px;margin-bottom:14px}',
    '.qdraw .empty b{display:block;color:#6E6656;font-size:12.5px;margin-bottom:4px;font-weight:600}',
    '.qdraw dl{margin:0;display:grid;grid-template-columns:72px 1fr;gap:9px 12px;font-size:12.5px;line-height:1.65}',
    '.qdraw dt{color:#8A8272;font-size:11.5px}',
    '.qdraw dd{margin:0;color:#1D1B17}',
    '.qdraw .desc{margin:16px 0 0;padding:12px 13px;background:#E7DDC7;border-left:2px solid #9C3B31;',
    'font-size:12.5px;line-height:1.85;color:#3B372F}',
    '.qdraw .tip{margin-top:14px;font-size:11.5px;color:#6E6656;line-height:1.7}',
    '.qdraw .pill{display:inline-block;padding:1px 7px;border:1px solid #C3B69D;border-radius:999px;font-size:10.5px;color:#6E6656}'
  ].join('');
  function styleOnce() {
    if (d.getElementById('qt-ledger-css')) return;
    var s = d.createElement('style'); s.id = 'qt-ledger-css'; s.textContent = CSS;
    (d.head || d.documentElement).appendChild(s);
  }

  /* ---------- 索引 ---------- */
  function norm(s) { return String(s || '').replace(/\s+/g, ''); }
  function index() {
    ROWS.forEach(function (r) {
      r._codex = (String(r['用在哪']).match(/（([kme bp]-\d{2})）/) || [])[1] || '';
      r._file = r['图名'] || '';
    });
  }
  function byCode(code) {
    for (var i = 0; i < ROWS.length; i++) if (ROWS[i]['素材编号'] === code) return ROWS[i];
    return null;
  }
  function byCodex(no) {
    var n = norm(no);
    for (var i = 0; i < ROWS.length; i++) if (norm(ROWS[i]._codex) === n) return ROWS[i];
    return null;
  }
  function byFile(file) {
    var f = norm(file);
    for (var i = 0; i < ROWS.length; i++) if (norm(ROWS[i]._file) === f) return ROWS[i];
    return null;
  }
  function byName(name) {
    var n = norm(name);
    for (var i = 0; i < ROWS.length; i++) if (norm(ROWS[i]['名称']) === n) return ROWS[i];
    return null;
  }
  /* 宽松匹配：名称包含关键字 + 可选分类关键字 */
  function match(kw, suffix) {
    var k = norm(kw), s = norm(suffix || '');
    for (var i = 0; i < ROWS.length; i++) {
      var nm = norm(ROWS[i]['名称']);
      if (nm.indexOf(k) === 0 && (!s || nm.indexOf(s) > -1)) return ROWS[i];
    }
    return null;
  }

  var PRI_TEXT = { P0: '第 1 批（本批）', P1: '第 2 批', P2: '视需要再补' };

  function metaLine(r) {
    return '<span class="pill">' + r['优先级'] + ' · ' + PRI_TEXT[r['优先级']] + '</span>';
  }

  /* ---------- 占位卡 ---------- */
  function placeholder(r, opt) {
    opt = opt || {}; styleOnce();
    var cls = 'qph' + (opt.square ? ' sq' : '');
    return '<div class="' + cls + '" data-code="' + r['素材编号'] + '" role="button" tabindex="0" ' +
      "onclick=\"QTLedger.detail('" + r['素材编号'] + "')\">" +
      '<span class="qc">' + r['素材编号'] + '</span>' +
      '<span class="qn">' + r['名称'] + '</span>' +
      '<span class="qw">' + r['用在哪'] + '</span>' +
      '<span class="qf"><i>' + r['状态'] + '</i><b>' + r['优先级'] + '</b></span>' +
      '</div>';
  }
  function mini(r) {
    styleOnce();
    var nm = r['名称'].replace(/ · .*$/, '');
    if (nm.length > 7) nm = nm.slice(0, 6) + '…';
    return '<div class="qph-mini" title="' + r['素材编号'] + ' · ' + r['名称'] + ' · ' + r['用在哪'] + '" ' +
      "onclick=\"event.stopPropagation();QTLedger.detail('" + r['素材编号'] + "')\">" +
      '<b>' + nm + '</b><span>' + r['优先级'] + ' · ' + r['状态'] + '</span></div>';
  }

  /* ---------- 详情抽屉 ---------- */
  function ensureDrawer() {
    if (d.getElementById('qledgerDrawer')) return;
    styleOnce();
    var m = d.createElement('div'); m.className = 'qmask'; m.id = 'qledgerMask';
    m.onclick = close;
    var dr = d.createElement('aside'); dr.className = 'qdraw'; dr.id = 'qledgerDrawer';
    dr.setAttribute('aria-hidden', 'true');
    d.body.appendChild(m); d.body.appendChild(dr);
  }
  function detail(code) {
    var r = typeof code === 'string' ? byCode(code) : code;
    if (!r) return;
    ensureDrawer();
    var dr = d.getElementById('qledgerDrawer');
    dr.innerHTML =
      '<div class="hd"><div><div class="code">' + r['素材编号'] + ' · ' + r['分类'] + '</div>' +
      '<h3>' + r['名称'] + '</h3></div><button aria-label="关闭" onclick="QTLedger.close()">×</button></div>' +
      '<div class="bd">' +
      '<div class="empty"><b>此图尚未生成</b>' + r['优先级'] + ' · ' + r['状态'] + ' · ' + PRI_TEXT[r['优先级']] +
      '<br>下面这块位置暂时用它占位，不会用别的图顶替。</div>' +
      '<dl>' +
      '<dt>用在哪</dt><dd>' + r['用在哪'] + '</dd>' +
      '<dt>尺寸</dt><dd>' + r['尺寸'] + '</dd>' +
      '<dt>风格锚点</dt><dd>' + r['风格锚点'] + '　<span class="pill">' + anchorName(r['风格锚点']) + '</span></dd>' +
      '<dt>优先级</dt><dd>' + metaLine(r) + '</dd>' +
      '<dt>出图后</dt><dd>存为 <code>' + (r['图名'] || '待定') + '</code>，本表状态改为「已生成」</dd>' +
      '</dl>' +
      '<div class="desc"><b>画面要求</b><br>' + r['画面描述'] + '</div>' +
      '<div class="tip">占位卡只出现在素材登记过的位置。真实出图后会替换成图片，说明文字随之移除。</div>' +
      '</div>';
    d.getElementById('qledgerMask').classList.add('on');
    dr.classList.add('on'); dr.setAttribute('aria-hidden', 'false');
  }
  function close() {
    var m = d.getElementById('qledgerMask'), dr = d.getElementById('qledgerDrawer');
    if (m) m.classList.remove('on');
    if (dr) { dr.classList.remove('on'); dr.setAttribute('aria-hidden', 'true'); }
  }
  function anchorName(a) {
    return { A: 'A 头像厚涂', B: 'B 宣纸淡彩', C: 'C 照片级立绘', D: 'D 写实航拍' }[a] || a;
  }

  /* ---------- 加载 ---------- */
  function load(cb) {
    if (READY) { cb && cb(ROWS); return; }
    if (cb) WAIT.push(cb);
    if (load._p) return; 
    load._p = fetch(CSV_URL, { cache: 'no-store' })
      .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.text(); })
      .then(function (t) {
        ROWS = parseCSV(t); index(); READY = true;
        WAIT.splice(0).forEach(function (f) { f(ROWS); });
        try { d.dispatchEvent(new CustomEvent('qtledger:ready', { detail: { rows: ROWS } })); } catch (e) {}
      })
      .catch(function (e) {
        console.warn('[QTLedger] 台账加载失败：', e && e.message);
        d.dispatchEvent(new CustomEvent('qtledger:error', { detail: e }));
      });
  }

  w.QTLedger = {
    load: load, all: function () { return ROWS; }, ready: function () { return READY; },
    byCode: byCode, byCodex: byCodex, byFile: byFile, byName: byName, match: match,
    placeholder: placeholder, mini: mini, detail: detail, close: close,
    anchorName: anchorName, priText: function (p) { return PRI_TEXT[p] || p; }
  };

  d.addEventListener('keydown', function (e) { if (e.key === 'Escape') close(); });
  if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', function () { load(); });
  else load();
})(window, document);
