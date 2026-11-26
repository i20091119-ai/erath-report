#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""장기 × 象棋 — 한국 장기와 중국 상치를 함께 두는 파이썬 프로그램

실행:  python janggi_xiangqi.py
필요한 것: 파이썬 3.8 이상 (tkinter 포함 — 윈도우용 파이썬에는 기본으로 들어 있음). 추가 설치 없음.

구성
  1) 규칙 엔진  : 두 게임의 기물 이동, 장군·외통, 빅장, 한수쉼, 반복·수 제한 판정
  2) AI         : 알파-베타 탐색 (쉬움 / 보통 / 어려움)
  3) 화면(tkinter): 판, 대국 설정, 기보, 기물별 규칙 비교 설명

좌표: 9열 × 10행, 칸 번호 = 행 × 9 + 열. side 0 = 아래쪽(먼저 두는 쪽), side 1 = 위쪽.
"""
import random
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
# 3. 화면 (tkinter)
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
}
CELL, PAD = 58, 40
BW, BH = 8 * CELL + 2 * PAD, 9 * CELL + 2 * PAD
FONT = 'Malgun Gothic'  # 윈도우 기본 한글 글꼴. 없으면 시스템 기본 글꼴로 표시된다.


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
            self.caps = tk.Label(side, bg='#131729', fg='#f2ecdf', font=(FONT, 10), wraplength=300, justify='left')
            self.caps.pack(anchor='w', pady=(0, 8))

            btns = tk.Frame(side, bg='#131729')
            btns.pack(fill='x')
            specs = [('게임 선택 · 새 판', self.new_dialog), ('무르기', self.undo), ('힌트', self.ask_hint), ('한수쉼', self.do_pass),
                     ('판 뒤집기', self.flip), ('기권', self.resign), ('한자/한글', self.toggle_label), ('규칙 차이', self.show_diffs)]
            self.btn = {}
            for k, (text, cmd) in enumerate(specs):
                w = tk.Button(btns, text=text, command=cmd, font=(FONT, 10), width=12, relief='groove')
                w.grid(row=k // 2, column=k % 2, padx=2, pady=2, sticky='ew')
                self.btn[text] = w

            self.tip = tk.Label(side, bg='#1d2240', fg='#f2ecdf', font=(FONT, 10), wraplength=290, justify='left',
                                padx=8, pady=8, anchor='nw', height=9)
            self.tip.pack(fill='x', pady=8)
            tk.Label(side, text='기보', bg='#131729', fg='#a9a59b', font=(FONT, 9)).pack(anchor='w')
            box = tk.Frame(side, bg='#131729')
            box.pack(fill='both', expand=True)
            sb = tk.Scrollbar(box)
            sb.pack(side='right', fill='y')
            self.hist = tk.Listbox(box, height=9, width=34, font=(FONT, 10), yscrollcommand=sb.set, activestyle='none')
            self.hist.pack(side='left', fill='both', expand=True)
            sb.config(command=self.hist.yview)

            self.start()
            root.after(60, self.poll)
            root.after(250, self.new_dialog)  # 켜자마자 어떤 게임을 둘지 고르게 한다

        # ---------------- 대국 진행 ----------------
        def start(self):
            c = self.cfg
            self.gen += 1
            self.st = Game(c['game'], list(c['forms']))
            self.sel, self.targets, self.hint, self.thinking = None, [], None, False
            self.flipped = c['mode'] == 'ai' and c['side'] == 1
            self.tip.config(text='기물을 눌러 보세요.\n갈 수 있는 자리가 표시되고, 이 기물이 두 게임에서 어떻게 다른지 알려 줍니다.')
            self.refresh()
            if c['mode'] == 'ai' and c['side'] == 1:
                self.ai_turn()

        def my_turn(self):
            st, c = self.st, self.cfg
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

        def do_move(self, mv):
            st = self.st
            rec = st.play(mv)
            if rec is None:
                return
            self.sel, self.targets, self.hint = None, [], None
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
            threading.Thread(target=lambda: self.q.put((gen, kind, len(snap.moves), best_move(snap, level))), daemon=True).start()

        def poll(self):
            try:
                while True:
                    gen, kind, n, mv = self.q.get_nowait()
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
            if self.thinking or not st.moves:
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
            self.draw()

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
            messagebox.showinfo('대국 종료', head + '\n\n' + REASON.get(st.reason, '') + extra)

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
            mode = 'AI 대국 (%s)' % ['', '쉬움', '보통', '어려움'][c['level']] if c['mode'] == 'ai' else '둘이서'
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
            self.sub.config(text=sub)
            names = GLYPH if self.label == 'hanja' else HANGUL
            lines = []
            sc = score(st.board) if g == 'jg' else None
            for s in (0, 1):
                got = ' '.join(names[g][p[1]][p[0]] for p in st.captured[s]) or '없음'
                pts = ' · %s점' % sc[s] if sc else ''
                lines.append('%s%s — 잡은 기물: %s' % (P[s][0], pts, got))
            self.caps.config(text='\n'.join(lines))
            self.btn['한수쉼'].config(state='normal' if g == 'jg' and self.my_turn() and st.can_pass() else 'disabled')
            self.btn['힌트'].config(state='normal' if self.my_turn() else 'disabled')
            self.btn['무르기'].config(state='normal' if st.moves and not self.thinking else 'disabled')
            self.btn['기권'].config(state='normal' if st.status == 'play' else 'disabled')
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
            win = tk.Toplevel(self.root)
            win.title('게임 선택 · 새 판')
            win.transient(self.root)
            win.grab_set()
            win.resizable(False, False)
            v = {'game': tk.StringVar(value=c['game']), 'mode': tk.StringVar(value=c['mode']), 'level': tk.IntVar(value=c['level']),
                 'side': tk.IntVar(value=c['side']), 'f0': tk.StringVar(value=c['forms'][0]), 'f1': tk.StringVar(value=c['forms'][1])}

            def row(title, var, options):
                tk.Label(win, text=title, font=(FONT, 10, 'bold'), anchor='w').pack(fill='x', padx=14, pady=(10, 2))
                f = tk.Frame(win)
                f.pack(fill='x', padx=14)
                for val, text in options:
                    tk.Radiobutton(f, text=text, variable=var, value=val, font=(FONT, 10)).pack(side='left')

            row('게임', v['game'], [('jg', '한국 장기'), ('xq', '중국 상치')])
            row('방식', v['mode'], [('ai', 'AI와 대국'), ('local', '둘이서 (한 컴퓨터)')])
            row('AI 난이도', v['level'], [(1, '쉬움'), (2, '보통'), (3, '어려움')])
            row('내 진영 (AI 대국)', v['side'], [(0, '먼저 (초 · 홍)'), (1, '나중 (한 · 흑)')])
            forms = list(FORMATIONS.items())
            row('장기 상차림 — 아래쪽(초)', v['f0'], forms)
            row('장기 상차림 — 위쪽(한)', v['f1'], forms)
            tk.Label(win, text='상차림은 각자 자기 왼쪽부터 마·상을 놓는 순서입니다.', font=(FONT, 9), fg='#666').pack(padx=14, anchor='w')

            def go():
                self.cfg = {'game': v['game'].get(), 'mode': v['mode'].get(), 'level': v['level'].get(), 'side': v['side'].get(),
                            'forms': [v['f0'].get(), v['f1'].get()]}
                win.destroy()
                self.start()

            f = tk.Frame(win)
            f.pack(pady=14)
            tk.Button(f, text='대국 시작', command=go, font=(FONT, 10, 'bold'), width=12).pack(side='left', padx=4)
            tk.Button(f, text='취소', command=win.destroy, font=(FONT, 10), width=8).pack(side='left', padx=4)

        def show_diffs(self):
            win = tk.Toplevel(self.root)
            win.title('한국 장기와 중국 상치의 규칙 차이')
            win.transient(self.root)
            for col, head in enumerate(('', '한국 장기', '중국 상치')):
                tk.Label(win, text=head, font=(FONT, 10, 'bold'), padx=8, pady=6).grid(row=0, column=col, sticky='w')
            for k, (h, j, x) in enumerate(DIFFS, start=1):
                bg = '#f4efe2' if k % 2 else '#ffffff'
                for col, text in enumerate((h, j, x)):
                    tk.Label(win, text=text, font=(FONT, 10, 'bold' if col == 0 else 'normal'), bg=bg, padx=8, pady=4,
                             anchor='w', justify='left', wraplength=260).grid(row=k, column=col, sticky='nsew')
            tk.Button(win, text='닫기', command=win.destroy, font=(FONT, 10), width=8).grid(row=len(DIFFS) + 1, column=0, columnspan=3, pady=10)

    root = tk.Tk()
    app = App(root)
    if hook:
        hook(app, root)
    root.mainloop()


if __name__ == '__main__':
    run_app()
