import { beforeEach, describe, expect, it, vi } from "vitest";

const addressMock = vi.hoisted(() => ({
  findMany: vi.fn(),
  findFirst: vi.fn(),
  count: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  updateMany: vi.fn(),
  deleteMany: vi.fn(),
}));

vi.mock("@/server/db", () => ({
  getPrismaClient: () => ({ address: addressMock }),
  runWithTransaction: async (
    callback: (db: { address: typeof addressMock }) => Promise<unknown>,
  ) => callback({ address: addressMock }),
}));

import {
  deleteSavedAddress,
  getSavedAddress,
  listSavedAddresses,
  setDefaultSavedAddress,
  updateSavedAddress,
  upsertSavedAddress,
} from "@/features/addresses";

function buildAddressRecord(overrides: Partial<typeof baseAddress> = {}) {
  return { ...baseAddress, ...overrides };
}

const baseAddress = {
  id: "address-1",
  userId: "user-1",
  label: "Home",
  country: "PAK",
  province: "Sindh",
  city: "KARACHI",
  postcode: "75500",
  street1: "House 1, Street 2",
  street2: null,
  phone: "03001234567",
  isDefault: true,
  createdAt: new Date("2026-01-01T00:00:00Z"),
  updatedAt: new Date("2026-01-01T00:00:00Z"),
};

