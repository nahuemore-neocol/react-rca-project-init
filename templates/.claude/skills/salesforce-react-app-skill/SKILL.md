---
name: salesforce-react-app
description: >-
  Reference guide for building React apps deployed to Salesforce (UIBundle).
  Covers metadata structure, styling with Tailwind/SLDS, Data SDK for GraphQL
  and REST data access, error handling, and manual Agentforce (ACC) integration.
  Use this skill whenever building, scaffolding, or debugging a Salesforce-hosted
  React app.
---

# Salesforce React App — Developer Reference

---

## 0. Project Folder Structure

```
force-app/main/default/
├── uiBundles/
│   └── {app_name}/
│       ├── {app_name}.uibundle-meta.xml # app identity and deployment target (must match folder name)
│       ├── ui-bundle.json              # routing and build config
│       ├── package.json
│       ├── schema.graphql              # generated via `npm run graphql:schema`
│       ├── src/
│       │   ├── global.css              # design tokens + Tailwind @theme + @layer base
│       │   ├── api/
│       │   │   ├── graphql-operations-types.ts   # generated via `npm run graphql:codegen`
│       │   │   └── utils/
│       │   │       └── query/          # external .graphql files (complex queries)
│       │   └── components/             # React components
│       └── dist/                       # built assets (outputDir, deployed to Salesforce)
│
│   # ── External / Experience apps only ──────────────────────────────────
├── digitalExperienceConfigs/
├── digitalExperiences/
│   └── sfdc_cms_site/
│       └── content.json                # appContainer: true, appSpace: Prefix__Name
├── networks/
└── sites/
```

Max 2,500 files per UIBundle.

---

## 1. Metadata Structure

### Required files

| File | Purpose |
|---|---|
| `{app_name}.uibundle-meta.xml` | Declares the app and its deployment target — filename **must match the bundle folder name** |
| `ui-bundle.json` | Runtime routing and build configuration |

### `.uibundle-meta.xml` — full property reference

```xml
<?xml version="1.0" encoding="UTF-8"?>
<UIBundle xmlns="http://soap.sforce.com/2006/04/metadata">
    <masterLabel>My App Label</masterLabel>
    <description>Short description of the app</description>
    <isActive>true</isActive>
    <version>1</version>
    <target>AppLauncher</target>
</UIBundle>
```

| Property | Required | Notes |
|---|---|---|
| `masterLabel` | Yes | Human-readable app name shown in the UI |
| `description` | No | Short description of the app's purpose |
| `isActive` | Yes | `true` to enable the app; `false` to disable without deleting |
| `version` | Yes | Integer; increment when deploying breaking changes |
| `target` | Yes | `AppLauncher` — available in the Salesforce App Launcher; `Experience` — external-facing site via Digital Experiences |

### `ui-bundle.json` — configuration properties

| Property | Type | Required | Notes |
|---|---|---|---|
| `outputDir` | string | Yes | Build output directory, defaults to `dist` |
| `apiVersion` | string | No | Format: `vXX.X` |
| `routing.fileBasedRouting` | boolean | No | Defaults to `true`; maps URLs to folder structure |
| `routing.trailingSlash` | string | No | `never`, `always`, or `auto` |
| `routing.fallback` | string | No | Set to `index.html` for SPAs |
| `routing.rewrites` | array | No | Serve a different file without changing the URL |
| `routing.redirects` | array | No | HTTP redirects; supports 301, 302, 307, 308 |

### External apps (Digital Experience / `reactexternalapp` template)

Additional metadata types required under `force-app/main/default`:

- `digitalExperienceConfigs`
- `digitalExperiences` — must include `appContainer: true`
- `networks`
- `sites`

The `appSpace` field in `content.json` uses the format `NamespacePrefix__DeveloperName`.

---

## 2. Styling

### Approach

React apps use **global CSS** as the design system entry point. The recommended stack is **Tailwind CSS** with semantic design tokens, plus SLDS for component styling.

### `global.css` — token mapping pattern

