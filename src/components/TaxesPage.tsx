import { useEffect, useState } from "react";
import type { AddonContext } from "@wealthfolio/addon-sdk";
import {
  Card,
  CardContent,
  cn,
  formatAmount,
  Icons,
  Page,
  PageContent,
  PageHeader,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@wealthfolio/ui";
import { useTaxData } from "../hooks/use-tax-data";
import { ClosedPositionsTable, OpenPositionsTable } from "./TaxTable";

const ALL = "all";

const selectContentClass = "max-h-60 overflow-y-auto";

interface TaxesPageProps {
  ctx: AddonContext;
}

export function TaxesPage({ ctx }: TaxesPageProps) {
  const {
    isLoading,
    error,
    baseCurrency,
    view,
    setView,
    filters,
    setFilters,
    years,
    groups,
    accounts,
    assets,
    realizedGains,
    openPositions,
    summary,
  } = useTaxData(ctx);

  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());

  // Switching views or filters invalidates row indices, so collapse everything.
  useEffect(() => {
    setExpandedRows(new Set());
  }, [view, filters]);

  const toggleRow = (i: number) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  };

  if (error) {
    return (
      <Page>
        <PageContent>
          <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-500">
            <strong>Error:</strong>{" "}
            {error instanceof Error ? error.message : String(error)}
          </div>
        </PageContent>
      </Page>
    );
  }

  return (
    <Page>
      <PageHeader
        heading="WealthTax"
        text={
          view === "closed"
            ? "Informe de plusvalías y base de coste para efectos fiscales."
            : "Lotes de compra activos (no vendidos), incluyendo splits y ampliaciones."
        }
        actions={
          <div className="border-border flex shrink-0 overflow-hidden rounded-lg border">
            <button
              onClick={() => setView("closed")}
              className={cn(
                "flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors",
                view === "closed"
                  ? "bg-black text-white"
                  : "bg-card text-muted-foreground hover:text-foreground hover:bg-muted",
              )}
            >
              <Icons.Lock className="h-3.5 w-3.5" />
              Posiciones cerradas
            </button>
            <button
              onClick={() => setView("open")}
              className={cn(
                "border-border flex items-center gap-2 border-l px-4 py-2 text-sm font-medium transition-colors",
                view === "open"
                  ? "bg-black text-white"
                  : "bg-card text-muted-foreground hover:text-foreground hover:bg-muted",
              )}
            >
              <Icons.LockOpen className="h-3.5 w-3.5" />
              Posiciones abiertas
            </button>
          </div>
        }
      />
      <PageContent>
        <div className="space-y-6">
          <Card>
            <CardContent className="flex flex-wrap items-end gap-4 pt-6">
              <div className="min-w-[140px] flex-1 space-y-1">
                <div className="flex items-center gap-2 px-1 text-sm font-medium">
                  <Icons.Calendar className="h-3.5 w-3.5" /> Año
                </div>
                <Select
                  value={filters.year || ALL}
                  onValueChange={(v) =>
                    setFilters({ year: v === ALL ? "" : v })
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className={selectContentClass}>
                    <SelectItem value={ALL}>Todos los años</SelectItem>
                    {years.map((y) => (
                      <SelectItem key={y} value={y}>
                        {y}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {groups.length > 0 && (
                <div className="min-w-[140px] flex-1 space-y-1">
                  <div className="flex items-center gap-2 px-1 text-sm font-medium">
                    <Icons.Wallet className="h-3.5 w-3.5" /> Grupo
                  </div>
                  <Select
                    value={filters.group || ALL}
                    onValueChange={(v) =>
                      setFilters({ group: v === ALL ? "" : v })
                    }
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className={selectContentClass}>
                      <SelectItem value={ALL}>Todos los grupos</SelectItem>
                      {groups.map((g) => (
                        <SelectItem key={g} value={g}>
                          {g}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="min-w-[160px] flex-1 space-y-1">
                <div className="flex items-center gap-2 px-1 text-sm font-medium">
                  <Icons.Wallet className="h-3.5 w-3.5" /> Cuenta
                </div>
                <Select
                  value={filters.accountId || ALL}
                  onValueChange={(v) =>
                    setFilters({ accountId: v === ALL ? "" : v })
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className={selectContentClass}>
                    <SelectItem value={ALL}>Todas las cuentas</SelectItem>
                    {accounts.map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="min-w-[160px] flex-1 space-y-1">
                <div className="flex items-center gap-2 px-1 text-sm font-medium">
                  <Icons.Tag className="h-3.5 w-3.5" /> Activo
                </div>
                <Select
                  value={filters.assetId || ALL}
                  onValueChange={(v) =>
                    setFilters({ assetId: v === ALL ? "" : v })
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className={selectContentClass}>
                    <SelectItem value={ALL}>Todos los activos</SelectItem>
                    {assets.map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.symbol || a.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <p className="text-muted-foreground self-center whitespace-nowrap text-[10px]">
                Calculado usando el método FIFO
              </p>
            </CardContent>
          </Card>

          <div className="space-y-6">
            {view === "closed" ? (
              <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
                <Card>
                  <CardContent className="pt-6">
                    <div className="mb-4 flex items-start justify-between">
                      <span className="text-muted-foreground text-sm font-medium">
                        Resultado Total
                      </span>
                      <div
                        className={cn(
                          "flex h-8 w-8 items-center justify-center rounded-full",
                          summary.totalGain >= 0
                            ? "bg-green-500/10 text-green-500"
                            : "bg-red-500/10 text-red-500",
                        )}
                      >
                        {summary.totalGain >= 0 ? (
                          <Icons.TrendingUp className="h-4 w-4" />
                        ) : (
                          <Icons.TrendingDown className="h-4 w-4" />
                        )}
                      </div>
                    </div>
                    <div className="text-2xl font-bold">
                      {formatAmount(summary.totalGain, baseCurrency)}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="pt-6">
                    <div className="mb-4 flex items-start justify-between">
                      <span className="text-muted-foreground text-sm font-medium">
                        Total Ventas (Ingresos)
                      </span>
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-500/10 text-blue-500">
                        <Icons.ArrowUpRight className="h-4 w-4" />
                      </div>
                    </div>
                    <div className="text-2xl font-bold">
                      {formatAmount(summary.totalSales, baseCurrency)}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="pt-6">
                    <div className="mb-4 flex items-start justify-between">
                      <span className="text-muted-foreground text-sm font-medium">
                        Base de Coste Total
                      </span>
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-orange-500/10 text-orange-500">
                        <Icons.Wallet className="h-4 w-4" />
                      </div>
                    </div>
                    <div className="text-2xl font-bold">
                      {formatAmount(summary.totalCostBasis, baseCurrency)}
                    </div>
                  </CardContent>
                </Card>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
                <Card>
                  <CardContent className="pt-6">
                    <div className="mb-4 flex items-start justify-between">
                      <span className="text-muted-foreground text-sm font-medium">
                        Posiciones abiertas
                      </span>
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-500/10 text-blue-500">
                        <Icons.LockOpen className="h-4 w-4" />
                      </div>
                    </div>
                    <div className="text-2xl font-bold">
                      {summary.positionCount}
                    </div>
                    <div className="text-muted-foreground mt-1 text-xs">
                      {summary.lotCount} lotes activos
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="pt-6">
                    <div className="mb-4 flex items-start justify-between">
                      <span className="text-muted-foreground text-sm font-medium">
                        Coste total (incl. com.)
                      </span>
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-orange-500/10 text-orange-500">
                        <Icons.Wallet className="h-4 w-4" />
                      </div>
                    </div>
                    <div className="text-2xl font-bold">
                      {formatAmount(summary.totalCostBase, baseCurrency)}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="pt-6">
                    <div className="mb-4 flex items-start justify-between">
                      <span className="text-muted-foreground text-sm font-medium">
                        Comisiones totales
                      </span>
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-yellow-500/10 text-yellow-600">
                        <Icons.Tag className="h-4 w-4" />
                      </div>
                    </div>
                    <div className="text-2xl font-bold">
                      {formatAmount(summary.totalFeesBase, baseCurrency)}
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            <Card className="overflow-hidden">
              <div className="border-border flex items-center justify-between border-b px-6 py-4">
                <h3 className="font-semibold">
                  {view === "closed"
                    ? "Desglose de Operaciones"
                    : "Lotes de Compra Activos"}
                </h3>
                {isLoading && (
                  <span className="text-muted-foreground animate-pulse text-xs">
                    Cargando...
                  </span>
                )}
              </div>
              <div className="overflow-x-auto">
                {view === "closed" ? (
                  <ClosedPositionsTable
                    results={realizedGains}
                    accounts={accounts}
                    assets={assets}
                    baseCurrency={baseCurrency}
                    isLoading={isLoading}
                    expandedRows={expandedRows}
                    toggleRow={toggleRow}
                  />
                ) : (
                  <OpenPositionsTable
                    positions={openPositions}
                    accounts={accounts}
                    assets={assets}
                    baseCurrency={baseCurrency}
                    isLoading={isLoading}
                    expandedRows={expandedRows}
                    toggleRow={toggleRow}
                  />
                )}
              </div>
            </Card>
          </div>
        </div>
      </PageContent>
    </Page>
  );
}
