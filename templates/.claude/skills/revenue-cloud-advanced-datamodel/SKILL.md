---
name: revenue-cloud-data-model
description: Reference for the Salesforce Revenue Cloud usage and billing data model as used on previous packages. This list is non-exhaustive, but these fields should be always preferred when possible. Use this skill when writing GraphQL queries or DML against Product2, Asset, UsageResource, ProductUsageGrant, ProductUsageResource, UnitOfMeasure(Class), TransactionJournal, UsageEntitlementBucket, UsageSummary, TransactionUsageEntitlement, RateCard, RateCardEntry, RateAdjustmentByTier, CreditMemo, Invoice, Contract, Account.
version: 1.0.0
---

# Revenue Cloud — Usage & Billing Data Model

A consolidated reference for Salesforce SObjects used on past solutions. List is non extensive but these fields should always be preferred. Tables are organized by domain — product catalog, entitlement runtime, consumption logging, rate cards, billing, customer context, and configuration — independent of which app calls them.

All field-level facts come from queries/mutations in the React UIBundles and from the custom-object metadata under `force-app/main/default/objects`. Lookup relationship names (used when traversing in GraphQL) are listed beside their FK fields.

---

## 1. Product Catalog & Setup

Establishes which products are usage-enabled and the unit of measure they are tracked in.

### `Product2`

