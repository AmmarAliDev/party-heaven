/**
 * Meta Conversion API (CAPI) — server-only feature module.
 *
 * IMPORTANT: This module uses server-only APIs (`node:crypto`, `next/headers`,
 * server env). It must NOT be re-exported from the client-facing
 * `src/features/analytics` barrel. Import it only from route handlers and
 * server services (e.g. `@/features/orders/service.ts`).
 */
export type { MetaCapiConfig } from "./config";
export {
  getMetaCapiConfig,
  isMetaCapiEnabled,
  META_CAPI_DEFAULT_GRAPH_VERSION,
} from "./config";
export {
  hashUserData,
  hashValue,
  normalizeEmail,
  normalizeName,
  normalizePhone,
  splitFullName,
} from "./hash";
export type { MetaCapiSupplementalInput } from "./payload";
export {
  buildPurchaseEvent,
  buildSupplementalEvent,
  META_CAPI_CURRENCY,
  toMetaCapiContentItems,
} from "./payload";
export { fireMetaCapiPurchaseSafely } from "./purchase";
export { sendMetaCapiEvents } from "./sender";
export type {
  MetaCapiActionSource,
  MetaCapiContentItem,
  MetaCapiCustomData,
  MetaCapiEvent,
  MetaCapiPurchaseInput,
  MetaCapiSendResult,
  MetaCapiStandardEvent,
  MetaCapiUserData,
} from "./types";
