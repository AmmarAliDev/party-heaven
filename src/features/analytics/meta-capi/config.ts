import { type EnvSource, loadServerEnv } from "@/config/env";
import { createLogger } from "@/lib/logger";

/**
 * Meta Conversion API configuration, resolved lazily from server-only env
 * variables so importing this module has no side effects and never crashes
 * when the variables are absent.
 */

export const META_CAPI_DEFAULT_GRAPH_VERSION = "v21.0";

export type MetaCapiConfig = {
  pixelId: string;
  accessToken: string;
  /** Optional "Test Events" code used by Meta Events Manager for validation. */
  testEventCode?: string;
  graphVersion: string;
};

const metaCapiLogger = createLogger("analytics.meta-capi");

/**
 * Returns the resolved CAPI config when both `META_PIXEL_ID` and
 * `META_CAPI_ACCESS_TOKEN` are configured, otherwise `null`. A config error is
 * logged and treated as disabled so analytics never breaks the app.
 */
export function getMetaCapiConfig(rawEnv: EnvSource = process.env): MetaCapiConfig | null {
  try {
    const serverEnv = loadServerEnv(rawEnv);

    const pixelId = serverEnv.META_PIXEL_ID;
    const accessToken = serverEnv.META_CAPI_ACCESS_TOKEN;

    if (!pixelId || !accessToken) {
      return null;
    }

    const graphVersion =
      (serverEnv.META_CAPI_GRAPH_VERSION ?? META_CAPI_DEFAULT_GRAPH_VERSION).trim() ||
      META_CAPI_DEFAULT_GRAPH_VERSION;

    return {
      pixelId,
      accessToken,
      ...(serverEnv.META_CAPI_TEST_EVENT_CODE
        ? { testEventCode: serverEnv.META_CAPI_TEST_EVENT_CODE.trim() }
        : {}),
      graphVersion,
    };
  } catch (error) {
    metaCapiLogger.warn("meta conversion api config could not be loaded; CAPI disabled", error);
    return null;
  }
}

/** `true` when the Meta Conversion API is configured and ready to send. */
export function isMetaCapiEnabled(rawEnv: EnvSource = process.env): boolean {
  return getMetaCapiConfig(rawEnv) !== null;
}
