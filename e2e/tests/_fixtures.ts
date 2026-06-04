import { test as base, type Page } from "@playwright/test";

// Each test runs against its own bypass-auth user so the shared DynamoDB table
// can host parallel workers without cross-test data collisions. The frontend
// reads window.__STEMMA_E2E_USER__ when E2E_AUTO_LOGIN=1 (see App.svelte /
// V2App.svelte) and sends it as the bearer token; the backend's
// AllowAnyTokenVerifier treats anything containing '@' as the email itself.
export const test = base.extend<{ page: Page }>({
  page: async ({ page }, use, testInfo) => {
    const token = `e2e-${testInfo.testId}@stemma.local`;
    await page.addInitScript((t) => {
      (window as unknown as { __STEMMA_E2E_USER__: string }).__STEMMA_E2E_USER__ = t;
    }, token);
    await use(page);
  },
});

export { expect } from "@playwright/test";
