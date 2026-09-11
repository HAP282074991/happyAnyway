# 共享需求

本目录是根项目的需求文档，由产品设计 Agent 维护、项目经理协调确认，不是独立子项目。

- 产品：[范围](overview.md)、[路线](roadmap.md)、[功能需求](features/README.md)。
- 编写规则：[需求分析](analysis.md)、[规格编写](specification.md)、[变更管理](change-management.md)。
- 协作：[接口版本登记](contracts.md)、[进度](../progress.md)、[统一流程](../workflow.md)。

先明确需求与验收，再设计功能；区分已确认、草案和待确认，每项需求使用稳定编号。这里规定共同业务行为，各端实现规则见各自 AGENTS.md。

各端 specs-reference.json 的 repositoryPath 相对所属工程目录解析，指向根 Git 仓库；documentsPath 相对该仓库根目录解析，指向本目录。revision 记录采用的根仓库提交，features 记录功能编号。bootstrap-unpinned 只允许初始化与讨论，正式功能开发前锁定已确认需求的完整提交号。

在项目根目录运行 `node scripts/check-docs.mjs` 检查文档链接与引用路径；检查不代表业务已批准或已验收。
