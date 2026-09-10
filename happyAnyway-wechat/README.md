# happyAnyway 微信小程序

独立原生微信小程序：TypeScript + WXML + WXSS。仅通过 API 使用统一后端。

## 开始开发

需要 Node.js 22+、npm 和微信开发者工具。

```powershell
npm ci
npm run dev
```

在微信开发者工具导入本仓库根目录（含 project.config.json）。首次安装后也可先运行 npm run build，再打开项目。

- 已有可编译的首页及 app 配置。
- TypeScript 由 npm 编译，在源码旁生成 .js 和 .js.map；生成文件不提交。
- 当前只有开发依赖，无客户端运行时 npm 包，无需“构建 npm”。以后添加运行时包时另行配置。
- 当前 AppID 为 touristappid，仅用于游客开发。登录微信开发者工具并改成自己的 AppID 后才能验证账号相关能力及真机发布。
- 未指定微信基础库版本；首次导入选用开发者工具提供的稳定基础库，团队联调后锁定。

## 验证

```powershell
npm run verify
```

依次执行 ESLint、类型检查、编译、文档链接和页面资源检查。它不代替微信开发者工具编译与真机验收。

参见 [架构](ARCHITECTURE.md)、[工作入口](AGENTS.md)、[运行说明](docs/runbooks/development.md)。
