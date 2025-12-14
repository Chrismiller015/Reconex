# Build Instructions (UI/UX Plan)

This doc describes the agreed web UI/UX for uploading two files (GM + DI), running a comparison, browsing variances, drilling into details, and supporting audit/history.

## Core principles

- Require **both files** before running a compare.
- Allow uploads of **xlsx, xlsm, xlsb, csv** as long as required fields exist (case-insensitive).
- Store files **server-side** for auditing and re-download later.
- Primary variance detection is **BAC-level**, but drilldowns must clearly show **which products** drive the variance.
- Keep “excluded” rows in the dataset for context, even when they don’t count toward totals.

## Global navigation

- **Welcome**
- **File Library**
- **Compare Runs**
- **Settings** (placeholder; category values later)

No role gating for now.

## Screen 1: Welcome (placeholder)

- Minimal landing screen.
- CTAs:
  - **New Compare**
  - **Go to File Library**

## Screen 2: File Library (audit + storage)

“Google Drive-esque” table of uploaded files.

### Table columns

- **File name**
- **Type**
- **Uploaded at**
- **Uploaded by** (if available; otherwise placeholder)
- **File size**
- **Row count**
- **Detected schema**: GM / DI / Unknown
- **Actions**:
  - Download
  - (Optional later) Preview
  - (Optional later) Delete

### Upload behavior

- Accept file types: **xlsx, xlsm, xlsb, csv**.
- On upload, backend should:
  - Parse headers.
  - Validate required fields exist (case-insensitive).
  - Compute row count.
  - Classify file as **GM** vs **DI** based on required-field signature.
- If schema is **Unknown**, show a prominent badge with tooltip listing missing required fields.

## Screen 3: New Compare (requires both files)

### Step 1: Select DI + GM files

Two selectors (each supports “choose from library” or “upload new”):

- **DI file** selector
- **GM file** selector

Rules:

- “Compare” button disabled until both files selected and each validates as expected schema.
- Permit “wrong type” so long as required columns are present (e.g., DI could be xlsx).

### Step 2: BAC-level Variance Table (first screen after Compare)

#### Top summary bar (KPI strip)

- **# BACs with variance**
- **Total GM $**
- **Total DI $**
- **Net Δ**

Totals must update if variances are removed/ignored.

#### BAC variance table

Each row represents a **BAC with variance issues**.

Columns (minimum):

- **BAC**
- **GM total**
- **DI total**
- **Δ**
- **Flags** (chips/badges with tooltips)
- **Notes count**
- **Category** (placeholder field)
- **Actions**: View details, Export

#### Filters/sort/search

Include:

- BAC search
- Only variances
- Only terminated
- Only duplicates
- Only desync
- Brand filter
- Product code filter
- Minimum absolute delta threshold
- Toggle: **Show removed/ignored** (default off)

#### BAC-level flags (chips w/ tooltips)

Show all applicable:

- **Terminated BAC** (GM): treat as variance; totals exclude terminated from math, but flag remains visible.
- **GM duplicates**: duplicate rows for the same `(BAC, Product Brand, Product Code)`.
- **GM non-billing rows present**: rows where `Is Billing` is false.
- **GM desync detected**: `Is Billing` differs from derived/expected billable (for flagging only).
- **DI non-billable rows present**: rows where DI status is non-billable.
- **Missing side**:
  - Missing on GM (treat GM total as $0)
  - Missing on DI (treat DI total as $0)

## Screen 4: BAC Drilldown (side-by-side)

Opened by clicking a BAC row.

### Header

- BAC + key totals + Δ
- Flags chips (same as above, BAC-scoped)
- Export controls (see exports section)

### “Products causing variance” panel

Group by **(Brand Token, Product Code)** and show:

- DI sum
- GM sum
- Δ

Clicking a row highlights the related rows in both tables (see match helpers).

### Side-by-side data tables

- **Left**: DI rows
- **Right**: GM rows

Both tables:

