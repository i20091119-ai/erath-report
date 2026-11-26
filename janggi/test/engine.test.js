// 실행: node --test janggi/test/engine.test.js
const test = require('node:test');
const assert = require('node:assert');
require('../engine.js');
const E = globalThis.Engine;
const at = (r, c) => r * 9 + c;
const tos = (st, from) => E.legalMoves(st.board, st.game, st.turn, from).map(m => m.to).sort((a, b) => a - b);
const pos = (game, pieces, turn) => E.create(game, null, { pieces, turn });
const K = [[at(9, 4), 'K', 0], [at(0, 3), 'K', 1]]; // 서로 마주 보지 않는 두 왕

test('상치 첫 국면의 합법수는 44개', () => {
  const st = E.create('xq');
  assert.strictEqual(E.legalMoves(st.board, 'xq', 0).length, 44);
});

test('장기 상차림은 각자 자기 왼쪽부터 놓인다', () => {
  const st = E.create('jg', ['HEEH', 'EHHE']);
  assert.deepStrictEqual([1, 2, 6, 7].map(c => st.board[at(9, c)].t).join(''), 'HEEH');
  assert.deepStrictEqual([7, 6, 2, 1].map(c => st.board[at(0, c)].t).join(''), 'EHHE');
  assert.strictEqual(st.board[at(8, 4)].t, 'K');
});

test('포: 상치는 자유 이동 + 넘어서 잡기, 장기는 넘어야만 이동', () => {
  const ps = [...K, [at(7, 1), 'C', 0], [at(4, 1), 'P', 0], [at(2, 1), 'H', 1]];
  const xq = tos(pos('xq', ps), at(7, 1)), jg = tos(pos('jg', ps), at(7, 1));
  assert.ok(xq.includes(at(7, 0)) && xq.includes(at(5, 1)) && xq.includes(at(2, 1)));
  assert.ok(!xq.includes(at(3, 1)));
  assert.deepStrictEqual(jg, [at(2, 1), at(3, 1)]);
});

test('장기 포는 포를 넘지도 잡지도 못한다', () => {
  const overCannon = pos('jg', [...K, [at(7, 1), 'C', 0], [at(5, 1), 'C', 1], [at(2, 1), 'H', 1]]);
  assert.deepStrictEqual(tos(overCannon, at(7, 1)), []);
  const takeCannon = pos('jg', [...K, [at(7, 1), 'C', 0], [at(5, 1), 'P', 0], [at(2, 1), 'C', 1]]);
  assert.ok(!tos(takeCannon, at(7, 1)).includes(at(2, 1)));
  const xq = pos('xq', [...K, [at(7, 1), 'C', 0], [at(5, 1), 'C', 1], [at(2, 1), 'C', 1]]);
  assert.ok(tos(xq, at(7, 1)).includes(at(2, 1)));
});

test('상: 상치는 강을 못 건너고, 장기는 길이 막히면 못 간다', () => {
  const xq = pos('xq', [...K, [at(5, 2), 'E', 0]]);
  assert.deepStrictEqual(tos(xq, at(5, 2)), [at(7, 0), at(7, 4)]);
  const jg = pos('jg', [...K, [at(6, 4), 'E', 0], [at(5, 4), 'P', 0]]);
  assert.ok(!tos(jg, at(6, 4)).some(t => ((t / 9) | 0) === 3));
  assert.ok(tos(jg, at(6, 4)).includes(at(4, 1)));
});

test('마는 멱(다리)이 막히면 못 간다', () => {
  for (const g of ['jg', 'xq']) {
    const st = pos(g, [...K, [at(5, 4), 'H', 0], [at(4, 4), 'P', 0]]);
    const t = tos(st, at(5, 4));
    assert.ok(!t.includes(at(3, 3)) && !t.includes(at(3, 5)) && t.includes(at(7, 3)));
  }
});

test('졸·병: 상치는 강을 건너야 옆으로, 장기는 처음부터 옆으로', () => {
  assert.deepStrictEqual(tos(pos('xq', [...K, [at(5, 0), 'P', 0]]), at(5, 0)), [at(4, 0)]);
  assert.deepStrictEqual(tos(pos('xq', [...K, [at(4, 0), 'P', 0]]), at(4, 0)), [at(3, 0), at(4, 1)]);
  assert.deepStrictEqual(tos(pos('jg', [...K, [at(6, 0), 'P', 0]]), at(6, 0)), [at(5, 0), at(6, 1)]);
});

test('장기: 궁성 대각선을 차와 졸이 쓴다', () => {
  const king = [[at(9, 4), 'K', 0], [at(0, 4), 'K', 1], [at(5, 4), 'P', 0]];
  const rook = tos(pos('jg', [...king, [at(2, 3), 'R', 0]]), at(2, 3));
  assert.ok(rook.includes(at(1, 4)) && rook.includes(at(0, 5)));
  assert.ok(!tos(pos('xq', [...king, [at(2, 3), 'R', 0]]), at(2, 3)).includes(at(1, 4)));
  assert.ok(tos(pos('jg', [...king, [at(2, 3), 'P', 0]]), at(2, 3)).includes(at(1, 4)));
});

