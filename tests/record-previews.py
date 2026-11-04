"""Record real max-power gameplay clips for the weapon-select screen.
Run against a local server: python tests/record-previews.py http://127.0.0.1:18940/index.html pulse
CDP screencast captures the actual compositor without expensive screenshot round-trips.
The software renderer uses dtcap=1/30, so captured frames encode to a 30 fps clip.
"""
from pathlib import Path
import base64
import subprocess
import sys
from playwright.sync_api import sync_playwright

BASE = sys.argv[1] if len(sys.argv) > 1 else 'http://127.0.0.1:18940/index.html'
KEYS = [sys.argv[2]] if len(sys.argv) > 2 else ['pulse', 'lance', 'nova']
ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'assets'
OUT.mkdir(exist_ok=True)
ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox']

with sync_playwright() as p:
    browser = p.chromium.launch(args=ARGS)
    for key in KEYS:
        frames = Path('/tmp') / f'xeno-frames-{key}'
        frames.mkdir(parents=True, exist_ok=True)
        for old in frames.glob('*'):
            old.unlink()
        ctx = browser.new_context(viewport={'width': 640, 'height': 360}, device_scale_factor=1)
        page = ctx.new_page()
        page.goto(BASE + '?autostart=1&lang=zh&reset=1&quality=low&glow=high&noauto=1&dtcap=0.033333', wait_until='domcontentloaded', timeout=120000)
        page.wait_for_function('() => window.__ninja && __ninja.state === "playing"', timeout=120000)
        page.evaluate("""key => {
          __ninja.invuln = 9999; __ninja.hp = 99; __ninja.api.weapon(key, 6);
          __ninja.api.wave(8); __ninja.ult = 0; __ninja.od = 0; __ninja.noFireT = 0;
          for (let i = 0; i < 12; i++) {
            const type = i % 4 === 3 ? 'weaver' : 'drone';
            __ninja.api.spawn({type, x:(i % 6 - 2.5) * 1.65, phase:i * .4, pattern:i % 2 ? 'strafe' : 'dive', elite:false});
            const e = __ninja.enemies[__ninja.enemies.length - 1]; e.z = -9 - Math.floor(i / 6) * 4 - (i % 2); e.hp = 45;
          }
          const style = document.createElement('style');
          style.textContent = '#banner,#ck-toast{display:none!important}';
          document.head.appendChild(style);
        }""", key)
        session = ctx.new_cdp_session(page)
        count = [0]
        def on_frame(event):
            n = count[0]
            if n >= 120:
                return
            (frames / f'f{n:04d}.jpg').write_bytes(base64.b64decode(event['data']))
            count[0] = n + 1
            session.send('Page.screencastFrameAck', {'sessionId': event['sessionId']})
        session.on('Page.screencastFrame', on_frame)
        session.send('Page.startScreencast', {'format': 'jpeg', 'quality': 84, 'maxWidth': 640, 'maxHeight': 360, 'everyNthFrame': 1})
        triggered = set()
        while count[0] < 120:
            n = count[0]
            if n >= 25 and 'od' not in triggered:
                page.evaluate('() => { __ninja.od = 100; __ninja.api.overdrive(); }'); triggered.add('od')
            if n >= 50 and 'ult' not in triggered:
                page.evaluate('() => { __ninja.ult = 100; __ninja.api.ult(); }'); triggered.add('ult')
            if n % 5 == 0:
                page.evaluate('f => { __ninja.tx = Math.sin(f / 19) * 2.3; __ninja.tz = 0.8; }', n)
            page.wait_for_timeout(100)
            if n // 30 != count[0] // 30 or n == 0:
                print(key, count[0], flush=True)
        session.send('Page.stopScreencast')
        subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', str(frames / 'f0070.jpg'), '-q:v', '3', str(OUT / f'weapon-{key}-poster.jpg')], check=True)
        subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-framerate', '30', '-i', str(frames / 'f%04d.jpg'), '-c:v', 'libvpx-vp9', '-b:v', '0', '-crf', '32', '-pix_fmt', 'yuv420p', str(OUT / f'weapon-{key}.webm')], check=True)
        print('saved', key, (OUT / f'weapon-{key}.webm').stat().st_size, flush=True)
        ctx.close()
    browser.close()
