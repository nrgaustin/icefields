# Icefields 2026 — GitHub Pages package

This package contains the first synchronized trip-explorer beta.

## Upload
Upload the contents of this folder to the root of the existing `icefields-2026` repository,
replacing the current `index.html`. Preserve the `assets` folder structure.

## Photo workflow
- Keep all full-resolution originals outside GitHub in one archival folder.
- The website uses optimized copies in `assets/photos/`.
- `photo_catalog.csv` is the curation sheet for photographer names, captions, and featured status.
- `assets/data/photos.json` is the website metadata file.

## Current beta
- Slider, playback, route click, and photo click are synchronized.
- Photo locations use original EXIF GPS.
- Ride metrics shown beside the map are currently stage averages.
- A later build can add true second-by-second elevation, power, HR, speed, cadence, and grade.
