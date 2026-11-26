/* 장기(jg) · 상치(xq) 규칙 엔진 + AI
   좌표: 9열 x 10행, index = r*9+c. side 0 = 아래쪽(선수), side 1 = 위쪽. */
(function (root) {
  'use strict';
  const ORTH = [[-1, 0], [1, 0], [0, -1], [0, 1]];
  const DIAG = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
  const inB = (r, c) => r >= 0 && r < 10 && c >= 0 && c < 9;

  function inPalace(r, c, side) {
    if (c < 3 || c > 5) return false;
    if (side === 0) return r >= 7 && r <= 9;
    if (side === 1) return r >= 0 && r <= 2;
    return (r >= 0 && r <= 2) || (r >= 7 && r <= 9);
  }
  // 궁성 대각선으로 이어진 점들
  function palaceDiag(r, c) {
    if (!inPalace(r, c)) return [];
    const pr = r <= 2 ? 0 : 7, cr = pr + 1;
    if (r === cr && c === 4) return [[pr, 3], [pr, 5], [pr + 2, 3], [pr + 2, 5]];
    if (r !== cr && c !== 4) return [[cr, 4]];
    return [];
  }

  const FORMATIONS = {
    EHEH: '상마상마', HEHE: '마상마상', HEEH: '마상상마 (안상)', EHHE: '상마마상 (바깥상)'
  };

  function setup(game, formations) {
    const b = new Array(90).fill(null);
    let id = 0;
    const put = (r, c, t, s) => { b[r * 9 + c] = { t, s, id: id++ }; };
    for (const s of [1, 0]) {
      const back = s === 1 ? 0 : 9, fwd = s === 1 ? 1 : -1;
      if (game === 'xq') {
        'RHEAKAEHR'.split('').forEach((t, c) => put(back, c, t, s));
      } else {
        const f = (formations && formations[s]) || 'EHEH';
        const cols = s === 0 ? [1, 2, 6, 7] : [7, 6, 2, 1]; // 각자 자기 왼쪽부터
        put(back, 0, 'R', s); put(back, 8, 'R', s);
        put(back, 3, 'A', s); put(back, 5, 'A', s);
        cols.forEach((c, k) => put(back, c, f[k], s));
        put(back + fwd, 4, 'K', s);
      }
      put(back + 2 * fwd, 1, 'C', s); put(back + 2 * fwd, 7, 'C', s);
      for (let c = 0; c < 9; c += 2) put(back + 3 * fwd, c, 'P', s);
    }
    return b;
  }

  // i 위치 기물의 의사(pseudo) 이동 생성
  function pieceMoves(b, g, i, out) {
    const p = b[i], r = (i / 9) | 0, c = i % 9, s = p.s, fwd = s === 0 ? -1 : 1;
    const add = (rr, cc) => {
      if (!inB(rr, cc)) return false;
      const q = b[rr * 9 + cc];
      if (q && q.s === s) return false;
      out.push({ from: i, to: rr * 9 + cc });
      return true;
    };
    const empty = (rr, cc) => inB(rr, cc) && !b[rr * 9 + cc];
    switch (p.t) {
      case 'K':
        for (const [d, e] of ORTH) if (inPalace(r + d, c + e, s)) add(r + d, c + e);
        if (g === 'xq') { // 비장(飛將): 마주 보는 왕은 서로 잡을 수 있다 → 마주 보기 금지
          for (let rr = r + fwd; rr >= 0 && rr < 10; rr += fwd) {
            const q = b[rr * 9 + c];
            if (q) { if (q.t === 'K') out.push({ from: i, to: rr * 9 + c }); break; }
          }
        } else for (const [rr, cc] of palaceDiag(r, c)) add(rr, cc);
        break;
      case 'A':
        if (g === 'xq') { for (const [d, e] of DIAG) if (inPalace(r + d, c + e, s)) add(r + d, c + e); }
        else {
          for (const [d, e] of ORTH) if (inPalace(r + d, c + e, s)) add(r + d, c + e);
          for (const [rr, cc] of palaceDiag(r, c)) add(rr, cc);
        }
        break;
      case 'E':
        if (g === 'xq') {
          for (const [d, e] of DIAG) {
            const rr = r + 2 * d, cc = c + 2 * e;
            if (!empty(r + d, c + e)) continue;
            if (s === 0 ? rr < 5 : rr > 4) continue; // 강을 못 건넘
            add(rr, cc);
          }
        } else {
          for (const [d, e] of ORTH) {
            if (!empty(r + d, c + e)) continue;
            for (const k of [-1, 1]) {
              const mr = d ? r + 2 * d : r + k, mc = d ? c + k : c + 2 * e;
              const tr = d ? r + 3 * d : r + 2 * k, tc = d ? c + 2 * k : c + 3 * e;
              if (empty(mr, mc)) add(tr, tc);
            }
          }
        }
        break;
      case 'H':
        for (const [d, e] of ORTH) {
          if (!empty(r + d, c + e)) continue;
          for (const k of [-1, 1]) d ? add(r + 2 * d, c + k) : add(r + k, c + 2 * e);
        }
        break;
      case 'R':
        for (const [d, e] of ORTH) {
          let rr = r + d, cc = c + e;
          while (inB(rr, cc)) { const q = b[rr * 9 + cc]; add(rr, cc); if (q) break; rr += d; cc += e; }
        }
        if (g === 'jg') for (const [nr, nc] of palaceDiag(r, c)) {
          const ok = add(nr, nc);
          if (ok && !b[nr * 9 + nc] && nc === 4 && c !== 4) add(2 * nr - r, 2 * nc - c);
        }
        break;
      case 'C':
        for (const [d, e] of ORTH) {
          let rr = r + d, cc = c + e;
          if (g === 'xq') {
            while (empty(rr, cc)) { out.push({ from: i, to: rr * 9 + cc }); rr += d; cc += e; }
            if (!inB(rr, cc)) continue;
            rr += d; cc += e;
            while (empty(rr, cc)) { rr += d; cc += e; }
            if (inB(rr, cc) && b[rr * 9 + cc].s !== s) out.push({ from: i, to: rr * 9 + cc });
          } else {
            while (empty(rr, cc)) { rr += d; cc += e; }
            if (!inB(rr, cc) || b[rr * 9 + cc].t === 'C') continue; // 포는 포를 못 넘음
            rr += d; cc += e;
            while (inB(rr, cc)) {
              const q = b[rr * 9 + cc];
              if (!q) out.push({ from: i, to: rr * 9 + cc });
              else { if (q.s !== s && q.t !== 'C') out.push({ from: i, to: rr * 9 + cc }); break; }
              rr += d; cc += e;
            }
          }
        }
        if (g === 'jg') {
          const n = palaceDiag(r, c);
          if (n.length === 1) { // 귀에서 중앙을 넘어 반대 귀로
            const [mr, mc] = n[0], scr = b[mr * 9 + mc];
            if (scr && scr.t !== 'C') {
              const tr = 2 * mr - r, tc = 2 * mc - c, q = b[tr * 9 + tc];
              if (!q || (q.s !== s && q.t !== 'C')) out.push({ from: i, to: tr * 9 + tc });
            }
          }
        }
        break;
      case 'P':
        add(r + fwd, c);
        if (g === 'jg' || (s === 0 ? r <= 4 : r >= 5)) { add(r, c - 1); add(r, c + 1); }
        if (g === 'jg') for (const [nr, nc] of palaceDiag(r, c)) if (nr - r === fwd) add(nr, nc);
        break;
    }
    return out;
  }

  function allPseudo(b, g, side) {
    const out = [];
    for (let i = 0; i < 90; i++) if (b[i] && b[i].s === side) pieceMoves(b, g, i, out);
    return out;
  }
  function findKing(b, side) {
    for (let i = 0; i < 90; i++) if (b[i] && b[i].t === 'K' && b[i].s === side) return i;
    return -1;
  }
  function inCheck(b, g, side) {
    const k = findKing(b, side);
    if (k < 0) return true;
    const ms = allPseudo(b, g, 1 - side);
    for (const m of ms) if (m.to === k) return true;
    return false;
  }
  function kingsFacing(b) {
    const a = findKing(b, 0), z = findKing(b, 1);
    if (a < 0 || z < 0 || a % 9 !== z % 9) return false;
    for (let i = z + 9; i < a; i += 9) if (b[i]) return false;
    return true;
  }
  function legalMoves(b, g, side, from) {
    const ps = from == null ? allPseudo(b, g, side) : pieceMoves(b, g, from, []);
    return ps.filter(m => {
      const cap = b[m.to]; b[m.to] = b[m.from]; b[m.from] = null;
      const bad = inCheck(b, g, side);
      b[m.from] = b[m.to]; b[m.to] = cap;
      return !bad;
    });
  }

  const SCORE = { R: 13, C: 7, H: 5, E: 3, A: 3, P: 2, K: 0 };
  function score(b) {
    const s = [0, 1.5]; // 한(후수)에게 덤 1.5점
    for (const p of b) if (p) s[p.s] += SCORE[p.t];
    return s;
  }
  const keyOf = (b, turn) => b.map(p => p ? p.t + p.s : '.').join('') + turn;

  function create(game, formations) {
    const st = {
      game, formations: formations || ['EHEH', 'EHEH'], board: setup(game, formations),
      turn: 0, moves: [], captured: [[], []], status: 'play', winner: null, reason: null,
      check: false, bikjangBy: null, passRun: 0, seen: {}
    };
    st.seen[keyOf(st.board, 0)] = 1;
    return st;
  }

  function play(st, mv) {
    if (st.status !== 'play') return null;
    const b = st.board, g = st.game, me = st.turn, opp = 1 - me;
    const rec = { from: mv.from, to: mv.to, pass: !!mv.pass, side: me, piece: null, cap: null, check: false };
    if (mv.pass) { st.passRun++; }
    else {
      st.passRun = 0;
      rec.piece = b[mv.from]; rec.cap = b[mv.to];
      if (rec.cap) st.captured[me].push(rec.cap);
      b[mv.to] = b[mv.from]; b[mv.from] = null;
    }
    st.moves.push(rec);
    st.turn = opp;
    st.check = rec.check = inCheck(b, g, opp);
    const replies = legalMoves(b, g, opp);
    const end = (winner, reason) => { st.status = 'over'; st.winner = winner; st.reason = reason; };
    if (g === 'xq') {
      if (!replies.length) end(me, st.check ? 'checkmate' : 'stalemate');
    } else {
      if (st.check && !replies.length) end(me, 'checkmate');
      else if (kingsFacing(b)) {
        if (st.bikjangBy !== null) end(null, 'bikjang'); else st.bikjangBy = me;
      } else st.bikjangBy = null;
      if (st.status === 'play' && st.passRun >= 2) {
        const sc = score(b);
        end(sc[0] > sc[1] ? 0 : 1, 'score');
      }
    }
    if (st.status === 'play') {
      const k = keyOf(b, st.turn);
      st.seen[k] = (st.seen[k] || 0) + 1;
      if (st.seen[k] >= 3) end(null, 'repetition');
    }
    return rec;
  }

  function undo(st, n) {
    const keep = st.moves.slice(0, Math.max(0, st.moves.length - n));
    const fresh = create(st.game, st.formations);
    for (const m of keep) play(fresh, m);
    Object.assign(st, fresh);
  }

  /* ---------------- AI ---------------- */
  const VAL = {
    xq: { K: 100000, R: 900, C: 450, H: 400, E: 200, A: 200, P: 100 },
    jg: { K: 100000, R: 1300, C: 700, H: 500, E: 300, A: 300, P: 200 }
  };
  function evalBoard(b, g, side) {
    const V = VAL[g]; let v = 0;
    for (let i = 0; i < 90; i++) {
      const p = b[i]; if (!p) continue;
      const r = (i / 9) | 0, c = i % 9;
      let x = V[p.t];
      if (p.t === 'P') {
        const adv = p.s === 0 ? 6 - r : r - 3;
        x += adv * (g === 'xq' ? 6 : 8) + (4 - Math.abs(c - 4)) * 3;
        if (g === 'xq' && (p.s === 0 ? r <= 4 : r >= 5)) x += 80;
      } else if (p.t === 'H' || p.t === 'R' || p.t === 'C') x += (4 - Math.abs(c - 4)) * 4;
      v += p.s === side ? x : -x;
    }
    return v;
  }
  const WIN = 1e6;
  function ordered(b, g, side, capsOnly) {
    const V = VAL[g];
    let ms = allPseudo(b, g, side);
    for (const m of ms) m.o = b[m.to] ? V[b[m.to].t] * 10 - V[b[m.from].t] / 10 : 0;
    if (capsOnly) ms = ms.filter(m => m.o);
    return ms.sort((x, y) => y.o - x.o);
  }
  function quiesce(b, g, side, alpha, beta, qd) {
    const stand = evalBoard(b, g, side);
    if (qd === 0 || stand >= beta) return stand;
    if (stand > alpha) alpha = stand;
    for (const m of ordered(b, g, side, true)) {
      const cap = b[m.to];
      if (cap.t === 'K') return WIN;
      b[m.to] = b[m.from]; b[m.from] = null;
      const v = -quiesce(b, g, 1 - side, -beta, -alpha, qd - 1);
      b[m.from] = b[m.to]; b[m.to] = cap;
      if (v >= beta) return v;
      if (v > alpha) alpha = v;
    }
    return alpha;
  }
  function nega(b, g, side, depth, alpha, beta, ply, ctx) {
    if ((++ctx.nodes & 2047) === 0 && Date.now() > ctx.deadline) ctx.abort = true;
    if (ctx.abort) return 0;
    if (depth <= 0) return quiesce(b, g, side, alpha, beta, 3);
    const ms = ordered(b, g, side, false);
    let best = g === 'xq' ? -WIN + ply : evalBoard(b, g, side);
    if (!ms.length) return best;
    best = -Infinity;
    for (const m of ms) {
      const cap = b[m.to];
      if (cap && cap.t === 'K') return WIN - ply;
      b[m.to] = b[m.from]; b[m.from] = null;
      const v = -nega(b, g, 1 - side, depth - 1, -beta, -alpha, ply + 1, ctx);
      b[m.from] = b[m.to]; b[m.to] = cap;
      if (v > best) best = v;
      if (v > alpha) alpha = v;
      if (alpha >= beta) break;
    }
    return best;
  }
  // level 1(쉬움) 2(보통) 3(어려움)
  function bestMove(st, level) {
    const b = st.board.slice(), g = st.game, side = st.turn;
    let roots = legalMoves(b, g, side);
    if (!roots.length) return g === 'jg' && !st.check ? { pass: true } : null;
    const maxDepth = [1, 1, 2, 5][level] || 2, budget = [0, 300, 800, 1500][level] || 800;
    const ctx = { nodes: 0, deadline: Date.now() + budget, abort: false };
    const noise = level === 1 ? 120 : 12;
    let bestAll = roots[0];
    for (let d = 1; d <= maxDepth; d++) {
      let alpha = -Infinity, best = null;
      for (const m of roots) {
        const cap = b[m.to]; b[m.to] = b[m.from]; b[m.from] = null;
        let v = -nega(b, g, 1 - side, d - 1, -Infinity, -alpha + 40, 1, ctx);
        const rep = st.seen[keyOf(b, 1 - side)] || 0;
        // 빅장을 풀지 않으면 무승부 → 지고 있을 때만 받아들인다
        const draw = g === 'jg' && st.bikjangBy !== null && kingsFacing(b);
        b[m.from] = b[m.to]; b[m.to] = cap;
        if (ctx.abort) break;
        if (draw) v = evalBoard(b, g, side) > -300 ? -5000 : 5000;
        v += (Math.random() - 0.5) * noise - rep * 60;
        m.v = v;
        if (v > alpha) { alpha = v; best = m; }
      }
      if (ctx.abort) break;
      bestAll = best || bestAll;
      roots.sort((x, y) => y.v - x.v);
    }
    return { from: bestAll.from, to: bestAll.to };
  }

  root.Engine = {
    FORMATIONS, SCORE, inPalace, palaceDiag, setup, pieceMoves, allPseudo, legalMoves, inCheck,
    kingsFacing, score, create, play, undo, bestMove, findKing
  };
})(typeof window !== 'undefined' ? window : globalThis);
