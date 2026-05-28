# Looma 项目总体规划

## 1. 产品定位

Looma 是一个 AI 原生零代码平台，目标不是只做表单、工作流或聊天机器人，而是把三类能力融合在同一个业务语义底座上：

- 零代码业务平台：用数据模型、界面和业务逻辑搭建内部应用。
- 零代码智能体平台：用工作流、多智能体和工具调用构建业务 Agent。
- AI 原生开发体验：AI 能理解业务模型，并辅助生成实体、表单、页面、流程和智能体。

核心判断：Looma 的长期价值在于“业务语义建模”。只有先建立实体、字段、关系、权限和事件模型，工作流和智能体才不是孤立自动化，而是能围绕真实业务对象运行。

## 2. 产品界面分层

### 2.1 Studio 管理界面

Studio 面向管理员、实施人员和业务 Owner，用于设计和发布业务能力。

建议路由：

```txt
/studio
  /overview
  /data
    /entities
    /entities/:entityId
    /entities/:entityId/records
  /interfaces
    /forms
    /forms/:formId
    /pages
    /views
  /workflows
    /business
    /automations
    /runs
  /agents
    /assistants
    /workflows
    /tools
    /runs
  /team
  /settings
```

当前管理端使用 `/studio`。旧 `/dashboard/*` 仅作为兼容入口重定向到对应 Studio 页面。

### 2.2 App 使用界面

App Runtime 面向最终业务用户，用于实际处理业务数据、任务和智能体协作。

建议路由：

```txt
/app
  /home
  /tasks
  /apps/:appSlug
  /entities/:entitySlug
  /entities/:entitySlug/:recordId
  /agent
```

公开表单可以继续使用：

```txt
/forms/:formId
```

当前已实现 `/app` 的最小 Runtime：业务用户可以进入 App、查看 Entity、创建 Record、查看和编辑 Record。后续需要把它从“通用数据运行时”升级为可配置的业务页面和视图。
当前已实现 Table View MVP：Studio 可为 Entity 配置多个表格视图，App Runtime 的记录列表会按所选视图展示列、默认排序、基础搜索，并支持视图切换。
当前已实现字段筛选 MVP：Studio 可在 Table View 中标记可筛选字段，App Runtime 会渲染对应筛选控件并按字段值过滤记录。
当前已实现 Detail View MVP：Studio 可为 Entity 配置默认详情视图，App Runtime 的记录详情会按该配置展示分组、字段标签，并控制哪些字段可编辑。
当前已强化 Form schema 校验：公开提交 API 会校验必填、min/max、pattern、email、phone、date、datetime、select/radio/checkbox 选项和值类型，不能只依赖浏览器控件。
当前已补齐 Form 生命周期基础：发布后编辑会生成新的 draft 版本，公开填写页只服务 published 状态，表单支持 archive / restore / delete 管理操作。
当前已补齐 Responses 运营基础：Responses 列表可进入单条提交详情，详情页展示提交快照、审计元数据和关联 Record 跳转，并支持 CSV 导出。
当前已补齐 Responses 查询基础：Responses 列表支持关键词搜索、按字段值过滤、按提交时间排序，CSV 导出会复用当前查询条件。
当前已补齐 Responses 版本快照基础：Responses 列表、详情和 CSV 导出会显示提交时的 Form Version 和版本化字段快照，避免历史提交被后续字段标签变更误读。
当前已补齐公开提交体验基础：Form settings 支持开启/关闭收集、关闭提示、成功标题/文案和提交后跳转 URL，公开页与提交 API 使用同一套设置。
当前已补齐公开提交保护基础：公开表单包含 honeypot 反垃圾字段，提交 API 会按表单和客户端短窗口限流，并把服务端错误展示给填写者。
当前已补齐 Form Detail 控制台基础：表单详情页聚合 Builder、Public form、Responses、Records、Settings 入口，并展示状态、版本、提交数和绑定 Entity。
当前已补齐 Form 发布快照基础：新增 form_versions，发布会写入不可变快照；公开填写页和提交 API 读取最近发布版本，编辑 draft 时不影响线上表单。
当前已补齐 Form 版本恢复基础：历史发布快照可以恢复为新的 draft 版本，确认无误后再重新发布到公开填写页。
当前已补齐 Form Builder 数据绑定可视化基础：画布字段会显示已绑定 Entity Field 或将创建的新 Entity Field，属性面板可查看/切换兼容 Entity Field 绑定和 dataKey。
当前已补齐 Form Builder 条件显示基础：属性面板可配置字段按其他字段值显示/隐藏，设计预览、公开填写、校验和 Record 写入使用同一套条件逻辑。

