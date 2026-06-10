import type { ActivityDetails } from "@wealthfolio/addon-sdk";

// Activity reduced to plain numeric fields, with the effective account group
// resolved and the original currency amount converted to the user's base
// currency via the activity's fxRate (price/fee × fxRate = base currency).
export interface NormalizedActivity {
  id: string;
  accountId: string;
  assetId: string;
  activityType: string;
  date: string; // ISO timestamp
  quantity: number;
  unitPrice: number;
  amount: number;
  fee: number;
  currency: string;
  fxRate: number;
  accountGroup?: string;
}

export function normalizeActivities(
  activities: ActivityDetails[],
  accountGroups: Map<string, string | undefined>,
): NormalizedActivity[] {
  return activities.map((a) => ({
    id: a.id,
    accountId: a.accountId,
    assetId: a.assetId,
    activityType: (a.activityType || "").toUpperCase(),
    date: new Date(a.date).toISOString(),
    quantity: Number(a.quantity) || 0,
    unitPrice: Number(a.unitPrice) || 0,
    amount: Number(a.amount) || 0,
    fee: Number(a.fee) || 0,
    currency: a.currency,
    fxRate: Number(a.fxRate) || 0,
    accountGroup: accountGroups.get(a.accountId),
  }));
}

// Internal type that carries the cumulative split factor through the pipeline
// so the FIFO loop can reconstruct the original (pre-split) price for display.
type AdjustedActivity = NormalizedActivity & { _splitFactor: number };

export interface Lot {
  buyDate: string;
  accountId: string; // account that originated this buy lot
  quantity: number; // post-split adjusted shares (used for FIFO accounting)
  unitPrice: number; // base currency per post-split share (includes apportioned fee)
  fee: number; // total base-currency fee for this lot (at purchase time)
  originalQuantity: number; // post-split qty when lot was created (for fee apportionment)
  unitPriceOriginal: number; // TRUE original pre-split price in original currency
  feeOriginal: number; // total fee in original currency (at purchase time)
  fxRate: number;
  currency: string;
  splitFactor: number; // cumulative split factor applied to this lot (1 = no split)
}

export interface RealizedGain {
  assetId: string;
  accountId: string;
  sellDate: string;
  quantity: number;
  sellPrice: number;
  sellFee: number;
  sellPriceOriginal: number;
  sellFeeOriginal: number;
  sellFxRate: number;
  sellCurrency: string;
  costBasis: number;
  gain: number;
  matchedLots: {
    buyDate: string;
    accountId: string; // account that originated this buy lot
    quantity: number; // post-split shares consumed from this lot
    buyPrice: number; // base currency per post-split share
    buyPriceOriginal: number; // TRUE original pre-split price in original currency
    buyFeeOriginal: number; // proportional fee in original currency
    buyFxRate: number;
    currency: string;
    splitFactor: number; // same as the lot's splitFactor
  }[];
}

export interface OpenPositionLot {
  buyDate: string;
  accountId: string; // account that originated this buy lot
  quantity: number; // post-split shares remaining in this lot
  unitPriceOriginal: number; // TRUE original pre-split price in original currency
  fxRate: number;
  currency: string;
  splitFactor: number; // cumulative split factor (1 = no split or reverse split)
  feeOriginal: number; // proportional remaining fee in original currency
  feeBase: number; // proportional remaining fee in base currency
  costBase: number; // quantity × unitPrice (base currency, includes proportional fee)
}

export interface OpenPosition {
  assetId: string;
  accountId: string;
  totalQuantity: number; // total post-split shares remaining across all lots
  avgUnitPriceBase: number; // weighted average base-currency cost per share (includes fees)
  totalCostBase: number; // total cost basis in base currency (includes fees)
  totalFeesBase: number; // total proportional fees in base currency
  lots: OpenPositionLot[];
}

// ── Shared internal helper ────────────────────────────────────────────────────
// Runs the full FIFO pipeline and returns both realized gains and the open-lots
// map, so callers can extract whichever they need without duplicating logic.
//
// The map key uses "|||" as a separator so we can correctly round-trip
// assetId / accountId.
interface OpenLotsEntry {
  assetId: string;
  accountId: string;
  lots: Lot[];
}

