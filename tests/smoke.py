"""Headless smoke test for CYBER NINJA.
Usage: python tests/smoke.py [base_url] [out_dir]   (serve the parent folder: python3 -m http.server 18940)
Checks: zero console errors, start, drag moves the ninja, keyboard moves, auto-fire kills enemies (score rises),
ultimate, boss wave spawns, pause/resume, game over + continue, demo autoplay,
language toggle zh-HK/en (persisted in cyber.lang), endless waves beyond the authored cycle (milestone + Mk boss variants).
"""
import sys, os
from playwright.sync_api import sync_playwright
BASE = sys.argv[1] if len(sys.argv) > 1 else 'http://127.0.0.1:18940/cyber-ninja/'
OUT = sys.argv[2] if len(sys.argv) > 2 else 'docs/shots'
os.makedirs(OUT, exist_ok=True)
ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']
fails = []
def check(c, m):
    print(('PASS ' if c else 'FAIL ') + m)
    if not c: fails.append(m)
def run(p, name, w, h, mobile):
    b = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=ARGS)
    ctx = b.new_context(viewport={'width': w, 'height': h}, device_scale_factor=2 if mobile else 1, is_mobile=mobile, has_touch=mobile)
    pg = ctx.new_page(); errs = []
    pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' else None)
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto(BASE + '?reset=1'); pg.wait_for_timeout(4500)
    pg.screenshot(path=f'{OUT}/{name}-start-en.png')
    lang = lambda: pg.evaluate('document.documentElement.dataset.lang')
    check(lang() == 'en', f'{name}: default language from navigator (en)')
    pg.click('#btn-lang'); pg.wait_for_timeout(400)
    check(lang() == 'zh' and pg.inner_text('#btn-start').find('出擊') >= 0, f'{name}: toggle -> zh-HK live')
    pg.reload(); pg.wait_for_timeout(3500)
    check(lang() == 'zh' and pg.evaluate("localStorage.getItem('cyber.lang')") == 'zh-HK', f'{name}: language persisted')
    pg.screenshot(path=f'{OUT}/{name}-start-zh.png')
    if name == 'desktop':
        pg.click('#btn-lang'); pg.wait_for_timeout(300)
        check(lang() == 'en' and 'LAUNCH' in pg.inner_text('#btn-start'), f'{name}: toggle back -> en')
    st = lambda: pg.evaluate('({s: __ninja.state, x: __ninja.x, z: __ninja.z, score: __ninja.score, wave: __ninja.wave, hp: __ninja.hp, ult: __ninja.ult, boss: !!__ninja.boss, kills: __ninja.kills})')
    pg.click('#btn-start'); pg.wait_for_timeout(800)
    check(st()['s'] == 'playing', f'{name}: start -> playing')
    x0 = st()['x']
    cx, cy = w // 2, int(h * 0.6)
    pg.mouse.move(cx, cy); pg.mouse.down(); pg.mouse.move(cx + 120, cy - 40, steps=8); pg.wait_for_timeout(700); pg.mouse.up()
    check(st()['x'] > x0 + 1, f'{name}: drag moves ninja ({x0:.2f} -> {st()["x"]:.2f})')
    x1 = st()['x']; pg.keyboard.down('ArrowLeft'); pg.wait_for_timeout(900); pg.keyboard.up('ArrowLeft')
    check(st()['x'] < x1 - 0.5, f'{name}: keyboard moves ninja ({x1:.2f} -> {st()["x"]:.2f})')
    pg.evaluate('__ninja.invuln = 999')
    for _ in range(40):
        if st()['kills'] > 0: break
        pg.wait_for_timeout(500)
    s = st(); check(s['kills'] > 0 and s['score'] > 0, f'{name}: auto-fire kills enemies ({s["kills"]} kills, {s["score"]} pts)')
    pg.screenshot(path=f'{OUT}/{name}-play.png')
    pg.evaluate('__ninja.ult = 100'); pg.keyboard.press('Space'); pg.wait_for_timeout(250)
    check(pg.evaluate('__ninja.ultT') >= 0 or st()['ult'] == 0, f'{name}: ultimate fires')
    pg.wait_for_timeout(200); pg.screenshot(path=f'{OUT}/{name}-ult.png'); pg.wait_for_timeout(1500)
    pg.evaluate('__ninja.api.boss()'); pg.wait_for_timeout(6000)
    check(st()['boss'], f'{name}: boss wave spawns')
    pg.screenshot(path=f'{OUT}/{name}-boss.png')
    pg.evaluate('__ninja.api.wave(31)'); pg.wait_for_timeout(1200)
    check(st()['wave'] == 31 and st()['s'] == 'playing', f'{name}: endless wave 31 (authored cycle ends at 10)')
    pg.screenshot(path=f'{OUT}/{name}-endless-milestone.png')
    pg.evaluate('__ninja.api.wave(40)'); pg.wait_for_timeout(5000)
    bn = pg.inner_text('#bb-name'); check(st()['boss'] and len(bn) > 0, f'{name}: endless boss variant at wave 40 ({bn})')
    pg.screenshot(path=f'{OUT}/{name}-endless-boss.png')
    pg.keyboard.press('p'); pg.wait_for_timeout(300); check(st()['s'] == 'paused', f'{name}: pause')
    pg.keyboard.press('p'); pg.wait_for_timeout(300); check(st()['s'] == 'playing', f'{name}: resume')
    pg.evaluate('__ninja.invuln = 0; __ninja.api.kill()'); pg.wait_for_timeout(2600)
    check(st()['s'] == 'over', f'{name}: game over screen')
    pg.screenshot(path=f'{OUT}/{name}-over.png')
    if pg.is_visible('#btn-revive'):
        pg.click('#btn-revive'); pg.wait_for_timeout(600); check(st()['s'] == 'playing' and st()['hp'] == 3, f'{name}: continue revives')
    pg.goto(BASE + '?demo=1'); pg.wait_for_timeout(15000)
    d = st(); check(d['s'] == 'playing' and d['kills'] > 0, f'{name}: demo autoplays ({d["kills"]} kills)')
    pg.screenshot(path=f'{OUT}/{name}-demo.png')
    check(not errs, f'{name}: zero console errors {errs[:3]}')
    b.close()
with sync_playwright() as p:
    run(p, 'mobile', 412, 915, True)
    run(p, 'desktop', 1280, 800, False)
print('ALL PASSED' if not fails else f'{len(fails)} FAILED')
sys.exit(1 if fails else 0)
