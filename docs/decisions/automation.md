# 自动化保障

## 基础检查与阶段

统一入口为 scripts/verify.ps1，始终运行检查器回归、规则摘要、文档和选定工程检查；任何失败返回非零，逐项日志及 summary.json 保存于 .reports/verify/。CI 使用同一入口。

- architecture：允许无业务任务和无岗位实例；筹备记录保留，校验器不把旧执行证据当作当前架构通过。
- ready：验证零任务、零运行身份、零历史豁免的干净基线，继续运行基础检查。
- development：启用以下派工、变更和交付门禁。

阶段及清理见[生命周期](../lifecycle.md)。基线预览命令不会清除源目录记录；进入开发须先确认架构验收与清理完成。

## 稳定规则与运行记录

[automation-policy.json](../agents/automation-policy.json)只保存岗位配置入口和基本允许范围；[versions.json](../agents/versions.json)只保存版本与规范化摘要。角色是否已经创建、正式 ID、确认回执、本次例外写入 docs/tasks/runtime.json。配置存在不等于已创建或已确认岗位。

清理时运行登记重置为空，业务开发从实际环境重新初始化。开发门禁不接受筹备期迁移摘要豁免。公共检查脚本等超出基本映射的任务范围须按岗位已确认权限登记具体任务例外，不得扩大长期权限。

## 开发派工

使用[派工模板](../tasks/TEMPLATE.md)和[机器记录字段模板](../templates/task.example.json)。在 docs/tasks/automation/ 保存同编号 JSON；文件名、任务编号和 Markdown 记录一致。

命令为 node scripts/check-tasks.mjs --dispatch 任务编号。草稿中允许有未确定字段，但显式派工时必须补全；接收者必须已确认且没有冲突任务。新文件任务在派工前不要求产物已经存在。校验通过后仍须按部门流程人工核对、留痕和发送；工具不会自动发消息。

字段包括身份、config/workflow 的 path/version/digest 回执、完整基线提交、指令及 D 序号、writeScopes、artifactScopes、依赖、验收、验证方法、估算与反馈。目录以 / 结尾，不使用通配符或父目录路径。artifactScopes 须覆盖允许修改的产物，可包含只读依赖；任务记录、进度、接手日志不属于产物快照。业务任务须有批准记录和可读取的规格提交。

业务任务还须将 writeScopes 或 artifactScopes 涉及的工程 specs-reference.json 锁定为 pinned，revision 与任务 specification.commit 一致。受影响工程的引用自动纳入产物快照；未受影响的工程不强制同步。历史 accepted 任务读取 deliveryCommit 内的工程引用，不用后续工作区的新引用重判旧交付。

运行登记格式为 schemaVersion:1、roles:{}、exceptions:{}。roles 按稳定策略中的角色键保存 enabled、agentId、config 和 workflow；exceptions 按任务编号保存 agentId、authorization、writeScopes。身份和摘要须从真实环境核实，不能直接使用模板占位符。

## 变更与历史

普通检查对比 HEAD 与工作区，包含暂存、未暂存、未跟踪和重命名两端；CI 对比事件基线。新增分支或手动运行没有 before 时采用 HEAD，不沿用筹备期固定提交。未提交变更仍需被有效任务覆盖。身份归属不是由路径检查证明的，实际写权限隔离依赖执行环境。

开发记录相对 Git 检查基线不能直接删除。状态回退或取消须包含 transition（from、to、reason、authorizedBy、record、digest），history 中保留之前的 status、snapshot、evidence；旧报告不可重写。未提交前的所有历史无法仅靠 Git 推断，仍须按部门流程追加记录。不得靠重写策略、历史或回退项目阶段绕过门禁。

同状态或状态前进也不得覆盖既有快照和已经完成阶段的证据；accepted 的交付提交、验收、规格及身份等关键字段保持不变。更正通过新任务或有授权的回退处理，history 追加原 status、snapshot、evidence、deliveryCommit、userAcceptance、specification。已有 history 必须保留为前缀；原报告按旧摘要验证，返工使用新的报告路径，不能覆盖历史文件。

## 交付

node scripts/check-tasks.mjs --snapshot 任务编号 输出产物内容快照；它只生成摘要，不证明测试通过。self_checked 要求实际自检报告，reviewed 还需独立审核，tested 再需独立测试。

各 evidence.self/review/test 保存 result、digest、agentId、report、reportDigest、command、environment、recordedAt。源码新增、修改、删除和报告变更使证据失效。UTF-8 文本仅规范化 BOM／CRLF，二进制按字节计算。

node scripts/check-tasks.mjs --delivery 任务编号 强制要求当前版本三类证据，审核、测试不能与实现人或彼此相同。accepted 还需实际 deliveryCommit 与 userAcceptance.record/digest；历史交付按不可变提交验证，不授权之后的新修改。自动校验记录一致性不等于证明用户真实批准或独立人员真实执行。

## CI 生效

[工作流](../../.github/workflows/verify.yml)在 Windows 上安装 Node 22、Java 21 和锁定的 NPM 依赖，执行统一检查并归档日志。需要在实际仓库启用，随后将 Project verification 设为目标分支必需检查，配置独立审查并验证失败 PR 确实不能合并。不要把本地工作流文件当作远端保护已生效。

OpenAPI 发布兼容检查、真实 MySQL 用例、微信真机和业务验收按阶段与实际承诺安排；基础构建不会替代这些验证。
