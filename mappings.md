# Mappings (BAC, Brand Codes, Product Codes)

This document captures the agreed rules and terminology for parsing **GM Billing** product lines (and related brand/account hierarchy context). All matching/lookup should be **case-insensitive**, with normalization to **uppercase** where applicable.

## BAC

- **Definition**: `BAC` is the (non-unique) identifier GM assigns to accounts.
- **Format**: Always **6 numeric digits**; may include **leading zeros**.
- **Storage**: Treat/store as a **string** to preserve formatting.
- **Meaning**: A single `BAC` represents a **grouping that includes multiple brands/stores**.
- **Brand uniqueness**: A **brand code is unique per BAC** (no duplicate store entries of the same brand code under one BAC).

## Brand codes

Normalize brand codes to **uppercase**.

### Allowed values (exhaustive)

- `C` — Chevrolet
- `B` — Buick
- `G` — GMC
- `BG` — Combined Buick/GMC
- `CAD` — Cadillac
- `CBG` — Combined Chevrolet/Buick/GMC
- `CB` — Combined Chevrolet/Buick
- `CG` — Combined Chevrolet/GMC

### Mutual exclusivity

- `B`, `G`, and `BG` are **mutually exclusive** within a single BAC:
  - A BAC may contain **either** a dedicated Buick (`B`), **or** a dedicated GMC (`G`), **or** a combined Buick/GMC (`BG`) store.
  - A BAC will **not** contain separate `B` and `G` stores simultaneously.

## Primary vs Secondary (store hierarchy context)

There is a hierarchy of accounts in the GM program:

- `C` (Chevrolet): if it exists in a BAC, it is always **primary**.
- `B` (Buick): if `C` exists in the BAC, `B` is **secondary**; if no `C`, `B` is **primary**.
- `G` (GMC): if `C` exists in the BAC, `G` is **secondary**; if no `C`, `G` is **primary**.
- `BG` (Buick/GMC combined): similar to `B`/`G` rules; if no `C`, `BG` is **primary**; if `C` exists, `BG` is **secondary**.
- `CAD` (Cadillac): if there is no `C`, `B`, `G`, or `BG`, then `CAD` is **primary**; if any other brand exists, `CAD` is **secondary**.
- `CBG` (Chevrolet/Buick/GMC combined): always **primary**.

Notes:

- A BAC may have **more than one primary store** and/or **more than one secondary store**.
  - Example (multiple primaries): a BAC contains both `CBG` and `C` (two separate primary stores).
  - Example (multiple secondaries): a BAC contains `C` (primary) plus `BG` and `CAD` (both secondary).

## GM Billing Product Code mapping

### Columns (case-insensitive selection)

- `BAC`: grouping identifier (see rules above)
- `Product Code`: the product identifier for a row/product
- `Product Selection`: GM’s human-readable product name (display only)
- `Product Brand`: brand/store indicator for what brand the product is applied to (authoritative for store/brand)
- `Is Terminated`: whether the dealer/BAC is opted out of the program
- `IsTerminatedDate`: date the BAC was opted out/terminated
- `Last Updated Date`: date/time this product row was last updated

### Product Code structure

Product codes are underscore-delimited and follow one of these formats:

1. **Primary product**
   - `<vendorcode>_<productcode>_<brandcode>`
   - Example: `DI_P1_C`
2. **Secondary product**
   - `<vendorcode>_<productcode>_<brandcode>_SEC`
   - Example: `DI_P1_CAD_SEC`

Rules:

- Underscores are **strictly delimiters** (no token contains underscores).
- Brand code token (3rd segment) is expected to be one of the **allowed values** listed above, but **is not authoritative** if it conflicts with `Product Brand` (see below).
- The only position/suffix value currently supported is **`SEC`**.
- **Primary vs secondary for a product line is determined solely by the presence/absence of the `_SEC` suffix**:
  - 3 tokens ⇒ primary
  - 4 tokens ending in `SEC` ⇒ secondary

### Combined brand constraints

- `CB` and `CG` represent **combined primary stores** and should **never** have a secondary product.
  - Practically: Product Codes containing `_CB_SEC` or `_CG_SEC` should be treated as invalid/suspicious.

