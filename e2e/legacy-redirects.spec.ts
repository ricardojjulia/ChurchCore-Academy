import { expect, test } from "@playwright/test";
import { storageStateFor } from "./helpers";

// #176: legacy detail URLs used to drop the id and land on the list page.
test.use({ storageState: storageStateFor("registrar") });

test("/programs/[id] keeps the program id", async ({ page }) => {
  await page.goto("/programs/prog-biblical-studies");
  await expect(page).toHaveURL(/\/admin\/programs\/prog-biblical-studies$/);
});

test("/students/[id] keeps the student id", async ({ page }) => {
  await page.goto("/students/student-profile-lena");
  await expect(page).toHaveURL(/\/admin\/students\/student-profile-lena$/);
});
