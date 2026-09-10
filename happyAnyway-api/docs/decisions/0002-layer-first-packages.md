# 0002：按层级组织后端

状态：已采纳。

用户确定层级为主，各层内部按模块划分，数据访问层命名 mapper。

采用 controller/service/mapper/entity/dto，加 config/security/common，替代此前模块优先的分层建议。各层职责集中，同一业务文件分散，使用统一模块名保持可定位性。

建立空层目录并更新文档和 ArchUnit，不创建未经确定的业务模块。跨模块自动约束待模块明确后细化。
