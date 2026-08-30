/**
 * A saved delivery address owned by a signed-in user.
 *
 * City/province/country are exposed as display strings ("Karachi",
 * "Sindh", "Pakistan") — the only values currently supported for delivery.
 */
export type SavedAddress = {
  id: string;
  /** Optional friendly label ("Home", "Office", ...). */
  label: string | null;
  addressLine1: string;
  addressLine2: string | null;
  city: string;
  province: string | null;
  country: string;
  postcode: string | null;
  phone: string | null;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
};

/** Payload used to create or update a saved address. */
export type SavedAddressInput = {
  label?: string | undefined;
  addressLine1: string;
  addressLine2?: string | undefined;
  city: string;
  province: string;
  country: string;
  postcode?: string | undefined;
  phone?: string | undefined;
  isDefault?: boolean | undefined;
};

export type UpsertSavedAddressResult = {
  address: SavedAddress;
  /** True when a new row was created; false when an existing row was updated. */
  created: boolean;
};
