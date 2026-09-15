# 后端接手入口

先读取工程 AGENTS、架构和根 docs/project-state.json，再核对实际 Git 状态；运行结果以当前任务证据为准。

- 当前工程是单一根仓库中的独立后端工程，按 controller/service/mapper/entity/dto 分层，层内按模块组织。
- Service 使用接口与 impl 实现，调用方依赖接口；详细边界见 [架构](../ARCHITECTURE.md)。
- 骨架提供 local 无数据库启动、默认安全边界和基础检查；没有批准的业务接口、登录或业务表。
- local/mysql 组合由启动初始化器拒绝；架构检查包含 Service 接口/实现约束和测试范围内的正反夹具，具体覆盖见质量说明。
- 架构阶段完善规范和检查，架构验收后清理筹备记录；开发阶段再按需求建立模块及真实数据库、接口用例。
- 接手进度与验证见根 docs/progress.md 和对应任务；本文件不积累执行历史或本机路径。

阅读[质量覆盖](quality.md)及[规则索引](index.md)。
