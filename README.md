# Icefields Explorer — Release 5

## Major changes
- Added separate Explorer and Journal views.
- Removed note/event markers from the map; notes remain on the timeline.
- Moved Local / Stage / Whole Trip controls away from Leaflet zoom buttons.
- Restored selectable basemaps: streets, Esri topographic, terrain, satellite, and light.
- Disabled ordinary mouse-wheel / trackpad scroll zoom so vertical scrolling moves the page.
- Stage cadence excludes zero-cadence coasting records, matching Garmin's convention.
- Stage and trip speed, heart rate, power, and cadence use precomputed Garmin-style summaries.
- Added `journal_catalog.csv` and `assets/data/journal.json` for day-by-day narrative content.

## Upload
Upload the complete contents to the root of the GitHub Pages repository, replacing
`index.html`, `assets/css/site.css`, `assets/js/explorer.js`, and
`assets/data/trip.json`. Add `assets/data/journal.json` and `journal_catalog.csv`.

Existing photo image files are unchanged and do not need to be re-uploaded if they
already exist in the repository.

## Journal editing
Edit `journal_catalog.csv` with day titles, summaries, highlights, lodging, and featured
photo IDs. Send the edited CSV back to ChatGPT to regenerate `journal.json`.