| Field            | Type     | Notes                                                                                                                                                                                              |
| ---------------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Id`             | ID       |                                                                                                                                                                                                    |
| `Name`           | String   |                                                                                                                                                                                                    |
| `ProductCode`    | String   | Stable external code                                                                                                                                                                               |
| `UsageModelType` | Picklist | `Anchor` / `Pack` / `Commit` — flags a product as usage-enabled. `ne: null` is the standard filter to pick out usage products. Must match `ProductUsageGrant.UsageModelType` exactly (gotcha #203) |
| `IsAssetizable`  | Boolean  | Required `true` for usage products — filter clause `IsAssetizable: { eq: true }`                                                                                                                   |

### `UnitOfMeasureClass`

| Field                    | Type                   | Notes                                                                             |
| ------------------------ | ---------------------- | --------------------------------------------------------------------------------- |
| `Id`                     | ID                     |                                                                                   |
| `Name`                   | String                 |                                                                                   |
| `Code`                   | String                 | Optional identifier                                                               |
| `Type`                   | Picklist               | `Usage` / `Token` / `Currency` — the UoM's class must match its parent class type |
| `Status`                 | Picklist               | `Draft` → `Active` lifecycle                                                      |
| `DefaultUnitOfMeasureId` | Lookup → UnitOfMeasure | Set during activation, after the UoM exists                                       |

### `UnitOfMeasure`

| Field                  | Type                                                    | Notes                                 |
| ---------------------- | ------------------------------------------------------- | ------------------------------------- |
| `Id`                   | ID                                                      |                                       |
| `Name`                 | String                                                  |                                       |
| `UnitCode`             | String                                                  | Identifier code (e.g., "GB", "TOKEN") |
| `Description`          | String                                                  |                                       |
| `Type`                 | Picklist                                                | Must equal the parent class's `Type`  |
| `Status`               | Picklist                                                | Can be created directly as `Active`   |
| `UnitOfMeasureClassId` | Lookup → UnitOfMeasureClass (rel: `UnitOfMeasureClass`) |                                       |

### `UsageResource`

The catalog-side definition of a meterable resource (lookup key for transactions and summaries).

| Field                          | Type                                                    | Notes                                                                     |
| ------------------------------ | ------------------------------------------------------- | ------------------------------------------------------------------------- |
| `Id`                           | ID                                                      |                                                                           |
| `Name`                         | String                                                  |                                                                           |
| `Code`                         | String                                                  | **The official lookup key — gotcha #204: lookups use `Code`, not `Name`** |
| `Category`                     | Picklist                                                | Mirrors `UnitOfMeasureClass.Type`                                         |
| `Status`                       | Picklist                                                | `Draft` → `Active` lifecycle                                              |
| `DefaultUnitOfMeasureId`       | Lookup → UnitOfMeasure (rel: `DefaultUnitOfMeasure`)    |                                                                           |
| `UnitOfMeasureClassId`         | Lookup → UnitOfMeasureClass (rel: `UnitOfMeasureClass`) |                                                                           |
| `UsageResourceBillingPolicyId` | Lookup → UsageResourceBillingPolicy                     | Aggregation policy                                                        |
| `UsageDefinitionProductId`     | Lookup → Product2 (rel: `UsageDefinitionProduct`)       | The owning product                                                        |

### `UsageResourceBillingPolicy`

| Field  | Type   | Notes                                                    |
| ------ | ------ | -------------------------------------------------------- |
| `Id`   | ID     |                                                          |
| `Name` | String | Picked in the Product Setup form as "Aggregation Policy" |

### `ProductUsageResource`

Bridges a `Product2` to a `UsageResource` with an effective date and lifecycle status.

| Field                | Type                                          | Notes                                                                      |
| -------------------- | --------------------------------------------- | -------------------------------------------------------------------------- |
| `Id`                 | ID                                            |                                                                            |
| `Status`             | Picklist                                      | `Draft` → `Active`. Must be `Active` before `ProductUsageGrant` activation |
| `EffectiveStartDate` | DateTime                                      | ISO 8601 required on create                                                |
| `ProductId`          | Lookup → Product2                             |                                                                            |
| `UsageResourceId`    | Lookup → UsageResource (rel: `UsageResource`) |                                                                            |

### `ProductUsageGrant`

The grant template — quantity of resource units granted per product unit purchased.

| Field                      | Type                                                    | Notes                                                                                                   |
| -------------------------- | ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `Id`                       | ID                                                      |                                                                                                         |
| `Label`                    | String                                                  | Capped at ~40 chars by the form                                                                         |
| `Quantity`                 | Number                                                  | Grant amount                                                                                            |
| `Type`                     | Picklist                                                | `Commit` (when `UsageModelType=Commit`) / `Grant` otherwise                                             |
| `Status`                   | Picklist                                                | `Draft` → `Active`. Activate **after** `ProductUsageResource` is Active (separate transaction — gotcha) |
| `OverageChargeable`        | Picklist                                                | `'Yes'` / `'No'` — NOT a boolean (gotcha)                                                               |
| `UsageModelType`           | Picklist                                                | Must match `Product2.UsageModelType` exactly (gotcha #203)                                              |
| `EffectiveStartDate`       | DateTime                                                |                                                                                                         |
| `ValidityPeriodUnit`       | Picklist                                                | `Month` / `Year` / blank (= "Does not Expire")                                                          |
| `ValidityPeriodTerm`       | Integer                                                 | Numeric term paired with the unit                                                                       |
| `DrawdownOrder`            | Number                                                  | Order in which grants are consumed                                                                      |
| `UsageDefinitionProductId` | Lookup → Product2 (rel: `UsageDefinitionProduct`)       |                                                                                                         |
| `ProductUsageResourceId`   | Lookup → ProductUsageResource                           |                                                                                                         |
| `UnitOfMeasureId`          | Lookup → UnitOfMeasure (rel: `UnitOfMeasure`)           |                                                                                                         |
| `UnitOfMeasureClassId`     | Lookup → UnitOfMeasureClass (rel: `UnitOfMeasureClass`) |                                                                                                         |

---

## 2. Asset & Entitlement Runtime

After Order activation, the platform creates the runtime entitlement chain. **Never DML-insert `UsageEntitlementAccount` (gotcha #202)** — query the official pattern after the 10–30s post-activation delay.

### `Asset`

Sold instance of a Product2 to an Account — the join point between catalog and entitlement.

| Field                | Type                     | Notes                                                                                  |
| -------------------- | ------------------------ | -------------------------------------------------------------------------------------- |
| `Id`                 | ID                       |                                                                                        |
| `Name`               | String                   |                                                                                        |
| `AccountId`          | Lookup → Account         |                                                                                        |
| `Product2`           | Lookup (rel: `Product2`) | Used in filters like `Product2: { UsageModelType: { ne: null } }` to find usage assets |
| `LifecycleStartDate` | DateTime                 | Drives "active" status display                                                         |
| `LifecycleEndDate`   | DateTime                 |                                                                                        |

### `TransactionUsageEntitlement`

Bridge between an Asset and the buckets the platform spins up for it.

| Field       | Type                              | Notes                                                                                        |
| ----------- | --------------------------------- | -------------------------------------------------------------------------------------------- |
| `Id`        | ID                                |                                                                                              |
| `AccountId` | Lookup → Account (rel: `Account`) | Used as the multi-hop filter root: `TransactionUsageEntitlement: { AccountId: { eq: ... } }` |
| `AssetId`   | Lookup → Asset                    | The join key when grouping buckets back to assets                                            |

### `UsageEntitlementBucket`

The live, per-period entitlement balance.

| Field                         | Type                                             | Notes                                                                                                                                           |
| ----------------------------- | ------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `Id`                          | ID                                               |                                                                                                                                                 |
| `Name`                        | String                                           |                                                                                                                                                 |
| `BucketBalance`               | Number                                           | Remaining units                                                                                                                                 |
| `TotalConsumedEntitlement`    | Number                                           | Cumulative consumed                                                                                                                             |
| `CompletedRollovers`          | Number                                           | Carryover from prior periods                                                                                                                    |
| `EffectiveStartDateTime`      | DateTime                                         | Period start                                                                                                                                    |
| `BucketBalanceUom`            | Lookup → UnitOfMeasure (rel: `BucketBalanceUom`) | Read `BucketBalanceUom { Name { value } }`                                                                                                      |
| `TransactionUsageEntitlement` | Lookup (rel: `TransactionUsageEntitlement`)      | Filter via `TransactionUsageEntitlement: { AccountId: { eq: ... } }`; also traverse to read `AssetId { value }` or `Account { Name { value } }` |

`grant` for a bucket = `BucketBalance + TotalConsumedEntitlement` (no native `GrantAmount` field on this object).

---

## 3. Consumption Logging

### `TransactionJournal`

The per-event consumption log. **Is DML-creatable** when `UsageType='UsageManagement'` (ADR-009 confirms the gotcha #334 "not insertable" applies only to GL-path TJs).

| Field                   | Type                                                  | Notes                                                                                                 |
| ----------------------- | ----------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `Id`                    | ID                                                    |                                                                                                       |
| `Quantity`              | Number                                                | Units consumed in this event                                                                          |
| `QuantityUnitOfMeasure` | Lookup → UnitOfMeasure (rel: `QuantityUnitOfMeasure`) | Read `QuantityUnitOfMeasure { Name { value } }`                                                       |
| `ActivityDate`          | DateTime                                              | **Schema is `DateTime` despite the name — filter values must be full ISO `YYYY-MM-DDT00:00:00.000Z`** |
| `UsageType`             | Picklist                                              | `UsageManagement` for the consumption path                                                            |
| `AccountId`             | Lookup → Account (rel: `Account`)                     | Read `Account { Name { value } }`                                                                     |
| `UsageResource`         | Lookup (rel: `UsageResource`)                         | Traverse to `Name { value }` and to `UsageDefinitionProduct { Name { value } }` for the product label |
| `CreatedDate`           | DateTime                                              |                                                                                                       |

---

## 4. Usage Summary & Overage Billing

`UsageSummary` is the platform-rolled-up summary that drives overage billing. `processConsumptionOverages` evaluates these and creates `UsageBillingPeriodItem` (Status=`ReadyForInvoicing`) which `InvoiceBatchRun` later invoices.

### `UsageSummary`

| Field           | Type                                | Notes                                                                                                                                           |
| --------------- | ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `Id`            | ID                                  |                                                                                                                                                 |
| `Status`        | Picklist                            | `New`, `UsageSummaryInProgress`, `RatableSummaryComplete`, `LiableSummaryComplete`, `RatedUsageSummaryComplete`, `DrawdownComplete`, `Inactive` |
| `OverageUnits`  | Number                              | Units past the entitlement for the period                                                                                                       |
| `Uom`           | Lookup → UnitOfMeasure (rel: `Uom`) | Read `Uom { Name { value } }`                                                                                                                   |
| `Asset`         | Lookup (rel: `Asset`)               | Read `Asset { Name { value } Product2 { Name { value } } }`                                                                                     |
| `AccountId`     | Lookup → Account (rel: `Account`)   |                                                                                                                                                 |
| `StartDateTime` | DateTime                            | Billing period start                                                                                                                            |
| `EndDateTime`   | DateTime                            | Billing period end                                                                                                                              |
| `CreatedDate`   | DateTime                            | Latest summary per asset is found via `orderBy: { CreatedDate: { order: DESC } }` then de-duplicating by asset                                  |

### `UsageBillingPeriodItem` _(reference only — not queried by the React app)_

| Field    | Type     | Notes                                                             |
| -------- | -------- | ----------------------------------------------------------------- |
| `Status` | Picklist | `ReadyForInvoicing` flips it into the next `InvoiceBatchRun` pass |

---

## 5. Rate Cards

### `RateCard`

| Field              | Type                                  | Notes                                                                                                                                                 |
| ------------------ | ------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Id`               | ID                                    |                                                                                                                                                       |
| `Name`             | String                                |                                                                                                                                                       |
| `Type`             | Picklist                              | `Base` (flat rate per entry) / `Tier` (tiered adjustments per entry)                                                                                  |
| `EffectiveFrom`    | DateTime                              | Future = derived `draft`; past `EffectiveTo` = derived `archived`; otherwise `active` (status is client-derived from these dates, not a stored field) |
| `EffectiveTo`      | DateTime                              |                                                                                                                                                       |
| `LastModifiedDate` | DateTime                              |                                                                                                                                                       |
| `LastModifiedBy`   | Lookup → User (rel: `LastModifiedBy`) | Read `LastModifiedBy { Name { value } }`                                                                                                              |

