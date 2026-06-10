# WealthTax

## English

Addon for [Wealthfolio](https://wealthfolio.app) that generates a tax report
of **realized gains** and **open positions** using the **FIFO** (First-In,
First-Out) method, with support for stock splits and capital increases (scrip
dividends).

It's a port of the `wealthfolio-taxes` project adapted to Wealthfolio's addon
system (data read via `@wealthfolio/addon-sdk`, UI with `@wealthfolio/ui`).

### Features

- **Closed positions**: breakdown of each sale with gain/loss, the buy lots
  consumed via FIFO, fees, and the exchange rate applied.
- **Open positions**: active buy lots per asset/account, with quantity,
  average price, cost basis, and accumulated fees.
- **Splits and reverse splits**: retroactive adjustment of quantity/price for
  purchases prior to the split date (factor `×N` shown on the lots).
- **Capital increases (scrip dividend / `TRANSFER_IN`)**: proportional
  dilution of existing lots with no additional cost.
- **Multi-currency**: amounts in the original currency of each transaction,
  with the equivalent in Wealthfolio's base currency (via `fxRate`) when it
  differs.
- **Filters**: year, account group, account, and asset (group and account are
  mutually exclusive; selecting one clears the other).
- **Group-level FIFO pooling**: if accounts have a `group` assigned, FIFO is
  calculated at the group level (sales from one account can consume lots
  bought from another account in the same group).

### Notes on filters

- The **Year** filter defaults to the current year. In "Open positions" it
  filters lots by **purchase** year: if your open positions were bought in
  previous years, they won't show up until you switch to "All years".
- When filtering by an **account** that belongs to a group, FIFO is computed
  for the whole group, but "Closed positions" only shows sales made from that
  specific account. If that account never recorded sales in the selected
  year, the table will appear empty even though the group does have
  transactions — try "All years" or check "Open positions".

### Privacy and permissions

The addon is **read-only**. It doesn't create, modify, or delete accounts,
activities, holdings, or settings. Permissions declared in `manifest.json`:

| Category     | Functions                       | What for                                            |
| ------------ | ------------------------------- | --------------------------------------------------- |
| `activities` | `getAll`                        | Compute the FIFO cost basis and realized gains      |
| `accounts`   | `getAll`                        | Resolve account groups and account names            |
| `settings`   | `get`                           | Read the base currency to display converted amounts |
| `ui`         | `sidebar.addItem`, `router.add` | Add the menu item and the report page               |

It doesn't request the `portfolio` permission nor access market value /
unrealized gains: it only works with closed positions (sales) and open lots
at cost.

### Installation in Wealthfolio

1. Install dependencies and build:

   ```bash
   pnpm install
   pnpm build
   ```

   This generates `dist/addon.js`.

2. Package `manifest.json` + `dist/addon.js` into a zip:

   ```bash
   zip -r wealth-tax-addon.zip manifest.json dist/addon.js
   ```

3. In Wealthfolio: **Settings → Add-ons → Installed → Install from File**
   (`+` icon) and select the zip.

The addon activates automatically after installation. "WealthTax" will appear
in the sidebar, at the route `/addons/wealth-tax`.

To update after a code change, repeat steps 1-3 (reinstalling with the same
`id` overwrites the previous version).

> If `pnpm` isn't available in your PATH, use `npx pnpm@9 <command>`.

### Development

```bash
pnpm install        # install dependencies
pnpm dev            # build in watch mode
pnpm dev:server     # addon dev server (wealthfolio dev)
pnpm build          # production build → dist/addon.js
pnpm type-check     # type checking (tsc --noEmit)
pnpm bundle         # clean + build + package → dist/*.zip
```

### Project structure

```
manifest.json                  # addon metadata and permissions
src/
├── index.ts                   # enable(): registers sidebar, route and cleanup
├── components/
│   ├── TaxesPage.tsx           # main page (filters, summary, tables)
│   └── TaxTable.tsx             # closed/open positions tables
├── hooks/
│   └── use-tax-data.ts          # data loading, filters and aggregates
└── utils/
    └── fifo-engine.ts            # FIFO engine (splits, scrip dividends, lots)
```

### Origin

The FIFO calculation logic (`src/utils/fifo-engine.ts`) is a port of the
`src/lib/fifo.ts` module from the `wealthfolio-taxes` project, adapted to
`@wealthfolio/addon-sdk` types and generalized for any base currency (the
`*EUR` fields from the original are renamed to `*Base`).

### License

MIT

---

## Español

Addon para [Wealthfolio](https://wealthfolio.app) que genera un informe fiscal de
**plusvalías realizadas** y **posiciones abiertas** usando el método **FIFO**
(First-In, First-Out), con soporte para splits de acciones y ampliaciones de
capital (scrip dividends).

Es un puerto del proyecto `wealthfolio-taxes` adaptado al sistema de addons de
Wealthfolio (lectura de datos vía `@wealthfolio/addon-sdk`, UI con
`@wealthfolio/ui`).

### Funcionalidades

- **Posiciones cerradas**: desglose de cada venta con plusvalía/minusvalía,
  lotes de compra consumidos por FIFO, comisiones y tipo de cambio aplicado.
- **Posiciones abiertas**: lotes de compra activos por activo/cuenta, con
  cantidad, precio medio, coste base y comisiones acumuladas.
- **Splits y contrasplits**: ajuste retrospectivo de cantidad/precio en las
  compras anteriores a la fecha del split (factor `×N` mostrado en los lotes).
- **Ampliaciones de capital (scrip dividend / `TRANSFER_IN`)**: dilución
  proporcional de los lotes existentes sin coste adicional.
- **Multi-divisa**: importes en la divisa original de cada operación, con el
  equivalente en la divisa base de Wealthfolio (vía `fxRate`) cuando difiere.
- **Filtros**: año, grupo de cuentas, cuenta y activo (grupo y cuenta son
  mutuamente excluyentes; seleccionar uno limpia el otro).
- **Pooling FIFO por grupo**: si las cuentas tienen un `group` asignado, el
  FIFO se calcula a nivel de grupo (las ventas de una cuenta pueden consumir
  lotes comprados desde otra cuenta del mismo grupo).

### Notas sobre filtros

- El filtro **Año** se preselecciona al año actual. En "Posiciones abiertas"
  filtra los lotes por año de **compra**: si tus posiciones abiertas se
  compraron en años anteriores, no aparecerán hasta que cambies a "Todos los
  años".
- Al filtrar por una **cuenta** que pertenece a un grupo, el FIFO se calcula
  para todo el grupo, pero en "Posiciones cerradas" solo se muestran las
  ventas realizadas desde esa cuenta concreta. Si esa cuenta nunca registró
  ventas en el año seleccionado, la tabla aparecerá vacía aunque el grupo sí
  tenga operaciones — prueba "Todos los años" o revisa "Posiciones abiertas".

### Privacidad y permisos

El addon es de **solo lectura**. No crea, modifica ni borra cuentas,
actividades, holdings ni configuración. Permisos declarados en
`manifest.json`:

| Categoría    | Funciones                       | Para qué                                                |
| ------------ | ------------------------------- | ------------------------------------------------------- |
| `activities` | `getAll`                        | Calcular el coste base FIFO y las plusvalías realizadas |
| `accounts`   | `getAll`                        | Resolver grupos de cuentas y nombres de cuenta          |
| `settings`   | `get`                           | Leer la divisa base para mostrar importes convertidos   |
| `ui`         | `sidebar.addItem`, `router.add` | Añadir el ítem de menú y la página del informe          |

No solicita el permiso `portfolio` ni accede a valor de mercado / plusvalía
latente: solo trabaja con posiciones cerradas (ventas) y lotes abiertos a
coste.

### Instalación en Wealthfolio

1. Instalar dependencias y compilar:

   ```bash
   pnpm install
   pnpm build
   ```

   Esto genera `dist/addon.js`.

2. Empaquetar `manifest.json` + `dist/addon.js` en un zip:

   ```bash
   zip -r wealth-tax-addon.zip manifest.json dist/addon.js
   ```

3. En Wealthfolio: **Settings → Add-ons → Installed → Install from File**
   (icono `+`) y selecciona el zip.

El addon se activa automáticamente tras la instalación. Aparecerá
"WealthTax" en la barra lateral, en la ruta `/addons/wealth-tax`.

Para actualizar tras un cambio de código, repite los pasos 1-3 (la
reinstalación con el mismo `id` sobrescribe la versión anterior).

> Si `pnpm` no está disponible en el PATH, usa `npx pnpm@9 <comando>`.

### Desarrollo

```bash
pnpm install        # instalar dependencias
pnpm dev            # build en modo watch
pnpm dev:server     # servidor de desarrollo de addons (wealthfolio dev)
pnpm build          # build de producción → dist/addon.js
pnpm type-check     # comprobación de tipos (tsc --noEmit)
pnpm bundle         # clean + build + package → dist/*.zip
```

### Estructura del proyecto

```
manifest.json                  # metadatos y permisos del addon
src/
├── index.ts                   # enable(): registra sidebar, ruta y limpieza
├── components/
│   ├── TaxesPage.tsx           # página principal (filtros, resumen, tablas)
│   └── TaxTable.tsx             # tablas de posiciones cerradas / abiertas
├── hooks/
│   └── use-tax-data.ts          # carga de datos, filtros y agregados
└── utils/
    └── fifo-engine.ts            # motor FIFO (splits, scrip dividends, lotes)
```

### Origen

La lógica de cálculo FIFO (`src/utils/fifo-engine.ts`) es un puerto del
módulo `src/lib/fifo.ts` del proyecto `wealthfolio-taxes`, adaptado a los
tipos de `@wealthfolio/addon-sdk` y generalizado para cualquier divisa base
(los campos `*EUR` del original pasan a llamarse `*Base`).

### Licencia

MIT
