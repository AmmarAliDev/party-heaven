import { PageShell } from "@/components/layout/page-shell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { buildMetadata } from "@/config/metadata";
import { routes } from "@/config/routes";
import {
  AdminPageHeader,
} from "@/features/admin/components/admin-page-patterns";
import {
  type AdminStoreSettingsLoadResult,
  defaultAdminStoreSettings,
  getAdminStoreSettingsErrorMessage,
  getAdminStoreSettingsNoticeMessage,
  loadAdminStoreSettings,
  saveAdminStoreSettingsAction,
} from "@/features/admin/settings";
import { AdminSettingsForm } from "@/features/admin/settings/components/admin-settings-form";
import { requireRouteAccess } from "@/lib/auth/guards";
import { rbacPermissions } from "@/lib/auth/rbac";
import { captureServerError } from "@/lib/errors/handling";

export const metadata = buildMetadata({
  title: "Admin Settings",
  path: routes.admin.settings,
  description: "Manage core store identity, support contact details, and operational defaults.",
});

type AdminSettingsPageProps = {
  searchParams?: Promise<{ notice?: string; error?: string }>;
};

export default async function AdminSettingsPage({ searchParams }: AdminSettingsPageProps) {
  await requireRouteAccess({
    permissions: [rbacPermissions.adminAccess, rbacPermissions.settingsManage],
    from: routes.admin.settings,
  });

  const params = (await searchParams) ?? {};
  const noticeMessage = getAdminStoreSettingsNoticeMessage(params.notice);
  let errorMessage = getAdminStoreSettingsErrorMessage(params.error);

  let settingsResult: AdminStoreSettingsLoadResult;
  try {
    settingsResult = await loadAdminStoreSettings();
  } catch (error) {
    const appError = captureServerError(error, "admin:settings:load");
    errorMessage = errorMessage ?? appError.userMessage ?? "Store settings are temporarily unavailable.";
    settingsResult = {
      hasPersistedSettings: false,
      settings: {
        id: "default",
        ...defaultAdminStoreSettings,
        updatedAt: new Date(0),
      },
    };
  }

  return (
    <PageShell className="gap-8">
      <AdminPageHeader
        eyebrow="Settings"
        title="Store settings"
        description="Manage practical defaults for store identity, support channels, shipping communication, and operations."
      />

      {noticeMessage ? (
        <div className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-900">
          {noticeMessage}
        </div>
      ) : null}

      {errorMessage ? (
        <div className="rounded-md border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {errorMessage}
        </div>
      ) : null}

      {!settingsResult.hasPersistedSettings ? (
        <div className="rounded-md border border-dashed border-border/70 bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
          No saved settings found yet. You are editing safe defaults; save once to persist your store baseline.
        </div>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Admin store settings</CardTitle>
          <CardDescription>
            This first-pass scope stays intentionally lean and focused on settings the current app can use right away.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AdminSettingsForm
            action={saveAdminStoreSettingsAction}
            returnTo={routes.admin.settings}
            initialValues={settingsResult.settings}
          />
        </CardContent>
      </Card>
    </PageShell>
  );
}
