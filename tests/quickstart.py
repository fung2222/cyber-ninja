"""Start-flow guard (Roy 2026-11-05).

Home -> 出擊 -> airframe -> weapon -> difficulty -> play from chapter 1 stage 1.
The chapter list is records-only: it opens from the home screen, shows each
chapter's story and best score, and must never launch a run.

Run: python tests/quickstart.py [URL]
"""
from __future__ import annotations
import sys
from playwright.sync_api import sync_playwright

URL = (sys.argv[1] if len(sys.argv) > 1 else 'http://127.0.0.1:18941/').rstrip('/') + '/'
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

    box = pg.evaluate("""() => { const e = document.querySelector('#btn-chapters'); if (!e) return null;
      const r = e.getBoundingClientRect(); return {w:r.width,h:r.height,x:r.x,right:r.right,visible:r.width>0}; }""")
    check(bool(box and box['visible'] and box['h'] >= 40), f'home shows a chapters entry under LAUNCH ({box})')
    check(bool(box and box['right'] <= 390 and box['x'] >= 0), 'chapters entry stays inside the viewport')
    pg.click('#btn-chapters'); pg.wait_for_timeout(400)
    check(not hidden(pg, '#screen-mission'), 'chapters entry opens the records page')
    check(pg.locator('#chapter-nav .chapter-btn').count() == 10, 'records page lists all ten chapters')
    check(pg.locator('#btn-mission-go, #chapter-entry').count() == 0, 'records page has no launch control')
    pg.click('#btn-mission-back'); pg.wait_for_timeout(300)

    pg.click('#btn-start'); pg.wait_for_timeout(450)
    check(not hidden(pg, '#screen-hangar'), 'LAUNCH opens the airframe page')
    pg.click('#btn-hangar-next'); pg.wait_for_timeout(400)
    check(not hidden(pg, '#screen-weapon'), 'airframe page leads to the weapon page')
    pg.click('#btn-weapon-go'); pg.wait_for_timeout(450)
    check(not hidden(pg, '#screen-difficulty'), 'weapon page leads to the difficulty page')
    check(pg.locator('#difficulty-row2 .diff-btn').count() == 3, 'difficulty page offers three difficulties')
    check(pg.evaluate("() => !document.querySelector('#difficulty-row2 .diff-btn').disabled"), 'Story is selectable on a fresh save')

    pg.click('#btn-difficulty-go')
    pg.wait_for_function("() => __ninja.state === 'playing'", timeout=25000)
    st = pg.evaluate("() => ({wave: __ninja.wave, chapter: __ninja.mission.chapter, diff: __ninja.difficulty})")
    check(st['wave'] == 1 and st['chapter'] == 1 and st['diff'] == 'story', f'a difficulty run starts at chapter 1 stage 1 ({st})')
    check(not errors, f'zero console errors ({errors[:3]})')
    ctx.close()
    b.close()

print('ALL PASSED' if not fails else f'{len(fails)} FAILED')
raise SystemExit(1 if fails else 0)
