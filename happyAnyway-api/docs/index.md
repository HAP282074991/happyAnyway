# 后端文档导航

## 接手与全局
- [工作入口](../AGENTS.md)
- [项目运行入口](../README.md)
- [架构与依赖边界](../ARCHITECTURE.md)
- [当前交接](HANDOFF.md)
- [质量与验证状态](quality.md)

## 专项规则
| 文件 | 权威范围 |
|---|---|
| [开发](rules/development.md) | 实现方式、异常、事务用法、配置和依赖 |
| [测试](rules/testing.md) | 验证矩阵、测试隔离、模拟边界和结果 |
| [审查](rules/review.md) | 审查过程、完成标准、规则例外与交付 |
| [接口](rules/api.md) | DTO、HTTP、身份边界、兼容和契约 |
| [数据库](rules/database.md) | 表设计、SQL、索引、迁移与环境 |

架构只定义结构和依赖，专项规则不复制整份边界表。操作命令在 runbooks，当前事实在 HANDOFF/quality，长期规则不写进交接。

## 需求与设计
- [产品范围](product/overview.md)
- [验收标准](product/acceptance.md)
- [设计入口](design/overview.md)
- [契约产物说明](../contracts/README.md)

## 计划与决策
- [执行计划约定](exec-plans/README.md)
- [当前计划目录](exec-plans/active)
- [完成计划目录](exec-plans/completed)
- [初始选型](decisions/0001-initial-architecture.md)
- [层级优先组织](decisions/0002-layer-first-packages.md)
- [Harness 专项规则拆分](decisions/0003-harness-rule-split.md)

## 操作
- [开发与验证命令](runbooks/development.md)
