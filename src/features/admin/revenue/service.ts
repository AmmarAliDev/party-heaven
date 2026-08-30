import type { OrderStatus, RefundStatus } from "@prisma/client";

import { AppError } from "@/lib/errors/app-error";
import { getPrismaClient } from "@/server/db";

import {
  buildRevenueRecentPeriodRanges,
  type RevenueRecentPeriodKey,
  type RevenueRecentPeriodRange,
} from "./date-ranges";

const REVENUE_INCLUDED_REFUND_STATUSES: RefundStatus[] = ["NONE", "REVERSED"];

export const ADMIN_REVENUE_ASSUMPTIONS = [
  "Recognized revenue counts delivered orders only.",
  "Orders with completed refunds are excluded.",
  "Cash on Delivery payment status is not used for revenue recognition in this phase.",
] as const;

type RevenueAggregate = {
  _sum: {
    total: number | null;
  };
  _count: {
    _all: number;
  };
};

type OrderStatusCount = {
  status: OrderStatus;
  _count: {
    _all: number;
  };
};

type RevenueSnapshot = {
  total: number;
  orderCount: number;
  averageOrderValue: number;
};

export type AdminRevenuePeriodSummary = RevenueSnapshot & {
  key: RevenueRecentPeriodKey;
  label: string;
  startAt: Date;
  endAt: Date;
};

export type AdminRevenueOrderTotalsSummary = {
  totalOrders: number;
  deliveredOrders: number;
  pendingOrders: number;
  cancelledOrders: number;
  grossOrderValue: number;
};

export type AdminRevenueReport = {
  currency: "Rs.";
  recognizedRevenue: RevenueSnapshot;
  periods: AdminRevenuePeriodSummary[];
  refundedDeliveredOrdersExcluded: number;
  orderTotals: AdminRevenueOrderTotalsSummary;
  assumptions: readonly string[];
  isEmpty: boolean;
};

function buildRevenueSnapshot(aggregate: RevenueAggregate): RevenueSnapshot {
  const total = aggregate._sum.total ?? 0;
  const orderCount = aggregate._count._all;

  return {
    total,
    orderCount,
    averageOrderValue: orderCount > 0 ? Math.round(total / orderCount) : 0,
  };
}

function getStatusCount(statusCounts: OrderStatusCount[], status: OrderStatus) {
  return statusCounts.find((entry) => entry.status === status)?._count._all ?? 0;
}

export function isAdminRevenueReportEmpty(orderTotals: AdminRevenueOrderTotalsSummary) {
  return orderTotals.totalOrders === 0;
}

export function buildAdminRevenueReport(input: {
  periodRanges: RevenueRecentPeriodRange[];
  allTimeAggregate: RevenueAggregate;
  periodAggregatesByKey: Record<RevenueRecentPeriodKey, RevenueAggregate>;
  statusCounts: OrderStatusCount[];
  grossOrderAggregate: RevenueAggregate;
  refundedDeliveredOrdersExcluded: number;
}): AdminRevenueReport {
  const periods = input.periodRanges.map((period) => {
    const summary = buildRevenueSnapshot(input.periodAggregatesByKey[period.key]);

    return {
      key: period.key,
      label: period.label,
      startAt: period.range.startAt,
      endAt: period.range.endAt,
      ...summary,
    };
  });

  const orderTotals = {
    totalOrders: input.grossOrderAggregate._count._all,
    deliveredOrders: getStatusCount(input.statusCounts, "DELIVERED"),
    pendingOrders: getStatusCount(input.statusCounts, "PENDING"),
    cancelledOrders: getStatusCount(input.statusCounts, "CANCELLED"),
    grossOrderValue: input.grossOrderAggregate._sum.total ?? 0,
  };

  return {
    currency: "Rs.",
    recognizedRevenue: buildRevenueSnapshot(input.allTimeAggregate),
    periods,
    refundedDeliveredOrdersExcluded: input.refundedDeliveredOrdersExcluded,
    orderTotals,
    assumptions: ADMIN_REVENUE_ASSUMPTIONS,
    isEmpty: isAdminRevenueReportEmpty(orderTotals),
  };
}

export async function getAdminRevenueReport(): Promise<AdminRevenueReport> {
  const db = getPrismaClient();
  const recentPeriods = buildRevenueRecentPeriodRanges();

  try {
    const [allTimeAggregate, periodAggregates, refundedDeliveredOrdersExcluded, statusCounts, grossOrderAggregate] = await Promise.all([
      db.order.aggregate({
        where: {
          status: "DELIVERED",
          refundStatus: {
            in: REVENUE_INCLUDED_REFUND_STATUSES,
          },
        },
        _sum: {
          total: true,
        },
        _count: {
          _all: true,
        },
      }),
      Promise.all(
        recentPeriods.map((period) =>
          db.order.aggregate({
            where: {
              status: "DELIVERED",
              refundStatus: {
                in: REVENUE_INCLUDED_REFUND_STATUSES,
              },
              placedAt: {
                gte: period.range.startAt,
                lte: period.range.endAt,
              },
            },
            _sum: {
              total: true,
            },
            _count: {
              _all: true,
            },
          }),
        ),
      ),
      db.order.count({
        where: {
          status: "DELIVERED",
          refundStatus: "COMPLETED",
        },
      }),
      db.order.groupBy({
        by: ["status"],
        _count: {
          _all: true,
        },
      }),
      db.order.aggregate({
        _sum: {
          total: true,
        },
        _count: {
          _all: true,
        },
      }),
    ]);

    const periodAggregatesByKey = recentPeriods.reduce<Record<RevenueRecentPeriodKey, RevenueAggregate>>(
      (accumulator, period, index) => {
        accumulator[period.key] = periodAggregates[index] ?? {
          _sum: { total: 0 },
          _count: { _all: 0 },
        };
        return accumulator;
      },
      {
        last7Days: {
          _sum: { total: 0 },
          _count: { _all: 0 },
        },
        last30Days: {
          _sum: { total: 0 },
          _count: { _all: 0 },
        },
      },
    );

    return buildAdminRevenueReport({
      periodRanges: recentPeriods,
      allTimeAggregate,
      periodAggregatesByKey,
      statusCounts,
      grossOrderAggregate,
      refundedDeliveredOrdersExcluded,
    });
  } catch (error) {
    throw new AppError("Admin revenue report query failed.", "ADMIN_REVENUE_REPORT_QUERY_FAILED", {
      cause: error,
      statusCode: 500,
      userMessage: "Revenue reporting is temporarily unavailable. Please refresh and try again.",
    });
  }
}
