---
name: salesforce-react-data-sdk
description: This skill should be used when working with the Salesforce UIBundle React SDK, writing GraphQL queries or mutations against the Salesforce UIAPI, using createDataSDK, sdk.graphql(), building queries with filters, pagination, cross-object lookups, batch creates, batch updates, or implementing the useSalesforceQuery hook. Also applies when debugging WrongType, FieldUndefined, or DataFetchingException errors from the UIAPI.
version: 1.1.0
---

# Salesforce React Data SDK

Reference for using `@salesforce/sdk-data` inside a Salesforce UIBundle (React app deployed to Salesforce). All data access goes through a single `sdk.graphql()` call against the Salesforce UIAPI GraphQL endpoint.

---

## SDK Initialisation

`createDataSDK()` returns a **Promise** — always `await` it. Use a singleton to avoid re-initialising on every call.

```js
// src/api/sdk.js
import { createDataSDK } from "@salesforce/sdk-data";

let _sdk = null;

export function getSdk() {
  if (!_sdk) _sdk = createDataSDK();
  return _sdk; // callers must await this
}
```

```js
// Usage in any component or form handler
const sdk = await getSdk();
const resp = await sdk.graphql?.(queryString);
```

---

## Query Structure

Every query is wrapped in `uiapi { query { ... } }`. Records come back as `edges > node`.

```graphql
query MyQuery {
  uiapi {
    query {
      ObjectName(
        first: 50
        orderBy: { FieldName: { order: ASC } }
        where: { ... }
      ) {
        edges {
          node {
            Id
            ScalarField { value }
            LookupRelationship {
              Id
              NestedField { value }
            }
          }
        }
        pageInfo {
          endCursor
          hasNextPage
        }
      }
    }
  }
}
```

**Reading values from a response node:**

- `Id` — bare string, no wrapper — applies both at the top level **and** inside lookup traversals (e.g., `node.UsageResource?.Id`)
- All other fields — wrapped: `FieldName { value }`
- Lookup / parent traversal — `RelationshipName { Id ChildField { value } }`

### Multiple objects in one query

Multiple top-level objects can be fetched in a single `sdk.graphql()` call:

```graphql
query ProductDetail {
  uiapi {
    query {
      ProductUsageResource(where: { ProductId: { eq: "01tXXX" } }, first: 10) {
        edges {
          node {
            Id
            Status {
              value
            }
          }
        }
      }
      ProductUsageGrant(
        where: { UsageDefinitionProduct: { Id: { eq: "01tXXX" } } }
        first: 10
      ) {
        edges {
          node {
            Id
            Label {
              value
            }
            Quantity {
              value
            }
          }
        }
      }
    }
  }
}
```

Access each result set separately: `resp?.data?.uiapi?.query?.ProductUsageResource` and `resp?.data?.uiapi?.query?.ProductUsageGrant`.

---

## Filter Operators & Type Rules

The type of the field determines how the filter value must be written.

| Field type                   | Filter syntax                  | Example                                                        |
| ---------------------------- | ------------------------------ | -------------------------------------------------------------- |
| **ID**                       | `eq: "id"`                     | `AccountId: { eq: "001Kj…" }`                                  |
| **Boolean**                  | `eq: true` / `eq: false`       | `IsAssetizable: { eq: true }`                                  |
| **String / Picklist**        | `eq: "val"` or `like: "%val%"` | `Name: { like: "%token%" }`                                    |
| **Date / DateTime / Number** | `eq: { value: "..." }`         | `ActivityDate: { gte: { value: "2025-01-01T00:00:00.000Z" } }` |
| **Null check**               | `ne: null`                     | `UsageModelType: { ne: null }`                                 |

> **Rule of thumb:** ID and Boolean fields take a raw literal. Scalar fields (dates, numbers) require `{ value: ... }`. Strings used in `like` take a raw string.

### Combining conditions

