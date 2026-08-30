export const e2eCatalog = {
  categorySlug: "home-care",
  categoryName: "Home Care",
  categoryDescription: "Cleaning, laundry, and restock-friendly home essentials.",
  productSlug: "ultra-wash-detergent-1kg",
  productName: "Ultra Wash Detergent 1kg",
  productDescription: "Powerful enzyme-based powder formula for heavily soiled everyday laundry.",
} as const;

export const e2eAdmin = {
  name: "E2E Admin",
  email: "admin.e2e@party-heaven.local",
  password: "AdminPass123!",
} as const;

export function createE2ECustomer() {
  const token = `${Date.now()}-${Math.round(Math.random() * 10_000)}`;

  return {
    name: `E2E Customer ${token}`,
    email: `customer+${token}@example.com`,
    password: "CustomerPass123!",
    phone: "0300 1234567",
    addressLine1: "House 10, Clifton Block 5",
    postcode: "75500",
    notes: "Please leave the order at reception.",
  };
}