function _runFIFO(activities: NormalizedActivity[]): {
  realizedGains: RealizedGain[];
  openLotsMap: Map<string, OpenLotsEntry>;
} {
  const sortedActivities = [...activities].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
  );

  // ── 1. Collect splits ────────────────────────────────────────────────────────
  //
  // Convention assumed for Wealthfolio SPLIT activities:
  //   activity ratio = new_shares / old_shares  (ratio > 1 = forward, < 1 = reverse)
  //
  //   Forward split 4:1  →  ratio = 4   (each share → 4 shares)
  //   Reverse split 1:4  →  ratio = 0.25 (every 4 shares → 1 share)
  //
  // Retrospective adjustment for a past buy before a future split:
  //   adj_qty   = qty   × ratio   (more shares after forward split)
  //   adj_price = price / ratio   (lower price per share after forward split)
  //
  // The original price is PRESERVED in unitPriceOriginal = adj_price × ratio = original price.
  //
  // Example: buy 10 @ 100 USD, then 4:1 split
  //   adj_qty = 40, adj_price = 25 USD, splitFactor = 4
  //   unitPriceOriginal = 25 × 4 = 100 USD  ← original price
  //   When selling 10 post-split shares: origEquiv = 10/4 = 2.5 original shares
  //   Cost = 2.5 × 100 = 250 USD  ✓
  //
  // Deduplication: when activities span multiple accounts in the same group, each
  // account may record the same split event. We deduplicate by (assetId, date) so
  // the split factor is applied exactly once.
  const splitFactors: Record<string, { date: string; ratio: number }[]> = {};
  const seenSplits = new Set<string>();
  for (const act of sortedActivities) {
    if (act.activityType === "SPLIT") {
      const splitKey = `${act.assetId}|||${act.date}`;
      if (seenSplits.has(splitKey)) continue;
      seenSplits.add(splitKey);
      // The split ratio is stored in amount / unitPrice / quantity, whichever
      // is populated (e.g. a 4-for-1 forward split has a ratio of 4).
      const ratio = act.amount || act.unitPrice || act.quantity || 0;
      if (ratio > 0) {
        if (!splitFactors[act.assetId]) splitFactors[act.assetId] = [];
        splitFactors[act.assetId].push({ date: act.date, ratio });
      }
    }
  }

  // ── 2. Adjust past activities retrospectively, carrying the split factor ─────
  const adjustedActivities: AdjustedActivity[] = [];
  for (const act of sortedActivities) {
    if (act.activityType === "SPLIT") continue;

    let cumulativeFactor = 1;
    const splits = splitFactors[act.assetId];
    if (splits) {
      for (const split of splits) {
        if (new Date(split.date).getTime() > new Date(act.date).getTime()) {
          cumulativeFactor *= split.ratio;
        }
      }
    }

    const adjAct: AdjustedActivity = { ...act, _splitFactor: cumulativeFactor };
    if (cumulativeFactor !== 1) {
      adjAct.quantity = act.quantity * cumulativeFactor;
      if (act.unitPrice !== 0) {
        adjAct.unitPrice = act.unitPrice / cumulativeFactor;
      }
    }
    adjustedActivities.push(adjAct);
  }

  // ── 3. FIFO processing ───────────────────────────────────────────────────────
  const openLotsMap = new Map<string, OpenLotsEntry>();
  const realizedGains: RealizedGain[] = [];

  // Group key: use accountGroup when available (group-level FIFO), otherwise
  // fall back to accountId so single-account setups continue to work unchanged.
  const getEntry = (assetId: string, act: AdjustedActivity): OpenLotsEntry => {
    const groupKey = act.accountGroup || act.accountId;
    const key = `${assetId}|||${groupKey}`;
    if (!openLotsMap.has(key)) {
      openLotsMap.set(key, { assetId, accountId: groupKey, lots: [] });
    }
    return openLotsMap.get(key)!;
  };

  for (const act of adjustedActivities) {
    const entry = getEntry(act.assetId, act);
    const lots = entry.lots;

    const qty = Math.abs(act.quantity);
    const actType = act.activityType;
    const splitFactor = act._splitFactor; // 1 if no split affected this activity

    const validFxRate = act.fxRate > 0 ? act.fxRate : 1;
    const rawPrice = act.unitPrice; // post-split adjusted price
    const rawFee = act.fee;
    const price = rawPrice * validFxRate;
    const fee = rawFee * validFxRate;

    if (actType === "TRANSFER_IN") {
      // ── Scrip dividend / bonus share (ampliación de capital gratuita) ─────────
      // No acquisition cost. Redistribute total cost over the expanded lot quantity.
      // Each existing lot absorbs a proportional share of the incoming shares.
      //
      //   expansionRatio = (totalExistingQty + incomingQty) / totalExistingQty
      //   new qty             = old qty × expansionRatio
      //   new originalQty     = old originalQty × expansionRatio
      //   new unitPrice       = old unitPrice / expansionRatio   (base cost preserved)
      //   new unitPriceOriginal= old unitPriceOriginal / expansionRatio (orig cost preserved)
      //   feeOriginal stays the same (same fee was paid at purchase)
      //   splitFactor stays the same (scrip is not a split)
      if (lots.length === 0) {
        lots.push({
          buyDate: act.date,
          accountId: act.accountId,
          quantity: qty,
          unitPrice: 0,
          fee: 0,
          originalQuantity: qty,
          unitPriceOriginal: 0,
          feeOriginal: 0,
          fxRate: validFxRate,
          currency: act.currency,
          splitFactor: 1,
        });
      } else {
        const totalExistingQty = lots.reduce((s, l) => s + l.quantity, 0);
        if (totalExistingQty > 0) {
          const expansionRatio = (totalExistingQty + qty) / totalExistingQty;
          for (const lot of lots) {
            lot.quantity *= expansionRatio;
            lot.originalQuantity *= expansionRatio;
            lot.unitPrice /= expansionRatio;
            lot.unitPriceOriginal /= expansionRatio;
            // splitFactor is unchanged — scrip expansion is separate from stock splits
          }
        }
      }
    } else if (["BUY", "RECEIVE"].includes(actType)) {
      const unitCostWithFee = qty > 0 ? price + fee / qty : price;
      lots.push({
        buyDate: act.date,
        accountId: act.accountId,
        quantity: qty, // post-split adjusted shares
        unitPrice: unitCostWithFee, // base currency per post-split share (includes fee)
        fee: fee,
        originalQuantity: qty,
        unitPriceOriginal: rawPrice * splitFactor, // TRUE original pre-split price
        feeOriginal: rawFee,
        fxRate: validFxRate,
        currency: act.currency,
        splitFactor,
      });
    } else if (["SELL", "SEND", "TRANSFER_OUT"].includes(actType)) {
      if (lots.length === 0) continue;

      let remainingToSell = qty;
      let totalCostBasis = 0;
      const matchedLots: RealizedGain["matchedLots"] = [];

      while (remainingToSell > 0 && lots.length > 0) {
        const lot = lots[0];
        const consumeQty = Math.min(remainingToSell, lot.quantity);

        totalCostBasis += consumeQty * lot.unitPrice;

        const proportionalFeeOrig =
          lot.originalQuantity > 0
            ? (consumeQty / lot.originalQuantity) * lot.feeOriginal
            : 0;

        matchedLots.push({
          buyDate: lot.buyDate,
          accountId: lot.accountId,
          quantity: consumeQty, // post-split shares sold from this lot
          buyPrice: lot.unitPrice, // base currency per post-split share
          buyPriceOriginal: lot.unitPriceOriginal, // original pre-split price
          buyFeeOriginal: proportionalFeeOrig,
          buyFxRate: lot.fxRate,
          currency: lot.currency,
          splitFactor: lot.splitFactor,
        });

        lot.quantity -= consumeQty;
        remainingToSell -= consumeQty;

        if (lot.quantity < 1e-9) {
          lots.shift();
        }
      }

      const saleProceeds = qty * price - fee;
      const gain = saleProceeds - totalCostBasis;

      realizedGains.push({
        assetId: act.assetId,
        accountId: act.accountId,
        sellDate: act.date,
        quantity: qty,
        sellPrice: price,
        sellFee: fee,
        sellPriceOriginal: rawPrice,
        sellFeeOriginal: rawFee,
        sellFxRate: validFxRate,
        sellCurrency: act.currency,
        costBasis: totalCostBasis,
        gain: gain,
        matchedLots,
      });
    }
  }

  return { realizedGains, openLotsMap };
}

