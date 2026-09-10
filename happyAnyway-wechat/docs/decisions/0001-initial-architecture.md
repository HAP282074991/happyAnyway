# 初始技术决策

状态：基础选型已确认，Harness 细则待继续讨论。

- 微信端、后端独立 Git 仓库。
- 各前端完全独立，只共用后端 API。
- 微信使用原生 + TypeScript；后端 Spring Boot；数据库 MySQL / InnoDB。
- 后端采用模块化单体，Flyway 管理表结构版本。
- 本轮只落地目录和约束，不引入业务代码或安装依赖。
