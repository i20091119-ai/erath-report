# -*- coding: utf-8 -*-
"""규칙 엔진 시험.  실행:  python -m unittest test_engine.py   (janggi/python 폴더에서)"""
import os
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import janggi_xiangqi as E  # noqa: E402


def at(r, c):
    return r * 9 + c


def pos(game, pieces, turn=0):
    return E.Game(game, pieces=pieces, turn=turn)


def tos(st, frm):
    return sorted(t for _, t in st.legal(frm))


K = [(at(9, 4), 'K', 0), (at(0, 3), 'K', 1)]  # 서로 마주 보지 않는 두 왕


class Rules(unittest.TestCase):
    def test_first_position_counts(self):
        self.assertEqual(len(E.Game('xq').legal()), 44)   # 상치 첫 국면의 알려진 값
        self.assertEqual(len(E.Game('jg').legal()), 31)   # 웹판(JavaScript) 엔진과 같은 값

    def test_formation_from_own_left(self):
        st = E.Game('jg', ['HEEH', 'EHHE'])
        self.assertEqual(''.join(st.board[at(9, c)][0] for c in (1, 2, 6, 7)), 'HEEH')
        self.assertEqual(''.join(st.board[at(0, c)][0] for c in (7, 6, 2, 1)), 'EHHE')
        self.assertEqual(st.board[at(8, 4)][0], 'K')

    def test_cannon(self):
        ps = K + [(at(7, 1), 'C', 0), (at(4, 1), 'P', 0), (at(2, 1), 'H', 1)]
        xq = tos(pos('xq', ps), at(7, 1))
        self.assertTrue({at(7, 0), at(5, 1), at(2, 1)} <= set(xq) and at(3, 1) not in xq)
        self.assertEqual(tos(pos('jg', ps), at(7, 1)), [at(2, 1), at(3, 1)])

    def test_janggi_cannon_vs_cannon(self):
        over = pos('jg', K + [(at(7, 1), 'C', 0), (at(5, 1), 'C', 1), (at(2, 1), 'H', 1)])
        self.assertEqual(tos(over, at(7, 1)), [])
        take = pos('jg', K + [(at(7, 1), 'C', 0), (at(5, 1), 'P', 0), (at(2, 1), 'C', 1)])
        self.assertNotIn(at(2, 1), tos(take, at(7, 1)))
        xq = pos('xq', K + [(at(7, 1), 'C', 0), (at(5, 1), 'C', 1), (at(2, 1), 'C', 1)])
        self.assertIn(at(2, 1), tos(xq, at(7, 1)))

    def test_elephant(self):
        self.assertEqual(tos(pos('xq', K + [(at(5, 2), 'E', 0)]), at(5, 2)), [at(7, 0), at(7, 4)])
        jg = tos(pos('jg', K + [(at(6, 4), 'E', 0), (at(5, 4), 'P', 0)]), at(6, 4))
        self.assertFalse(any(t // 9 == 3 for t in jg))
        self.assertIn(at(4, 1), jg)

    def test_horse_leg(self):
        for g in ('jg', 'xq'):
            t = tos(pos(g, K + [(at(5, 4), 'H', 0), (at(4, 4), 'P', 0)]), at(5, 4))
            self.assertTrue(at(3, 3) not in t and at(3, 5) not in t and at(7, 3) in t)

    def test_soldier(self):
        self.assertEqual(tos(pos('xq', K + [(at(5, 0), 'P', 0)]), at(5, 0)), [at(4, 0)])
        self.assertEqual(tos(pos('xq', K + [(at(4, 0), 'P', 0)]), at(4, 0)), [at(3, 0), at(4, 1)])
        self.assertEqual(tos(pos('jg', K + [(at(6, 0), 'P', 0)]), at(6, 0)), [at(5, 0), at(6, 1)])

    def test_palace_diagonals(self):
        king = [(at(9, 4), 'K', 0), (at(0, 4), 'K', 1), (at(5, 4), 'P', 0)]
        rook = tos(pos('jg', king + [(at(2, 3), 'R', 0)]), at(2, 3))
        self.assertTrue(at(1, 4) in rook and at(0, 5) in rook)
        self.assertNotIn(at(1, 4), tos(pos('xq', king + [(at(2, 3), 'R', 0)]), at(2, 3)))
        self.assertIn(at(1, 4), tos(pos('jg', king + [(at(2, 3), 'P', 0)]), at(2, 3)))

    def test_facing_kings(self):
        ps = [(at(9, 4), 'K', 0), (at(0, 4), 'K', 1), (at(5, 4), 'R', 0), (at(3, 0), 'P', 1)]
        self.assertNotIn(at(5, 0), tos(pos('xq', ps), at(5, 4)))
        jg = pos('jg', ps)
        jg.play((at(5, 4), at(5, 0)))
        self.assertEqual((jg.bikjang_by, jg.status), (0, 'play'))
        jg.play((at(3, 0), at(3, 1)))
        self.assertEqual((jg.status, jg.winner, jg.reason), ('over', None, 'bikjang'))

    def test_mate_and_stalemate(self):
        mate = pos('xq', [(at(9, 4), 'K', 0), (at(0, 3), 'K', 1), (at(5, 0), 'R', 0), (at(1, 8), 'R', 0)])
        mate.play((at(5, 0), at(0, 0)))
        self.assertEqual((mate.status, mate.winner, mate.reason), ('over', 0, 'checkmate'))
        stale = pos('xq', [(at(9, 4), 'K', 0), (at(0, 3), 'K', 1), (at(5, 2), 'R', 0), (at(1, 8), 'R', 0)])
        stale.play((at(5, 2), at(5, 4)))
        self.assertEqual((stale.status, stale.winner, stale.reason), ('over', 0, 'stalemate'))

    def test_pass_and_score(self):
        st = E.Game('jg')
        st.play(None)
        self.assertEqual(st.status, 'play')
        st.play(None)
        self.assertEqual((st.status, st.winner, st.reason), ('over', 1, 'score'))

    def test_undo(self):
        st = E.Game('jg', ['EHEH', 'HEHE'])
        before = E.key_of(st.board, st.turn)
        st.play((at(6, 4), at(5, 4)))
        st.play((at(3, 4), at(4, 4)))
        st.undo(2)
        self.assertEqual(E.key_of(st.board, st.turn), before)

    def test_ai(self):
        for g in ('jg', 'xq'):
            st = E.Game(g)
            self.assertIn(E.best_move(st, 2, 0.3), st.legal())
        st = pos('xq', [(at(9, 4), 'K', 0), (at(0, 3), 'K', 1), (at(5, 0), 'R', 0), (at(1, 8), 'R', 0)])
        st.play(E.best_move(st, 3, 1.0))
        self.assertEqual((st.status, st.winner), ('over', 0))

    def test_ai_self_play_finishes(self):
        for g in ('jg', 'xq'):
            st = E.Game(g)
            for _ in range(450):
                if st.status != 'play':
                    break
                st.play(E.best_move(st, 1, 0.05))
            self.assertEqual(st.status, 'over')


if __name__ == '__main__':
    unittest.main()
