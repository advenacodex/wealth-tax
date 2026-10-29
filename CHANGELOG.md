# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Spanish version: [CHANGELOG.es.md](CHANGELOG.es.md).

## [Unreleased]

## [1.1.0] - 2026-10-29

### Added

- Bilingual interface: Spanish when Wealthfolio's language is Spanish, English
  for any other language, following the app's language setting live.
- Totalized view for closed positions: one row per asset and account group,
  with the date of the last sale, summed amounts, and weighted average price
  and FX rate.
- "Por fechas / Totalizado" switch next to the closed/open positions buttons.
- Pinned layout: header, filters, summary cards, and table column header stay
  fixed while only the rows scroll.
- `.github/FUNDING.yml` for the GitHub Sponsor button.

### Changed

- Migrated to Wealthfolio SDK 3.11.0 (was 3.0.0), the sandbox-era runtime
  required by the community addon directory. Dependencies and the manifest
  `sdkVersion` are updated.
- Minimum supported Wealthfolio version is now 3.8.0 (`minWealthfolioVersion`),
  required by the addon localization runtime.
- The sidebar entry uses a named host icon (`receipt`) instead of a React
  element.
- Summary cards redesigned as compact single-line cards.
- Amounts show the currency on the right, separated by a space (`1.234,50 €`),
  with a thousands separator from four digits. Separators follow the interface
  language (`1,234.50 €` in English).
- The "calculated using FIFO" note moved from the filter bar to the page
  subtitle.
- README rewritten in English and Spanish; installation now uses the release
  zip with **Install from File**.

### Fixed

- Values in euros, quantities, and FX rates were not right-aligned in the
  tables; alignment is now applied inline.
- Type errors in the filter selects, which can now emit `null`.

## [1.0.0] - 2026-06-10

### Added

- Initial release: closed and open positions reports computed with FIFO.
- Stock split and reverse split adjustment; scrip dividend handling.
- Multi-currency amounts with base-currency equivalents.
- Filters by year, account group, account, and asset; group-level FIFO pooling.
- Sortable columns and expandable buy lots.

[Unreleased]: https://github.com/advenacodex/wealth-tax/compare/v1.1.0...HEAD
[1.1.0]: https://github.com/advenacodex/wealth-tax/compare/64d6afe...v1.1.0
[1.0.0]: https://github.com/advenacodex/wealth-tax/commit/64d6afe
