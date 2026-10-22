# Plan Lens

**Plan Lens** is a browser-based dashboard for comparing two production-plan versions stored in an Excel workbook. It turns the most important schedule changes into an easy-to-read management view—without uploading the workbook to a server.

## Why Plan Lens?

Production plans change quickly. Comparing two Excel sheets manually makes it easy to miss a quantity change, a newly introduced model, or a schedule movement.

Plan Lens helps teams identify:

- Models that disappeared from the latest plan
- Newly introduced models
- Quantity changes
- **Pull in** movements (production starts earlier)
- **Push out** movements (production starts later)

## Privacy-first by design

The workbook is read and processed entirely in the browser. Plan Lens does not upload, store, or send production-plan data to an external server.

## Input format

Upload an Excel workbook (`.xlsx` or `.xls`) containing two production-plan sheets. Each selected sheet must include:

| Required column | Purpose |
| --- | --- |
| `Line` | Production line identifier |
| `Model` | Production model identifier |
| `1` to `31` | Daily production quantities |
| `Total Q'ty` | Total planned quantity for the model |

The column labels may contain whitespace or line breaks. Plan Lens detects them automatically.

## Comparison rules

Plan Lens compares plans at the **model level**. A model moving to another line is still considered the same model.

1. A model is **missing** only when it no longer exists anywhere in the current sheet.
2. A model is **new** only when it does not exist anywhere in the previous sheet.
3. For models present in both sheets, quantities across all lines are aggregated.
4. If `Total Q'ty` changes, the model is labeled **Quantity change**. This takes priority over date changes.
5. If the total quantity is unchanged, the first production day is compared:
   - Earlier in the current plan → **Pull in** (positive number of days)
   - Later in the current plan → **Push out** (negative number of days)
6. Changes that only affect later production days while the first production day remains unchanged are intentionally excluded from the focused change list.

## Features

- Drag-and-drop Excel upload
- Previous/current sheet selection
- Summary KPI cards for each change type
- Change distribution overview
- Searchable and filterable change table
- CSV export for the filtered comparison result
- Responsive, browser-only interface

## Run locally

This project is a static website. No package installation or backend is required.

```bash
python3 -m http.server 8000 --directory dist
```

Then open `http://localhost:8000` in a browser.

## Deploy to GitHub Pages

This repository includes a GitHub Actions workflow that deploys `dist/` automatically.

1. Push the repository to GitHub.
2. In **Settings → Pages**, choose **GitHub Actions** as the source.
3. Every push to `main` will publish the content of `dist/`.
4. Share the generated GitHub Pages URL.

## Project structure

```text
.
├── dist/
│   ├── index.html      # Page structure
│   ├── styles.css      # Responsive visual design
│   └── app.js          # Excel parsing and comparison logic
└── README.md
```

## Technology

- Vanilla HTML, CSS, and JavaScript
- [SheetJS](https://sheetjs.com/) for browser-side Excel parsing
- No backend or database

## Roadmap

- Export the comparison result as a formatted Excel workbook
- Add configurable comparison rules
- Add optional saved views and shareable report settings
- Add Vietnamese/English interface switching

## Feedback

This project is being refined with real production-planning workflows. Feedback on the dashboard layout, comparison rules, and reporting needs is welcome.
