/* AI 계산을 화면과 분리해서 돌리는 워커. 대국 기록을 받아 다시 두어 본 뒤 가장 좋은 수를 돌려준다. */
importScripts('./engine.js');
self.onmessage = (e) => {
  const d = e.data, E = self.Engine;
  const st = E.create(d.game, d.formations, d.opts);
  for (const m of d.moves) E.play(st, m);
  self.postMessage({ id: d.id, mv: st.status === 'play' ? E.bestMove(st, d.level, d.budget) : null });
};