## GM Billing `Product Brand` normalization (authoritative brand/store)

`Product Brand` indicates **what brand store the product was applied to** and is the **source of truth** for store/brand.

### Allowed raw values (case-insensitive)

The GM file may contain any of the following raw values (contiguous strings):

- `C`
- `B`
- `G`
- `BG`
- `K` (Cadillac)
- `BC` (equivalent to `CB`)
- `CB`
- `CG`
- `BCG` (equivalent to `CBG`)
- `CBG`

### Normalization rules

Normalize case-insensitively to uppercase, then:

1. Map `K` ⇒ `CAD`
2. For combined brand permutations, normalize ordering:
   - Any permutation of `B`+`G` ⇒ `BG` (e.g., `GB` ⇒ `BG`)
   - Any permutation of `B`+`C` ⇒ `CB` (e.g., `BC` ⇒ `CB`)
   - Any permutation of `C`+`G` ⇒ `CG` (e.g., `GC` ⇒ `CG`)
   - Any permutation of `B`+`C`+`G` ⇒ `CBG` (e.g., `BCG` ⇒ `CBG`, `GBC` ⇒ `CBG`)
3. After normalization, the value must be one of:
   - `C`, `B`, `G`, `BG`, `CAD`, `CB`, `CG`, `CBG`

If a value cannot be normalized into this set, **flag it as invalid** (it should not occur).

### `Product Brand` vs Product Code brand token

- `Product Brand` is the **store/brand applied to** and is the **authoritative** brand.
- The `Product Code` brand token represents the **version/variant** of the product and may occasionally have the brand token wrong/out-of-sync.
- If `Product Brand` (normalized) disagrees with the brand token parsed from `Product Code`, treat it as a **data quality issue**:
  - Use `Product Brand` for store/brand classification.
  - Keep the mismatch available for reporting/flagging later.

## GM Billing termination fields (BAC-level)

Termination is **per BAC**: if a BAC is terminated, **all brands/stores under that BAC are terminated**.

### `Is Terminated`

- Possible values: `Y`, `N`, or blank.
- Treat blank as `N`.

### Exclusion rule

- Terminated BACs should be **excluded from comparison/variance totals**.
- Do **not** drop terminated rows entirely; the termination status is important context to surface in results.

### Date formats (examples observed)

- `IsTerminatedDate`: date like `12/11/2025`
- `Last Updated Date`: date/time like `11/24/2025 6:48:40 PM`

## GM Billing billing/amount fields

### `Dealer Cost`

- This is the value to **sum** in the GM file for variance/pricing totals.
- Always numeric.
- May be negative; negative values represent **credits** and reduce totals.

### GM totals (variance basis)

For GM-vs-DI variance comparisons, compute a **BAC-level total**:

- For each `BAC`, sum `Dealer Cost` across **all rows in that BAC** that are included in totals (see inclusion/exclusion rules below).
- This BAC-level sum will be compared to the DI billing file’s BAC-level sum later.

### `Is Billing`

This field is the **source of truth** for whether GM considers the row billable.

- Raw values may appear as (case-insensitive, spaces ignored):
  - Truthy: `TRUE`, `BILLING`, `IS BILLING`, `1`
  - Falsey: `FALSE`, `NOT BILLING`, `NOTBILLING`, `0`, blank
- Rows with `Is Billing` = false are **excluded from comparison/variance totals**, but should **remain in the dataset** for context/diagnostics later.

### `Product Status`

Allowed values (case-insensitive):

- `pending live` (not live, should not be billed; subject to effective date override)
- `live` (live, should be billed; subject to effective date override)
- `pending cancel` (still live, will be cancelled soon; should be billed; subject to effective date override)
- `cancelled` / `canceled` (not live; should not be billed; subject to effective date override)

### `Effective Date` (and selection date note)

- `Product Selection Date` and `Effective Date` exist, but for our purposes we will use **`Effective Date` only**.
- Format observed: ISO string like `2025-11-30T00:00Z` (time is always `00:00Z`).

### DPE override / desync context (future flagging)

When products are uploaded to GM’s portal (DPE) via API, `Product Status` and dates are sent, but **DPE can override status based on dates**, which can cause desync between systems. Examples provided:

