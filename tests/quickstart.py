"""Quick-start guard for XENO NIGHTMARE.

Roy 2026-11-05: START must launch the remembered airframe / weapon / chapter in one tap.
The three selection pages stay reachable through the 配置 (LOADOUT) button, and a
first-ever launch still walks the three pages.

Run: python tests/quickstart.py [URL]
"""
from __future__ import annotations
import sys
from playwright.sync_api import sync_playwright

URL = sys.argv[1] if len(sys.argv) > 1 else 'http://127.0.0.1:18941/'
ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']
fails = []


def check(ok, msg):
    print(('PASS ' if ok else 'FAIL ') + msg)
    if not ok:
        fails.append(msg)


def hidden(pg, sel):
    return pg.evaluate(f"document.querySelector('{sel}').classList.contains('hidden')")


with sync_playwright() as p:
    b = p.chromium.launch(args=ARGS)
    ctx = b.new_context(viewport={'width': 390, 'height': 844}, is_mobile=True, has_touch=True, device_scale_factor=1)
    pg = ctx.new_page()
    errors = []
    pg.on('pageerror', lambda e: errors.append(str(e)[:300]))
    pg.on('console', lambda m: errors.append(m.text[:300]) if m.type == 'error' else None)

    pg.goto(URL + '?reset=1&lang=zh', wait_until='domcontentloaded')
    pg.wait_for_function('() => window.__ninja')

    # 1. the secondary 配置 entry exists, is tappable and fits the phone
    box = pg.evaluate("""() => { const e = document.querySelector('#btn-loadout'); if (!e) return null;
      const r = e.getBoundingClientRect(); return {w:r.width,h:r.height,x:r.x,y:r.y,right:r.right,
      visible: getComputedStyle(e).display !== 'none' && r.width > 0}; }""")
    check(bool(box and box['visible']), 'start screen shows a LOADOUT (配置) entry')
    check(bool(box and box['h'] >= 44 and box['w'] >= 88), f'LOADOUT target is at least 44px tall ({box})')
    check(bool(box and box['right'] <= 390 and box['x'] >= 0 and box['y'] >= 0), 'LOADOUT stays inside the viewport')

    # 2. first-ever launch still walks the three selection pages
    pg.click('#btn-start')
    pg.wait_for_timeout(500)
    check(not hidden(pg, '#screen-hangar'), 'first launch opens the airframe page (onboarding kept)')
    check(pg.evaluate("() => __ninja.state !== 'playing'"), 'first launch does not skip into play')

    # 3. the 配置 entry opens the same three-page flow
    pg.click('#btn-hangar-back')
    pg.wait_for_timeout(300)
    pg.click('#btn-loadout')
    pg.wait_for_timeout(500)
    check(not hidden(pg, '#screen-hangar'), 'LOADOUT opens the airframe page')

    # 4. walk the pages once, launch, and record the chosen loadout
    pg.click('#btn-hangar-next')
    pg.wait_for_timeout(400)
    check(not hidden(pg, '#screen-weapon'), 'LOADOUT flow reaches the weapon page')
    pg.click('#btn-weapon-go')
    pg.wait_for_timeout(400)
    check(not hidden(pg, '#screen-mission'), 'LOADOUT flow reaches the chapter page')
    pg.click('#btn-mission-go')
    pg.wait_for_function("() => __ninja.state === 'playing'", timeout=20000)
    saved = pg.evaluate("""() => { for (const k of Object.keys(localStorage)) if (k.endsWith('lastLoadout')) return {key:k, v:JSON.parse(localStorage.getItem(k))};
      return null; }""")
    check(bool(saved), f'the chosen loadout is stored ({saved})')
    if saved:
        v = saved['v']
        check(v.get('chapter', 0) >= 1 and v.get('weapon') and v.get('craft'),
              f'stored loadout carries craft / weapon / chapter ({v})')

    # 5. back to the title and one-tap launch
    pg.goto(URL + '?lang=zh', wait_until='domcontentloaded')
    pg.wait_for_function('() => window.__ninja')
    t0 = pg.evaluate('performance.now()')
    pg.click('#btn-start')
    pg.wait_for_function("() => __ninja.state === 'playing'", timeout=20000)
    elapsed = pg.evaluate('performance.now()') - t0
    check(hidden(pg, '#screen-hangar'), 'one-tap START never shows the airframe page')
    check(hidden(pg, '#screen-start'), 'one-tap START leaves the title screen')
    cur = pg.evaluate("() => ({craft: __ninja.craft, wave: __ninja.wave, weapon: __ninja.weapon})")
    if saved:
        v = saved['v']
        check(cur['craft'] == v['craft'], f"one-tap START reuses the saved airframe ({cur['craft']} vs {v['craft']})")
        check(cur['weapon'] == v['weapon'], f"one-tap START reuses the saved weapon ({cur['weapon']} vs {v['weapon']})")
        check(cur['wave'] >= (v['chapter'] - 1) * 5 + 1, f"one-tap START starts at the saved chapter ({cur['wave']})")
    check(elapsed < 8000, f'one tap reaches play in under 8s of page time ({elapsed:.0f}ms)')

    check(not errors, f'zero console errors ({errors[:3]})')
    ctx.close()
    b.close()

print('ALL PASSED' if not fails else f'{len(fails)} FAILED')
raise SystemExit(1 if fails else 0)
