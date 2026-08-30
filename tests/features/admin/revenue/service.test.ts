import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  order: {
    aggregate: vi.fn(),
    count: vi.fn(),
    groupBy: vi.fn(),
  },
}));

vi.mock("@/server/db", () => ({
  getPrismaClient: () => prismaMock,
}));

import {
  buildAdminRevenueReport,
  buildRevenueRecentPeriodRanges,
  getAdminRevenueReport,
  isAdminRevenueReportEmpty,
} from "@/features/admin/revenue";

describe("admin revenue service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("builds practical summaries from aggregate inputs", () => {
    const periodRanges = buildRevenueRecentPeriodRanges(new Date("2026-04-24T10:30:00.000Z"));

    const report = buildAdminRevenueReport({
      periodRanges,
      allTimeAggregate: {
        _sum: {
          total: 12000,
        },
        _count: {
          _all: 3,
        },
      },
      periodAggregatesByKey: {
        last7Days: {
          _sum: {
            total: 4000,
          },
          _count: {
            _all: 1,
          },
        },
        last30Days: {
          _sum: {
            total: 9000,
          },
          _count: {
            _all: 2,
          },
        },
      },
      statusCounts: [
        { status: "PENDING", _count: { _all: 2 } },
        { status: "DELIVERED", _count: { _all: 4 } },
        { status: "CANCELLED", _count: { _all: 1 } },
      ],
      grossOrderAggregate: {
        _sum: {
          total: 21000,
        },
        _count: {
          _all: 7,
        },
      },
      refundedDeliveredOrdersExcluded: 1,
    });

    expect(report.currency).toBe("Rs.");
    expect(report.recognizedRevenue).toMatchObject({
      total: 12000,
      orderCount: 3,
      averageOrderValue: 4000,
    });
    expect(report.periods).toHaveLength(2);
    expect(report.orderTotals).toMatchObject({
      totalOrders: 7,
      deliveredOrders: 4,
      pendingOrders: 2,
      cancelledOrders: 1,
      grossOrderValue: 21000,
    });
    expect(report.isEmpty).toBe(false);
  });

  it("flags empty state when there are no orders", () => {
    expect(
      isAdminRevenueReportEmpty({
        totalOrders: 0,
        deliveredOrders: 0,
        pendingOrders: 0,
        cancelledOrders: 0,
        grossOrderValue: 0,
      }),
    ).toBe(true);
  });

  it("loads a report from database aggregates", async () => {
    prismaMock.order.aggregate
      .mockResolvedValueOnce({
        _sum: {
          total: 15000,
        },
        _count: {
          _all: 5,
        },
      })
      .mockResolvedValueOnce({
        _sum: {
          total: 3500,
        },
        _count: {
          _all: 1,
        },
      })
      .mockResolvedValueOnce({
        _sum: {
          total: 12000,
        },
        _count: {
          _all: 4,
        },
      })
      .mockResolvedValueOnce({
        _sum: {
          total: 25000,
        },
        _count: {
          _all: 9,
        },
      });
    prismaMock.order.count.mockResolvedValue(2);
    prismaMock.order.groupBy.mockResolvedValue([
      { status: "PENDING", _count: { _all: 2 } },
      { status: "DELIVERED", _count: { _all: 6 } },
      { status: "CANCELLED", _count: { _all: 1 } },
    ]);

    const report = await getAdminRevenueReport();

    expect(prismaMock.order.aggregate).toHaveBeenCalledTimes(4);
    expect(prismaMock.order.count).toHaveBeenCalledWith({
      where: {
        status: "DELIVERED",
        refundStatus: "COMPLETED",
      },
    });
    expect(prismaMock.order.groupBy).toHaveBeenCalledWith({
      by: ["status"],
      _count: {
        _all: true,
      },
    });
    expect(report.recognizedRevenue.total).toBe(15000);
    expect(report.refundedDeliveredOrdersExcluded).toBe(2);
    expect(report.orderTotals.totalOrders).toBe(9);
  });
});
