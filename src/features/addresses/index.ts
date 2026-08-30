export {
  deleteSavedAddressRequest,
  listSavedAddressesRequest,
  setDefaultSavedAddressRequest,
  updateSavedAddressRequest,
  upsertSavedAddressRequest,
} from "./client";
export {
  deleteSavedAddress,
  getSavedAddress,
  listSavedAddresses,
  setDefaultSavedAddress,
  updateSavedAddress,
  upsertSavedAddress,
} from "./service";
export type { SavedAddress, SavedAddressInput, UpsertSavedAddressResult } from "./types";
export {
  SAVED_ADDRESS_CITY,
  SAVED_ADDRESS_COUNTRY,
  SAVED_ADDRESS_PROVINCE,
  savedAddressInputSchema,
} from "./validation";