- **Grouped by Status** (collapsible group headers).
- Sorted within each status group by **Product Code**.
- Show all relevant fields described in `mappings.md` needed for investigation (not just totals).
- Row-level chips to indicate inclusion/exclusion reasons:
  - Excluded: non-billable / terminated / not-billing
  - Flag: desync / duplicate / brand mismatch, etc.

### Match helpers (requested)

- Hover/highlight behavior:
  - Hovering a row highlights matching rows on the other side that share the same **(Brand Token, Product Code)**.
  - Optionally a “lock highlight” on click.

### Notes + category + variance removal (granular)

Notes and categories apply at:

- **Variance group level**: `(BAC, Brand Token, Product Code)` (primary level for “remove variance”)
- **BAC level** (optional rollup): aggregated notes count + overall category placeholder

#### Add notes

- Allow adding a free-text note to a specific variance group.
- Notes include timestamp and author identifier if available (placeholder if not).

#### Category

- Category field on a variance group.
- Values are placeholder for now; later will be defined in Settings.

#### Remove variance

- Removal is at **(BAC, Brand Token, Product Code)** level.
- If all variance groups in a BAC are removed/ignored, that BAC should disappear from the BAC variance table by default.
- Totals in summary bar must update immediately based on the remaining (non-removed) variance groups.

## Compare Runs (history)

- A “run” represents a comparison between two stored files.
- You can **re-run** a compare and keep the **same run id**.
- Persist:
  - Selected DI file reference
  - Selected GM file reference
  - Run timestamp(s)
  - Computed results (or pointers) including:
    - BAC variance list
    - variance groups per BAC
    - ignored/removed variance groups
    - notes + categories

## Exports

Provide export buttons for:

- BAC variance table
- Per-BAC drilldown
- “Products causing variance” panel

When exporting, prompt for:

- Format: CSV and/or XLSX
- Include/exclude:
  - **Include excluded rows** (rows excluded from totals) option
  - Include raw rows vs summary-only option

---

## Implementation scope of work (detailed checklist)

This section is a step-by-step implementation checklist to fully satisfy the UI/UX plan in this document. Items are intentionally verbose and include suggested acceptance criteria.

### A) Project foundations / architecture

- [ ] **Define app routes + navigation shell**
  - **Implement** a top-level layout with a persistent nav (Welcome, File Library, Compare Runs, Settings).
  - **Ensure** route URLs are stable and descriptive (e.g., `/`, `/files`, `/compare/new`, `/runs`, `/runs/:id`, `/settings`).
  - **Acceptance**:
    - Nav renders on all pages.
    - Route transitions preserve state where appropriate (e.g., table filters in URL query params).

- [ ] **Define data model boundaries (what is persisted vs derived)**
  - **Persist**:
    - Uploaded files + metadata (audit).
    - Compare Runs (selected files, timestamps, status).
    - Per-run variance groups, notes, categories, ignore/removal state.
  - **Derive**:
    - Variances/totals from parsed row data, with ignore state applied.
  - **Acceptance**:
    - Re-loading a run reproduces the same visible results (including notes and ignored groups).

- [ ] **Decide storage strategy for uploaded files**
  - **Initial**: store files on server filesystem under a controlled directory (e.g., `./storage/uploads/`), plus metadata in DB.
  - **Future**: optional S3-compatible storage (keep interface abstraction).
  - **Acceptance**:
    - Files can be downloaded later and hash/size matches original upload.

### B) Database schema (Prisma) — files, runs, results, notes

