# 开发环境初始化

目标：从目录骨架补成 Java 21 / Maven 可编译、测试和启动的 Spring Boot 工程。

范围：配套依赖、local/mysql 配置、默认访问边界、基础测试与文档。不修改现有 MySQL 数据。

决策：Spring Boot 3.5.16 + MyBatis 3.0.5 + springdoc 2.8.17；local 显式排除数据库，仅用于开发；默认及 mysql 模式需要真实数据库凭证。

验收：Maven verify 通过；实际 HTTP 健康检查和 API 文档访问成功。

结果：依赖已下载，mvn verify 构建成功且 5 项测试通过；JAR 与 mvn spring-boot:run 两种启动均完成健康检查。JAR 的 OpenAPI/Swagger 与默认拒绝路由已通过 HTTP 验证。临时验证服务已停止。

限制：Wrapper 下载请求未获批准，使用本机 Maven 3.9.15；真实 MySQL 与迁移不在已验证范围。
