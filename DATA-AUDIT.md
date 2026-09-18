# DATA AUDIT — Rome-SF.docx vs website

This file records the values deliberately checked against the uploaded DOCX.

## Rome Tables 1–3

- 14/14 region records checked: **PASS**
- Checked fields: area, positive count, negative count, positive density, negative density, net investment score, normalized score, normalized grade, positive percentage, size-agnostic grade.
- Region descriptions were replaced with source-aligned text from the DOCX pp.21–24.

No numeric mismatches found.

## San Francisco graded-footprint series (paper sections A–D)

| Grade | Areas | Graded footprint |
|---|---:|---:|
| A | 13 | 8.65% |
| B | 30 | 31.32% |
| C | 26 | 24.97% |
| D | 17 | 35.06% |

## Table 4 series — reproduced exactly as printed

| Grade | SF Pct | Rome Normalized Pct | Normalized Difference | Rome Size-Agnostic Pct | Agnostic Difference |
|---|---:|---:|---:|---:|---:|
| A | 13.54% | 14.29% | 0.74% | 28.57% | 15.03% |
| B | 31.25% | 7.14% | -24.11% | 21.43% | -9.82% |
| C | 27.08% | 7.14% | -19.94% | 7.14% | -19.94% |
| D | 17.71% | 71.43% | 53.72% | 42.86% | 25.15% |

> Important: the site intentionally does **not** reconcile the SF Pct values in Table 4 with the earlier graded-footprint percentages, because the DOCX itself presents them as different series.

## Other source-checked counts

- 14 Augustan Rome regions.
- 96 San Francisco HOLC districts in the paper.
- 383 Pleiades candidate places; 335 inside region geofences; remaining 48 assigned to the closest region centroid.