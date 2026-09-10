# happyAnyway 共享规格
本仓库是产品需求、业务流程和跨端验收的权威来源。三个工程目录由根 Git 仓库统一管理，各端工程规则仍独立适用。
- 后端：../happyAnyway-api，Spring Boot / MySQL。
- 微信端：../happyAnyway-wechat，独立原生小程序。
- 产品范围：[overview](product/overview.md)；路线：[roadmap](product/roadmap.md)。
- 规则：[需求](rules/requirements.md)、[规格](rules/specification.md)、[变更](rules/change-management.md)。
- [接口版本登记](contracts/index.md)、[交付状态](delivery/status.md)、[跨端决定](decisions/0001-multi-repository.md)。

## 当前版本
项目已改为根目录统一 Git 管理；前后端 specs-reference.json 的 revision 为 null、status 为 bootstrap-unpinned。
此状态只用于搭建和需求讨论，不是发布规格锁。开始正式功能实现前建立规格 Git 提交，并把完整提交号写入各端引用文件。
不要把模板或 HEAD 最新工作区默认当作已确认需求。

## 验证
Node.js 22+ 下运行 node scripts/check-specs.mjs，无第三方依赖。
specs-reference 中的 repositoryPath 相对各代码仓库根目录解析；换机器保持三个同级仓库或明确更新本机检出方式。