- [ ] **Create Prisma models for audit + compare history**
  - Suggested entities (names flexible):
    - `UploadedFile`: id, originalName, storedName/path, mimeType, sizeBytes, uploadedAt, uploadedBy (string placeholder), rowCount, schemaType (GM/DI/Unknown), requiredFieldsPresent (json), missingFields (json)
    - `CompareRun`: id, diFileId, gmFileId, createdAt, updatedAt, status (pending/running/complete/failed), lastRunAt, errorMessage (nullable)
    - `VarianceGroup`: id, runId, bac, brandToken, productCode, diAmount, gmAmount, delta, flags (json), isRemoved (bool), createdAt, updatedAt
    - `VarianceNote`: id, varianceGroupId, noteText, createdAt, author (string placeholder)
    - `VarianceCategory`: either a string field on `VarianceGroup` for now, or a separate lookup table later
  - **Include** indexes for:
    - `UploadedFile.uploadedAt`
    - `CompareRun.updatedAt`
    - `VarianceGroup` unique key `(runId, bac, brandToken, productCode)` (or allow duplicates but store aggregated group; recommended: **store aggregated**)
    - `VarianceGroup.runId + bac` for fast drilldown
  - **Acceptance**:
    - Migrations apply cleanly.
    - Run page loads without N+1 query issues.

### C) Parsing + normalization layer (shared backend module)

- [ ] **Implement “required fields exist (case-insensitive)” validation**
  - For each schema (GM vs DI), define required columns (from `mappings.md`).
  - Implement a header normalizer:
    - trim whitespace
    - collapse internal spaces
    - case-fold
  - Provide a diagnostic object listing missing/extra fields.
  - **Acceptance**:
    - Upload rejects “unknown schema” OR stores as Unknown and shows missing-field tooltip (per UI plan).

- [ ] **Implement brand token normalization utilities**
  - Implement normalization rules from `mappings.md`:
    - GM `Product Brand` normalization: `K -> CAD`, permutations (`BCG -> CBG`, etc.), invalid flagging
    - DI `Brand Mix` normalization: same brand rules; DI uses `CAD`
  - Normalize to final allowed set: `C`, `B`, `G`, `BG`, `CAD`, `CB`, `CG`, `CBG`
  - **Acceptance**:
    - Unit tests cover every allowed raw value list + a set of invalid examples.

- [ ] **Implement Product Code parsing utilities**
  - Parse `<vendor>_<product>_<brand>` and `<vendor>_<product>_<brand>_SEC`.
  - Identify `isSecondary` from `_SEC`.
  - Provide structured output and validation:
    - token count 3 or 4 only
    - fourth token (if present) must be `SEC`
    - detect suspicious `_CB_SEC` / `_CG_SEC`
  - **Acceptance**:
    - Unit tests cover valid/invalid codes + suspicious cases.

- [ ] **Implement status normalization utilities**
  - Normalize status values (trim, case-fold).
  - Treat `cancelled` and `canceled` as equivalent.
  - **Acceptance**:
    - Unit tests cover all allowed statuses.

- [ ] **Implement boolean-ish normalization utilities**
  - GM `Is Billing` normalization: truthy (`TRUE`, `BILLING`, `IS BILLING`, `1`) / falsey (`FALSE`, `NOT BILLING`, `NOTBILLING`, `0`, blank).
  - GM `Is Terminated`: `Y` / `N` / blank (blank => `N`).
  - **Acceptance**:
    - Unit tests for all variants.

- [ ] **Implement money handling**
  - Parse numeric fields as **decimal** (avoid floating point drift).
  - Establish a consistent rounding rule for display (e.g., 2 decimals).
  - Compare with tolerance **$0.01**.
  - **Acceptance**:
    - Tests prove that totals and deltas remain stable and comparisons respect tolerance.

- [ ] **Implement date handling**
  - GM effective date: `YYYY-MM-DDT00:00Z` (UTC date boundary).
  - DI effective date: `MM/DD/YYYY` (per current file) — normalize to date.
  - Derived/expected-billable logic for GM desync flag uses **UTC TODAY()** (date boundary).
  - **Acceptance**:
    - Unit tests cover boundary cases (today vs tomorrow).

### D) File ingestion (CSV + Excel)

- [ ] **Implement DI CSV reader**
  - Stream/parse CSV safely (handle large files).
  - Extract required columns + any additional columns needed for drilldown display (the “fields you explained”).
  - **Acceptance**:
    - DI file loads and row count is computed accurately.

