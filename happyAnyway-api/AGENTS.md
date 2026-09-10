# happyAnyway 后端工作入口

## 统一规则
- 本文件只维护统一约定和阅读入口；详细规则以链接文件为准，不复制多份。
- 先核对用户任务、相关需求和工作区状态。当前用户明确要求优先于仓库约定；发现规则与实现冲突时明确记录，不把偶然实现当作规则。
- 只完成授权范围内的工作，保留已有修改；不根据占位目录自行增加业务。
- 不提交密钥、真实令牌、生产数据或本机私有配置。
- 不为通过检查而删除有效测试、削弱断言或无依据地关闭规则；合理规则调整见审查约定。
- 区分“已实现、已验证、未验证、建议”；不要把历史结果报告为当前验证。
- 修改规则时同步权威文件、引用和适用检查；会话结束更新交接，复杂任务更新计划。

## 接手必读
1. [交接状态](docs/HANDOFF.md)：进度与下一步；结合 git status 和实际代码核对。
2. [项目说明](README.md)：环境与启动。
3. [架构](ARCHITECTURE.md)：职责和依赖方向。
4. [文档索引](docs/index.md)：相关需求、决定和任务。

## 按任务加载
| 任务 | 必读 |
|---|---|
| 实现或重构代码、调整依赖配置 | [开发规则](docs/rules/development.md) |
| 编写测试、运行验证、修改检查规则 | [测试规则](docs/rules/testing.md) |
| 新增或修改 HTTP 接口、认证边界 | [接口规则](docs/rules/api.md) |
| 修改 Entity、Mapper、SQL 或表结构 | [数据库规则](docs/rules/database.md) |
| 审查、收尾、处理例外 | [审查规则](docs/rules/review.md) |
| 跨层、跨模块或多阶段工作 | [计划约定](docs/exec-plans/README.md) |

任务跨多个范围时合并阅读；相关业务需求见 [产品入口](docs/product/overview.md)。

## 操作与收尾入口
- 实际命令统一维护在 [开发运行说明](docs/runbooks/development.md)。
- 验收范围见 [测试矩阵](docs/rules/testing.md)，交付标准见 [审查规则](docs/rules/review.md)。
- 当前检查覆盖与缺口见 [质量状态](docs/quality.md)。

## 共享规格入口
- 产品需求、功能划分和跨端验收以同级 happyAnyway-specs 为权威来源；先读取本仓库 specs-reference.json。
- repositoryPath 相对本仓库根目录解析；按引用版本读取规格，不套用其他实现仓库的开发规则。
- 当前 bootstrap-unpinned 仅用于初始化与讨论；正式功能开发前建立明确规格提交。规格不可访问时报告，不猜测业务。
- 新工作区：D:\AIProject\happyAnyway；只在本仓库授权范围内实施。
