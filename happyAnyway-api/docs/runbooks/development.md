# 开发与验证

## 环境

需要 Java 21 和 Maven 3.9.15（本机已安装）。初次构建需要联网下载依赖。IDE 打开 pom.xml 导入项目，Project SDK 设置 Java 21。

## 启动

- 不接数据库：mvn spring-boot:run "-Dspring-boot.run.profiles=local"。
- 真实数据库：配置 DB_URL、DB_USERNAME、DB_PASSWORD，运行 mysql profile。
- 不激活 local 时数据库配置必须有效。MySQL 使用已创建的隔离开发数据库，Flyway 负责表结构，不创建服务器或复制本地数据。
- Swagger/OpenAPI 只在 local 开启。mysql 模式可按后续受控联调需求开启文档，不默认公开。
- 当前未实现业务登录，除健康检查及 local 文档外默认拒绝访问。

## 验证

mvn verify 执行编译、JUnit 和 ArchUnit 测试并打包。

当前测试使用 local profile，不访问真实 MySQL；Docker 未运行时也能执行。数据库用例出现后，使用已配置的 Testcontainers MySQL 编写真实集成测试。

powershell -NoProfile -File scripts/check-structure.ps1 检查骨架文档。

## 配置

.env.example 是变量名说明，实际设置在终端环境或 IDE 运行配置中，不提交真实密码。数据库默认端口 3306，API 默认 8080；端口冲突时设置 SERVER_PORT。