### `RateCardEntry`

| Field                   | Type                                                      | Notes                                         |
| ----------------------- | --------------------------------------------------------- | --------------------------------------------- |
| `Id`                    | ID                                                        |                                               |
| `Rate`                  | Number(precision 3)                                       |                                               |
| `Status`                | Picklist                                                  | `Draft` / `Active`                            |
| `RateNegotiation`       | Picklist                                                  | `NonNegotiable` / `Negotiable`                |
| `EffectiveFrom`         | DateTime                                                  |                                               |
| `EffectiveTo`           | DateTime                                                  |                                               |
| `RateCardId`            | Lookup → RateCard                                         |                                               |
| `ProductId`             | Lookup → Product2 (rel: `Product`)                        | Read `Product { Name { value } }`             |
| `ProductSellingModelId` | Lookup → ProductSellingModel (rel: `ProductSellingModel`) | Read `ProductSellingModel { Name { value } }` |
| `RateUnitOfMeasureId`   | Lookup → UnitOfMeasure (rel: `RateUnitOfMeasure`)         |                                               |
| `UsageResourceId`       | Lookup → UsageResource (rel: `UsageResource`)             |                                               |

### `RateAdjustmentByTier`

Tier rows attached to a `RateCardEntry` when its card `Type='Tier'`.