// ── Public API ────────────────────────────────────────────────────────────────

/** Returns realized gains (closed positions). */
export function calculateFIFO(
  activities: NormalizedActivity[],
): RealizedGain[] {
  return _runFIFO(activities).realizedGains;
}

/** Returns currently open (not yet sold) positions with lot detail. */
export function calculateOpenPositions(
  activities: NormalizedActivity[],
): OpenPosition[] {
  const { openLotsMap } = _runFIFO(activities);
  const result: OpenPosition[] = [];

  for (const { assetId, accountId, lots } of openLotsMap.values()) {
    // Keep only lots with meaningful quantity remaining
    const activeLots = lots.filter((l) => l.quantity > 1e-9);
    if (activeLots.length === 0) continue;

    const totalQuantity = activeLots.reduce((s, l) => s + l.quantity, 0);
    // totalCostBase: sum(qty × unitPrice) — unitPrice already bakes in fee/share
    const totalCostBase = activeLots.reduce(
      (s, l) => s + l.quantity * l.unitPrice,
      0,
    );
    // totalFeesBase: proportional remaining fee = (remaining/original) × totalFee
    const totalFeesBase = activeLots.reduce((s, l) => {
      const prop = l.originalQuantity > 0 ? l.quantity / l.originalQuantity : 1;
      return s + l.fee * prop;
    }, 0);
    const avgUnitPriceBase =
      totalQuantity > 0 ? totalCostBase / totalQuantity : 0;

    result.push({
      assetId,
      accountId,
      totalQuantity,
      avgUnitPriceBase,
      totalCostBase,
      totalFeesBase,
      lots: activeLots.map((l) => {
        const prop =
          l.originalQuantity > 0 ? l.quantity / l.originalQuantity : 1;
        return {
          buyDate: l.buyDate,
          accountId: l.accountId,
          quantity: l.quantity,
          unitPriceOriginal: l.unitPriceOriginal,
          fxRate: l.fxRate,
          currency: l.currency,
          splitFactor: l.splitFactor,
          feeOriginal: l.feeOriginal * prop,
          feeBase: l.fee * prop,
          costBase: l.quantity * l.unitPrice,
        };
      }),
    });
  }

  return result;
}
