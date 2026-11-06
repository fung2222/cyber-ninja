"""Headless smoke test for XENO NIGHTMARE.
Usage: python tests/smoke.py [base_url] [out_dir]   (serve the parent folder: python3 -m http.server 18940)
Checks: zero console errors, start, craft/weapon pages, all real-video sources, difficulty selection,
drag/keyboard movement, auto-fire kills, ultimate, bosses, campaign levels and the 50→51 endless transition,
pause/resume, game over + continue, demo autoplay and persisted zh-HK/en language.
"""
import sys, os
from playwright.sync_api import sync_playwright
BASE = sys.argv[1] if len(sys.argv) > 1 else 'http://127.0.0.1:18940/cyber-ninja/'
OUT = sys.argv[2] if len(sys.argv) > 2 else 'docs/shots'
SHOTS = OUT != 'none'
if SHOTS: os.makedirs(OUT, exist_ok=True)
def snap(pg, **kwargs):
    if SHOTS: pg.screenshot(**kwargs)
ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']
fails = []
def check(c, m):
    print(('PASS ' if c else 'FAIL ') + m)
    if not c: fails.append(m)
def run(p, name, w, h, mobile):
    b = p.chromium.launch(args=ARGS)
    # CSS-pixel screenshots are enough for layout checks; DPR 1 keeps SwiftShader runs bounded.
    ctx = b.new_context(viewport={'width': w, 'height': h}, device_scale_factor=1, is_mobile=mobile, has_touch=mobile)
    pg = ctx.new_page(); errs = []
    pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' else None)
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto(BASE + '?reset=1', timeout=120000); pg.wait_for_timeout(4500)
    snap(pg, timeout=120000, path=f'{OUT}/{name}-start-en.png')
    lang = lambda: pg.evaluate('document.documentElement.dataset.lang')
    check(lang() == 'en', f'{name}: default language from navigator (en)')
    # kit v0.3.x: language toggle lives in the settings sheet (gear -> 中/EN)
    set_lang = lambda v: (pg.click('#btn-settings-home'), pg.wait_for_timeout(400),
                          pg.click(f'.ck-settings [data-set="lang"] button[data-v="{v}"]'), pg.wait_for_timeout(400),
                          pg.click('.ck-settings [data-ok]'), pg.wait_for_timeout(400))
    set_lang('zh-HK')
    check(lang() == 'zh' and pg.inner_text('#btn-start').find('出擊') >= 0, f'{name}: toggle -> zh-HK live')
    pg.reload(timeout=120000); pg.wait_for_timeout(3500)
    check(lang() == 'zh' and pg.evaluate("localStorage.getItem('cyber.lang')") == 'zh-HK', f'{name}: language persisted')
    snap(pg, timeout=120000, path=f'{OUT}/{name}-start-zh.png')
    if name == 'desktop':
        set_lang('en')
        check(lang() == 'en' and 'LAUNCH' in pg.inner_text('#btn-start'), f'{name}: toggle back -> en')
    st = lambda: pg.evaluate('({s: __ninja.state, x: __ninja.x, z: __ninja.z, score: __ninja.score, wave: __ninja.wave, hp: __ninja.hp, ult: __ninja.ult, boss: !!__ninja.boss, kills: __ninja.kills, difficulty: __ninja.difficulty, mission: __ninja.mission && {key:__ninja.mission.key,campaign:__ninja.mission.campaign}})')
    pg.click('#btn-start'); pg.wait_for_timeout(600)
    hangar = pg.evaluate("() => ({open: !document.getElementById('screen-hangar').classList.contains('hidden'), crafts: document.querySelectorAll('#craft-row .hs-btn').length, stats: document.querySelectorAll('#craft-stats .cc-stat').length, blurb: document.getElementById('craft-blurb').textContent.length, noTree: !document.getElementById('screen-hangar').querySelector('#tree-detail'), canvas: !!document.getElementById('craft-canvas')})")
    check(hangar['open'] and hangar['crafts'] == 3 and hangar['stats'] == 4 and hangar['blurb'] > 10 and hangar['noTree'] and hangar['canvas'], f'{name}: LOADOUT -> craft page ({hangar})')
    pg.click('#btn-hangar-next'); pg.wait_for_timeout(700)
    wp = pg.evaluate("() => ({open: !document.getElementById('screen-weapon').classList.contains('hidden'), guns: document.querySelectorAll('#weapon-row .hs-btn').length, stats: document.querySelectorAll('#weapon-stats .ws-stat').length, nodes: document.querySelectorAll('#tree-detail .td-node').length, desc: document.getElementById('tree-detail').textContent.length, video: document.getElementById('weapon-video').dataset.weapon, difficulties: document.querySelectorAll('#screen-weapon .diff-btn').length, evolution: document.querySelectorAll('#tree-detail .td-evolution').length})")
    check(wp['open'] and wp['guns'] == 3 and wp['stats'] == 4 and wp['nodes'] == 6 and wp['desc'] > 30 and wp['video'] == 'pulse' and wp['difficulties'] == 0 and wp['evolution'] == 1, f'{name}: real weapon footage and expanded skill data, no difficulty ({wp})')
    for gun in ['lance', 'nova', 'pulse']:
        pg.click(f'[data-wsel="{gun}"]')
        pg.wait_for_function(f"() => document.getElementById('weapon-video').dataset.weapon === '{gun}'")
        pg.wait_for_function("() => document.getElementById('weapon-video').readyState >= 2", timeout=20000)
        video = pg.evaluate("() => {const v=document.getElementById('weapon-video');return {weapon:v.dataset.weapon,src:v.currentSrc,ready:v.readyState,loop:v.loop,muted:v.muted};}")
        check(video['weapon'] == gun and f'weapon-{gun}.webm' in video['src'] and video['loop'] and video['muted'], f'{name}: {gun} switches to its real gameplay clip')
    pg.click('#btn-weapon-go'); pg.wait_for_timeout(500)
    mission = pg.evaluate("() => ({open:!document.getElementById('screen-difficulty').classList.contains('hidden'),locked:document.querySelectorAll('#difficulty-row2 .diff-btn:disabled').length,diffs:document.querySelectorAll('#difficulty-row2 .diff-btn').length})")
    check(mission == {'open':True,'locked':2,'diffs':3}, f'{name}: difficulty page with sequential threat locks ({mission})')
    snap(pg, timeout=120000, path=f'{OUT}/{name}-mission.png')
    pg.click('[data-diff="story"]'); pg.wait_for_timeout(200)
    check(pg.evaluate("() => __ninja.difficulty") == 'story', f'{name}: Story is initially selectable')
    check(pg.evaluate("() => document.querySelector('[data-diff=normal]').disabled && document.querySelector('[data-diff=nightmare]').disabled"), f'{name}: Normal and Nightmare begin locked')
    pg.click('#btn-difficulty-back'); pg.wait_for_timeout(250)
    check(pg.evaluate("() => !document.getElementById('screen-weapon').classList.contains('hidden')"), f'{name}: difficulty back -> weapon page')
    pg.click('#btn-weapon-back'); pg.wait_for_timeout(500)
    check(pg.evaluate("() => !document.getElementById('screen-hangar').classList.contains('hidden')"), f'{name}: weapon back -> craft page')
    pg.click('#btn-hangar-next'); pg.wait_for_timeout(500)
    pg.click('#btn-weapon-go'); pg.wait_for_timeout(350)
    pg.click('#btn-difficulty-go'); pg.wait_for_timeout(800)
    check(st()['s'] == 'playing' and st()['wave'] == 1, f'{name}: selected chapter starts at stage one')
    pg.evaluate('__ninja.api.wave(2)'); pg.wait_for_timeout(300)
    check(st()['wave'] == 2 and st()['mission']['key'] == '1-2', f'{name}: chapter stage two uses its own map and mission data')
    x0 = st()['x']
    cx, cy = w // 2, int(h * 0.6)
    pg.mouse.move(cx, cy); pg.mouse.down(); pg.mouse.move(cx + 120, cy - 40, steps=8); pg.wait_for_timeout(700); pg.mouse.up()
    check(st()['x'] > x0 + 1, f'{name}: drag moves craft ({x0:.2f} -> {st()["x"]:.2f})')
    x1 = st()['x']; pg.keyboard.down('ArrowLeft')
    pg.wait_for_function('x => __ninja.x < x - 0.5', arg=x1, timeout=10000); pg.keyboard.up('ArrowLeft')
    check(st()['x'] < x1 - 0.5, f'{name}: keyboard moves craft ({x1:.2f} -> {st()["x"]:.2f})')
    pg.evaluate("() => { __ninja.invuln = 999; __ninja.x = 0; __ninja.tx = 0; __ninja.z = 1; __ninja.tz = 1; __ninja.api.spawn({type:'drone',x:0,phase:0,pattern:'dive',elite:false}); const e=__ninja.enemies[__ninja.enemies.length-1]; e.z=-6; e.hp=1; }")
    pg.wait_for_function("() => __ninja.kills > 0", timeout=40000)
    s = st(); check(s['kills'] > 0 and s['score'] > 0, f'{name}: auto-fire kills enemies ({s["kills"]} kills, {s["score"]} pts)')
    snap(pg, timeout=120000, path=f'{OUT}/{name}-play.png')
    pg.evaluate('__ninja.ult = 100'); pg.keyboard.press('Space'); pg.wait_for_timeout(250)
    check(pg.evaluate('__ninja.ultT') >= 0 or st()['ult'] == 0, f'{name}: ultimate fires')
    pg.wait_for_timeout(200); snap(pg, timeout=120000, path=f'{OUT}/{name}-ult.png'); pg.wait_for_timeout(1500)
    pg.evaluate('__ninja.api.boss()'); pg.wait_for_timeout(6000)
    check(st()['boss'], f'{name}: boss wave spawns')
    snap(pg, timeout=120000, path=f'{OUT}/{name}-boss.png')
    pg.evaluate('__ninja.api.wave(31)'); pg.wait_for_timeout(1200)
    s = st(); check(s['wave'] == 31 and s['s'] == 'playing' and s['mission'] == {'key':'7-1','campaign':True}, f'{name}: campaign level 31 maps to chapter 7 sortie 1')
    snap(pg, timeout=120000, path=f'{OUT}/{name}-campaign-ch7.png')
    pg.evaluate('__ninja.api.wave(40)'); pg.wait_for_timeout(5000)
    bn = pg.inner_text('#bb-name'); check(st()['boss'] and len(bn) > 0, f'{name}: chapter 8 gatekeeper boss at level 40 ({bn})')
    snap(pg, timeout=120000, path=f'{OUT}/{name}-campaign-boss.png')
    pg.evaluate('__ninja.api.wave(51)'); pg.wait_for_timeout(1200)
    s = st(); check(s['wave'] == 51 and s['s'] == 'playing' and s['mission']['campaign'] == False, f'{name}: level 50 → 51 unlocks endless play')
    snap(pg, timeout=120000, path=f'{OUT}/{name}-endless-unlocked.png')
    pg.keyboard.press('p'); pg.wait_for_timeout(300); check(st()['s'] == 'paused', f'{name}: pause')
    pg.keyboard.press('p'); pg.wait_for_timeout(300); check(st()['s'] == 'playing', f'{name}: resume')
    pg.evaluate('__ninja.invuln = 0; __ninja.ultT = -1; __ninja.ultMode = null; __ninja.api.kill()')
    pg.wait_for_function("() => __ninja.state === 'over'", timeout=8000)
    check(st()['s'] == 'over', f'{name}: game over screen')
    snap(pg, timeout=120000, path=f'{OUT}/{name}-over.png')
    if pg.is_visible('#btn-revive'):
        pg.click('#btn-revive'); pg.wait_for_timeout(600); check(st()['s'] == 'playing' and st()['hp'] == 5, f'{name}: continue revives with Story shield bonus')
    pg.goto(BASE + '?demo=1', timeout=120000)
    pg.wait_for_function("() => window.__ninja && __ninja.state === 'playing'", timeout=20000)
    pg.wait_for_function("() => {const s=__ninja.api.shots(); return s.pulse+s.lance+s.nova>0;}", timeout=20000)
    d = pg.evaluate("() => ({state:__ninja.state,demo:__ninja.demo,kills:__ninja.kills,shots:__ninja.api.shots()})")
    check(d['state'] == 'playing' and d['demo'] and sum(d['shots'].values()) > 0, f'{name}: demo autoplays and auto-fires ({d["kills"]} kills)')
    snap(pg, timeout=120000, path=f'{OUT}/{name}-demo.png')
    check(not errs, f'{name}: zero console errors {errs[:3]}')
    b.close()
ONLY = sys.argv[3] if len(sys.argv) > 3 else 'all'
with sync_playwright() as p:
    if ONLY in ('all', 'mobile'): run(p, 'mobile', 412, 915, True)
    if ONLY in ('all', 'desktop'): run(p, 'desktop', 1280, 800, False)
print('ALL PASSED' if not fails else f'{len(fails)} FAILED')
sys.exit(1 if fails else 0)
