#!/usr/bin/env bash
# Turn a scene photograph and its subject cut-outs into simulator layers.
#
#   scripts/prepare-photo-scene.sh <scene-id> <photo> [cutout ...]
#
#   photo    the full photograph (any size; cropped to the simulator's 16:10)
#   cutout   the same photograph with everything but one subject transparent,
#            at the same size as the photo (what a background remover returns)
#
# Writes public/scenes/<scene-id>/plate.webp — the photo with every subject
# removed and the gap filled — and cutout-1.webp, cutout-2.webp, … The filled
# gap only ever shows through a blurred or moving subject, so a smooth
# multi-scale fill (push-pull) of the surrounding background is enough.
#
# Needs ImageMagick 6 or 7 with WebP support.
set -euo pipefail

if [[ $# -lt 2 ]]; then
  sed -n '2,15p' "$0" | sed 's/^# \{0,1\}//'
  exit 1
fi

id="$1"; photo="$2"; shift 2
if [[ ! "$id" =~ ^[a-z0-9-]+$ ]]; then echo "scene id must be lower-case letters, digits and dashes" >&2; exit 1; fi

IM=convert
command -v magick >/dev/null 2>&1 && IM=magick

W=1600; H=1000              # 16:10, matching the renderer's 800x500 reference frame
DILATE=6                    # px grown around each subject before filling the hole
root="$(cd "$(dirname "$0")/.." && pwd)"
out="$root/public/scenes/$id"
tmp="$(mktemp -d)"; trap 'rm -rf "$tmp"' EXIT
mkdir -p "$out"

# Centre-crop to 16:10 and scale to the working size.
fit() { "$IM" "$1" -auto-orient -background none -gravity center -resize "${W}x${H}^" -extent "${W}x${H}" +repage "$2"; }

fit "$photo" "$tmp/photo.png"
"$IM" -size "${W}x${H}" xc:black "$tmp/mask.png"   # union of all subjects, white = subject

n=0
for cut in "$@"; do
  n=$((n + 1))
  fit "$cut" "$tmp/cut$n.png"
  "$IM" "$tmp/cut$n.png" -quality 82 -define webp:alpha-quality=90 -define webp:method=6 "$out/cutout-$n.webp"
  "$IM" "$tmp/cut$n.png" -alpha extract -threshold 8% "$tmp/a$n.png"
  "$IM" "$tmp/mask.png" "$tmp/a$n.png" -compose lighten -composite "$tmp/mask.png"
done

if [[ $n -gt 0 ]]; then
  # Hole = subjects grown slightly, so no edge pixels of a subject remain in the plate.
  "$IM" "$tmp/mask.png" -morphology Dilate "Disk:$DILATE" -negate "$tmp/keep.png"
  "$IM" "$tmp/photo.png" "$tmp/keep.png" -alpha off -compose copy_opacity -composite \
    -background black -alpha background "$tmp/holed.png"
  # Push-pull fill: alpha-weighted downscales of the holed plate, each scaled
  # back up and layered under the finer ones, then the original on top.
  cp "$tmp/holed.png" "$tmp/fill.png"
  layers=()
  for s in 2 4 8 16 32 64 128; do
    # Any coverage at this scale counts as solid, so the finest level that
    # reaches a pixel decides its colour (rather than blending towards grey).
    "$IM" "$tmp/holed.png" -resize "$((W / s))x$((H / s))!" -channel A -level 0,12% +channel \
      -resize "${W}x${H}!" -channel A -level 0,50% +channel "$tmp/up$s.png"
    layers=("$tmp/up$s.png" "${layers[@]}")
  done
  "$IM" -size "${W}x${H}" xc:"$("$IM" "$tmp/photo.png" -resize 1x1! -format '%[pixel:p{0,0}]' info:)" \
    "${layers[@]}" "$tmp/holed.png" -background none -flatten -alpha off "$tmp/plate.png"
else
  cp "$tmp/photo.png" "$tmp/plate.png"
fi

"$IM" "$tmp/plate.png" -quality 80 -define webp:method=6 "$out/plate.webp"

echo "Wrote $(ls "$out" | wc -l) file(s) to public/scenes/$id/:"
ls -l "$out" | awk 'NR>1 {printf "  %-16s %6d kB\n", $9, $5/1024}'
