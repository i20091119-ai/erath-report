/* 배우기: 따라 해 보기 과제 + 차이점 퀴즈 */
(function () {
  'use strict';
  const A = window.__app, E = window.Engine;
  const $ = s => document.querySelector(s);
  const at = (r, c) => r * 9 + c;
  const GN = { jg: '한국 장기', xq: '중국 상치' };

  // 아래쪽(내 편)이 둘 차례. pieces = [자리, 기물, 편(0=나, 1=상대)]
  const LESSONS = [
    {
      g: 'jg', title: '포는 넘어야 움직여요',
      text: '장기의 포는 기물 하나를 넘어야만 움직이고 잡을 수 있어요. 앞의 졸을 넘어서 상대 馬를 잡아 보세요.',
      ok: '잘했어요! 넘을 기물이 없으면 장기의 포는 한 칸도 움직이지 못합니다.',
      pieces: [[at(8, 4), 'K', 0], [at(1, 5), 'K', 1], [at(7, 1), 'C', 0], [at(5, 1), 'P', 0], [at(2, 1), 'H', 1]],
      goal: mv => mv.to === at(2, 1)
    },
    {
      g: 'xq', title: '상치의 포는 그냥 달려요',
      text: '같은 모양인데 이번엔 상치입니다. 상치의 포는 차처럼 넘지 않고도 움직여요. 포를 왼쪽 끝까지 옮겨 보세요. (장기에서는 못 두는 수!)',
      ok: '맞아요. 상치의 포는 움직일 때는 자유롭고, 잡을 때만 하나를 넘습니다.',
      pieces: [[at(9, 4), 'K', 0], [at(0, 3), 'K', 1], [at(7, 1), 'C', 0], [at(5, 1), 'P', 0], [at(2, 1), 'H', 1]],
      goal: mv => mv.to === at(7, 0)
    },
    {
      g: 'jg', title: '포는 포를 못 잡아요',
      text: '위쪽의 상대 包는 넘을 기물이 있어도 잡을 수 없어요. 장기의 포는 포를 잡지도, 넘지도 못합니다. 대신 잡을 수 있는 기물을 찾아 잡으세요.',
      ok: '정답! 車를 잡았어요. 상치에서는 포로 포를 잡을 수 있다는 점이 다릅니다.',
      pieces: [[at(8, 3), 'K', 0], [at(1, 5), 'K', 1], [at(7, 4), 'C', 0], [at(5, 4), 'P', 0], [at(3, 4), 'C', 1], [at(7, 6), 'P', 0], [at(7, 8), 'R', 1]],
      goal: mv => mv.to === at(7, 8)
    },
    {
      g: 'jg', title: '상은 멀리 뛰어요',
      text: '장기의 상은 직선으로 1칸, 이어서 대각선으로 2칸 갑니다. 가는 길이 비어 있어야 해요. 상으로 상대 兵을 잡아 보세요.',
      ok: '좋아요! 장기의 상은 판 전체를 누비는 공격수입니다.',
      pieces: [[at(8, 4), 'K', 0], [at(1, 5), 'K', 1], [at(6, 4), 'E', 0], [at(3, 2), 'P', 1]],
      goal: mv => mv.to === at(3, 2)
    },
    {
      g: 'xq', title: '상은 강을 못 건너요',
      text: '상치의 상은 대각선으로 딱 2칸만 가고, 강을 건널 수 없어요. 상을 눌러 보면 뒤쪽 두 곳만 표시됩니다. 상을 왕 앞(가운데 줄)으로 물려 수비해 보세요.',
      ok: '맞아요. 상치의 상은 자기 진영을 지키는 수비수입니다.',
      pieces: [[at(9, 4), 'K', 0], [at(0, 3), 'K', 1], [at(5, 2), 'E', 0], [at(3, 4), 'P', 1]],
      goal: mv => mv.to === at(7, 4)
    },
    {
      g: 'xq', title: '강을 건넌 병은 옆으로도',
      text: '상치의 병은 강을 건너기 전에는 앞으로만 갑니다. 이 병은 이미 강을 건넜어요. 옆에 있는 상대 卒을 잡아 보세요.',
      ok: '잘했어요! 장기의 졸은 처음부터 옆으로 갈 수 있다는 점이 다릅니다.',
      pieces: [[at(9, 4), 'K', 0], [at(0, 3), 'K', 1], [at(4, 4), 'P', 0], [at(4, 5), 'P', 1]],
      goal: mv => mv.to === at(4, 5)
    },
    {
      g: 'jg', title: '궁성 안에서는 대각선',
      text: '장기의 졸은 상대 궁성 안에서 대각선 앞으로도 갈 수 있어요. 궁성 가운데의 士를 대각선으로 잡아 보세요.',
      ok: '정답! 궁성에 그려진 대각선은 졸·차·포도 다니는 길입니다.',
      pieces: [[at(8, 4), 'K', 0], [at(0, 5), 'K', 1], [at(2, 3), 'P', 0], [at(1, 4), 'A', 1]],
      goal: mv => mv.to === at(1, 4)
    },
    {
      g: 'jg', title: '차도 궁성 대각선을 달려요',
      text: '차는 궁성 안에서 대각선 길을 끝까지 달릴 수 있어요. 궁성 귀에 있는 차로 반대쪽 귀의 士를 잡아 보세요.',
      ok: '멋져요! 상치의 차는 궁성 대각선을 쓰지 못합니다.',
      pieces: [[at(8, 4), 'K', 0], [at(0, 4), 'K', 1], [at(2, 5), 'R', 0], [at(0, 3), 'A', 1]],
      goal: mv => mv.to === at(0, 3)
    },
    {
      g: 'xq', title: '왕끼리 마주 보면 안 돼요',
      text: '먼저 가운데의 馬를 눌러 보세요. 馬가 비키면 두 왕이 마주 보게 되어 한 칸도 움직일 수 없습니다(비장). 그러니 車로 상대 卒을 잡으세요.',
      ok: '맞아요. 상치에서는 왕끼리 마주 보게 되는 수 자체를 둘 수 없습니다.',
      pieces: [[at(9, 4), 'K', 0], [at(0, 4), 'K', 1], [at(5, 4), 'H', 0], [at(7, 0), 'R', 0], [at(3, 0), 'P', 1]],
      goal: mv => mv.to === at(3, 0)
    },
    {
      g: 'jg', title: '빅장을 불러 보세요',
      text: '장기에서는 왕끼리 마주 보게 만들 수 있어요. 이것이 "빅장"입니다. 상대가 다음 수에 풀지 않으면 무승부! 가운데 졸을 옆으로 비켜 빅장을 불러 보세요.',
      ok: '빅장! 지고 있을 때 무승부를 노리는 수로 쓰입니다. 상치에는 없는 규칙이에요.',
      pieces: [[at(8, 4), 'K', 0], [at(1, 4), 'K', 1], [at(5, 4), 'P', 0]],
      goal: (mv, st) => E.kingsFacing(st.board)
    }
  ];

  const QUIZ = [
    { q: '판 가운데에 강(楚河漢界)이 있는 것은?', o: ['한국 장기', '중국 상치', '둘 다'], a: 1, why: '강은 상치에만 있어요. 장기판은 선이 끝까지 이어집니다.' },
    { q: '움직일 때도 반드시 기물 하나를 넘어야 하는 포는?', o: ['장기의 포', '상치의 포', '둘 다'], a: 0, why: '상치의 포는 차처럼 움직이고, 잡을 때만 넘습니다.' },
    { q: '처음부터 옆으로 움직일 수 있는 졸·병은?', o: ['장기의 졸', '상치의 병', '둘 다 안 된다'], a: 0, why: '상치의 병은 강을 건너야 옆으로 갈 수 있어요.' },
    { q: '왕이 궁성 한가운데에서 시작하는 것은?', o: ['한국 장기', '중국 상치', '둘 다'], a: 0, why: '상치의 왕은 궁성 맨 아랫줄 가운데에서 시작합니다.' },
    { q: '강을 건널 수 없는 기물은?', o: ['장기의 상', '상치의 상', '상치의 병'], a: 1, why: '상치의 상은 자기 진영에서만 움직이는 수비 기물입니다.' },
    { q: '두 왕이 같은 줄에서 마주 보면?', o: ['둘 다 둘 수 없는 수', '장기는 빅장, 상치는 둘 수 없음', '둘 다 무승부'], a: 1, why: '장기에서는 빅장(풀지 않으면 무승부), 상치에서는 아예 금지입니다.' },
    { q: '둘 수 있는 수가 하나도 없을 때는?', o: ['둘 다 무승부', '장기는 한수쉼, 상치는 패배', '둘 다 패배'], a: 1, why: '장기는 쉴 수 있지만, 상치는 쉴 수 없어 그대로 집니다.' },
    { q: '먼저 두는 쪽은?', o: ['장기는 초(푸른색), 상치는 홍(붉은색)', '둘 다 붉은색', '장기는 한(붉은색), 상치는 흑'], a: 0, why: '장기는 초가, 상치는 홍이 먼저 둡니다.' },
    { q: '시작할 때 마와 상의 자리를 고를 수 있는 것은?', o: ['한국 장기', '중국 상치', '둘 다'], a: 0, why: '장기에는 네 가지 상차림이 있고, 상치는 배치가 항상 같아요.' },
    { q: '차가 궁성의 대각선 길을 달릴 수 있는 것은?', o: ['한국 장기', '중국 상치', '둘 다'], a: 0, why: '장기에서는 차·포·졸도 궁성 대각선을 씁니다.' }
  ];

  /* ---------- 따라 해 보기 ---------- */
  let li = 0, st, view, sel = null, targets = [], solved = false, msg = '', timer = null;
  const done = new Set();
  try { JSON.parse(localStorage.getItem('jgxq-lessons') || '[]').forEach(x => done.add(x)); } catch (e) { /* 저장소 없음 */ }
  const saveDone = () => { try { localStorage.setItem('jgxq-lessons', JSON.stringify([...done])); } catch (e) { /* 무시 */ } };

  function load(i) {
    clearTimeout(timer);
    li = (i + LESSONS.length) % LESSONS.length;
    const L = LESSONS[li];
    st = E.create(L.g, null, { pieces: L.pieces });
    view = new A.BoardView($('#lsBoard'), L.g, onPoint);
    sel = null; targets = []; solved = false; msg = '';
    render();
  }
  function render() {
    const L = LESSONS[li], last = st.moves[st.moves.length - 1];
    view.update(st.board, { sel, targets, last: last || null });
    $('#lsNo').textContent = `과제 ${li + 1} / ${LESSONS.length} · ${GN[L.g]}`;
    $('#lsTitle').textContent = L.title;
    $('#lsText').textContent = L.text;
    const m = $('#lsMsg'); m.textContent = msg; m.className = 'lsmsg' + (solved ? ' ok' : msg ? ' no' : '');
    $('#lsNext').classList.toggle('gold', solved);
    $('#lsDots').innerHTML = LESSONS.map((x, k) => `<button class="${k === li ? 'cur' : ''}${done.has(k) ? ' done' : ''}" data-k="${k}" aria-label="과제 ${k + 1}"></button>`).join('');
  }
  function onPoint(i) {
    if (solved || timer) return;
    const L = LESSONS[li], p = st.board[i];
    if (sel != null && targets.includes(i)) {
      const mv = { from: sel, to: i };
      const cap = st.board[i];
      E.play(st, mv);
      sel = null; targets = [];
      if (L.goal(mv, st)) {
        solved = true; msg = L.ok; done.add(li); saveDone();
        if (done.size === LESSONS.length) { A.confetti(); A.sfx.win(); } else if (cap) A.sfx.cap(); else A.sfx.move();
      } else {
        msg = '둘 수는 있는 수예요. 하지만 과제와는 달라요. 다시 해 볼까요?';
        A.sfx.move();
        timer = setTimeout(() => { timer = null; const keep = msg; load(li); msg = keep; render(); }, 1100);
      }
    } else if (p && p.s === 0) {
      sel = i; targets = E.legalMoves(st.board, st.game, 0, i).map(m => m.to);
      msg = targets.length ? '' : '이 기물은 지금 한 칸도 움직일 수 없어요.';
    } else { sel = null; targets = []; }
    render();
  }

  /* ---------- 퀴즈 ---------- */
  let qi = 0, score = 0, picked = null;
  function quiz() {
    const box = $('#quiz');
    if (qi >= QUIZ.length) {
      const all = score === QUIZ.length;
      box.innerHTML = `<img class="big" src="./img/result-${all ? 'win' : 'draw'}.png" alt=""><h3 style="text-align:center">${QUIZ.length}문제 중 ${score}문제 정답!</h3>
        <p style="text-align:center">${all ? '완벽해요. 이제 두 게임을 직접 두어 볼 차례예요.' : '틀린 문제는 위의 나란히 비교와 따라 해 보기에서 다시 확인해 보세요.'}</p>
        <div class="row" style="justify-content:center"><button class="btn gold" data-q="again">다시 풀기</button></div>`;
      if (all) { A.confetti(); A.sfx.win(); }
      return;
    }
    const Q = QUIZ[qi];
    box.innerHTML = `<div class="gname">문제 ${qi + 1} / ${QUIZ.length} · 맞힌 개수 ${score}</div><h3>${Q.q}</h3>
      <div class="qopts">${Q.o.map((t, k) => `<button class="btn${picked == null ? '' : k === Q.a ? ' right' : k === picked ? ' wrong' : ''}" data-o="${k}" ${picked == null ? '' : 'disabled'}>${t}</button>`).join('')}</div>
      ${picked == null ? '' : `<p class="lsmsg ${picked === Q.a ? 'ok' : 'no'}">${picked === Q.a ? '정답! ' : '아쉬워요. '}${Q.why}</p><div class="row"><button class="btn gold" data-q="next">${qi + 1 < QUIZ.length ? '다음 문제' : '결과 보기'}</button></div>`}`;
  }

  function init() {
    if (!$('#lsBoard')) return;
    $('#lsPrev').onclick = () => load(li - 1);
    $('#lsNext').onclick = () => load(li + 1);
    $('#lsReset').onclick = () => load(li);
    $('#lsDots').onclick = e => { const b = e.target.closest('button'); if (b) load(+b.dataset.k); };
    $('#quiz').onclick = e => {
      const o = e.target.closest('[data-o]'), q = e.target.closest('[data-q]');
      if (o && picked == null) { picked = +o.dataset.o; if (picked === QUIZ[qi].a) { score++; A.sfx.cap(); } else A.sfx.lose(); quiz(); }
      else if (q) { if (q.dataset.q === 'again') { qi = 0; score = 0; } else qi++; picked = null; quiz(); }
    };
    const first = LESSONS.findIndex((x, k) => !done.has(k));
    load(first < 0 ? 0 : first);
    quiz();
    A.onLabel = render; // 한자/한글 표기를 바꾸면 과제 판도 다시 그린다
    A.LESSONS = LESSONS;
  }
  init();
})();
