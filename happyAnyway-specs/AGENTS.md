# happyAnyway 共享规格入口
本仓库维护产品需求、跨端业务含义和验收，不规定 Java 分层或微信组件实现。
先阅读 [项目说明](README.md)、[产品范围](product/overview.md)、[交付状态](delivery/status.md)。
按任务读取 [需求分析](rules/requirements.md)、[规格编写](rules/specification.md)、[变更管理](rules/change-management.md)。
需求明确后再设计功能，不将猜测当作用户决定。已确认、草案、待确认必须区分。
一项需求对应稳定编号，任务下发明确规格版本和范围。具体代码规则由目标仓库 AGENTS.md 决定。
检查并保留现有修改，不擅自提交、发布或修改其他仓库实现；跨端规格由协调任务统一维护。
验证运行 node scripts/check-specs.mjs。收尾更新交付状态；实现完成与联调、验收完成分别记录。
