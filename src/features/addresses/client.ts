import { AppError } from "@/lib/errors/app-error";

import type { SavedAddress, SavedAddressInput, UpsertSavedAddressResult } from "./types";

type ApiErrorPayload = { error?: string } | null;

function extractErrorMessage(payload: ApiErrorPayload, fallback: string) {
  return payload?.error ?? fallback;
}

async function readErrorPayload(response: Response): Promise<ApiErrorPayload> {
  return (await response.json().catch(() => null)) as ApiErrorPayload;
}

export async function listSavedAddressesRequest(
  fetchImplementation: typeof fetch = fetch,
): Promise<SavedAddress[]> {
  let response: Response;

  try {
    response = await fetchImplementation("/api/addresses", {
      method: "GET",
      cache: "no-store",
    });
  } catch (error) {
    throw new AppError("Address list request failed before reaching the server.", "ADDRESSES_NETWORK_ERROR", {
      cause: error,
      userMessage: "Unable to load your addresses right now. Please check your connection and try again.",
    });
  }

  if (!response.ok) {
    throw new AppError("Address list request was rejected.", "ADDRESSES_LIST_FAILED", {
      statusCode: response.status,
      userMessage: extractErrorMessage(
        await readErrorPayload(response),
        "We could not load your saved addresses. Please try again.",
      ),
    });
  }

  const payload = (await response.json().catch(() => null)) as {
    ok?: boolean;
    addresses?: SavedAddress[];
  } | null;

  if (!payload?.ok || !Array.isArray(payload.addresses)) {
    throw new AppError("Address API returned an invalid list payload.", "ADDRESSES_RESPONSE_INVALID", {
      userMessage: "We could not load your saved addresses. Please try again.",
    });
  }

  return payload.addresses;
}

export async function upsertSavedAddressRequest(
  input: SavedAddressInput,
  fetchImplementation: typeof fetch = fetch,
): Promise<UpsertSavedAddressResult> {
  let response: Response;

  try {
    response = await fetchImplementation("/api/addresses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(input),
    });
  } catch (error) {
    throw new AppError("Address save request failed before reaching the server.", "ADDRESSES_NETWORK_ERROR", {
      cause: error,
      userMessage: "Unable to save your address right now. Please check your connection and try again.",
    });
  }

  if (!response.ok) {
    throw new AppError("Address save request was rejected.", "ADDRESSES_SAVE_FAILED", {
      statusCode: response.status,
      userMessage: extractErrorMessage(
        await readErrorPayload(response),
        "We could not save this address. Please try again.",
      ),
    });
  }

  const payload = (await response.json().catch(() => null)) as {
    ok?: boolean;
    address?: SavedAddress;
    created?: boolean;
  } | null;

  if (!payload?.ok || !payload.address) {
    throw new AppError("Address API returned an invalid save payload.", "ADDRESSES_RESPONSE_INVALID", {
      userMessage: "We could not save this address. Please try again.",
    });
  }

  return {
    address: payload.address,
    created: payload.created === true,
  };
}

export async function updateSavedAddressRequest(
  addressId: string,
  input: SavedAddressInput,
  fetchImplementation: typeof fetch = fetch,
): Promise<SavedAddress> {
  let response: Response;

  try {
    response = await fetchImplementation(`/api/addresses/${addressId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(input),
    });
  } catch (error) {
    throw new AppError("Address update request failed before reaching the server.", "ADDRESSES_NETWORK_ERROR", {
      cause: error,
      userMessage: "Unable to update your address right now. Please check your connection and try again.",
    });
  }

  if (!response.ok) {
    throw new AppError("Address update request was rejected.", "ADDRESSES_UPDATE_FAILED", {
      statusCode: response.status,
      userMessage: extractErrorMessage(
        await readErrorPayload(response),
        "We could not update this address. Please try again.",
      ),
    });
  }

  const payload = (await response.json().catch(() => null)) as {
    ok?: boolean;
    address?: SavedAddress;
  } | null;

  if (!payload?.ok || !payload.address) {
    throw new AppError("Address API returned an invalid update payload.", "ADDRESSES_RESPONSE_INVALID", {
      userMessage: "We could not update this address. Please try again.",
    });
  }

  return payload.address;
}

export async function setDefaultSavedAddressRequest(
  addressId: string,
  fetchImplementation: typeof fetch = fetch,
): Promise<SavedAddress> {
  let response: Response;

  try {
    response = await fetchImplementation(`/api/addresses/${addressId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ isDefault: true }),
    });
  } catch (error) {
    throw new AppError("Address default request failed before reaching the server.", "ADDRESSES_NETWORK_ERROR", {
      cause: error,
      userMessage: "Unable to update your default address right now. Please check your connection and try again.",
    });
  }

  if (!response.ok) {
    throw new AppError("Address default request was rejected.", "ADDRESSES_UPDATE_FAILED", {
      statusCode: response.status,
      userMessage: extractErrorMessage(
        await readErrorPayload(response),
        "We could not update your default address. Please try again.",
      ),
    });
  }

  const payload = (await response.json().catch(() => null)) as {
    ok?: boolean;
    address?: SavedAddress;
  } | null;

  if (!payload?.ok || !payload.address) {
    throw new AppError("Address API returned an invalid default payload.", "ADDRESSES_RESPONSE_INVALID", {
      userMessage: "We could not update your default address. Please try again.",
    });
  }

  return payload.address;
}

export async function deleteSavedAddressRequest(
  addressId: string,
  fetchImplementation: typeof fetch = fetch,
): Promise<{ removed: boolean }> {
  let response: Response;

  try {
    response = await fetchImplementation(`/api/addresses/${addressId}`, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
      },
    });
  } catch (error) {
    throw new AppError("Address delete request failed before reaching the server.", "ADDRESSES_NETWORK_ERROR", {
      cause: error,
      userMessage: "Unable to remove this address right now. Please check your connection and try again.",
    });
  }

  if (!response.ok) {
    throw new AppError("Address delete request was rejected.", "ADDRESSES_DELETE_FAILED", {
      statusCode: response.status,
      userMessage: extractErrorMessage(
        await readErrorPayload(response),
        "We could not remove this address. Please try again.",
      ),
    });
  }

  const payload = (await response.json().catch(() => null)) as {
    ok?: boolean;
    removed?: boolean;
  } | null;

  if (!payload?.ok) {
    throw new AppError("Address API returned an invalid delete payload.", "ADDRESSES_RESPONSE_INVALID", {
      userMessage: "We could not remove this address. Please try again.",
    });
  }

  return { removed: payload.removed === true };
}