- Send `pending live` but effective date is before “today” ⇒ DPE may mark it `live` and `Is Billing` = true.
- Send `live` but effective date is in the future ⇒ DPE may mark it `pending live` and `Is Billing` = false.
- Send `pending cancel` and effective date is in the past ⇒ DPE may mark it `cancelled`.
- Send `cancelled` and effective date is in the future ⇒ DPE may mark it `pending cancel`.

For reconciliation:

- **Always trust `Is Billing`** for totals (this is what GM bills against).
- We may compute a **derived/expected billable** value from `Product Status` + `Effective Date` purely to **flag potential desync**, not to change totals.

#### Derived/expected billable logic (for desync flag only)

Use `Effective Date` compared against **UTC `TODAY()`** (date boundary in UTC).

- If `Product Status` is `pending live` or `live`: expected billable iff `Effective Date` is **before** `TODAY()`.
- If `Product Status` is `pending cancel` or `cancelled`/`canceled`: expected billable iff `Effective Date` is **greater than** `TODAY()`.

## GM Billing uniqueness expectations (variance driver)

For a given BAC, there should only be **one** instance of a given product code per applied brand/store:

- Expected uniqueness: `(BAC, normalized Product Brand, Product Code)` is unique.
- If duplicates occur, that is a data problem. We should **still include all rows in summing math**, but the duplicates will likely cause variances and should be **flagged for investigation**.

## Data quality note (future research)

There may be cases where `_SEC` was applied by accident (e.g., a primary store’s product marked as secondary, or the reverse). For now:

- **Do not infer/correct** primary/secondary using hierarchy rules.
- **Trust `_SEC`** for primary/secondary classification.
- Revisit later to add diagnostics/flagging for suspicious patterns.

---

## DI Billables CSV mapping

### File

- Root file observed in this repo: `DI Billables.csv`

### Columns we care about (case-insensitive selection)

- `Id`: DI order product id (key)
- `BAC`: same BAC concept as GM (6-digit numeric string)
- `Account`: Salesforce account name (display)
- `Status`: same status names as GM (case-insensitive)
- `Dealer Price`: DI price used to compare against GM totals
- `Brand Mix`: DI brand token (same brand rules as GM; uses `CAD` instead of `K`)
- `effectiveDate`: DI effective date (use this field only; ignore selection date)
- `Account ID as Id`: Salesforce account id (display/diagnostics)
- `OemProductCodePopcorn`: DI’s GM-equivalent product code (**source of truth**)
- `Product Name`: friendly name for product (display)

### Product code fields (DI)

- `OemProductCodePopcorn` is the **only** product code field we should use for matching/drilldowns.
- The following fields exist but should be ignored for product-code logic:
  - `DI Product Code` (internal DI code, not needed for GM reconciliation)
  - `OEM_Product_Code_Formula__c` (Salesforce-derived formula; not reliable)
  - `OEM Product Code_RAW` (not reliable)
  - `popcornproductcodebrand`, `popcornproductcodevendercode`, `popcornproductcodeposition`, `popcornisprimaryorsecondary` (derivative/build fields)

### Brand token (DI)

- `Brand Mix` is the DI brand/store token and is the **source of truth** for store/brand on the DI side.
- Apply the same normalization/allowed-brand rules as GM brand tokens (DI uses `CAD` rather than `K`).

### DI billable inclusion rule

DI billability is determined **only by `Status`**:

- Billable statuses: `live`, `pending cancel` (case-insensitive)
- Non-billable statuses: `pending live`, `cancelled` / `canceled` (case-insensitive)

Rows that are non-billable should be excluded from DI totals, but can remain available as context.

### DI totals (variance basis)

For GM-vs-DI variance comparisons, compute a **BAC-level total** on the DI side:

- For each `BAC`, sum `Dealer Price` across DI rows that are billable by `Status`.
- `Dealer Price` is always numeric and may be negative (credits).
- Compare totals using a tolerance of **$0.01**.

### Fields to ignore for DI totals logic

- `Terminated date`: ignore on the DI side (do not use for inclusion/exclusion).