- [ ] **Implement GM Excel reader**
  - Read `.xlsx`, `.xlsm`, `.xlsb` (as feasible).
  - Identify the correct worksheet (if multiple) by either:
    - first sheet, or
    - best-match headers containing required fields.
  - Extract required columns + all drilldown fields.
  - **Acceptance**:
    - GM file loads and row count is computed accurately.

- [ ] **Normalize rows into canonical internal row shapes**
  - Create internal types:
    - `GmRowNormalized`
    - `DiRowNormalized`
  - Include:
    - raw field values for table display
    - normalized brand/product/status/billable flags
    - inclusion flags and exclusion reasons (for row-level chips)
  - **Acceptance**:
    - Drilldown can render “raw” tables with flags without re-parsing on the client.

### E) Comparison engine (backend)

- [ ] **Compute inclusion/exclusion flags per row**
  - GM totals include rows where:
    - `Is Billing` is true
    - BAC is not terminated (BAC termination exclusion applies at totals level)
  - GM rows remain available even if excluded (for context).
  - DI totals include rows where status is billable: `live` or `pending cancel`.
  - DI ignores `Terminated date` for inclusion.
  - **Acceptance**:
    - A run produces totals identical to manual spreadsheet checks for a sample set.

- [ ] **Compute BAC-level totals**
  - For each BAC:
    - `gmTotal = sum(Dealer Cost of included GM rows)`
    - `diTotal = sum(Dealer Price of included DI rows)`
    - `delta = diTotal - gmTotal` (or clearly define direction; keep consistent everywhere)
  - Missing BAC on one side => treat missing side total as **$0** and flag “Missing on GM/DI”.
  - Compare totals with **$0.01 tolerance**.
  - **Acceptance**:
    - BAC variance table lists only BACs outside tolerance OR those flagged as terminated/missing/duplicates (per agreed behavior).

- [ ] **Compute variance groups (product drivers)**
  - For each BAC, group by `(Brand Token, Product Code)`:
    - DI uses `(Brand Mix normalized, OemProductCodePopcorn)`
    - GM uses `(Product Brand normalized, Product Code)`
  - For each group, compute DI sum, GM sum, delta.
  - Mark group as “variance group” if abs(delta) > 0.01 OR if flagged as duplicate/terminated/missing/etc.
  - **Acceptance**:
    - “Products causing variance” panel matches group computations.

- [ ] **Detect and attach flags**
  - **Terminated BAC**:
    - If any GM row for a BAC has `Is Terminated` = Y, treat BAC as terminated.
    - Treat as a variance and flag it.
  - **GM duplicates**:
    - Detect duplicates of `(BAC, Product Brand normalized, Product Code)`; include in math anyway; flag.
  - **GM non-billing rows present**:
    - If GM has any `Is Billing` false rows for BAC, flag (even though excluded from totals).
  - **DI non-billable rows present**:
    - If DI has any non-billable statuses for BAC, flag.
  - **GM desync flag**:
    - Compute derived/expected billable (UTC TODAY boundary) and compare to `Is Billing`.
    - If mismatched, flag (do not change totals).
  - **Brand mismatch (optional)**:
    - If GM `Product Brand` disagrees with Product Code’s brand token, flag as data quality issue (from `mappings.md`).
  - **Acceptance**:
    - Flags appear as chips with correct tooltips in BAC table and drilldown.

- [ ] **Apply “remove variance” behavior (per run)**
  - Removal is stored at `(runId, bac, brandToken, productCode)` variance group level.
  - BAC disappears from BAC variance list when all its variance groups are removed/ignored.
  - Summary totals must be computed from non-removed variance groups (and/or recomputed from base totals minus removed groups, as long as consistent).
  - **Acceptance**:
    - Removing a group updates KPIs and tables immediately and persistently.

### F) Backend API surface

- [ ] **File upload endpoints**
  - Endpoint to upload a file, store it, compute metadata (row count, schema type, missing fields).
  - Endpoint to list files (for library table).
  - Endpoint to download a file by id.
  - **Acceptance**:
    - Library displays uploaded files with metadata and downloads work.

