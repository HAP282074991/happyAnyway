# happyAnyway 统一后端

Java 21 + Spring Boot 3.5.16 + Maven，MyBatis 3.0.5、MySQL、Flyway、Spring Security、springdoc 2.8.17。

代码按 controller/service/mapper/entity/dto 分层，各层内再按业务模块划分。具体边界见 ARCHITECTURE.md。

本机已安装 Maven 3.9.15。本次 Wrapper 下载请求未获批准，项目使用全局 mvn；其他电脑需安装 Maven。

## 无数据库启动

```powershell
mvn spring-boot:run "-Dspring-boot.run.profiles=local"
```

macOS/Linux：`mvn spring-boot:run -Dspring-boot.run.profiles=local`。

- http://127.0.0.1:8080/actuator/health
- http://127.0.0.1:8080/swagger-ui/index.html
- http://127.0.0.1:8080/v3/api-docs

local 显式关闭数据库和 Flyway，仅绑定本机回环地址。用于开发接口结构与基础启动，不代表数据库已接通。

## MySQL 开发

先准备隔离的 happyanyway_dev 数据库和开发账号，再在当前终端设置环境变量：

```powershell
$env:DB_URL = 'jdbc:mysql://localhost:3306/happyanyway_dev?connectionTimeZone=UTC'
$env:DB_USERNAME = 'happyanyway'
$env:DB_PASSWORD = '<本地开发密码>'
mvn spring-boot:run "-Dspring-boot.run.profiles=mysql"
```

不要同时激活 local 和 mysql。不提供密码时，默认数据库模式应启动失败，不静默降级成内存库。.env.example 仅是变量说明，Spring 不自动读取 .env。

## 构建与测试

```powershell
mvn verify
```

测试当前覆盖 local 上下文、健康检查、API 文档、默认拒绝业务接口和基础架构规则。Testcontainers 依赖已配置，真实 MySQL 集成测试将在数据用例建立后补充，不以当前测试替代。

产物：target/happyanyway-api-0.1.0-SNAPSHOT.jar。

未实现登录和业务接口。除健康检查及 local 文档外，路由默认拒绝访问；不得为开发方便改成全局放行。

参见 [架构](ARCHITECTURE.md)、[工作入口](AGENTS.md)、[运行说明](docs/runbooks/development.md)。

## Harness 入口

接手先阅读 [交接记录](docs/HANDOFF.md)，按 [规则索引](docs/index.md) 加载开发、测试、审查、接口和数据库规范。
专项规则的存在不代表全部自动执行；覆盖与历史验证见 [质量状态](docs/quality.md)。
