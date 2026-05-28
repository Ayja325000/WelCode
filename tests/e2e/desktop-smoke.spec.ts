import { test, expect, _electron as electron } from "@playwright/test";
import { existsSync } from "node:fs";

test("desktop app opens and renders core layout", async () => {
  let electronPath: string | null = null;
  try {
    const electronModule = (await import("electron")) as unknown as { default: string };
    electronPath = electronModule.default;
  } catch {
    test.skip(true, "Local Electron binary is unavailable in this environment.");
    return;
  }

  test.skip(!electronPath || !existsSync(electronPath), "Local Electron binary is unavailable in this environment.");

  const app = await electron.launch({
    executablePath: electronPath ?? undefined,
    args: ["dist/main/main.js"]
  });

  const window = await app.firstWindow();
  await expect(window).toHaveTitle(/WelCode Agent/i);
  await expect(window.locator("h1")).toHaveText(/WelCode Agent/i);
  await expect(window.locator("textarea")).toBeVisible();

  await app.close();
});
