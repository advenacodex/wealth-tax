# Registro de cambios

Todos los cambios relevantes de este proyecto se documentan en este archivo.

El formato se basa en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/)
y el proyecto sigue el [Versionado Semántico](https://semver.org/lang/es/).

Versión en inglés (canónica): [CHANGELOG.md](CHANGELOG.md).

## [Sin publicar]

## [1.1.0] - 2026-10-29

### Añadido

- Interfaz bilingüe: español cuando Wealthfolio está en español, inglés para
  cualquier otro idioma, siguiendo en directo el ajuste de idioma de la app.
- Vista Totalizado para posiciones cerradas: una fila por activo y grupo de
  cuentas, con la fecha de la última venta, importes sumados y precio y tipo de
  cambio medios ponderados.
- Selector «Por fechas / Totalizado» junto a los botones de posiciones cerradas
  y abiertas.
- Diseño fijo: cabecera, filtros, tarjetas de resumen y cabecera de la tabla
  permanecen fijos mientras solo se desplazan las filas.
- `.github/FUNDING.yml` para el botón Sponsor de GitHub.

### Cambiado

- Migrado al SDK 3.11.0 de Wealthfolio (antes 3.0.0), el runtime con sandbox que
  exige el directorio de addons de la comunidad. Dependencias y `sdkVersion` del
  manifest actualizados.
- La versión mínima de Wealthfolio pasa a ser la 3.8.0 (`minWealthfolioVersion`),
  que exige el runtime de localización de addons.
- La entrada de la barra lateral usa un icono del host por nombre (`receipt`) en
  vez de un elemento React.
- Tarjetas de resumen rediseñadas en formato compacto de una sola línea.
- Los importes llevan la divisa a la derecha, separada por un espacio
  (`1.234,50 €`), con separador de miles desde cuatro cifras. Los separadores
  siguen el idioma de la interfaz (`1,234.50 €` en inglés).
- La nota «calculado mediante FIFO» pasa de la barra de filtros al subtítulo de
  la página.
- README reescrito en inglés y español; la instalación usa ahora el zip de la
  release con **Install from File**.

### Corregido

- Los valores en euros, las cantidades y los tipos de cambio no quedaban
  alineados a la derecha en las tablas; ahora la alineación se aplica en línea.
- Errores de tipos en los selectores de filtro, que ahora pueden devolver
  `null`.

## [1.0.0] - 2026-06-10

### Añadido

- Versión inicial: informes de posiciones cerradas y abiertas calculados con
  FIFO.
- Ajuste de splits y contrasplits; tratamiento de scrip dividends.
- Importes multidivisa con equivalentes en divisa base.
- Filtros por año, grupo de cuentas, cuenta y activo; pooling FIFO por grupo.
- Columnas ordenables y lotes de compra desplegables.

[Sin publicar]: https://github.com/advenacodex/wealth-tax/compare/v1.1.0...HEAD
[1.1.0]: https://github.com/advenacodex/wealth-tax/compare/64d6afe...v1.1.0
[1.0.0]: https://github.com/advenacodex/wealth-tax/commit/64d6afe
