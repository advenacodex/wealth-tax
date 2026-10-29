import type { RealizedGain } from "./fifo-engine";

// Importe en divisa original y su equivalente en la divisa base.
export interface Amount {
  orig: number;
  base: number;
}

export interface ClosedTotal {
  assetId: string;
  // Grupo de cuentas (o cuenta, si no tiene grupo): el lote FIFO es propio de
  // cada grupo, así que nunca se totalizan grupos distintos juntos.
  poolKey: string;
  lastSellDate: string;
  quantity: number;
  // Divisa de venta si todas las ventas la comparten; null si se mezclan.
  sellCurrency: string | null;
  total: Amount;
  fee: Amount;
  net: Amount;
  // Divisa de compra si todos los lotes la comparten; null si se mezclan.
  costCurrency: string | null;
  cost: Amount;
  gain: number;
  sales: number;
}

const add = (a: Amount, orig: number, base: number): Amount => ({
  orig: a.orig + orig,
  base: a.base + base,
});

// Cuando hay mezcla de divisas, `orig` no es sumable y solo vale `base`.
// `poolOf` devuelve el grupo FIFO de una cuenta (su grupo o, si no tiene, ella).
export function totalizeByAsset(
  results: RealizedGain[],
  poolOf: (accountId: string) => string,
): ClosedTotal[] {
  const byAsset = new Map<string, ClosedTotal>();

  for (const r of results) {
    const totalOrig = r.quantity * r.sellPriceOriginal;
    const feeOrig = r.sellFeeOriginal;

    const lotCurrency = r.matchedLots[0]?.currency ?? r.sellCurrency;
    const sameLotCurrency = r.matchedLots.every(
      (l) => l.currency === lotCurrency,
    );
    const costOrig = sameLotCurrency
      ? r.matchedLots.reduce((s, l) => {
          const q = l.splitFactor > 0 ? l.quantity / l.splitFactor : l.quantity;
          return s + q * l.buyPriceOriginal + l.buyFeeOriginal;
        }, 0)
      : 0;

    const poolKey = poolOf(r.accountId);
    const key = `${r.assetId}|||${poolKey}`;
    let t = byAsset.get(key);
    if (!t) {
      t = {
        assetId: r.assetId,
        poolKey,
        lastSellDate: r.sellDate,
        quantity: 0,
        sellCurrency: r.sellCurrency,
        total: { orig: 0, base: 0 },
        fee: { orig: 0, base: 0 },
        net: { orig: 0, base: 0 },
        costCurrency: sameLotCurrency ? lotCurrency : null,
        cost: { orig: 0, base: 0 },
        gain: 0,
        sales: 0,
      };
      byAsset.set(key, t);
    }

    if (r.sellDate > t.lastSellDate) t.lastSellDate = r.sellDate;
    t.quantity += r.quantity;
    if (t.sellCurrency !== r.sellCurrency) t.sellCurrency = null;
    t.total = add(t.total, totalOrig, totalOrig * r.sellFxRate);
    t.fee = add(t.fee, feeOrig, feeOrig * r.sellFxRate);
    t.net = add(
      t.net,
      totalOrig - feeOrig,
      (totalOrig - feeOrig) * r.sellFxRate,
    );
    if (t.costCurrency !== null) {
      if (!sameLotCurrency || lotCurrency !== t.costCurrency)
        t.costCurrency = null;
    }
    t.cost = add(t.cost, costOrig, r.costBasis);
    t.gain += r.gain;
    t.sales += 1;
  }

  return [...byAsset.values()];
}
