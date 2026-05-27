import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  boolean,
  integer,
  jsonb,
  pgEnum,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

export const plansEnum = pgEnum("plans", ["free", "pro", "enterprise"]);
export const memberRolesEnum = pgEnum("member_roles", [
  "owner",
  "admin",
  "manager",
  "member",
  "guest",
]);
export const formStatusEnum = pgEnum("form_status", [
  "draft",
  "published",
  "archived",
]);
export const workflowStatusEnum = pgEnum("workflow_status", [
  "draft",
  "enabled",
  "disabled",
]);
export const agentStatusEnum = pgEnum("agent_status", [
  "draft",
  "published",
  "archived",
]);
export const appStatusEnum = pgEnum("app_status", ["draft", "active", "archived"]);
export const entityStorageModeEnum = pgEnum("entity_storage_mode", [
  "json",
  "physical_table",
  "external",
]);

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  emailVerified: boolean("email_verified").default(false),
  name: varchar("name", { length: 255 }),
  avatar: text("avatar"),
  passwordHash: text("password_hash"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const sessions = pgTable("sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  token: text("token").notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const accounts = pgTable("accounts", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  provider: varchar("provider", { length: 50 }).notNull(),
  providerAccountId: text("provider_account_id").notNull(),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  expiresAt: timestamp("expires_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const organizations = pgTable("organizations", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 255 }).notNull(),
  slug: varchar("slug", { length: 255 }).notNull().unique(),
  plan: plansEnum("plan").default("free"),
  logo: text("logo"),
  settings: jsonb("settings").default({}),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const organizationMembers = pgTable("organization_members", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  role: memberRolesEnum("role").notNull().default("member"),
  joinedAt: timestamp("joined_at").defaultNow(),
});

export const departments = pgTable("departments", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  parentId: uuid("parent_id"),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const apps = pgTable("apps", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  createdBy: uuid("created_by").references(() => users.id),
  name: varchar("name", { length: 255 }).notNull(),
  slug: varchar("slug", { length: 255 }).notNull(),
  description: text("description"),
  status: appStatusEnum("status").default("active"),
  settings: jsonb("settings").default({}),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const entities = pgTable("entities", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  appId: uuid("app_id")
    .notNull()
    .references(() => apps.id, { onDelete: "cascade" }),
  createdBy: uuid("created_by").references(() => users.id),
  name: varchar("name", { length: 255 }).notNull(),
  slug: varchar("slug", { length: 255 }).notNull(),
  description: text("description"),
  storageMode: entityStorageModeEnum("storage_mode").default("json"),
  settings: jsonb("settings").default({}),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const entityFields = pgTable("entity_fields", {
  id: uuid("id").primaryKey().defaultRandom(),
  entityId: uuid("entity_id")
    .notNull()
    .references(() => entities.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 255 }).notNull(),
  slug: varchar("slug", { length: 255 }).notNull(),
  type: varchar("type", { length: 50 }).notNull(),
  required: boolean("required").default(false),
  unique: boolean("unique").default(false),
  defaultValue: jsonb("default_value"),
  config: jsonb("config").default({}),
  order: integer("order").default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const entityRelations = pgTable("entity_relations", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  sourceEntityId: uuid("source_entity_id")
    .notNull()
    .references(() => entities.id, { onDelete: "cascade" }),
  targetEntityId: uuid("target_entity_id")
    .notNull()
    .references(() => entities.id, { onDelete: "cascade" }),
  type: varchar("type", { length: 50 }).notNull(),
  sourceFieldId: uuid("source_field_id").references(() => entityFields.id),
  targetFieldId: uuid("target_field_id").references(() => entityFields.id),
  config: jsonb("config").default({}),
  createdAt: timestamp("created_at").defaultNow(),
});

export const entityRecords = pgTable("entity_records", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  appId: uuid("app_id")
    .notNull()
    .references(() => apps.id, { onDelete: "cascade" }),
  entityId: uuid("entity_id")
    .notNull()
    .references(() => entities.id, { onDelete: "cascade" }),
  data: jsonb("data").notNull().default({}),
  createdBy: uuid("created_by").references(() => users.id),
  updatedBy: uuid("updated_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const entityRecordVersions = pgTable("entity_record_versions", {
  id: uuid("id").primaryKey().defaultRandom(),
  recordId: uuid("record_id")
    .notNull()
    .references(() => entityRecords.id, { onDelete: "cascade" }),
  version: integer("version").notNull().default(1),
  data: jsonb("data").notNull().default({}),
  changedBy: uuid("changed_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
});

export const tableViews = pgTable("table_views", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  appId: uuid("app_id")
    .notNull()
    .references(() => apps.id, { onDelete: "cascade" }),
  entityId: uuid("entity_id")
    .notNull()
    .references(() => entities.id, { onDelete: "cascade" }),
  createdBy: uuid("created_by").references(() => users.id),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  config: jsonb("config").notNull().default({ columns: [] }),
  isDefault: boolean("is_default").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const detailViews = pgTable("detail_views", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  appId: uuid("app_id")
    .notNull()
    .references(() => apps.id, { onDelete: "cascade" }),
  entityId: uuid("entity_id")
    .notNull()
    .references(() => entities.id, { onDelete: "cascade" }),
  createdBy: uuid("created_by").references(() => users.id),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  config: jsonb("config").notNull().default({ fields: [] }),
  isDefault: boolean("is_default").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const forms = pgTable("forms", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  appId: uuid("app_id").references(() => apps.id, { onDelete: "set null" }),
  entityId: uuid("entity_id").references(() => entities.id, {
    onDelete: "set null",
  }),
  createdBy: uuid("created_by")
    .notNull()
    .references(() => users.id),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  schema: jsonb("schema").notNull().default({ fields: [] }),
  settings: jsonb("settings").default({}),
  status: formStatusEnum("status").default("draft"),
  version: integer("version").default(1),
  publishedAt: timestamp("published_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const formVersions = pgTable("form_versions", {
  id: uuid("id").primaryKey().defaultRandom(),
  formId: uuid("form_id")
    .notNull()
    .references(() => forms.id, { onDelete: "cascade" }),
  version: integer("version").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  schema: jsonb("schema").notNull().default({ fields: [] }),
  settings: jsonb("settings").default({}),
  publishedBy: uuid("published_by").references(() => users.id),
  publishedAt: timestamp("published_at").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const formSubmissions = pgTable("form_submissions", {
  id: uuid("id").primaryKey().defaultRandom(),
  formId: uuid("form_id")
    .notNull()
    .references(() => forms.id, { onDelete: "cascade" }),
  formVersionId: uuid("form_version_id").references(() => formVersions.id, {
    onDelete: "set null",
  }),
  entityRecordId: uuid("entity_record_id").references(() => entityRecords.id, {
    onDelete: "set null",
  }),
  data: jsonb("data").notNull(),
  submittedBy: uuid("submitted_by").references(() => users.id),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const workflows = pgTable("workflows", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  appId: uuid("app_id").references(() => apps.id, { onDelete: "set null" }),
  createdBy: uuid("created_by")
    .notNull()
    .references(() => users.id),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  definition: jsonb("definition").notNull().default({ nodes: [], edges: [] }),
  version: integer("version").default(1),
  status: workflowStatusEnum("status").default("draft"),
  triggerConfig: jsonb("trigger_config"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const workflowInstances = pgTable("workflow_instances", {
  id: uuid("id").primaryKey().defaultRandom(),
  workflowId: uuid("workflow_id")
    .notNull()
    .references(() => workflows.id, { onDelete: "cascade" }),
  triggeredBy: uuid("triggered_by").references(() => users.id),
  status: varchar("status", { length: 50 }).default("running"),
  input: jsonb("input"),
  output: jsonb("output"),
  error: text("error"),
  startedAt: timestamp("started_at").defaultNow(),
  completedAt: timestamp("completed_at"),
});

export const agents = pgTable("agents", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  appId: uuid("app_id").references(() => apps.id, { onDelete: "set null" }),
  createdBy: uuid("created_by")
    .notNull()
    .references(() => users.id),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  graphDefinition: jsonb("graph_definition").notNull(),
  tools: jsonb("tools").default([]),
  memoryConfig: jsonb("memory_config"),
  instructions: text("instructions"),
  status: agentStatusEnum("status").default("draft"),
  version: integer("version").default(1),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const agentExecutions = pgTable("agent_executions", {
  id: uuid("id").primaryKey().defaultRandom(),
  agentId: uuid("agent_id")
    .notNull()
    .references(() => agents.id, { onDelete: "cascade" }),
  userId: uuid("user_id").references(() => users.id),
  input: jsonb("input"),
  output: jsonb("output"),
  status: varchar("status", { length: 50 }).default("running"),
  error: text("error"),
  tokensUsed: integer("tokens_used").default(0),
  startedAt: timestamp("started_at").defaultNow(),
  completedAt: timestamp("completed_at"),
});

export const permissions = pgTable("permissions", {
  id: uuid("id").primaryKey().defaultRandom(),
  resource: varchar("resource", { length: 100 }).notNull(),
  action: varchar("action", { length: 50 }).notNull(),
  description: text("description"),
});

export const rolePermissions = pgTable("role_permissions", {
  id: uuid("id").primaryKey().defaultRandom(),
  role: memberRolesEnum("role").notNull(),
  permissionId: uuid("permission_id")
    .notNull()
    .references(() => permissions.id),
});

export const auditLogs = pgTable("audit_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id").references(() => organizations.id),
  userId: uuid("user_id").references(() => users.id),
  action: varchar("action", { length: 100 }).notNull(),
  resource: varchar("resource", { length: 100 }),
  resourceId: uuid("resource_id"),
  details: jsonb("details"),
  ipAddress: text("ip_address"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const usersRelations = relations(users, ({ many }) => ({
  sessions: many(sessions),
  accounts: many(accounts),
  memberships: many(organizationMembers),
  apps: many(apps),
  entities: many(entities),
  forms: many(forms),
  workflows: many(workflows),
  agents: many(agents),
}));

export const organizationsRelations = relations(
  organizations,
  ({ many }) => ({
    members: many(organizationMembers),
    departments: many(departments),
    apps: many(apps),
  entities: many(entities),
  entityRecords: many(entityRecords),
  tableViews: many(tableViews),
  detailViews: many(detailViews),
  forms: many(forms),
  workflows: many(workflows),
  agents: many(agents),
  })
);

export const organizationMembersRelations = relations(
  organizationMembers,
  ({ one }) => ({
    organization: one(organizations, {
      fields: [organizationMembers.orgId],
      references: [organizations.id],
    }),
    user: one(users, {
      fields: [organizationMembers.userId],
      references: [users.id],
    }),
  })
);

export const appsRelations = relations(apps, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [apps.orgId],
    references: [organizations.id],
  }),
  creator: one(users, {
    fields: [apps.createdBy],
    references: [users.id],
  }),
  entities: many(entities),
  forms: many(forms),
  workflows: many(workflows),
  agents: many(agents),
}));

export const entitiesRelations = relations(entities, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [entities.orgId],
    references: [organizations.id],
  }),
  app: one(apps, {
    fields: [entities.appId],
    references: [apps.id],
  }),
  creator: one(users, {
    fields: [entities.createdBy],
    references: [users.id],
  }),
  fields: many(entityFields),
  records: many(entityRecords),
  tableViews: many(tableViews),
  detailViews: many(detailViews),
  forms: many(forms),
}));

export const entityFieldsRelations = relations(entityFields, ({ one }) => ({
  entity: one(entities, {
    fields: [entityFields.entityId],
    references: [entities.id],
  }),
}));

export const entityRecordsRelations = relations(entityRecords, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [entityRecords.orgId],
    references: [organizations.id],
  }),
  app: one(apps, {
    fields: [entityRecords.appId],
    references: [apps.id],
  }),
  entity: one(entities, {
    fields: [entityRecords.entityId],
    references: [entities.id],
  }),
  creator: one(users, {
    fields: [entityRecords.createdBy],
    references: [users.id],
  }),
  updater: one(users, {
    fields: [entityRecords.updatedBy],
    references: [users.id],
  }),
  versions: many(entityRecordVersions),
  submissions: many(formSubmissions),
}));

export const entityRecordVersionsRelations = relations(
  entityRecordVersions,
  ({ one }) => ({
    record: one(entityRecords, {
      fields: [entityRecordVersions.recordId],
      references: [entityRecords.id],
    }),
    changer: one(users, {
      fields: [entityRecordVersions.changedBy],
      references: [users.id],
    }),
  })
);

export const tableViewsRelations = relations(tableViews, ({ one }) => ({
  organization: one(organizations, {
    fields: [tableViews.orgId],
    references: [organizations.id],
  }),
  app: one(apps, {
    fields: [tableViews.appId],
    references: [apps.id],
  }),
  entity: one(entities, {
    fields: [tableViews.entityId],
    references: [entities.id],
  }),
  creator: one(users, {
    fields: [tableViews.createdBy],
    references: [users.id],
  }),
}));

export const detailViewsRelations = relations(detailViews, ({ one }) => ({
  organization: one(organizations, {
    fields: [detailViews.orgId],
    references: [organizations.id],
  }),
  app: one(apps, {
    fields: [detailViews.appId],
    references: [apps.id],
  }),
  entity: one(entities, {
    fields: [detailViews.entityId],
    references: [entities.id],
  }),
  creator: one(users, {
    fields: [detailViews.createdBy],
    references: [users.id],
  }),
}));

export const formSubmissionsRelations = relations(formSubmissions, ({ one }) => ({
  form: one(forms, {
    fields: [formSubmissions.formId],
    references: [forms.id],
  }),
  formVersion: one(formVersions, {
    fields: [formSubmissions.formVersionId],
    references: [formVersions.id],
  }),
  entityRecord: one(entityRecords, {
    fields: [formSubmissions.entityRecordId],
    references: [entityRecords.id],
  }),
  submitter: one(users, {
    fields: [formSubmissions.submittedBy],
    references: [users.id],
  }),
}));

export const formsRelations = relations(forms, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [forms.orgId],
    references: [organizations.id],
  }),
  app: one(apps, {
    fields: [forms.appId],
    references: [apps.id],
  }),
  entity: one(entities, {
    fields: [forms.entityId],
    references: [entities.id],
  }),
  creator: one(users, {
    fields: [forms.createdBy],
    references: [users.id],
  }),
  submissions: many(formSubmissions),
  versions: many(formVersions),
}));

export const formVersionsRelations = relations(formVersions, ({ one, many }) => ({
  form: one(forms, {
    fields: [formVersions.formId],
    references: [forms.id],
  }),
  publisher: one(users, {
    fields: [formVersions.publishedBy],
    references: [users.id],
  }),
  submissions: many(formSubmissions),
}));

export const workflowsRelations = relations(workflows, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [workflows.orgId],
    references: [organizations.id],
  }),
  app: one(apps, {
    fields: [workflows.appId],
    references: [apps.id],
  }),
  creator: one(users, {
    fields: [workflows.createdBy],
    references: [users.id],
  }),
  instances: many(workflowInstances),
}));

export const agentsRelations = relations(agents, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [agents.orgId],
    references: [organizations.id],
  }),
  app: one(apps, {
    fields: [agents.appId],
    references: [apps.id],
  }),
  creator: one(users, {
    fields: [agents.createdBy],
    references: [users.id],
  }),
  executions: many(agentExecutions),
}));
