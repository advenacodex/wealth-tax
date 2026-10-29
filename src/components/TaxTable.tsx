import { Fragment, useState } from "react";
import { useAddonTranslation, type Account } from "@wealthfolio/addon-sdk";
import { cn, Icons } from "@wealthfolio/ui";
import type { AssetOption } from "../hooks/use-tax-data";
import type { OpenPosition, RealizedGain } from "../utils/fifo-engine";
import { fmtMoney, fmtNumber } from "../utils/format";
import { totalizeByAsset, type Amount } from "../utils/totals";

// La alineación va en línea: el addon no empaqueta CSS propio y depende de las
// clases que el host tenga compiladas.
// Cabecera fija dentro del contenedor con scroll de la tabla.
const STICKY_HEAD = {
  position: "sticky",
  top: 0,
  zIndex: 1,
  background: "#000",
} as const;
const RIGHT = { textAlign: "right" } as const;
const RIGHT_BLOCK = { display: "block", textAlign: "right" } as const;

function formatDate(dateStr: string) {
  return dateStr.slice(0, 10);
}

function fmtOrig(value: number, currency: string) {
  return fmtMoney(value, currency, 2, 4);
}

function fmtFX(rate: number, currency: string, baseCurrency: string) {
  if (currency === baseCurrency) return "—";
  return fmtNumber(rate, 4, 6);
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
    return (
      <span className="text-muted-foreground" style={RIGHT_BLOCK}>
        {zero}
      </span>
    );
  if (currency === baseCurrency)
    return <span style={RIGHT_BLOCK}>{fmtMoney(value, baseCurrency)}</span>;
  return (
    <span className="flex flex-col items-end gap-0.5 leading-tight">
      <span>{fmtOrig(value, currency)}</span>
      <span className="text-muted-foreground/70 text-[10px]">
        {fmtMoney(value * fxRate, baseCurrency)}
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

// Nombre de la cuenta si es una sola; "Varias" / "Multiple" si hay más de una.
function accountsLabel(accounts: Account[], ids: string[], multiple: string) {
  const unique = Array.from(new Set(ids));
  if (unique.length === 0) return "";
  if (unique.length === 1) return accountNameFor(accounts, unique[0]);
  return multiple;
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
  const { t } = useAddonTranslation();

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
      <thead style={STICKY_HEAD}>
        <tr className="bg-black text-white">
          <th className={thSort} onClick={() => handleSort("date")}>
            {t("colDate")} <SortArrow active={sortCol === "date"} dir={sortDir} />
          </th>
          <th
            className={cn(thSort, "whitespace-nowrap")}
            onClick={() => handleSort("asset")}
          >
            {t("colAsset")} <SortArrow active={sortCol === "asset"} dir={sortDir} />
          </th>
          <th className="px-4 py-3 font-medium whitespace-nowrap">{t("colAccount")}</th>
          <th className="px-4 py-3 text-right font-medium" style={RIGHT}>{t("colQty")}</th>
          <th className="px-4 py-3 text-right font-medium whitespace-nowrap" style={RIGHT}>{t("colPrice")}</th>
          <th className="px-4 py-3 text-right font-medium whitespace-nowrap" style={RIGHT}>{t("colFx")}</th>
          <th className="px-4 py-3 text-right font-medium whitespace-nowrap" style={RIGHT}>{t("colTotal")}</th>
          <th className="px-4 py-3 text-right font-medium" style={RIGHT}>{t("colFees")}</th>
          <th className="px-4 py-3 text-right font-medium whitespace-nowrap" style={RIGHT}>{t("colNet")}</th>
          <th className="px-4 py-3 text-right font-medium whitespace-nowrap" style={RIGHT}>{t("colOrigCost")}</th>
          <th className="px-4 py-3 text-right font-medium whitespace-nowrap" style={RIGHT}>{t("colGain")}</th>
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
                ? t("searchingOps")
                : t("noOps")}
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
                  <td className="text-muted-foreground px-4 py-3 whitespace-nowrap">
                    {accountNameFor(accounts, r.accountId)}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums" style={RIGHT}>
                    {fmtNumber(r.quantity, 0, 4)}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums whitespace-nowrap" style={RIGHT}>
                    <WithBase
                      value={r.sellPriceOriginal}
                      currency={r.sellCurrency}
                      fxRate={r.sellFxRate}
                      baseCurrency={baseCurrency}
                    />
                  </td>
                  <td className="text-muted-foreground px-4 py-3 text-right tabular-nums whitespace-nowrap" style={RIGHT}>
                    {fmtFX(r.sellFxRate, r.sellCurrency, baseCurrency)}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums whitespace-nowrap" style={RIGHT}>
                    <WithBase
                      value={totalVenta}
                      currency={r.sellCurrency}
                      fxRate={r.sellFxRate}
                      baseCurrency={baseCurrency}
                    />
                  </td>
                  <td className="text-muted-foreground px-4 py-3 text-right tabular-nums whitespace-nowrap" style={RIGHT}>
                    <WithBase
                      value={r.sellFeeOriginal}
                      currency={r.sellCurrency}
                      fxRate={r.sellFxRate}
                      baseCurrency={baseCurrency}
                    />
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums whitespace-nowrap" style={RIGHT}>
                    <WithBase
                      value={netoVenta}
                      currency={r.sellCurrency}
                      fxRate={r.sellFxRate}
                      baseCurrency={baseCurrency}
                    />
                  </td>
                  <td className="text-muted-foreground px-4 py-3 text-right tabular-nums whitespace-nowrap" style={RIGHT}>
                    {totalCosteOrig !== null ? (
                      <WithBase
                        value={totalCosteOrig}
                        currency={lotCurrency}
                        fxRate={r.matchedLots[0]?.buyFxRate ?? 1}
                        baseCurrency={baseCurrency}
                      />
                    ) : (
                      fmtMoney(r.costBasis, baseCurrency)
                    )}
                  </td>
                  <td
                    className={cn(
                      "px-4 py-3 text-right font-semibold tabular-nums whitespace-nowrap",
                      r.gain >= 0 ? "text-green-600" : "text-red-500",
                    )}
                    style={RIGHT}
                  >
                    {r.gain >= 0 ? "+" : ""}
                    {fmtMoney(r.gain, baseCurrency)}
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
                        <td className="text-muted-foreground px-3 py-1.5 text-right tabular-nums" style={RIGHT}>
                          {fmtNumber(origQty, 0, 6)}
                          {lot.splitFactor !== 1 && (
                            <span className="ml-1 text-[10px] opacity-50">
                              ×{lot.splitFactor}
                            </span>
                          )}
                        </td>
                        <td className="text-muted-foreground px-3 py-1.5 text-right tabular-nums whitespace-nowrap" style={RIGHT}>
                          <WithBase
                            value={lot.buyPriceOriginal}
                            currency={lot.currency}
                            fxRate={lot.buyFxRate}
                            baseCurrency={baseCurrency}
                          />
                        </td>
                        <td className="text-muted-foreground px-3 py-1.5 text-right tabular-nums whitespace-nowrap" style={RIGHT}>
                          {fmtFX(lot.buyFxRate, lot.currency, baseCurrency)}
                        </td>
                        <td className="text-muted-foreground px-3 py-1.5 text-right tabular-nums whitespace-nowrap" style={RIGHT}>
                          <WithBase
                            value={lotTotal}
                            currency={lot.currency}
                            fxRate={lot.buyFxRate}
                            baseCurrency={baseCurrency}
                          />
                        </td>
                        <td className="text-muted-foreground px-3 py-1.5 text-right tabular-nums whitespace-nowrap" style={RIGHT}>
                          <WithBase
                            value={lot.buyFeeOriginal}
                            currency={lot.currency}
                            fxRate={lot.buyFxRate}
                            baseCurrency={baseCurrency}
                          />
                        </td>
                        <td className="text-muted-foreground px-3 py-1.5 text-right tabular-nums whitespace-nowrap" style={RIGHT}>
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

// Importe totalizado: con divisa homogénea se muestra el original y debajo el
// equivalente en base; con divisas mezcladas, solo el importe en base.
function TotalAmount({
  amount,
  currency,
  baseCurrency,
}: {
  amount: Amount;
  currency: string | null;
  baseCurrency: string;
}) {
  if (currency === null)
    return (
      <WithBase
        value={amount.base}
        currency={baseCurrency}
        fxRate={1}
        baseCurrency={baseCurrency}
      />
    );
  return (
    <WithBase
      value={amount.orig}
      currency={currency}
      fxRate={amount.orig !== 0 ? amount.base / amount.orig : 1}
      baseCurrency={baseCurrency}
    />
  );
}

interface ClosedTotalsTableProps {
  results: RealizedGain[];
  accounts: Account[];
  assets: AssetOption[];
  baseCurrency: string;
  isLoading: boolean;
}

export function ClosedTotalsTable({
  results,
  accounts,
  assets,
  baseCurrency,
  isLoading,
}: ClosedTotalsTableProps) {
  const { sortCol, sortDir, handleSort } = useSort();
  const { t } = useAddonTranslation();

  // El FIFO es por activo y grupo de cuentas: cada pareja es una fila.
  const groupOf = (accountId: string) =>
    accounts.find((a) => a.id === accountId)?.group || accountId;

  // Nombre del grupo; una cuenta sin grupo es su propio pool y se muestra por
  // su nombre.
  const labelOf = (poolKey: string) =>
    accounts.find((a) => a.id === poolKey)?.name || poolKey;

  const totals = totalizeByAsset(results, groupOf).sort((a, b) => {
    const byDate = sortCol === "date";
    const cmp = byDate
      ? a.lastSellDate.localeCompare(b.lastSellDate)
      : symbolFor(assets, a.assetId).localeCompare(
            symbolFor(assets, b.assetId),
            "es",
          ) || a.poolKey.localeCompare(b.poolKey, "es");
    return sortCol && sortDir === "desc" ? -cmp : cmp;
  });

  return (
    <table className="w-full text-left text-sm">
      <thead style={STICKY_HEAD}>
        <tr className="bg-black text-white">
          <th className={thSort} onClick={() => handleSort("date")}>
            {t("colLastSale")}{" "}
            <SortArrow active={sortCol === "date"} dir={sortDir} />
          </th>
          <th className={thSort} onClick={() => handleSort("asset")}>
            {t("colAsset")} <SortArrow active={sortCol === "asset"} dir={sortDir} />
          </th>
          <th className="px-4 py-3 font-medium whitespace-nowrap">{t("colGroup")}</th>
          <th className="px-4 py-3 text-right font-medium" style={RIGHT}>{t("colQty")}</th>
          <th className="px-4 py-3 text-right font-medium whitespace-nowrap" style={RIGHT}>{t("colAvgPrice")}</th>
          <th className="px-4 py-3 text-right font-medium whitespace-nowrap" style={RIGHT}>{t("colFx")}</th>
          <th className="px-4 py-3 text-right font-medium whitespace-nowrap" style={RIGHT}>{t("colTotal")}</th>
          <th className="px-4 py-3 text-right font-medium" style={RIGHT}>{t("colFees")}</th>
          <th className="px-4 py-3 text-right font-medium whitespace-nowrap" style={RIGHT}>{t("colNet")}</th>
          <th className="px-4 py-3 text-right font-medium whitespace-nowrap" style={RIGHT}>{t("colOrigCost")}</th>
          <th className="px-4 py-3 text-right font-medium whitespace-nowrap" style={RIGHT}>{t("colGain")}</th>
        </tr>
      </thead>
      <tbody className="divide-border divide-y">
        {totals.length === 0 ? (
          <tr>
            <td
              colSpan={11}
              className="text-muted-foreground px-6 py-12 text-center italic"
            >
              {isLoading
                ? t("searchingOps")
                : t("noOps")}
            </td>
          </tr>
        ) : (
          totals.map((row) => {
            const sellFx =
              row.total.orig !== 0 ? row.total.base / row.total.orig : 1;
            const avgPrice =
              row.sellCurrency !== null
                ? { orig: row.total.orig / row.quantity, base: row.total.base / row.quantity }
                : { orig: 0, base: row.total.base / row.quantity };
            return (
              <tr key={`${row.assetId}|||${row.poolKey}`} className="bg-neutral-800">
                <td className="px-4 py-3 font-mono text-xs whitespace-nowrap">
                  {formatDate(row.lastSellDate)}
                </td>
                <td className="px-4 py-3 font-medium">
                  {symbolFor(assets, row.assetId)}
                </td>
                <td className="text-muted-foreground px-4 py-3 whitespace-nowrap">
                  {labelOf(row.poolKey)}
                </td>
                <td className="px-4 py-3 text-right tabular-nums" style={RIGHT}>
                  {fmtNumber(row.quantity, 0, 4)}
                </td>
                <td className="px-4 py-3 text-right tabular-nums whitespace-nowrap" style={RIGHT}>
                  <TotalAmount
                    amount={avgPrice}
                    currency={row.sellCurrency}
                    baseCurrency={baseCurrency}
                  />
                </td>
                <td className="text-muted-foreground px-4 py-3 text-right tabular-nums whitespace-nowrap" style={RIGHT}>
                  {row.sellCurrency !== null
                    ? fmtFX(sellFx, row.sellCurrency, baseCurrency)
                    : "—"}
                </td>
                <td className="px-4 py-3 text-right tabular-nums whitespace-nowrap" style={RIGHT}>
                  <TotalAmount
                    amount={row.total}
                    currency={row.sellCurrency}
                    baseCurrency={baseCurrency}
                  />
                </td>
                <td className="text-muted-foreground px-4 py-3 text-right tabular-nums whitespace-nowrap" style={RIGHT}>
                  <TotalAmount
                    amount={row.fee}
                    currency={row.sellCurrency}
                    baseCurrency={baseCurrency}
                  />
                </td>
                <td className="px-4 py-3 text-right tabular-nums whitespace-nowrap" style={RIGHT}>
                  <TotalAmount
                    amount={row.net}
                    currency={row.sellCurrency}
                    baseCurrency={baseCurrency}
                  />
                </td>
                <td className="text-muted-foreground px-4 py-3 text-right tabular-nums whitespace-nowrap" style={RIGHT}>
                  <TotalAmount
                    amount={row.cost}
                    currency={row.costCurrency}
                    baseCurrency={baseCurrency}
                  />
                </td>
                <td
                  className={cn(
                    "px-4 py-3 text-right font-semibold tabular-nums whitespace-nowrap",
                    row.gain >= 0 ? "text-green-600" : "text-red-500",
                  )}
                  style={RIGHT}
                >
                  {row.gain >= 0 ? "+" : ""}
                  {fmtMoney(row.gain, baseCurrency)}
                </td>
              </tr>
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
  const { t } = useAddonTranslation();

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
      <thead style={STICKY_HEAD}>
        <tr className="bg-black text-white">
          <th className={thSort}>
            <span onClick={() => handleSort("date")} className="cursor-pointer">
              {t("colDate")} <SortArrow active={sortCol === "date"} dir={sortDir} />
            </span>
            <span className="mx-1 opacity-40">/</span>
            <span
              onClick={() => handleSort("asset")}
              className="cursor-pointer"
            >
              {t("colAsset")} <SortArrow active={sortCol === "asset"} dir={sortDir} />
            </span>
          </th>
          <th className="px-4 py-3 font-medium whitespace-nowrap">{t("colAccount")}</th>
          <th className="px-4 py-3 text-right font-medium whitespace-nowrap" style={RIGHT}>{t("colShares")}</th>
          <th className="px-4 py-3 text-right font-medium whitespace-nowrap" style={RIGHT}>{t("colBuyPrice")}</th>
          <th className="px-4 py-3 text-right font-medium whitespace-nowrap" style={RIGHT}>{t("colFx")}</th>
          <th className="px-4 py-3 text-right font-medium whitespace-nowrap" style={RIGHT}>{t("colOrigTotal")}</th>
          <th className="px-4 py-3 text-right font-medium whitespace-nowrap" style={RIGHT}>{t("colFees")}</th>
          <th className="px-4 py-3 text-right font-medium whitespace-nowrap" style={RIGHT}>{t("colCostBasis")}</th>
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
                ? t("searchingPositions")
                : t("noPositions")}
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
                  <td className="text-muted-foreground px-4 py-3 whitespace-nowrap">
                    {accountsLabel(
                      accounts,
                      p.lots.map((l) => l.accountId),
                      t("multiple"),
                    )}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold tabular-nums" style={RIGHT}>
                    {fmtNumber(p.totalQuantity, 0, 4)}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums whitespace-nowrap" style={RIGHT}>
                    <span className="flex flex-col items-end gap-0.5 leading-tight">
                      <span>
                        {fmtMoney(p.avgUnitPriceBase, baseCurrency)}
                        <span className="text-muted-foreground ml-1 text-[10px]">{t("perShare")}</span>
                      </span>
                      <span className="text-muted-foreground/70 text-[10px]">{t("averagePrice")}</span>
                    </span>
                  </td>
                  <td className="text-muted-foreground px-4 py-3 text-right" style={RIGHT}>
                    —
                  </td>
                  <td className="text-muted-foreground px-4 py-3 text-right" style={RIGHT}>
                    —
                  </td>
                  <td className="text-muted-foreground px-4 py-3 text-right tabular-nums whitespace-nowrap" style={RIGHT}>
                    {fmtMoney(p.totalFeesBase, baseCurrency)}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold tabular-nums whitespace-nowrap" style={RIGHT}>
                    {fmtMoney(p.totalCostBase, baseCurrency)}
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
                        <td className="text-muted-foreground px-3 py-1.5 text-right tabular-nums" style={RIGHT}>
                          {fmtNumber(lot.quantity, 0, 6)}
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
                                  ? t("splitApplied", { factor: lot.splitFactor })
                                  : t("reverseSplitApplied", { factor: lot.splitFactor })
                              }
                            >
                              ×{lot.splitFactor}
                            </span>
                          )}
                        </td>
                        <td className="text-muted-foreground px-3 py-1.5 text-right tabular-nums whitespace-nowrap" style={RIGHT}>
                          <WithBase
                            value={lot.unitPriceOriginal}
                            currency={lot.currency}
                            fxRate={lot.fxRate}
                            baseCurrency={baseCurrency}
                          />
                        </td>
                        <td className="text-muted-foreground px-3 py-1.5 text-right tabular-nums whitespace-nowrap" style={RIGHT}>
                          {fmtFX(lot.fxRate, lot.currency, baseCurrency)}
                        </td>
                        <td className="text-muted-foreground px-3 py-1.5 text-right tabular-nums whitespace-nowrap" style={RIGHT}>
                          <WithBase
                            value={lotOrigTotal}
                            currency={lot.currency}
                            fxRate={lot.fxRate}
                            baseCurrency={baseCurrency}
                          />
                        </td>
                        <td className="text-muted-foreground px-3 py-1.5 text-right tabular-nums whitespace-nowrap" style={RIGHT}>
                          <WithBase
                            value={lot.feeOriginal}
                            currency={lot.currency}
                            fxRate={lot.fxRate}
                            baseCurrency={baseCurrency}
                          />
                        </td>
                        <td className="text-muted-foreground px-3 py-1.5 text-right tabular-nums whitespace-nowrap" style={RIGHT}>
                          {fmtMoney(lot.costBase, baseCurrency)}
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
