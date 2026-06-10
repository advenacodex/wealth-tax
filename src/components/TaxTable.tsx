import { Fragment, useState } from "react";
import type { Account } from "@wealthfolio/addon-sdk";
import { cn, formatAmount, Icons } from "@wealthfolio/ui";
import type { AssetOption } from "../hooks/use-tax-data";
import type { OpenPosition, RealizedGain } from "../utils/fifo-engine";

function formatDate(dateStr: string) {
  return dateStr.slice(0, 10);
}

function fmtOrig(value: number, currency: string) {
  return `${value.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 4 })} ${currency}`;
}

function fmtFX(rate: number, currency: string, baseCurrency: string) {
  if (currency === baseCurrency) return "—";
  return rate.toLocaleString("es-ES", {
    minimumFractionDigits: 4,
    maximumFractionDigits: 6,
  });
}

// Renders a value in its original currency with the base-currency equivalent
// shown below it (when the currency differs from the base currency).
function WithBase({
  value,
  currency,
  fxRate,
  baseCurrency,
  zero = "—",
}: {
  value: number;
  currency: string;
  fxRate: number;
  baseCurrency: string;
  zero?: string;
}) {
  if (value === 0 && zero === "—")
    return <span className="text-muted-foreground">{zero}</span>;
  if (currency === baseCurrency)
    return <span>{formatAmount(value, baseCurrency)}</span>;
  return (
    <span className="flex flex-col items-end gap-0.5 leading-tight">
      <span>{fmtOrig(value, currency)}</span>
      <span className="text-muted-foreground/70 text-[10px]">
        {formatAmount(value * fxRate, baseCurrency)}
      </span>
    </span>
  );
}

function symbolFor(assets: AssetOption[], assetId: string) {
  const asset = assets.find((a) => a.id === assetId);
  return asset?.symbol || asset?.name || assetId;
}

function accountNameFor(accounts: Account[], id: string) {
  return accounts.find((a) => a.id === id)?.name || id;
}

type SortCol = "date" | "asset";
type SortDir = "asc" | "desc";

function SortArrow({ active, dir }: { active: boolean; dir: SortDir }) {
  if (!active)
    return (
      <Icons.ChevronsUpDown className="ml-0.5 inline h-3 w-3 opacity-40" />
    );
  return dir === "asc" ? (
    <Icons.ChevronUp className="ml-0.5 inline h-3 w-3" />
  ) : (
    <Icons.ChevronDown className="ml-0.5 inline h-3 w-3" />
  );
}

function useSort() {
  const [sortCol, setSortCol] = useState<SortCol | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const handleSort = (col: SortCol) => {
    if (sortCol === col) {
      if (sortDir === "asc") {
        setSortDir("desc");
      } else {
        setSortCol(null);
        setSortDir("asc");
      }
    } else {
      setSortCol(col);
      setSortDir("asc");
    }
  };

  return { sortCol, sortDir, handleSort };
}

const thSort =
  "px-4 py-3 font-medium whitespace-nowrap cursor-pointer select-none hover:bg-gray-800";

interface ClosedPositionsTableProps {
  results: RealizedGain[];
  accounts: Account[];
  assets: AssetOption[];
  baseCurrency: string;
  isLoading: boolean;
  expandedRows: Set<number>;
  toggleRow: (i: number) => void;
}