| Field             | Type                   | Notes                                |
| ----------------- | ---------------------- | ------------------------------------ |
| `Id`              | ID                     |                                      |
| `LowerBound`      | Number                 |                                      |
| `UpperBound`      | Number (nullable)      | Null/missing = unbounded (∞)         |
| `AdjustmentType`  | Picklist               | `Amount` / `Percentage` / `Override` |
| `AdjustmentValue` | Number                 |                                      |
| `RateCardEntryId` | Lookup → RateCardEntry |                                      |

### `ProductSellingModel`

| Field  | Type   | Notes                                          |
| ------ | ------ | ---------------------------------------------- |
| `Id`   | ID     |                                                |
| `Name` | String | Looked up by name in the Rate Card import flow |

---

## 6. Billing — Credit Memos & Invoices

Credit memo issue and apply happen via the **REST endpoints** under `/services/data/v66.0/commerce/invoicing/credit-memos/...`, not GraphQL mutation. Read paths use GraphQL.

### `CreditMemo`

| Field              | Type                                     | Notes                                                                                        |
| ------------------ | ---------------------------------------- | -------------------------------------------------------------------------------------------- |
| `Id`               | ID                                       |                                                                                              |
| `DocumentNumber`   | String                                   | Display number (e.g. CM-2026-0051)                                                           |
| `Status`           | Picklist                                 | `Draft` / `Posted` / `Applied` / `Pending` (only `Pending` shows the Apply action in the UI) |
| `Balance`          | Currency                                 | Outstanding balance available to apply                                                       |
| `Description`      | String                                   | Free-text reason                                                                             |
| `BillingAccountId` | Lookup → Account (rel: `BillingAccount`) | Filter key for "credit memos for this account"                                               |

### `Invoice`

| Field              | Type             | Notes                                 |
| ------------------ | ---------------- | ------------------------------------- |
| `Id`               | ID               |                                       |
| `InvoiceNumber`    | String           |                                       |
| `Status`           | Picklist         |                                       |
| `Balance`          | Currency         | Falls back to `TotalAmount` when null |
| `TotalAmount`      | Currency         |                                       |
| `InvoiceDate`      | Date             |                                       |
| `BillingAccountId` | Lookup → Account |                                       |

---

## 7. Customer Context

### `Account`

