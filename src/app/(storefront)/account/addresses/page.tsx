import { MapPin } from "lucide-react";

import { auth } from "@/auth";
import { EmptyState } from "@/components/ui/empty-state";
import { buildMetadata } from "@/config/metadata";
import { routes } from "@/config/routes";
import { listSavedAddresses } from "@/features/addresses";
import { AddressBook } from "@/features/addresses/components/address-book";

export const metadata = buildMetadata({
  title: "Account Addresses",
  path: routes.storefront.accountAddresses,
  description: "Manage delivery addresses for checkout.",
  noIndex: true,
});

export default async function AccountAddressesPage() {
  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) {
    return (
      <EmptyState
        icon={MapPin}
        title="Addresses unavailable"
        description="Please sign in again to manage your addresses."
      />
    );
  }

  const addresses = await listSavedAddresses(userId);

  return <AddressBook initialAddresses={addresses} />;
}