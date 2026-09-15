# happyAnyway

按部门协作的 Harness：项目经理 → 产品设计 → 开发 → 审核 → 测试 → 用户验收。开发分后端与微信，审核和测试独立于开发自检。

**先架构，后开发。** 阶段由 [project-state.json](docs/project-state.json) 明确：architecture 搭建架构；用户验收后清除筹备记录，形成 ready 干净基线；确认需求并初始化岗位后进入 development。详细边界及清理预览见[生命周期](docs/lifecycle.md)。

## 岗位配置入口

- 项目经理：[AGENTS.md](AGENTS.md)。
- 产品设计：[docs/agents/product-designer.md](docs/agents/product-designer.md)。
- 后端开发：[docs/agents/backend-developer.md](docs/agents/backend-developer.md)。
- 微信开发：[docs/agents/wechat-developer.md](docs/agents/wechat-developer.md)。
- 审核：[docs/agents/reviewer.md](docs/agents/reviewer.md)。
- 测试：[docs/agents/tester.md](docs/agents/tester.md)。

详细阅读清单与工作要求见各自配置文件。

## 工程结构

```text
AGENTS.md                       项目经理专属配置
README.md                       项目说明
docs/
  requirements/                 产品设计维护的需求、交互与验收
  decisions/                    重要历史决定
  workflow.md                   部门协作流程
  agents/                       产品设计、后端、微信、审核、测试配置
  agent-init.md                 岗位任务初始化
  progress.md                   任务总览与索引
  tasks/                        标准派工模板、单任务记录与证据
scripts/
  verify.ps1                    统一本地检查入口
  check-docs.mjs                 文档链接及需求引用检查
happyAnyway-api/                后端代码、架构、专项规则和测试
happyAnyway-wechat/             微信代码、架构、工程检查和测试
```

一个根 Git 仓库，两个代码工程；不按岗位复制工程或新增空文档目录。需求与设计共用[需求目录](docs/requirements/README.md)，审核及测试报告由根进度链接到实际交付物。各端 specs-reference.json 指向采用的根需求版本。

岗位配置决定各自的职责与操作边界；部门流程说明如何协作，任务文件说明本次具体做什么。能读取项目经理配置或其他岗位资料，不代表获得其中的修改权限。每个岗位只能在自身配置及本次授权范围内执行，不能因共同参与项目而获得全项目写入权限。

## 本地检查

在项目根目录使用 PowerShell：

- `./scripts/verify.ps1 -Scope docs`：检查器回归与两端入口正反样例测试，公共及两端文档链接、需求引用和后端文档结构。
- `./scripts/verify.ps1 -Scope backend`：上述检查加 Maven 构建与测试。
- `./scripts/verify.ps1 -Scope wechat`：文档检查加微信 lint、类型检查、编译和资源检查。
- `./scripts/verify.ps1`：全部检查。任一失败返回非零退出码，其他独立检查仍执行。

所有阶段均检查规则摘要、文档、检查器回归和所选工程。architecture 不强制要求业务任务或岗位实例；ready 还验证运行记录为空；development 才执行机器派工、权限、状态与交付证据门禁。新开发任务从 `docs/tasks/automation/` 登记；派工前使用 `node scripts/check-tasks.mjs --dispatch 任务编号`，验收前使用 `--delivery 任务编号`。报告生成到 `.reports/verify/`。完整字段和步骤见[自动化保障说明](docs/decisions/automation.md)。

[GitHub CI 工作流](.github/workflows/verify.yml)配置提交／PR 自动运行统一检查并归档报告。工作流随当前阶段执行；远端首次运行和目标分支必需状态检查须在实际仓库启用并验证，文件存在不代表合并保护已生效。

需要 Node.js 22+、Java 21、Maven 及已安装的微信 NPM 依赖；环境配置见[后端运行说明](happyAnyway-api/docs/runbooks/development.md)和[微信运行说明](happyAnyway-wechat/docs/runbooks/development.md)。检查不代替真实 MySQL、业务联调、开发者工具、真机或用户验收，也不自动安装依赖或发布。

远程 [HAP282074991/happyAnyway](https://github.com/HAP282074991/happyAnyway)；提交、推送、发布分别按授权执行。VS Code 可打开 happyAnyway.code-workspace，岗位任务实际工作目录由初始化时核实。
