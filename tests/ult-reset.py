"""A new run must re-arm the ultimate-ready notification flag."""
from __future__ import annotations
import sys
from playwright.sync_api import sync_playwright

URL = sys.argv[1] if len(sys.argv) > 1 else 'http://127.0.0.1:18940/cyber-ninja/'
ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']
fails = []
def check(ok, msg):
    print(('ok   ' if ok else 'FAIL ') + msg)
    if not ok: fails.append(msg)

with sync_playwright() as p:
    b = p.chromium.launch(args=ARGS)
    c = b.new_context(viewport={'width': 390, 'height': 844}, is_mobile=True, has_touch=True)
    pg = c.new_page()
    errs = []
    pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' else None)
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto(URL + '?lang=zh&reset=1', wait_until='domcontentloaded')
    pg.wait_for_timeout(2200)
    pg.evaluate("() => { __ninja.ultReadyShown = true; __ninja.ult = 100; }")
    pg.click('#btn-loadout')
    pg.click('#btn-hangar-next')
    pg.click('#btn-weapon-go')
    pg.click('#btn-mission-go')
    pg.wait_for_function("() => __ninja.state === 'playing'", timeout=8000)
    pg.wait_for_timeout(200)
    state = pg.evaluate("() => ({ultReadyShown:__ninja.ultReadyShown, ult:__ninja.ult, wave:__ninja.wave, state:__ninja.state})")
    print(state)
    check(state['state'] == 'playing', 'new run starts')
    check(state['ultReadyShown'] is False, 'ultReadyShown resets on a new run')
    check(state['ult'] == 0, 'ultimate meter resets on a new run')
    check(len(errs) == 0, 'zero console errors')
    c.close(); b.close()

print(f'\n{len(fails)} FAILED' if fails else '\nALL PASSED')
raise SystemExit(1 if fails else 0)
