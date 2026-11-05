"""Touch and persistence guard for unified chapters and threat-level unlocks."""
from __future__ import annotations
import sys
from playwright.sync_api import sync_playwright

URL = sys.argv[1] if len(sys.argv) > 1 else 'http://127.0.0.1:18941/'
ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']
fails = []
def check(ok, msg):
    print(('PASS ' if ok else 'FAIL ') + msg)
    if not ok: fails.append(msg)

def open_mission(pg):
    pg.click('#btn-loadout'); pg.click('#btn-hangar-next'); pg.click('#btn-weapon-go')
    pg.wait_for_function("() => !document.querySelector('#screen-mission').classList.contains('hidden')")

def clear_chapter(pg, score):
    """Clear five stages. Since 2026-11-05 a chapter clear rolls into the next chapter,
    so the run stays alive at wave 6 of chapter 2 unless this is chapter 10."""
    for stage in range(1, 6):
        pg.evaluate(f'() => {{ __ninja.score={score}; __ninja.api.clearStage(); }}')
        pg.wait_for_function(f'() => __ninja.wave === {stage + 1} || __ninja.state !== "playing"', timeout=20000)
    pg.wait_for_function("() => __ninja.state === 'playing' || (__ninja.state === 'over' && __ninja.chapterClear)", timeout=20000)

with sync_playwright() as p:
    browser = p.chromium.launch(args=ARGS)
    ctx = browser.new_context(viewport={'width': 390, 'height': 844}, is_mobile=True, has_touch=True, device_scale_factor=1)
    pg = ctx.new_page(); errors = []
    pg.on('pageerror', lambda e: errors.append(str(e)))
    pg.on('console', lambda m: errors.append(m.text) if m.type == 'error' else None)
    pg.goto(URL + '?reset=1&lang=zh', wait_until='domcontentloaded'); pg.wait_for_function('() => window.__ninja')
    open_mission(pg)
    initial = pg.evaluate("""() => ({chapters:document.querySelectorAll('.chapter-btn').length, levels:document.querySelectorAll('.level-card').length, entry:!!document.querySelector('#chapter-entry'), chapter2:document.querySelector('[data-chapter="2"]').disabled, story:document.querySelector('[data-diff="story"]').disabled, normal:document.querySelector('[data-diff="normal"]').disabled, nightmare:document.querySelector('[data-diff="nightmare"]').disabled})""")
    check(initial == {'chapters':10,'levels':0,'entry':True,'chapter2':True,'story':False,'normal':True,'nightmare':True}, f'initial unified chapter and threat locks ({initial})')

    nav = pg.locator('#chapter-nav').bounding_box(); x = nav['x'] + nav['width'] * .82; y = nav['y'] + nav['height'] / 2
    cdp = ctx.new_cdp_session(pg)
    cdp.send('Input.dispatchTouchEvent', {'type':'touchStart','touchPoints':[{'x':x,'y':y,'id':1}]})
    for step in range(1, 13):
        cdp.send('Input.dispatchTouchEvent', {'type':'touchMove','touchPoints':[{'x':x-step*18,'y':y,'id':1}]}); pg.wait_for_timeout(18)
    cdp.send('Input.dispatchTouchEvent', {'type':'touchEnd','touchPoints':[]}); pg.wait_for_timeout(350)
    left = pg.evaluate("document.querySelector('#chapter-nav').scrollLeft")
    check(left > 100, f'real touch swipe scrolls the chapter rail ({left})')
    pg.evaluate("document.querySelector('#chapter-nav').scrollLeft=0")

    pg.click('#chapter-entry'); pg.wait_for_function("() => __ninja.state === 'playing'")
    clear_chapter(pg, 1500)
    result = pg.evaluate("""() => ({state:__ninja.state,wave:__ninja.wave,chapter:__ninja.mission.chapter,p:__ninja.api.progress(),stored:JSON.parse(localStorage.getItem('cyber.cyber-ninja.missionProgress')),resume:JSON.parse(localStorage.getItem('cyber.cyber-ninja.resume')||'null')})""")
    story = result['p']['chapters']['1']['difficulties']['story']
    check(result['state'] == 'playing' and result['wave'] == 6 and result['chapter'] == 2, f'chapter clear rolls straight into chapter 2 ({result["state"]}, wave {result["wave"]})')
    check(story == {'best':1500,'clears':1}, 'chapter completion saves the story score/clear')
    check(result['p']['unlocked'] == 6, 'chapter two unlocks only after stage five')
    check(result['resume'] and result['resume'].get('chapter') == 2, f'resume save point follows the live chapter ({result["resume"]})')
    check(result['stored']['chapters']['1']['difficulties']['story']['best'] == 1500, 'chapter record is written to current-browser storage')

    pg.goto(URL + '?lang=zh', wait_until='domcontentloaded'); pg.wait_for_function('() => window.__ninja'); open_mission(pg); pg.click('[data-chapter="1"]')
    unlocked = pg.evaluate("""() => ({chapter2:!document.querySelector('[data-chapter="2"]').disabled,normal:!document.querySelector('[data-diff="normal"]').disabled,nightmare:!document.querySelector('[data-diff="nightmare"]').disabled,best:document.querySelector('#chapter-entry-best').textContent})""")
    check(unlocked == {'chapter2':True,'normal':True,'nightmare':False,'best':'1,500'}, f'reload restores chapter score and unlocks Normal only ({unlocked})')
    pg.click('[data-diff="normal"]'); pg.click('#btn-mission-go'); pg.wait_for_function("() => __ninja.state === 'playing'")
    clear_chapter(pg, 2500)
    check(pg.evaluate("() => __ninja.state === 'playing'"), 'Normal clear also continues into the next chapter')
    pg.goto(URL + '?lang=zh', wait_until='domcontentloaded'); pg.wait_for_function('() => window.__ninja'); open_mission(pg); pg.click('[data-chapter="1"]')
    final = pg.evaluate("""() => ({normal:__ninja.api.progress().chapters[1].difficulties.normal,nightmare:!document.querySelector('[data-diff="nightmare"]').disabled})""")
    check(final['normal'] == {'best':2500,'clears':1} and final['nightmare'], f'Normal clear unlocks Nightmare and preserves its own record ({final})')
    pg.click('[data-chapter="2"]'); pg.wait_for_timeout(100)
    check(pg.evaluate("document.querySelector('[data-diff=\"normal\"]').disabled"), 'a newly opened chapter still starts at Story difficulty')
    check(not errors, f'zero console errors ({errors[:3]})')
    ctx.close(); browser.close()

print('ALL PASSED' if not fails else f'{len(fails)} FAILED')
raise SystemExit(1 if fails else 0)
