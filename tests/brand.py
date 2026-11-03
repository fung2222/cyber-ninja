"""Rename guard: the game must expose 異域凶間 / XENO NIGHTMARE everywhere user-facing."""
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
    for lang, zh, en in [('zh', '異域凶間', 'XENO NIGHTMARE'), ('en', 'XENO NIGHTMARE', '異域凶間')]:
        c = b.new_context(viewport={'width': 390, 'height': 844}, is_mobile=True, has_touch=True)
        pg = c.new_page(); errs = []
        pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' else None)
        pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.goto(URL + f'?lang={lang}&reset=1', wait_until='domcontentloaded')
        pg.wait_for_timeout(1800)
        data = pg.evaluate("""() => ({
          title: document.querySelector('.title')?.textContent.trim(),
          titleEn: document.querySelector('.title-en')?.textContent.trim(),
          docTitle: document.title,
          old: /CYBER NINJA|賽博忍者/.test(document.body.innerText),
          docW: document.documentElement.scrollWidth,
        })""")
        print(lang, data)
        check(data['title'] == zh, f'{lang}: main title is {zh}')
        check(data['titleEn'] == en, f'{lang}: secondary title is {en}')
        check('XENO NIGHTMARE' in data['docTitle'], f'{lang}: document title carries XENO NIGHTMARE')
        check(not data['old'], f'{lang}: no old name in visible text')
        check(data['docW'] <= 390, f'{lang}: no horizontal overflow')
        check(len(errs) == 0, f'{lang}: zero console errors')
        c.close()
    b.close()

print(f'\n{len(fails)} FAILED' if fails else '\nALL PASSED')
raise SystemExit(1 if fails else 0)
