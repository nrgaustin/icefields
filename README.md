# Icefields 2026 — synchronized explorer iteration four

## Upload
Upload all contents of this directory to the root of the GitHub Pages repository,
replacing the existing `index.html` and `assets` directory.

## Changes in this iteration
- Every metric chart displays the full 612-mile profile.
- Per-pixel min/max envelopes retain brief peaks that ordinary downsampling can miss.
- Clicking a chart uses both horizontal and vertical position to select the closest
  actual recorded value near that trip location.
- Numeric metric cards were replaced by dynamic fixed-scale horizontal gauges.
- Photo markers were removed from the map.
- A photograph persists until the journey reaches the next photograph.
- Clicking the map displays the geographically nearest photo.
- A thin, spatially accurate photo-film ribbon sits below the master slider.
- Play/Pause is available over the map and below the slider.
- Spacebar toggles Play/Pause unless a form control has keyboard focus.

## Curation
- `photo_catalog.csv` contains photo metadata for future edits.
- `notes_catalog.csv` contains editable notes/events.
- Send edited CSV files back to ChatGPT to regenerate the JSON used by the site.
