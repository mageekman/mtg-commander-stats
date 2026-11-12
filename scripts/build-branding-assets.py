"""Generate delivery assets from the unchanged PNG masters (requires Pillow)."""
from pathlib import Path
from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parent.parent
for filename in ('cl-logo-final-transparent.png', 'cl-wordmark-final-transparent.png'):
    source = Image.open(ROOT / filename).convert('RGBA')
    target = ROOT / Path(filename).with_suffix('.webp')
    source.save(target, 'WEBP', lossless=True, method=6)
    decoded = Image.open(target).convert('RGBA')
    assert source.getchannel('A').tobytes() == decoded.getchannel('A').tobytes()
    # WebP may discard RGB under fully transparent pixels; visible output must be exact.
    for color in ('black', 'white', '#173b30'):
        backdrop = Image.new('RGBA', source.size, color)
        assert Image.alpha_composite(backdrop, source).tobytes() == Image.alpha_composite(backdrop, decoded).tobytes()
    print(filename, (ROOT / filename).stat().st_size, '->', target.stat().st_size)

source = Image.open(ROOT / 'cl-favicon-black.png').convert('RGBA')
for size, filename in ((64, 'cl-favicon-64.png'), (180, 'cl-touch-icon-180.png')):
    icon = Image.new('RGB', (size, size), 'black')
    resized = ImageOps.contain(source, (size, size), Image.Resampling.LANCZOS)
    icon.paste(resized, ((size-resized.width)//2, (size-resized.height)//2), resized)
    icon.save(ROOT / filename, 'PNG', optimize=True)
    print(filename, (ROOT / filename).stat().st_size)
