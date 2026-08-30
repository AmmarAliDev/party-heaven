import { PageShell } from "@/components/layout/page-shell";
import { buildMetadata } from "@/config/metadata";
import {
  type AdminActivityFeedResult,
  listAdminActivityFeed,
} from "@/features/admin/activity";
import {
  AdminListPattern,
  AdminPageHeader,
} from "@/features/admin/components/admin-page-patterns";
import type { AppError } from "@/lib/errors/app-error";
import { toUserMessage } from "@/lib/errors/error-messages";

export const metadata = buildMetadata({
  title: "Admin Activity",
  path: "/admin/activity",
  description: "View recent team and system activity from audit logs.",
});

function formatActivityTimestamp(date: Date) {
  return date.toLocaleString("en-PK", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export default async function AdminActivityPage() {
  let feed: AdminActivityFeedResult | null = null;
  let errorMessage: string | null = null;

  // Load data first; JSX is intentionally constructed after the try/catch so
  // render-time errors are handled by the app error boundary, not a local catch.
  try {
    feed = await listAdminActivityFeed({ take: 30 });
  } catch (error) {
    errorMessage = toUserMessage(error as AppError);
  }

  if (feed === null) {
    return (
      <PageShell className="gap-8">
        <AdminPageHeader
          eyebrow="Recent activity"
          title="Team and system activity"
          description="A single chronological feed helps non-technical users follow what changed."
        />

        <AdminListPattern
          state="error"
          emptyTitle="No recent events"
          emptyDescription="Activity entries will appear here once events are available."
          errorDescription={errorMessage ?? "We could not load activity records right now."}
        />
      </PageShell>
    );
  }

  const activity = feed.items;

  if (activity.length === 0) {
    return (
      <PageShell className="gap-8">
        <AdminPageHeader
          eyebrow="Recent activity"
          title="Team and system activity"
          description="A single chronological feed helps non-technical users follow what changed."
        />

        <AdminListPattern
          state="empty"
          emptyTitle="No recent events"
          emptyDescription="Activity entries will appear here as your team updates orders, products, content, and moderation actions."
          errorDescription="We could not load activity records right now."
        />
      </PageShell>
    );
  }

  return (
    <PageShell className="gap-8">
      <AdminPageHeader
        eyebrow="Recent activity"
        title="Team and system activity"
        description="A single chronological feed helps non-technical users follow what changed."
      />

      <section className="space-y-3">
        {activity.map((entry) => (
          <article key={entry.id} className="border-border rounded-lg border p-4">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="text-sm font-semibold">{entry.title}</h2>
              <p className="text-muted-foreground text-xs">{formatActivityTimestamp(entry.createdAt)}</p>
            </div>
            <p className="text-muted-foreground mt-2 text-sm">{entry.summary}</p>
            <p className="text-muted-foreground mt-2 text-xs">
              By {entry.actor?.label ?? "System"}
              {entry.modelLabel ? ` in ${entry.modelLabel}` : ""}
            </p>
          </article>
        ))}
      </section>
    </PageShell>
  );
}
