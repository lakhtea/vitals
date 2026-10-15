// Keyboard-only navigation helpers shared by the e2e specs: press Tab until a
// control has focus, failing loudly when the path is longer than expected.
import { type Locator, type Page } from "@playwright/test";

const isFocused = (locator: Locator): Promise<boolean> =>
  locator.evaluate((element) => element === document.activeElement);

export const tabUntilFocused = async ({
  page,
  target,
  maxTabs,
}: {
  page: Page;
  target: Locator;
  /** An upper bound on the hop, so a broken tab order fails fast instead of looping. */
  maxTabs: number;
}): Promise<void> => {
  for (let pressed = 0; pressed < maxTabs; pressed += 1) {
    await page.keyboard.press("Tab");
    if (await isFocused(target)) {
      return;
    }
  }
  throw new Error(`Pressed Tab ${maxTabs} times without reaching the target control`);
};