- [ ] **Compare run endpoints**
  - Create run: choose DI file id + GM file id.
  - Run compare: execute comparison and persist results (or recompute on-demand with caching).
  - Get run summary: BAC variance list with filters.
  - Get BAC drilldown: raw normalized rows for DI + GM + variance groups + flags.
  - Update run artifacts:
    - Add/edit category
    - Add note
    - Remove/unremove variance group
  - **Acceptance**:
    - All UI actions have corresponding API support.

### G) Frontend implementation (screens + components)

- [ ] **Welcome page**
  - Placeholder content + two CTAs.

- [ ] **File Library page**
  - Table with columns specified in UI plan.
  - Upload modal/area with progress.
  - Schema badge + missing-field tooltip.
  - Actions: download.
  - (Optional later) preview/delete.
  - **Acceptance**:
    - Uploading a file shows up in the table with correct metadata.

- [ ] **New Compare page**
  - Two selectors (DI, GM), each can pick existing file or upload new.
  - Compare button disabled until both valid.
  - Create/run compare and navigate to results.
  - **Acceptance**:
    - Cannot compare with only one file.

- [ ] **BAC variance table page**
  - KPI summary bar.
  - Table with sort/filter/search.
  - Flags as chips with tooltips.
  - “Show removed” toggle.
  - Click row opens BAC drilldown.
  - Export button(s).
  - **Acceptance**:
    - Table shows only BACs with issues by default.

- [ ] **BAC drilldown page**
  - Header: totals, delta, flags, export.
  - “Products causing variance” panel grouped by `(Brand, ProductCode)` with DI/GM/delta.
  - Side-by-side tables:
    - Left DI / right GM
    - Grouped by status
    - Sorted by product code within groups
    - Show required fields per `mappings.md`
  - Match helpers:
    - Hovering a row highlights matching rows in the other table by `(Brand, ProductCode)`
    - Optional “lock highlight” on click
  - Notes + category + remove variance at group level.
  - **Acceptance**:
    - User can quickly visually match rows and identify mismatches.

- [ ] **Compare Runs page**
  - List runs (most recent first), with file names, created/last-run timestamps, status.
  - Open a run to view its BAC variance table.
  - “Re-run” button keeps same run id but updates results and timestamps.
  - **Acceptance**:
    - Re-run updates results without creating a new run id.

- [ ] **Settings page (placeholder)**
  - Placeholder only; later will host category configuration.

### H) Export implementation

- [ ] **Export BAC variance table**
  - Export summary rows.
  - Prompt:
    - CSV/XLSX
    - include excluded rows (if applicable for the export scope)
    - include removed/ignored variances toggle

- [ ] **Export BAC drilldown**
  - Summary-only or include raw rows.
  - Option to include excluded rows.
  - Include notes/categories and flags.

- [ ] **Export “Products causing variance”**
  - Export grouped view, plus optionally include underlying raw rows.

- [ ] **Acceptance criteria for exports**
  - Exports match on-screen numbers (respecting removed groups).
  - UTF-8 safe and spreadsheet-friendly formatting.

---

## Testing plan (build in parallel; extensive E2E)

Testing should be developed alongside implementation (not after), with a strong emphasis on end-to-end coverage of the critical user journeys.

### 1) Unit tests (fast, deterministic)

- [ ] **Normalization utilities**
  - Brand normalization (GM + DI).
  - Product code parsing + `_SEC` logic + suspicious cases.
  - Status normalization.
  - Boolean normalization (`Is Billing`, `Is Terminated`).
  - Money parsing + tolerance comparisons.
  - Date parsing + UTC TODAY boundary behavior.

- [ ] **Comparison engine**
  - Row inclusion rules for GM and DI.
  - BAC totals and missing-side-as-$0 handling.
  - Variance group aggregation.
  - Duplicate detection.
  - Termination behavior (any row terminated => BAC terminated, flagged as variance).
  - Removal/ignore math updates.

