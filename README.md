# happyAnyway

按部门协作的 Harness：项目经理 → 产品设计 → 开发 → 审核 → 测试 → 用户验收。开发分后端与微信，审核和测试独立于开发自检。

## 从这里开始

- 所有岗位：[AGENTS.md](AGENTS.md)，公共权限与阅读导航。
- 工作怎么流转：[部门协作流程](docs/workflow.md)，岗位职责、交付标准与返工路径。
- 建立团队：[Agent 初始化](docs/agent-init.md)，逐岗确认职责与边界后创建，集中保存实际创建消息、任务映射与接替历史。
- 现在做到哪里：[项目进度](docs/progress.md)，任务状态、证据、风险和下一步。

## 工程结构

```text
AGENTS.md                       公共入口
README.md                       项目说明
docs/
  requirements/                 产品设计维护的需求、交互与验收
  decisions/                    重要历史决定
  workflow.md                   部门协作流程
  project-management.md         项目经理职责
  agent-init.md                 岗位任务初始化
  progress.md                   项目进度与交付证据
scripts/
  verify.ps1                    统一本地检查入口
  check-docs.mjs                 文档链接及需求引用检查
happyAnyway-api/                后端代码、架构、专项规则和测试
happyAnyway-wechat/             微信代码、架构、工程检查和测试
```

一个根 Git 仓库，两个代码工程；不按岗位复制工程或新增空文档目录。需求与设计共用[需求目录](docs/requirements/README.md)，审核及测试报告由根进度链接到实际交付物。各端 specs-reference.json 指向采用的根需求版本。

## 本地检查

在项目根目录使用 PowerShell：

- `./scripts/verify.ps1 -Scope docs`：公共及两端文档链接、需求引用和后端文档结构。
- `./scripts/verify.ps1 -Scope backend`：上述检查加 Maven 构建与测试。
- `./scripts/verify.ps1 -Scope wechat`：文档检查加微信 lint、类型检查、编译和资源检查。
- `./scripts/verify.ps1`：全部检查。任一失败返回非零退出码，其他独立检查仍执行。

需要 Node.js 22+、Java 21、Maven 及已安装的微信 NPM 依赖；环境配置见[后端运行说明](happyAnyway-api/docs/runbooks/development.md)和[微信运行说明](happyAnyway-wechat/docs/runbooks/development.md)。检查不代替真实 MySQL、业务联调、开发者工具、真机或用户验收，也不自动安装依赖或发布。

当前先完成 Harness 并验收，再开展业务开发。远程 [HAP282074991/happyAnyway](https://github.com/HAP282074991/happyAnyway)；提交、推送、发布分别按授权执行。VS Code 可打开 happyAnyway.code-workspace，岗位任务实际工作目录由初始化时核实。
