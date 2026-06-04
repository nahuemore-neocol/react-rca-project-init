# CLAUDE.md

## Purpose

This workspace is used to design and implement React applications for Salesforce, with a primary focus on Revenue Cloud Advanced workflows.

The main objective is to help the user plan, design, and build maintainable React apps that support Revenue Cloud Advanced use cases such as catalog browsing, pricing, quoting, approvals, amendments, and related sales operations.

Do not treat requests as generic React app tasks. Always optimize for Salesforce integration, enterprise UX, and Revenue Cloud Advanced business flows.

## Default Mindset

- Design for Salesforce and Revenue Cloud Advanced first, not for a generic web app.
- Prefer clean architecture and small, composable React components.
- Never place an entire app, page, or complex workflow in a single file unless the user explicitly asks for it.
- Separate UI, business logic, and Salesforce integration concerns.
- Prioritize maintainability, clarity, and extensibility over fast but messy code generation.

## Delivery Workflow

Before writing implementation code for a new app or feature, follow this order:

1. Identify the user's goal and the Revenue Cloud Advanced workflow involved.
2. Clarify the target Salesforce integration model if it is not specified.
3. Define the screens, user flow, and key actions.
4. Propose a folder structure and component tree.
5. Identify data dependencies, business rules, and Salesforce touchpoints.
6. Implement the feature with separated files and clear responsibilities.

If requirements are incomplete, ask focused questions instead of guessing.

## Salesforce Integration Assumptions

When building React apps related to Salesforce, first determine which model applies:

- React app embedded in Salesforce
- React app hosted externally and integrated with Salesforce APIs
- React app wrapped by an LWC or Aura container

If the integration model is unclear, ask before making assumptions.

Do not assume direct unrestricted browser access to Salesforce data.

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
4. Data flow and Salesforce integration notes
5. Implementation by file

If the user asks for code, do not output everything in one file unless they explicitly request a single-file example.

## Definition Of Done

A task is only complete when:

- The React app structure is clean and maintainable.
- Components are separated into logical files.
- Salesforce integration boundaries are clear.
- Revenue Cloud Advanced workflow requirements are reflected in the design.
- Key states and validations are handled.
- The solution is realistic for an enterprise Salesforce environment.