```css
@theme inline {
  --color-primary: #0176d3;       /* Salesforce brand blue */
  --color-background: #f3f3f3;    /* SLDS secondary background */
  --color-foreground: #181818;
}

@layer base {
  html {
    @apply min-h-screen antialiased bg-background text-foreground;
  }
}

/* Dark mode — cascades automatically */
.dark {
  --color-background: #1a1a1a;
  --color-foreground: #f3f3f3;
}
```

### SLDS integration options

| Option | How |
|---|---|
| Manual SLDS blueprints | Apply SLDS CSS classes directly to HTML elements |
| SLDS for React | `import '@salesforce/design-system-react'` — auto-applies styling |

### Key SLDS/Tailwind alignment rules

- Default shadcn border-radius (`0.5rem`) differs from SLDS — align manually if needed
- Focus indicator color must be Salesforce brand blue: `#0176d3`
- Secondary background in SLDS is `#f3f3f3` — override shadcn defaults to match

---

## 3. Data Retrieval and Processing (Data SDK)

### Install and import

```typescript
import { createDataSDK, gql, NodeOfConnection } from '@salesforce/sdk-data';
```

Only `@salesforce/sdk-data` is permitted for Salesforce API calls. Do not call `fetch()` or `axios` directly against Salesforce endpoints.

### Initialization

```typescript
const dataSdk = await createDataSDK({
  // surface is auto-detected; override only when needed
  webapp: {
    basePath: '/custom/prefix',   // optional custom API prefix
    on401: () => { /* handle session expiry */ },
    on403: () => { /* handle permission errors */ },
  },
});
```

### Data access hierarchy (use in this order)

1. **GraphQL** — `dataSdk.graphql?.()` — primary, covers most Salesforce objects
2. **UI API** — `dataSdk.fetch?.()` — for `/services/data/vXX.X/ui-api/*` endpoints
3. **GraphQL via GET** — when POST query size exceeds URL limits
4. **Apex REST** — `dataSdk.fetch?.()` against `/services/apexrest/*` — for custom logic only

### GraphQL query pattern

```typescript
const query = gql`
  query GetAccounts {
    uiapi {
      query {
        Account {
          edges {
            node {
              Id
              Name { value }
            }
          }
        }
      }
    }
  }
`;

// SDK signature is graphql(query, variables?) — NOT graphql({ query })
const response = await dataSdk.graphql?.(query);
```

Use optional chaining (`graphql?.()`) for cross-surface compatibility.

> **All date/time `where` filters must use DateTime format (`YYYY-MM-DDT00:00:00.000Z`), even for fields whose name suggests a plain Date.** The Salesforce GraphQL schema types `ActivityDate`, `CreatedDate`, `EffectiveStartDateTime`, etc. all as `DateTime` — passing a bare `YYYY-MM-DD` string produces a `WrongType` validation error.

> **Do not use the `gql` template tag.** `gql` from `@salesforce/sdk-data` returns a `DocumentNode` (AST object). When the SDK serializes it, the `definitions` array is sent as the request body, causing a server-side "Can not deserialize: unexpected array" error. Pass queries as plain template literal strings instead:
> ```js
> const QUERY = `
>   query MyQuery {
>     uiapi { ... }
>   }
> `;
> await dataSdk.graphql?.({ query: QUERY });
> ```

### Type-safe connection nodes

```typescript
type AccountNode = NodeOfConnection<Query["uiapi"]["query"]["Account"]>;
```

### Type generation setup

```bash
# Generate schema from org introspection
npm run graphql:schema
# Outputs: schema.graphql at project root

# Generate TypeScript types from .graphql files + inline gql queries
npm run graphql:codegen
# Outputs: src/api/graphql-operations-types.ts
```

Generated type naming:
- Query response: `<OperationName>Query`
- Query variables: `<OperationName>QueryVariables`
- Mutation response: `<OperationName>Mutation`
- Mutation variables: `<OperationName>MutationVariables`

### Query organization

| Query complexity | Pattern |
|---|---|
| Simple, no variables | Inline `gql` tag colocated with the component |
| Complex, variables, fragments | External `.graphql` file in `src/api/utils/query/` |

### Error handling strategies

| Strategy | When to use | Behavior |
|---|---|---|
| Conservative | Data integrity critical | Fail completely if any GraphQL errors present |
| Moderate | UI can degrade gracefully | Log errors, continue rendering available data |
| Permissive | Mutations | Use any returned data; only fail if errors with no data |

