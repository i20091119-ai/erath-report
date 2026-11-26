/* 장기 × 象棋 온라인 대전 중계 서버 (Cloudflare Workers + Durable Objects)
   방 코드마다 Durable Object 하나가 두 대국자와 관전자의 웹소켓을 이어 줍니다.
   시작 정보와 둔 수를 저장해 두어, 연결이 끊긴 사람이 같은 방으로 돌아오면 판을 그대로 돌려줍니다.
   수가 규칙에 맞는지는 각자의 브라우저가 검사하고, 서버는 기록과 전달만 합니다. */
const KEEP_MS = 12 * 60 * 60 * 1000; // 마지막 활동 뒤 방을 보관하는 시간

export default {
  async fetch(req, env) {
    const m = new URL(req.url).pathname.match(/^\/room\/([A-Z0-9]{6})$/);
    if (!m) return new Response('장기 × 象棋 대전 서버가 동작 중입니다. (v2)', { headers: { 'content-type': 'text/plain; charset=utf-8' } });
    if (req.headers.get('Upgrade') !== 'websocket') return new Response('websocket only', { status: 426 });
    return env.ROOMS.get(env.ROOMS.idFromName(m[1])).fetch(req);
  }
};

export class Room {
  constructor(state) { this.state = state; }

  async load() { return (await this.state.storage.get('room')) || { host: null, guest: null, start: null, moves: [], over: null, clk: null }; }
  async save(R) { await this.state.storage.put('room', R); await this.state.storage.setAlarm(Date.now() + KEEP_MS); }

  async fetch(req) {
    const q = new URL(req.url).searchParams;
    const want = q.get('role'), pid = (q.get('pid') || '').slice(0, 40) || null;
    const R = await this.load();
    let as = want, back = false, err = null;
    if (want === 'host') {
      if (!R.host) R.host = pid || 'host';
      else if (pid && R.host === pid) back = true;
      else err = 'taken';
    } else if (want === 'guest') {
      if (!R.host) err = 'noroom';
      else if (!R.guest) R.guest = pid || 'guest';
      else if (pid && R.guest === pid) back = true;
      else as = 'watch'; // 자리가 찼으면 관전
    } else if (want === 'watch') { if (!R.host) err = 'noroom'; }
    else err = 'noroom';

    const [client, server] = Object.values(new WebSocketPair());
    if (err) {
      server.accept();
      server.send(JSON.stringify({ t: '_err', why: err }));
      server.close(1008, err);
      return new Response(null, { status: 101, webSocket: client });
    }
    if (as !== 'watch') for (const old of this.state.getWebSockets(as)) { try { old.close(4000, 'replaced'); } catch (e) { /* 이미 닫힘 */ } }
    this.state.acceptWebSocket(server, [as]);
    await this.save(R);
    const other = as === 'host' ? 'guest' : 'host';
    const peer = as === 'watch' ? true : this.state.getWebSockets(other).length > 0;
    const sync = R.start ? { start: R.start, moves: R.moves, over: R.over, clk: R.clk, now: Date.now() } : null;
    server.send(JSON.stringify({ t: '_hello', as, back, peer, sync }));
    if (as !== 'watch') for (const o of this.state.getWebSockets(other)) o.send(back ? '{"t":"_back"}' : '{"t":"_joined"}');
    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws, msg) {
    const role = this.state.getTags(ws)[0];
    if (role === 'watch' || typeof msg !== 'string' || msg.length > 4000) return; // 관전자는 보내지 못함
    let d;
    try { d = JSON.parse(msg); } catch (e) { return; }
    if (!d || typeof d.t !== 'string' || d.t[0] === '_') return; // '_'로 시작하는 건 서버 전용
    const R = await this.load();
    let dirty = true;
    if (d.t === 'start' && role === 'host') {
      R.start = { game: d.game, formations: d.formations, hostSide: d.hostSide, clock: d.clock || 0 };
      R.moves = []; R.over = null;
      R.clk = d.clock ? { v: [d.clock * 60000, d.clock * 60000], at: Date.now() } : null;
    } else if (d.t === 'move' && R.start && !R.over && d.mv) {
      R.moves.push(d.mv.pass ? { pass: true } : { from: d.mv.from | 0, to: d.mv.to | 0 });
      if (Array.isArray(d.clk)) R.clk = { v: d.clk.slice(0, 2), at: Date.now() };
    } else if (d.t === 'undoOk' && R.start && !R.over) {
      R.moves.splice(-(d.n === 2 ? 2 : 1));
    } else if (d.t === 'end' && R.start && !R.over) {
      R.over = { winner: d.winner === 0 || d.winner === 1 ? d.winner : null, reason: String(d.reason).slice(0, 20) };
    } else dirty = false;
    if (dirty) await this.save(R);
    for (const o of this.state.getWebSockets()) if (o !== ws) { try { o.send(msg); } catch (e) { /* 닫힌 소켓 */ } }
  }

  webSocketClose(ws) {
    const role = this.state.getTags(ws)[0];
    if (role === 'watch') return;
    if (this.state.getWebSockets(role).some(o => o !== ws)) return; // 새 연결로 바뀐 것뿐이면 알리지 않음
    for (const o of this.state.getWebSockets(role === 'host' ? 'guest' : 'host')) { try { o.send('{"t":"_away"}'); } catch (e) { /* 닫힌 소켓 */ } }
  }
  webSocketError(ws) { this.webSocketClose(ws); }

  async alarm() {
    for (const o of this.state.getWebSockets()) { try { o.close(1001, 'room expired'); } catch (e) { /* 무시 */ } }
    await this.state.storage.deleteAll();
  }
}
