# UPLOAD INSTRUCTIONS — Icefields Explorer 5.1

This ZIP is a complete GitHub Pages repository package.

## Safest upload method

1. Open the `icefields` repository in GitHub.
2. On the repository's main Code page, select **Add file → Upload files**.
3. Open this ZIP on your PC.
4. Select **all contents inside the extracted folder** and drag them onto GitHub.
5. Confirm that GitHub shows `index.html` at the repository root.
6. Commit the upload.

Do not upload the enclosing `icefields_explorer_v5_1_clean` folder itself.

## Required root structure

```text
index.html
README.md
UPLOAD_INSTRUCTIONS.md
release.json
journal_catalog.csv
notes_catalog.csv
photo_catalog.csv
assets/
```

The following must be a file at the repository root:

```text
index.html
```

The JavaScript must remain here:

```text
assets/js/explorer.js
```

Never rename `explorer.js` to `index.html`.

## After upload

1. Open **Actions** in GitHub and wait for the Pages deployment to finish.
2. Open:
   `https://nrgaustin.github.io/icefields/?release=5.1`
3. The footer should say **Release 5.1**.
4. Test both **Explorer** and **Journal** tabs.

## Rollback

Before replacing files, GitHub retains every earlier commit. To roll back, open
the repository's commit history and revert the Release 5.1 upload commit.
