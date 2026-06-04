# CLAUDE.md

## Purpose

This workspace is used to design and implement React applications for Salesforce, with a primary focus on Revenue Cloud Advanced workflows.

The main objective is to help the user plan, design, and build maintainable React apps that support Revenue Cloud Advanced use cases such as catalog browsing, pricing, quoting, approvals, amendments, and related sales operations.

Do not treat requests as generic React app tasks. Always optimize for Salesforce integration, enterprise UX, and Revenue Cloud Advanced business flows.

Unless the user explicitly asks otherwise, default to a Vercel-hosted native React application built with TypeScript and optimized for Salesforce GraphQL data access.

## Default Mindset

- Design for Salesforce and Revenue Cloud Advanced first, not for a generic web app.
- Default to Vercel deployment for new React apps.
- Default to native React with TypeScript for new app builds.
- Default to Tailwind CSS for styling in new React apps unless the user requests a different styling system.
- Default to Salesforce GraphQL and the Salesforce React Data SDK for data access when Salesforce data is involved.
- Always design app queries around GraphQL.
- For prototype apps, always provide mock data fallback when GraphQL is unavailable, unconfigured, or disconnected.
- Prefer clean architecture and small, composable React components.
- Never place an entire app, page, or complex workflow in a single file unless the user explicitly asks for it.
- Separate UI, business logic, and Salesforce integration concerns.
- Prioritize maintainability, clarity, and extensibility over fast but messy code generation.

## Delivery Workflow

Before writing implementation code for a new app or feature, follow this order:

1. Identify the user's goal and the Revenue Cloud Advanced workflow involved.
2. Clarify the target Salesforce integration model if it is not specified.
3. Default the delivery target to Vercel unless the user specifies another hosting model.
4. Check the existing project setup before adding dependencies, and install `@salesforce/sdk-data` only if it is not already present when Salesforce GraphQL access is needed.
5. Define the screens, user flow, and key actions.
6. Propose a folder structure and component tree.
7. Identify data dependencies, business rules, and Salesforce touchpoints.
8. Define the GraphQL query plan and the mock data fallback plan.
9. Implement the feature with separated files and clear responsibilities.

If requirements are incomplete, ask focused questions instead of guessing.

## Salesforce Integration Assumptions

When building React apps related to Salesforce, first determine which model applies:

- React app embedded in Salesforce
- React app hosted on Vercel and integrated with Salesforce APIs
- React app wrapped by an LWC or Aura container

If the integration model is unclear, ask before making assumptions.

Do not assume direct unrestricted browser access to Salesforce data.

For externally hosted apps, prefer Salesforce GraphQL access patterns that are compatible with the Salesforce React Data SDK guidance in `templates/.claude/skills/salesforce-react-data-sdk/SKILL.md`.

All Salesforce access should be isolated behind a service layer such as:

- `src/services/salesforce/`
- `src/api/`
- `src/features/<feature>/services/`

Keep platform-specific code out of presentational components.

## Revenue Cloud Advanced Rules

For Revenue Cloud Advanced requests:

- Understand the business workflow before generating UI.
- Account for pricing, product configuration, quote structure, approvals, amendments, and validation flows where relevant.
- Use domain-oriented naming instead of generic names like `DataPage`, `MainScreen`, or `WidgetOne`.
- Reflect real user tasks such as building quotes, reviewing pricing, selecting products, or managing approval states.

If a workflow affects business rules or data relationships, model those rules explicitly rather than hiding them inside JSX.

## React Architecture Rules

Use a clean, scalable folder structure.

For new apps, prefer a Vercel-friendly React + TypeScript structure.

Preferred structure:

- `src/app`
- `src/pages`
- `src/features`
- `src/components`
- `src/hooks`
- `src/services`
- `src/utils`
- `src/types`

Feature code should be grouped by business capability when possible, for example:

- `src/features/catalog`
- `src/features/pricing`
- `src/features/quotes`
- `src/features/approvals`

Within features, keep responsibilities separated:

- components
- hooks
- services
- types
- utils

## Component Rules

- One component per file for meaningful components.
- Extract large sections into child components instead of building monolithic pages.
- Keep business logic out of JSX where possible.
- Move data-fetching and orchestration into hooks or services when complexity grows.
- Reuse shared UI components for tables, forms, modals, banners, tabs, and step flows.
- Keep files focused and readable.

Do not generate giant page files that mix layout, API calls, validation, and business rules together.

## UI And UX Standards

