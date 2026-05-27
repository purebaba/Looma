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
    await page.getByLabel("Success title").fill("Thanks from QA");
    await page
      .getByLabel("Success message")
      .fill("We saved your customer intake response.");

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
    await expect(
      page.getByRole("heading", { name: "Customer intake QA" })
    ).toBeVisible();
    await expect(page.getByText("Version 1", { exact: true })).toBeVisible();
    await expect(page.getByText("Entity: Customer intake QA")).toBeVisible();
    await expect(page.getByText("Version history")).toBeVisible();
    await expect(page.getByText("Version 1: Customer intake QA")).toBeVisible();
    await expect(page.getByRole("link", { name: "Builder" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Public form" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Responses" }).first()).toBeVisible();
    await expect(page.getByRole("link", { name: "Records" }).first()).toBeVisible();
    await expect(page.getByRole("link", { name: "Settings" }).first()).toBeVisible();

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
    await expect(page.getByText("Thanks from QA")).toBeVisible();
    await expect(
      page.getByText("We saved your customer intake response.")
    ).toBeVisible();

    await page.goto(`/forms/${formId}`);
    await page.getByLabel("Full name").fill("Bob Stone");
    await page.getByLabel("Email address").fill("bob@example.com");
    await page.getByLabel("Lead source").selectOption("website");
    await page.getByRole("button", { name: "Submit response" }).click();
    await expect(page.getByText("Thanks from QA")).toBeVisible();

    const submissions = await page.request.get(`/api/forms/${formId}/submissions`);
    expect(submissions.ok()).toBeTruthy();
    const body = await submissions.json();
    expect(body.submissions).toHaveLength(2);
    const adaSubmission = body.submissions.find((submission: { data: Record<string, unknown> }) =>
      Object.values(submission.data).includes("Ada Lovelace")
    ) as { id: string; entityRecordId: string; data: Record<string, unknown> };
    expect(adaSubmission).toBeTruthy();
    expect(adaSubmission.entityRecordId).toBeTruthy();
    expect(Object.values(adaSubmission.data)).toEqual(
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
    expect(recordsBody.records).toHaveLength(2);
    const adaRecord = recordsBody.records.find(
      (record: { id: string }) => record.id === adaSubmission.entityRecordId
    );
    expect(adaRecord).toBeTruthy();
    expect(Object.values(adaRecord.data)).toEqual(
      expect.arrayContaining(["Ada Lovelace", "ada@example.com", "referral"])
    );

    await page.goto(`/studio/interfaces/forms/${formId}/submissions`);
    await expect(
      page.getByRole("heading", { name: "Customer intake QA responses" })
    ).toBeVisible();
    await expect(
      page.getByRole("cell", { name: "Ada Lovelace", exact: true })
    ).toBeVisible();
    await expect(
      page.getByRole("cell", { name: "ada@example.com", exact: true })
    ).toBeVisible();
    await expect(
      page.getByRole("cell", { name: "referral", exact: true })
    ).toBeVisible();
    await expect(
      page.getByRole("cell", { name: "Bob Stone", exact: true })
    ).toBeVisible();
    await page.getByLabel("Search").fill("Ada");
    await page.getByRole("button", { name: "Apply" }).click();
    await expect(page).toHaveURL(/q=Ada/);
    await expect(page.getByText("Filtered from 2 total submissions.")).toBeVisible();
    await expect(
      page.getByRole("cell", { name: "Ada Lovelace", exact: true })
    ).toBeVisible();
    await expect(
      page.getByRole("cell", { name: "Bob Stone", exact: true })
    ).not.toBeVisible();
    await page.getByRole("link", { name: "Reset" }).click();
    await page.getByLabel("Field", { exact: true }).selectOption({
      label: "Lead source",
    });
    await page.getByLabel("Field contains").fill("website");
    await page.getByLabel("Sort").selectOption("asc");
    await page.getByRole("button", { name: "Apply" }).click();
    await expect(page).toHaveURL(/fieldValue=website/);
    await expect(
      page.getByRole("cell", { name: "Bob Stone", exact: true })
    ).toBeVisible();
    await expect(
      page.getByRole("cell", { name: "Ada Lovelace", exact: true })
    ).not.toBeVisible();
    await page.getByRole("link", { name: "Reset" }).click();
    await expect(page.getByRole("link", { name: "Export CSV" })).toBeVisible();
    await page
      .getByRole("row")
      .filter({ hasText: "Ada Lovelace" })
      .getByRole("link", { name: "View" })
      .click();
    await expect(page).toHaveURL(
      new RegExp(
        `/studio/interfaces/forms/${formId}/submissions/[0-9a-f-]+$`
      )
    );
    await expect(
      page.getByRole("heading", { name: "Customer intake QA response" })
    ).toBeVisible();
    await expect(page.getByText("Submitted values")).toBeVisible();
    await expect(page.getByText("Audit metadata")).toBeVisible();
    await expect(page.getByText("Ada Lovelace")).toBeVisible();
    await expect(page.getByText("ada@example.com")).toBeVisible();
    await expect(page.getByRole("link", { name: "Open record" })).toBeVisible();
    await page.getByRole("link", { name: "Responses" }).click();

    const exportResponse = await page.request.get(
      `/api/forms/${formId}/submissions/export?q=Ada`
    );
    expect(exportResponse.ok()).toBeTruthy();
    expect(exportResponse.headers()["content-type"]).toContain("text/csv");
    const csv = await exportResponse.text();
    expect(csv).toContain("Submission ID,Submitted At,Entity Record ID");
    expect(csv).toContain("Full name");
    expect(csv).toContain("Ada Lovelace");
    expect(csv).toContain("ada@example.com");
    expect(csv).not.toContain("Bob Stone");

    await page.goto(`/studio/data/entities/${createdForm.entityId}/records`);
    await expect(
      page.getByRole("heading", { name: "Customer intake QA records" })
    ).toBeVisible();
    await expect(page.getByText("Ada Lovelace")).toBeVisible();
  });

  test("blocks invalid public submissions with schema validation", async ({
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
            {
              id: "field_email",
              type: "email",
              label: "Work email",
              placeholder: "",
              validation: [],
              appearance: { width: 12, order: 1 },
            },
            {
              id: "field_plan",
              type: "select",
              label: "Plan",
              placeholder: "",
              options: [
                { label: "Free", value: "free" },
                { label: "Pro", value: "pro" },
              ],
              validation: [],
              appearance: { width: 12, order: 2 },
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

    const invalidTypeSubmission = await page.request.post(
      `/api/forms/${form.id}/submit`,
      {
        data: {
          data: {
            field_required_name: "Grace Hopper",
            field_email: "not-an-email",
            field_plan: "enterprise",
          },
        },
      }
    );
    expect(invalidTypeSubmission.status()).toBe(400);
    const invalidTypeBody = await invalidTypeSubmission.json();
    expect(invalidTypeBody.errors.field_email).toBe("Work email is invalid");
    expect(invalidTypeBody.errors.field_plan).toBe("Plan is invalid");
  });

  test("guards public submissions against honeypot spam and burst traffic", async ({
    page,
    request,
  }) => {
    const user = await registerUser(request);
    await login(page, user);

    const createResponse = await page.request.post("/api/forms", {
      data: {
        name: "Submission guard QA",
        description: "Public submission protection",
        schema: {
          fields: [
            {
              id: "field_guard_name",
              type: "text",
              label: "Guard name",
              placeholder: "",
              validation: [
                { type: "required", message: "Guard name is required" },
              ],
              appearance: { width: 12, order: 0 },
            },
          ],
        },
      },
    });
    expect(createResponse.ok()).toBeTruthy();
    const { form } = await createResponse.json();

    const publishResponse = await page.request.post(`/api/forms/${form.id}/publish`);
    expect(publishResponse.ok()).toBeTruthy();

    const honeypotSubmission = await page.request.post(`/api/forms/${form.id}/submit`, {
      data: {
        data: { field_guard_name: "Spam Bot" },
        _loomaWebsite: "https://spam.example",
      },
      headers: { "x-forwarded-for": "203.0.113.10" },
    });
    expect(honeypotSubmission.status()).toBe(400);

    for (let index = 0; index < 10; index += 1) {
      const response = await page.request.post(`/api/forms/${form.id}/submit`, {
        data: { data: { field_guard_name: `Burst ${index}` } },
        headers: { "x-forwarded-for": "203.0.113.11" },
      });
      expect(response.status()).toBe(201);
    }

    const rateLimited = await page.request.post(`/api/forms/${form.id}/submit`, {
      data: { data: { field_guard_name: "Burst limited" } },
      headers: { "x-forwarded-for": "203.0.113.11" },
    });
    expect(rateLimited.status()).toBe(429);
    expect(rateLimited.headers()["retry-after"]).toBeTruthy();
  });

  test("redirects submitters after a configured public submission", async ({
    page,
    request,
  }) => {
    const user = await registerUser(request);
    await login(page, user);

    const createResponse = await page.request.post("/api/forms", {
      data: {
        name: "Redirect QA",
        description: "Redirect after submit",
        settings: {
          collectingEnabled: true,
          closedMessage: "This form is closed.",
          successTitle: "Saved",
          successMessage: "Saved successfully.",
          redirectUrl: "/",
        },
        schema: {
          fields: [
            {
              id: "field_redirect_name",
              type: "text",
              label: "Redirect name",
              placeholder: "",
              validation: [
                { type: "required", message: "Redirect name is required" },
              ],
              appearance: { width: 12, order: 0 },
            },
          ],
        },
      },
    });
    expect(createResponse.ok()).toBeTruthy();
    const { form } = await createResponse.json();
    const publishResponse = await page.request.post(`/api/forms/${form.id}/publish`);
    expect(publishResponse.ok()).toBeTruthy();

    await page.goto(`/forms/${form.id}`);
    await page.getByLabel("Redirect name").fill("Redirect Tester");
    await page.getByRole("button", { name: "Submit response" }).click();
    await expect(page).toHaveURL(/\/$/);
  });

  test("shows responses with the schema version used at submission time", async ({
    page,
    request,
  }) => {
    const user = await registerUser(request);
    await login(page, user);

    const createResponse = await page.request.post("/api/forms", {
      data: {
        name: "Versioned responses QA",
        description: "Response label history",
        schema: {
          fields: [
            {
              id: "field_versioned_name",
              type: "text",
              label: "Original label",
              placeholder: "",
              validation: [],
              appearance: { width: 12, order: 0 },
            },
          ],
        },
      },
    });
    expect(createResponse.ok()).toBeTruthy();
    const { form } = await createResponse.json();
    const publishV1 = await page.request.post(`/api/forms/${form.id}/publish`);
    expect(publishV1.ok()).toBeTruthy();

    await page.goto(`/forms/${form.id}`);
    await page.getByLabel("Original label").fill("Old value");
    await page.getByRole("button", { name: "Submit response" }).click();
    await expect(page.getByText("Submission received")).toBeVisible();

    const updateResponse = await page.request.put(`/api/forms/${form.id}`, {
      data: {
        appId: form.appId,
        entityId: form.entityId,
        name: "Versioned responses QA",
        description: "Response label history",
        schema: {
          fields: [
            {
              ...form.schema.fields[0],
              entityFieldId: undefined,
              dataKey: undefined,
              label: "Current label",
            },
          ],
        },
      },
    });
    expect(updateResponse.ok()).toBeTruthy();
    const publishV2 = await page.request.post(`/api/forms/${form.id}/publish`);
    expect(publishV2.ok()).toBeTruthy();

    await page.goto(`/forms/${form.id}`);
    await page.getByLabel("Current label").fill("New value");
    await page.getByRole("button", { name: "Submit response" }).click();
    await expect(page.getByText("Submission received")).toBeVisible();

    await page.goto(`/studio/interfaces/forms/${form.id}/submissions`);
    await expect(page.getByText("v1")).toBeVisible();
    await expect(page.getByText("Original label: Old value")).toBeVisible();
    await expect(page.getByText("v2")).toBeVisible();
    await expect(page.getByText("Current label: New value")).toBeVisible();

    await page
      .getByRole("row")
      .filter({ hasText: "Original label: Old value" })
      .getByRole("link", { name: "View" })
      .click();
    await expect(page.getByText("Form version")).toBeVisible();
    await expect(page.getByText("v1")).toBeVisible();
    await expect(page.getByText("Original label")).toBeVisible();
    await expect(page.getByText("Old value")).toBeVisible();

    const exportResponse = await page.request.get(
      `/api/forms/${form.id}/submissions/export?q=Original`
    );
    expect(exportResponse.ok()).toBeTruthy();
    const csv = await exportResponse.text();
    expect(csv).toContain("Form Version,Submitted Values");
    expect(csv).toContain("v1");
    expect(csv).toContain("Original label: Old value");
    expect(csv).not.toContain("New value");
  });

  test("manages form lifecycle from published to draft, archived, restored, and deleted", async ({
    page,
    request,
  }) => {
    const user = await registerUser(request);
    await login(page, user);

    const createResponse = await page.request.post("/api/forms", {
      data: {
        name: "Lifecycle QA",
        description: "Lifecycle coverage",
        settings: {
          collectingEnabled: false,
          closedMessage: "Lifecycle form is paused.",
          successTitle: "Done",
          successMessage: "Saved",
          redirectUrl: "",
        },
        schema: {
          fields: [
            {
              id: "field_lifecycle_name",
              type: "text",
              label: "Lifecycle name",
              placeholder: "",
              validation: [
                { type: "required", message: "Lifecycle name is required" },
              ],
              appearance: { width: 12, order: 0 },
            },
          ],
        },
      },
    });
    expect(createResponse.ok()).toBeTruthy();
    const created = await createResponse.json();

    const publishResponse = await page.request.post(
      `/api/forms/${created.form.id}/publish`
    );
    expect(publishResponse.ok()).toBeTruthy();
    const { form: publishedForm } = await publishResponse.json();
    expect(publishedForm.status).toBe("published");

    await page.goto(`/forms/${publishedForm.id}`);
    await expect(page.getByText("Form closed")).toBeVisible();
    await expect(page.getByText("Lifecycle form is paused.")).toBeVisible();
    const closedSubmission = await page.request.post(
      `/api/forms/${publishedForm.id}/submit`,
      { data: { data: { field_lifecycle_name: "Closed" } } }
    );
    expect(closedSubmission.status()).toBe(409);

    const editResponse = await page.request.put(`/api/forms/${publishedForm.id}`, {
      data: {
        appId: publishedForm.appId,
        entityId: publishedForm.entityId,
        name: "Lifecycle QA draft",
        description: "Lifecycle coverage after edit",
        settings: {
          collectingEnabled: true,
          closedMessage: "Lifecycle form is paused.",
          successTitle: "Lifecycle saved",
          successMessage: "The lifecycle response was saved.",
          redirectUrl: "",
        },
        schema: publishedForm.schema,
      },
    });
    expect(editResponse.ok()).toBeTruthy();
    const { form: draftForm } = await editResponse.json();
    expect(draftForm.status).toBe("draft");
    expect(draftForm.version).toBe((publishedForm.version || 1) + 1);

    await page.goto(`/forms/${publishedForm.id}`);
    await expect(page.getByText("Form closed")).toBeVisible();
    await expect(page.getByText("Lifecycle form is paused.")).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Lifecycle QA draft" })
    ).not.toBeVisible();

    const republishResponse = await page.request.post(
      `/api/forms/${publishedForm.id}/publish`
    );
    expect(republishResponse.ok()).toBeTruthy();
    const { form: republishedForm } = await republishResponse.json();
    expect(republishedForm.status).toBe("published");
    await page.goto(`/forms/${publishedForm.id}`);
    await expect(page.getByRole("heading", { name: "Lifecycle QA draft" })).toBeVisible();
    await page.goto(`/studio/interfaces/forms/${publishedForm.id}`);
    await expect(page.getByText("Version 2: Lifecycle QA draft")).toBeVisible();
    await expect(page.getByText("Version 1: Lifecycle QA")).toBeVisible();
    page.once("dialog", (dialog) => dialog.accept());
    await page.getByTestId("restore-version-1").click();
    await expect(page.getByRole("heading", { name: "Lifecycle QA" })).toBeVisible();
    await expect(page.getByText("Version 3")).toBeVisible();
    await page.goto(`/forms/${publishedForm.id}`);
    await expect(page.getByRole("heading", { name: "Lifecycle QA draft" })).toBeVisible();
    const publishRestoredResponse = await page.request.post(
      `/api/forms/${publishedForm.id}/publish`
    );
    expect(publishRestoredResponse.ok()).toBeTruthy();
    await page.goto(`/forms/${publishedForm.id}`);
    await expect(page.getByText("Form closed")).toBeVisible();
    await expect(page.getByText("Lifecycle form is paused.")).toBeVisible();
    await page.goto(`/studio/interfaces/forms/${publishedForm.id}`);
    await expect(page.getByText("Version 3: Lifecycle QA")).toBeVisible();

    const archiveResponse = await page.request.patch(
      `/api/forms/${publishedForm.id}`,
      { data: { status: "archived" } }
    );
    expect(archiveResponse.ok()).toBeTruthy();
    const { form: archivedForm } = await archiveResponse.json();
    expect(archivedForm.status).toBe("archived");

    await page.goto("/studio/interfaces/forms");
    await expect(page.getByText("archived")).toBeVisible();
    await expect(page.getByRole("button", { name: "Restore" })).toBeVisible();

    await page.goto(`/forms/${publishedForm.id}`);
    await expect(page.getByText("Form unavailable")).toBeVisible();

    const restoreResponse = await page.request.patch(
      `/api/forms/${publishedForm.id}`,
      { data: { status: "draft" } }
    );
    expect(restoreResponse.ok()).toBeTruthy();
    const { form: restoredForm } = await restoreResponse.json();
    expect(restoredForm.status).toBe("draft");

    const deleteResponse = await page.request.delete(`/api/forms/${publishedForm.id}`);
    expect(deleteResponse.ok()).toBeTruthy();

    const getResponse = await page.request.get(`/api/forms/${publishedForm.id}`);
    expect(getResponse.status()).toBe(404);
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

  test("builds a form from an existing entity and stores submissions as records", async ({
    page,
    request,
  }) => {
    const user = await registerUser(request);
    await login(page, user);

    const appResponse = await page.request.post("/api/apps", {
      data: {
        name: "Support QA",
        description: "Support case intake models.",
      },
    });
    expect(appResponse.ok()).toBeTruthy();
    const { app } = await appResponse.json();

    const entityResponse = await page.request.post("/api/entities", {
      data: {
        appId: app.id,
        name: "Ticket QA",
        description: "Tickets submitted by customers.",
        fields: [
          {
            name: "Requester name",
            slug: "requester-name",
            type: "text",
            required: true,
          },
          {
            name: "Priority",
            slug: "priority",
            type: "select",
            config: {
              options: [
                { label: "Low", value: "low" },
                { label: "High", value: "high" },
              ],
            },
          },
        ],
      },
    });
    expect(entityResponse.ok()).toBeTruthy();
    const { entity } = await entityResponse.json();

    await page.goto("/studio/interfaces/forms/new");
    await page.getByLabel("App").selectOption({ label: "Support QA" });
    await page.getByLabel("Entity").selectOption({ label: "Ticket QA" });
    await expect(
      page.getByRole("button", { name: "Requester name" })
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Priority" })).toBeVisible();

    await page.locator('input[value="Untitled form"]').fill("Ticket intake QA");
    await page.getByRole("button", { name: "Import all entity fields" }).click();
    await expect(page.getByTestId("builder-field-text")).toContainText(
      "Requester name"
    );
    await expect(page.getByTestId("builder-field-select")).toContainText(
      "Priority"
    );

    await page.getByRole("button", { name: "Preview" }).click();
    await expect(page.getByLabel("Requester name")).toBeVisible();
    await expect(page.getByLabel("Priority")).toBeVisible();

    await page.getByTestId("publish-form").click();
    await expect(page).toHaveURL(/\/studio\/interfaces\/forms\/[0-9a-f-]+$/);
    const formId = page.url().split("/").pop();
    expect(formId).toBeTruthy();

    const formsResponse = await page.request.get("/api/forms");
    expect(formsResponse.ok()).toBeTruthy();
    const formsBody = await formsResponse.json();
    const createdForm = formsBody.forms.find(
      (item: { id: string }) => item.id === formId
    );
    expect(createdForm.appId).toBe(app.id);
    expect(createdForm.entityId).toBe(entity.id);
    expect(createdForm.entityName).toBe("Ticket QA");

    await page.goto(`/forms/${formId}`);
    await page.getByLabel("Requester name").fill("Grace Hopper");
    await page.getByLabel("Priority").selectOption("high");
    await page.getByRole("button", { name: "Submit response" }).click();
    await expect(page.getByText("Submission received")).toBeVisible();

    const submissions = await page.request.get(`/api/forms/${formId}/submissions`);
    expect(submissions.ok()).toBeTruthy();
    const submissionsBody = await submissions.json();
    expect(submissionsBody.submissions).toHaveLength(1);
    expect(submissionsBody.submissions[0].entityRecordId).toBeTruthy();

    const records = await page.request.get(`/api/entities/${entity.id}/records`);
    expect(records.ok()).toBeTruthy();
    const recordsBody = await records.json();
    expect(recordsBody.records).toHaveLength(1);
    expect(recordsBody.records[0].id).toBe(
      submissionsBody.submissions[0].entityRecordId
    );
    expect(recordsBody.records[0].data).toMatchObject({
      "requester-name": "Grace Hopper",
      priority: "high",
    });
  });

  test("lets business users work with records in the app runtime", async ({
    page,
    request,
  }) => {
    const user = await registerUser(request);
    await login(page, user);

    const appResponse = await page.request.post("/api/apps", {
      data: {
        name: "Runtime QA",
        description: "Runtime app for business users.",
      },
    });
    expect(appResponse.ok()).toBeTruthy();
    const { app } = await appResponse.json();

    const entityResponse = await page.request.post("/api/entities", {
      data: {
        appId: app.id,
        name: "Case QA",
        description: "Cases handled in the app runtime.",
        fields: [
          {
            name: "Case title",
            slug: "case-title",
            type: "text",
            required: true,
          },
          {
            name: "Case value",
            slug: "case-value",
            type: "number",
          },
        ],
      },
    });
    expect(entityResponse.ok()).toBeTruthy();
    const { entity } = await entityResponse.json();

    await page.goto(`/studio/data/entities/${entity.id}/views/table`);
    await page.locator("#view-name").fill("Case queue");
    const saveViewResponse = page.waitForResponse(
      `/api/entities/${entity.id}/views/table`
    );
    await page.getByRole("button", { name: "Save table view" }).click();
    expect((await saveViewResponse).ok()).toBeTruthy();

    await page.goto(`/studio/data/entities/${entity.id}/views/table?viewId=new`);
    await page.locator("#view-name").fill("Financial queue");
    const createViewResponse = page.waitForResponse(
      `/api/entities/${entity.id}/views/table`
    );
    await page.getByRole("button", { name: "Save table view" }).click();
    expect((await createViewResponse).ok()).toBeTruthy();

    const entitiesResponse = await page.request.get("/api/entities");
    expect(entitiesResponse.ok()).toBeTruthy();
    const entitiesBody = await entitiesResponse.json();
    const createdEntity = entitiesBody.entities.find(
      (item: { id: string }) => item.id === entity.id
    );
    const titleField = createdEntity.fields.find(
      (field: { slug: string }) => field.slug === "case-title"
    );
    const valueField = createdEntity.fields.find(
      (field: { slug: string }) => field.slug === "case-value"
    );
    expect(titleField).toBeTruthy();
    expect(valueField).toBeTruthy();

    await page.goto(`/studio/data/entities/${entity.id}/views/detail`);
    await page.locator("#detail-view-name").fill("Case detail");
    await page.locator(`#detail-label-${titleField.id}`).fill("Summary");
    await page.locator(`#detail-section-${titleField.id}`).fill("Overview");
    await page.locator(`#detail-label-${valueField.id}`).fill("Amount");
    await page.locator(`#detail-section-${valueField.id}`).fill("Financials");
    await page
      .locator(`#detail-label-${valueField.id}`)
      .locator("xpath=ancestor::div[contains(@class, 'rounded-md')][1]")
      .getByLabel("Editable")
      .uncheck();
    const saveDetailResponse = page.waitForResponse(
      `/api/entities/${entity.id}/views/detail`
    );
    await page.getByRole("button", { name: "Save detail view" }).click();
    expect((await saveDetailResponse).ok()).toBeTruthy();

    await page.goto("/app");
    await expect(page.getByRole("heading", { name: "Apps" })).toBeVisible();
    await expect(page.getByText("Runtime QA")).toBeVisible();

    await page.goto(`/app/apps/${app.id}`);
    await expect(page.getByRole("heading", { name: "Runtime QA" })).toBeVisible();
    await expect(page.getByText("Case QA")).toBeVisible();

    await page.goto(`/app/apps/${app.id}/entities/${entity.id}/records/new`);
    await page.getByRole("textbox", { name: /Case title/ }).fill("Escalation A");
    await page.getByRole("spinbutton", { name: "Case value" }).fill("17");
    await page.getByRole("button", { name: "Save record" }).click();
    await expect(page).toHaveURL(
      /\/app\/apps\/[0-9a-f-]+\/entities\/[0-9a-f-]+\/records\/[0-9a-f-]+$/
    );
    await expect(page.getByRole("heading", { name: "Case QA record" })).toBeVisible();
    await expect(page.getByText("Overview")).toBeVisible();
    await expect(page.getByText("Summary")).toBeVisible();
    await expect(page.getByText("Financials")).toBeVisible();
    await expect(page.getByText("Amount")).toBeVisible();
    await expect(page.getByText("Escalation A")).toBeVisible();
    await expect(page.getByRole("cell", { name: "17" })).toBeVisible();
    await expect(page.getByRole("spinbutton", { name: "Case value" })).toHaveCount(0);

    await page.getByRole("textbox", { name: /Case title/ }).fill("Escalation B");
    await page.getByRole("button", { name: "Save record" }).click();
    await expect(page.getByText("Escalation B")).toBeVisible();

    const secondRecordResponse = await page.request.post(
      `/api/entities/${entity.id}/records`,
      {
        data: {
          data: {
            "case-title": "Billing C",
            "case-value": 42,
          },
        },
      }
    );
    expect(secondRecordResponse.ok()).toBeTruthy();

    await page.goto(`/app/apps/${app.id}/entities/${entity.id}`);
    await expect(page.getByRole("heading", { name: "Case QA" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Case queue" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Financial queue" })).toBeVisible();
    await expect(page.getByText("Escalation B")).toBeVisible();
    await expect(page.getByText("Billing C")).toBeVisible();

    await page.getByRole("link", { name: "Financial queue" }).click();
    await expect(page).toHaveURL(/view=/);

    await page.getByPlaceholder("Search records").fill("Escalation");
    await page.getByRole("button", { name: "Search" }).click();
    await expect(page.getByText("Escalation B")).toBeVisible();
    await expect(page.getByText("Billing C")).toHaveCount(0);

    await page.goto(`/app/apps/${app.id}/entities/${entity.id}`);
    await page.getByPlaceholder("Filter Case value").fill("42");
    await page.getByRole("button", { name: "Search" }).click();
    await expect(page.getByText("Billing C")).toBeVisible();
    await expect(page.getByText("Escalation B")).toHaveCount(0);
  });
});