export function ClosedPositionsTable({
  results,
  accounts,
  assets,
  baseCurrency,
  isLoading,
  expandedRows,
  toggleRow,
}: ClosedPositionsTableProps) {
  const { sortCol, sortDir, handleSort } = useSort();

  const sortedResults = sortCol
    ? [...results].sort((a, b) => {
        const cmp =
          sortCol === "date"
            ? a.sellDate.localeCompare(b.sellDate)
            : symbolFor(assets, a.assetId).localeCompare(
                symbolFor(assets, b.assetId),
                "es",
              );
        return sortDir === "asc" ? cmp : -cmp;
      })
    : results;

  return (
    <table className="w-full text-left text-sm">
      <thead>
        <tr className="bg-black text-white">
          <th className={thSort} onClick={() => handleSort("date")}>
            Fecha <SortArrow active={sortCol === "date"} dir={sortDir} />
          </th>
          <th
            className={cn(thSort, "whitespace-nowrap")}
            onClick={() => handleSort("asset")}
          >
            Activo <SortArrow active={sortCol === "asset"} dir={sortDir} />
          </th>
          <th className="px-4 py-3 font-medium whitespace-nowrap">Cuenta</th>
          <th className="px-4 py-3 text-right font-medium">Cant.</th>
          <th className="px-4 py-3 text-right font-medium whitespace-nowrap">
            Precio
          </th>
          <th className="px-4 py-3 text-right font-medium whitespace-nowrap">
            Tasa FX
          </th>
          <th className="px-4 py-3 text-right font-medium whitespace-nowrap">
            Total
          </th>
          <th className="px-4 py-3 text-right font-medium">Comisiones</th>
          <th className="px-4 py-3 text-right font-medium whitespace-nowrap">
            Total − com.
          </th>
          <th className="px-4 py-3 text-right font-medium whitespace-nowrap">
            Coste orig. (c/com.)
          </th>
          <th className="px-4 py-3 text-right font-medium whitespace-nowrap">
            Benef./Pérd.
          </th>
        </tr>
      </thead>
      <tbody className="divide-border divide-y">
        {sortedResults.length === 0 ? (
          <tr>
            <td
              colSpan={11}
              className="text-muted-foreground px-6 py-12 text-center italic"
            >
              {isLoading
                ? "Buscando operaciones..."
                : "No hay operaciones realizadas para estos filtros."}
            </td>
          </tr>
        ) : (
          sortedResults.map((r, i) => {
            const symbol = symbolFor(assets, r.assetId);
            const totalVenta = r.quantity * r.sellPriceOriginal;
            const netoVenta = totalVenta - r.sellFeeOriginal;

            const lotCurrency = r.matchedLots[0]?.currency ?? r.sellCurrency;
            const allSameCurrency = r.matchedLots.every(
              (l) => l.currency === lotCurrency,
            );
            const totalCosteOrig = allSameCurrency
              ? r.matchedLots.reduce((s, l) => {
                  const origQty =
                    l.splitFactor > 0 ? l.quantity / l.splitFactor : l.quantity;
                  return s + origQty * l.buyPriceOriginal + l.buyFeeOriginal;
                }, 0)
              : null;

            const isExpanded = expandedRows.has(i);
            const hasLots = r.matchedLots.length > 0;

            return (
              <Fragment key={i}>
                <tr
                  className={cn(
                    "bg-neutral-800 transition-colors",
                    hasLots && "cursor-pointer hover:bg-neutral-700",
                  )}
                  onClick={() => hasLots && toggleRow(i)}
                >
                  <td className="px-4 py-3 font-mono text-xs whitespace-nowrap">
                    <span className="inline-flex items-center gap-1">
                      {hasLots && (
                        <Icons.ChevronRight
                          className={cn(
                            "text-muted-foreground h-3 w-3 shrink-0 transition-transform duration-150",
                            isExpanded && "rotate-90",
                          )}
                        />
                      )}
                      {formatDate(r.sellDate)}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-medium">{symbol}</td>
                  <td className="text-muted-foreground px-4 py-3" />
                  <td className="px-4 py-3 text-right tabular-nums">
                    {r.quantity.toLocaleString("es-ES", {
                      maximumFractionDigits: 4,
                    })}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums whitespace-nowrap">
                    <WithBase
                      value={r.sellPriceOriginal}
                      currency={r.sellCurrency}
                      fxRate={r.sellFxRate}
                      baseCurrency={baseCurrency}
                    />
                  </td>
                  <td className="text-muted-foreground px-4 py-3 text-right tabular-nums whitespace-nowrap">
                    {fmtFX(r.sellFxRate, r.sellCurrency, baseCurrency)}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums whitespace-nowrap">
                    <WithBase
                      value={totalVenta}
                      currency={r.sellCurrency}
                      fxRate={r.sellFxRate}
                      baseCurrency={baseCurrency}
                    />
                  </td>
                  <td className="text-muted-foreground px-4 py-3 text-right tabular-nums whitespace-nowrap">
                    <WithBase
                      value={r.sellFeeOriginal}
                      currency={r.sellCurrency}
                      fxRate={r.sellFxRate}
                      baseCurrency={baseCurrency}
                    />
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums whitespace-nowrap">
                    <WithBase
                      value={netoVenta}
                      currency={r.sellCurrency}
                      fxRate={r.sellFxRate}
                      baseCurrency={baseCurrency}
                    />
                  </td>
                  <td className="text-muted-foreground px-4 py-3 text-right tabular-nums whitespace-nowrap">
                    {totalCosteOrig !== null ? (
                      <WithBase
                        value={totalCosteOrig}
                        currency={lotCurrency}
                        fxRate={r.matchedLots[0]?.buyFxRate ?? 1}
                        baseCurrency={baseCurrency}
                      />
                    ) : (
                      formatAmount(r.costBasis, baseCurrency)
                    )}
                  </td>
                  <td
                    className={cn(
                      "px-4 py-3 text-right font-semibold tabular-nums whitespace-nowrap",
                      r.gain >= 0 ? "text-green-600" : "text-red-500",
                    )}
                  >
                    {r.gain >= 0 ? "+" : ""}
                    {formatAmount(r.gain, baseCurrency)}
                  </td>
                </tr>

                {isExpanded &&
                  r.matchedLots.map((lot, j) => {
                    const origQty =
                      lot.splitFactor > 0
                        ? lot.quantity / lot.splitFactor
                        : lot.quantity;
                    const lotTotal = origQty * lot.buyPriceOriginal;
                    const lotTotalConCom = lotTotal + lot.buyFeeOriginal;
                    return (
                      <tr
                        key={`${i}-${j}`}
                        className="bg-neutral-700/40 text-xs"
                      >
                        <td className="text-muted-foreground py-1.5 pr-3 pl-8 font-mono whitespace-nowrap">
                          ↳ {formatDate(lot.buyDate)}
                        </td>
                        <td className="text-muted-foreground px-3 py-1.5" />
                        <td className="text-muted-foreground px-3 py-1.5 whitespace-nowrap">
                          {accountNameFor(accounts, lot.accountId)}
                        </td>
                        <td className="text-muted-foreground px-3 py-1.5 text-right tabular-nums">
                          {origQty.toLocaleString("es-ES", {
                            maximumFractionDigits: 6,
                          })}
                          {lot.splitFactor !== 1 && (
                            <span className="ml-1 text-[10px] opacity-50">
                              ×{lot.splitFactor}
                            </span>
                          )}
                        </td>
                        <td className="text-muted-foreground px-3 py-1.5 text-right tabular-nums whitespace-nowrap">
                          <WithBase
                            value={lot.buyPriceOriginal}
                            currency={lot.currency}
                            fxRate={lot.buyFxRate}
                            baseCurrency={baseCurrency}
                          />
                        </td>
                        <td className="text-muted-foreground px-3 py-1.5 text-right tabular-nums whitespace-nowrap">
                          {fmtFX(lot.buyFxRate, lot.currency, baseCurrency)}
                        </td>
                        <td className="text-muted-foreground px-3 py-1.5 text-right tabular-nums whitespace-nowrap">
                          <WithBase
                            value={lotTotal}
                            currency={lot.currency}
                            fxRate={lot.buyFxRate}
                            baseCurrency={baseCurrency}
                          />
                        </td>
                        <td className="text-muted-foreground px-3 py-1.5 text-right tabular-nums whitespace-nowrap">
                          <WithBase
                            value={lot.buyFeeOriginal}
                            currency={lot.currency}
                            fxRate={lot.buyFxRate}
                            baseCurrency={baseCurrency}
                          />
                        </td>
                        <td className="text-muted-foreground px-3 py-1.5 text-right tabular-nums whitespace-nowrap">
                          <WithBase
                            value={lotTotalConCom}
                            currency={lot.currency}
                            fxRate={lot.buyFxRate}
                            baseCurrency={baseCurrency}
                          />
                        </td>
                        <td colSpan={2} />
                      </tr>
                    );
                  })}
              </Fragment>
            );
          })
        )}
      </tbody>
    </table>
  );
}

