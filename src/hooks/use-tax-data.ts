import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { AddonContext } from "@wealthfolio/addon-sdk";
import {
  calculateFIFO,
  calculateOpenPositions,
  normalizeActivities,
  type OpenPosition,
  type RealizedGain,
} from "../utils/fifo-engine";

export type TaxView = "closed" | "open";

export interface TaxFilters {
  year: string;
  group: string;
  accountId: string;
  assetId: string;
}

export interface AssetOption {
  id: string;
  symbol: string;
  name?: string;
}

export function useTaxData(ctx: AddonContext) {
  const [view, setView] = useState<TaxView>("closed");
  const [filters, setFiltersState] = useState<TaxFilters>(() => ({
    year: new Date().getFullYear().toString(),
    group: "",
    accountId: "",
    assetId: "",
  }));

  const activitiesQuery = useQuery({
    queryKey: ["wealth-tax", "activities"],
    queryFn: () => ctx.api.activities.getAll(),
  });
  const accountsQuery = useQuery({
    queryKey: ["wealth-tax", "accounts"],
    queryFn: () => ctx.api.accounts.getAll(),
  });
  const settingsQuery = useQuery({
    queryKey: ["wealth-tax", "settings"],
    queryFn: () => ctx.api.settings.get(),
  });

  const activities = activitiesQuery.data ?? [];
  const accounts = accountsQuery.data ?? [];
  const baseCurrency = settingsQuery.data?.baseCurrency ?? "USD";

  const accountGroups = useMemo(() => {
    const map = new Map<string, string | undefined>();
    for (const a of accounts) map.set(a.id, a.group || undefined);
    return map;
  }, [accounts]);

  // Only POSTED activities (plus SPLIT, which may not carry a status) feed the
  // FIFO engine — mirrors `WHERE status = 'POSTED' OR activity_type = 'SPLIT'`.
  const normalized = useMemo(() => {
    const eligible = activities.filter(
      (a) => a.status === "POSTED" || a.activityType === "SPLIT",
    );
    return normalizeActivities(eligible, accountGroups);
  }, [activities, accountGroups]);

  const groups = useMemo(() => {
    const set = new Set<string>();
    for (const a of accounts) if (a.group) set.add(a.group);
    return Array.from(set).sort((a, b) => a.localeCompare(b, "es"));
  }, [accounts]);

  const sortedAccounts = useMemo(
    () => [...accounts].sort((a, b) => a.name.localeCompare(b.name, "es")),
    [accounts],
  );

  const assets = useMemo(() => {
    const map = new Map<string, AssetOption>();
    for (const a of activities) {
      // Pure cash movements (deposits, withdrawals, fees, interest) have no
      // assetId and would otherwise produce a Select.Item with value="".
      if (!a.assetId) continue;
      if (!map.has(a.assetId)) {
        map.set(a.assetId, {
          id: a.assetId,
          symbol: a.assetSymbol,
          name: a.assetName,
        });
      }
    }
    return Array.from(map.values()).sort((a, b) =>
      a.symbol.localeCompare(b.symbol, "es"),
    );
  }, [activities]);

  // Primer año con actividad de toda la base de datos (cualquier operación,
  // sin filtros), que es donde arranca la lista de años.
  const firstYear = useMemo(() => {
    let min = Infinity;
    for (const a of activities) {
      const y = new Date(a.date).getFullYear();
      if (Number.isFinite(y) && y < min) min = y;
    }
    return Number.isFinite(min) ? min : undefined;
  }, [activities]);

  const years = useMemo(() => {
    const current = new Date().getFullYear();
    const start = Math.min(firstYear ?? current, current);
    return Array.from({ length: current - start + 1 }, (_, i) =>
      (start + i).toString(),
    );
  }, [firstYear]);

  // Scope activities by group/account/asset, mirroring the taxes & open-positions
  // API routes in wealthfolio-taxes: a single account is expanded to its whole
  // group so the FIFO lot pool is computed correctly.
  const scoped = useMemo(() => {
    let result = normalized;

    if (filters.group) {
      result = result.filter((a) => a.accountGroup === filters.group);
    } else if (filters.accountId) {
      const grp = accountGroups.get(filters.accountId);
      result = grp
        ? result.filter((a) => a.accountGroup === grp)
        : result.filter((a) => a.accountId === filters.accountId);
    }

    if (filters.assetId) {
      result = result.filter((a) => a.assetId === filters.assetId);
    }

    return result;
  }, [
    normalized,
    accountGroups,
    filters.group,
    filters.accountId,
    filters.assetId,
  ]);

  const realizedGains = useMemo<RealizedGain[]>(() => {
    if (view !== "closed") return [];
    let gains = calculateFIFO(scoped);

    // When filtered by a single account (not a group), only show sales that
    // happened in that account — matched lots may still come from other
    // accounts in the group.
    if (filters.accountId && !filters.group) {
      gains = gains.filter((g) => g.accountId === filters.accountId);
    }

    if (filters.year) {
      const targetYear = parseInt(filters.year, 10);
      gains = gains.filter(
        (g) => new Date(g.sellDate).getFullYear() === targetYear,
      );
    }

    return gains;
  }, [scoped, view, filters.accountId, filters.group, filters.year]);

  const openPositions = useMemo<OpenPosition[]>(() => {
    if (view !== "open") return [];
    let positions = calculateOpenPositions(scoped);

    // Filter by buy year: keep only lots bought in that year, drop positions
    // left with no lots, and recompute the aggregates from what remains.
    if (filters.year) {
      const targetYear = parseInt(filters.year, 10);
      positions = positions
        .map((p) => ({
          ...p,
          lots: p.lots.filter(
            (l) => new Date(l.buyDate).getFullYear() === targetYear,
          ),
        }))
        .filter((p) => p.lots.length > 0)
        .map((p) => {
          const totalQuantity = p.lots.reduce((s, l) => s + l.quantity, 0);
          const totalCostBase = p.lots.reduce((s, l) => s + l.costBase, 0);
          const totalFeesBase = p.lots.reduce((s, l) => s + l.feeBase, 0);
          const avgUnitPriceBase =
            totalQuantity > 0 ? totalCostBase / totalQuantity : 0;
          return {
            ...p,
            totalQuantity,
            totalCostBase,
            totalFeesBase,
            avgUnitPriceBase,
          };
        });
    }

    return positions;
  }, [scoped, view, filters.year]);

  // Always return the same shape (zero-filled for the inactive view) so
  // consumers don't have to deal with a union type.
  const summary = useMemo(() => {
    if (view === "closed") {
      return {
        totalGain: realizedGains.reduce((s, r) => s + r.gain, 0),
        totalSales: realizedGains.reduce(
          (s, r) => s + r.quantity * r.sellPrice,
          0,
        ),
        totalCostBasis: realizedGains.reduce((s, r) => s + r.costBasis, 0),
        positionCount: 0,
        lotCount: 0,
        totalCostBase: 0,
        totalFeesBase: 0,
      };
    }
    return {
      totalGain: 0,
      totalSales: 0,
      totalCostBasis: 0,
      positionCount: openPositions.length,
      lotCount: openPositions.reduce((s, p) => s + p.lots.length, 0),
      totalCostBase: openPositions.reduce((s, p) => s + p.totalCostBase, 0),
      totalFeesBase: openPositions.reduce((s, p) => s + p.totalFeesBase, 0),
    };
  }, [view, realizedGains, openPositions]);

  const setFilters = (patch: Partial<TaxFilters>) => {
    setFiltersState((prev) => {
      const next = { ...prev, ...patch };
      // Group and account filters are mutually exclusive in the UI.
      if (patch.group) next.accountId = "";
      if (patch.accountId) next.group = "";
      return next;
    });
  };

  return {
    isLoading:
      activitiesQuery.isLoading ||
      accountsQuery.isLoading ||
      settingsQuery.isLoading,
    error: activitiesQuery.error ?? accountsQuery.error ?? settingsQuery.error,
    baseCurrency,
    view,
    setView,
    filters,
    setFilters,
    years,
    groups,
    accounts: sortedAccounts,
    assets,
    realizedGains,
    openPositions,
    summary,
  };
}
