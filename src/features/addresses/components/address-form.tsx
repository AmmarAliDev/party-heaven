"use client";

import type { z } from "zod";

import { DynamicForm, type DynamicFormFieldConfig, useAppForm } from "@/components/forms";

import type { SavedAddress, SavedAddressInput } from "../types";
import {
  SAVED_ADDRESS_CITY,
  SAVED_ADDRESS_COUNTRY,
  SAVED_ADDRESS_PROVINCE,
  savedAddressInputSchema,
} from "../validation";

type AddressFormValues = z.infer<typeof savedAddressInputSchema>;

type AddressFormProps = {
  initial?: SavedAddress | null;
  submitLabel: string;
  submittingLabel?: string;
  onSubmit: (input: SavedAddressInput) => Promise<void>;
};

function toFormValues(initial?: SavedAddress | null): AddressFormValues {
  return {
    label: initial?.label ?? "",
    addressLine1: initial?.addressLine1 ?? "",
    addressLine2: initial?.addressLine2 ?? "",
    city: initial?.city ?? SAVED_ADDRESS_CITY,
    province: initial?.province ?? SAVED_ADDRESS_PROVINCE,
    country: initial?.country ?? SAVED_ADDRESS_COUNTRY,
    postcode: initial?.postcode ?? "",
    phone: initial?.phone ?? "",
  };
}

const addressFormFields: DynamicFormFieldConfig<AddressFormValues>[] = [
//   {
//     id: "address-label",
//     type: "text",
//     name: "label",
//     label: "Label",
//     description: "Optional label such as Home or Office.",
//     placeholder: "Home",
//   },
  {
    id: "address-line-1",
    type: "text",
    name: "addressLine1",
    label: "Address",
    autoComplete: "address-line1",
    placeholder: "House, street, area",
    required: true,
    containerClassName: "sm:col-span-2",
  },
  {
    id: "address-city",
    type: "text",
    name: "city",
    label: "City",
    disabled: true,
  },
//   {
//     id: "address-province",
//     type: "text",
//     name: "province",
//     label: "Province",
//     disabled: true,
//   },
//   {
//     id: "address-country",
//     type: "text",
//     name: "country",
//     label: "Country",
//     disabled: true,
//   },
  {
    id: "address-postcode",
    type: "text",
    name: "postcode",
    label: "Postal code (optional)",
    inputMode: "numeric",
    autoComplete: "postal-code",
    placeholder: "75500",
  },
  {
    id: "address-phone",
    type: "text",
    name: "phone",
    label: "Phone (optional)",
    autoComplete: "tel",
    placeholder: "03xx xxxxxxx",
  },
];

/**
 * Shared form for creating and editing a saved delivery address.
 *
 * City is locked to the currently supported region (Karachi) and rendered as a
 * disabled field; province / country / label are intentionally hidden for now
 * but still stored with their region defaults.
 */
export function AddressForm({
  initial = null,
  submitLabel,
  submittingLabel = "Saving...",
  onSubmit,
}: AddressFormProps) {
  const form = useAppForm<AddressFormValues>({
    schema: savedAddressInputSchema,
    defaultValues: toFormValues(initial),
  });

  return (
    <DynamicForm
      form={form}
      fields={addressFormFields}
      onSubmit={onSubmit}
      submitLabel={submitLabel}
      submittingLabel={submittingLabel}
      fieldsClassName="sm:grid-cols-2"
      formErrorTitle="Address details need attention"
    />
  );
}