```graphql
where: {
  and: [
    { IsAssetizable: { eq: true } }
    { Name: { like: "%token%" } }
  ]
}
```

### Nested relationship filter (single-hop)

Filter by a field on a parent object using the relationship name as the key:

```graphql
where: {
  Product2: { UsageModelType: { ne: null } }
  AccountId: { eq: "001Kj…" }
}
```

### Nested relationship filter (multi-hop)

Chains can go multiple levels deep. Filter `UsageEntitlementBucket` by the `AccountId` on its `TransactionUsageEntitlement` parent:

```graphql
UsageEntitlementBucket(
  where: {
    TransactionUsageEntitlement: { AccountId: { eq: "001Kj…" } }
  }
  first: 200
) {
  edges {
    node {
      BucketBalance { value }
      TotalConsumedEntitlement { value }
      BucketBalanceUom { Name { value } }
      TransactionUsageEntitlement { AssetId { value } }
    }
  }
}
```

### Filtering by a lookup's `Id` field

When the filter is on the `Id` of a related object (not a direct ID field on the current object), traverse the relationship:

```graphql
# Direct field filter — ProductUsageResource has ProductId
where: { ProductId: { eq: "01tXXX" } }

# Relationship traversal filter — ProductUsageGrant has no direct productId field;
# filter via its UsageDefinitionProduct lookup
where: { UsageDefinitionProduct: { Id: { eq: "01tXXX" } } }
```

---

## Pagination

```graphql
ObjectName(
  first: 50
  after: "cursor_string"   # omit on first page
) {
  edges { node { ... } }
  pageInfo {
    endCursor
    hasNextPage
  }
}
```

**Pattern in React — manual page accumulation:**

```js
async function fetchPage(after = null) {
  const sdk = await getSdk();
  const query = `query { uiapi { query {
    ObjectName(first: 50 ${after ? `after: "${after}"` : ""}) {
      edges { node { Id Name { value } } }
      pageInfo { endCursor hasNextPage }
    }
  }}}`;
  const resp = await sdk.graphql?.(query);
  const result = resp?.data?.uiapi?.query?.ObjectName;
  return {
    items: (result?.edges ?? []).map((e) => ({
      id: e.node.Id,
      name: e.node.Name?.value,
    })),
    endCursor: result?.pageInfo?.endCursor ?? null,
    hasNextPage: result?.pageInfo?.hasNextPage ?? false,
  };
}
```

Use `cancelled` flag to prevent stale state updates when deps change mid-fetch:

```js
useEffect(() => {
  let cancelled = false;
  async function load() {
    /* ... if (!cancelled) setState(...) */
  }
  load();
  return () => {
    cancelled = true;
  };
}, [dep]);
```

---

## Cross-Object Queries

### Parallel separate queries + client-side join

When two objects share a common ID (e.g., `Asset` and `UsageEntitlementBucket` both relate via `AssetId`), fire both queries in parallel and join the results in JavaScript:

```js
const [assetResult, bucketsMap] = await Promise.all([
  fetchAssets(accountId),
  fetchBuckets(accountId),
]);
// Join client-side: bucketsByAssetId[asset.id]
```

```js
// fetchBuckets — filter via multi-hop parent, read back the join key
async function fetchBuckets(accountId) {
  const sdk = await getSdk();
  const resp = await sdk.graphql?.(`
    query AccountAssetBuckets {
      uiapi { query {
        UsageEntitlementBucket(
          where: { TransactionUsageEntitlement: { AccountId: { eq: "${accountId}" } } }
          first: 200
        ) {
          edges { node {
            BucketBalance { value }
            TotalConsumedEntitlement { value }
            BucketBalanceUom { Name { value } }
            TransactionUsageEntitlement { AssetId { value } }
          }}
        }
      }}
    }
  `);
  const edges = resp?.data?.uiapi?.query?.UsageEntitlementBucket?.edges ?? [];
  // Group by AssetId — read back from TransactionUsageEntitlement
  const byAsset = {};
  for (const { node } of edges) {
    const assetId = node.TransactionUsageEntitlement?.AssetId?.value;
    if (!assetId) continue;
    byAsset[assetId] = {
      bucketBalance:
        (byAsset[assetId]?.bucketBalance ?? 0) +
        parseFloat(node.BucketBalance?.value ?? 0),
      consumedEntitlement:
        (byAsset[assetId]?.consumedEntitlement ?? 0) +
        parseFloat(node.TotalConsumedEntitlement?.value ?? 0),
      uomName: node.BucketBalanceUom?.Name?.value ?? null,
    };
  }
  return byAsset;
}
```