## 3. 核心架构

Looma 应拆成四个核心层：

```txt
Data Model
  Entity / Field / Relation / Record
        ↓
Interface Model
  Form / View / Page / Studio
        ↓
Logic Model
  Trigger / Workflow / Action / Event
        ↓
Agent Model
  Agent / Tool / Agent Workflow / Multi-Agent Runtime
```

### 3.1 数据层 Data Model

数据层是所有上层能力的基础。

核心对象：

- Entity：业务实体，例如客户、订单、合同、员工、项目。
- Field：实体字段，例如姓名、金额、状态、日期。
- Relation：实体关系，例如客户有多个订单、订单属于客户。
- Record：实体数据记录。
- View：实体数据视图，例如表格视图、筛选视图、详情视图。

设计原则：

- 一个 Entity 在语义上对应一张数据库表。
- Field 类型应能映射到真实数据库列类型。
- Relation 应支持 one-to-one、one-to-many、many-to-many。
- 表单、页面、工作流、智能体都优先引用 Entity，而不是各自维护孤立 schema。
- AI 对话和 Agent 工具应读取 Entity 元数据，以业务语言理解系统。

短期实现可以先用元数据表承载动态实体，而不是立即创建物理业务表。中长期再提供“实体同步到物理表”的能力。

### 3.2 界面层 Interface Model

界面层负责把数据模型变成可使用的业务界面。

核心对象：

- Form：创建或编辑记录的输入界面。
- Table View：记录列表。
- Detail Page：单条记录详情。
- Studio：统计与入口。
- Page：可组合业务页面。

硬规则：

- Form 属于 Interface/View 层，不是业务数据源。
- Entity 拥有 Records，Form 只负责创建或编辑 Records。
- Submission 是通过 Form 产生的一次提交事件和审计快照。
- 所有新 Form 默认绑定 Entity；未指定 Entity 时自动创建同名 Entity。

当前 Forms MVP 应演进为 Entity 驱动：

- 创建表单时选择或创建 Entity。
- 字段来自 Entity Field，也允许临时字段同步回 Entity。
- 表单提交后写入 Record，同时保留 Form Submission 作为提交审计。

### 3.3 逻辑层 Logic / Workflow

逻辑层负责业务事件和自动化。

工作流分两类：

- Business Workflow：审批、状态流转、任务分配、通知。
- Automation Workflow：类似 n8n，连接外部 API、Webhook、邮件、第三方系统。

第一批节点：

- Trigger：record.created、record.updated、form.submitted、manual、schedule、webhook。
- Condition：条件判断。
- Action：create record、update record、send notification、HTTP request。
- Approval：审批。
- Agent：调用智能体。
- End：结束。

运行时对象：

- Workflow Definition
- Workflow Version
- Workflow Run
- Workflow Step Run
- Workflow Log

### 3.4 智能体层 Agent Model

Agent 层应建立在数据层和逻辑层之上，不应只是一个聊天框。

支持两种模式：

1. Dify-like Agent Workflow
   - 通过节点编排 LLM、知识检索、条件、工具调用和输出。
   - 适合结构化任务，例如“分析客户反馈并生成跟进任务”。

2. n8n-like / Multi-Agent Network
   - 主 Agent 调度多个子 Agent。
   - 子 Agent 拥有独立角色、工具、上下文和边界。
   - 适合复杂业务协作，例如销售主管 Agent 调用客户分析 Agent、合同审查 Agent 和任务分配 Agent。

