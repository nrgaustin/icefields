# Icefields 2026 — synchronized explorer iteration three

This package removes the browser-side Garmin FIT decoder. The nine FIT files were
decoded during site generation into `assets/data/trip.json`.

## Upload
Upload all contents of this directory to the root of the GitHub Pages repository,
replacing the existing `index.html` and `assets` directory.

## Data included
- 155,986 recorded FIT record messages
- GPS, timestamp, cumulative distance, elevation, speed, heart rate, power,
  cadence, temperature and derived grade
- Corrected chronology: Icefields08 is Day 1; Icefields01 is Day 8
- Day 2 combines Icefields07 and Icefields06

## Curation
- `photo_catalog.csv` contains photo metadata for future edits.
- `notes_catalog.csv` contains editable notes/events.
- Send edited CSV files back to ChatGPT to regenerate the JSON used by the site.

## Privacy
The original FIT files are not included. The website data still contains the route
and recorded ride metrics, so keep the repository private if you do not want those
values publicly accessible.