- Design for enterprise Salesforce users.
- Prefer structured, production-ready interfaces over placeholder demos.
- Prefer Tailwind utility classes for app styling unless the user requests another CSS approach or the project already uses a different styling system.
- Include loading, empty, error, and success states.
- Support complex workflows such as multi-step forms, editable tables, line-item configuration, and approval review.
- Maintain visual consistency across screens and components.
- Align with Salesforce Lightning Design System patterns or a visual language compatible with Salesforce when appropriate.

Accessibility expectations:

- Keyboard-friendly interactions
- Semantic form structure
- Clear validation messaging
- Accessible tables and dialogs

## Data And Security Rules

- Respect Salesforce security boundaries.
- Do not assume unrestricted CRUD, FLS, or record visibility.
- Do not hardcode org-specific values, IDs, tokens, or URLs.
- Keep sensitive integration details out of UI components.
- Validate user inputs and handle async failures clearly.

If the app depends on Apex, REST, GraphQL, or middleware, keep those contracts explicit and isolated.

When GraphQL is used, follow the conventions in `templates/.claude/skills/salesforce-react-data-sdk/SKILL.md` and use `templates/.claude/skills/salesforce-react-data-sdk/scripts/sdk.js` as the reference for the SDK service layer pattern.

For prototype apps, GraphQL should still be the primary integration shape even when live Salesforce connectivity is not available yet.

## Salesforce GraphQL Default

For new Salesforce React apps, assume this default unless the user asks for something else:

- Hosting: Vercel
- Framework: native React
- Language: TypeScript
- Styling: Tailwind CSS
- Data layer: Salesforce GraphQL for querying
- SDK pattern: `@salesforce/sdk-data` via a shared service module
- Fallback mode: mock data when GraphQL is not connected or fails

When generating implementation code, prefer a dedicated SDK file such as `src/services/salesforce/sdk.ts` and keep raw GraphQL calls out of presentational components.

When a project needs the SDK, first inspect `package.json`. If `@salesforce/sdk-data` is missing, add it with the project's package manager instead of assuming it is already installed.

For prototypes, structure the app so screens can continue to render from mock datasets if GraphQL requests fail, are disabled, or the Salesforce connection is not ready.

Claude should treat `templates/.claude/skills/salesforce-react-data-sdk/SKILL.md` as the primary usage guide and `templates/.claude/skills/salesforce-react-data-sdk/scripts/sdk.js` as the concrete SDK and GraphQL example reference.

Do not duplicate inline GraphQL examples in this file. Reuse the shared skill guidance and the example in `templates/.claude/skills/salesforce-react-data-sdk/scripts/sdk.js`.

If batch create, update, or delete utilities are needed, adapt the structure from `templates/.claude/skills/salesforce-react-data-sdk/scripts/sdk.js` into TypeScript rather than inventing a different SDK access pattern.

Prefer mock modules such as `src/features/<feature>/mocks/` or `src/mocks/` for fallback prototype data. Keep the shape of mock records aligned with the GraphQL response mapping used by the feature.

## Performance Rules

- Avoid unnecessary rerenders.
- Lazy load large screens or heavy modules when appropriate.
- Break up large data views into manageable pieces.
- Use pagination, filtering, or virtualization for large tables when needed.
- Do not over-engineer performance prematurely, but do not ignore obvious scalability issues.

## Output Expectations

When asked to create a new React app or feature, prefer this format:

1. Brief summary of the user goal
2. Proposed folder structure
3. Component hierarchy
4. Vercel hosting and deployment assumptions
5. GraphQL query plan and mock fallback approach
6. Data flow and Salesforce integration notes
7. Implementation by file

If the user asks for code, do not output everything in one file unless they explicitly request a single-file example.

## Definition Of Done

A task is only complete when:

- The React app structure is clean and maintainable.
- The app is suitable for Vercel hosting unless the user requested a different deployment model.
- Components are separated into logical files.
- TypeScript is used for new React app implementations unless the user requested otherwise.
- Tailwind CSS is used for new React app styling unless the user requested a different styling approach or the project already follows another styling system.
- Salesforce integration boundaries are clear.
- Salesforce GraphQL and SDK usage follow the shared skill and service-layer pattern when applicable.
- GraphQL is the primary query model.
- Mock data fallback exists for prototype flows when GraphQL is unavailable or not connected.
- Revenue Cloud Advanced workflow requirements are reflected in the design.
- Key states and validations are handled.
- The solution is realistic for an enterprise Salesforce environment.
