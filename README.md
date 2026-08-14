# NYC 311 Operational Analytics (2022–2025)

End-to-end analytics on NYC 311 service requests: cleaning and taxonomy in Python/SQL, DuckDB analytical views, CSV extracts, and a **static React dashboard** published for stakeholders.

> **Live dashboard (GitHub Pages):** [https://tuahung248.github.io/NYC-311-Analysis/#/triage](https://tuahung248.github.io/NYC-311-Analysis/#/triage)

## What this repository delivers

| Output | Description |
|--------|-------------|
| **Pipeline** | Ordered DuckDB SQL (`00`–`06`), QA gate, dashboard-layer views |
| **Extracts** | `dashboard/extracts/dash_*.csv` + `_manifest.json` from `build_dashboard_extracts.py` |
| **Dashboard** | Vite + React app in `dashboard/app` — median-based KPIs, workload context, equity lens |
| **Publication** | Pushes to `main` rebuild and deploy the dashboard via [`.github/workflows/deploy-dashboard.yml`](.github/workflows/deploy-dashboard.yml) |

**Source data:** [NYC Open Data — 311 Service Requests from 2020 to Present](https://data.cityofnewyork.us/Social-Services/311-Service-Requests-from-2020-to-Present/erm2-nwe9/about_data).

**Working window:** 2022-01-01 through 2025-01-01 (2020–2021 excluded on purpose for stable benchmarks).

**Local raw snapshot in repo:** `data/raw_dataset/311_Service_Requests_from_2020_to_Present_20260502.csv.zip`

## Quick start

```bash
cd "/path/to/NYC311"
python3 -m venv .venv
source .venv/bin/activate
pip install -U pip
pip install -r requirements.txt
```

1. Run all cells in `EDA - SQL scripts/nyc311_cleaning.ipynb` → writes `data/processed/` parquet and quality log.
2. Run SQL stages in order (DuckDB CLI):

   ```bash
   for f in 00_reference 01_clean 02_taxonomy 03_analysis 04_qa 05_checks 06_dashboard_layer; do
     duckdb data/processed/nyc311.duckdb < "EDA - SQL scripts/sql/${f}.sql"
   done
   ```

3. Build dashboard CSVs: `python scripts/build_dashboard_extracts.py`
4. Run the app locally: `cd dashboard/app && npm install && npm run dev`

## Published dashboard (GitHub Pages)

- **URL:** `https://tuahung248.github.io/NYC311/` (path matches the **repository name**).
- **Source:** GitHub Actions — repo **Settings → Pages → Build and deployment → Source: GitHub Actions**.
- **Triggers:** Push to `main` that touches `dashboard/app/`, `dashboard/extracts/`, or the workflow file; or run the workflow manually (**Actions → Deploy dashboard to GitHub Pages → Run workflow**).
- **Implementation:** `HashRouter` and `base: "./"` in Vite; build output is `dashboard/app/dist`.

> [!NOTE]
> Dashboard HTML under `dashboard/app/` is stored as normal git text, not Git LFS, so Pages never serves an LFS pointer file. CSV extracts may use LFS; the workflow checks out with `lfs: true`.

## Repository layout

```text
NYC311/
├── README.md
├── requirements.txt
├── .github/workflows/deploy-dashboard.yml
├── codebook/                    # taxonomy, mapping, data quality log
├── data/
│   ├── raw_dataset/
│   ├── reference/               # e.g. ACS ZIP income quartiles
│   └── processed/               # parquet, duckdb, pipeline_summary (see .gitignore)
├── EDA - SQL scripts/
│   ├── nyc311_cleaning.ipynb
│   └── sql/00_reference.sql … 06_dashboard_layer.sql
├── scripts/
│   ├── acs_income_quartiles.py
│   └── build_dashboard_extracts.py
├── dashboard/
│   ├── README.md
│   ├── extracts/                # dash_*.csv (dashboard data contract)
│   └── app/                     # React + Vite frontend
└── docs/
    └── executive_summary.pdf   # start here — one-page "so what" for reviewers
```

> **Reviewer entry point:** [`docs/executive_summary.pdf`](docs/executive_summary.pdf) — ranked priorities and business narrative before the technical pipeline below (regenerate: `python scripts/build_executive_summary_pdf.py`).

## Pipeline stages (summary)

1. **`00_reference.sql`** — loads `data/reference/acs_zip_income_quartiles.csv`.
2. **`01_clean.sql`** — reads cleaned parquet, date bounds, `resolution_minutes`, dedupe by `unique_key`.
3. **`02_taxonomy.sql`** — `codebook/category_mapping.csv`, `descriptor_overrides.csv`; unmatched → `OTHER`.
4. **`03_analysis.sql`** — `vw_*` volume, Pareto, agency benchmark, equity.
5. **`04_qa.sql` + `05_checks.sql`** — QA views; hard gate (`error()`) on critical failures.
6. **`06_dashboard_layer.sql`** — `dash_*` views for extracts and the web app.
7. **`build_dashboard_extracts.py`** — exports `dashboard/extracts/*.csv` and `_manifest.json`.
8. **`dashboard/app/scripts/csv-to-json.ts`** — build step converts CSV → JSON under `src/data/` (generated; see `dashboard/app/.gitignore`).

## Dashboard app (`dashboard/app`)

| Command | Purpose |
|---------|---------|
| `npm run dev` | `predev` runs `npm run data`, then Vite dev server |
| `npm run data` | CSV → JSON only |
| `npm run build` | Data + `tsc -b` + production bundle |
| `npm run preview` | Preview production build |

Prerequisites: Node.js 18+ and `npm install` in `dashboard/app`.

## Prerequisites

- Python 3 + `pip`
- DuckDB CLI (`duckdb`) for running SQL files
- Node.js + npm for the dashboard

### Optional: refresh ACS quartiles

```bash
source .venv/bin/activate
python scripts/acs_income_quartiles.py
```

Uses Census API (2022 ACS5 S1901); optional `CENSUS_API_KEY`; writes `data/reference/acs_zip_income_quartiles.csv`.

## Extract outputs

After `build_dashboard_extracts.py`, expect:

- `dash_kpi_header.csv`, `dash_pareto.csv`, `dash_priority_signals.csv`, `dash_priority_callouts.csv`
- `dash_monthly_trend.csv`, `dash_agency_benchmark.csv`, `dash_equity_heatmap.csv`, `dash_qa_summary.csv`
- `_manifest.json`

Regenerate app data after extract changes: `npm run data` (or `npm run dev` / `npm run build`) in `dashboard/app`.

## Reproducibility and git

- SQL is stage-ordered; `05_checks.sql` enforces the QA gate.
- Extract script records row counts and manifest metadata.
- Some large/binary patterns may use **Git LFS** (see `.gitattributes`); clone with Git LFS installed if you need full objects locally.

## What is committed vs ignored

Committed examples: SQL, codebook, dashboard source, extracts as tracked, reference CSVs (per repo policy).

Typical ignores (see `.gitignore`): local venvs, `node_modules`, `dist`, generated `dashboard/app/src/data/*.json`, editor cruft.

## Caveats

> [!WARNING]
> Use **median** resolution time as the default KPI (right-skewed durations). Exclude invalid closure ordering. Interpret agency and geography in context of complaint mix and **under-reporting bias** in lower-income areas. DOHMH-linked closure fields may be noisy for strict SLA comparisons.

## Troubleshooting

| Issue | What to do |
|-------|------------|
| `duckdb: command not found` | Install DuckDB CLI; rerun SQL stages. |
| `Missing CSV extract` in app | Run `python scripts/build_dashboard_extracts.py`, then `npm run data` in `dashboard/app`. |
| QA gate fails in `05_checks.sql` | Inspect `qa_unmapped_complaints`, `qa_negative_duration`; fix mapping/cleaning. |
| Sparse `category_mapping.csv` | Expect high `OTHER` and possible `unmapped_pct` failures until mappings are filled. |
| UI shows old numbers | Rebuild extracts → `npm run data` → refresh dev server or redeploy. |
| `tsx: command not found` | Run `npm install` in `dashboard/app` (devDependency). |
| First deploy after renaming the Actions **environment** | Open **Settings → Environments**, select **Dashboard**, and confirm branch protection / deployment rules if GitHub prompts you. |
