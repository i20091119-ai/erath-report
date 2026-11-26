#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""장기 × 象棋 — 한국 장기와 중국 상치를 함께 두는 파이썬 프로그램

실행:  python janggi_xiangqi.py
필요한 것: 파이썬 3.8 이상 (tkinter 포함 — 윈도우용 파이썬에는 기본으로 들어 있음). 추가 설치 없음.
그림: 이 파일 옆의 img 폴더에 있는 나무결·메달·아이콘 그림을 쓴다. img 폴더가 없어도 도형으로 그려서 실행된다.

구성
  1) 규칙 엔진  : 두 게임의 기물 이동, 장군·외통, 빅장, 한수쉼, 반복·수 제한 판정
  2) AI         : 알파-베타 탐색 (쉬움 / 보통 / 어려움)
  3) 온라인     : 웹소켓으로 대전 서버에 접속 (웹판과 같은 서버 — 웹판 사용자와도 대국 가능)
  4) 화면(tkinter): 판, 대국 설정, 기보, 기물별 규칙 비교 설명

좌표: 9열 × 10행, 칸 번호 = 행 × 9 + 열. side 0 = 아래쪽(먼저 두는 쪽), side 1 = 위쪽.
"""
import base64
import json
import os
import random
import socket
import ssl
import struct
import threading
import time

# =============================================================================
# 1. 규칙 엔진
# =============================================================================
ORTH = ((-1, 0), (1, 0), (0, -1), (0, 1))
DIAG = ((-1, -1), (-1, 1), (1, -1), (1, 1))
FORMATIONS = {'EHEH': '상마상마', 'HEHE': '마상마상', 'HEEH': '마상상마 (안상)', 'EHHE': '상마마상 (바깥상)'}
SCORE = {'R': 13, 'C': 7, 'H': 5, 'E': 3, 'A': 3, 'P': 2, 'K': 0}
JG_MOVE_LIMIT = 200   # 장기: 200수를 넘기면 점수로 판정
XQ_QUIET_LIMIT = 120  # 상치: 120수 동안 잡은 기물이 없으면 무승부


def in_b(r, c):
    return 0 <= r < 10 and 0 <= c < 9


def in_palace(r, c, side=None):
    if c < 3 or c > 5:
        return False
    if side == 0:
        return 7 <= r <= 9
    if side == 1:
        return 0 <= r <= 2
    return 0 <= r <= 2 or 7 <= r <= 9


def palace_diag(r, c):
    """궁성 대각선으로 이어진 점들"""
    if not in_palace(r, c):
        return ()
    pr = 0 if r <= 2 else 7
    cr = pr + 1
    if r == cr and c == 4:
        return ((pr, 3), (pr, 5), (pr + 2, 3), (pr + 2, 5))
    if r != cr and c != 4:
        return ((cr, 4),)
    return ()


def setup(game, formations=None):
    """처음 배치. 기물은 (종류, 편, 고유번호) 튜플."""
    b = [None] * 90
    n = [0]

    def put(r, c, t, s):
        b[r * 9 + c] = (t, s, n[0])
        n[0] += 1

    for s in (1, 0):
        back, fwd = (0, 1) if s == 1 else (9, -1)
        if game == 'xq':
            for c, t in enumerate('RHEAKAEHR'):
                put(back, c, t, s)
        else:
            f = (formations[s] if formations and formations[s] else 'EHEH')
            cols = (1, 2, 6, 7) if s == 0 else (7, 6, 2, 1)  # 각자 자기 왼쪽부터
            put(back, 0, 'R', s); put(back, 8, 'R', s)
            put(back, 3, 'A', s); put(back, 5, 'A', s)
            for k, c in enumerate(cols):
                put(back, c, f[k], s)
            put(back + fwd, 4, 'K', s)
        put(back + 2 * fwd, 1, 'C', s); put(back + 2 * fwd, 7, 'C', s)
        for c in range(0, 9, 2):
            put(back + 3 * fwd, c, 'P', s)
    return b


def piece_moves(b, g, i, out):
    """i 칸 기물이 갈 수 있는 곳(자기 왕의 안전은 아직 따지지 않음)을 out 에 (from, to) 로 추가"""
    t, s, _ = b[i]
    r, c = divmod(i, 9)
    fwd = -1 if s == 0 else 1

    def add(rr, cc):
        if not in_b(rr, cc):
            return False
        q = b[rr * 9 + cc]
        if q is not None and q[1] == s:
            return False
        out.append((i, rr * 9 + cc))
        return True

    def empty(rr, cc):
        return in_b(rr, cc) and b[rr * 9 + cc] is None

    if t == 'K':
        for d, e in ORTH:
            if in_palace(r + d, c + e, s):
                add(r + d, c + e)
        if g == 'xq':  # 비장: 마주 보는 왕은 서로 잡을 수 있다 → 마주 보는 수는 둘 수 없게 된다
            rr = r + fwd
            while 0 <= rr < 10:
                q = b[rr * 9 + c]
                if q is not None:
                    if q[0] == 'K':
                        out.append((i, rr * 9 + c))
                    break
                rr += fwd
        else:
            for rr, cc in palace_diag(r, c):
                add(rr, cc)
    elif t == 'A':
        if g == 'xq':
            for d, e in DIAG:
                if in_palace(r + d, c + e, s):
                    add(r + d, c + e)
        else:
            for d, e in ORTH:
                if in_palace(r + d, c + e, s):
                    add(r + d, c + e)
            for rr, cc in palace_diag(r, c):
                add(rr, cc)
    elif t == 'E':
        if g == 'xq':
            for d, e in DIAG:
                rr, cc = r + 2 * d, c + 2 * e
                if not empty(r + d, c + e):
                    continue
                if (rr < 5) if s == 0 else (rr > 4):  # 강을 못 건넘
                    continue
                add(rr, cc)
        else:
            for d, e in ORTH:
                if not empty(r + d, c + e):
                    continue
                for k in (-1, 1):
                    if d:
                        mr, mc, tr, tc = r + 2 * d, c + k, r + 3 * d, c + 2 * k
                    else:
                        mr, mc, tr, tc = r + k, c + 2 * e, r + 2 * k, c + 3 * e
                    if empty(mr, mc):
                        add(tr, tc)
    elif t == 'H':
        for d, e in ORTH:
            if not empty(r + d, c + e):  # 멱(다리)이 막히면 못 감
                continue
            for k in (-1, 1):
                if d:
                    add(r + 2 * d, c + k)
                else:
                    add(r + k, c + 2 * e)
    elif t == 'R':
        for d, e in ORTH:
            rr, cc = r + d, c + e
            while in_b(rr, cc):
                q = b[rr * 9 + cc]
                add(rr, cc)
                if q is not None:
                    break
                rr += d; cc += e
        if g == 'jg':
            for nr, nc in palace_diag(r, c):
                if add(nr, nc) and b[nr * 9 + nc] is None and nc == 4 and c != 4:
                    add(2 * nr - r, 2 * nc - c)
    elif t == 'C':
        for d, e in ORTH:
            rr, cc = r + d, c + e
            if g == 'xq':
                while empty(rr, cc):  # 움직일 때는 차처럼
                    out.append((i, rr * 9 + cc))
                    rr += d; cc += e
                if not in_b(rr, cc):
                    continue
                rr += d; cc += e
                while empty(rr, cc):
                    rr += d; cc += e
                if in_b(rr, cc) and b[rr * 9 + cc][1] != s:  # 하나를 넘어서 잡기
                    out.append((i, rr * 9 + cc))
            else:
                while empty(rr, cc):
                    rr += d; cc += e
                if not in_b(rr, cc) or b[rr * 9 + cc][0] == 'C':  # 넘을 기물이 없거나 포이면 못 감
                    continue
                rr += d; cc += e
                while in_b(rr, cc):
                    q = b[rr * 9 + cc]
                    if q is None:
                        out.append((i, rr * 9 + cc))
                    else:
                        if q[1] != s and q[0] != 'C':  # 포는 포를 못 잡음
                            out.append((i, rr * 9 + cc))
                        break
                    rr += d; cc += e
        if g == 'jg':
            n = palace_diag(r, c)
            if len(n) == 1:  # 궁성 귀에서 가운데를 넘어 반대 귀로
                mr, mc = n[0]
                scr = b[mr * 9 + mc]
                if scr is not None and scr[0] != 'C':
                    tr, tc = 2 * mr - r, 2 * mc - c
                    q = b[tr * 9 + tc]
                    if q is None or (q[1] != s and q[0] != 'C'):
                        out.append((i, tr * 9 + tc))
    elif t == 'P':
        add(r + fwd, c)
        if g == 'jg' or (r <= 4 if s == 0 else r >= 5):
            add(r, c - 1); add(r, c + 1)
        if g == 'jg':
            for nr, nc in palace_diag(r, c):
                if nr - r == fwd:
                    add(nr, nc)
    return out


def all_pseudo(b, g, side):
    out = []
    for i in range(90):
        p = b[i]
        if p is not None and p[1] == side:
            piece_moves(b, g, i, out)
    return out


def find_king(b, side):
    for i in range(90):
        p = b[i]
        if p is not None and p[0] == 'K' and p[1] == side:
            return i
    return -1


def in_check(b, g, side):
    k = find_king(b, side)
    if k < 0:
        return True
    return any(to == k for _, to in all_pseudo(b, g, 1 - side))


def kings_facing(b):
    a, z = find_king(b, 0), find_king(b, 1)
    if a < 0 or z < 0 or a % 9 != z % 9:
        return False
    return all(b[i] is None for i in range(z + 9, a, 9))


def legal_moves(b, g, side, frm=None):
    ps = all_pseudo(b, g, side) if frm is None else piece_moves(b, g, frm, [])
    out = []
    for f, t in ps:
        cap = b[t]
        b[t] = b[f]; b[f] = None
        bad = in_check(b, g, side)
        b[f] = b[t]; b[t] = cap
        if not bad:
            out.append((f, t))
    return out


def score(b):
    s = [0, 1.5]  # 한(나중에 두는 쪽)에게 덤 1.5점
    for p in b:
        if p is not None:
            s[p[1]] += SCORE[p[0]]
    return s


def key_of(b, turn):
    return ''.join('.' if p is None else p[0] + str(p[1]) for p in b) + str(turn)


class Game:
    """한 판의 상태. play() 로 수를 두고 undo() 로 되돌린다."""

    def __init__(self, game, formations=None, pieces=None, turn=0):
        self.game = game
        self.formations = formations or ['EHEH', 'EHEH']
        self.pieces = pieces  # [(칸, 종류, 편), ...] 을 주면 그 배치로 시작 (시험·문제용)
        self.first = turn
        if pieces:
            self.board = [None] * 90
            for k, (i, t, s) in enumerate(pieces):
                self.board[i] = (t, s, k)
        else:
            self.board = setup(game, self.formations)
        self.turn = turn
        self.moves = []            # 둔 수 기록 (dict)
        self.captured = [[], []]   # 각 편이 잡은 기물
        self.status = 'play'       # 'play' 또는 'over'
        self.winner = None         # 0, 1 또는 None(무승부)
        self.reason = None
        self.bikjang_by = None     # 빅장을 부른 편
        self.pass_run = 0
        self.quiet = 0
        k = key_of(self.board, self.turn)
        self.seen = {k: 1}
        self.keys = [k]
        self.check = in_check(self.board, game, self.turn)

    def legal(self, frm=None):
        return legal_moves(self.board, self.game, self.turn, frm)

    def can_pass(self):
        return self.game == 'jg' and self.status == 'play' and not self.check

    def _end(self, winner, reason):
        self.status, self.winner, self.reason = 'over', winner, reason

    def play(self, mv):
        """mv = (from, to) 또는 None(한수쉼). 둔 수의 기록을 돌려준다."""
        if self.status != 'play':
            return None
        b, g, me = self.board, self.game, self.turn
        opp = 1 - me
        rec = {'from': None, 'to': None, 'pass': mv is None, 'side': me, 'piece': None, 'cap': None, 'check': False}
        if mv is None:
            self.pass_run += 1
        else:
            f, t = mv
            self.pass_run = 0
            rec.update({'from': f, 'to': t, 'piece': b[f], 'cap': b[t]})
            self.quiet = 0 if b[t] is not None else self.quiet + 1
            if b[t] is not None:
                self.captured[me].append(b[t])
            b[t] = b[f]; b[f] = None
        self.moves.append(rec)
        self.turn = opp
        self.check = rec['check'] = in_check(b, g, opp)
        replies = legal_moves(b, g, opp)
        if g == 'xq':
            if not replies:  # 상치: 둘 수가 없으면 장군이 아니어도 패배
                self._end(me, 'checkmate' if self.check else 'stalemate')
        else:
            if self.check and not replies:
                self._end(me, 'checkmate')
            elif kings_facing(b):  # 빅장: 다음 수에 풀지 않으면 무승부
                if self.bikjang_by is not None:
                    self._end(None, 'bikjang')
                else:
                    self.bikjang_by = me
            else:
                self.bikjang_by = None
            if self.status == 'play' and self.pass_run >= 2:
                sc = score(b)
                self._end(0 if sc[0] > sc[1] else 1, 'score')
        k = key_of(b, self.turn)
        self.keys.append(k)
        self.seen[k] = self.seen.get(k, 0) + 1
        if self.status == 'play' and self.seen[k] >= 3:
            # 같은 모양 3회: 그 사이 한쪽만 줄곧 장군을 불렀다면 그쪽의 패배, 아니면 무승부
            i = len(self.keys) - 1
            j = max(x for x in range(i) if self.keys[x] == k)
            cyc = self.moves[j:i]
            only = []
            for s in (0, 1):
                ms = [m for m in cyc if m['side'] == s]
                only.append(bool(ms) and all(m['check'] for m in ms))
            if only[0] != only[1]:
                self._end(1 if only[0] else 0, 'perpetual')
            else:
                self._end(None, 'repetition')
        if self.status == 'play':
            if g == 'jg' and len(self.moves) >= JG_MOVE_LIMIT:
                sc = score(b)
                self._end(0 if sc[0] > sc[1] else 1, 'movelimit')
            elif g == 'xq' and self.quiet >= XQ_QUIET_LIMIT:
                self._end(None, 'nocapture')
        return rec

    def plain_moves(self):
        return [None if m['pass'] else (m['from'], m['to']) for m in self.moves]

    def undo(self, n=1):
        keep = self.plain_moves()[:max(0, len(self.moves) - n)]
        fresh = Game(self.game, self.formations, self.pieces, self.first)
        for m in keep:
            fresh.play(m)
        self.__dict__.update(fresh.__dict__)

    def copy(self):
        g = Game(self.game, self.formations, self.pieces, self.first)
        for m in self.plain_moves():
            g.play(m)
        return g


# =============================================================================
# 2. AI (알파-베타 탐색)
# =============================================================================
VAL = {
    'xq': {'K': 100000, 'R': 900, 'C': 450, 'H': 400, 'E': 200, 'A': 200, 'P': 100},
    'jg': {'K': 100000, 'R': 1300, 'C': 700, 'H': 500, 'E': 300, 'A': 300, 'P': 200},
}
WIN = 10 ** 6


class _Timeout(Exception):
    pass


def eval_board(b, g, side):
    V = VAL[g]
    v = 0
    for i in range(90):
        p = b[i]
        if p is None:
            continue
        t, s, _ = p
        r, c = divmod(i, 9)
        x = V[t]
        if t == 'P':
            adv = 6 - r if s == 0 else r - 3
            x += adv * (6 if g == 'xq' else 8) + (4 - abs(c - 4)) * 3
            if g == 'xq' and (r <= 4 if s == 0 else r >= 5):
                x += 80
        elif t in 'HRC':
            x += (4 - abs(c - 4)) * 4
        v += x if s == side else -x
    return v


def _ordered(b, g, side, caps_only=False):
    V = VAL[g]
    ms = []
    for f, t in all_pseudo(b, g, side):
        q = b[t]
        o = V[q[0]] * 10 - V[b[f][0]] // 10 if q is not None else 0
        if o or not caps_only:
            ms.append((o, f, t))
    ms.sort(reverse=True)
    return ms


def _quiesce(b, g, side, alpha, beta, qd):
    stand = eval_board(b, g, side)
    if qd == 0 or stand >= beta:
        return stand
    if stand > alpha:
        alpha = stand
    for _, f, t in _ordered(b, g, side, True):
        cap = b[t]
        if cap[0] == 'K':
            return WIN
        b[t] = b[f]; b[f] = None
        v = -_quiesce(b, g, 1 - side, -beta, -alpha, qd - 1)
        b[f] = b[t]; b[t] = cap
        if v >= beta:
            return v
        if v > alpha:
            alpha = v
    return alpha


def _nega(b, g, side, depth, alpha, beta, ply, ctx):
    ctx['nodes'] += 1
    if ctx['nodes'] & 255 == 0 and time.time() > ctx['deadline']:
        raise _Timeout()
    if depth <= 0:
        v = _quiesce(b, g, side, alpha, beta, 2)
        if v >= WIN:   # 왕을 잡는 결과는 가까울수록 값이 크게
            return WIN - ply * 100
        if v <= -WIN:
            return -WIN + ply * 100
        return v
    ms = _ordered(b, g, side)
    if not ms:
        return -WIN + ply * 100 if g == 'xq' else eval_board(b, g, side)
    best = -float('inf')
    for _, f, t in ms:
        cap = b[t]
        if cap is not None and cap[0] == 'K':
            return WIN - ply * 100  # 빠른 승리를 뚜렷하게 선호 (무작위 흔들림보다 크게)
        b[t] = b[f]; b[f] = None
        try:
            v = -_nega(b, g, 1 - side, depth - 1, -beta, -alpha, ply + 1, ctx)
        finally:
            b[f] = b[t]; b[t] = cap
        if v > best:
            best = v
        if v > alpha:
            alpha = v
        if alpha >= beta:
            break
    return best


def best_move(st, level=2, budget=None):
    """가장 좋아 보이는 수 (from, to). 둘 수가 없으면 None(장기에서는 한수쉼을 뜻함).
    level 1 쉬움 · 2 보통 · 3 어려움. budget 은 생각 시간(초)."""
    b, g, side = list(st.board), st.game, st.turn
    roots = legal_moves(b, g, side)
    if not roots:
        return None
    max_depth = {1: 1, 2: 2, 3: 4}.get(level, 2)
    budget = budget or {1: 0.3, 2: 1.2, 3: 3.0}.get(level, 1.2)
    ctx = {'nodes': 0, 'deadline': time.time() + budget}
    noise = 120 if level == 1 else 12
    best_all = roots[0]
    scored = [(0, m) for m in roots]
    try:
        for d in range(1, max_depth + 1):
            alpha, best, cur = -float('inf'), None, []
            for _, (f, t) in scored:
                cap = b[t]
                b[t] = b[f]; b[f] = None
                try:
                    v = -_nega(b, g, 1 - side, d - 1, -float('inf'), -alpha + 90, 1, ctx)
                    rep = st.seen.get(key_of(b, 1 - side), 0)
                    # 빅장을 풀지 않으면 무승부 → 지고 있을 때만 받아들인다
                    draw = g == 'jg' and st.bikjang_by is not None and kings_facing(b)
                finally:
                    b[f] = b[t]; b[t] = cap
                if draw:
                    v = -5000 if eval_board(b, g, side) > -300 else 5000
                v += (random.random() - 0.5) * noise - rep * 60
                cur.append((v, (f, t)))
                if v > alpha:
                    alpha, best = v, (f, t)
            best_all = best or best_all
            cur.sort(key=lambda x: -x[0])
            scored = cur
    except _Timeout:
        pass
    return best_all


# =============================================================================
# 3. 온라인: 웹소켓 클라이언트 (표준 라이브러리만 사용)
# =============================================================================
SERVER = os.environ.get('JGXQ_SERVER', 'wss://janggi-relay.gnmc-swteacher.workers.dev')
PID = base64.b16encode(os.urandom(12)).decode().lower()  # 재접속 때 "같은 사람"임을 알리는 임의의 값
ROOM_ABC = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'


class WebSocket:
    """최소한의 웹소켓 클라이언트 (RFC 6455). 글자 메시지 송수신과 ping 응답만 한다."""

    def __init__(self, url, timeout=10):
        secure = url.startswith('wss://')
        rest = url.split('://', 1)[1]
        hostport, _, path = rest.partition('/')
        host, _, port = hostport.partition(':')
        port = int(port) if port else (443 if secure else 80)
        sock = socket.create_connection((host, port), timeout)
        if secure:
            sock = ssl.create_default_context().wrap_socket(sock, server_hostname=host)
        key = base64.b64encode(os.urandom(16)).decode()
        req = ('GET /%s HTTP/1.1\r\nHost: %s\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n'
               'Sec-WebSocket-Key: %s\r\nSec-WebSocket-Version: 13\r\n\r\n') % (path, hostport, key)
        sock.sendall(req.encode())
        buf = b''
        while b'\r\n\r\n' not in buf:
            chunk = sock.recv(4096)
            if not chunk:
                raise ConnectionError('서버가 연결을 닫았습니다')
            buf += chunk
        head, _, self.buf = buf.partition(b'\r\n\r\n')
        if b' 101 ' not in head.split(b'\r\n', 1)[0]:
            raise ConnectionError('웹소켓 연결이 거절되었습니다: ' + head.split(b'\r\n', 1)[0].decode('latin1'))
        sock.settimeout(None)
        self.sock = sock
        self.lock = threading.Lock()
        self.open = True

    def _frame(self, opcode, payload):
        n = len(payload)
        head = bytes([0x80 | opcode])
        if n < 126:
            head += bytes([0x80 | n])
        elif n < 65536:
            head += bytes([0x80 | 126]) + struct.pack('>H', n)
        else:
            head += bytes([0x80 | 127]) + struct.pack('>Q', n)
        mask = os.urandom(4)  # 클라이언트가 보내는 내용은 반드시 마스크를 씌운다
        body = bytes(c ^ mask[i % 4] for i, c in enumerate(payload))
        with self.lock:
            self.sock.sendall(head + mask + body)

    def send(self, text):
        self._frame(1, text.encode('utf-8'))

    def _read(self, n):
        while len(self.buf) < n:
            chunk = self.sock.recv(4096)
            if not chunk:
                raise ConnectionError('연결이 끊어졌습니다')
            self.buf += chunk
        out, self.buf = self.buf[:n], self.buf[n:]
        return out

    def recv(self):
        """다음 글자 메시지를 돌려준다. 연결이 닫히면 None."""
        parts = []
        while True:
            b1, b2 = self._read(2)
            opcode, n = b1 & 0x0F, b2 & 0x7F
            if n == 126:
                n = struct.unpack('>H', self._read(2))[0]
            elif n == 127:
                n = struct.unpack('>Q', self._read(8))[0]
            mask = self._read(4) if b2 & 0x80 else None
            data = self._read(n)
            if mask:
                data = bytes(c ^ mask[i % 4] for i, c in enumerate(data))
            if opcode == 8:      # 닫기
                self.open = False
                return None
            if opcode == 9:      # ping → pong
                self._frame(10, data)
                continue
            if opcode == 10:     # pong
                continue
            parts.append(data)
            if b1 & 0x80:        # 마지막 조각
                return b''.join(parts).decode('utf-8', 'replace')

    def close(self):
        self.open = False
        for end in (lambda: self.sock.shutdown(socket.SHUT_RDWR), self.sock.close):  # shutdown 으로 읽는 쪽 스레드도 깨운다
            try:
                end()
            except OSError:
                pass


# =============================================================================
# 4. 화면 (tkinter)
# =============================================================================
GLYPH = {
    'xq': [{'K': '帥', 'A': '仕', 'E': '相', 'H': '馬', 'R': '車', 'C': '炮', 'P': '兵'},
           {'K': '將', 'A': '士', 'E': '象', 'H': '馬', 'R': '車', 'C': '砲', 'P': '卒'}],
    'jg': [{'K': '楚', 'A': '士', 'E': '象', 'H': '馬', 'R': '車', 'C': '包', 'P': '卒'},
           {'K': '漢', 'A': '士', 'E': '象', 'H': '馬', 'R': '車', 'C': '包', 'P': '兵'}],
}
HANGUL = {
    'xq': [{'K': '수', 'A': '사', 'E': '상', 'H': '마', 'R': '차', 'C': '포', 'P': '병'},
           {'K': '장', 'A': '사', 'E': '상', 'H': '마', 'R': '차', 'C': '포', 'P': '졸'}],
    'jg': [{'K': '초', 'A': '사', 'E': '상', 'H': '마', 'R': '차', 'C': '포', 'P': '졸'},
           {'K': '한', 'A': '사', 'E': '상', 'H': '마', 'R': '차', 'C': '포', 'P': '병'}],
}
INK = {'xq': ['#c1121f', '#1c1a18'], 'jg': ['#0a6b45', '#c1121f']}
PLAYER = {'jg': [('초', '楚'), ('한', '漢')], 'xq': [('홍', '紅'), ('흑', '黑')]}
GNAME = {'jg': '한국 장기', 'xq': '중국 상치'}
PNAME = {'K': '왕', 'A': '사', 'E': '상', 'H': '마', 'R': '차', 'C': '포', 'P': '졸 · 병'}
BOARD_BG = {'jg': '#e6bd62', 'xq': '#7a2a1c'}
BOARD_INK = {'jg': '#4a2c0c', 'xq': '#f3dca6'}
INFO = {
    'K': {'jg': '궁성 안에서 선을 따라 모든 방향(대각선 포함)으로 한 칸. 궁성 한가운데에서 시작.',
          'xq': '궁성 안에서 가로·세로로만 한 칸. 두 왕이 같은 줄에서 마주 볼 수 없음.'},
    'A': {'jg': '왕과 똑같이 궁성 안에서 선을 따라 한 칸.', 'xq': '궁성 안에서 대각선으로만 한 칸.'},
    'E': {'jg': '직선 1칸 + 대각선 2칸. 가는 길이 막히면 못 감. 판 전체를 다님.',
          'xq': '대각선으로 정확히 2칸. 가운데가 막히면 못 가고, 강을 건널 수 없음.'},
    'H': {'jg': '직선 1칸 + 대각선 1칸. 바로 앞이 막히면(멱) 못 감.', 'xq': '장기와 같음. 다리가 막히면 못 감.'},
    'R': {'jg': '가로·세로로 원하는 만큼. 궁성 안에서는 대각선 길도 달림.', 'xq': '가로·세로로 원하는 만큼. 궁성 대각선은 못 씀.'},
    'C': {'jg': '움직일 때도 잡을 때도 반드시 기물 하나를 넘어야 함. 포는 포를 넘지도 잡지도 못함.',
          'xq': '움직일 때는 차처럼 자유롭게, 잡을 때만 기물 하나를 넘음.'},
    'P': {'jg': '처음부터 앞·옆으로 한 칸. 상대 궁성 안에서는 대각선 앞으로도 감.',
          'xq': '강을 건너기 전에는 앞으로만 한 칸. 강을 건너면 옆으로도 감.'},
}
DIFFS = [
    ('판 모양', '강이 없고 선이 끝까지 이어짐', '가운데에 강(楚河漢界)이 있음'),
    ('왕의 자리', '궁성 한가운데에서 시작', '궁성 맨 아랫줄 가운데에서 시작'),
    ('왕과 사', '궁성 안의 선을 따라 대각선까지 한 칸', '왕은 가로·세로만, 사는 대각선만'),
    ('상', '직선 1 + 대각선 2칸, 판 전체', '대각선 2칸, 자기 진영에서만'),
    ('포', '넘어야만 이동·공격, 포끼리는 불가', '이동은 차처럼, 공격할 때만 넘음'),
    ('졸 · 병', '처음부터 앞과 옆으로', '강을 건너야 옆으로'),
    ('궁성 대각선', '차·포·졸도 이용', '사만 대각선으로 움직임'),
    ('왕끼리 마주 보기', '빅장 — 풀지 않으면 무승부', '비장 규칙으로 금지'),
    ('쉬기', '한수쉼 가능', '쉴 수 없음. 둘 수가 없으면 패배'),
    ('상차림', '마와 상의 자리를 4가지 중 선택', '처음 배치가 항상 같음'),
    ('먼저 두는 쪽', '초(楚, 푸른색)', '홍(紅, 붉은색)'),
    ('기물 모양', '팔각형, 종류마다 크기가 다름', '둥근 모양, 모두 같은 크기'),
    ('점수', '차13·포7·마5·상3·사3·졸2, 한에게 덤 1.5', '점수제 없음'),
]
REASON = {
    'checkmate': '외통! 왕이 더 이상 피할 곳이 없습니다.',
    'stalemate': '둘 수 있는 수가 없습니다. 상치에서는 쉴 수 없어 패배가 됩니다.',
    'bikjang': '빅장을 풀지 않아 무승부가 되었습니다.',
    'score': '두 사람 모두 쉬어서 점수로 승부를 가렸습니다.',
    'repetition': '같은 모양이 세 번 반복되어 무승부가 되었습니다.',
    'perpetual': '같은 모양이 세 번 반복되었고, 한쪽만 계속 장군을 불렀습니다. 그쪽이 집니다.',
    'movelimit': '%d수를 넘겨 점수로 승부를 가렸습니다.' % JG_MOVE_LIMIT,
    'nocapture': '%d수 동안 잡은 기물이 없어 무승부가 되었습니다.' % XQ_QUIET_LIMIT,
    'resign': '기권으로 대국이 끝났습니다.',
    'left': '상대가 나가서 대국이 끝났습니다.',
    'time': '제한 시간이 다 되었습니다.',
    'agreed': '서로 합의해서 무승부로 끝났습니다.',
}
CELL, PAD = 58, 40
BW, BH = 8 * CELL + 2 * PAD, 9 * CELL + 2 * PAD
FONT = 'Malgun Gothic'  # 윈도우 기본 한글 글꼴. 없으면 시스템 기본 글꼴로 표시된다.
IMG_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'img')
BG, PANEL, GOLD, TEXT, MUTE = '#131729', '#1d2240', '#e8c26a', '#f2ecdf', '#a9a59b'  # 화면 색
AVATAR = {'jg': ['cho', 'han'], 'xq': ['red', 'black']}
BTN_ICON = {'게임 선택 · 새 판': 'new', '무르기': 'undo', '힌트': 'hint', '한수쉼': 'pass', '판 뒤집기': 'flip', '기권': 'resign', '규칙 차이': 'book'}
DIFF_IMG = ['board', 'kingpos', 'guard', 'elephant', 'cannon', 'soldier', 'palace', 'facing', 'pass', 'formation', 'first', 'shape', 'score']


def sq_name(i):
    return 'abcdefghi'[i % 9] + str(10 - i // 9)


def run_app(hook=None):
    """창을 띄운다. hook(app, root) 을 주면 시작 직후 한 번 불러 준다(자동 시험용)."""
    import math
    import queue
    import threading
    import tkinter as tk
    from tkinter import messagebox

    class App:
        def __init__(self, root):
            self.root = root
            root.title('장기 × 象棋')
            root.configure(bg='#131729')
            root.resizable(False, False)
            self.cfg = {'game': 'jg', 'mode': 'ai', 'level': 2, 'side': 0, 'forms': ['EHEH', 'EHEH']}
            self.label = 'hanja'
            self.flipped = False
            self.sel, self.targets, self.hint = None, [], None
            self.thinking = False
            self.gen = 0
            self.q = queue.Queue()
            self.net = None       # 온라인 방 상태 (없으면 None)
            self.net_gen = 0

            # 그림 읽기 (PNG). 없거나 읽지 못하면 그 그림 없이 도형으로 그린다.
            self.img = {}
            if os.path.isdir(IMG_DIR):
                for f in os.listdir(IMG_DIR):
                    if f.endswith('.png'):
                        try:
                            self.img[f[:-4]] = tk.PhotoImage(file=os.path.join(IMG_DIR, f))
                        except tk.TclError:
                            pass
            if 'icon' in self.img:
                root.iconphoto(True, self.img['icon'])

            self.cv = tk.Canvas(root, width=BW, height=BH, highlightthickness=0, bg='#3a220c')
            self.cv.grid(row=0, column=0, padx=12, pady=12)
            self.cv.bind('<Button-1>', self.on_click)

            side = tk.Frame(root, bg='#131729')
            side.grid(row=0, column=1, sticky='ns', padx=(0, 12), pady=12)
            self.title = tk.Label(side, bg='#131729', fg='#e8c26a', font=(FONT, 10, 'bold'))
            self.title.pack(anchor='w')
            self.turn_lbl = tk.Label(side, bg='#131729', fg='#f2ecdf', font=(FONT, 17, 'bold'))
            self.turn_lbl.pack(anchor='w')
            self.sub = tk.Label(side, bg='#131729', fg='#a9a59b', font=(FONT, 10), wraplength=300, justify='left')
            self.sub.pack(anchor='w', pady=(0, 6))
            self.prow = []  # 대국자 두 줄: 메달 그림 + 이름·점수·잡은 기물
            for _ in (0, 1):
                f = tk.Frame(side, bg=PANEL, padx=6, pady=4)
                f.pack(fill='x', pady=2)
                av = tk.Label(f, bg=PANEL)
                av.pack(side='left')
                tx = tk.Label(f, bg=PANEL, fg=TEXT, font=(FONT, 10), wraplength=250, justify='left', anchor='w')
                tx.pack(side='left', padx=8, fill='x', expand=True)
                self.prow.append((f, av, tx))
            tk.Frame(side, bg=BG, height=6).pack()

            btns = tk.Frame(side, bg='#131729')
            btns.pack(fill='x')
            specs = [('게임 선택 · 새 판', self.new_dialog), ('무르기', self.undo), ('힌트', self.ask_hint), ('한수쉼', self.do_pass),
                     ('판 뒤집기', self.flip), ('기권', self.resign), ('한자/한글', self.toggle_label), ('규칙 차이', self.show_diffs)]
            self.btn = {}
            for k, (text, cmd) in enumerate(specs):
                w = self.button(btns, text, cmd, BTN_ICON.get(text))
                w.grid(row=k // 2, column=k % 2, padx=2, pady=2, sticky='ew')
                self.btn[text] = w
            btns.columnconfigure(0, weight=1, uniform='b')
            btns.columnconfigure(1, weight=1, uniform='b')

            self.tip = tk.Label(side, bg='#1d2240', fg='#f2ecdf', font=(FONT, 10), wraplength=290, justify='left',
                                padx=8, pady=8, anchor='nw', height=7)
            self.tip.pack(fill='x', pady=8)
            tk.Label(side, text='기보', bg='#131729', fg='#a9a59b', font=(FONT, 9)).pack(anchor='w')
            box = tk.Frame(side, bg='#131729')
            box.pack(fill='both', expand=True)
            sb = tk.Scrollbar(box)
            sb.pack(side='right', fill='y')
            self.hist = tk.Listbox(box, height=7, width=34, font=(FONT, 10), yscrollcommand=sb.set, activestyle='none',
                                   bg=PANEL, fg=TEXT, selectbackground='#3a3f66', highlightthickness=0, borderwidth=0)
            self.hist.pack(side='left', fill='both', expand=True)
            sb.config(command=self.hist.yview)

            self.start()
            root.after(60, self.poll)
            root.after(25000, self.keepalive)
            root.after(250, self.new_dialog)  # 켜자마자 어떤 게임을 둘지 고르게 한다

        def center(self, win):
            """작은 창을 본 창 한가운데에 놓는다."""
            win.update_idletasks()
            r = self.root
            x = r.winfo_rootx() + (r.winfo_width() - win.winfo_width()) // 2
            y = r.winfo_rooty() + (r.winfo_height() - win.winfo_height()) // 2
            win.geometry('+%d+%d' % (max(0, x), max(0, y)))

        def button(self, parent, text, cmd, icon=None, gold=False):
            """어두운 바탕의 버튼. icon 이름의 그림이 있으면 글자 왼쪽에 붙인다."""
            opt = dict(text=text, command=cmd, font=(FONT, 10, 'bold' if gold else 'normal'), relief='flat', cursor='hand2', padx=8, pady=5,
                       bg=GOLD if gold else '#2a3058', fg='#24180a' if gold else TEXT, activebackground='#f3d68e' if gold else '#3a4170',
                       activeforeground='#24180a' if gold else TEXT, disabledforeground='#6f7390', borderwidth=0, highlightthickness=0)
            im = self.img.get('ic-' + icon) if icon and not gold else None  # 금색 버튼에는 금색 그림이 묻히므로 붙이지 않는다
            if im is not None:
                opt.update(image=im, compound='left')
                opt['text'] = ' ' + text
            return tk.Button(parent, **opt)

        # ---------------- 대국 진행 ----------------
        def start(self):
            c = self.cfg
            if c['mode'] != 'online':
                self.net_leave()
            self.gen += 1
            self.st = Game(c['game'], list(c['forms']))
            self.sel, self.targets, self.hint, self.thinking = None, [], None, False
            self.flipped = c['mode'] != 'local' and c['side'] == 1
            self.tip.config(text='기물을 눌러 보세요.\n갈 수 있는 자리가 표시되고, 이 기물이 두 게임에서 어떻게 다른지 알려 줍니다.')
            self.refresh()
            if c['mode'] == 'ai' and c['side'] == 1:
                self.ai_turn()

        def my_turn(self):
            st, c = self.st, self.cfg
            if c['mode'] == 'online' and not (self.net and self.net['started'] and self.net['ws'] and self.net['ws'].open):
                return False
            return st.status == 'play' and not self.thinking and (c['mode'] == 'local' or st.turn == c['side'])

        def on_click(self, ev):
            c = round((ev.x - PAD) / CELL)
            r = round((ev.y - PAD) / CELL)
            if not (0 <= c <= 8 and 0 <= r <= 9) or not self.my_turn():
                return
            if self.flipped:
                r, c = 9 - r, 8 - c
            i = r * 9 + c
            st = self.st
            p = st.board[i]
            if self.sel is not None and i in self.targets:
                self.do_move((self.sel, i))
                return
            if p is not None and p[1] == st.turn:
                self.sel = i
                self.targets = [t for _, t in st.legal(i)]
                other = 'xq' if st.game == 'jg' else 'jg'
                self.tip.config(text='%s %s\n%s\n\n%s에서는 — %s' % (
                    GLYPH[st.game][p[1]][p[0]], PNAME[p[0]], INFO[p[0]][st.game], GNAME[other], INFO[p[0]][other]))
            else:
                self.sel, self.targets = None, []
            self.draw()

        def do_move(self, mv, remote=False):
            st = self.st
            rec = st.play(mv)
            if rec is None:
                return
            self.sel, self.targets, self.hint = None, [], None
            if self.cfg['mode'] == 'online' and not remote:
                self.net_send({'t': 'move', 'mv': {'pass': True} if mv is None else {'from': mv[0], 'to': mv[1], 'pass': False}, 'clk': None})
            if rec['check'] or (st.game == 'jg' and st.bikjang_by == rec['side'] and st.status == 'play'):
                self.root.bell()
            self.refresh()
            if st.status == 'over':
                self.root.after(300, self.show_over)
            elif self.cfg['mode'] == 'ai' and st.turn != self.cfg['side']:
                self.ai_turn()

        def ai_turn(self):
            self.thinking = True
            self.refresh()
            self._think(self.cfg['level'], 'move')

        def _think(self, level, kind):
            gen, snap = self.gen, self.st.copy()  # 화면이 멈추지 않도록 복사본으로 다른 스레드에서 계산
            threading.Thread(target=lambda: self.q.put(('ai', gen, kind, len(snap.moves), best_move(snap, level))), daemon=True).start()

        def poll(self):
            try:
                while True:
                    item = self.q.get_nowait()
                    if item[0] == 'net':
                        if item[1] == self.net_gen:
                            self.on_net(item[2])
                        continue
                    _, gen, kind, n, mv = item
                    if gen != self.gen or n != len(self.st.moves) or self.st.status != 'play':
                        continue
                    if kind == 'move':
                        self.thinking = False
                        self.do_move(mv)  # mv 가 None 이면 장기에서는 한수쉼
                    else:
                        self.hint = mv
                        self.btn['힌트'].config(state='normal')
                        if mv is None:
                            self.sub.config(text='지금은 한수쉼이 좋아 보입니다.')
                        self.draw()
            except queue.Empty:
                pass
            self.root.after(60, self.poll)

        def undo(self):
            st, c = self.st, self.cfg
            if self.thinking or not st.moves or c['mode'] == 'online':
                return
            n = 2 if c['mode'] == 'ai' and st.moves[-1]['side'] != c['side'] and len(st.moves) >= 2 else 1
            st.undo(n)
            self.sel, self.targets, self.hint = None, [], None
            self.refresh()

        def ask_hint(self):
            if self.my_turn():
                self.btn['힌트'].config(state='disabled')
                self._think(2, 'hint')

        def do_pass(self):
            if self.my_turn() and self.st.can_pass():
                self.do_move(None)

        def flip(self):
            self.flipped = not self.flipped
            self.refresh()

        def toggle_label(self):
            self.label = 'hangul' if self.label == 'hanja' else 'hanja'
            self.refresh()

        def resign(self):
            st, c = self.st, self.cfg
            if st.status != 'play' or not messagebox.askyesno('기권', '정말 기권할까요?'):
                return
            loser = st.turn if c['mode'] == 'local' else c['side']
            self.gen += 1
            self.thinking = False
            if c['mode'] == 'online':
                self.net_send({'t': 'end', 'winner': 1 - loser, 'reason': 'resign'})
            st._end(1 - loser, 'resign')
            self.refresh()
            self.show_over()

        def show_over(self):
            st = self.st
            P = PLAYER[st.game]
            head = '무승부' if st.winner is None else '%s(%s) 승리!' % P[st.winner]
            extra = ''
            if st.game == 'jg' and st.reason in ('score', 'movelimit'):
                sc = score(st.board)
                extra = '\n초 %s점 : 한 %s점' % (sc[0], sc[1])
            c, net = self.cfg, self.net
            if st.winner is None:
                pic = 'draw'
            elif c['mode'] == 'local' or st.winner == c['side']:
                pic = 'win'
            else:
                pic = 'lose'
                head = '아쉽게 졌습니다 — ' + head
            win = tk.Toplevel(self.root, bg=PANEL, padx=26, pady=18)
            win.title('대국 종료')
            win.transient(self.root)
            win.resizable(False, False)
            if 'result-' + pic in self.img:
                tk.Label(win, image=self.img['result-' + pic], bg=PANEL).pack()
            tk.Label(win, text=head, bg=PANEL, fg=GOLD, font=(FONT, 16, 'bold')).pack(pady=(6, 4))
            tk.Label(win, text=REASON.get(st.reason, '') + extra, bg=PANEL, fg=TEXT, font=(FONT, 10), wraplength=320, justify='center').pack()
            row = tk.Frame(win, bg=PANEL)
            row.pack(pady=(14, 0))

            def again():
                win.destroy()
                if self.st is not st:
                    return
                if c['mode'] != 'online':
                    self.start()
                elif self.net is net and net and net['started'] and net['peer']:
                    if net['role'] == 'host':
                        self.net_begin(dict(net['start']), announce=True)
                    else:
                        self.net_send({'t': 'rematch'})
                        self.sub.config(text='방장에게 한 판 더를 요청했습니다.')

            self.button(row, '판 보기', win.destroy).pack(side='left', padx=4)
            self.button(row, '한 판 더', again, gold=True).pack(side='left', padx=4)
            self.center(win)

        # ---------------- 온라인 ----------------
        def net_send(self, d):
            ws = self.net and self.net['ws']
            if ws and ws.open:
                try:
                    ws.send(json.dumps(d))
                except OSError:  # 보내다 실패하면 끊긴 것으로 보고 다시 연결한다
                    ws.close()
                    self.q.put(('net', self.net_gen, {'t': '_closed'}))

        def keepalive(self):
            self.net_send({'t': '_ping'})
            self.root.after(25000, self.keepalive)

        def net_leave(self):
            net = self.net
            if not net:
                return
            if net['started'] and self.cfg['mode'] == 'online' and self.st.status == 'play':
                self.net_send({'t': 'end', 'winner': 1 - self.cfg['side'], 'reason': 'left'})
            self.net = None
            self.net_gen += 1
            if net['ws']:
                net['ws'].close()

        def net_open(self, code, role, want):
            """방에 접속한다. want = 방장이 고른 설정(게임·진영·상차림) 또는 손님의 상차림."""
            self.net_leave()
            self.net = {'code': code, 'role': role, 'ws': None, 'peer': False, 'started': False, 'tries': 0, 'want': want, 'start': None, 'joined': False}
            self.cfg = dict(self.cfg, mode='online')
            self.net_connect()
            self.refresh()

        def net_connect(self):
            self.net_gen += 1
            gen, net = self.net_gen, self.net
            url = '%s/room/%s?role=%s&pid=%s' % (SERVER, net['code'], net['role'], PID)

            def run():
                try:
                    ws = WebSocket(url)
                except Exception as e:  # 연결 실패(인터넷 없음, 인증서 문제 등)
                    self.q.put(('net', gen, {'t': '_fail', 'why': str(e)}))
                    return
                self.q.put(('net', gen, {'t': '_open', 'ws': ws}))
                while True:
                    try:
                        m = ws.recv()
                    except Exception:
                        m = None
                    if m is None:
                        self.q.put(('net', gen, {'t': '_closed'}))
                        return
                    try:
                        d = json.loads(m)
                    except ValueError:
                        continue
                    if isinstance(d, dict):
                        self.q.put(('net', gen, d))

            threading.Thread(target=run, daemon=True).start()

        def net_begin(self, start, announce=False):
            """시작 정보로 새 판을 연다. announce=True 이면(방장) 상대에게도 알린다."""
            net = self.net
            if start.get('game') not in ('jg', 'xq') or start.get('hostSide') not in (0, 1):
                return
            forms = start.get('formations') or []
            forms = [f if f in FORMATIONS else 'EHEH' for f in (list(forms) + ['EHEH', 'EHEH'])[:2]]
            start = {'t': 'start', 'game': start['game'], 'formations': forms, 'hostSide': start['hostSide'], 'clock': 0}
            net['start'], net['started'] = start, True
            if announce:
                self.net_send(start)
            side = start['hostSide'] if net['role'] == 'host' else 1 - start['hostSide']
            self.cfg = {'game': start['game'], 'mode': 'online', 'level': 2, 'side': side, 'forms': forms}
            self.start()

        @staticmethod
        def net_move(st, m):
            """받은 수가 규칙에 맞는지 확인한다. (맞는지, 수) 를 돌려준다."""
            if not isinstance(m, dict) or st.status != 'play':
                return False, None
            if m.get('pass'):
                return st.can_pass(), None
            f, to = m.get('from'), m.get('to')
            if not (isinstance(f, int) and 0 <= f < 90 and st.board[f] is not None):
                return False, None
            return (f, to) in st.legal(f), (f, to)

        def on_net(self, d):
            net, t = self.net, d.get('t')
            if not net:
                return
            st, me = self.st, self.cfg['side']
            if t == '_open':
                net['ws'] = d['ws']
            elif t in ('_fail', '_closed'):
                if net['ws']:
                    net['ws'].close()
                net['ws'] = None
                net['tries'] += 1
                if net['tries'] > (10 if net['joined'] else 2):
                    self.net = None
                    self.net_gen += 1
                    self.refresh()
                    messagebox.showwarning('온라인', '대전 서버에 연결할 수 없습니다.\n' + str(d.get('why', '')))
                    return
                self.root.after(min(1500 * net['tries'], 5000), lambda: self.net is net and self.net_connect())
                self.refresh()
            elif t == '_err':
                self.net = None
                self.net_gen += 1
                self.refresh()
                messagebox.showwarning('온라인', {'noroom': '그 코드의 방을 찾지 못했습니다.', 'taken': '방 코드가 겹쳤습니다. 다시 만들어 주세요.'}.get(d.get('why'), '연결 오류'))
            elif t == '_hello':
                if d.get('as') == 'watch':
                    self.net_leave()
                    self.refresh()
                    messagebox.showinfo('온라인', '방이 이미 가득 찼습니다. (관전은 웹판에서 할 수 있습니다)')
                    return
                net['joined'], net['tries'], net['peer'] = True, 0, bool(d.get('peer'))
                sync = d.get('sync')
                if sync and isinstance(sync.get('start'), dict):  # 서버가 기억하던 판을 그대로 다시 만든다
                    self.net_begin(sync['start'])
                    for m in sync.get('moves') or []:
                        ok, mv = self.net_move(self.st, m)
                        if not ok:
                            break
                        self.st.play(mv)
                    over = sync.get('over')
                    if over and self.st.status == 'play':
                        self.st._end(over.get('winner') if over.get('winner') in (0, 1) else None, str(over.get('reason')))
                elif net['role'] == 'host' and net['peer']:
                    self.net_send({'t': 'init', 'game': net['want']['game'], 'hostSide': net['want']['side']})
                self.refresh()
            elif t in ('_joined', '_back'):
                net['peer'] = True
                if net['role'] == 'host' and not net['started']:
                    self.net_send({'t': 'init', 'game': net['want']['game'], 'hostSide': net['want']['side']})
                self.refresh()
            elif t in ('_away', '_left'):
                net['peer'] = False
                self.refresh()
            elif t == 'init' and net['role'] == 'guest' and not net['started']:
                self.net_send({'t': 'ready', 'formation': net['want']['form'] if d.get('game') == 'jg' else None})
            elif t == 'ready' and net['role'] == 'host' and not net['started']:
                w = net['want']
                forms = [None, None]
                forms[w['side']] = w['form']
                forms[1 - w['side']] = d.get('formation') if d.get('formation') in FORMATIONS else 'EHEH'
                self.net_begin({'game': w['game'], 'formations': forms, 'hostSide': w['side']}, announce=True)
            elif t == 'start' and net['role'] == 'guest':
                self.net_begin(d)
            elif not net['started']:
                return
            elif t == 'move' and st.status == 'play' and st.turn != me:
                ok, mv = self.net_move(st, d.get('mv'))
                if ok:
                    self.do_move(mv, remote=True)
            elif t == 'end' and st.status == 'play' and d.get('reason') in ('resign', 'left', 'time') and d.get('winner') == me:
                self.gen += 1  # 상대가 스스로 진 경우만 인정한다
                st._end(me, d['reason'])
                self.refresh()
                self.show_over()
            elif t == 'rematch' and net['role'] == 'host' and st.status == 'over':
                self.net_begin(dict(net['start']), announce=True)
            elif t == 'undoReq':
                self.net_send({'t': 'undoNo'})   # 파이썬 판은 무르기 요청을 받지 않는다
            elif t == 'drawReq':
                self.net_send({'t': 'drawNo'})   # 무승부 제안도 받지 않는다
            elif t == 'chat':
                self.tip.config(text='상대의 말: ' + str(d.get('text', ''))[:120])

        # ---------------- 그리기 ----------------
        def xy(self, i):
            r, c = divmod(i, 9)
            if self.flipped:
                r, c = 9 - r, 8 - c
            return PAD + c * CELL, PAD + r * CELL

        def draw(self):
            cv, st = self.cv, self.st
            g = st.game
            ink = BOARD_INK[g]
            cv.delete('all')
            if 'board-' + g in self.img:
                cv.create_image(0, 0, image=self.img['board-' + g], anchor='nw')   # 나무결 판
            else:
                cv.create_rectangle(8, 8, BW - 8, BH - 8, fill=BOARD_BG[g], outline='')
            X = lambda c: PAD + c * CELL
            Y = lambda r: PAD + r * CELL
            cv.create_rectangle(X(0) - 7, Y(0) - 7, X(8) + 7, Y(9) + 7, outline=ink, width=3)
            for r in range(10):
                cv.create_line(X(0), Y(r), X(8), Y(r), fill=ink, width=1)
            for c in range(9):
                if g == 'xq' and 0 < c < 8:  # 상치: 강에서 세로선이 끊긴다
                    cv.create_line(X(c), Y(0), X(c), Y(4), fill=ink)
                    cv.create_line(X(c), Y(5), X(c), Y(9), fill=ink)
                else:
                    cv.create_line(X(c), Y(0), X(c), Y(9), fill=ink)
            for pr in (0, 7):
                cv.create_line(X(3), Y(pr), X(5), Y(pr + 2), fill=ink)
                cv.create_line(X(5), Y(pr), X(3), Y(pr + 2), fill=ink)
            if g == 'xq':
                cv.create_text(X(2), Y(4.5), text='楚  河', fill=ink, font=(FONT, 18, 'bold'))
                cv.create_text(X(6), Y(4.5), text='漢  界', fill=ink, font=(FONT, 18, 'bold'))

            last = st.moves[-1] if st.moves else None
            if last and not last['pass']:
                x, y = self.xy(last['from'])
                cv.create_oval(x - 7, y - 7, x + 7, y + 7, outline='#ffd76a', width=3)
            chk = find_king(st.board, st.turn) if st.check and st.status == 'play' else -1
            names = GLYPH if self.label == 'hanja' else HANGUL
            for i in range(90):
                p = st.board[i]
                if p is None:
                    continue
                t, s, _ = p
                x, y = self.xy(i)
                rad = 25 if g == 'xq' else (27 if t == 'K' else 20 if t in 'AP' else 24)
                edge = '#ff2b2b' if i == chk else '#ffd76a' if i == self.sel or (last and last['to'] == i) else '#6b4416'
                wid = 4 if edge != '#6b4416' else 2
                pic = self.img.get('piece-%s-%d' % (g, rad))
                if pic is not None:  # 나무결 기물 그림 + 강조 테두리
                    cv.create_image(x, y, image=pic)
                    if wid == 4:
                        cv.create_oval(x - rad - 3, y - rad - 3, x + rad + 3, y + rad + 3, outline=edge, width=3)
                    if g == 'xq':
                        cv.create_oval(x - rad + 5, y - rad + 5, x + rad - 5, y + rad - 5, outline=INK[g][s])
                    cv.create_text(x, y, text=names[g][s][t], fill=INK[g][s], font=(FONT, int(rad * 0.82), 'bold'))
                    continue
                cv.create_oval(x - rad + 2, y - rad + 4, x + rad + 2, y + rad + 4, fill='#3a2a12', outline='')  # 그림자
                if g == 'xq':
                    cv.create_oval(x - rad, y - rad, x + rad, y + rad, fill='#f6e3b8', outline=edge, width=wid)
                    cv.create_oval(x - rad + 5, y - rad + 5, x + rad - 5, y + rad - 5, outline=INK[g][s])
                else:
                    pts = []
                    for k in range(8):
                        a = math.radians(22.5 + 45 * k)
                        pts += [x + rad * math.cos(a), y + rad * math.sin(a)]
                    cv.create_polygon(pts, fill='#f6e3b8', outline=edge, width=wid)
                cv.create_text(x, y, text=names[g][s][t], fill=INK[g][s], font=(FONT, int(rad * 0.82), 'bold'))
            for t in self.targets:
                x, y = self.xy(t)
                if st.board[t] is not None:
                    cv.create_oval(x - 29, y - 29, x + 29, y + 29, outline='#ff4d4d', width=4, dash=(6, 4))
                else:
                    cv.create_oval(x - 8, y - 8, x + 8, y + 8, fill='#2f9bff', outline='')
            if self.hint:
                for i in self.hint:
                    x, y = self.xy(i)
                    cv.create_oval(x - 31, y - 31, x + 31, y + 31, outline='#5ad1ff', width=4)

        def refresh(self):
            st, c = self.st, self.cfg
            g = st.game
            P = PLAYER[g]
            self.draw()
            net = self.net
            mode = {'ai': 'AI 대국 (%s)' % ['', '쉬움', '보통', '어려움'][c['level']], 'local': '둘이서',
                    'online': '온라인' + (' · 방 %s' % net['code'] if net else ' (연결 끊김)')}[c['mode']]
            self.title.config(text='%s · %s' % (GNAME[g], mode))
            if st.status == 'over':
                self.turn_lbl.config(text='무승부' if st.winner is None else '%s 승리!' % P[st.winner][0])
                sub = '「게임 선택 · 새 판」을 눌러 다시 둘 수 있습니다.'
            else:
                self.turn_lbl.config(text='%s(%s) 차례' % P[st.turn])
                sub = '%d번째 수' % (len(st.moves) + 1)
                if st.check:
                    sub = '장군! 왕을 지켜야 합니다.'
                elif g == 'jg' and st.bikjang_by is not None:
                    sub = '빅장! 이번 수에 풀지 않으면 무승부입니다.'
                elif self.thinking:
                    sub = 'AI가 생각하는 중…'
                elif c['mode'] == 'online' and net and net['started']:
                    if not (net['ws'] and net['ws'].open):
                        sub = '서버에 다시 연결하는 중…'
                    elif not net['peer']:
                        sub = '상대가 자리를 비웠습니다. 돌아오기를 기다리는 중…'
                    elif st.turn != c['side']:
                        sub = '상대의 수를 기다리는 중…'
                    else:
                        sub = '내 차례입니다. (%d번째 수)' % (len(st.moves) + 1)
            if c['mode'] == 'online' and net and not net['started']:
                self.turn_lbl.config(text='방 코드  %s' % net['code'])
                if not net['joined']:
                    sub = '대전 서버에 연결하는 중…'
                elif net['role'] == 'host':
                    sub = '상대에게 이 방 코드를 알려 주세요. 들어오면 바로 시작합니다. (웹판에서도 들어올 수 있습니다)'
                else:
                    sub = '방장의 준비를 기다리는 중…'
            self.sub.config(text=sub)
            names = GLYPH if self.label == 'hanja' else HANGUL
            sc = score(st.board) if g == 'jg' else None
            for row, s in enumerate((1, 0) if not self.flipped else (0, 1)):  # 판에 보이는 위·아래 순서대로
                f, av, tx = self.prow[row]
                got = ' '.join(names[g][p[1]][p[0]] for p in st.captured[s]) or '없음'
                who = ''
                if c['mode'] == 'ai':
                    who = ' (나)' if s == c['side'] else ' (AI)'
                elif c['mode'] == 'online':
                    who = ' (나)' if s == c['side'] else ' (상대)'
                tx.config(text='%s(%s)%s%s\n잡은 기물: %s' % (P[s][0], P[s][1], who, ' · %s점' % sc[s] if sc else '', got),
                          fg=GOLD if st.status == 'play' and st.turn == s else TEXT)
                pic = self.img.get('av-' + ('ai' if c['mode'] == 'ai' and s != c['side'] else AVATAR[g][s]))
                av.config(image=pic if pic is not None else '')
            self.btn['한수쉼'].config(state='normal' if g == 'jg' and self.my_turn() and st.can_pass() else 'disabled')
            self.btn['힌트'].config(state='normal' if self.my_turn() else 'disabled')
            self.btn['무르기'].config(state='normal' if st.moves and not self.thinking and c['mode'] != 'online' else 'disabled')
            self.btn['기권'].config(state='normal' if st.status == 'play' and (c['mode'] != 'online' or (net and net['started'])) else 'disabled')
            self.hist.delete(0, 'end')
            for k, m in enumerate(st.moves):
                side = P[m['side']][0]
                if m['pass']:
                    txt = '한수쉼'
                else:
                    txt = '%s %s→%s' % (names[g][m['side']][m['piece'][0]], sq_name(m['from']), sq_name(m['to']))
                    if m['cap']:
                        txt += ' ×' + names[g][m['cap'][1]][m['cap'][0]]
                    if m['check']:
                        txt += ' 장군'
                self.hist.insert('end', '%3d. %s  %s' % (k + 1, side, txt))
            self.hist.see('end')

        # ---------------- 창: 새 판 · 규칙 차이 ----------------
        def new_dialog(self):
            c = self.cfg
            win = tk.Toplevel(self.root, bg=PANEL, padx=6, pady=6)
            win.title('게임 선택 · 새 판')
            win.transient(self.root)
            win.grab_set()
            win.resizable(False, False)
            v = {'game': tk.StringVar(value=c['game']), 'mode': tk.StringVar(value='ai' if c['mode'] == 'online' else c['mode']), 'level': tk.IntVar(value=c['level']),
                 'side': tk.IntVar(value=c['side']), 'f0': tk.StringVar(value=c['forms'][0]), 'f1': tk.StringVar(value=c['forms'][1])}

            def row(title, var, options):
                tk.Label(win, text=title, font=(FONT, 10, 'bold'), anchor='w', bg=PANEL, fg=GOLD).pack(fill='x', padx=14, pady=(10, 2))
                f = tk.Frame(win, bg=PANEL)
                f.pack(fill='x', padx=14)
                for val, text in options:
                    tk.Radiobutton(f, text=text, variable=var, value=val, font=(FONT, 10), bg=PANEL, fg=TEXT, selectcolor='#0b0d17',
                                   activebackground=PANEL, activeforeground=GOLD, highlightthickness=0).pack(side='left')

            row('게임', v['game'], [('jg', '한국 장기'), ('xq', '중국 상치')])
            row('방식', v['mode'], [('ai', 'AI와 대국'), ('local', '둘이서 (한 컴퓨터)'), ('host', '온라인 방 만들기'), ('join', '온라인 방 참가')])
            f = tk.Frame(win, bg=PANEL)
            f.pack(fill='x', padx=14, pady=(4, 0))
            tk.Label(f, text='참가할 방 코드 (6자리):', font=(FONT, 10), bg=PANEL, fg=TEXT).pack(side='left')
            code = tk.Entry(f, width=10, font=(FONT, 11, 'bold'), bg='#0b0d17', fg=GOLD, insertbackground=GOLD, relief='flat')
            code.pack(side='left', padx=6)
            row('AI 난이도', v['level'], [(1, '쉬움'), (2, '보통'), (3, '어려움')])
            row('내 진영 (AI 대국 · 방 만들기)', v['side'], [(0, '먼저 (초 · 홍)'), (1, '나중 (한 · 흑)')])
            forms = list(FORMATIONS.items())
            row('장기 상차림 — 나 (둘이서: 초)', v['f0'], forms)
            row('장기 상차림 — 상대 (AI · 둘이서: 한)', v['f1'], forms)
            tk.Label(win, text='상차림은 각자 자기 왼쪽부터 마·상을 놓는 순서입니다.\n온라인 방 참가에서는 게임과 진영을 방장이 정합니다.',
                     font=(FONT, 9), fg=MUTE, bg=PANEL, justify='left').pack(padx=14, pady=(6, 0), anchor='w')

            def go():
                mode, side, f0, f1 = v['mode'].get(), v['side'].get(), v['f0'].get(), v['f1'].get()
                if mode == 'join':
                    room = code.get().strip().upper()
                    if len(room) != 6 or any(ch not in 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789' for ch in room):
                        messagebox.showwarning('온라인', '방 코드 6자리를 입력해 주세요.', parent=win)
                        return
                    win.destroy()
                    self.net_open(room, 'guest', {'form': f0})
                    return
                if mode == 'host':
                    win.destroy()
                    room = ''.join(random.choice(ROOM_ABC) for _ in range(6))
                    self.net_open(room, 'host', {'game': v['game'].get(), 'side': side, 'form': f0})
                    return
                if mode == 'local':
                    side = 0
                forms2 = [None, None]
                forms2[side], forms2[1 - side] = f0, f1  # 내 상차림은 내 진영 쪽에
                self.cfg = {'game': v['game'].get(), 'mode': mode, 'level': v['level'].get(), 'side': side, 'forms': forms2}
                win.destroy()
                self.start()

            f = tk.Frame(win, bg=PANEL)
            f.pack(pady=14)
            self.button(f, '대국 시작', go, gold=True).pack(side='left', padx=4)
            self.button(f, '취소', win.destroy).pack(side='left', padx=4)
            self.center(win)

        def show_diffs(self):
            win = tk.Toplevel(self.root, bg=BG, padx=12, pady=10)
            win.title('한국 장기와 중국 상치의 규칙 차이')
            win.transient(self.root)
            for col, (head, fg) in enumerate((('', TEXT), ('', TEXT), ('한국 장기', '#2fbf8a'), ('중국 상치', '#ff7a7a'))):
                tk.Label(win, text=head, font=(FONT, 11, 'bold'), bg=BG, fg=fg, padx=8, pady=6).grid(row=0, column=col, sticky='w')
            for k, (h, j, x) in enumerate(DIFFS, start=1):
                bg = PANEL if k % 2 else '#171b33'
                pic = self.img.get('diff-' + DIFF_IMG[k - 1])
                tk.Label(win, image=pic if pic is not None else '', bg=bg, padx=4).grid(row=k, column=0, sticky='nsew')
                for col, text in enumerate((h, j, x), start=1):
                    tk.Label(win, text=text, font=(FONT, 10, 'bold' if col == 1 else 'normal'), bg=bg, fg=GOLD if col == 1 else TEXT, padx=8, pady=5,
                             anchor='w', justify='left', wraplength=250).grid(row=k, column=col, sticky='nsew')
            self.button(win, '닫기', win.destroy).grid(row=len(DIFFS) + 1, column=0, columnspan=4, pady=10)
            self.center(win)

    root = tk.Tk()
    app = App(root)
    if hook:
        hook(app, root)
    root.mainloop()


if __name__ == '__main__':
    run_app()