describe("addresses service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("lists saved addresses mapped to display values", async () => {
    addressMock.findMany.mockResolvedValue([
      buildAddressRecord({ id: "address-1", isDefault: true }),
      buildAddressRecord({ id: "address-2", isDefault: false, label: "Office" }),
    ]);

    const addresses = await listSavedAddresses("user-1");

    expect(addressMock.findMany).toHaveBeenCalledWith({
      where: { userId: "user-1" },
      orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
    });
    expect(addresses).toEqual([
      expect.objectContaining({
        id: "address-1",
        addressLine1: "House 1, Street 2",
        city: "Karachi",
        country: "Pakistan",
        province: "Sindh",
        postcode: "75500",
        phone: "03001234567",
        isDefault: true,
      }),
      expect.objectContaining({ id: "address-2", label: "Office" }),
    ]);
  });

  it("returns null when a saved address is not owned by the user", async () => {
    addressMock.findFirst.mockResolvedValue(null);

    const address = await getSavedAddress("user-1", "missing");

    expect(address).toBeNull();
    expect(addressMock.findFirst).toHaveBeenCalledWith({
      where: { id: "missing", userId: "user-1" },
    });
  });

  it("creates the first address as default", async () => {
    addressMock.findFirst.mockResolvedValue(null);
    addressMock.count.mockResolvedValue(0);
    addressMock.create.mockResolvedValue(buildAddressRecord({ id: "new-1", isDefault: true }));

    const result = await upsertSavedAddress("user-1", {
      addressLine1: "House 1, Street 2",
      city: "Karachi",
      province: "Sindh",
      country: "Pakistan",
      postcode: "75500",
    });

    expect(result.created).toBe(true);
    expect(addressMock.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: "user-1",
          street1: "House 1, Street 2",
          city: "KARACHI",
          country: "PAK",
          postcode: "75500",
          isDefault: true,
        }),
      }),
    );
  });

  it("stores a null postcode when none is provided", async () => {
    addressMock.findFirst.mockResolvedValue(null);
    addressMock.count.mockResolvedValue(0);
    addressMock.create.mockResolvedValue(buildAddressRecord({ id: "new-1", isDefault: true }));

    await upsertSavedAddress("user-1", {
      addressLine1: "House 1, Street 2",
      city: "Karachi",
      province: "Sindh",
      country: "Pakistan",
    });

    expect(addressMock.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ postcode: null }),
      }),
    );
  });

  it("updates an existing address with the same street1 instead of duplicating", async () => {
    addressMock.findFirst.mockResolvedValue(buildAddressRecord({ id: "address-1" }));
    addressMock.update.mockResolvedValue(
      buildAddressRecord({ id: "address-1", label: "Updated", isDefault: true }),
    );

    const result = await upsertSavedAddress("user-1", {
      label: "Updated",
      addressLine1: "House 1, Street 2",
      city: "Karachi",
      province: "Sindh",
      country: "Pakistan",
      postcode: "75500",
    });

    expect(result.created).toBe(false);
    expect(addressMock.create).not.toHaveBeenCalled();
    expect(addressMock.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "address-1" },
        data: expect.objectContaining({ label: "Updated", isDefault: true }),
      }),
    );
  });

  it("clears other defaults when saving with isDefault true", async () => {
    addressMock.findFirst.mockResolvedValue(null);
    addressMock.count.mockResolvedValue(3);
    addressMock.create.mockResolvedValue(buildAddressRecord({ id: "new-1", isDefault: true }));

    await upsertSavedAddress("user-1", {
      addressLine1: "House 9, Street 9",
      city: "Karachi",
      province: "Sindh",
      country: "Pakistan",
      postcode: "75500",
      isDefault: true,
    });

    expect(addressMock.updateMany).toHaveBeenCalledWith({
      where: { userId: "user-1", isDefault: true },
      data: { isDefault: false },
    });
    expect(addressMock.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ isDefault: true }),
      }),
    );
  });

  it("throws ADDRESS_NOT_FOUND when updating a missing address", async () => {
    addressMock.findFirst.mockResolvedValue(null);

    await expect(
      updateSavedAddress("user-1", "missing", {
        addressLine1: "House 1, Street 2",
        city: "Karachi",
        province: "Sindh",
        country: "Pakistan",
        postcode: "75500",
      }),
    ).rejects.toMatchObject({ code: "ADDRESS_NOT_FOUND", statusCode: 404 });
  });

  it("updates an address and keeps default when isDefault true", async () => {
    addressMock.findFirst.mockResolvedValue(buildAddressRecord({ id: "address-1", isDefault: false }));
    addressMock.update.mockResolvedValue(buildAddressRecord({ id: "address-1", isDefault: true }));

    const updated = await updateSavedAddress("user-1", "address-1", {
      addressLine1: "House 2, Street 3",
      city: "Karachi",
      province: "Sindh",
      country: "Pakistan",
      postcode: "75500",
      isDefault: true,
    });

    expect(addressMock.updateMany).toHaveBeenCalledWith({
      where: { userId: "user-1", id: { not: "address-1" }, isDefault: true },
      data: { isDefault: false },
    });
    expect(addressMock.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "address-1" },
        data: expect.objectContaining({ street1: "House 2, Street 3", isDefault: true }),
      }),
    );
    expect(updated.isDefault).toBe(true);
  });

  it("sets a default address and clears the previous one", async () => {
    addressMock.findFirst.mockResolvedValue(buildAddressRecord({ id: "address-2", isDefault: false }));
    addressMock.update.mockResolvedValue(buildAddressRecord({ id: "address-2", isDefault: true }));

    const updated = await setDefaultSavedAddress("user-1", "address-2");

    expect(addressMock.updateMany).toHaveBeenCalledWith({
      where: { userId: "user-1", id: { not: "address-2" }, isDefault: true },
      data: { isDefault: false },
    });
    expect(addressMock.update).toHaveBeenCalledWith({
      where: { id: "address-2" },
      data: { isDefault: true },
    });
    expect(updated.isDefault).toBe(true);
  });

  it("deletes an address scoped to the user", async () => {
    addressMock.deleteMany.mockResolvedValue({ count: 1 });

    const result = await deleteSavedAddress("user-1", "address-1");

    expect(addressMock.deleteMany).toHaveBeenCalledWith({
      where: { id: "address-1", userId: "user-1" },
    });
    expect(result).toEqual({ removed: true });
  });
});
