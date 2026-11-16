"""Download the main photo from each recipe's source link into ../app/photos/<id>.jpg.
Uses the page's og:image (or twitter:image / JSON-LD image). YouTube links use the video thumbnail.
Skips recipes that already have a bundled photo. Run:  python3 fetch_photos.py"""
import json, os, re, io, sys, urllib.request, html
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, '..', 'app', 'photos')
os.makedirs(OUT, exist_ok=True)
UA = {'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15'}

def get(url, binary=False):
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=20) as r:
        data = r.read()
    return data if binary else data.decode('utf-8', 'replace')

def image_url(page_url):
    m = re.search(r'(?:youtube\.com/watch\?v=|youtu\.be/)([\w-]{6,})', page_url)
    if m:
        return f'https://i.ytimg.com/vi/{m.group(1)}/hqdefault.jpg'
    page = get(page_url)
    for pat in [r'<meta[^>]+property=["\']og:image(?::secure_url)?["\'][^>]+content=["\']([^"\']+)',
                r'<meta[^>]+content=["\']([^"\']+)["\'][^>]+property=["\']og:image',
                r'<meta[^>]+name=["\']twitter:image["\'][^>]+content=["\']([^"\']+)',
                r'"image"\s*:\s*\[?\s*"(https?://[^"]+\.(?:jpe?g|png|webp)[^"]*)"',
                r'"image"\s*:\s*\{[^}]*"url"\s*:\s*"(https?://[^"]+)"']:
        m = re.search(pat, page, re.I)
        if m:
            return html.unescape(m.group(1))
    return None

recipes = json.load(open(os.path.join(HERE, '..', 'data', 'recipes.json')))
ok, failed = [], []
for rid, r in recipes.items():
    src = r.get('source') or ''
    dest = os.path.join(OUT, rid + '.jpg')
    if not src or os.path.exists(dest):
        continue
    try:
        iu = image_url(src)
        if not iu:
            raise RuntimeError('no photo found on the page')
        im = Image.open(io.BytesIO(get(iu, True))).convert('RGB')
        im.thumbnail((1000, 1000))
        im.save(dest, quality=82, optimize=True)
        ok.append(rid)
    except Exception as e:
        failed.append(f'{rid}: {src} ({e.__class__.__name__}: {str(e)[:80]})')
print('saved:', len(ok), ok)
print('failed:', len(failed)); print('\n'.join(failed))
