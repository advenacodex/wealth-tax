import { useAddonTranslation } from "@wealthfolio/addon-sdk";

// Formato numérico según el idioma de Wealthfolio: es-ES en español y en-US en
// cualquier otro. Se guarda a nivel de módulo porque los formateadores se
// llaman desde funciones auxiliares que no son componentes.
let numberLocale = "es-ES";

// Llamar en el render de la página para fijar el idioma antes de pintar tablas.
export function useNumberLocale() {
  const { language } = useAddonTranslation();
  numberLocale = language === "es" ? "es-ES" : "en-US";
  return numberLocale;
}

export function fmtNumber(
  value: number,
  minDigits = 0,
  maxDigits = minDigits,
) {
  return value.toLocaleString(numberLocale, {
    minimumFractionDigits: minDigits,
    maximumFractionDigits: maxDigits,
    // "always" fuerza el separador de miles también en 4 cifras (1.234,50); los
    // tipos de TS aún no lo recogen.
    useGrouping: "always" as unknown as boolean,
  });
}

// Importe con la divisa a la derecha, separada por un espacio. El euro se
// muestra como "€"; el resto de divisas, con su código.
export function fmtMoney(
  value: number | null | undefined,
  currency: string,
  minDigits = 2,
  maxDigits = 2,
) {
  if (value == null || !Number.isFinite(value)) return "-";
  const shown = Math.abs(value) < 0.005 ? 0 : value;
  const unit = currency.toUpperCase() === "EUR" ? "€" : currency;
  return `${fmtNumber(shown, minDigits, maxDigits)} ${unit}`;
}
