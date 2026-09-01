# Testing

## Table of Contents

1. [How to run tests](#how-to-run-tests)
2. [E2E / Playwright](#e2e--playwright)
3. [What is tested](#what-is-tested)
4. [What still needs tests](#what-still-needs-tests)
5. [Testing conventions](#testing-conventions)
6. [Adding a new test](#adding-a-new-test)

---

## How to run tests

| Command                 | Purpose                                                  |
| ----------------------- | -------------------------------------------------------- |
| `pnpm test`             | Run all unit and integration tests once                  |
| `pnpm test:watch`       | Re-run changed Vitest files on save                      |
| `pnpm test:ci`          | Run Vitest with verbose reporter for CI logs             |
| `pnpm test:coverage`    | Run Vitest with V8 coverage report                       |
| `pnpm test:e2e`         | Run the Playwright E2E suite headlessly                  |
| `pnpm test:e2e:headed`  | Run E2E tests with a visible browser                     |
| `pnpm test:e2e:debug`   | Open the Playwright inspector for step-through debugging |
| `pnpm test:e2e:install` | Install the Chromium browser used by the E2E suite       |

Coverage artifacts are written to `coverage/` (gitignored). Open `coverage/index.html` for the HTML report, or inspect `coverage/coverage-summary.json` for machine-readable numbers.

## E2E / Playwright

The critical user and admin journeys now live in `tests/e2e/` and run in Chromium through Playwright.

### Local setup

1. Ensure your local database is reachable and migrations are applied.
2. Start from the normal app environment you use for local development.
3. Install the browser once with `pnpm test:e2e:install`.
4. Run `pnpm test:e2e` for headless execution, or `pnpm test:e2e:headed` while developing.

The Playwright config starts the app with `pnpm dev`, seeds stable E2E data in `tests/e2e/global.setup.ts`, and uses the shared `data-testid` hooks defined in `src/lib/test-selectors.ts`.

### Stable selector strategy

- Prefer accessible selectors first: headings, labels, buttons, and links.
- Use shared `data-testid` values only for business-critical surfaces that are dynamic or easy to break during UI refactors.
- Keep selector names task-focused (`storefront-add-to-cart`, `admin-order-status-form`) instead of style-focused.
- For icon-only controls, avoid asserting non-contract visual copy. Assert semantic hooks (`role`/accessible name) or stable IDs, and keep at least one accessibility-text assertion (for example sr-only cart-count labels).

Generated E2E artifacts are written to `playwright-report/` and `test-results/`.

---

## What is tested

### Smoke / contracts (`tests/smoke/`)

Lightweight import-level checks that verify public API contracts without mocking any internals.

| File                        | Subjects                                                                                               |
| --------------------------- | ------------------------------------------------------------------------------------------------------ |
| `config.test.ts`            | `loadAppConfig`, `loadRuntimeEnv`, `getRequiredServerEnv`, `featureFlags`, `buildMetadata`, `routes`   |
| `storefront-shell.test.ts`  | All `routes.storefront.*` values, `loadSiteConfig().storefrontNav`                                     |
| `ui-foundation.test.ts`     | `loadSiteConfig()`, `formatPrice`, light palette tokens                                             |
| `ux-infrastructure.test.ts` | `toUserMessage`, `getFormErrorMessages`, `sanitizeForLogging`, `PageErrorFallback`, `FormErrorSummary` |

### Prisma / database (`tests/prisma/`)

| File               | Subjects                                            | Notes                                        |
| ------------------ | --------------------------------------------------- | -------------------------------------------- |
| `validate.test.ts` | `prisma validate`, `migrate diff`                   | Requires a live database; skipped in unit CI |
| `workflow.test.ts` | `buildPrismaProcessEnv`, `getMigrateDevSafetyCheck` | Blocks hosted DB URLs                        |

### Server / DB layer (`tests/server/db/`)

| File                   | Subjects                                                                               |
| ---------------------- | -------------------------------------------------------------------------------------- |
| `client.test.ts`       | `getPrismaClient()` singleton identity                                                 |
| `pagination.test.ts`   | `normalizePagination`, `createPaginationMeta`, `createPaginatedResult`                 |
| `query-result.test.ts` | `createQuerySuccess`, `createQueryFailure`, `isQuerySuccess`, `isQueryFailure`         |
| `transaction.test.ts`  | `runWithTransaction`, `runInTransaction`                                               |
| `validators.test.ts`   | `validateProductImageInput`                                                            |
| `repository.test.ts`   | `createRepositoryContext`, `createServiceContext`, `defineRepository`, `defineService` |

### Lib utilities (`tests/lib/`)

| File                            | Subjects                                                                                                                                                      |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `seo.test.ts`                   | `resolveCanonicalUrl`, `generateSlug`, `isValidSlug`                                                                                                          |
| `currency.test.ts`              | `formatPrice` — all numeric/string/edge cases                                                                                                                 |
| `auth/password.test.ts`         | `hashPassword`, `comparePassword`                                                                                                                             |
| `auth/rbac.test.ts`             | `evaluateRouteAccess`, `hasPermission`, `isAdminRole`, `buildAccessDeniedResponse`, `getAccessDeniedPath`, `createAdminAuditEntry`, `ForbiddenPage` rendering |
| `audit/admin-actions.test.ts`   | `createAdminAuditEntry`, `toAdminAuditLogData`, `logAdminAction`                                                                                              |
| `errors/error-handling.test.ts` | `toAppError`, `toActionErrorState`, `createRouteHandlerErrorResponse`, `AppError.exposeMessage`                                                               |
| `forms/dynamic-form.test.tsx`   | `DynamicForm` + `useAppForm` — all field types                                                                                                                |
| `rate-limit/rate-limit.test.ts` | `checkRateLimit` in-memory backend                                                                                                                            |
| `reviews/moderation.test.ts`    | `isReviewModerationStatus`, `isReviewVisibleOnStorefront`, `getReviewStatusLabel`                                                                             |
| `security/pii.test.ts`          | `maskEmail`, `stripControlChars`                                                                                                                              |
| `security/validation.test.ts`   | `emailAddressSchema`, `optionalDisplayNameSchema`, `createPasswordSchema`, `validateWithSchema`                                                               |

### Features (`tests/features/`)

#### Analytics

Analytics events (`trackEvent` for `PAGE_VIEW`, `PRODUCT_VIEW`, `ADD_TO_CART`, `BEGIN_CHECKOUT`, `PURCHASE`, `VIEW_ITEM_LIST`, `SELECT_ITEM`, `VIEW_CART`, `REMOVE_FROM_CART`, `ADD_TO_WISHLIST`, `SEARCH`, `SIGN_UP`) are dispatched to the GTM `dataLayer` via `sendGTMEvent` (GA4 + Meta Pixel are configured inside the GTM container). No unit tests are maintained for the event dispatcher itself.

#### Auth

`validators.test.ts` — `signInValidator`, `signUpValidator`, `forgotPasswordValidator`.  
`sign-in-action.test.ts` — `signInAction` open-redirect sanitization.  
`sign-out-action.test.ts` — `signOutAction` CSRF check ordering and redirect.  
`sign-out-ui.test.ts` — `StorefrontMobileNav` signed-in vs. signed-out states (SSR).  
`forms.test.tsx` — `SignInForm`, `SignUpForm` validation and `FormData` payload shape (jsdom).

#### Layout components

`app-header.test.tsx` — `AppHeader` storefront navbar (direct categories, `More` dropdown, `All Categories`, no duplicate links).  
`user-menu.test.tsx` — shared `<UserMenu />` page links, account/admin/sign-out controls, and `Your Orders` visibility (signed-in vs signed-out).  
`storefront-mobile-nav.test.tsx` — mobile drawer page links, wishlist/account actions, `Your Orders` (signed-in) and `Admin Panel` (admin) options; catalog categories absent.  
`mobile-bottom-nav.test.tsx` — five primary mobile actions, hrefs, shared overlays, active-route highlighting.

#### Blog

`helpers.test.ts` — `getBlogPosts`, `getBlogPostBySlug`, `getRelatedBlogPosts`, `toBlogMetadataInput`, all JSON-LD builders.

#### Cart

`service.test.ts` — `resolveCartSeedSelection`, `calculateCartSubtotal`, `validateCartStock`.  
`context.test.ts` — `getCartSummaryForContext` (token reuse, P2002 race condition, stale cart rotation).  
`abandoned-cart-events.test.ts` — `recordCartActivity`, `markCartAbandoned`, `markCartRecovered`.

#### Catalog

`filters.test.ts` — `parseCatalogSearchParams`, `buildCategoryListingHref`.  
`service.test.ts` — `getCatalogCategoryListing` with filters and sort.  
`search-service.test.ts` — `searchCatalogProducts` (category matching, plural widening, relevance ranking).  
`search-text.test.ts` — `tokenizeSearchQuery`, `expandSearchToken`, `tokenMatchesText`.  
`product-detail.test.ts` — `getProductBySlug`, `getRelatedProducts`.  
`product-service.test.ts` — `getProductBySlug` (variants, reviews, href), `getProductSlugsWithCategory`.

#### Checkout

`validation.test.ts` — `checkoutPayloadSchema`.  
`totals.test.ts` — `calculateCheckoutTotals`, `CHECKOUT_SHIPPING_FEE`.  
`payment.test.ts` — `listCheckoutPaymentMethods`, `getCheckoutPaymentProvider`.  
`client.test.ts` — `submitCheckoutRequest` success/error/malformed-response handling.  
`checkout-page-client.test.tsx` — `CheckoutPageClient` field validation, payload shape, retry-button disable (jsdom).

#### Contact

`validation.test.ts` — `contactFormSchema`.  
`notifications.test.ts` — `buildNotificationPlan` for `contact.form-submitted`.  
`actions.test.ts` — `submitContactForm` (DB write, notification, validation rejection).

#### Email marketing

`validation.test.ts` — `subscribeInputSchema`, `unsubscribeTokenSchema`.  
`service.test.ts` — `subscribeEmail`, `unsubscribeByToken` (all subscriber status paths).

#### Homepage

`service.test.ts` — `getHomepageContent` CMS → storefront contract.  
`section-rendering.test.ts` — `resolveHomepageSections`, `hasRegisteredSectionComponent`, `SECTION_RENDER_ORDER`.

#### Notifications

`templates.test.ts` — `buildNotificationPlan` for all event types.  
`service.test.ts` — `createNotificationService().dispatch` (delivery counting, failure resilience).

#### Orders

`status.test.ts` — `formatOrderStatusLabel`, `getNextOrderStatuses`, `canTransitionOrderStatus`, `assertOrderStatusTransition`.  
`service.test.ts` — `placeOrderFromCheckout` (transactional, audit, notifications, stock guard), `updateOrderStatus`.  
`reorder.test.ts` — `resolveReorderLineDecision` (all quantity decision branches).  
`invoice.test.ts` — URL builders, `createOrderNumber`, `createInvoiceNumber`, `buildInvoicePdf`.

#### Wishlist

`service.test.ts` — `addWishlistItemForUser`, `resolveWishlistSeedSelection`.

#### Admin — navigation

`navigation.test.ts` — `getVisibleAdminNavigation` per role.

#### Admin — categories

`validation.test.ts` — `validateCategoryCreateInput`, `validateCategoryUpdateInput`.  
`service.test.ts` — `listAdminCategories`, `createAdminCategory`, `updateAdminCategory`, `deleteAdminCategory`.  
`admin-category-filters-form.test.tsx` — `AdminCategoryFiltersForm` query string push (jsdom).  
`admin-category-form.test.tsx` — `AdminCategoryForm` Next.js redirect digest, payload shape (jsdom).

#### Admin — homepage

`validation.test.ts` — `validateAdminHomepageSectionInput`, `validateAdminBannerInput`, `validateAdminDealCampaignInput`.  
`forms.test.tsx` — `AdminBannerForm`, `AdminDealCampaignForm`, `AdminHomepageSectionForm` (jsdom).

#### Admin — orders

`service.test.ts` — `listAdminOrders`, `saveAdminOrderInternalNote`.

#### Admin — products

`validation.test.ts` — `validateAdminProductCreateInput`, `validateAdminProductUpdateInput`.  
`service.test.ts` — `listAdminProducts`, `createAdminProduct`, `updateAdminProduct`.

#### Admin — reviews

`service.test.ts` — `listAdminReviews`, `moderateAdminReview`, `isReviewVisibleOnStorefront`, legacy schema fallback.

#### Admin — SEO

`helpers.test.ts` — `createSlugCandidate`, `adminSeoFieldsSchema`, `adminSlugSchema`, `buildAdminSeoPreview`.

---

## What still needs tests

The following areas have no or limited coverage. Contributions welcome.

### High priority

| Area              | Path                                   | Notes                                                   |
| ----------------- | -------------------------------------- | ------------------------------------------------------- |
| `account` feature | `src/features/account/`                | No tests at all; shell component and any server actions |
| `auth/session`    | `src/lib/auth/session.ts`              | Session resolution helpers                              |
| `auth/guards`     | `src/lib/auth/guards.ts`               | Route guard helpers                                     |
| `auth/client`     | `src/lib/auth/client.ts`               | Client-side session helpers                             |
| Admin SEO service | `src/features/admin/seo/`              | Service layer untested (only schema helpers covered)    |
| `logger`          | `src/lib/logger.ts`                    | `sanitizeForLogging`, `logger.child()` behaviour        |
| Email channels    | `src/features/notifications/channels/` | `email`, `telegram` channel modules                     |

### Medium priority

| Area                     | Path                                     | Notes                                     |
| ------------------------ | ---------------------------------------- | ----------------------------------------- |
| `wishlist` UI components | `src/features/wishlist/components/`      | Toggle/remove button interactions         |
| `catalog` UI components  | `src/features/catalog/components/`       | Filter panel, product card, sort controls |
| `orders` server actions  | `src/features/orders/actions/`           | `reorder` action                          |
| Admin product actions    | `src/features/admin/products/actions.ts` | Create/update/delete action flows         |
| Admin review actions     | `src/features/admin/reviews/actions.ts`  | Moderation action flows                   |
| `checkout` service       | `src/features/checkout/service.ts`       | Order creation orchestration              |

### Low priority / deferred

| Area                          | Notes                                                     |
| ----------------------------- | --------------------------------------------------------- |
| Next.js app-dir pages/layouts | Best covered by E2E tests (Playwright), not unit tests    |
| Prisma migrations             | Covered by `tests/prisma/validate.test.ts` with a live DB |
| Email template rendering      | Requires an email provider stub or snapshot strategy      |

---

## Testing conventions

### File locations

```
tests/
├── smoke/          # contract checks — no DB, no network
├── prisma/         # schema and migration integrity (requires live DB)
├── server/db/      # server/db layer utilities
├── lib/            # src/lib/* utilities
│   ├── audit/
│   ├── auth/
│   ├── errors/
│   ├── forms/
│   ├── rate-limit/
│   ├── reviews/
│   └── security/
├── features/       # one sub-directory per feature module
│   ├── admin/
│   ├── analytics/
│   ├── auth/
│   ├── blog/
│   ├── cart/
│   ├── catalog/
│   ├── checkout/
│   ├── contact/
│   ├── email-marketing/
│   ├── homepage/
│   ├── notifications/
│   ├── orders/
│   └── wishlist/
└── helpers/        # shared utilities (not tests themselves)
    ├── setup.ts    # global vitest setup — extends expect with jest-dom matchers
    ├── prisma.ts   # mockPrismaModel(), createDbMock()
    └── next.ts     # mockNextHeaders(), mockNextNavigation(), setupDomStubs()
```

### Environments

- Default: **node** (set in `vitest.config.ts`).
- React/DOM tests: add `// @vitest-environment jsdom` as the first line of the file and call `setupDomStubs()` from `@tests/helpers/next` inside `beforeAll()`.

### Mocking strategy

**Prisma / database** — mock at the `@/server/db` or `@/lib/prisma` boundary using `vi.hoisted()`:

```ts
import { mockPrismaModel } from "@tests/helpers/prisma";

const prismaMock = vi.hoisted(() => ({
  product: mockPrismaModel(),
  category: mockPrismaModel(),
}));

vi.mock("@/server/db", () => ({
  getPrismaClient: () => prismaMock,
  runWithTransaction: async (cb: (db: typeof prismaMock) => Promise<unknown>) => cb(prismaMock),
}));
```

**Next.js internals** — use the factories in `@tests/helpers/next`:

```ts
import { mockNextNavigation } from "@tests/helpers/next";

const nav = vi.hoisted(() => mockNextNavigation());
vi.mock("next/navigation", () => nav);
```

**Pure functions** — import and call directly; no mocking required (catalog filters, blog helpers, order status, validators, etc.).

### jest-dom matchers

`@testing-library/jest-dom` matchers (`.toBeInTheDocument()`, `.toHaveTextContent()`, etc.) are automatically available in all test files via the global setup file. No manual import is needed.

---

## Coverage

Run `pnpm test:coverage` to generate a coverage report. The V8 provider is used for accurate instrumentation of TypeScript source.

**Excluded from coverage** (configured in `vitest.config.ts`):

- `src/app/**` — Next.js route files (pages, layouts, API handlers) — better validated by integration/E2E tests
- `src/config/**` — configuration modules smoke-tested separately
- `src/**/index.ts` — re-export barrels
- `src/**/*.d.ts`, `src/**/types.ts`, `src/**/types/**` — type-only files

Coverage artifacts are written to `coverage/` (gitignored). The `json-summary` reporter produces `coverage/coverage-summary.json` which CI can consume for badge generation or threshold enforcement.

---

## CI integration

The `test:ci` script runs all tests with a verbose reporter suitable for log parsers:

```bash
pnpm test:ci
```

Recommended CI step (GitHub Actions example):

```yaml
- name: Run tests
  run: pnpm test:ci

- name: Generate coverage
  run: pnpm test:coverage
  if: github.ref == 'refs/heads/main'
```

The prisma integration tests (`tests/prisma/validate.test.ts`) require a live database and will fail in environments without one. Exclude them from the fast CI unit-test step using Vitest's `--exclude` flag if needed:

```bash
pnpm vitest run --exclude tests/prisma
```
