# Icefields 2026 — synchronized explorer iteration two

## Upload to GitHub Pages
Upload **all contents** of this folder to the root of the existing `icefields-2026`
repository. Replace the prior `index.html` and `assets` folder.

The first visit may take several seconds because the browser decodes nine original
Garmin FIT files. Subsequent interaction is local and immediate.

## New features
- Real recorded FIT data decoded in the browser
- Shared master position across map, slider, charts, photos and notes
- Selectable aligned charts: elevation, grade, speed, heart rate, power and cadence
- Moving chart cursor and value dots
- Instant, local-mile, local-hour, stage and trip summary windows
- Local, stage and whole-trip map views
- Clustered photo moments on the map
- Full photo-density marks on the timeline
- Editable notes/events

## Curation files
- `photo_catalog.csv`: captions, photographer names and featured-photo fields
- `notes_catalog.csv`: a convenient editable notes list
- `assets/data/photos.json`: data actually read by the site
- `assets/data/notes.json`: notes actually read by the site

Editing a CSV does not automatically update the matching JSON yet. For this iteration,
send the edited CSV back to ChatGPT and it can regenerate the website data.

## Data privacy
The public site includes the original FIT activity files and therefore the recorded route
and sensor data. Do not publish the repository if you do not want those records public.
