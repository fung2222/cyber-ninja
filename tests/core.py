"""Core-pressure guard: enemy fire, terrain hazard, and a three-phase boss."""
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
    pg.goto(URL + '?lang=zh&reset=1', wait_until='domcontentloaded'); pg.wait_for_timeout(1200)
    pg.click('#btn-start'); pg.wait_for_timeout(300)
    pg.evaluate("() => { __ninja.hp = 5; __ninja.invuln = 999; }")

    pg.evaluate("() => { __ninja.api.wave(4); __ninja.api.spawn({type:'drone', x:0, phase:0, pattern:'dive', elite:false}); const e=__ninja.enemies[__ninja.enemies.length-1]; e.z=-8; e.hp=999; e.fireT=0; }")
    pg.wait_for_timeout(1800)
    threat = pg.evaluate("() => __ninja.api.threat()")
    print('threat', threat)
    check(threat['enemies'] > 0, 'wave 4 has enemies')
    check(threat['bullets'] > 0, 'enemies actually fire aimed bullets')

    gem_before = pg.evaluate("() => __ninja.api.threat().gems")
    pg.evaluate("() => { __ninja.api.spawn({type:'drone', x:0, phase:0, pattern:'dive', elite:false}); __ninja.api.killOne(); }")
    pg.wait_for_timeout(250)
    gem_after = pg.evaluate("() => __ninja.api.threat().gems")
    print('gems', gem_before, '->', gem_after)
    check(gem_after > gem_before, 'enemy death drops gems')
    pg.evaluate("() => { for (const g of __ninja.gems) { g.t = 1; g.x = __ninja.x; g.z = __ninja.z - 0.2; } }")
    pg.wait_for_timeout(1600)
    check(pg.evaluate("() => __ninja.api.threat().gems") < gem_after, 'gems fly into the craft automatically')

    pg.evaluate("() => { __ninja.z = -20; __ninja.tz = -20; }")
    pg.wait_for_timeout(400)
    check(pg.evaluate("() => __ninja.z") < -10, 'craft can move across the full upper field')
    pg.evaluate("() => __ninja.api.rock()")
    pg.wait_for_timeout(300)
    check(pg.evaluate("() => __ninja.api.threat().rocks") > 0, 'drifting map debris exists')
    pg.evaluate("() => __ninja.api.hazard()")
    pg.wait_for_timeout(300)
    hz = pg.evaluate("() => __ninja.api.threat()")
    check(hz['hazards'] > 0, 'a telegraphed map hazard is spawned')

    # stationary pressure: a max-level pulse still has to dodge aimed fire
    pg.evaluate("() => { __ninja.api.wave(1); __ninja.x = 0; __ninja.z = 1; __ninja.tx = 0; __ninja.tz = 1; __ninja.hp = 3; __ninja.invuln = 0; __ninja.api.weapon('pulse', 6); }")
    pg.evaluate("() => { __ninja.api.enemyFire(0, -0.2, 0, 9); }")
    pg.wait_for_timeout(1800)
    press = pg.evaluate("() => ({hp:__ninja.hp,bullets:__ninja.api.threat().bullets,state:__ninja.state})")
    print('stationary', press)
    check(press['hp'] < 3 or press['state'] != 'playing', 'stationary max-level player can be hit')

    pg.evaluate("() => { __ninja.api.boss(); __ninja.boss.entering = false; __ninja.boss.z = -15; __ninja.boss.phase = 1; }")
    pg.wait_for_timeout(400)
    b1 = pg.evaluate("() => ({phase:__ninja.boss.phase,hp:__ninja.boss.hp,max:__ninja.boss.maxHp})")
    print('boss phase 1', b1)
    check(b1['phase'] == 1, 'boss enters in phase 1')
    pg.evaluate("() => __ninja.api.bossHurt(85)")
    pg.wait_for_function("() => __ninja.boss.phase === 2", timeout=8000)
    b2 = pg.evaluate("() => ({phase:__ninja.boss.phase,hp:__ninja.boss.hp})")
    print('boss phase 2', b2)
    check(b2['phase'] == 2, 'boss changes to phase 2 at 66%')
    pg.evaluate("() => __ninja.api.bossHurt(80)")
    pg.wait_for_function("() => __ninja.boss.phase === 3", timeout=8000)
    b3 = pg.evaluate("() => ({phase:__ninja.boss.phase,hp:__ninja.boss.hp})")
    print('boss phase 3', b3)
    check(b3['phase'] == 3, 'boss changes to phase 3 at 33%')
    pg.evaluate("() => __ninja.api.wave(6)")
    pg.wait_for_timeout(300)
    check(pg.evaluate("() => __ninja.district") == 'ruins', 'wave 6 switches to the deep-space ruins district')
    pg.evaluate("() => __ninja.api.wave(11)")
    pg.wait_for_timeout(300)
    check(pg.evaluate("() => __ninja.district") == 'city', 'wave 11 rotates back to the neon city district')
    check(len(errs) == 0, f'zero console errors ({errs[:3]})')
    c.close(); b.close()

print(f'\n{len(fails)} FAILED' if fails else '\nALL PASSED')
raise SystemExit(1 if fails else 0)
