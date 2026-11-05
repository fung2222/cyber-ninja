"""Cyberpunk airframe visual/structure guard.
Usage: python tests/aircraft.py [base_url] [out_dir|none] [mobile|desktop|all]
Checks three distinct procedural models, selector persistence, live in-combat rebuilds,
responsive layout and browser errors; leaves full-page screenshots for visual review.
"""
from __future__ import annotations
import os, sys
from playwright.sync_api import sync_playwright

BASE = sys.argv[1] if len(sys.argv) > 1 else 'http://127.0.0.1:18941/'
OUT = sys.argv[2] if len(sys.argv) > 2 else 'docs/shots'
ONLY = sys.argv[3] if len(sys.argv) > 3 else 'all'
SHOTS = OUT != 'none'
if SHOTS: os.makedirs(OUT, exist_ok=True)
def snap(pg, name):
    if SHOTS: pg.screenshot(path=f'{OUT}/{name}.png', timeout=120000)
ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']
EXPECTED = {
    'falcon': {'engines': 2, 'holoArcs': 2, 'minMeshes': 40},
    'bastion': {'engines': 4, 'holoArcs': 2, 'minMeshes': 65},
    'wraith': {'engines': 2, 'holoArcs': 3, 'minMeshes': 40},
}
fails = []
def check(ok, message):
    print(('PASS ' if ok else 'FAIL ') + message, flush=True)
    if not ok: fails.append(message)

def run(p, name, width, height, mobile):
    browser = p.chromium.launch(args=ARGS)
    ctx = browser.new_context(viewport={'width': width, 'height': height}, device_scale_factor=1, is_mobile=mobile, has_touch=mobile)
    pg = ctx.new_page(); errors = []
    pg.on('console', lambda m: errors.append(m.text) if m.type == 'error' else None)
    pg.on('pageerror', lambda e: errors.append(str(e)))
    pg.goto(BASE + '?lang=zh&reset=1', wait_until='domcontentloaded', timeout=120000)
    pg.wait_for_timeout(1300); pg.click('#btn-start'); pg.wait_for_timeout(650)
    signatures = []
    for key, expected in EXPECTED.items():
        # The reset save has no explicit craft key until the player changes it.
        # Switch away first when testing the initially selected default airframe.
        if pg.evaluate('__ninja.craft') == key:
            other = next(k for k in EXPECTED if k != key)
            pg.click(f'[data-craft="{other}"]'); pg.wait_for_timeout(120)
        pg.click(f'[data-craft="{key}"]'); pg.wait_for_timeout(450)
        data = pg.evaluate('__ninja.api.airframe()')
        signatures.append((data['meshes'], data['vertices']))
        selected = pg.evaluate("() => ({craft:__ninja.craft,saved:localStorage.getItem('cyber.cyber-ninja.craft'),selected:document.querySelectorAll('#craft-row .hs-btn.sel').length,overflow:document.documentElement.scrollWidth})")
        check(data['key'] == key and data['engines'] == expected['engines'] and data['holoArcs'] == expected['holoArcs'] and data['meshes'] >= expected['minMeshes'], f'{name}: {key} has its own detailed geometry and engine/holo layout ({data})')
        check(selected['craft'] == key and selected['saved'] == key and selected['selected'] == 1 and selected['overflow'] <= width, f'{name}: {key} selection persists without horizontal overflow')
        snap(pg, f'{name}-craft-{key}-v14')
    check(len(set(signatures)) == 3, f'{name}: all three airframes have distinct mesh signatures')
    if name == 'mobile':
        pg.click('#btn-hangar-next'); pg.click('#btn-weapon-go'); pg.click('#btn-mission-go')
        pg.wait_for_function("() => __ninja.state === 'playing'", timeout=15000)
        for key, expected in EXPECTED.items():
            pg.evaluate("""key => { __ninja.api.craft(key); __ninja.invuln = 0;
              __ninja.x = 0; __ninja.tx = 0; __ninja.z = 1; __ninja.tz = 1; }""", key)
            pg.wait_for_timeout(350)
            data = pg.evaluate('__ninja.api.airframe()')
            check(data['key'] == key and data['engines'] == expected['engines'], f'combat: {key} rebuilds the correct live model')
            snap(pg, f'mobile-combat-{key}-v14')
    check(not errors, f'{name}: zero console errors {errors[:3]}')
    ctx.close(); browser.close()

with sync_playwright() as p:
    if ONLY in ('all', 'mobile'): run(p, 'mobile', 412, 915, True)
    if ONLY in ('all', 'desktop'): run(p, 'desktop', 1280, 800, False)
print('ALL PASSED' if not fails else f'{len(fails)} FAILED', flush=True)
raise SystemExit(1 if fails else 0)
