# Branding delivery assets

The root PNG files `cl-logo-final-transparent.png`, `cl-wordmark-final-transparent.png`, and `cl-favicon-black.png` are the unchanged source masters.

Run `python scripts/build-branding-assets.py` with Pillow and WebP support to regenerate the delivery files. The script verifies identical alpha and identical rendered logo pixels on black, white, and theme backgrounds. WebP may discard hidden RGB values in fully transparent pixels.

Pages use the lossless WebP logos, a 64-pixel black-background favicon, and a 180-pixel touch icon. Keep the PNG masters for regeneration and compatibility with existing external URLs.
