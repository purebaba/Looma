import { expect, test, type Page, type APIRequestContext } from "@playwright/test";

type TestUser = {
  name: string;
  email: string;
  password: string;
};

function uniqueEmail(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;
}

async function registerUser(request: APIRequestContext): Promise<TestUser> {
  const user = {
    name: "Forms QA",
    email: uniqueEmail("forms-qa"),
    password: "password123",
  };

  const response = await request.post("/api/auth/register", {
    data: user,
  });

  expect(response.ok()).toBeTruthy();
  return user;
}

async function login(page: Page, user: TestUser) {
  await page.goto("/login");
  await page.getByRole("textbox", { name: "邮箱地址" }).fill(user.email);
  await page.getByRole("textbox", { name: "密码" }).fill(user.password);
  await page.getByRole("button", { name: "登录", exact: true }).click();
  await expect(page).toHaveURL(/\/studio$/);
}

test.describe("Forms module", () => {
  test("redirects unauthenticated users away from the forms studio", async ({
    page,
  }) => {
    await page.goto("/studio/interfaces/forms");
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByText("欢迎回来")).toBeVisible();
  });

  test("creates a form, configures fields, publishes it, and accepts a public submission", async ({
    page,
    request,
  }) => {
    const user = await registerUser(request);
    await login(page, user);

    await page.goto("/studio/interfaces/forms");
    await expect(page.getByRole("heading", { name: "Forms" }).first()).toBeVisible();
    await expect(page.getByRole("link", { name: "Forms" })).toHaveClass(/bg-primary/);
    await expect(page.getByRole("link", { name: "Studio" })).not.toHaveClass(
      /bg-primary/
    );

    await page.getByRole("link", { name: "New form" }).click();
    await expect(page).toHaveURL(/\/studio\/interfaces\/forms\/new$/);
    await page.locator('input[value="Untitled form"]').fill("Customer intake QA");
    await page
      .getByPlaceholder("Describe what this form collects.")
      .fill("Captures a customer's contact details and source.");

    await page.getByTestId("add-field-text").click();
    await page.getByLabel("Label").fill("Full name");
    await page.getByLabel("Placeholder").fill("Ada Lovelace");
    await page.getByLabel("Help text").fill("Use the customer's legal name.");
    await page.getByLabel("Required").check();

    await page.getByTestId("add-field-email").click();
    await page.getByLabel("Label").fill("Email address");
    await page.getByLabel("Placeholder").fill("ada@example.com");
    await page.getByLabel("Required").check();

    await page.getByTestId("add-field-select").click();
    await page.getByLabel("Label").fill("Lead source");
    await page.getByLabel("Options").fill("Website:website\nReferral:referral");

    await page.getByRole("button", { name: "Preview" }).click();
    await expect(page.getByLabel("Full name")).toBeVisible();
    await expect(page.getByLabel("Email address")).toBeVisible();
    await expect(page.getByLabel("Lead source")).toBeVisible();

    await page.getByTestId("publish-form").click();
    await expect(page).toHaveURL(/\/studio\/interfaces\/forms\/[0-9a-f-]+$/);
    const formId = page.url().split("/").pop();
    expect(formId).toBeTruthy();

    await page.goto("/studio/interfaces/forms");
    await expect(
      page.getByRole("link", { name: "Customer intake QA" }).first()
    ).toBeVisible();
    await expect(page.getByText("published")).toBeVisible();
    await expect(page.getByRole("link", { name: "Fill form" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Responses" })).toBeVisible();

    await page.goto(`/forms/${formId}`);
    await expect(page.getByRole("heading", { name: "Customer intake QA" })).toBeVisible();
    await page.getByLabel("Full name").fill("Ada Lovelace");
    await page.getByLabel("Email address").fill("ada@example.com");
    await page.getByLabel("Lead source").selectOption("referral");
    await page.getByRole("button", { name: "Submit response" }).click();
    await expect(page.getByText("Submission received")).toBeVisible();

    const submissions = await page.request.get(`/api/forms/${formId}/submissions`);
    expect(submissions.ok()).toBeTruthy();
    const body = await submissions.json();
    expect(body.submissions).toHaveLength(1);
    expect(body.submissions[0].entityRecordId).toBeTruthy();
    expect(Object.values(body.submissions[0].data)).toEqual(
      expect.arrayContaining(["Ada Lovelace", "ada@example.com", "referral"])
    );

    const formsResponse = await page.request.get("/api/forms");
    expect(formsResponse.ok()).toBeTruthy();
    const formsBody = await formsResponse.json();
    const createdForm = formsBody.forms.find(
      (item: { id: string }) => item.id === formId
    );
    expect(createdForm.appId).toBeTruthy();
    expect(createdForm.entityId).toBeTruthy();
    expect(createdForm.entityName).toBe("Customer intake QA");

    const records = await page.request.get(
      `/api/entities/${createdForm.entityId}/records`
    );
    expect(records.ok()).toBeTruthy();
    const recordsBody = await records.json();
    expect(recordsBody.records).toHaveLength(1);
    expect(recordsBody.records[0].id).toBe(body.submissions[0].entityRecordId);
    expect(Object.values(recordsBody.records[0].data)).toEqual(
      expect.arrayContaining(["Ada Lovelace", "ada@example.com", "referral"])
    );

    await page.goto(`/studio/interfaces/forms/${formId}/submissions`);
    await expect(
      page.getByRole("heading", { name: "Customer intake QA responses" })
    ).toBeVisible();
    await expect(page.getByText("Ada Lovelace")).toBeVisible();
    await expect(page.getByText("ada@example.com")).toBeVisible();
    await expect(page.getByText("referral")).toBeVisible();

    await page.goto(`/studio/data/entities/${createdForm.entityId}/records`);
    await expect(
      page.getByRole("heading", { name: "Customer intake QA records" })
    ).toBeVisible();
    await expect(page.getByText("Ada Lovelace")).toBeVisible();
  });

  test("blocks invalid public submissions with required-field validation", async ({
    page,
    request,
  }) => {
    const user = await registerUser(request);
    await login(page, user);

    const createResponse = await page.request.post("/api/forms", {
      data: {
        name: "Required validation QA",
        description: "Required field test",
        schema: {
          fields: [
            {
              id: "field_required_name",
              type: "text",
              label: "Required name",
              placeholder: "",
              validation: [
                { type: "required", message: "Required name is required" },
              ],
              appearance: { width: 12, order: 0 },
            },
          ],
        },
      },
    });
    expect(createResponse.ok()).toBeTruthy();
    const { form } = await createResponse.json();
    expect(form.appId).toBeTruthy();
    expect(form.entityId).toBeTruthy();
    const publishResponse = await page.request.post(`/api/forms/${form.id}/publish`);
    expect(publishResponse.ok()).toBeTruthy();

    await page.goto(`/forms/${form.id}`);
    await page.getByRole("button", { name: "Submit response" }).click();
    await expect(page.getByText("Required name is required")).toBeVisible();

    const invalidApiSubmission = await page.request.post(`/api/forms/${form.id}/submit`, {
      data: { data: { field_required_name: "" } },
    });
    expect(invalidApiSubmission.status()).toBe(400);
  });

  test("creates an app, models an entity, and creates a record manually", async ({
    page,
    request,
  }) => {
    const user = await registerUser(request);
    await login(page, user);

    await page.goto("/studio/apps/new");
    await page.getByLabel("Name").fill("Operations QA");
    await page.getByLabel("Slug").fill("operations-qa");
    await page
      .getByLabel("Description")
      .fill("Operational data models for QA.");
    await page.getByRole("button", { name: "Save app" }).click();
    await expect(page).toHaveURL(/\/studio\/apps\/[0-9a-f-]+$/);

    await page.goto("/studio/data/entities/new");
    await page.getByLabel("App").selectOption({ label: "Operations QA" });
    await page.locator("#entity-name").fill("Asset QA");
    await page
      .locator("#entity-description")
      .fill("Tracks assets created through the Data Studio modeler.");
    await page.locator("#field-name-0").fill("Asset name");
    await page.locator("#field-slug-0").fill("asset-name");
    await page.locator("#field-type-0").selectOption("text");
    await page.getByLabel("Required").check();
    await page.getByRole("button", { name: "Add field" }).click();
    await page.locator("#field-name-1").fill("Asset value");
    await page.locator("#field-slug-1").fill("asset-value");
    await page.locator("#field-type-1").selectOption("number");
    await page.getByRole("button", { name: "Save entity" }).click();
    await expect(page).toHaveURL(/\/studio\/data\/entities\/[0-9a-f-]+$/);
    const entityId = page.url().split("/").pop();
    expect(entityId).toBeTruthy();
    await expect(page.getByText("Asset name")).toBeVisible();
    await expect(page.getByText("Asset value")).toBeVisible();

    await page.goto(`/studio/data/entities/${entityId}/records/new`);
    await page.getByRole("textbox", { name: /Asset name/ }).fill("Laptop A");
    await page.getByRole("spinbutton", { name: "Asset value" }).fill("2400");
    await page.getByRole("button", { name: "Save record" }).click();
    await expect(page).toHaveURL(
      /\/studio\/data\/entities\/[0-9a-f-]+\/records\/[0-9a-f-]+$/
    );
    await expect(page.getByRole("heading", { name: "Asset QA record" })).toBeVisible();
    await expect(page.getByText("Laptop A")).toBeVisible();
    await expect(page.getByText("2400")).toBeVisible();

    const records = await page.request.get(`/api/entities/${entityId}/records`);
    expect(records.ok()).toBeTruthy();
    const recordsBody = await records.json();
    expect(recordsBody.records).toHaveLength(1);
    expect(recordsBody.records[0].data).toMatchObject({
      "asset-name": "Laptop A",
      "asset-value": 2400,
    });

    await page.goto("/dashboard/forms");
    await expect(page).toHaveURL(/\/studio\/interfaces\/forms$/);
  });
});
