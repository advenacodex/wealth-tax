import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useAddonTranslation, type AddonContext } from "@wealthfolio/addon-sdk";
import {
  Card,
  CardContent,
  cn,
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
import { fmtMoney, useNumberLocale } from "../utils/format";
import {
  ClosedPositionsTable,
  ClosedTotalsTable,
  OpenPositionsTable,
} from "./TaxTable";

const ALL = "all";

// Ajusta el alto de la zona de contenido al espacio visible bajo la cabecera,
// para que solo se desplace la lista de valores. Estilos en línea: el addon no
// empaqueta CSS propio.
function useFillViewport() {
  const ref = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState<number>();
  useLayoutEffect(() => {
    const update = () => {
      const el = ref.current;
      if (!el) return;
      const top = el.getBoundingClientRect().top + window.scrollY;
      setHeight(Math.max(window.innerHeight - top - 16, 480));
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);
  return { ref, height };
}

// Tarjeta de resumen en una sola línea: icono, etiqueta y valor a la derecha.
function SummaryCard({
  label,
  value,
  detail,
  tone,
  icon,
}: {
  label: string;
  value: string;
  detail?: string;
  tone: string;
  icon: ReactNode;
}) {
  return (
    <Card>
      <CardContent
        className="flex items-center gap-3"
        style={{ padding: "10px 16px" }}
      >
        <div
          className={cn(
            "flex h-7 w-7 shrink-0 items-center justify-center rounded-full",
            tone,
          )}
        >
          {icon}
        </div>
        <span className="text-muted-foreground text-sm font-medium">
          {label}
        </span>
        <div
          className="flex items-baseline gap-2"
          style={{ marginLeft: "auto", whiteSpace: "nowrap" }}
        >
          {detail && (
            <span className="text-muted-foreground text-xs">{detail}</span>
          )}
          <span className="text-lg font-bold">{value}</span>
        </div>
      </CardContent>
    </Card>
  );
}

const NO_SHRINK = { flexShrink: 0 } as const;
const selectContentClass = "max-h-60 overflow-y-auto";

interface TaxesPageProps {
  ctx: AddonContext;
}

export function TaxesPage({ ctx }: TaxesPageProps) {
  const fill = useFillViewport();
  const { t } = useAddonTranslation();
  useNumberLocale();
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
  // Posiciones cerradas: una fila por venta (por fechas) o una por activo.
  const [closedMode, setClosedMode] = useState<"dates" | "totals">("dates");

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
            <strong>{t("error")}</strong>{" "}
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
            ? t("subtitleClosed")
            : t("subtitleOpen")
        }
        actions={
          <>
            {view === "closed" && (
              <div className="border-border flex shrink-0 overflow-hidden rounded-lg border">
                <button
                  onClick={() => setClosedMode("dates")}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors",
                    closedMode === "dates"
                      ? "bg-black text-white"
                      : "bg-card text-muted-foreground hover:text-foreground hover:bg-muted",
                  )}
                >
                  <Icons.Calendar className="h-3.5 w-3.5" />
                  {t("viewByDate")}
                </button>
                <button
                  onClick={() => setClosedMode("totals")}
                  className={cn(
                    "border-border flex items-center gap-2 border-l px-4 py-2 text-sm font-medium transition-colors",
                    closedMode === "totals"
                      ? "bg-black text-white"
                      : "bg-card text-muted-foreground hover:text-foreground hover:bg-muted",
                  )}
                >
                  <Icons.Wallet className="h-3.5 w-3.5" />
                  {t("viewTotals")}
                </button>
              </div>
            )}
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
              {t("viewClosed")}
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
              {t("viewOpen")}
            </button>
          </div>
          </>
        }
      />
      <PageContent>
        <div
          ref={fill.ref}
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 24,
            height: fill.height,
          }}
        >
          <Card style={NO_SHRINK}>
            <CardContent className="flex flex-wrap items-end gap-4 pt-6">
              <div className="min-w-[140px] flex-1 space-y-1">
                <div className="flex items-center gap-2 px-1 text-sm font-medium">
                  <Icons.Calendar className="h-3.5 w-3.5" /> {t("filterYear")}
                </div>
                <Select
                  items={[
                    { value: ALL, label: t("filterAllYears") },
                    ...years.map((y) => ({ value: y, label: y })),
                  ]}
                  value={filters.year || ALL}
                  onValueChange={(v) =>
                    setFilters({ year: v === ALL || v == null ? "" : v })
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className={selectContentClass}>
                    <SelectItem value={ALL}>{t("filterAllYears")}</SelectItem>
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
                    <Icons.Wallet className="h-3.5 w-3.5" /> {t("filterGroup")}
                  </div>
                  <Select
                    items={[
                      { value: ALL, label: t("filterAllGroups") },
                      ...groups.map((g) => ({ value: g, label: g })),
                    ]}
                    value={filters.group || ALL}
                    onValueChange={(v) =>
                      setFilters({ group: v === ALL || v == null ? "" : v })
                    }
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className={selectContentClass}>
                      <SelectItem value={ALL}>{t("filterAllGroups")}</SelectItem>
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
                  <Icons.Wallet className="h-3.5 w-3.5" /> {t("filterAccount")}
                </div>
                <Select
                  items={[
                    { value: ALL, label: t("filterAllAccounts") },
                    ...accounts.map((a) => ({ value: a.id, label: a.name })),
                  ]}
                  value={filters.accountId || ALL}
                  onValueChange={(v) =>
                    setFilters({ accountId: v === ALL || v == null ? "" : v })
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className={selectContentClass}>
                    <SelectItem value={ALL}>{t("filterAllAccounts")}</SelectItem>
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
                  <Icons.Tag className="h-3.5 w-3.5" /> {t("filterAsset")}
                </div>
                <Select
                  items={[
                    { value: ALL, label: t("filterAllAssets") },
                    ...assets.map((a) => ({
                      value: a.id,
                      label: a.symbol || a.name || a.id,
                    })),
                  ]}
                  value={filters.assetId || ALL}
                  onValueChange={(v) =>
                    setFilters({ assetId: v === ALL || v == null ? "" : v })
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className={selectContentClass}>
                    <SelectItem value={ALL}>{t("filterAllAssets")}</SelectItem>
                    {assets.map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.symbol || a.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

            </CardContent>
          </Card>

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 24,
              flex: "1 1 0",
              minHeight: 0,
            }}
          >
            <div
              className="grid grid-cols-1 gap-4 md:grid-cols-3"
              style={NO_SHRINK}
            >
              {view === "closed" ? (
                <>
                  <SummaryCard
                    label={t("cardTotalResult")}
                    value={fmtMoney(summary.totalGain, baseCurrency)}
                    tone={
                      summary.totalGain >= 0
                        ? "bg-green-500/10 text-green-500"
                        : "bg-red-500/10 text-red-500"
                    }
                    icon={
                      summary.totalGain >= 0 ? (
                        <Icons.TrendingUp className="h-4 w-4" />
                      ) : (
                        <Icons.TrendingDown className="h-4 w-4" />
                      )
                    }
                  />
                  <SummaryCard
                    label={t("cardTotalSales")}
                    value={fmtMoney(summary.totalSales, baseCurrency)}
                    tone="bg-blue-500/10 text-blue-500"
                    icon={<Icons.ArrowUpRight className="h-4 w-4" />}
                  />
                  <SummaryCard
                    label={t("cardTotalCostBasis")}
                    value={fmtMoney(summary.totalCostBasis, baseCurrency)}
                    tone="bg-orange-500/10 text-orange-500"
                    icon={<Icons.Wallet className="h-4 w-4" />}
                  />
                </>
              ) : (
                <>
                  <SummaryCard
                    label={t("cardOpenPositions")}
                    value={String(summary.positionCount)}
                    detail={t("cardActiveLots", { count: summary.lotCount })}
                    tone="bg-blue-500/10 text-blue-500"
                    icon={<Icons.LockOpen className="h-4 w-4" />}
                  />
                  <SummaryCard
                    label={t("cardTotalCost")}
                    value={fmtMoney(summary.totalCostBase, baseCurrency)}
                    tone="bg-orange-500/10 text-orange-500"
                    icon={<Icons.Wallet className="h-4 w-4" />}
                  />
                  <SummaryCard
                    label={t("cardTotalFees")}
                    value={fmtMoney(summary.totalFeesBase, baseCurrency)}
                    tone="bg-yellow-500/10 text-yellow-600"
                    icon={<Icons.Tag className="h-4 w-4" />}
                  />
                </>
              )}
            </div>

            <Card
              className="overflow-hidden"
              style={{
                display: "flex",
                flexDirection: "column",
                flex: "1 1 0",
                minHeight: 240,
              }}
            >
              <div
                className="border-border flex items-center justify-between border-b px-6 py-4"
                style={NO_SHRINK}
              >
                <h3 className="font-semibold">
                  {view === "open"
                    ? t("titleOpen")
                    : closedMode === "totals"
                      ? t("titleTotals")
                      : t("titleDetail")}
                </h3>
                {isLoading && (
                  <span className="text-muted-foreground animate-pulse text-xs">
                    {t("loading")}
                  </span>
                )}
              </div>
              <div style={{ flex: "1 1 0", minHeight: 0, overflow: "auto" }}>
                {view === "closed" && closedMode === "totals" ? (
                  <ClosedTotalsTable
                    results={realizedGains}
                    accounts={accounts}
                    assets={assets}
                    baseCurrency={baseCurrency}
                    isLoading={isLoading}
                  />
                ) : view === "closed" ? (
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
