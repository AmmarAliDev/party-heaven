import { expect, type Page } from "@playwright/test";

import { testIds } from "../../../src/lib/test-selectors";
import { createE2ECustomer, e2eAdmin, e2eCatalog } from "./test-data";

function escapeForRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export async function browseCatalogToProduct(page: Page) {
  await page.goto("/categories");
  await expect(page.getByTestId(testIds.storefront.categoryGrid)).toBeVisible();

  await page.getByTestId(testIds.storefront.categoryCard(e2eCatalog.categorySlug)).click();
  await expect(page).toHaveURL(
    new RegExp(`/categories/${escapeForRegex(e2eCatalog.categorySlug)}$`),
  );
  await expect(page.getByTestId(testIds.storefront.productGrid)).toBeVisible();

  await page.getByTestId(testIds.storefront.productCard(e2eCatalog.productSlug)).click();
  await expect(page).toHaveURL(
    new RegExp(
      `/categories/${escapeForRegex(e2eCatalog.categorySlug)}/${escapeForRegex(e2eCatalog.productSlug)}$`,
    ),
  );
  await expect(page.getByTestId(testIds.storefront.productOverview)).toBeVisible();
  await expect(page.getByRole("heading", { name: e2eCatalog.productName })).toBeVisible();
}

export async function addSeededProductToCart(page: Page) {
  await browseCatalogToProduct(page);

  await Promise.all([
    page.waitForResponse(
      (response) =>
        response.url().includes("/api/cart") && response.request().method() === "POST" && response.ok(),
    ),
    page.getByTestId(testIds.storefront.addToCart).click(),
  ]);

  await expect(page.getByRole("button", { name: /items? in cart/i })).toContainText("1");

  await page.goto("/cart");
  await expect(page.getByTestId(testIds.storefront.cartContent)).toBeVisible();
  await expect(page.getByText(e2eCatalog.productName)).toBeVisible();
}

export async function completeGuestCheckout(page: Page) {
  const customer = createE2ECustomer();

  await addSeededProductToCart(page);
  await page.getByRole("link", { name: /proceed to checkout/i }).click();

  await expect(page).toHaveURL(/\/checkout$/);
  await expect(page.getByTestId(testIds.storefront.checkoutForm)).toBeVisible();

  await page.getByLabel(/full name/i).fill(customer.name);
  await page.getByLabel(/email/i).fill(customer.email);
  await page.getByLabel(/phone/i).fill(customer.phone);
  await page.getByLabel(/^address/i).fill(customer.addressLine1);
  await page.getByLabel(/postal code/i).fill(customer.postcode);
  await page.getByLabel(/order notes/i).fill(customer.notes);
  await page.getByRole("radio", { name: /cash on delivery/i }).check();

  await page.getByTestId(testIds.storefront.checkoutSubmit).click();

  await page.waitForURL(/\/checkout\/confirmation\/[^/?]+/);
  const confirmationPage = page.getByTestId(testIds.storefront.checkoutConfirmation);

  await expect(confirmationPage).toBeVisible();
  await expect(confirmationPage.getByText(/^Cash on Delivery$/)).toBeVisible();

  const orderNumber = page.url().split("/checkout/confirmation/")[1]?.split("?")[0] ?? "";
  expect(orderNumber).toBeTruthy();

  return { orderNumber, customer };
}

export async function signIn(
  page: Page,
  {
    email,
    password,
    redirectTo = "/account/profile",
  }: {
    email: string;
    password: string;
    redirectTo?: string;
  },
) {
  await page.goto(`/auth/sign-in?from=${encodeURIComponent(redirectTo)}`);
  await expect(page.locator("#sign-in-email")).toBeVisible();

  await page.locator("#sign-in-email").fill(email);
  await page.locator("#sign-in-password").fill(password);

  await Promise.all([
    page.waitForURL((url) => url.pathname === redirectTo || url.pathname === "/"),
    page.getByTestId(testIds.auth.signInSubmit).click(),
  ]);
}

export async function signInAsAdmin(page: Page) {
  await signIn(page, {
    email: e2eAdmin.email,
    password: e2eAdmin.password,
    redirectTo: "/admin/orders",
  });

  await expect(page.getByTestId(testIds.admin.ordersTable)).toBeVisible();
}
