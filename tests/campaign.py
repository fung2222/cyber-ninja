"""Campaign + records guard for the difficulty-first flow (Roy 2026-11-05)."""
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


def start_run(pg, diff=None):
    pg.click('#btn-start'); pg.click('#btn-hangar-next'); pg.click('#btn-weapon-go')
    pg.wait_for_function("() => !document.querySelector('#screen-difficulty').classList.contains('hidden')")
    if diff:
        pg.click(f'[data-diff="{diff}"]')
    pg.click('#btn-difficulty-go')
    pg.wait_for_function("() => __ninja.state === 'playing'", timeout=25000)


def clear_chapter(pg, score):
    for stage in range(1, 6):
        pg.evaluate(f'() => {{ __ninja.score={score}; __ninja.api.clearStage(); }}')
        pg.wait_for_function("(n) => __ninja.wave === n || __ninja.state !== 'playing'", arg=stage + 1, timeout=20000)
    pg.wait_for_function("() => __ninja.state === 'playing' || (__ninja.state === 'over' && __ninja.chapterClear)", timeout=20000)


with sync_playwright() as p:
    browser = p.chromium.launch(args=ARGS)
    ctx = browser.new_context(viewport={'width': 390, 'height': 844}, is_mobile=True, has_touch=True, device_scale_factor=1)
    pg = ctx.new_page(); errors = []
    pg.on('pageerror', lambda e: errors.append(str(e)))
    pg.on('console', lambda m: errors.append(m.text) if m.type == 'error' else None)

    pg.goto(URL + '?reset=1& } ;lang=zh', wait_until='domcontentloaded'); pg.wait_for_function('() => window.__ninja')
    start_run(pg)
    first = pg.evaluate("() => ({wave:__ninja.wave, chapter:__ninja.mission.chapter})")
    check(first == {'wave': 1, 'chapter': 1}, f'a Story run starts at chapter 1 stage 1 ({first})')

    clear_chapter(pg, 1500)
    after = pg.evaluate("""() => ({state:__ninja.state, wave:__ninja.wave, chapter:__ninja.mission.chapter,
      p:__ninja.api.progress(), resume:JSON.parse(localStorage.getItem('cyber.cyber-ninja.resume')||'null')})""")
    story = after['p']['chapters']['1']['difficulties']['story']
    check(after['state'] == 'playing' and after['wave'] == 6 and after['chapter'] == 2, 'chapter clear rolls into chapter 2')
    check(story == {'best':1500,'clears':1}, f'chapter 1 story record saved ({story})')
    check(after['resume'] and after['resume'].get('chapter') == 2, f'resume save point follows the live chapter ({after["resume"]})')

    # records page: story + best, no launch
    pg.goto(URL + '?lang=zh', wait_until='domcontentloaded'); pg.wait_for_function('() => window.__ninja')
    pg.click('#btn-chapters'); pg.wait_for_timeout(400)
    pg.click('[data-chapter="1"]'); pg.wait_for_timeout(200)
    rec = pg.evaluate("""() => ({best:document.querySelector('#chapter-best').textContent,
      story:document.querySelector('#mission-story').textContent.length,
      launch:document.querySelectorAll('#btn-mission-go,#chapter-entry').length})""")
    check(rec['best'] == '1,500' and rec['story'] > 20 and rec['launch'] == 0, f'records page shows story + best with no launch ({rec})')
    pg.click('#btn-mission-back'); pg.wait_for_timeout(300)

    # Story clear unlocks Normal on the difficulty page
    pg.click('#btn-start'); pg.click('#btn-hangar-next'); pg.click('#btn-weapon-go')
    pg.wait_for_function("() => !document.querySelector('#screen-difficulty').classList.contains('hidden')")
    unlocked = pg.evaluate("""() => [...document.querySelectorAll('#difficulty-row2 .diff-btn')].map(b => ({k:b.dataset.diff, off:b.disabled}))""")
    check(any(x['k'] == 'normal' and not x['off'] for x in unlocked), f'Story clear unlocks Normal ({unlocked})')
    check(any(x['k'] == 'nightmare' and x['off'] for x in unlocked), 'Nightmare stays locked until a Normal clear')
    check(not errors, f'zero console errors ({errors[:3]})')
    ctx.close(); browser.close()

print('ALL PASSED' if not fails else f'{len(fails)} FAILED')
raise SystemExit(1 if fails else 0)