Agent 的第一批工具：

- 查询 Entity 元数据。
- 查询 Records。
- 创建/更新 Record。
- 触发 Workflow。
- 生成 Form schema。
- 生成 Workflow draft。

## 4. 推荐数据模型

第一阶段建议新增以下核心表或等价 Drizzle schema：

```txt
apps
  id, organization_id, name, slug, description, status

entities
  id, organization_id, app_id, name, slug, description, storage_mode, created_at, updated_at

entity_fields
  id, entity_id, name, slug, type, required, unique, default_value, config, order

entity_relations
  id, organization_id, source_entity_id, target_entity_id, type, source_field_id, target_field_id, config

entity_records
  id, organization_id, app_id, entity_id, data, created_by, updated_by, created_at, updated_at

entity_record_versions
  id, record_id, version, data, changed_by, created_at

forms
  id, organization_id, app_id, entity_id, name, schema, status, version

form_submissions
  id, form_id, form_version_id, entity_record_id, data, submitted_by, submitted_at

form_versions
  id, form_id, version, name, description, schema, settings, published_by, published_at

workflows
  id, organization_id, app_id, name, type, status, version, definition

workflow_runs
  id, workflow_id, trigger_type, trigger_payload, status, started_at, finished_at

agents
  id, organization_id, app_id, name, type, status, config

agent_tools
  id, organization_id, agent_id, type, name, config

agent_runs
  id, agent_id, input, output, status, started_at, finished_at
```

`storage_mode` 建议：

- `json`: MVP 默认，记录写入 `entity_records.data`。
- `physical_table`: 后续能力，为 Entity 创建真实数据库表。
- `external`: 后续能力，映射到外部数据源。

## 5. 实现路线

### Phase 0：当前项目稳态化

目标：保证已有 Forms MVP、认证、Studio 可以稳定运行和测试。

已完成：

- Next.js 15 项目脚手架。
- NextAuth 登录注册。
- 组织与成员基础模型。
- Studio 壳子。
- Forms 列表、设计器、发布、公开填写、提交记录。
- Forms E2E 测试。
- 旧 `/dashboard/*` 到 `/studio/*` 的兼容重定向。

仍需补齐：

- 修正 README 与实际目录结构。
- 补齐更多 UI smoke tests。
- 明确数据库迁移和 seed 流程。

### Phase 1：Data Studio MVP

目标：把 Looma 从“表单工具”升级为“业务数据平台”。

已完成：

- 新增 App 模型，作为组织下的业务应用容器。
- 新增 Entity、Field、Relation、Record schema。
- 新增 `/studio/data/entities` 页面。
- 支持创建 Entity 和字段。
- 支持查看 Entity Records。
- 表单默认绑定 Entity；没有选择 Entity 时自动创建。
- 表单提交写入 `entity_records`。
- Form Submissions 关联 `entity_record_id`。
- 表单设计器支持选择 App / Entity，并从已有 Entity Fields 导入字段。

验收标准：

- 用户可以创建“客户”实体。
- 用户可以为客户添加姓名、手机号、状态等字段。
- 用户可以创建一个“客户登记表”绑定客户实体。
- 外部用户提交表单后，后台 Records 中出现客户记录。

### Phase 2：Interface Builder MVP

目标：从表单设计器扩展到基础业务界面搭建。

已完成：

- Forms 字段来源改为 Entity Fields。
- 新增 `/app` 使用端入口。
- 支持最终用户浏览实体列表和记录详情。
- 新增 Table View 配置。
- 新增 Detail View 配置。
- 支持多 Table View、基础搜索、字段筛选和默认排序。

任务：

- 支持视图权限和默认视图约束。

验收标准：

- 管理员在 Studio 配置实体视图。
- 业务用户在 App Runtime 使用该视图处理数据。
- 管理界面和使用界面在体验上明显分离。

### Phase 3：Workflow MVP