### 2) Integration tests (API + DB)

- [ ] **File upload API**
  - Upload DI CSV and confirm:
    - stored file exists
    - metadata stored (row count, schema type)
    - download returns identical bytes
  - Upload GM XLSX and confirm same.

- [ ] **Compare run API**
  - Create run, run compare, fetch BAC variance list.
  - Fetch BAC drilldown payload shape and verify it includes:
    - DI rows
    - GM rows
    - variance groups
    - flags
  - Update mutations:
    - add note
    - set category
    - remove/unremove variance group
  - Verify persistence across reload.

### 3) E2E tests (Playwright; user flows)

Build these in parallel with the UI so regressions are caught early.

- [ ] **E2E: Upload + library listing**
  - Upload DI and GM files.
  - Verify library shows file rows with name/type/date/size/row count/schema.
  - Download and verify file is not empty.

- [ ] **E2E: New compare requires both files**
  - Open New Compare.
  - Select only one file: Compare button disabled.
  - Select both: Compare enabled.

- [ ] **E2E: Compare results BAC table**
  - Run compare.
  - Verify KPI summary renders and table lists BACs with variances.
  - Verify filters work (search BAC, toggle flags).

- [ ] **E2E: Drilldown side-by-side + match helpers**
  - Open a BAC drilldown.
  - Verify two tables render, grouped by status.
  - Hover a DI row:
    - matching GM rows highlight by `(Brand, ProductCode)`.
  - Hover a GM row:
    - matching DI rows highlight.

- [ ] **E2E: Notes + category + remove variance**
  - Add note to a variance group; refresh; note persists.
  - Set category; refresh; category persists.
  - Remove a variance group:
    - group disappears (or shows removed state)
    - KPIs update
  - Remove all groups in a BAC:
    - BAC disappears from BAC variance table (default view)
    - “Show removed” reveals it.

- [ ] **E2E: Compare runs history + rerun**
  - Navigate to Compare Runs.
  - Open an existing run.
  - Click re-run:
    - run id remains the same
    - timestamps/results update

- [ ] **E2E: Exports**
  - Export BAC table.
  - Export BAC drilldown (summary-only and include raw rows).
  - Verify exports download successfully and contain expected headers.

### 4) Test data strategy

- [ ] **Create minimal fixture files**
  - Tiny DI CSV and GM XLSX with:
    - 1 BAC matching totals
    - 1 BAC with variance
    - 1 BAC missing on one side
    - 1 BAC terminated
    - 1 BAC with GM duplicates
    - 1 BAC with GM desync flag scenario
  - Use these fixtures for unit/integration/E2E consistently.

### 5) CI and reliability (recommended)

- [ ] Run unit + integration tests on every PR/push.
- [ ] Run E2E tests in CI (headless) with trace/video on failure.
- [ ] Keep E2E suite stable by:
  - avoiding timing flakiness
  - waiting on explicit UI states
  - seeding deterministic test data

---

## Definition of Done (release readiness)

This section defines what “complete” means for the first production-ready iteration of this app, beyond simply “it works on my machine.”

### 1) Functional completeness

- [ ] **All screens in UI plan are implemented**
  - Welcome, File Library, New Compare, BAC variance table, BAC drilldown, Compare Runs, Settings placeholder.
- [ ] **All required user actions work end-to-end**
  - Upload files → browse library → select DI+GM → compare → view BAC variances → drilldown → notes/categories → remove/unremove variance groups → export.
- [ ] **Variance logic matches `mappings.md`**
  - Inclusion/exclusion rules, termination behavior, missing BAC behavior, duplicates included in math, tolerance $0.01, desync flag (without changing totals).
- [ ] **Removed variance group behavior matches spec**
  - Remove at `(BAC, Brand Token, Product Code)`.
  - BAC disappears from variance list when all groups removed (unless “Show removed” is enabled).
  - KPI totals update immediately and persist across reload.

### 2) Data correctness / reconciliation confidence

