import { City, Country, type Prisma } from "@prisma/client";

import { AppError } from "@/lib/errors/app-error";
import type { DatabaseExecutor } from "@/server/db";
import { getPrismaClient, runWithTransaction } from "@/server/db";

import type { SavedAddress, SavedAddressInput, UpsertSavedAddressResult } from "./types";

type AddressRecord = Prisma.AddressGetPayload<Record<string, never>>;

function toSavedAddress(address: AddressRecord): SavedAddress {
  return {
    id: address.id,
    label: address.label,
    addressLine1: address.street1,
    addressLine2: address.street2,
    city: address.city === City.KARACHI ? "Karachi" : address.city,
    province: address.province,
    country: address.country === Country.PAK ? "Pakistan" : address.country,
    postcode: address.postcode,
    phone: address.phone,
    isDefault: address.isDefault,
    createdAt: address.createdAt.toISOString(),
    updatedAt: address.updatedAt.toISOString(),
  };
}

function mapCityToEnum(city: string): City {
  const normalized = city.trim().toLowerCase();
  if (normalized === "karachi") {
    return City.KARACHI;
  }
  throw new AppError(`Unsupported city: ${city}`, "ADDRESS_CITY_UNSUPPORTED", {
    statusCode: 400,
    userMessage: "We currently ship only to Karachi.",
  });
}

function mapCountryToEnum(country: string): Country {
  const normalized = country.trim().toLowerCase();
  if (normalized === "pakistan" || normalized === "pak" || normalized === "pk") {
    return Country.PAK;
  }
  throw new AppError(`Unsupported country: ${country}`, "ADDRESS_COUNTRY_UNSUPPORTED", {
    statusCode: 400,
    userMessage: "We currently ship only within Pakistan.",
  });
}

function buildAddressData(input: SavedAddressInput) {
  return {
    label: input.label?.trim() || null,
    street1: input.addressLine1.trim(),
    street2: input.addressLine2?.trim() || null,
    city: mapCityToEnum(input.city),
    province: input.province.trim(),
    country: mapCountryToEnum(input.country),
    postcode: input.postcode?.trim() || null,
    phone: input.phone?.trim() || null,
  };
}

async function clearOtherDefaults(
  tx: DatabaseExecutor,
  userId: string,
  exceptId?: string,
) {
  const where: Prisma.AddressWhereInput = {
    userId,
    isDefault: true,
    ...(exceptId ? { id: { not: exceptId } } : {}),
  };

  await tx.address.updateMany({
    where,
    data: { isDefault: false },
  });
}

export async function listSavedAddresses(userId: string): Promise<SavedAddress[]> {
  const db = getPrismaClient();
  const addresses = await db.address.findMany({
    where: { userId },
    orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
  });

  return addresses.map(toSavedAddress);
}

export async function getSavedAddress(
  userId: string,
  addressId: string,
): Promise<SavedAddress | null> {
  const db = getPrismaClient();
  const address = await db.address.findFirst({
    where: { id: addressId, userId },
  });

  return address ? toSavedAddress(address) : null;
}

/**
 * Saves an address for the user.
 *
 * If an address with the same street1 already exists it is updated in place
 * (used by the checkout "Save" button to avoid creating duplicates); otherwise
 * a new row is created. The first saved address automatically becomes the
 * default, and an explicit `isDefault: true` clears all other defaults.
 */
export async function upsertSavedAddress(
  userId: string,
  input: SavedAddressInput,
): Promise<UpsertSavedAddressResult> {
  return runWithTransaction(async (tx) => {
    const street1 = input.addressLine1.trim();
    const existing = await tx.address.findFirst({
      where: { userId, street1 },
    });

    if (existing) {
      const wantsDefault = input.isDefault === true;
      const keepDefault = existing.isDefault || wantsDefault;

      if (wantsDefault) {
        await clearOtherDefaults(tx, userId, existing.id);
      }

      const updated = await tx.address.update({
        where: { id: existing.id },
        data: {
          ...buildAddressData(input),
          ...(keepDefault ? { isDefault: true } : {}),
        },
      });

      return { address: toSavedAddress(updated), created: false };
    }

    const count = await tx.address.count({ where: { userId } });
    const makeDefault = input.isDefault === true || count === 0;

    if (makeDefault) {
      await clearOtherDefaults(tx, userId);
    }

    const created = await tx.address.create({
      data: {
        ...buildAddressData(input),
        userId,
        isDefault: makeDefault,
      },
    });

    return { address: toSavedAddress(created), created: true };
  });
}

export async function updateSavedAddress(
  userId: string,
  addressId: string,
  input: SavedAddressInput,
): Promise<SavedAddress> {
  return runWithTransaction(async (tx) => {
    const existing = await tx.address.findFirst({
      where: { id: addressId, userId },
    });

    if (!existing) {
      throw new AppError("Address not found.", "ADDRESS_NOT_FOUND", {
        statusCode: 404,
        userMessage: "This address could not be found. It may have been removed.",
      });
    }

    const wantsDefault = input.isDefault === true;
    if (wantsDefault) {
      await clearOtherDefaults(tx, userId, addressId);
    }

    const updated = await tx.address.update({
      where: { id: addressId },
      data: {
        ...buildAddressData(input),
        ...(wantsDefault ? { isDefault: true } : {}),
      },
    });

    return toSavedAddress(updated);
  });
}

export async function setDefaultSavedAddress(
  userId: string,
  addressId: string,
): Promise<SavedAddress> {
  return runWithTransaction(async (tx) => {
    const existing = await tx.address.findFirst({
      where: { id: addressId, userId },
    });

    if (!existing) {
      throw new AppError("Address not found.", "ADDRESS_NOT_FOUND", {
        statusCode: 404,
        userMessage: "This address could not be found. It may have been removed.",
      });
    }

    await clearOtherDefaults(tx, userId, addressId);
    const updated = await tx.address.update({
      where: { id: addressId },
      data: { isDefault: true },
    });

    return toSavedAddress(updated);
  });
}

export async function deleteSavedAddress(
  userId: string,
  addressId: string,
): Promise<{ removed: boolean }> {
  const db = getPrismaClient();
  const result = await db.address.deleteMany({
    where: { id: addressId, userId },
  });

  return { removed: result.count > 0 };
}