目标：围绕 Entity 事件建立业务自动化闭环。

任务：

- 新增 Workflow Definition、Run、Log schema。
- 实现工作流列表与详情。
- 第一版可先使用配置表单，不强依赖完整画布。
- 支持 form.submitted / record.created / record.updated 触发器。
- 支持 condition、update record、create record、notification、HTTP request。
- 提供运行日志页面。

验收标准：

- 客户登记表提交后触发工作流。
- 工作流根据字段条件更新客户状态或创建任务。
- 后台能看到每次执行的输入、节点结果和错误信息。

### Phase 4：Agent Studio MVP

目标：让 AI 能基于业务模型执行有边界的任务。

任务：

- 接入基础 LLM Provider 配置。
- 建立 Agent、Tool、Agent Run schema。
- 实现 Agent Chat 面板。
- Agent 可以读取 Entity 元数据。
- Agent 可以查询 Records。
- Agent 可以生成 Form 草稿。
- Agent 可以触发 Workflow。

验收标准：

- 用户可以问“帮我创建一个客户登记表”。
- Agent 生成 Entity + Form 草稿，用户确认后保存。
- 用户可以问“最近提交的客户有哪些”，Agent 返回真实业务数据。

### Phase 5：Agent Workflow 与多智能体

目标：支持 Dify-like 和 n8n-like 的高级智能体编排。

任务：

- Agent Workflow 画布。
- LLM、Tool、Condition、Knowledge、Human Review 节点。
- 主 Agent / 子 Agent 配置。
- Agent Run Trace。
- 工具权限与数据访问控制。
- 外部连接器和 MCP 工具注册。

验收标准：

- 一个主 Agent 可以调用多个子 Agent。
- 每个 Agent 的工具权限可配置。
- 执行过程可追踪、可审计、可复盘。

## 6. 权限与安全原则

权限必须从一开始进入核心设计。

权限层级：

- Organization：租户隔离。
- App：应用访问权限。
- Entity：实体级读写权限。
- Field：字段级可见和可编辑权限。
- Record：行级数据权限。
- Workflow：编辑、发布、执行权限。
- Agent：可调用工具和可访问数据范围。

最小角色：

- owner：组织所有者，可管理所有资源。
- admin：管理员，可配置应用、实体、流程、Agent。
- builder：搭建者，可创建表单、页面、工作流。
- member：业务用户，可使用 App Runtime。
- viewer：只读用户。

Agent 安全原则：

- Agent 默认不能访问所有数据。
- Agent 工具必须显式授权。
- 高风险操作需要 human approval。
- 所有 Agent 工具调用需要记录审计日志。

## 7. 当前优先级

近期不要优先扩散到完整 n8n、模板市场、知识库、长期记忆。推荐优先级：

1. App Runtime 的权限细化。
2. Workflow MVP：Entity 事件驱动。
3. Agent MVP：围绕 Entity 和 Workflow 的 AI 能力。
4. 多智能体和高级自动化。

## 8. 后续任务拆解

### 8.1 立即可开发

- 为 App Runtime 细化 App / Entity / Record 访问权限。
- 为 Table View / Detail View 增加可见性和默认视图规则。

### 8.2 需要设计后开发

- Entity 到物理数据库表的同步策略。
- Relation 的 UI 表达和存储方案。
- App Runtime 的信息架构。
- Workflow 画布交互。
- Agent 工具权限模型。

### 8.3 暂缓

- 模板市场。
- 完整知识库系统。
- 长期记忆。
- 大量第三方连接器。
- 复杂 BI 报表。
- 完整物理表迁移引擎。

## 9. 开发原则

- 先建立业务语义，再做 AI 自动化。
- 先做可运行闭环，再做复杂画布。
- 先让单组织场景稳定，再扩展复杂企业权限。
- 先用 JSON 元数据跑通动态能力，再逐步引入物理表同步。
- 所有核心功能都要有 E2E 覆盖。
- 管理界面和使用界面必须分离，避免最终用户进入设计器语境。