### `inq` — inline subquery correlation

Use `inq` when you want to filter an object whose FK exists directly on that object (no bridge table needed):

```graphql
# Conceptual: get all child records whose parent satisfies a condition
ChildObject(
  where: {
    ParentId: {
      inq: {
        ParentObject: { SomeField: { eq: "value" } }
        ApiName: "Id"
      }
    }
  }
) {
  edges { node { Id } }
}
```

`inq` syntax: `FieldId: { inq: { RelatedObject: { filterConditions }, ApiName: "FieldOnRelatedObject" } }`

> **Note:** Use the nested relationship filter (e.g., `TransactionUsageEntitlement: { AccountId: ... }`) when the path to the target field goes through a bridge object. `inq` requires the FK to exist directly on the filtered object.

---

## Searching with Server-Side `like`

Pass a `like` filter and debounce the input — each search fires a fresh query from page 1.

```js
const DEBOUNCE_MS = 300;

// Debounce
useEffect(() => {
  const t = setTimeout(() => setDebouncedSearch(search), DEBOUNCE_MS);
  return () => clearTimeout(t);
}, [search]);

// Re-fetch from page 1 when debounced value changes
useEffect(() => {
  // reset + load
}, [debouncedSearch]);
```

```js
// Escape user input before injecting into the query string
const safe = search.replace(/\\/g, "\\\\").replace(/"/g, '\\"');

// Build where clause — combine with other conditions using `and`
const conditions = [`{ IsAssetizable: { eq: true } }`];
if (search) conditions.push(`{ Name: { like: "%${safe}%" } }`);
const whereClause =
  conditions.length === 1
    ? `where: ${conditions[0]}`
    : `where: { and: [${conditions.join(", ")}] }`;
```

---

## Mutations — Create

```graphql
mutation BatchCreate {
  uiapi(input: { allOrNone: true }) {
    Product2Create(
      input: {
        Product2: {
          Name: "My Product"
          UsageModelType: "Consumption"
          IsAssetizable: true
        }
      }
    ) {
      Record {
        Id
      }
    }
  }
}
```

**Key rules:**

- `errors` is **not** a valid field on `*CreatePayload` — do not select it
- Response errors surface at the top level: `resp?.errors`
- `Id` is a bare string in the response: `resp.data.uiapi.Product2Create.Record.Id`

---

## Mutations — Batch Create with Cross-References

