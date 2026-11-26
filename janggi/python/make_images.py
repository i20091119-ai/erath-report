# -*- coding: utf-8 -*-
"""파이썬 판이 쓰는 그림(img 폴더)을 웹판 그림(../img)에서 만들어 내는 도구.

게임을 실행하는 데는 필요 없다. 그림을 바꾸고 싶을 때만 쓴다.
  필요: pip install pillow
  실행: python make_images.py
tkinter 는 JPG 를 읽지 못하고 그림 크기도 자유롭게 바꾸지 못하므로, 화면에 쓰일 크기 그대로 PNG 로 만들어 둔다.
"""
import math
import os

from PIL import Image, ImageChops, ImageDraw, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, '..', 'img')
OUT = os.path.join(HERE, 'img')
CELL, PAD = 58, 40                      # janggi_xiangqi.py 의 값과 같아야 한다
BW, BH = 8 * CELL + 2 * PAD, 9 * CELL + 2 * PAD
SS = 4                                  # 가장자리를 매끄럽게 하려고 크게 그린 뒤 줄인다


def board(game):
    """나무 테두리 + 판 나무결 (선은 프로그램이 그린다)"""
    frame = Image.open(os.path.join(SRC, 'frame.jpg')).convert('RGB').resize((BW, BH), Image.LANCZOS)
    wood = Image.open(os.path.join(SRC, 'board-%s.jpg' % game)).convert('RGB').resize((BW - 20, BH - 20), Image.LANCZOS)
    shade = Image.new('RGB', frame.size, (0, 0, 0))
    frame = Image.blend(frame, shade, 0.15)
    frame.paste(wood, (10, 10))
    ImageDraw.Draw(frame).rectangle((9, 9, BW - 10, BH - 10), outline=(40, 22, 6))
    frame.quantize(colors=256, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.FLOYDSTEINBERG).save(os.path.join(OUT, 'board-%s.png' % game), optimize=True)


def piece(name, radius, octagon, texture):
    """나무결 기물 한 개 (글자는 프로그램이 그린다). 그림자를 포함해 투명 배경으로 저장."""
    size = (radius + 7) * 2
    S, c, R = size * SS, (radius + 7) * SS, radius * SS
    mask = Image.new('L', (S, S), 0)
    d = ImageDraw.Draw(mask)
    if octagon:
        pts = [(c + R * math.cos(math.radians(22.5 + 45 * k)), c + R * math.sin(math.radians(22.5 + 45 * k))) for k in range(8)]
        d.polygon(pts, fill=255)
    else:
        d.ellipse((c - R, c - R, c + R, c + R), fill=255)
    tex = Image.open(os.path.join(SRC, texture)).convert('RGB').resize((S, S), Image.LANCZOS)
    # 왼쪽 위는 밝게, 가장자리는 어둡게 → 볼록해 보이게
    light = Image.new('L', (S, S), 0)
    ImageDraw.Draw(light).ellipse((c - R * 1.1, c - R * 1.25, c + R * 0.5, c + R * 0.35), fill=120)
    light = light.filter(ImageFilter.GaussianBlur(R * 0.35))
    tex = Image.composite(Image.new('RGB', (S, S), (255, 255, 255)), tex, light)
    edge = ImageChops.subtract(mask, mask.filter(ImageFilter.GaussianBlur(R * 0.16)))  # 가장자리 띠
    tex = Image.composite(Image.new('RGB', (S, S), (90, 50, 10)), tex, edge.point(lambda v: min(255, int(v * 1.6))))
    body = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    body.paste(tex, (0, 0), mask)
    outline = ImageChops.subtract(mask, mask.filter(ImageFilter.MinFilter(SS * 2 + 1)))
    body.paste(Image.new('RGBA', (S, S), (84, 52, 16, 255)), (0, 0), outline)
    shadow = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    sm = ImageChops.offset(mask, SS * 2, SS * 3).filter(ImageFilter.GaussianBlur(SS * 2))
    shadow.paste(Image.new('RGBA', (S, S), (0, 0, 0, 150)), (0, 0), sm)
    out = Image.alpha_composite(shadow, body).resize((size, size), Image.LANCZOS)
    out.save(os.path.join(OUT, name + '.png'), optimize=True)


def small(src, dst, width):
    im = Image.open(os.path.join(SRC, src)).convert('RGBA')
    im = im.resize((width, round(im.size[1] * width / im.size[0])), Image.LANCZOS)
    im.save(os.path.join(OUT, dst), optimize=True)


def main():
    os.makedirs(OUT, exist_ok=True)
    board('jg'); board('xq')
    piece('piece-jg-27', 27, True, 'piece-jg.jpg')    # 왕
    piece('piece-jg-24', 24, True, 'piece-jg.jpg')    # 차 포 마 상
    piece('piece-jg-20', 20, True, 'piece-jg.jpg')    # 사 졸
    piece('piece-xq-25', 25, False, 'piece-xq.jpg')
    for n in ('cho', 'han', 'red', 'black', 'ai'):
        small('av-%s.png' % n, 'av-%s.png' % n, 40)
    for n in ('new', 'undo', 'hint', 'pass', 'flip', 'resign', 'book', 'online'):
        small('ic-%s.png' % n, 'ic-%s.png' % n, 18)
    for n in ('win', 'lose', 'draw'):
        small('result-%s.png' % n, 'result-%s.png' % n, 120)
    for n in ('board', 'kingpos', 'guard', 'elephant', 'cannon', 'soldier', 'palace', 'facing', 'pass', 'formation', 'first', 'shape', 'score'):
        small('diff-%s.png' % n, 'diff-%s.png' % n, 34)
    small('icon-192.png', 'icon.png', 64)
    # 진주교육대학교 시그니처 (밝은 바탕 위에 올려 쓴다)
    logo = Image.open(os.path.join(HERE, '..', '..', 'assets', 'logo', 'cnue-signature.png')).convert('RGBA')
    logo = logo.resize((150, round(logo.size[1] * 150 / logo.size[0])), Image.LANCZOS)
    bg = Image.new('RGBA', logo.size, (255, 250, 242, 255))
    Image.alpha_composite(bg, logo).convert('RGB').save(os.path.join(OUT, 'cnue.png'), optimize=True)
    total = sum(os.path.getsize(os.path.join(OUT, f)) for f in os.listdir(OUT))
    print('%d files, %d KB' % (len(os.listdir(OUT)), total // 1024))


if __name__ == '__main__':
    main()