| Field           | Type                         | Notes                                                   |
| --------------- | ---------------------------- | ------------------------------------------------------- |
| `Id`            | ID                           |                                                         |
| `Name`          | String                       | Searched with `like: "%...%"` in lookups across the app |
| `Industry`      | Picklist                     | Displayed as "segment"                                  |
| `Type`          | Picklist                     | Displayed as "region"                                   |
| `AnnualRevenue` | Currency                     | Shown as ARR on the Customer 360 sidebar                |
| `Owner`         | Lookup → User (rel: `Owner`) | Read `Owner { Name { value } Email { value } }`         |

### `Contract`

| Field            | Type             | Notes                                                                                    |
| ---------------- | ---------------- | ---------------------------------------------------------------------------------------- |
| `Id`             | ID               |                                                                                          |
| `ContractNumber` | String           |                                                                                          |
| `Status`         | Picklist         |                                                                                          |
| `StartDate`      | Date             | Customer 360 picks the most recent contract by `orderBy: { StartDate: { order: DESC } }` |
| `EndDate`        | Date             |                                                                                          |
| `ContractTerm`   | Number           | Months                                                                                   |
| `AccountId`      | Lookup → Account |                                                                                          |

---

## 8. Configuration — Custom Objects

Two project-defined custom objects store dashboard configuration. Both have **History Tracking enabled** — querying `*__History` returns audit rows (see History section).

### History tracking

Both objects expose `*__History` companions. Field-level history uses the typed value variants — `OldValue` / `NewValue` are `AnyType` and not directly queryable:

| Field                           | Notes                                                                    |
| ------------------------------- | ------------------------------------------------------------------------ |
| `ParentId`                      | The settings record being audited                                        |
| `Field`                         | API name of the field that changed                                       |
| `OldvalString` / `NewvalString` | Populated when the field is text/picklist; read `{ value displayValue }` |
| `OldvalNumber` / `NewvalNumber` | Populated when the field is numeric                                      |
| `CreatedDate`                   |                                                                          |
| `CreatedBy`                     | Read `CreatedBy { Name { value } }`                                      |

Pick the populated variant (string OR number is non-null for each row, never both).

---

## 9. Lifecycle / Creation Order

Several objects enforce a `Draft → Active` sequence. Activation often has to happen in **separate transactions** because server-side validators check committed state.

```
Step 1 — batchCreate (everything starts Draft except UnitOfMeasure):
  UnitOfMeasureClass  (Draft)
  UnitOfMeasure       (Active — created directly)
  Product2            (active flag set via IsAssetizable: true)
  UsageResource       (Draft)
  ProductUsageResource(Draft)
  ProductUsageGrant   (Draft)

Step 2 — batchUpdate (independent activations in one call):
  UnitOfMeasureClass  → Status=Active, DefaultUnitOfMeasureId=<the UoM Id>
  UsageResource       → Status=Active

Step 3 — batchUpdate (separate transaction — depends on Step 2 having committed):
  ProductUsageResource → Status=Active

Step 4 — batchUpdate (separate transaction — depends on Step 3):
  ProductUsageGrant   → Status=Active
```

If a `*Update` payload's referenced parent is still `Draft` in the same transaction (because the parent's flip to `Active` is also in that transaction), the validator sees the old state and the entire batch rolls back.

---

## 10. Field Quirks — Cheat Sheet

| Quirk                                                                                             | Where it bites                                                               |
| ------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| `ActivityDate` is `DateTime`, not `Date`                                                          | Filter values must use the full ISO timestamp                                |
| `OverageChargeable` is a **picklist**, not boolean                                                | Send `'Yes'` / `'No'` strings                                                |
| Status fields on `Product*` / `UsageResource` / `UoM*` start as `Draft`, never `Active` on create | Always activate via subsequent update                                        |
| `UsageEntitlementBucket` has no `GrantAmount`                                                     | Derive: `BucketBalance + TotalConsumedEntitlement`                           |
| `RateCard.status` is not a field                                                                  | Compute from `EffectiveFrom` / `EffectiveTo`                                 |
| `UsageResource` is looked up by `Code`, not `Name`                                                | Gotcha #204                                                                  |
| `UsageEntitlementAccount` cannot be DML-inserted                                                  | Gotcha #202 — wait for the platform to create it post-Order                  |
| `TransactionJournal` _can_ be DML-inserted when `UsageType='UsageManagement'`                     | Gotcha #334 only applies to the GL-path TJ                                   |
| `OldValue`/`NewValue` on `*__History` are `AnyType` (unqueryable)                                 | Read `OldvalString`/`NewvalString` and `OldvalNumber`/`NewvalNumber` instead |
| `Product2.UsageModelType` must equal `ProductUsageGrant.UsageModelType`                           | Gotcha #203                                                                  |