Operations in the same `uiapi` block can reference earlier results using `"@{OperationName}"` (shorthand for the created record's `Id`).

```graphql
mutation CreateProductSetup {
  uiapi(input: { allOrNone: true }) {
    UnitOfMeasureClassCreate(
      input: {
        UnitOfMeasureClass: {
          Name: "Volume"
          Type: "Standard"
          Status: "Draft"
        }
      }
    ) {
      Record {
        Id
      }
    }
    UnitOfMeasureCreate(
      input: {
        UnitOfMeasure: {
          Name: "Litre"
          UnitOfMeasureClassId: "@{UnitOfMeasureClassCreate}"
          Status: "Active"
        }
      }
    ) {
      Record {
        Id
      }
    }
    Product2Create(
      input: {
        Product2: {
          Name: "Water Usage"
          UsageModelType: "Consumption"
          IsAssetizable: true
        }
      }
    ) {
      Record {
        Id
      }
    }
    ProductUsageGrantCreate(
      input: {
        ProductUsageGrant: {
          UsageDefinitionProductId: "@{Product2Create}"
          Status: "Draft"
          Label: "Water Grant"
          Quantity: 1000
        }
      }
    ) {
      Record {
        Id
      }
    }
  }
}
```

**Cross-reference rules:**

- `"@{OperationName}"` = shorthand for the created record's `Id`
- `"@{OperationName.Record.FieldName.value}"` for other fields (e.g. Name)
- Operations are resolved in declaration order — only reference earlier ops
- `allOrNone: true` rolls back everything if any op fails

---

## Mutations — Update

`Id` goes at the `input` level, **not** inside the object wrapper:

```graphql
mutation ActivateRecord {
  uiapi(input: { allOrNone: true }) {
    ProductUsageResourceUpdate(
      input: {
        Id: "1TrDO000000000G0AQ"
        ProductUsageResource: { Status: "Active" }
      }
    ) {
      Record {
        Id
      }
    }
  }
}
```

Multiple independent updates can share one call. Updates that have a dependency order must be separate sequential calls.

---

## Helper Methods (`src/api/sdk.js`)

### `batchCreate(sdk, operations, { allOrNone })`

```js
import { getSdk, batchCreate } from "../api/sdk.js";

const sdk = await getSdk();
const ids = await batchCreate(sdk, [
  {
    name: "Product2",
    fields: {
      Name: "My Product",
      UsageModelType: "Consumption",
      IsAssetizable: true,
    },
  },
  {
    name: "ProductUsageResource",
    fields: {
      ProductId: "@{Product2Create}", // cross-reference shorthand
      UsageResourceId: "existingId",
      EffectiveStartDate: new Date().toISOString(),
      Status: "Draft",
    },
  },
]);
// ids = { Product2: '01tXXX…', ProductUsageResource: '1TrXXX…' }
```

- `operations`: `Array<{ name: string, fields: object }>`
- Field values: booleans and numbers are unquoted; strings (including `@{…}` refs) are quoted
- Returns a map of `operationName → createdId`

### `batchUpdate(sdk, operations, { allOrNone })`

```js
await batchUpdate(sdk, [
  {
    name: "ProductUsageResource",
    id: ids["ProductUsageResource"],
    fields: { Status: "Active" },
  },
  {
    name: "UnitOfMeasureClass",
    id: ids["UnitOfMeasureClass"],
    fields: { Status: "Active", DefaultUnitOfMeasureId: ids["UnitOfMeasure"] },
  },
]);
```

- `operations`: `Array<{ name: string, id: string, fields: object }>`
- `id` is the Salesforce record Id to update — placed at the GraphQL `input` level, not inside the object wrapper

---

## Draft → Active Status Flow (Revenue Cloud)

Several Revenue Cloud objects enforce a `Draft` → `Active` lifecycle. Attempting to create them as `Active` throws a validation error.

| Object                 | Must create as      | Activate after                                                                              |
| ---------------------- | ------------------- | ------------------------------------------------------------------------------------------- |
| `UnitOfMeasureClass`   | `Draft`             | Activate in same call as `ProductUsageResource`; set `DefaultUnitOfMeasureId` at that point |
| `ProductUsageResource` | `Draft`             | Activate before `ProductUsageGrant`                                                         |
| `ProductUsageGrant`    | `Draft`             | Activate after `ProductUsageResource` is `Active`                                           |
| `UnitOfMeasure`        | `Active` (directly) | —                                                                                           |

**Correct sequence for full product setup:**

```
1. batchCreate (all records as Draft / Active per table above)
2. batchUpdate  → UnitOfMeasureClass (Active + DefaultUnitOfMeasureId)
                  + ProductUsageResource (Active)   ← same call, independent
3. batchUpdate  → ProductUsageGrant (Active)         ← separate call, depends on step 2
```

---

## `useSalesforceQuery` Hook

Automatically exhausts **all pages** via an internal `while (hasNextPage)` loop, accumulates all edges, then calls `transform` once with the full edge array. Re-fetches from scratch whenever `deps` change.

```js
// Signature
const { data, loading, error } = useSalesforceQuery(
  buildQueryFn, // (after: string|null) => queryString
  extractEdgesFn, // (responseData) => { edges: [], pageInfo: { endCursor, hasNextPage } }
  transformFn, // (allEdges: { node: {...} }[]) => derivedData
  deps, // array — changes trigger a full reset + re-fetch
);
```

```js
// Account-filtered example
const buildQueryFor = (accountId) => (after) => `
  query Usage {
    uiapi { query {
      TransactionJournal(
        first: 200
        ${after ? `after: "${after}"` : ""}
        where: {
          ActivityDate: { gte: { value: "${oneYearAgo}T00:00:00.000Z" } }
          ${accountId ? `AccountId: { eq: "${accountId}" }` : ""}
        }
      ) {
        edges { node { Quantity { value } ActivityDate { value } } }
        pageInfo { endCursor hasNextPage }
      }
    }}
  }
`;

const { data } = useSalesforceQuery(
  buildQueryFor(accountId),
  (data) => ({
    edges: data?.uiapi?.query?.TransactionJournal?.edges ?? [],
    pageInfo: data?.uiapi?.query?.TransactionJournal?.pageInfo,
  }),
  (edges) => edges.map(({ node }) => ({ qty: node.Quantity?.value })),
  [accountId], // re-fetch when account changes
);
```

> `extractEdgesFn` receives `response.data` (the full data tree). `transformFn` receives the flat accumulated `edges` array where each element is `{ node: {...} }`.

---

## Common Errors & Fixes

| Error                                                      | Cause                                                            | Fix                                                                                      |
| ---------------------------------------------------------- | ---------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `WrongType … ObjectValue … expected BooleanValue`          | Boolean filter wrapped: `eq: { value: true }`                    | Use `eq: true`                                                                           |
| `WrongType … ObjectValue … expected StringValue/IntValue`  | ID filter wrapped: `eq: { value: "id" }`                         | Use `eq: "id"`                                                                           |
| `WrongType … expected DateTime`                            | Date passed as `"YYYY-MM-DD"`                                    | Use full ISO: `new Date().toISOString()`                                                 |
| `WrongType … expected Picklist StringValue`                | Picklist field received a boolean                                | Map to string values (e.g., `OverageChargeable: flag ? 'Yes' : 'No'`)                    |
| `FieldUndefined … [node/RelationshipName]`                 | Traversing a child (has-many) relationship inline                | Query the child object separately; join client-side                                      |
| `FieldUndefined` on filter field                           | Field doesn't exist directly — path goes through a bridge object | Use nested relationship filter (e.g., `TransactionUsageEntitlement: { AccountId: ... }`) |
| `contains a field not in *CreateInput: 'Id'`               | `Id` placed inside the object wrapper on update                  | Move `Id` to the `input` level                                                           |
| `contains a field not in *CreatePayload: 'errors'`         | Selecting `errors` on the create payload                         | Remove — errors surface at `resp.errors` only                                            |
| `no such vertex in graph: OperationName.Record.Id`         | Using full cross-ref path `@{Op.Record.Id}`                      | Use shorthand `@{OperationName}`                                                         |
| `You can create the record when it's in Draft status only` | Creating with `Status: 'Active'`                                 | Create as `Draft`, then update to `Active`                                               |
| `Select an active Product Usage Resource`                  | Activating Grant and Resource in the same call                   | Activate Resource first, then Grant in a separate call                                   |
