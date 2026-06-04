import { createDataSDK } from '@salesforce/sdk-data';

let _sdk = null;

export function getSdk() {
  if (!_sdk) {
    console.log('[UsageDashboard] createDataSDK — initialising');
    _sdk = createDataSDK();
  }
  return _sdk;
}

function serializeValue(v) {
  if (typeof v === 'boolean') return String(v);
  if (typeof v === 'number')  return String(v);
  // strings (including @{...} references) — escape backslashes and double quotes
  return `"${String(v).replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

function serializeFields(fields) {
  return Object.entries(fields)
    .filter(([, v]) => v !== undefined && v !== null)
    .map(([k, v]) => `${k}: ${serializeValue(v)}`)
    .join(', ');
}

/**
 * Create one or many records in a single GraphQL mutation.
 *
 * @param sdk         Resolved data SDK
 * @param operations  Array of { name, fields }. Field values may be GraphQL
 *                    reference strings like '@{Product2Create.Record.Id}'
 *                    to chain output of an earlier op into a later op.
 * @param options     { allOrNone?: boolean } — defaults to true (atomic)
 * @returns           Map of operation name → created record Id
 */
export async function batchCreate(sdk, operations, { allOrNone = true } = {}) {
  if (!operations?.length) throw new Error('batchCreate: no operations provided');

  // GraphQL forbids duplicate field names in the same selection set. Detect
  // duplicates and alias every op as opN — but only when needed, since the
  // unaliased field name is what '@{Name}Create' chain references resolve to.
  const counts = {};
  for (const op of operations) counts[op.name] = (counts[op.name] ?? 0) + 1;
  const needsAlias = Object.values(counts).some((n) => n > 1);

  const opStrings = operations.map((op, i) => {
    const prefix = needsAlias ? `op${i}: ` : '';
    return `
    ${prefix}${op.name}Create(input: {
      ${op.name}: { ${serializeFields(op.fields)} }
    }) {
      Record { Id }
    }`;
  }).join('\n');

  const mutation = `
    mutation BatchCreate {
      uiapi(input: { allOrNone: ${allOrNone} }) {
        ${opStrings}
      }
    }
  `;

  console.log('[UsageDashboard] batchCreate mutation:', mutation);

  const resp = await sdk.graphql?.(mutation);
  console.log('[UsageDashboard] batchCreate response:', JSON.stringify(resp));

  if (resp?.errors?.length) {
    throw new Error(`Batch create failed: ${resp.errors[0].message}`);
  }

  const data = resp?.data?.uiapi;
  // Backwards-compatible return shape: object keyed by operation name (last op wins
  // when multiple share a name), PLUS an `ids` array in input order for callers
  // that need every created Id (e.g. tier import).
  const result = { ids: [] };
  for (let i = 0; i < operations.length; i++) {
    const op = operations[i];
    const key = needsAlias ? `op${i}` : `${op.name}Create`;
    const id  = data?.[key]?.Record?.Id;
    result.ids.push(id);
    result[op.name] = id;
  }
  return result;
}

/**
 * Delete one or many records in a single GraphQL mutation.
 *
 * @param sdk         Resolved data SDK
 * @param operations  Array of { name, id } where id is the record Id to delete
 * @param options     { allOrNone?: boolean } — defaults to true (atomic)
 */
export async function batchDelete(sdk, operations, { allOrNone = true } = {}) {
  if (!operations?.length) throw new Error('batchDelete: no operations provided');

  const opStrings = operations.map((op) => `
    ${op.name}Delete(input: { Id: "${op.id}" }) {
      Id
    }`).join('\n');

  const mutation = `
    mutation BatchDelete {
      uiapi(input: { allOrNone: ${allOrNone} }) {
        ${opStrings}
      }
    }
  `;

  console.log('[UsageDashboard] batchDelete mutation:', mutation);

  const resp = await sdk.graphql?.(mutation);
  console.log('[UsageDashboard] batchDelete response:', JSON.stringify(resp));

  if (resp?.errors?.length) {
    throw new Error(`Batch delete failed: ${resp.errors[0].message}`);
  }
}

/**
 * Update one or many records in a single GraphQL mutation.
 *
 * @param sdk         Resolved data SDK
 * @param operations  Array of { name, id, fields } where id is the record Id to update
 * @param options     { allOrNone?: boolean } — defaults to true (atomic)
 */
export async function batchUpdate(sdk, operations, { allOrNone = true } = {}) {
  if (!operations?.length) throw new Error('batchUpdate: no operations provided');

  const opStrings = operations.map((op) => `
    ${op.name}Update(input: {
      Id: "${op.id}"
      ${op.name}: { ${serializeFields(op.fields)} }
    }) {
      Record { Id }
    }`).join('\n');

  const mutation = `
    mutation BatchUpdate {
      uiapi(input: { allOrNone: ${allOrNone} }) {
        ${opStrings}
      }
    }
  `;

  console.log('[UsageDashboard] batchUpdate mutation:', mutation);

  const resp = await sdk.graphql?.(mutation);
  console.log('[UsageDashboard] batchUpdate response:', JSON.stringify(resp));

  if (resp?.errors?.length) {
    throw new Error(`Batch update failed: ${resp.errors[0].message}`);
  }
}
