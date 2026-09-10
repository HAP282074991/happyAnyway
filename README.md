# happyAnyway 独立工作区
本项目使用单一 Git 仓库，根目录统一管理以下三个工程目录。
- happyAnyway-specs：共享需求、跨端流程、验收与接口版本登记。
- happyAnyway-api：Spring Boot / MySQL 后端及后端 Harness。
- happyAnyway-wechat：原生微信小程序及前端 Harness。

先进入目标仓库阅读 AGENTS.md。产品需求通过各端 specs-reference.json 引用同级规格仓库。
当前规格尚无提交，属于 bootstrap-unpinned；正式业务实现前固定规格版本。

VS Code 可打开 happyAnyway.code-workspace；这是编辑器工作区文件，不会自动注册 Codex 侧边栏项目。
Codex 中请打开/添加本目录作为项目。已有任务保存的工作目录不会因移动文件自动改变，任务必须使用新绝对路径。

检查：
- node happyAnyway-specs/scripts/check-specs.mjs
- 在 happyAnyway-api 下执行 mvn verify
- 在 happyAnyway-wechat 下执行 npm run verify

2026-09-10 经项目负责人确认改为根目录统一提交。原三个子仓库 Git 元数据已备份到本地 .git-migration-backup/（不纳入版本控制），源码保留。远程 origin：https://github.com/HAP282074991/happyAnyway.git。