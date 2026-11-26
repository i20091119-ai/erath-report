/* 장기 × 象棋 — 화면, 대국 진행, 비교 탐색기, 온라인 대전 */
(function () {
  'use strict';
  const E = window.Engine;
  const $ = (s, el) => (el || document).querySelector(s);
  const $$ = (s, el) => [...(el || document).querySelectorAll(s)];
  const NS = 'http://www.w3.org/2000/svg';
  const S = (tag, attrs, parent) => {
    const el = document.createElementNS(NS, tag);
    for (const k in attrs) el.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(el);
    return el;
  };
  const H = (html) => { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstChild; };

  /* ---------- 데이터 ---------- */
  const GLYPH = {
    hanja: {
      xq: [{ K: '帥', A: '仕', E: '相', H: '馬', R: '車', C: '炮', P: '兵' }, { K: '將', A: '士', E: '象', H: '馬', R: '車', C: '砲', P: '卒' }],
      jg: [{ K: '楚', A: '士', E: '象', H: '馬', R: '車', C: '包', P: '卒' }, { K: '漢', A: '士', E: '象', H: '馬', R: '車', C: '包', P: '兵' }]
    },
    hangul: {
      xq: [{ K: '수', A: '사', E: '상', H: '마', R: '차', C: '포', P: '병' }, { K: '장', A: '사', E: '상', H: '마', R: '차', C: '포', P: '졸' }],
      jg: [{ K: '초', A: '사', E: '상', H: '마', R: '차', C: '포', P: '졸' }, { K: '한', A: '사', E: '상', H: '마', R: '차', C: '포', P: '병' }]
    }
  };
  const INK = { xq: ['#c1121f', '#1c1a18'], jg: ['#0a6b45', '#c1121f'] };
  const PLAYER = {
    jg: [{ n: '초', h: '楚', c: '#2fbf8a' }, { n: '한', h: '漢', c: '#ff5d5d' }],
    xq: [{ n: '홍', h: '紅', c: '#ff5d5d' }, { n: '흑', h: '黑', c: '#c9c9d6' }]
  };
  const AVATAR = { jg: ['cho', 'han'], xq: ['red', 'black'] };
  const IC = n => `<img class="ic" src="./img/ic-${n}.png" alt="">`;
  const GNAME = { jg: '한국 장기', xq: '중국 상치' };
  const PNAME = { K: '왕', A: '사', E: '상', H: '마', R: '차', C: '포', P: '졸 · 병' };
  const INFO = {
    K: { jg: '궁성 안에서 선을 따라 모든 방향(대각선 포함)으로 한 칸. 궁성 한가운데에서 시작해요.', xq: '궁성 안에서 가로·세로로만 한 칸. 맨 아랫줄에서 시작하고, 두 왕이 같은 줄에서 마주 볼 수 없어요.' },
    A: { jg: '왕과 똑같이 궁성 안에서 선을 따라 한 칸씩 움직여요.', xq: '궁성 안에서 대각선으로만 한 칸. 설 수 있는 자리가 5곳뿐이에요.' },
    E: { jg: '직선 1칸 + 대각선 2칸. 가는 길에 기물이 있으면 막혀요. 판 전체를 누벼요.', xq: '대각선으로 정확히 2칸(田). 가운데가 막히면 못 가고, 강을 건널 수 없어 수비만 해요.' },
    H: { jg: '직선 1칸 + 대각선 1칸. 바로 앞이 막히면(멱) 못 가요.', xq: '장기와 똑같아요. 직선 1칸 + 대각선 1칸, 다리가 막히면 못 가요.' },
    R: { jg: '가로·세로로 원하는 만큼. 궁성 안에서는 대각선 길도 달릴 수 있어요.', xq: '가로·세로로 원하는 만큼. 궁성 대각선은 쓸 수 없어요.' },
    C: { jg: '움직일 때도 잡을 때도 반드시 기물 하나를 넘어야 해요. 포는 포를 넘지도, 잡지도 못해요.', xq: '움직일 때는 차처럼 자유롭게, 잡을 때만 기물 하나를 넘어요. 포끼리도 넘고 잡을 수 있어요.' },
    P: { jg: '처음부터 앞·옆으로 한 칸. 상대 궁성 안에서는 대각선 앞으로도 가요.', xq: '강을 건너기 전에는 앞으로만 한 칸. 강을 건너면 옆으로도 갈 수 있어요.' }
  };
  const DIFFS = [
    ['판 모양', '강이 없고 선이 끝까지 이어져요.', '가운데에 강(楚河漢界)이 흘러요. 상은 못 건너고 병은 건너면 강해져요.'],
    ['왕의 자리', '궁성 한가운데에서 시작.', '궁성 맨 아랫줄 가운데에서 시작.'],
    ['왕과 사', '궁성 안의 선을 따라 대각선까지 자유롭게 한 칸.', '왕은 가로·세로만, 사는 대각선만 한 칸.'],
    ['상', '직선 1 + 대각선 2칸, 판 전체 이동.', '대각선 2칸, 자기 진영에서만.'],
    ['포', '넘어야만 이동·공격. 포끼리는 넘지도 잡지도 못함.', '이동은 차처럼, 공격할 때만 넘음.'],
    ['졸 · 병', '처음부터 앞과 옆으로.', '강을 건너야 옆으로 갈 수 있음.'],
    ['궁성 대각선', '차·포·졸도 궁성의 대각선 길을 이용.', '사만 대각선으로 움직임.'],
    ['왕끼리 마주 보기', '빅장! 상대가 풀지 않으면 무승부.', '비장(飛將) 규칙으로 아예 금지.'],
    ['쉬기와 외통', '한수쉼 가능. 움직일 수가 없으면 쉬면 됨.', '쉴 수 없음. 둘 수가 없으면 장군이 아니어도 패배.'],
    ['상차림', '마와 상의 자리를 4가지 중에서 선택.', '처음 배치가 항상 같음.'],
    ['먼저 두는 쪽', '초(楚, 푸른색)가 먼저.', '홍(紅, 붉은색)이 먼저.'],
    ['기물 모양', '팔각형, 종류마다 크기가 다름.', '둥근 모양, 모두 같은 크기.'],
    ['점수', '기물 점수제(차13·포7·마5·상3·사3·졸2), 한에게 덤 1.5.', '점수제 없이 왕을 잡아야 승리.']
  ];
  const DIFF_IMG = ['board', 'kingpos', 'guard', 'elephant', 'cannon', 'soldier', 'palace', 'facing', 'pass', 'formation', 'first', 'shape', 'score'];
  const DEMO = {
    K: { jg: 76, xq: 85, ex: [] },
    A: { jg: 84, xq: 84, ex: [] },
    E: { jg: 67, xq: 67, ex: [] },
    H: { jg: 49, xq: 49, ex: [[40, 'P', 0]] },
    R: { jg: 66, xq: 66, ex: [[30, 'P', 1]] },
    C: { jg: 67, xq: 67, ex: [[49, 'P', 0], [22, 'H', 1], [69, 'P', 0], [70, 'C', 1]] },
    P: { jg: 49, xq: 49, ex: [] }
  };

  /* ---------- 환경 설정 ---------- */
  const prefs = { label: 'hanja', sound: true };
  try { Object.assign(prefs, JSON.parse(localStorage.getItem('jgxq') || '{}')); } catch (e) { /* 저장소 없음 */ }
  const savePrefs = () => { try { localStorage.setItem('jgxq', JSON.stringify(prefs)); } catch (e) { /* 무시 */ } };

  /* ---------- 소리 ---------- */
  let actx = null;
  function tone(f, dur, type, vol, when) {
    if (!prefs.sound) return;
    try {
      actx = actx || new (window.AudioContext || window.webkitAudioContext)();
      const t = actx.currentTime + (when || 0), o = actx.createOscillator(), g = actx.createGain();
      o.type = type || 'sine'; o.frequency.setValueAtTime(f, t);
      o.frequency.exponentialRampToValueAtTime(Math.max(40, f * .6), t + dur);
      g.gain.setValueAtTime(vol || .2, t); g.gain.exponentialRampToValueAtTime(.001, t + dur);
      o.connect(g).connect(actx.destination); o.start(t); o.stop(t + dur);
    } catch (e) { /* 소리 미지원 */ }
  }
  const sfx = {
    move() { tone(330, .09, 'triangle', .35); tone(140, .12, 'sine', .3); },
    cap() { tone(200, .16, 'square', .16); tone(90, .22, 'sine', .4, .02); },
    check() { tone(880, .14, 'sawtooth', .13); tone(660, .2, 'sawtooth', .13, .14); },
    win() { [523, 659, 784, 1047].forEach((f, i) => tone(f, .32, 'triangle', .25, i * .13)); },
    lose() { [392, 330, 262].forEach((f, i) => tone(f, .4, 'sine', .25, i * .18)); }
  };

  /* ---------- 기물 그리기 ---------- */
  function drawPiece(g, game, p, label) {
    const body = S('g', { class: 'body' }, g), ink = INK[game][p.s];
    let r;
    if (game === 'xq') {
      r = 27;
      for (const f of ['wood', 'pimg-' + game, 'shade']) S('circle', { r, fill: `url(#${f})`, stroke: f === 'shade' ? '#5a3912' : 'none', 'stroke-width': 1.5 }, body);
      S('circle', { r: r - 5, fill: 'none', stroke: ink, 'stroke-width': 1.6, opacity: .8 }, body);
    } else {
      r = p.t === 'K' ? 30 : (p.t === 'A' || p.t === 'P') ? 21.5 : 26.5;
      const pts = [];
      for (let k = 0; k < 8; k++) { const a = (22.5 + 45 * k) * Math.PI / 180; pts.push((r * Math.cos(a)).toFixed(1) + ',' + (r * Math.sin(a)).toFixed(1)); }
      for (const f of ['wood', 'pimg-' + game, 'shade']) S('polygon', { points: pts.join(' '), fill: `url(#${f})`, stroke: f === 'shade' ? '#5a3912' : 'none', 'stroke-width': 1.5, 'stroke-linejoin': 'round' }, body);
    }
    const t = S('text', { 'text-anchor': 'middle', 'dominant-baseline': 'central', 'font-size': (r * 1.02).toFixed(0), fill: ink, y: 1 }, g);
    t.textContent = GLYPH[label][game][p.s][p.t];
  }
  const DEFS = '<defs><radialGradient id="wood" cx="35%" cy="28%" r="85%"><stop offset="0" stop-color="#fff3d6"/><stop offset=".55" stop-color="#ecd09a"/><stop offset="1" stop-color="#c79a54"/></radialGradient>' +
    ['jg', 'xq'].map(g => `<pattern id="pimg-${g}" patternContentUnits="objectBoundingBox" width="1" height="1"><image href="./img/piece-${g}.jpg" width="1" height="1" preserveAspectRatio="xMidYMid slice"/></pattern>`).join('') +
    '<radialGradient id="shade" cx="35%" cy="26%" r="80%"><stop offset="0" stop-color="#fff" stop-opacity=".5"/><stop offset=".6" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#5a3206" stop-opacity=".42"/></radialGradient>' +
    '<linearGradient id="bdjg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#e9c887"/><stop offset="1" stop-color="#cfa25a"/></linearGradient>' +
    '<linearGradient id="bdxq" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f0d6a2"/><stop offset="1" stop-color="#d9a868"/></linearGradient></defs>';

  /* ---------- 판 ---------- */
  const CELL = 64, PAD = 46, BW = 8 * CELL + 2 * PAD, BH = 9 * CELL + 2 * PAD;
  class BoardView {
    constructor(host, game, onPoint) {
      this.game = game; this.flipped = false; this.els = new Map(); this.label = prefs.label;
      host.innerHTML = '';
      const svg = this.svg = S('svg', { class: 'bd', viewBox: `0 0 ${BW} ${BH}` }, host);
      this.drawBoard();
      this.gLast = S('g', {}, svg); this.gPieces = S('g', {}, svg); this.gHint = S('g', {}, svg);
      if (onPoint) svg.addEventListener('click', (ev) => {
        const pt = svg.createSVGPoint(); pt.x = ev.clientX; pt.y = ev.clientY;
        const q = pt.matrixTransform(svg.getScreenCTM().inverse());
        let c = Math.round((q.x - PAD) / CELL), r = Math.round((q.y - PAD) / CELL);
        if (c < 0 || c > 8 || r < 0 || r > 9) return;
        if (this.flipped) { r = 9 - r; c = 8 - c; }
        onPoint(r * 9 + c);
      });
    }
    xy(i) {
      let r = (i / 9) | 0, c = i % 9;
      if (this.flipped) { r = 9 - r; c = 8 - c; }
      return [PAD + c * CELL, PAD + r * CELL];
    }
    drawBoard() {
      const g = S('g', {}, this.svg), xq = this.game === 'xq', X = c => PAD + c * CELL, Y = r => PAD + r * CELL;
      S('rect', { width: BW, height: BH, fill: `url(#bd${this.game})` }, g);
      S('image', { href: `./img/board-${this.game}.jpg`, width: BW, height: BH, preserveAspectRatio: 'xMidYMid slice' }, g); // 없으면 위의 색이 보임
      S('rect', { x: PAD - 9, y: PAD - 9, width: 8 * CELL + 18, height: 9 * CELL + 18, fill: 'none', stroke: xq ? '#f3dca6' : '#4a2c0c', 'stroke-width': 3.5 }, g);
      const ink = xq ? '#f3dca6' : '#4a2c0c';
      const L = (x1, y1, x2, y2, w) => S('line', { x1, y1, x2, y2, stroke: ink, 'stroke-width': w || 1.6, 'stroke-linecap': 'round' }, g);
      for (let r = 0; r < 10; r++) L(X(0), Y(r), X(8), Y(r));
      for (let c = 0; c < 9; c++) {
        if (xq && c > 0 && c < 8) { L(X(c), Y(0), X(c), Y(4)); L(X(c), Y(5), X(c), Y(9)); }
        else L(X(c), Y(0), X(c), Y(9));
      }
      for (const pr of [0, 7]) { L(X(3), Y(pr), X(5), Y(pr + 2)); L(X(5), Y(pr), X(3), Y(pr + 2)); }
      if (xq) {
        const tx = (x, s) => { const t = S('text', { x, y: Y(4.5) + 1, 'text-anchor': 'middle', 'dominant-baseline': 'central', 'font-size': 30, 'font-family': "'Noto Serif KR',serif", 'font-weight': 700, fill: ink, opacity: .7, 'letter-spacing': 18 }, g); t.textContent = s; };
        tx(X(2), '楚河'); tx(X(6), '漢界');
        const marks = [[2, 1], [2, 7], [7, 1], [7, 7]];
        for (let c = 0; c < 9; c += 2) marks.push([3, c], [6, c]);
        for (const [r, c] of marks) for (const [dx, dy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
          if ((c === 0 && dx < 0) || (c === 8 && dx > 0)) continue;
          const x = X(c) + dx * 6, y = Y(r) + dy * 6;
          S('path', { d: `M${x + dx * 11} ${y}H${x}V${y + dy * 11}`, fill: 'none', stroke: ink, 'stroke-width': 1.6 }, g);
        }
      }
    }
    // marks: {sel, targets:[idx], last:{from,to}, chk, hint:{from,to}}
    update(board, marks) {
      marks = marks || {};
      if (this.label !== prefs.label) { this.label = prefs.label; this.els.forEach(e => e.remove()); this.els.clear(); }
      const alive = new Set();
      for (let i = 0; i < 90; i++) {
        const p = board[i]; if (!p) continue;
        alive.add(p.id);
        let el = this.els.get(p.id);
        if (!el) { el = S('g', { class: 'piece' }, this.gPieces); drawPiece(el, this.game, p, this.label); this.els.set(p.id, el); }
        const [x, y] = this.xy(i);
        el.style.transform = `translate(${x}px,${y}px)`;
        el.classList.toggle('sel', marks.sel === i);
        el.classList.toggle('chk', marks.chk === i);
        if (marks.sel === i || (marks.last && marks.last.to === i)) this.gPieces.appendChild(el);
      }
      this.els.forEach((el, id) => {
        if (!alive.has(id)) { el.classList.add('gone'); this.els.delete(id); setTimeout(() => el.remove(), 320); }
      });
      this.gLast.innerHTML = ''; this.gHint.innerHTML = '';
      if (marks.last && marks.last.from != null) {
        let [x, y] = this.xy(marks.last.from); S('circle', { cx: x, cy: y, r: 9, class: 'lastmv' }, this.gLast);
        [x, y] = this.xy(marks.last.to); S('circle', { cx: x, cy: y, r: 33, class: 'lastmv' }, this.gLast);
      }
      for (const t of marks.targets || []) {
        const [x, y] = this.xy(t);
        if (board[t]) S('circle', { cx: x, cy: y, r: 32, class: 'hintcap' }, this.gHint);
        else S('circle', { cx: x, cy: y, r: 10, class: 'hintdot' }, this.gHint);
      }
      if (marks.hint) for (const i of [marks.hint.from, marks.hint.to]) {
        const [x, y] = this.xy(i); S('circle', { cx: x, cy: y, r: 34, class: 'aihint' }, this.gHint);
      }
    }
  }

  /* ---------- 공통 UI ---------- */
  function toast(msg) { const t = H(`<div class="toast"></div>`); t.textContent = msg; $('#toasts').appendChild(t); setTimeout(() => t.remove(), 3300); }
  function go(name) {
    $$('.screen').forEach(s => s.classList.toggle('on', s.id === name));
    $$('.tab').forEach(t => t.classList.toggle('on', t.dataset.go === name));
    window.scrollTo({ top: 0 });
  }
  function modal(html) { $('#sheet').innerHTML = html; $('#modal').hidden = false; return $('#sheet'); }
  function closeModal() { $('#modal').hidden = true; }
  // 선택지 묶음: 버튼 하나만 켜짐
  function optGroup(el, initial, onChange) {
    const set = v => { $$('button', el).forEach(b => b.classList.toggle('sel', b.dataset.v === String(v))); el.dataset.val = v; if (onChange) onChange(v); };
    el.addEventListener('click', e => { const b = e.target.closest('button'); if (b) set(b.dataset.v); });
    set(initial);
  }
  const opts = (id, list) => `<div class="opts" id="${id}">${list.map(([v, t]) => `<button class="btn" data-v="${v}">${t}</button>`).join('')}</div>`;
  const formOpts = id => opts(id, Object.entries(E.FORMATIONS));

  function confetti() {
    const cv = $('#confetti'), cx = cv.getContext('2d');
    cv.width = innerWidth; cv.height = innerHeight;
    const cols = ['#e8c26a', '#ff5d5d', '#2fbf8a', '#5ad1ff', '#fff'];
    const ps = Array.from({ length: 170 }, () => ({ x: innerWidth / 2, y: innerHeight * .35, vx: (Math.random() - .5) * 18, vy: -Math.random() * 16 - 3, s: 5 + Math.random() * 7, c: cols[(Math.random() * 5) | 0], a: Math.random() * 6 }));
    const t0 = performance.now();
    (function frame(t) {
      cx.clearRect(0, 0, cv.width, cv.height);
      for (const p of ps) {
        p.vy += .38; p.x += p.vx; p.y += p.vy; p.vx *= .99; p.a += .2;
        cx.save(); cx.translate(p.x, p.y); cx.rotate(p.a); cx.fillStyle = p.c; cx.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2); cx.restore();
      }
      if (t - t0 < 3600) requestAnimationFrame(frame); else cx.clearRect(0, 0, cv.width, cv.height);
    })(t0);
  }

  /* ---------- 대국 ---------- */
  const G = { st: null, cfg: null, view: null, sel: null, targets: [], hint: null, gen: 0, thinking: false };

  function startGame(cfg) {
    if (cfg.mode !== 'online') Net.leave();
    G.cfg = cfg; G.gen++; G.sel = null; G.targets = []; G.hint = null; G.thinking = false; G.review = null;
    G.st = E.create(cfg.game, cfg.formations);
    G.clk = cfg.clock ? [cfg.clock * 60000, cfg.clock * 60000] : null; G.lastTick = Date.now();
    G.view = new BoardView($('#board'), cfg.game, onPoint);
    G.view.flipped = cfg.mode !== 'local' && cfg.mySide === 1;
    $('#tabGame').hidden = false;
    $('#chat').hidden = cfg.mode !== 'online';
    $('#chatLog').innerHTML = '';
    $('#tip').innerHTML = '<b>기물을 눌러 보세요</b><p>갈 수 있는 자리가 표시되고, 이 기물이 두 게임에서 어떻게 다른지 알려 드려요.</p>';
    closeModal(); go('game'); refresh();
    if (cfg.mode === 'ai' && cfg.mySide === 1 && !cfg.resumed) aiTurn();
  }
  const myTurn = () => G.st.status === 'play' && !G.thinking && G.review == null && !G.cfg.replay && (G.cfg.mode === 'local' || G.st.turn === G.cfg.mySide) &&
    !(G.cfg.mode === 'online' && (G.cfg.watch || !Net.open()));

  function onPoint(i) {
    if (!myTurn()) return;
    const st = G.st, p = st.board[i];
    if (G.sel != null && G.targets.includes(i)) return doMove({ from: G.sel, to: i });
    if (p && p.s === st.turn) {
      G.sel = i; G.targets = E.legalMoves(st.board, st.game, st.turn, i).map(m => m.to);
      const other = st.game === 'jg' ? 'xq' : 'jg';
      $('#tip').innerHTML = `<b>${GLYPH.hanja[st.game][p.s][p.t]} ${PNAME[p.t]}</b><p>${INFO[p.t][st.game]}</p><p class="other">${GNAME[other]}에서는 — ${INFO[p.t][other]}</p>`;
      if (!G.targets.length) toast('이 기물은 지금 움직일 수 있는 자리가 없어요');
    } else { G.sel = null; G.targets = []; }
    paint();
  }

  function doMove(mv, remote) {
    const st = G.st, rec = E.play(st, mv);
    if (!rec) return;
    G.sel = null; G.targets = []; G.hint = null; G.review = null;
    if (G.cfg.mode === 'online' && !remote) Net.send({ t: 'move', mv: { from: mv.from, to: mv.to, pass: !!mv.pass }, clk: G.clk });
    if (rec.check) { sfx.check(); shout(st.game === 'jg' ? '장군!' : '將軍!'); }
    else if (rec.cap) sfx.cap(); else sfx.move();
    if (st.game === 'jg' && st.status === 'play' && st.bikjangBy === rec.side && !rec.check) shout('빅장!');
    if (rec.pass) toast(`${PLAYER[st.game][rec.side].n} — 한수쉼`);
    refresh();
    if (st.status === 'over') return setTimeout(showOver, 750);
    if (G.cfg.mode === 'ai' && st.turn !== G.cfg.mySide) aiTurn();
  }

  // AI 계산은 워커에서 돌려 화면이 멈추지 않게 한다 (워커를 못 쓰면 그 자리에서 계산)
  let aiW = null, aiSeq = 0; const aiWait = new Map();
  function think(level, budget) {
    const st = G.st, local = () => E.bestMove(st, level, Math.min(budget, 1200));
    if (aiW === null) {
      try {
        aiW = new Worker('./ai-worker.js');
        aiW.onmessage = e => { const r = aiWait.get(e.data.id); aiWait.delete(e.data.id); if (r) r(e.data.mv); };
        aiW.onerror = () => { aiW = false; aiWait.forEach(r => r(undefined)); aiWait.clear(); };
      } catch (e) { aiW = false; }
    }
    if (!aiW) return new Promise(res => setTimeout(() => res(local()), 30));
    return new Promise(res => {
      const id = ++aiSeq;
      aiWait.set(id, mv => res(mv === undefined ? local() : mv));
      aiW.postMessage({ id, game: st.game, formations: st.formations, opts: st.opts, level, budget, moves: st.moves.map(m => ({ from: m.from, to: m.to, pass: m.pass })) });
    });
  }
  function aiTurn() {
    const gen = G.gen, t0 = Date.now(); G.thinking = true; refresh();
    think(G.cfg.level, [0, 300, 900, 2500][G.cfg.level]).then(mv => setTimeout(() => {
      if (gen !== G.gen || G.st.status !== 'play') return;
      G.thinking = false;
      if (mv) doMove(mv); else refresh();
    }, Math.max(0, 450 - (Date.now() - t0))));
  }

  /* 제한 시간 */
  const fmtClk = ms => { const s = Math.max(0, Math.ceil(ms / 1000)); return `${(s / 60) | 0}:${String(s % 60).padStart(2, '0')}`; };
  setInterval(() => {
    const now = Date.now(), dt = now - (G.lastTick || now); G.lastTick = now;
    if (!G.st || !G.clk || G.st.status !== 'play' || G.review != null) return;
    const side = G.st.turn;
    G.clk[side] -= dt;
    $$('.clk').forEach(el => { const s = +el.dataset.side; el.textContent = fmtClk(G.clk[s]); el.classList.toggle('low', G.clk[s] < 30000); });
    // 온라인에서는 자기 시간이 다 된 쪽이 알린다. 상대가 자리에 없으면 남은 쪽이 대신 알린다.
    if (G.clk[side] <= 0 && (G.cfg.mode !== 'online' || (!G.cfg.watch && Net.open() && (side === G.cfg.mySide || !Net.peer)))) {
      G.gen++; G.thinking = false;
      if (G.cfg.mode === 'online') Net.send({ t: 'end', winner: 1 - side, reason: 'time' });
      finish(1 - side, 'time');
    }
  }, 250);

  function shout(txt) { const el = $('#shout'); el.textContent = txt; el.classList.remove('go'); void el.offsetWidth; el.classList.add('go'); }

  // 복기 중이면 그 시점의 국면을, 아니면 지금 국면을 돌려준다
  function viewSt() {
    const live = G.st;
    if (G.review == null) return live;
    if (!G.rv || G.rv.src !== live || G.rv.k !== G.review || G.rv.n !== live.moves.length) {
      const s = E.create(live.game, live.formations, live.opts);
      for (let i = 0; i < G.review; i++) E.play(s, live.moves[i]);
      G.rv = { src: live, k: G.review, n: live.moves.length, s };
    }
    return G.rv.s;
  }
  function setReview(k) {
    const n = G.st.moves.length;
    k = Math.max(0, Math.min(n, k));
    G.review = k === n && !G.cfg.replay ? null : k;
    G.sel = null; G.targets = []; G.hint = null;
    refresh();
  }
  function paint() {
    const st = viewSt(), last = st.moves[st.moves.length - 1];
    G.view.update(st.board, {
      sel: G.sel, targets: G.targets, hint: G.hint,
      last: last && !last.pass ? last : null,
      chk: st.check && st.status === 'play' ? E.findKing(st.board, st.turn) : null
    });
  }

  function roleName(side) {
    const c = G.cfg;
    if (c.mode === 'local') return side === 0 ? '선수 (먼저)' : '후수 (나중)';
    if (c.watch) return side === c.hostSide ? '방장' : '손님';
    if (c.mode === 'online' && side !== c.mySide && !Net.peer) return '상대 · 자리 비움';
    if (side === c.mySide) return '나';
    return c.mode === 'ai' ? 'AI · ' + ['', '쉬움', '보통', '어려움'][c.level] : '상대';
  }
  const fileRank = i => 'abcdefghi'[i % 9] + (10 - ((i / 9) | 0));

  function refresh() {
    const st = G.st, g = st.game, c = G.cfg, P = PLAYER[g];
    paint();
    const vs = viewSt();
    const sc = g === 'jg' ? E.score(vs.board) : null;
    const bar = (el, side) => {
      el.className = 'pbar' + (st.status === 'play' && st.turn === side ? ' act' : '');
      el.style.color = P[side].c;
      const av = c.mode === 'ai' && side !== c.mySide ? 'ai' : AVATAR[g][side];
      el.innerHTML = `<img class="av" src="./img/av-${av}.png" alt="${P[side].h}"><div class="nm" style="color:var(--text)">${P[side].n}<small>${roleName(side)}</small></div>` +
        `<div class="caps">${vs.captured[side].map(p => `<span class="cp" style="color:${INK[g][p.s]}">${GLYPH[prefs.label][g][p.s][p.t]}</span>`).join('')}</div>` +
        (sc ? `<div class="pts">${sc[side]}점</div>` : '') + (G.clk ? `<div class="clk${G.clk[side] < 30000 ? ' low' : ''}" data-side="${side}">${fmtClk(G.clk[side])}</div>` : '');
    };
    const top = G.view.flipped ? 0 : 1;
    bar($('#pTop'), top); bar($('#pBot'), 1 - top);

    $('#gName').textContent = `${GNAME[g]} · ${c.replay ? '기보 보기' : { ai: 'AI 대국', local: '둘이서', online: '온라인' }[c.mode]}`;
    let turn = `${P[st.turn].n}(${P[st.turn].h}) 차례`, sub = `${st.moves.length + 1}번째 수`;
    if (st.status === 'over') { turn = st.winner == null ? '무승부' : `${P[st.winner].n} 승리!`; sub = '새 판을 눌러 다시 둘 수 있어요'; }
    else if (st.check) sub = g === 'jg' ? '장군! 왕을 지켜야 해요 (멍군)' : '장군(將軍)! 왕을 지켜야 해요';
    else if (g === 'jg' && st.bikjangBy !== null) sub = '빅장! 이번 수에 풀지 않으면 무승부예요';
    else if (G.thinking) sub = 'AI가 생각하는 중…';
    else if (c.mode === 'online' && !Net.open()) sub = '서버에 다시 연결하는 중…';
    else if (c.watch) sub = '관전 중이에요';
    else if (c.mode === 'online' && !Net.peer) sub = '상대가 자리를 비웠어요. 돌아오기를 기다리는 중…';
    else if (c.mode === 'online' && st.turn !== c.mySide) sub = '상대의 수를 기다리는 중…';
    if (G.review != null) sub = `복기 중 · ${G.review} / ${st.moves.length}수 — ▶ 로 넘겨 보세요`;
    const playing = st.status === 'play';
    $('#turnTxt').textContent = turn; $('#turnTxt').style.color = P[st.status === 'over' && st.winner != null ? st.winner : st.turn].c;
    $('#subTxt').textContent = sub;

    const on = c.mode === 'online', canAsk = on && !c.watch && playing && Net.alive();
    $('#btnUndo').disabled = G.thinking || !st.moves.length || (on && !(canAsk && !Net.askedUndo && st.moves.some(m => m.side === c.mySide)));
    $('#btnDraw').hidden = !on || c.watch; $('#btnDraw').disabled = !canAsk || Net.askedDraw;
    $('#chatForm').hidden = $('.emo').hidden = !!c.watch;
    $('#btnHint').disabled = !myTurn();
    $('#btnPass').hidden = g !== 'jg'; $('#btnPass').disabled = !myTurn() || st.check;
    $('#btnResign').disabled = !playing || !!c.watch;
    $('#btnAgain').disabled = !!c.watch;
    if (c.replay) for (const id of ['btnUndo', 'btnHint', 'btnPass', 'btnResign']) $('#' + id).disabled = true;
    $('#btnSave').disabled = !st.moves.length;
    const shown = G.review == null ? st.moves.length : G.review;

    $('#hist').innerHTML = st.moves.map((m, k) => {
      const txt = m.pass ? '한수쉼' : `${GLYPH[prefs.label][g][m.side][m.piece.t]} ${fileRank(m.from)}→${fileRank(m.to)}${m.cap ? ' ×' + GLYPH[prefs.label][g][m.cap.s][m.cap.t] : ''}${m.check ? ' !' : ''}`;
      return `<li class="${k + 1 === shown ? 'cur' : ''}" data-k="${k + 1}" style="color:${P[m.side].c}"><i>${k + 1}.</i>${txt}</li>`;
    }).join('');
    const cur = $('#hist .cur');
    if (cur) $('#hist').scrollTop = cur.offsetTop - $('#hist').offsetTop - 70; else $('#hist').scrollTop = 0;
    autosave();
  }

  /* ---------- 기보: 저장 · 불러오기 · 이어 두기 ---------- */
  const plainMoves = st => st.moves.map(m => m.pass ? { pass: true } : { from: m.from, to: m.to });
  function kifu() {
    const st = G.st, c = G.cfg;
    return { app: 'jgxq', v: 1, game: st.game, formations: st.formations, moves: plainMoves(st), date: new Date().toISOString(),
      result: st.status === 'over' ? { winner: st.winner, reason: st.reason } : null, mode: c.mode };
  }
  function saveKifu() {
    const d = new Date(), p = n => String(n).padStart(2, '0');
    const name = `${G.st.game === 'jg' ? 'janggi' : 'xiangqi'}-${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}.json`;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(kifu())], { type: 'application/json' }));
    a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    toast('기보를 저장했어요: ' + name);
  }
  // 저장된 기록으로 판을 다시 만든다. 규칙에 맞지 않는 수가 나오면 거기서 멈춘다.
  function restore(k, cfg) {
    if (!k || (k.game !== 'jg' && k.game !== 'xq') || !Array.isArray(k.moves) || k.moves.length > 2000) return false;
    const f = Array.isArray(k.formations) ? k.formations.map(x => E.FORMATIONS[x] ? x : 'EHEH').slice(0, 2) : [];
    startGame(Object.assign({ game: k.game, formations: f }, cfg));
    for (const m of k.moves) {
      const st = G.st, mv = m && m.pass ? { pass: true } : { from: m.from | 0, to: m.to | 0 };
      const ok = mv.pass ? st.game === 'jg' && !st.check : E.legalMoves(st.board, st.game, st.turn, mv.from).some(x => x.to === mv.to);
      if (st.status !== 'play' || !ok || !E.play(st, mv)) break;
    }
    return true;
  }
  function loadKifu(text) {
    let k = null;
    try { k = JSON.parse(text); } catch (e) { /* 아래에서 처리 */ }
    if (!k || k.app !== 'jgxq' || !restore(k, { mode: 'local', mySide: 0, replay: true })) return toast('이 앱에서 저장한 기보 파일이 아니에요');
    const st = G.st, r = k.result;
    if (r && st.status === 'play' && typeof r.reason === 'string') { st.status = 'over'; st.winner = r.winner === 0 || r.winner === 1 ? r.winner : null; st.reason = r.reason.slice(0, 20); }
    G.review = 0; refresh();
    toast(`기보를 불러왔어요 (${st.moves.length}수). ▶ 를 눌러 넘겨 보세요`);
  }
  function autosave() {
    const c = G.cfg, st = G.st;
    if (!c || c.replay || c.mode === 'online') return;
    try {
      if (st.status !== 'play' || !st.moves.length) localStorage.removeItem('jgxq-save');
      else localStorage.setItem('jgxq-save', JSON.stringify({ cfg: c, game: st.game, formations: st.formations, moves: plainMoves(st), clk: G.clk }));
    } catch (e) { /* 저장소 없음 */ }
    showResume();
  }
  function readSave() { try { return JSON.parse(localStorage.getItem('jgxq-save')); } catch (e) { return null; } }
  function showResume() {
    const s = readSave(), el = $('#resume');
    el.hidden = !s;
    if (s) $('#resumeTxt').textContent = `두던 판이 있어요 — ${GNAME[s.game] || ''} · ${s.cfg && s.cfg.mode === 'ai' ? 'AI 대국' : '둘이서'} · ${s.moves.length}수`;
  }
  function resume() {
    const s = readSave();
    if (!s || !s.cfg || (s.cfg.mode !== 'ai' && s.cfg.mode !== 'local')) return;
    const c = s.cfg, cfg = { mode: c.mode, mySide: c.mySide === 1 ? 1 : 0, level: [1, 2, 3].includes(c.level) ? c.level : 2, clock: +c.clock || 0, resumed: true };
    if (!restore(s, cfg)) return;
    if (G.clk && Array.isArray(s.clk)) { G.clk = s.clk.slice(0, 2).map(Number); G.lastTick = Date.now(); }
    refresh();
    if (cfg.mode === 'ai' && G.st.status === 'play' && G.st.turn !== cfg.mySide) aiTurn();
  }

  function showOver() {
    const st = G.st, g = st.game, c = G.cfg, P = PLAYER[g];
    const sc = E.score(st.board);
    const why = {
      checkmate: g === 'jg' ? '외통수! 왕이 더 이상 피할 곳이 없어요.' : '절살(絶殺)! 왕이 더 이상 피할 곳이 없어요.',
      stalemate: '둘 수 있는 수가 없어요. 상치에서는 쉴 수 없기 때문에 패배가 됩니다. (장기라면 한수쉼!)',
      bikjang: '빅장을 풀지 않아 무승부가 되었어요. (상치에서는 왕이 마주 보는 것 자체가 금지예요.)',
      score: `두 사람 모두 쉬어서 점수로 승부를 가렸어요. 초 ${sc[0]}점 : 한 ${sc[1]}점`,
      repetition: '같은 모양이 세 번 반복되어 무승부가 되었어요.',
      perpetual: '같은 모양이 세 번 반복되었는데, 한쪽만 계속 장군을 불렀어요. 장군을 되풀이한 쪽이 집니다.',
      movelimit: `${E.JG_MOVE_LIMIT}수를 넘겨 점수로 승부를 가렸어요. 초 ${sc[0]}점 : 한 ${sc[1]}점`,
      nocapture: `${E.XQ_QUIET_LIMIT}수 동안 잡은 기물이 없어 무승부가 되었어요.`,
      time: '제한 시간이 다 되었어요.', agreed: '서로 합의해서 무승부로 끝냈어요.',
      resign: '기권으로 대국이 끝났어요.', left: '상대가 나가서 대국이 끝났어요.'
    }[st.reason];
    const neutral = c.mode === 'local' || c.watch;
    const iWon = st.winner != null && (neutral || st.winner === c.mySide);
    if (iWon) { confetti(); sfx.win(); } else sfx.lose();
    const title = st.winner == null ? '무승부' : neutral ? `${P[st.winner].n}(${P[st.winner].h}) 승리!` : iWon ? '승리했어요!' : '아쉽게 졌어요';
    const el = modal(`<img class="big" src="./img/result-${st.winner == null ? 'draw' : iWon ? 'win' : 'lose'}.png" alt=""><h2 style="text-align:center">${title}</h2><p style="text-align:center">${why}</p>
      <div class="foot" style="justify-content:center"><button class="btn" data-a="look">판 보기</button><button class="btn" data-a="home">처음으로</button><button class="btn gold" data-a="again">${IC('new')}한 판 더</button></div>`);
    el.onclick = e => {
      const a = (e.target.closest('[data-a]') || {dataset: {}}).dataset.a; if (!a) return;
      closeModal();
      if (a === 'home') go('home');
      if (a === 'again') rematch();
    };
  }
  function rematch() {
    const c = G.cfg;
    if (c.replay) return go('home');
    if (c.mode !== 'online') return startGame(Object.assign({}, c, { resumed: false }));
    if (c.watch) return;
    if (!Net.alive()) return toast('상대와 연결이 끊어져 있어요');
    if (Net.role === 'host') { const start = { t: 'start', game: c.game, formations: c.formations, hostSide: c.mySide, clock: c.clock || 0 }; Net.send(start); Net.begin(start); }
    else { Net.send({ t: 'rematch' }); toast('방장에게 한 판 더를 요청했어요'); }
  }
  function finish(winner, reason) { const st = G.st; st.status = 'over'; st.winner = winner; st.reason = reason; refresh(); showOver(); }

  $('#btnUndo').onclick = () => {
    const st = G.st, c = G.cfg;
    if (c.mode === 'online') { Net.askedUndo = true; Net.send({ t: 'undoReq' }); toast('상대에게 무르기를 요청했어요'); return refresh(); }
    let n = 1;
    if (c.mode === 'ai' && st.moves.length && st.moves[st.moves.length - 1].side !== c.mySide) n = 2;
    if (st.moves.length < n) return;
    E.undo(st, n); G.sel = null; G.targets = []; G.hint = null; refresh();
  };
  $('#btnHint').onclick = () => {
    if (!myTurn()) return;
    const gen = G.gen, n = G.st.moves.length;
    $('#btnHint').disabled = true;
    think(2, 700).then(mv => {
      if (gen !== G.gen || n !== G.st.moves.length) return;
      $('#btnHint').disabled = !myTurn();
      if (!mv || mv.pass) return toast('지금은 한수쉼이 좋아 보여요');
      G.hint = mv; G.sel = null; G.targets = []; paint();
    });
  };
  $('#btnPass').onclick = () => { if (myTurn() && !G.st.check) doMove({ pass: true }); };
  $('#btnFlip').onclick = () => { G.view.flipped = !G.view.flipped; refresh(); };
  $('#btnResign').onclick = () => {
    const st = G.st; if (st.status !== 'play') return;
    const loser = G.cfg.mode === 'local' ? st.turn : G.cfg.mySide;
    if (!confirm('정말 기권할까요?')) return;
    G.gen++; G.thinking = false;
    if (G.cfg.mode === 'online') Net.send({ t: 'end', winner: 1 - loser, reason: 'resign' });
    finish(1 - loser, 'resign');
  };
  $('#btnDraw').onclick = () => { Net.askedDraw = true; Net.send({ t: 'drawReq' }); toast('상대에게 무승부를 제안했어요'); refresh(); };
  $('#btnAgain').onclick = () => { if (G.st.status === 'play' && G.st.moves.length && !confirm('지금 판을 그만두고 새 판을 시작할까요?')) return; rematch(); };

  /* ---------- 대국 설정 ---------- */
  function openSetup(game, mode) {
    const P = PLAYER[game], jg = game === 'jg';
    const sideOpts = opts('oSide', [[0, `${P[0].n}(${P[0].h}) · 먼저`], [1, `${P[1].n}(${P[1].h}) · 나중`]]);
    let html = `<h2>${GNAME[game]}</h2><p>${{ ai: 'AI와 한 판 둡니다.', local: '한 기기에서 둘이 번갈아 둡니다.', online: '방을 만들고 친구에게 코드를 알려 주세요.' }[mode]}</p>`;
    if (mode === 'ai') html += `<h5>난이도</h5>${opts('oLevel', [[1, '쉬움'], [2, '보통'], [3, '어려움']])}`;
    html += `<h5>제한 시간 <span style="color:var(--mute);letter-spacing:0">— 한 사람이 쓸 수 있는 시간</span></h5>${opts('oClock', [[0, '없음'], [5, '5분'], [10, '10분'], [20, '20분']])}`;
    if (mode !== 'local') html += `<h5>내 진영</h5>${sideOpts}`;
    if (jg && mode === 'local') html += `<h5>초(楚) 상차림</h5>${formOpts('oF0')}<h5>한(漢) 상차림</h5>${formOpts('oF1')}`;
    else if (jg) html += `<h5>내 상차림 <span style="color:var(--mute);letter-spacing:0">— 내 왼쪽부터 마·상의 순서</span></h5>${formOpts('oF0')}`;
    html += `<div class="foot"><button class="btn" data-a="x">취소</button><button class="btn gold" data-a="ok">${mode === 'online' ? '방 만들기' : '대국 시작'}</button></div>`;
    const el = modal(html);
    $$('.opts', el).forEach(o => optGroup(o, o.id === 'oLevel' ? 2 : o.id === 'oSide' || o.id === 'oClock' ? 0 : 'EHEH'));
    const val = id => { const o = $('#' + id, el); return o ? o.dataset.val : null; };
    el.onclick = e => {
      const a = (e.target.closest('[data-a]') || {dataset: {}}).dataset.a; if (!a) return;
      if (a === 'x') return closeModal();
      const mySide = +(val('oSide') || 0), keys = Object.keys(E.FORMATIONS), clock = +val('oClock');
      const rnd = keys[(Math.random() * 4) | 0];
      if (mode === 'local') return startGame({ game, mode, mySide: 0, clock, formations: [val('oF0') || 'EHEH', val('oF1') || 'EHEH'] });
      const formations = []; formations[mySide] = val('oF0') || 'EHEH'; formations[1 - mySide] = rnd;
      if (mode === 'ai') return startGame({ game, mode, mySide, clock, level: +val('oLevel'), formations });
      Net.hostRoom({ game, mySide, clock, formation: formations[mySide] });
    };
  }

  /* ---------- 온라인 (Cloudflare 중계 서버, 웹소켓) ----------
     서버가 방마다 시작 정보와 둔 수를 기억하므로, 새로고침하거나 연결이 끊겨도 같은 방으로 돌아올 수 있다. */
  const SERVER = (window.JGXQ_SERVER || '').trim().replace(/^http/, 'ws').replace(/\/$/, '');
  const store = {
    get(k) { try { return JSON.parse(sessionStorage.getItem(k)); } catch (e) { return null; } },
    set(k, v) { try { if (v == null) sessionStorage.removeItem(k); else sessionStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* 저장소 없음 */ } }
  };
  const PID = (() => { // 재접속 때 "같은 사람"임을 알리는 임의의 값
    let p = null;
    try { p = localStorage.getItem('jgxq-pid'); } catch (e) { /* 무시 */ }
    if (!p) {
      p = Array.from(crypto.getRandomValues(new Uint8Array(12)), x => x.toString(16).padStart(2, '0')).join('');
      try { localStorage.setItem('jgxq-pid', p); } catch (e) { /* 무시 */ }
    }
    return p;
  })();
  const END_REASONS = ['resign', 'time', 'agreed', 'left'];

  const Net = {
    ws: null, code: null, role: null, peer: false, cfg: null, tries: 0, timer: null, ping: null,
    joined: false, started: false, askedUndo: false, askedDraw: false,
    open() { return !!this.ws && this.ws.readyState === 1; },
    alive() { return this.open() && this.peer; },
    send(o) { if (this.open()) this.ws.send(JSON.stringify(o)); },
    save() { store.set('jgxq-room', this.code ? { code: this.code, role: this.role, cfg: this.cfg } : null); },
    // 스스로 방을 나간다
    leave() {
      if (this.started && G.cfg && G.cfg.mode === 'online' && !G.cfg.watch && G.st.status === 'play') this.send({ t: 'end', winner: 1 - G.cfg.mySide, reason: 'left' });
      clearTimeout(this.timer); clearInterval(this.ping);
      const ws = this.ws;
      this.ws = null; this.code = null; this.peer = this.joined = this.started = false; this.tries = 0;
      this.save();
      if (ws) { ws.onclose = null; try { ws.close(); } catch (e) { /* 무시 */ } }
    },
    noServer() { toast('온라인 대전 서버가 아직 설정되지 않았어요'); },
    hostRoom(cfg) {
      if (!SERVER) return this.noServer();
      const abc = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
      const code = Array.from({ length: 6 }, () => abc[(Math.random() * abc.length) | 0]).join('');
      this.leave(); this.cfg = cfg; this.connect(code, 'host');
    },
    joinRoom(code) {
      code = (code || '').trim().toUpperCase();
      if (!/^[A-Z0-9]{6}$/.test(code)) return toast('방 코드 6자리를 입력해 주세요');
      if (!SERVER) return this.noServer();
      const saved = store.get('jgxq-room'), mine = saved && saved.code === code;
      this.leave(); this.cfg = mine ? saved.cfg : null;
      this.connect(code, mine ? saved.role : 'guest');
    },
    connect(code, role) {
      this.code = code; this.role = role;
      if (!this.joined && !this.tries) modal('<h2>연결 준비 중</h2><p><span class="spin"></span>대전 서버에 연결하고 있어요…</p><div class="foot"><button class="btn" data-a="x">취소</button></div>').onclick = e => { if (e.target.closest('[data-a]')) { this.leave(); closeModal(); } };
      const ws = this.ws = new WebSocket(`${SERVER}/room/${code}?role=${role}&pid=${PID}`);
      ws.onmessage = e => { if (this.ws !== ws) return; let d; try { d = JSON.parse(e.data); } catch (err) { return; } if (d && typeof d === 'object') this.onMsg(d); };
      ws.onclose = () => { if (this.ws === ws) this.retry(); };
      ws.onopen = () => setTimeout(() => { // 예전 서버는 _hello를 보내지 않는다 → 기본 대국만 되는 방식으로 진행
        if (this.ws === ws && ws.readyState === 1 && !this.joined) this.onMsg({ t: '_hello', as: role, peer: role === 'guest', sync: null });
      }, 2500);
      clearInterval(this.ping);
      this.ping = setInterval(() => { if (this.open()) this.ws.send('{"t":"_ping"}'); }, 25000);
    },
    retry() {
      if (this.tries >= (this.joined ? 12 : 3)) {
        toast('대전 서버에 연결할 수 없어요');
        const keep = this.joined; // 한 번 들어갔던 방은 기록을 남겨 두어 나중에 다시 들어올 수 있게 한다
        const saved = store.get('jgxq-room');
        this.started = false; this.leave(); if (keep) store.set('jgxq-room', saved);
        if (!keep) closeModal();
        if (G.st) refresh();
        return;
      }
      this.tries++;
      if (G.st) refresh();
      this.timer = setTimeout(() => this.connect(this.code, this.role), Math.min(1000 * this.tries, 5000));
    },
    showRoom() {
      const code = this.code, link = location.origin + location.pathname + '?room=' + code;
      modal(`<h2>방이 열렸어요</h2><p>친구에게 아래 코드나 링크를 보내 주세요. 친구가 들어오면 바로 시작합니다. 세 번째로 들어온 사람부터는 관전합니다.</p><div class="code">${code}</div>
        <p><span class="spin"></span>상대를 기다리는 중…</p><div class="foot"><button class="btn" data-a="x">방 닫기</button><button class="btn gold" data-a="cp">${IC('link')}초대 링크 복사</button></div>`).onclick = e => {
        const a = (e.target.closest('[data-a]') || { dataset: {} }).dataset.a;
        if (a === 'x') { this.leave(); closeModal(); }
        if (a === 'cp') (navigator.clipboard ? navigator.clipboard.writeText(link) : Promise.reject()).then(() => toast('초대 링크를 복사했어요'), () => prompt('이 링크를 복사해 보내 주세요', link));
      };
    },
    sendInit() { const c = this.cfg; if (c) this.send({ t: 'init', game: c.game, hostSide: c.mySide }); },
    onMsg(d) {
      if (d.t === '_err') {
        toast({ noroom: '그 코드의 방을 찾지 못했어요', taken: '방 코드가 겹쳤어요. 다시 만들어 주세요' }[d.why] || '연결 오류');
        this.leave(); closeModal();
      } else if (d.t === '_hello') {
        const first = !this.joined;
        this.joined = true; this.tries = 0; this.role = d.as; this.peer = !!d.peer; this.save();
        if (d.as === 'watch' && first) toast('관전으로 들어왔어요');
        if (d.sync) this.applySync(d.sync);
        else {
          this.started = false;
          if (d.as === 'host') { this.showRoom(); if (d.peer) this.sendInit(); }
          else modal(`<h2>방 ${this.code}</h2><p><span class="spin"></span>${d.as === 'watch' ? '아직 대국이 시작되지 않았어요. 시작되면 바로 보여 드릴게요.' : '방장의 준비를 기다리는 중…'}</p><div class="foot"><button class="btn" data-a="x">나가기</button></div>`).onclick = e => { if (e.target.closest('[data-a]')) { this.leave(); closeModal(); } };
        }
        if (G.st) refresh();
      } else if (d.t === '_joined' || d.t === '_back') {
        this.peer = true;
        if (this.role === 'host' && !this.started) this.sendInit();
        else if (d.t === '_back' && this.started) toast('상대가 돌아왔어요');
        if (G.st) refresh();
      } else if (d.t === '_away' || d.t === '_left') {
        this.peer = false;
        if (this.started && G.st.status === 'play') toast('상대 연결이 끊겼어요. 돌아오기를 기다립니다');
        if (G.st) refresh();
      } else this.onData(d);
    },
    cfgOf(s) {
      return { game: s.game, mode: 'online', formations: s.formations, clock: +s.clock || 0, hostSide: s.hostSide, mySide: this.role === 'guest' ? 1 - s.hostSide : s.hostSide, watch: this.role === 'watch' };
    },
    validStart(s) { return s && (s.game === 'jg' || s.game === 'xq') && (s.hostSide === 0 || s.hostSide === 1); },
    begin(s) {
      if (!this.validStart(s)) return;
      this.started = true; this.askedUndo = this.askedDraw = false;
      startGame(this.cfgOf(s));
    },
    // 서버가 기억하던 판을 그대로 다시 만든다
    applySync(sync) {
      const s = sync.start;
      if (!this.validStart(s)) return;
      const same = this.started && G.cfg && G.cfg.mode === 'online' && G.st.moves.length === sync.moves.length && G.cfg.game === s.game && (G.st.status === 'over') === !!(sync.over || G.st.status === 'over');
      this.started = true;
      if (same) return;
      startGame(this.cfgOf(s));
      for (const m of sync.moves) if (!E.play(G.st, m)) break;
      if (G.clk && sync.clk && Array.isArray(sync.clk.v)) {
        G.clk = sync.clk.v.slice(0, 2).map(Number);
        if (G.st.status === 'play') G.clk[G.st.turn] -= Math.max(0, sync.now - sync.clk.at);
        G.lastTick = Date.now();
      }
      if (sync.over && G.st.status === 'play' && END_REASONS.includes(sync.over.reason)) { G.st.status = 'over'; G.st.winner = sync.over.winner === 0 || sync.over.winner === 1 ? sync.over.winner : null; G.st.reason = sync.over.reason; }
      if (G.st.status === 'over') store.set('jgxq-room', null); // 끝난 판으로는 자동으로 돌아오지 않는다
      refresh();
    },
    ask(title, text, yes) {
      return new Promise(res => {
        modal(`<h2>${title}</h2><p>${text}</p><div class="foot"><button class="btn" data-a="n">거절</button><button class="btn gold" data-a="y">${yes}</button></div>`).onclick = e => {
          const a = (e.target.closest('[data-a]') || { dataset: {} }).dataset.a;
          if (a) { closeModal(); res(a === 'y'); }
        };
      });
    },
    onData(d) {
      const online = G.cfg && G.cfg.mode === 'online' && this.started, st = G.st, watch = this.role === 'watch';
      const me = online ? G.cfg.mySide : 0;
      if (d.t === 'init' && this.role === 'guest' && !this.started) {
        if (d.hostSide !== 0 && d.hostSide !== 1) return;
        const ready = f => this.send({ t: 'ready', formation: f });
        if (d.game !== 'jg') return ready(null);
        const el = modal(`<h2>상차림 고르기</h2><p>${GNAME.jg} 방에 들어왔어요. 나는 ${PLAYER.jg[1 - d.hostSide].n}(${PLAYER.jg[1 - d.hostSide].h})입니다. 마와 상의 자리를 골라 주세요.</p>${formOpts('oF')}<div class="foot"><button class="btn gold" data-a="ok">준비 완료</button></div>`);
        optGroup($('#oF', el), 'EHEH');
        el.onclick = e => { if (e.target.closest('[data-a]')) { ready($('#oF', el).dataset.val); el.onclick = null; el.innerHTML = '<h2>준비 완료</h2><p><span class="spin"></span>곧 시작합니다…</p>'; } };
      } else if (d.t === 'ready' && this.role === 'host' && !this.started && this.cfg) {
        const c = this.cfg, formations = [];
        formations[c.mySide] = c.formation; formations[1 - c.mySide] = E.FORMATIONS[d.formation] ? d.formation : 'EHEH';
        const start = { t: 'start', game: c.game, formations, hostSide: c.mySide, clock: c.clock || 0 };
        this.send(start); this.begin(start);
        toast('상대가 들어왔어요. 대국을 시작합니다!');
      } else if (d.t === 'start' && this.role !== 'host') { this.begin(d); }
      else if (!online) return;
      else if (d.t === 'move') {
        const mv = d.mv || {};
        if (st.status !== 'play' || (!watch && st.turn === me)) return;
        const ok = mv.pass ? st.game === 'jg' && !st.check : E.legalMoves(st.board, st.game, st.turn, mv.from).some(m => m.to === mv.to);
        if (!ok) return;
        if (G.clk && Array.isArray(d.clk)) { G.clk = d.clk.slice(0, 2).map(Number); G.lastTick = Date.now(); }
        doMove(mv.pass ? { pass: true } : { from: mv.from, to: mv.to }, true);
      } else if (d.t === 'chat') addChat(String(d.text).slice(0, 120), false);
      else if (d.t === 'end' && st.status === 'play' && END_REASONS.includes(d.reason)) {
        const w = d.winner === 0 || d.winner === 1 ? d.winner : null;
        // 상대가 스스로 진 경우, 내가 청한 무승부를 받아들인 경우, 내 시간이 실제로 다 된 경우만 인정
        const ok = watch || (d.reason === 'agreed' ? this.askedDraw && w === null : w === me || (d.reason === 'time' && G.clk && G.clk[me] < 3000));
        if (ok) { G.gen++; closeModal(); finish(w, d.reason); }
      } else if (d.t === 'rematch' && this.role === 'host' && st.status === 'over') { toast('상대가 한 판 더를 요청했어요'); closeModal(); rematch(); }
      else if (d.t === 'undoReq' && !watch && st.status === 'play' && st.moves.length) {
        this.ask('무르기 요청', '상대가 방금 둔 수를 무르고 싶어 해요. 허락할까요?', '허락').then(yes => {
          if (!yes || st !== G.st || st.status !== 'play') return this.send({ t: 'undoNo' });
          const n = Math.min(st.moves.length, st.moves[st.moves.length - 1].side === me ? 2 : 1);
          this.send({ t: 'undoOk', n }); applyUndo(n);
        });
      } else if (d.t === 'undoOk' && (watch || this.askedUndo)) { this.askedUndo = false; applyUndo(d.n === 2 ? 2 : 1); if (!watch) toast('상대가 무르기를 허락했어요'); }
      else if (d.t === 'undoNo' && this.askedUndo) { this.askedUndo = false; toast('상대가 무르기를 거절했어요'); refresh(); }
      else if (d.t === 'drawReq' && !watch && st.status === 'play') {
        this.ask('무승부 제안', '상대가 무승부를 제안했어요. 받아들일까요?', '무승부').then(yes => {
          if (!yes || st !== G.st || st.status !== 'play') return this.send({ t: 'drawNo' });
          this.send({ t: 'end', winner: null, reason: 'agreed' }); finish(null, 'agreed');
        });
      } else if (d.t === 'drawNo' && this.askedDraw) { this.askedDraw = false; toast('상대가 무승부를 거절했어요'); refresh(); }
    }
  };
  function applyUndo(n) { E.undo(G.st, Math.min(n, G.st.moves.length)); G.sel = null; G.targets = []; G.hint = null; refresh(); }
  function addChat(text, me) {
    const d = document.createElement('div'); d.textContent = text; if (me) d.className = 'me';
    $('#chatLog').appendChild(d); $('#chatLog').scrollTop = 1e6;
    if (!me) { tone(700, .08, 'sine', .15); if (!$('#game').classList.contains('on')) toast('💬 ' + text); }
  }
  const sendChat = text => { text = text.trim(); if (!text) return; if (!Net.alive()) return toast('연결되어 있지 않아요'); Net.send({ t: 'chat', text }); addChat(text, true); };
  $('#chatForm').onsubmit = e => { e.preventDefault(); sendChat($('#chatIn').value); $('#chatIn').value = ''; };
  $('.emo').onclick = e => { if (e.target.tagName === 'BUTTON') sendChat(e.target.textContent); };

  /* ---------- 비교 탐색기 ---------- */
  const X = { t: 'C', pos: {}, views: {} };
  function demoBoard(game) {
    const b = new Array(90).fill(null), d = DEMO[X.t];
    d.ex.forEach(([i, t, s], k) => { b[i] = { t, s, id: 10 + k }; });
    b[X.pos[game]] = { t: X.t, s: 0, id: 0 };
    return b;
  }
  function canPlace(game, t, i) {
    const r = (i / 9) | 0, c = i % 9;
    if (DEMO[t].ex.some(e => e[0] === i)) return false;
    if (t === 'K' || t === 'A') return E.inPalace(r, c, 0);
    if (t === 'E' && game === 'xq') return r >= 5;
    if (t === 'P') return r <= 6;
    return true;
  }
  function paintDemo() {
    for (const g of ['jg', 'xq']) {
      const b = demoBoard(g);
      X.views[g].update(b, { sel: X.pos[g], targets: E.pieceMoves(b, g, X.pos[g], []).map(m => m.to) });
      $(g === 'jg' ? '#descJg' : '#descXq').textContent = INFO[X.t][g];
    }
  }
  function pickDemo(t) {
    X.t = t; X.pos = { jg: DEMO[t].jg, xq: DEMO[t].xq };
    $$('#pieceChips .chip').forEach(c => c.classList.toggle('on', c.dataset.t === t));
    for (const g of ['jg', 'xq']) { X.views[g].els.forEach(e => e.remove()); X.views[g].els.clear(); }
    paintDemo();
  }
  function initCompare() {
    $('#pieceChips').innerHTML = Object.keys(PNAME).map(t => `<button class="chip" data-t="${t}">${GLYPH.hanja.jg[1][t]} ${PNAME[t]}</button>`).join('');
    $('#pieceChips').onclick = e => { const c = e.target.closest('.chip'); if (c) pickDemo(c.dataset.t); };
    const place = i => {
      let moved = false;
      for (const g of ['jg', 'xq']) if (canPlace(g, X.t, i)) { X.pos[g] = i; moved = true; }
      if (!moved) return toast('이 기물은 그 자리에 놓을 수 없어요');
      sfx.move(); paintDemo();
    };
    X.views.jg = new BoardView($('#miniJg'), 'jg', place);
    X.views.xq = new BoardView($('#miniXq'), 'xq', place);
    $('#diffs').innerHTML = DIFFS.map(([h, j, x], k) => `<div class="diff"><img src="./img/diff-${DIFF_IMG[k]}.png" alt="" loading="lazy"><h4>${h}</h4><dl><dt class="j">장기</dt><dd>${j}</dd><dt class="x">상치</dt><dd>${x}</dd></dl></div>`).join('');
    pickDemo('C');
  }

  /* ---------- 시작 ---------- */
  function init() {
    // 그라디언트는 화면이 숨겨져도 쓰이도록 한 곳에 모아 둔다
    document.body.appendChild(H(`<svg width="0" height="0" style="position:absolute" aria-hidden="true">${DEFS}</svg>`));
    initCompare();
    document.addEventListener('click', e => {
      const goBtn = e.target.closest('[data-go]');
      if (goBtn) return go(goBtn.dataset.go);
      const st = e.target.closest('[data-start]');
      if (st) openSetup(st.closest('.pick').dataset.game, st.dataset.start);
    });
    $('#btnJoin').onclick = () => Net.joinRoom($('#joinCode').value);
    $('#btnSave').onclick = saveKifu;
    $('.rv').onclick = e => {
      const b = e.target.closest('[data-rv]'); if (!b || !G.st) return;
      const cur = G.review == null ? G.st.moves.length : G.review;
      setReview({ first: 0, prev: cur - 1, next: cur + 1, last: G.st.moves.length }[b.dataset.rv]);
    };
    $('#hist').onclick = e => { const li = e.target.closest('li'); if (li) setReview(+li.dataset.k); };
    $('#btnLoad').onclick = () => $('#kifuFile').click();
    $('#kifuFile').onchange = e => {
      const f = e.target.files[0]; e.target.value = '';
      if (!f) return;
      if (f.size > 500000) return toast('파일이 너무 커요');
      f.text().then(loadKifu);
    };
    $('#btnResume').onclick = resume;
    $('#btnForget').onclick = () => { try { localStorage.removeItem('jgxq-save'); } catch (e) { /* 무시 */ } showResume(); };
    showResume();
    $('#joinCode').addEventListener('keydown', e => { if (e.key === 'Enter') Net.joinRoom($('#joinCode').value); });
    const syncTools = () => { $('#btnLabel').textContent = prefs.label === 'hanja' ? '漢' : '한'; $('#btnSound').innerHTML = IC(prefs.sound ? 'sound' : 'mute'); };
    $('#btnLabel').onclick = () => { prefs.label = prefs.label === 'hanja' ? 'hangul' : 'hanja'; savePrefs(); syncTools(); if (G.st) refresh(); paintDemo(); if (API.onLabel) API.onLabel(); toast(prefs.label === 'hanja' ? '한자 표기' : '한글 표기'); };
    $('#btnSound').onclick = () => { prefs.sound = !prefs.sound; savePrefs(); syncTools(); };
    syncTools();
    const room = new URLSearchParams(location.search).get('room');
    const saved = store.get('jgxq-room');
    if (room) { $('#joinCode').value = room.toUpperCase().slice(0, 6); Net.joinRoom(room); }
    else if (saved && saved.code) { toast('하던 온라인 대국으로 돌아갑니다'); Net.joinRoom(saved.code); }
  }
  const API = window.__app = { G, Net, startGame, doMove, onPoint, BoardView, toast, sfx, confetti, loadKifu, kifu };
  init();
})();
