"use client";

import { useMemo, useState } from "react";
import { MapPin, Pencil, Plus, Star, Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import {
  deleteSavedAddressRequest,
  setDefaultSavedAddressRequest,
  updateSavedAddressRequest,
  upsertSavedAddressRequest,
} from "@/features/addresses";
import { toUserMessage } from "@/lib/errors/error-messages";
import { notify } from "@/lib/notify";

import type { SavedAddress, SavedAddressInput } from "../types";
import { AddressFormDialog } from "./address-form-dialog";

type AddressBookProps = {
  initialAddresses: SavedAddress[];
};

function sortAddresses(addresses: SavedAddress[]) {
  return [...addresses].sort(
    (a, b) =>
      Number(b.isDefault) - Number(a.isDefault) ||
      b.createdAt.localeCompare(a.createdAt),
  );
}

/**
 * Client address book for the profile Addresses page: lists saved addresses
 * and supports adding, editing, removing, and setting a default address.
 */
export function AddressBook({ initialAddresses }: AddressBookProps) {
  const [addresses, setAddresses] = useState<SavedAddress[]>(() =>
    sortAddresses(initialAddresses),
  );
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<SavedAddress | null>(null);
  const [deleting, setDeleting] = useState<SavedAddress | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);

  const sorted = useMemo(() => sortAddresses(addresses), [addresses]);

  async function handleUpsert(input: SavedAddressInput) {
    const result = await upsertSavedAddressRequest(input);
    setAddresses((prev) => {
      const withoutMatch = prev.filter((address) => address.id !== result.address.id);
      return sortAddresses([result.address, ...withoutMatch]);
    });
    setCreating(false);
    setEditing(null);
    notify.success(
      result.created ? "Address added" : "Address updated",
      "You can reuse this address at checkout.",
    );
  }

  async function handleUpdate(addressId: string, input: SavedAddressInput) {
    const updated = await updateSavedAddressRequest(addressId, input);
    setAddresses((prev) => sortAddresses(prev.map((address) => (address.id === addressId ? updated : address))));
    setEditing(null);
    notify.success("Address updated");
  }

  async function handleSetDefault(addressId: string) {
    if (pendingId) {
      return;
    }

    setPendingId(addressId);
    try {
      await setDefaultSavedAddressRequest(addressId);
      setAddresses((prev) =>
        sortAddresses(
          prev.map((address) => ({ ...address, isDefault: address.id === addressId })),
        ),
      );
      notify.success("Default address updated");
    } catch (error) {
      notify.error("Could not update default address", toUserMessage(error));
    } finally {
      setPendingId(null);
    }
  }

  async function handleDelete() {
    if (!deleting || pendingId) {
      return;
    }

    const target = deleting;
    setPendingId(target.id);
    try {
      await deleteSavedAddressRequest(target.id);
      setAddresses((prev) => prev.filter((address) => address.id !== target.id));
      setDeleting(null);
      notify.success("Address removed");
    } catch (error) {
      notify.error("Could not remove address", toUserMessage(error));
    } finally {
      setPendingId(null);
    }
  }

  const deletePending = deleting !== null && pendingId === deleting.id;

  return (
    <div className="space-y-5">
      <div className="flex justify-end">
        <Button type="button" variant="outline" onClick={() => setCreating(true)}>
          <Plus className="size-4" aria-hidden="true" />
          Add address
        </Button>
      </div>

      {sorted.length === 0 ? (
        <EmptyState
          icon={MapPin}
          title="No addresses yet"
          description="Add a delivery address to speed up checkout on your next order."
        />
      ) : (
        <div className="grid gap-4">
          {sorted.map((address) => {
            const isPending = pendingId === address.id;

            return (
              <Card key={address.id}>
                <CardContent className="p-4 sm:p-5">
                  <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
                    <div className="space-y-1 text-sm">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">{address.label ?? "Address"}</span>
                        {address.isDefault ? <Badge variant="success">Default</Badge> : null}
                      </div>
                      <p className="text-muted-foreground">{address.addressLine1}</p>
                      {address.addressLine2 ? (
                        <p className="text-muted-foreground">{address.addressLine2}</p>
                      ) : null}
                      <p className="text-muted-foreground">
                        {address.city}
                        {address.province ? `, ${address.province}` : ""}
                        {address.country ? `, ${address.country}` : ""}
                        {address.postcode ? ` ${address.postcode}` : ""}
                      </p>
                      {address.phone ? (
                        <p className="text-muted-foreground">Phone: {address.phone}</p>
                      ) : null}
                    </div>

                    <div className="flex flex-col items-start gap-2 sm:items-end">
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setEditing(address)}
                          disabled={isPending}
                        >
                          <Pencil className="size-3.5" aria-hidden="true" />
                          Edit
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setDeleting(address)}
                          disabled={isPending}
                        >
                          <Trash2 className="size-3.5" aria-hidden="true" />
                          Remove
                        </Button>
                      </div>
                      {!address.isDefault ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => void handleSetDefault(address.id)}
                          disabled={isPending}
                        >
                          <Star className="size-3.5" aria-hidden="true" />
                          Make default
                        </Button>
                      ) : null}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <AddressFormDialog
        open={creating || editing !== null}
        onOpenChange={(open) => {
          if (!open) {
            setCreating(false);
            setEditing(null);
          }
        }}
        mode={editing ? "edit" : "create"}
        initial={editing}
        onSubmit={
          editing
            ? (input) => handleUpdate(editing.id, input)
            : (input) => handleUpsert(input)
        }
      />

      <Dialog
        open={deleting !== null}
        onOpenChange={(open) => {
          if (!open && !deletePending) {
            setDeleting(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Remove this address?</DialogTitle>
            <DialogDescription>
              This will remove &ldquo;{deleting?.addressLine1}&rdquo; from your saved addresses.
              You can add it again later.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-wrap justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setDeleting(null)}
              disabled={deletePending}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => void handleDelete()}
              disabled={deletePending}
            >
              {deletePending ? "Removing..." : "Remove address"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
