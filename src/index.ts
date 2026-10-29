import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { registerTranslations, type AddonContext } from "@wealthfolio/addon-sdk";
import React from "react";
import { TaxesPage } from "./components/TaxesPage";
import { translations } from "./i18n";

export default function enable(ctx: AddonContext) {
  ctx.api.logger.info("WealthTax addon is being enabled");

  // Antes del primer render, para no mostrar claves sin traducir.
  registerTranslations(translations);

  try {
    const sidebarItem = ctx.sidebar.addItem({
      id: "wealth-tax",
      label: "WealthTax",
      icon: "receipt",
      route: "/addons/wealth-tax",
      order: 100,
    });

    // Use an isolated QueryClient instead of ctx.api.query.getClient(): the
    // addon bundles its own @tanstack/react-query, and operating on Query
    // instances created by a different host-bundled version can throw
    // (e.g. "query.isFetched is not a function") when internals diverge.
    const queryClient = new QueryClient();

    const TaxesPageWrapper = () => {
      return React.createElement(
        QueryClientProvider,
        { client: queryClient },
        React.createElement(TaxesPage, { ctx }),
      );
    };

    ctx.router.add({
      path: "/addons/wealth-tax",
      component: React.lazy(() =>
        Promise.resolve({ default: TaxesPageWrapper }),
      ),
    });

    ctx.onDisable(() => {
      ctx.api.logger.info("WealthTax addon is being disabled");
      try {
        sidebarItem.remove();
      } catch (error) {
        ctx.api.logger.error(
          "Error removing sidebar item: " + (error as Error).message,
        );
      }
    });

    ctx.api.logger.info("WealthTax addon enabled successfully");
  } catch (error) {
    ctx.api.logger.error(
      "Failed to initialize WealthTax addon: " + (error as Error).message,
    );
    throw error;
  }
}