- [ ] **Deterministic totals**
  - The same inputs produce the same totals and deltas on re-run.
  - Money is handled using decimal-safe math (no floating drift).
- [ ] **Clear direction of delta**
  - App consistently defines and labels delta (e.g., Δ = DI − GM) across tables, exports, tooltips, and APIs.
- [ ] **Explainability**
  - For every BAC-level variance, the UI can surface the contributing variance groups (Brand+ProductCode) that explain the delta.
- [ ] **Flag accuracy**
  - Terminated flag triggers if any GM row in the BAC indicates termination.
  - Duplicate detection is correct for `(BAC, normalized Product Brand, Product Code)`.
  - Desync flag triggers when `Is Billing` differs from derived/expected billable using UTC `TODAY()` boundary.

### 3) Performance targets (initial)

Set clear, pragmatic targets for the first release; adjust once real usage is observed.

- [ ] **Upload performance**
  - DI CSV up to ~50k rows uploads and parses within an acceptable time (goal: < 10–20s on typical infra).
  - GM Excel up to ~50k rows parses within an acceptable time (goal: < 20–40s depending on format).
- [ ] **Compare performance**
  - Compare run completes within a reasonable time for typical files (goal: < 30–60s for 50k rows combined).
- [ ] **UI responsiveness**
  - BAC variance table remains interactive when listing hundreds/thousands of BACs (virtualization/pagination as needed).
  - BAC drilldown tables remain usable for large BACs (virtualization + grouping without locking the browser).

### 4) Reliability / failure handling UX

- [ ] **User-friendly validation errors**
  - Unknown schema: show missing required columns and which schema was expected.
  - Parsing errors: show a concise message plus a “details” expander.
  - Partial failures: clearly indicate what succeeded vs failed.
- [ ] **Retry paths**
  - Failed compare runs can be re-run.
  - Upload failures can be retried without corrupting the library.
- [ ] **Idempotency / safe retries**
  - Re-submitting the same request does not create duplicate rows unintentionally (or duplicates are handled explicitly).

### 5) Security basics (first release)

No roles for now, but still keep fundamental hygiene.

- [ ] **Upload hardening**
  - Restrict upload size (configurable max).
  - Validate file extension AND attempt to validate actual content type.
  - Store uploads outside public web root.
- [ ] **Safe downloads**
  - Downloads are served via controlled endpoints (no direct path traversal).
- [ ] **Secrets management**
  - No secrets committed to repo.
  - Env validation for required secrets/variables.
- [ ] **PII considerations**
  - If files contain sensitive data, avoid logging raw row data; log counts and ids instead.

### 6) Observability (logs + metrics)

- [ ] **Structured logging for key events**
  - File uploaded, file parsed, run started, run completed, run failed.
  - Include file ids, run id, row counts, elapsed times.
- [ ] **Error logging**
  - Capture stack traces server-side.
  - Client displays friendly message with a correlation id if available.
- [ ] **Basic metrics (at least timers)**
  - Upload parse duration, compare duration, export generation duration.

### 7) Testing gates (must pass)

- [ ] **Unit test suite passes**
  - Parsing/normalization/comparison logic has strong coverage.
- [ ] **Integration test suite passes**
  - Upload, download, run creation, compare, drilldown APIs, persistence, mutations.
- [ ] **E2E suite passes**
  - Critical user journeys described in the testing plan (upload → compare → drilldown → remove variance → export).
- [ ] **Regression fixtures are committed**
  - Minimal DI+GM fixtures exist to reproduce: missing-side variance, termination variance, duplicates variance, desync variance, credits/negative values.

### 8) Operational readiness

- [ ] **Local dev instructions**
  - `README` (or equivalent) includes how to run DB, migrations, dev server, and tests.
- [ ] **Deployment readiness**
  - App runs via Docker compose (or documented deployment steps).
  - Persistent volume(s) configured for uploaded file storage.
- [ ] **Data retention policy (initial)**
  - Decide whether files/runs are kept indefinitely or pruned after N days (even if pruning is “later”).




