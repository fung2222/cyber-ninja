"""Hub launch-contract guard for XENO NIGHTMARE.

Covers the params the CYBER ARCADE hub sends: ?hub=1&tier=free|silver|gold&ads=0|1
plus ?trial=1&trialLeft=N and ?ret=<same-origin hub URL>.

Run: python tests/hub-params.py [GAME_URL]
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


def parse(pg, search):
    """Ask the vendored hub module to parse a query exactly as the game does."""
    return pg.evaluate("""async (search) => { const m = await import('./vendor/cyber-kit/platform/hub.js');
      const h = m.readHub(search); return {fromHub:h.fromHub, tier:h.tier, ads:h.ads, trial:h.trial, trialLeft:h.trialLeft, ret:h.ret}; }""", search)


with sync_playwright() as p:
    b = p.chromium.launch(args=ARGS)
    ctx = b.new_context(viewport={'width': 390, 'height': 844}, is_mobile=True, has_touch=True, device_scale_factor=1)
    pg = ctx.new_page()
    errors = []
    pg.on('pageerror', lambda e: errors.append(str(e)[:300]))
    pg.on('console', lambda m: errors.append(m.text[:300]) if m.type == 'error' and 'Failed to load resource' not in m.text else None)

    # gold launch from the hub: hub mode, no ads, trial flag parsed
    pg.goto(URL + '?hub=1&tier=gold&ads=0&trial=1&trialLeft=2&ret=/cyber-arcade/', wait_until='domcontentloaded')
    pg.wait_for_function('() => window.__ninja')
    h = parse(pg, pg.evaluate('location.search'))
    check(h['fromHub'] and h['tier'] == 'gold' and h['ads'] is False, f'gold launch parses hub/tier/ads ({h})')
    check(h['trial'] and h['trialLeft'] == 2, f'trial flags survive the launch ({h["trial"]}, {h["trialLeft"]})')
    check(h['ret'] == '/cyber-arcade/', f'same-origin ret is kept ({h["ret"]})')
    check(pg.evaluate("() => !document.getElementById('btn-arcade-menu').classList.contains('hidden')"),
          'hub launch shows the 返回主頁 button')

    # free launch: interstitials allowed (ads not forced off)
    free = parse(pg, '?hub=1&tier=free')
    check(free['ads'] is True and free['tier'] == 'free', f'free tier keeps ads enabled ({free})')
    # explicit ?ads=1 overrides a paid tier
    forced = parse(pg, '?hub=1&tier=gold&ads=1')
    check(forced['ads'] is True, 'explicit ads=1 wins over the tier default')

    # a foreign ret must be rejected, a same-origin one kept
    foreign = parse(pg, '?hub=1&ret=https://evil.example/x')
    check(foreign['ret'] is None, f'cross-origin ret is rejected ({foreign["ret"]})')

    # returning home follows the same-origin ret
    pg.goto(URL + '?hub=1&tier=gold&ads=0&ret=/cyber-arcade/', wait_until='domcontentloaded')
    pg.wait_for_function('() => window.__ninja')
    pg.evaluate("() => { document.getElementById('btn-arcade-menu').click(); }")
    try:
        pg.wait_for_url('**/cyber-arcade/', timeout=8000)
        check(True, '返回主頁 follows the same-origin ret URL')
    except Exception:
        check(False, f'返回主頁 did not navigate to ret (now {pg.url})')

    # with no ret, the fallback is the arcade root rather than an external site
    pg2 = ctx.new_page()
    pg2.on('pageerror', lambda e: errors.append(str(e)[:300]))
    pg2.goto(URL + '?hub=1&tier=silver', wait_until='domcontentloaded')
    pg2.wait_for_function('() => window.__ninja')
    try:
        pg2.click('#btn-arcade-menu', no_wait_after=True)
    except Exception:
        pass  # the click starts the navigation, which destroys the evaluation context
    pg2.wait_for_timeout(2500)
    url2 = pg2.url
    # Documented contract: hub=1 without ?ret uses history.back() when history exists,
    # otherwise the same-origin ../cyber-arcade/ fallback. A bare new tab may simply stay.
    check(('cyber-arcade' in url2) or url2 == 'about:blank' or url2.startswith(URL),
          f'no-ret home click never leaves for an external origin (observed {url2})')

    check(not errors, f'zero console errors across hub launches ({errors[:3]})')
    ctx.close()
    b.close()

print('ALL PASSED' if not fails else f'{len(fails)} FAILED')
raise SystemExit(1 if fails else 0)