interface OpenPositionsTableProps {
  positions: OpenPosition[];
  accounts: Account[];
  assets: AssetOption[];
  baseCurrency: string;
  isLoading: boolean;
  expandedRows: Set<number>;
  toggleRow: (i: number) => void;
}

export function OpenPositionsTable({
  positions,
  accounts,
  assets,
  baseCurrency,
  isLoading,
  expandedRows,
  toggleRow,
}: OpenPositionsTableProps) {
  const { sortCol, sortDir, handleSort } = useSort();

  const sortedPositions = sortCol
    ? [...positions].sort((a, b) => {
        let cmp = 0;
        if (sortCol === "asset") {
          cmp = symbolFor(assets, a.assetId).localeCompare(
            symbolFor(assets, b.assetId),
            "es",
          );
        } else {
          const dateA = a.lots.length > 0 ? a.lots[0].buyDate : "";
          const dateB = b.lots.length > 0 ? b.lots[0].buyDate : "";
          cmp = dateA.localeCompare(dateB);
        }
        return sortDir === "asc" ? cmp : -cmp;
      })
    : positions;

  return (
    <table className="w-full text-left text-sm">
      <thead>
        <tr className="bg-black text-white">
          <th className={thSort}>
            <span onClick={() => handleSort("date")} className="cursor-pointer">
              Fecha <SortArrow active={sortCol === "date"} dir={sortDir} />
            </span>
            <span className="mx-1 opacity-40">/</span>
            <span
              onClick={() => handleSort("asset")}
              className="cursor-pointer"
            >
              Activo <SortArrow active={sortCol === "asset"} dir={sortDir} />
            </span>
          </th>
          <th className="px-4 py-3 font-medium whitespace-nowrap">Cuenta</th>
          <th className="px-4 py-3 text-right font-medium whitespace-nowrap">
            Acciones
          </th>
          <th className="px-4 py-3 text-right font-medium whitespace-nowrap">
            Precio compra
          </th>
          <th className="px-4 py-3 text-right font-medium whitespace-nowrap">
            Tasa FX
          </th>
          <th className="px-4 py-3 text-right font-medium whitespace-nowrap">
            Total orig.
          </th>
          <th className="px-4 py-3 text-right font-medium whitespace-nowrap">
            Comisiones
          </th>
          <th className="px-4 py-3 text-right font-medium whitespace-nowrap">
            Coste base
          </th>
        </tr>
      </thead>
      <tbody className="divide-border divide-y">
        {sortedPositions.length === 0 ? (
          <tr>
            <td
              colSpan={8}
              className="text-muted-foreground px-6 py-12 text-center italic"
            >
              {isLoading
                ? "Buscando posiciones..."
                : "No hay posiciones abiertas para estos filtros."}
            </td>
          </tr>
        ) : (
          sortedPositions.map((p, i) => {
            const symbol = symbolFor(assets, p.assetId);
            const isExpanded = expandedRows.has(i);
            const hasLots = p.lots.length > 0;

            return (
              <Fragment key={i}>
                <tr
                  className={cn(
                    "bg-neutral-800 transition-colors",
                    hasLots && "cursor-pointer hover:bg-neutral-700",
                  )}
                  onClick={() => hasLots && toggleRow(i)}
                >
                  <td className="px-4 py-3 font-medium">
                    <span className="inline-flex items-center gap-1">
                      {hasLots && (
                        <Icons.ChevronRight
                          className={cn(
                            "text-muted-foreground h-3 w-3 shrink-0 transition-transform duration-150",
                            isExpanded && "rotate-90",
                          )}
                        />
                      )}
                      {symbol}
                    </span>
                  </td>
                  <td className="text-muted-foreground px-4 py-3" />
                  <td className="px-4 py-3 text-right font-semibold tabular-nums">
                    {p.totalQuantity.toLocaleString("es-ES", {
                      maximumFractionDigits: 4,
                    })}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums whitespace-nowrap">
                    <span className="flex flex-col items-end gap-0.5 leading-tight">
                      <span>
                        {formatAmount(p.avgUnitPriceBase, baseCurrency)}
                        <span className="text-muted-foreground ml-1 text-[10px]">
                          /acc.
                        </span>
                      </span>
                      <span className="text-muted-foreground/70 text-[10px]">
                        precio medio
                      </span>
                    </span>
                  </td>
                  <td className="text-muted-foreground px-4 py-3 text-right">
                    —
                  </td>
                  <td className="text-muted-foreground px-4 py-3 text-right">
                    —
                  </td>
                  <td className="text-muted-foreground px-4 py-3 text-right tabular-nums whitespace-nowrap">
                    {formatAmount(p.totalFeesBase, baseCurrency)}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold tabular-nums whitespace-nowrap">
                    {formatAmount(p.totalCostBase, baseCurrency)}
                  </td>
                </tr>

                {isExpanded &&
                  p.lots.map((lot, j) => {
                    const origQty =
                      lot.splitFactor > 0
                        ? lot.quantity / lot.splitFactor
                        : lot.quantity;
                    const lotOrigTotal = origQty * lot.unitPriceOriginal;

                    return (
                      <tr
                        key={`${i}-${j}`}
                        className="bg-neutral-700/40 text-xs"
                      >
                        <td className="text-muted-foreground py-1.5 pr-3 pl-8 font-mono whitespace-nowrap">
                          ↳ {formatDate(lot.buyDate)}
                        </td>
                        <td className="text-muted-foreground px-3 py-1.5 whitespace-nowrap">
                          {accountNameFor(accounts, lot.accountId)}
                        </td>
                        <td className="text-muted-foreground px-3 py-1.5 text-right tabular-nums">
                          {lot.quantity.toLocaleString("es-ES", {
                            maximumFractionDigits: 6,
                          })}
                          {lot.splitFactor !== 1 && (
                            <span
                              className="ml-1.5 rounded px-1 py-0.5 text-[10px] font-semibold"
                              style={{
                                background:
                                  lot.splitFactor > 1 ? "#dcfce7" : "#fef9c3",
                                color:
                                  lot.splitFactor > 1 ? "#15803d" : "#854d0e",
                              }}
                              title={
                                lot.splitFactor > 1
                                  ? `Split aplicado ×${lot.splitFactor}`
                                  : `Contrasplit aplicado ×${lot.splitFactor}`
                              }
                            >
                              ×{lot.splitFactor}
                            </span>
                          )}
                        </td>
                        <td className="text-muted-foreground px-3 py-1.5 text-right tabular-nums whitespace-nowrap">
                          <WithBase
                            value={lot.unitPriceOriginal}
                            currency={lot.currency}
                            fxRate={lot.fxRate}
                            baseCurrency={baseCurrency}
                          />
                        </td>
                        <td className="text-muted-foreground px-3 py-1.5 text-right tabular-nums whitespace-nowrap">
                          {fmtFX(lot.fxRate, lot.currency, baseCurrency)}
                        </td>
                        <td className="text-muted-foreground px-3 py-1.5 text-right tabular-nums whitespace-nowrap">
                          <WithBase
                            value={lotOrigTotal}
                            currency={lot.currency}
                            fxRate={lot.fxRate}
                            baseCurrency={baseCurrency}
                          />
                        </td>
                        <td className="text-muted-foreground px-3 py-1.5 text-right tabular-nums whitespace-nowrap">
                          <WithBase
                            value={lot.feeOriginal}
                            currency={lot.currency}
                            fxRate={lot.fxRate}
                            baseCurrency={baseCurrency}
                          />
                        </td>
                        <td className="text-muted-foreground px-3 py-1.5 text-right tabular-nums whitespace-nowrap">
                          {formatAmount(lot.costBase, baseCurrency)}
                        </td>
                      </tr>
                    );
                  })}
              </Fragment>
            );
          })
        )}
      </tbody>
    </table>
  );
}