test('왕과 사: 장기는 궁성 선을 따라 대각선도, 상치 왕은 직선만 사는 대각선만', () => {
  const jgK = tos(pos('jg', [[at(8, 4), 'K', 0], [at(0, 3), 'K', 1]]), at(8, 4));
  assert.strictEqual(jgK.length, 8);
  const xqK = tos(pos('xq', [[at(8, 4), 'K', 0], [at(0, 3), 'K', 1]]), at(8, 4));
  assert.deepStrictEqual(xqK, [at(7, 4), at(8, 3), at(8, 5), at(9, 4)].filter(t => t % 9 !== 3)); // 3열은 상대 왕과 마주 봐서 금지
  assert.deepStrictEqual(tos(pos('xq', [...K, [at(8, 4), 'A', 0]]), at(8, 4)), [at(7, 3), at(7, 5), at(9, 3), at(9, 5)]);
});

test('왕끼리 마주 보기: 상치는 둘 수 없고, 장기는 빅장 → 안 풀면 무승부', () => {
  const ps = [[at(9, 4), 'K', 0], [at(0, 4), 'K', 1], [at(5, 4), 'R', 0], [at(3, 0), 'P', 1]];
  assert.ok(!tos(pos('xq', ps), at(5, 4)).includes(at(5, 0)));
  const jg = pos('jg', ps);
  E.play(jg, { from: at(5, 4), to: at(5, 0) });
  assert.strictEqual(jg.bikjangBy, 0);
  assert.strictEqual(jg.status, 'play');
  E.play(jg, { from: at(3, 0), to: at(3, 1) });
  assert.deepStrictEqual([jg.status, jg.winner, jg.reason], ['over', null, 'bikjang']);
});

test('외통은 승리, 상치는 둘 수 없으면 장군이 아니어도 패배', () => {
  const mate = pos('xq', [[at(9, 4), 'K', 0], [at(0, 3), 'K', 1], [at(5, 0), 'R', 0], [at(1, 8), 'R', 0]]);
  E.play(mate, { from: at(5, 0), to: at(0, 0) });
  assert.deepStrictEqual([mate.status, mate.winner, mate.reason], ['over', 0, 'checkmate']);
  const stale = pos('xq', [[at(9, 4), 'K', 0], [at(0, 3), 'K', 1], [at(5, 2), 'R', 0], [at(1, 8), 'R', 0]]);
  E.play(stale, { from: at(5, 2), to: at(5, 4) }); // 왕이 갈 곳이 없지만 장군은 아님
  assert.deepStrictEqual([stale.status, stale.winner, stale.reason], ['over', 0, 'stalemate']);
});

test('장기: 한수쉼이 되고, 둘 다 쉬면 점수로 판정', () => {
  const st = E.create('jg');
  E.play(st, { pass: true });
  assert.strictEqual(st.status, 'play');
  E.play(st, { pass: true });
  assert.deepStrictEqual([st.status, st.winner, st.reason], ['over', 1, 'score']); // 한이 덤 1.5점
});

test('한쪽만 계속 장군을 부르며 반복하면 그쪽이 진다', () => {
  const st = pos('xq', [[at(9, 3), 'K', 0], [at(0, 4), 'K', 1], [at(5, 4), 'R', 0], [at(9, 0), 'P', 1]]);
  E.play(st, { from: at(5, 4), to: at(5, 5) }); // 준비: 차를 옆으로
  E.play(st, { from: at(0, 4), to: at(0, 5) }); // 왕이 같은 줄로 → 다음부터 차가 계속 장군
  const loop = [[at(5, 5), at(4, 5)], [at(0, 5), at(0, 4)], [at(4, 5), at(4, 4)], [at(0, 4), at(0, 5)], [at(4, 4), at(4, 5)], [at(0, 5), at(0, 4)], [at(4, 5), at(4, 4)], [at(0, 4), at(0, 5)], [at(4, 4), at(4, 5)], [at(0, 5), at(0, 4)], [at(4, 5), at(4, 4)]];
  for (const [f, t] of loop) { if (st.status !== 'play') break; assert.ok(E.play(st, { from: f, to: t })); }
  assert.deepStrictEqual([st.status, st.winner, st.reason], ['over', 1, 'perpetual']);
});

test('무르기는 이전 국면을 그대로 되돌린다', () => {
  const st = E.create('jg', ['EHEH', 'HEHE']);
  const before = st.board.map(p => p && p.t + p.s).join();
  E.play(st, { from: at(6, 4), to: at(5, 4) });
  E.play(st, { from: at(3, 4), to: at(4, 4) });
  E.undo(st, 2);
  assert.strictEqual(st.board.map(p => p && p.t + p.s).join(), before);
  assert.strictEqual(st.turn, 0);
});

test('AI는 합법수만 두고, 한 수에 이기는 수를 찾는다', () => {
  for (const g of ['jg', 'xq']) {
    const st = E.create(g);
    const mv = E.bestMove(st, 2, 200);
    assert.ok(E.legalMoves(st.board, g, 0, mv.from).some(m => m.to === mv.to));
  }
  const st = pos('xq', [[at(9, 4), 'K', 0], [at(0, 3), 'K', 1], [at(5, 0), 'R', 0], [at(1, 8), 'R', 0]]);
  E.play(st, E.bestMove(st, 3, 500));
  assert.deepStrictEqual([st.status, st.winner], ['over', 0]);
});

test('AI끼리 끝까지 두어도 오류 없이 끝난다', () => {
  for (const g of ['jg', 'xq']) {
    const st = E.create(g);
    for (let k = 0; k < 500 && st.status === 'play'; k++) assert.ok(E.play(st, E.bestMove(st, 1)));
    assert.strictEqual(st.status, 'over');
  }
});
