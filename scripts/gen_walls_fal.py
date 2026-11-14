"""Phone wallpapers (FLUX on fal.ai), 576x1024 JPEG in assets/walls/.

  python3 scripts/gen_walls_fal.py [--jobs 4] [--force]
"""
import argparse, io, json, os, random, time, urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from PIL import Image

ap = argparse.ArgumentParser()
ap.add_argument('--jobs', type=int, default=4)
ap.add_argument('--force', action='store_true')
ap.add_argument('--model', default='fal-ai/flux/schnell')
args = ap.parse_args()
OUT = 'assets/walls'
KEY = os.environ.get('FAL_KEY', 'proxy-injected')
TAIL = ' Vertical phone wallpaper, high quality, no people, no text, no letters, no logos, no watermark, no interface.'
WALLS = {
    'sakura': 'Cherry blossom branches in full bloom against a soft pastel pink and blue sky, shallow depth of field.',
    'pines': 'A misty pine forest at sunrise, golden light rays between tall trees, seen from a forest path.',
    'beach': 'A tropical beach at sunset, palm tree silhouettes, orange and purple sky reflected in calm water.',
    'milkyway': 'The Milky Way galaxy over dark mountain peaks, deep blue and violet night sky full of stars.',
    'neonrain': 'A rainy cyberpunk alley at night with glowing magenta and cyan neon lights reflected in puddles, abstract glowing shapes instead of signs.',
    'fluid': 'Abstract fluid art, swirling glossy liquid in orange, magenta and deep purple, smooth gradients.',
    'icecave': 'Inside a glowing blue ice cave, translucent turquoise ice walls.',
    'canyon': 'A red sandstone slot canyon with smooth curved walls and a beam of light.',
    'peaks': 'Snowy mountain peaks at blue hour, pink alpenglow on the summits, a calm valley below.',
    'towers': 'Glass skyscrapers seen from the street looking straight up, clear blue sky, strong perspective.',
    'marble': 'Black marble texture with thin gold veins, elegant and dark.',
    'clouds': 'Soft pastel pink and peach clouds seen from above at sunrise, dreamy.',
    'autumn': 'An autumn park alley covered with yellow and orange leaves, warm sunlight through the trees.',
    'supercar': 'The rear of a red sports car at night on a wet city street, glowing tail lights and blurred city bokeh lights.',
    'gold': 'Stacks of shiny gold bars and scattered gold coins on a dark background, dramatic warm lighting.',
    'bridge': 'A night city skyline with a lit suspension bridge and long light reflections on a river.',
    'glasswaves': 'Abstract 3D translucent glass waves in purple and electric blue on a dark background, soft studio lighting.',
    'synthwave': 'Retro synthwave landscape: a glowing striped sun over purple mountains and a neon grid floor.',
    'monstera': 'Dark green tropical monstera leaves on a nearly black background, moody.',
    'lavender': 'Rows of blooming lavender field at sunset leading to the horizon, warm sky.',
    'underwater': 'Underwater view of sun rays shining through clear turquoise sea water over white sand.',
    'carbon': 'Dark carbon fibre weave texture with a subtle red rim light, abstract minimal.',
    'nightroad': 'A winding mountain road at night with long red and white light trails from cars.',
    'cash': 'A flat lay of neatly arranged green banknote bundles filling the frame, top view, soft light.',
}

def call(prompt, seed):
    body = json.dumps({'prompt': prompt, 'image_size': {'width': 576, 'height': 1024}, 'num_images': 1, 'seed': seed, 'enable_safety_checker': False}).encode()
    for k in range(5):
        try:
            req = urllib.request.Request(f'https://fal.run/{args.model}', data=body, headers={'Content-Type': 'application/json', 'Authorization': f'Key {KEY}'})
            with urllib.request.urlopen(req, timeout=180) as r: res = json.load(r)
            with urllib.request.urlopen(res['images'][0]['url'], timeout=120) as r: return r.read()
        except urllib.error.HTTPError as e:
            msg = e.read()[:300]
            if e.code in (401, 403) and b'balance' in msg.lower(): raise SystemExit('fal.ai: balance exhausted')
            if e.code in (429, 500, 502, 503, 504): time.sleep(4 * (k + 1)); continue
            raise RuntimeError(f'{e.code} {msg}')
        except (TimeoutError, OSError):
            time.sleep(4 * (k + 1))
    raise RuntimeError('gave up')

def work(key):
    os.makedirs(OUT, exist_ok=True)
    seed = random.Random(key + ('|v2' if args.force else '')).randint(1, 2 ** 30)
    im = Image.open(io.BytesIO(call(WALLS[key] + TAIL, seed))).convert('RGB').resize((576, 1024), Image.LANCZOS)
    tmp = os.path.join(OUT, key + '.tmp.jpg')
    im.save(tmp, 'JPEG', quality=78, optimize=True, progressive=True)
    os.replace(tmp, os.path.join(OUT, key + '.jpg'))
    return key

todo = [k for k in WALLS if args.force or not os.path.exists(os.path.join(OUT, k + '.jpg'))]
print(f'{len(todo)} to generate ({len(WALLS) - len(todo)} done)', flush=True)
ok = 0
with ThreadPoolExecutor(args.jobs) as ex:
    futs = {ex.submit(work, k): k for k in todo}
    for f in as_completed(futs):
        try: print('ok', f.result(), flush=True); ok += 1
        except SystemExit as e: print(e, flush=True); ex.shutdown(cancel_futures=True); break
        except Exception as e: print('FAIL', futs[f], e, flush=True)
print(f'done {ok}/{len(todo)}', flush=True)