```typescript
try {
  // SDK signature is graphql(query, variables?) — NOT graphql({ query })
const response = await dataSdk.graphql?.(query);
  // handle response.data and response.errors
} catch (err) {
  // transport/network failure — no response returned
}
```

For React component trees, wrap data-fetching subtrees in an error boundary:

```typescript
class DataErrorBoundary extends React.Component {
  static getDerivedStateFromError(error) {
    return { hasError: true };
  }
  componentDidCatch(error, info) {
    console.error(error, info);
  }
  render() {
    return this.state.hasError ? <FallbackUI /> : this.props.children;
  }
}
```

---

## 4. Agentforce Conversation Client (ACC) — Manual Integration

### Install

```bash
npm install @salesforce/agentforce-conversation-client
```

### Integration pattern

Use `createAccWidget` to inject the ACC conversational UI into a designated DOM container. Wire it to the React component lifecycle with `useRef` and `useEffect`.

```typescript
import { createAccWidget } from '@salesforce/agentforce-conversation-client';
import { useRef, useEffect } from 'react';

export function AgentforceWidget() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const widget = createAccWidget({
      container: containerRef.current,
      // additional config per Agentforce Conversation Client Developer Guide
    });

    return () => {
      widget.unmount();
    };
  }, []);

  return <div ref={containerRef} />;
}
```

### Key requirements

- `createAccWidget` wraps the ACC widget via **Lightning Out 2.0** — no LWC stack required
- The `container` DOM element must exist before calling `createAccWidget` — always guard with `if (!ref.current) return`
- Clean up by calling `widget.unmount()` in the `useEffect` return to prevent memory leaks
- For full configuration options (agent ID, session settings, UI customization), consult the [Agentforce Conversation Client Developer Guide](https://developer.salesforce.com/docs/platform/einstein-for-devs/guide/reactdev-acc.html)

---

## 5. Deployment

### Prerequisites — do this before every deploy

```bash
# Run from inside the UIBundle app folder
npm install
npm run build
```

`@salesforce/sdk-data` is injected by the Salesforce runtime and must be declared as `external` in Vite so the build doesn't fail trying to resolve it:

```js
// vite.config.js
base: './',   // relative asset paths — required because Salesforce mounts the bundle at a subpath, not domain root
build: {
  outDir: 'dist',
}
```

### Deploy command

```bash
# From the SFDX project root
sf project deploy start --source-dir force-app/main/default/uiBundles/{app_name}
```

### `package.xml` — add UIBundle type

```xml
<types>
    <members>*</members>
    <name>UIBundle</name>
</types>
```

### `.forceignore` — exclude dev artifacts, keep `dist/`

```
# UIBundle — only dist/ is deployed; exclude source and dev deps
**/uiBundles/**/node_modules/**
**/uiBundles/**/src/**
**/uiBundles/*/vite.config.js
**/uiBundles/*/index.html
```

**Critical:** use `**/uiBundles/*/index.html` (single `*`) not `**/uiBundles/**/index.html` (double `**`).
The double-`**` form also matches `dist/index.html`, which is the `routing.fallback` file Salesforce requires — excluding it causes a deployment error.

### Common deployment errors

| Error | Cause | Fix |
|---|---|---|
| `Expected source files for type 'UIBundle'` | Metadata file named `.uibundle-meta.xml` instead of `{app_name}.uibundle-meta.xml` | Rename to match the bundle folder name |
| `Expected source files for type 'UIBundle'` | `dist/` folder missing | Run `npm run build` first |
| `routing.fallback file must exist` | `dist/index.html` excluded by `.forceignore` | Use `**/uiBundles/*/index.html` (single `*`) in `.forceignore` |
| Uncaught TypeError: Failed to resolve module specifier `@salesforce/sdk-data` | Module marked as `external` in Vite but browser has no import map to resolve it | Remove `external` — `@salesforce/sdk-data` is a real npm package and must be bundled |
| Blank page, JS asset 404 in console | Vite uses absolute asset paths (`/assets/...`) but bundle is mounted at a subpath | Add `base: './'` to `vite.config.js` |
