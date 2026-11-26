/* 장기 × 象棋 온라인 대전 중계 서버 (Cloudflare Workers + Durable Objects)
   방 코드마다 Durable Object 하나가 두 사람의 웹소켓을 이어 줍니다.
   게임 규칙은 각자의 브라우저가 검사하고, 서버는 메시지만 전달합니다. */
export default {
  async fetch(req, env) {
    const m = new URL(req.url).pathname.match(/^\/room\/([A-Z0-9]{6})$/);
    if (!m) return new Response('장기 × 象棋 대전 서버가 동작 중입니다.', { headers: { 'content-type': 'text/plain; charset=utf-8' } });
    if (req.headers.get('Upgrade') !== 'websocket') return new Response('websocket only', { status: 426 });
    return env.ROOMS.get(env.ROOMS.idFromName(m[1])).fetch(req);
  }
};

export class Room {
  constructor(state) { this.state = state; }

  async fetch(req) {
    const role = new URL(req.url).searchParams.get('role') === 'host' ? 'host' : 'guest';
    const all = this.state.getWebSockets(), hasHost = this.state.getWebSockets('host').length > 0;
    const err = role === 'host' ? (all.length ? 'taken' : null) : (!hasHost ? 'noroom' : all.length >= 2 ? 'full' : null);
    const [client, server] = Object.values(new WebSocketPair());
    if (err) {
      server.accept();
      server.send(JSON.stringify({ t: '_err', why: err }));
      server.close(1008, err);
    } else {
      this.state.acceptWebSocket(server, [role]);
      if (role === 'guest') for (const h of this.state.getWebSockets('host')) h.send('{"t":"_joined"}');
    }
    return new Response(null, { status: 101, webSocket: client });
  }

  others(ws) { return this.state.getWebSockets().filter(o => o !== ws); }

  webSocketMessage(ws, msg) {
    if (typeof msg !== 'string' || msg.length > 2000 || msg.startsWith('{"t":"_')) return; // '_'로 시작하는 건 서버 전용
    for (const o of this.others(ws)) o.send(msg);
  }
  webSocketClose(ws) {
    for (const o of this.others(ws)) { try { o.send('{"t":"_left"}'); } catch (e) { /* 이미 닫힘 */ } }
  }
  webSocketError(ws) { this.webSocketClose(ws); }
}
