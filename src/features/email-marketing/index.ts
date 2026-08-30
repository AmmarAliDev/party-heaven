/**
 * Email marketing feature — public API.
 *
 * Import from this barrel; do not import directly from internal modules.
 */

export type { EmailCampaignProvider, ProviderSubscriberInput, ProviderSyncResult } from "./provider";
export {
  getEmailCampaignProvider,
  resetEmailCampaignProvider,
  setEmailCampaignProvider,
} from "./providers/index";
export { emailSubscriberRepository } from "./repository";
export { subscribeEmail, unsubscribeByToken } from "./service";
export type {
  EmailSubscriber,
  SubscribeInput,
  SubscribeResult,
  SubscriberStatus,
  UnsubscribeInput,
  UnsubscribeResult,
} from "./types";
export type { SubscribeInputValues, UnsubscribeTokenValues } from "./validation";
export { subscribeInputSchema, unsubscribeTokenSchema } from "./validation";
