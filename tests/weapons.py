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
    pg.click('#btn-hangar-next'); pg.wait_for_timeout(400)
    pg.click('#btn-weapon-go'); pg.wait_for_timeout(250)
    pg.click('#btn-difficulty-go'); pg.wait_for_timeout(350)
    pg.evaluate("() => { __ninja.hp = 3; __ninja.invuln = 999; }")

    st = pg.evaluate("() => ({state:__ninja.state, weapon:__ninja.weapon, power:__ninja.power, hud:document.querySelector('#hud-weapon').textContent, lv:document.querySelector('#hud-wlv').textContent, ult:document.querySelector('#hud-wult').textContent})")
    print(st)
    check(st['state'] == 'playing', 'run starts')
    check(st['weapon'] == 'pulse' and st['power'] == 1, 'starts with pulse L1')
    check(st['hud'] == '脈衝' and st['lv'] == 'LV.1', 'weapon HUD is wired')

    hud = pg.evaluate("""() => {const q=s=>document.querySelector(s)?.getBoundingClientRect(); const top=q('.hud-top'), w=q('#hud-weapon'), hp=q('#hud-hp'), wave=q('#hud-wave'), pause=q('#btn-pause'), mute=q('#btn-mute'), dock=q('.action-dock'); return {top:top&&top.y, w:w&&w.y, hp:hp&&hp.y, wave:wave&&wave.y, pause:pause&&pause.y, mute:mute&&mute.y, dockX:dock&&dock.x, dockY:dock&&dock.y, hpPips:document.querySelectorAll('#hud-hp i').length, pauseText:document.querySelector('#btn-pause')?.getAttribute('aria-label')||'', muteText:document.querySelector('#btn-mute')?.getAttribute('aria-label')||'', old:!!document.querySelector('#weapon-hud')};}""")
    print('hud', hud)
    check(hud['top'] is not None and hud['w'] < 80 and hud['hp'] < 80 and hud['wave'] < 80 and hud['pause'] < 80 and hud['mute'] < 80, 'HUD is consolidated at the top')
    check(hud['old'] is False, 'old bottom-left weapon HUD is gone')
    check(hud['hpPips'] == 5, 'story difficulty shows its five shield pips')
    check(hud['dockX'] < 120 and hud['dockY'] > 700, 'action dock is compact at the lower left')
    check('暫停' in hud['pauseText'] and '靜音' in hud['muteText'], 'pause/mute have visible labels')

    for key, short in [('pulse', '脈衝'), ('lance', '相位'), ('nova', '震波')]:
        pg.evaluate(f"() => __ninja.api.weapon('{key}', 3)")
        pg.wait_for_function(f"() => __ninja.api.shots()['{key}'] > 0", timeout=8000)
        got = pg.evaluate("() => ({w:__ninja.weapon,p:__ninja.power,h:document.querySelector('#hud-weapon').textContent,shots:__ninja.api.shots()})")
        print(key, got)
        check(got['w'] == key and got['p'] == 3, f'{key}: switch keeps its own level')
        check(got['h'] == short, f'{key}: HUD name updates')
        check(sum(got['shots'].values()) > 0, f'{key}: auto-fire produces shots')

    # every lance / nova level has a distinct decorative rig, without changing damage data
    for key, field in [('lance', 'lanceDecor'), ('nova', 'novaDecor')]:
        counts = []
        for level in range(1, 7):
            pg.evaluate(f"() => {{ __ninja.ultT=-1; __ninja.ultMode=null; __ninja.odT=-1; __ninja.noFireT=0; __ninja.api.weapon('{key}', {level}); __ninja.api.clearShots(); __ninja.fireT=0; __ninja.droneFireT=999; }}")
            pg.wait_for_function(f"() => __ninja.api.shots()['{key}'] > 0", timeout=8000)
            pg.wait_for_timeout(80)
            fx = pg.evaluate('__ninja.api.fx()')
            counts.append(fx[field])
            check(fx[field] >= (level - 1 if key == 'lance' else level), f'{key} LV.{level}: level-specific visuals are active')
        check(len(set(counts)) == 6, f'{key}: all six levels have different effect density ({counts})')

    # LV.3 specials are real attacks, not just descriptions or decorations.
    pg.evaluate("""() => { __ninja.enemies=[]; __ninja.boss=null; __ninja.ultT=-1; __ninja.ultMode=null; __ninja.odT=-1; __ninja.noFireT=0; __ninja.api.weapon('pulse',3); __ninja.api.clearShots(); __ninja.homingShots=0; __ninja.fireT=0; __ninja.api.spawn({type:'drone',x:3.2,phase:0,pattern:'strafe',elite:false}); window.__target=__ninja.enemies.at(-1); __target.z=-6; __target.hp=999; }""")
    pg.wait_for_function("() => __ninja.api.specials().homingActive >= 2", timeout=8000)
    special = pg.evaluate('__ninja.api.specials()')
    check(special['homingShots'] >= 2 and special['homingActive'] >= 2, 'pulse LV.3 fires two actual homing missiles per volley')
    pg.wait_for_function("() => window.__target.hp < 999", timeout=12000)
    check(pg.evaluate('__target.hp') < 999, 'off-axis pulse homing missile really damages its target')

    pg.evaluate("""() => { __ninja.enemies=[]; __ninja.api.weapon('lance',3); __ninja.api.clearShots(); __ninja.droneShots=0; __ninja.droneFireT=0; __ninja.fireT=999; __ninja.api.spawn({type:'drone',x:-1.28,phase:0,pattern:'strafe',elite:false}); window.__target=__ninja.enemies.at(-1); __target.z=-6; __target.hp=999; }""")
    pg.wait_for_function("() => __ninja.api.specials().supportActive >= 2", timeout=8000)
    support = pg.evaluate("() => ({s:__ninja.api.specials(),b:__ninja.api.bulletData('lance').filter(b=>b.support)})")
    check(support['s']['drones'] == 2 and support['s']['droneShots'] >= 2, 'lance LV.3 deploys two firing support drones')
    check(len(support['b']) >= 2 and all(v['pierce'] == 0 for v in support['b']), 'both support lasers are non-piercing')
    pg.wait_for_function("() => window.__target.hp < 999", timeout=12000)
    check(pg.evaluate('__target.hp') < 999, 'support drone laser really damages an off-centre enemy')

    pg.evaluate("""() => { __ninja.enemies=[]; __ninja.api.weapon('nova',3); __ninja.api.clearShots(); __ninja.fireT=0; __ninja.api.spawn({type:'drone',x:0,phase:0,pattern:'strafe',elite:false}); window.__target=__ninja.enemies.at(-1); __target.z=-6; __target.hp=100; __ninja.api.spawn({type:'drone',x:0,phase:1,pattern:'strafe',elite:false}); window.__splash=__ninja.enemies.at(-1); __splash.z=-7.6; __splash.hp=100; }""")
    pg.wait_for_function("() => __ninja.api.shots().nova > 0", timeout=8000)
    pg.evaluate('__ninja.fireT=999')
    nova_data = pg.evaluate("__ninja.api.bulletData('nova')[0]")
    check(nova_data['pierce'] == 0 and 0 < nova_data['aoe'] <= 2.5, 'ordinary nova is non-piercing with a bounded blast radius')
    pg.wait_for_function("() => window.__target.hp < 100 && window.__splash.hp < 100", timeout=12000)
    check(pg.evaluate('__target.hp < 100 && __splash.hp < 100'), 'nova impact directly hits one enemy and splash-damages a nearby enemy')

    pg.evaluate("""() => { __ninja.enemies=[]; __ninja.api.clearShots(); __ninja.novaShots=9; __ninja.novaBigShots=0; __ninja.fireT=0; __ninja.api.spawn({type:'drone',x:0,phase:0,pattern:'strafe',elite:false}); window.__target=__ninja.enemies.at(-1); __target.z=-6; __target.hp=100; __ninja.api.spawn({type:'drone',x:3,phase:1,pattern:'strafe',elite:false}); window.__splash=__ninja.enemies.at(-1); __splash.z=-6; __splash.hp=100; }""")
    pg.wait_for_function("() => __ninja.api.specials().novaBigActive > 0", timeout=8000)
    pg.evaluate('__ninja.fireT=999')
    big = pg.evaluate("() => ({s:__ninja.api.specials(),b:__ninja.api.bulletData('nova').find(b=>b.big)})")
    check(big['s']['novaBigShots'] == 1 and big['b'] and big['b']['aoe'] > 3.5, 'every tenth LV.3 nova produces one large shockwave')
    pg.wait_for_function("() => window.__target.hp < 100 && window.__splash.hp < 100", timeout=12000)
    check(pg.evaluate('__target.hp < 100 && __splash.hp < 100'), 'large tenth-shot nova really damages enemies across the wider radius')

    # a W drop must replace the current weapon
    pg.evaluate("() => __ninja.api.weapon('pulse', 2)")
    pg.evaluate("() => __ninja.api.drop('W', 'nova')")
    pg.wait_for_timeout(1000)
    still = pg.evaluate("() => ({w:__ninja.weapon,n:__ninja.pickups.length})")
    print('W idling', still)
    check(still['w'] == 'pulse' and still['n'] > 0, 'W pickup does not auto-absorb')
    pg.evaluate("() => { const p=__ninja.pickups[__ninja.pickups.length-1]; __ninja.tx=p.x; __ninja.tz=p.z; }")
    pg.wait_for_function("() => __ninja.weapon === 'nova'", timeout=8000)
    got = pg.evaluate("() => ({w:__ninja.weapon,p:__ninja.power})")
    print('pickup', got)
    check(got['w'] == 'nova', 'W pickup swaps to the dropped weapon')

    # each weapon ultimate starts its own mode
    for key in ['pulse', 'lance', 'nova']:
        pg.evaluate("() => { __ninja.ultT = -1; __ninja.ultMode = null; __ninja.odT = -1; __ninja.noFireT = 0; }")
        pg.evaluate(f"() => {{ __ninja.api.weapon('{key}', 4); __ninja.api.charge(100); __ninja.api.ult(); }}")
        pg.wait_for_timeout(220)
        got = pg.evaluate("() => ({mode:__ninja.ultMode,t:__ninja.ultT,state:__ninja.state,fx:__ninja.api.fx(),cd:document.querySelector('#ult-sub').textContent})")
        print('ult', key, got)
        check(got['mode'] == key and got['t'] >= 0, f'{key}: own ultimate starts')
        check(got['cd'].endswith('s') and got['cd'][:-1].isdigit(), f'{key}: cooldown seconds are inside the ultimate ball')
        if key == 'lance': check(got['fx']['beamExtras'] == 4 and got['fx']['lightning'] > 0, 'lance ultimate has satellite beams and electricity')
        if key == 'nova': check(got['fx']['novaRings'] == 5, 'nova ultimate has five animated corona rings')
        pg.evaluate("() => { __ninja.ultT = -1; __ninja.ultMode = null; }")

    # pulse ultimate must be a 180° forward fan, never a radial/backward storm
    pg.evaluate("() => { __ninja.state = 'playing'; __ninja.hp = 3; __ninja.invuln = 999; __ninja.ultT = -1; __ninja.ultMode = null; __ninja.odT = -1; __ninja.noFireT = 0; __ninja.api.weapon('pulse', 4); __ninja.api.charge(100); __ninja.api.clearShots(); __ninja.api.ult(); }")
    pg.wait_for_function("() => __ninja.api.pulseVectors().length > 0", timeout=8000)
    vec = pg.evaluate("() => __ninja.api.pulseVectors()")
    print('pulse fan', len(vec), vec[:2])
    check(len(vec) > 0, 'pulse ultimate fires bullets')
    check(all(v['vz'] <= 0.1 for v in vec), 'pulse ultimate never fires backwards')
    check(any(v['vx'] < -1 for v in vec) and any(v['vx'] > 1 for v in vec), 'pulse ultimate fans across both sides')
    pg.evaluate("() => { __ninja.ultT = -1; __ninja.ultMode = null; }")

    # weapon ultimate must protect the craft for its active window
    pg.evaluate("() => { __ninja.ultT = -1; __ninja.ultMode = null; __ninja.api.weapon('pulse', 4); __ninja.api.charge(100); __ninja.api.ult(); __ninja.invuln = 0; __ninja.hp = 3; __ninja.api.kill(); }")
    pg.wait_for_timeout(250)
    ult_hp = pg.evaluate("() => ({hp:__ninja.hp, t:__ninja.ultT})")
    print('ult invuln', ult_hp)
    check(ult_hp['hp'] == 1 and ult_hp['t'] >= 0, 'weapon ultimate grants invincibility while active')
    pg.evaluate("() => { __ninja.ultT = -1; __ninja.ultMode = null; }")

    # overdrive starts and then forces a cease-fire window
    pg.evaluate("() => { __ninja.api.weapon('pulse', 1); __ninja.odCd = 0; __ninja.ultT = -1; __ninja.ultMode = null; __ninja.odT = -1; __ninja.noFireT = 0; __ninja.hp = 3; __ninja.invuln = 999; __ninja.api.overdrive(); }")
    pg.wait_for_timeout(250)
    got = pg.evaluate("() => ({odT:__ninja.odT, odCd:__ninja.odCd, cls:document.querySelector('#btn-od').className, cd:document.querySelector('#od-sub').textContent})")
    print('od start', got)
    check(got['odT'] >= 0 and got['odCd'] > 5, f'overdrive starts a fixed 8s cooldown ({got["odCd"]:.1f}s)')
    check('active' in got['cls'], 'overdrive button shows active')
    check(got['cd'].endswith('s') and got['cd'][:-1].isdigit() and 5 <= int(got['cd'][:-1]) <= 8, f'overdrive shows the cooldown seconds ({got["cd"]})')
    pg.evaluate("() => { __ninja.ult = 100; __ninja.ultT = -1; __ninja.ultMode = null; __ninja.api.ult(); }")
    pg.wait_for_timeout(220)
    combo = pg.evaluate("() => ({od:__ninja.odT, ult:__ninja.ultT, mode:__ninja.ultMode})")
    print('overdrive + ultimate', combo)
    check(combo['od'] >= 0 and combo['ult'] >= 0 and combo['mode'] == 'pulse', 'weapon ultimate can interrupt overdrive')
    pg.evaluate("() => { __ninja.ultT = -1; __ninja.ultMode = null; __ninja.odT = 3.99; }")
    pg.wait_for_function("() => __ninja.noFireT > 0", timeout=8000)
    got = pg.evaluate("() => ({odT:__ninja.odT, noFire:__ninja.noFireT, cls:document.querySelector('#btn-od').className, cd:document.querySelector('#od-sub').textContent})")
    print('od end', got)
    check(got['odT'] < 0 and got['noFire'] > 0, 'overdrive ends into a forced cease-fire')
    check('venting' in got['cls'], 'overdrive button shows venting')
    check(got['cd'].endswith('s') and got['cd'][:-1].isdigit(), f'cooldown keeps counting through venting ({got["cd"]})')
    pg.evaluate("() => { __ninja.ult=100; __ninja.ultT=-1; __ninja.ultMode=null; __ninja.api.ult(); }")
    pg.wait_for_timeout(180)
    vent_ult = pg.evaluate("() => ({mode:__ninja.ultMode,t:__ninja.ultT,noFire:__ninja.noFireT})")
    check(vent_ult['mode'] == 'pulse' and vent_ult['t'] >= 0 and vent_ult['noFire'] > 0, 'charged ultimate remains usable during overdrive venting')
    hit = pg.evaluate("""() => {const r=document.querySelector('#btn-ult').getBoundingClientRect(); const el=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2); return el && (el.id==='btn-ult' || !!el.closest('#btn-ult'));}""")
    check(hit, 'vent graphics never cover the ultimate touch target')
    od_hit = pg.evaluate("""() => {const r=document.querySelector('#btn-od').getBoundingClientRect(); const el=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2); return el && (el.id==='btn-od' || !!el.closest('#btn-od'));}""")
    check(od_hit, 'countdown graphics never cover the overdrive touch target')

    check(len(errs) == 0, f'zero console errors ({errs[:3]})')
    c.close(); b.close()

print(f'\n{len(fails)} FAILED' if fails else '\nALL PASSED')
raise SystemExit(1 if fails else 0)
