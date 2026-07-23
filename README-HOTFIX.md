# Version 4.1 hotfix

This patch fixes:

`Maximum call stack size exceeded`

The cause was passing all 155,986 metric values into `Math.min()` and
`Math.max()` simultaneously. The corrected script computes the same full-trip
ranges incrementally.

## Upload

Replace only:

`assets/js/explorer.js`

No photos, trip data, CSS, or HTML need to be uploaded again.
