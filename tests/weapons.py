"""Browser guard for the three-weapon system, pickups, ultimates and overdrive."""
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
    pg = c.new_page(); errs = []
    pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' else None)
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto(URL + '?lang=zh&reset=1', wait_until='domcontentloaded')
    pg.wait_for_timeout(1300)
    pg.click('#btn-start'); pg.wait_for_timeout(350)
    pg.evaluate("() => { __ninja.hp = 5; __ninja.invuln = 999; }")

    st = pg.evaluate("() => ({state:__ninja.state, weapon:__ninja.weapon, power:__ninja.power, hud:document.querySelector('#hud-weapon').textContent, lv:document.querySelector('#hud-wlv').textContent, ult:document.querySelector('#hud-wult').textContent})")
    print(st)
    check(st['state'] == 'playing', 'run starts')
    check(st['weapon'] == 'pulse' and st['power'] == 1, 'starts with pulse L1')
    check(st['hud'] == '脈衝' and st['lv'] == 'LV.1', 'weapon HUD is wired')

    for key, short in [('pulse', '脈衝'), ('lance', '相位'), ('nova', '震波')]:
        pg.evaluate(f"() => __ninja.api.weapon('{key}', 3)")
        pg.wait_for_timeout(250)
        got = pg.evaluate("() => ({w:__ninja.weapon,p:__ninja.power,h:document.querySelector('#hud-weapon').textContent,shots:__ninja.api.shots()})")
        print(key, got)
        check(got['w'] == key and got['p'] == 3, f'{key}: switch keeps its own level')
        check(got['h'] == short, f'{key}: HUD name updates')
        check(sum(got['shots'].values()) > 0, f'{key}: auto-fire produces shots')

    # a W drop must replace the current weapon
    pg.evaluate("() => __ninja.api.weapon('pulse', 2)")
    pg.evaluate("() => __ninja.api.drop('W', 'nova')")
    pg.wait_for_timeout(2600)
    got = pg.evaluate("() => ({w:__ninja.weapon,p:__ninja.power})")
    print('pickup', got)
    check(got['w'] == 'nova', 'W pickup swaps to the dropped weapon')

    # each weapon ultimate starts its own mode
    for key in ['pulse', 'lance', 'nova']:
        pg.evaluate("() => { __ninja.ultT = -1; __ninja.ultMode = null; __ninja.odT = -1; __ninja.noFireT = 0; }")
        pg.evaluate(f"() => {{ __ninja.api.weapon('{key}', 4); __ninja.api.charge(100); __ninja.api.ult(); }}")
        pg.wait_for_timeout(220)
        got = pg.evaluate("() => ({mode:__ninja.ultMode,t:__ninja.ultT,state:__ninja.state})")
        print('ult', key, got)
        check(got['mode'] == key and got['t'] >= 0, f'{key}: own ultimate starts')
        pg.evaluate("() => { __ninja.ultT = -1; __ninja.ultMode = null; }")

    # overdrive starts and then forces a cease-fire window
    pg.evaluate("() => { __ninja.api.weapon('pulse', 1); __ninja.od = 100; __ninja.ultT = -1; __ninja.ultMode = null; __ninja.odT = -1; __ninja.noFireT = 0; __ninja.hp = 5; __ninja.invuln = 999; __ninja.api.overdrive(); }")
    pg.wait_for_timeout(250)
    got = pg.evaluate("() => ({odT:__ninja.odT, od:__ninja.od, cls:document.querySelector('#btn-od').className})")
    print('od start', got)
    check(got['odT'] >= 0 and got['od'] < 10, 'overdrive consumes the meter and starts')
    check('active' in got['cls'], 'overdrive button shows active')
    pg.evaluate("() => { __ninja.odT = 3.99; }")
    pg.wait_for_function("() => __ninja.noFireT > 0", timeout=8000)
    got = pg.evaluate("() => ({odT:__ninja.odT, noFire:__ninja.noFireT, cls:document.querySelector('#btn-od').className})")
    print('od end', got)
    check(got['odT'] < 0 and got['noFire'] > 0, 'overdrive ends into a forced cease-fire')
    check('venting' in got['cls'], 'overdrive button shows venting')

    check(len(errs) == 0, f'zero console errors ({errs[:3]})')
    c.close(); b.close()

print(f'\n{len(fails)} FAILED' if fails else '\nALL PASSED')
raise SystemExit(1 if fails else 0)
