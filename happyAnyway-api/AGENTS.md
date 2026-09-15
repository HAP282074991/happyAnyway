# 后端工程入口

职责与读写权限遵循根 docs/agents/ 中对应岗位配置，公共协作遵循[部门流程](../docs/workflow.md)；[根 AGENTS.md](../AGENTS.md)仅配置项目经理，不授予执行岗位权限。本文件供后端开发、审核和测试按任务读取，只维护后端工程细则入口。

## 接手

- [交接](docs/HANDOFF.md)、[运行说明](docs/runbooks/development.md)、[架构](ARCHITECTURE.md)、[文档索引](docs/index.md)。
- [规格引用](specs-reference.json)指定采用的根需求版本；解析规则见[需求入口](../docs/requirements/README.md)。
- 发现工程规则与实现冲突时明确记录，不把偶然实现当作规则。

## 按任务读取

| 工作 | 规则 |
|---|---|
| 实现、重构、依赖配置 | [开发](docs/rules/development.md) |
| 测试及检查规则 | [测试](docs/rules/testing.md) |
| HTTP 接口、认证边界 | [接口](docs/rules/api.md) |
| Entity、Mapper、SQL、表结构 | [数据库](docs/rules/database.md) |
| 审核、收尾、例外处理 | [审查](docs/rules/review.md) |
| 跨层、跨模块、多阶段任务 | [执行计划](docs/exec-plans/README.md) |

跨多个范围时合并阅读。审核只形成结论与整改项，开发修复后交复审；测试按测试规则独立验证并报告缺陷。

## 验证与交接

- 文档：`./scripts/check-structure.ps1`；工程：`mvn verify`，在本工程目录运行。
- 检查覆盖和缺口见[质量状态](docs/quality.md)，操作命令见运行说明。
- 后端进展更新交接文件，项目经理在根进度中汇总；不能用开发自检代替审核或测试岗位结论。
