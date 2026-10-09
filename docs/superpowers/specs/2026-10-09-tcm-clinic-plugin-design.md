# tcm-clinic-plugin 设计规格（中医馆合规档案与康养规划）

日期：2026-10-09 ｜ 状态：已评审通过（方案 A）

## 1. 背景与目标

依据国家对中医馆的管理规定，需要存储并管理：**病志**、**诊疗过程**，并提供**康养规划中心**与**健康康养护理规划**能力。

需求画像（已与用户确认）：

- 业务独立于商城，但**用户体系共用 zhao-sso**（患者 = 商城 Customer 映射）
- **连锁多馆**：数据模型内置馆（Clinic）维度，医生按馆分权，患者跨馆共享一份档案
- 合规深度：**基础合规 + 预留升级**（结构化存储、修改留痕、长期保存、权限管控；表结构预留电子签名/CA 字段）
- 康养规划中心四能力全要：患者端档案与计划、医生端随访管理、关联商品与预约、运营统计看板
- 医生工作台：**移动/平板优先**

## 2. 承载方案评估结论

| 方案 | 结论 | 关键理由 |
|---|---|---|
| A. Vendure 插件（选定） | 推荐 | 商品/预约/订单/SSO/角色同库直连，复用最多、开发量最小、零新增运维 |
| B. Strapi 插件 | 备选 | 数据隔离好，但预约下单核销跨系统对账、租户与统计需自建，+1 实例 |
| C. 独立项目（NestJS） | 远期 | 边界最干净、可接 HIS/医保，但轮子全部重造，+1 服务 |

方案 A 的合规短板（敏感数据与电商同库）以**自包含 schema + 加密 + 审计 + 可整体迁出**缓解：所有 `tcm_*` 表只存外部 ID（不建跨域外键），未来若监管要求物理隔离，schema 可原样迁出独立库/服务，API 契约与前端不大改。

## 3. 总体架构

- 新增 `tcm-clinic-plugin`，位于 vendure monorepo `packages/`，与既有业务插件同构
- **医生工作台**：独立 uni-app H5（同 strapi-wealth 项目模式），复用 zhao-sso 登录，走 Admin API
- **患者端**：nshop/vshop 商城内新增「康养规划中心」页面组（规划总览 + 就诊档案双页），走 Shop API
- 多馆建模用**独立 Clinic 实体**（不复用 Channel，避免污染电商渠道语义）
- 患者身份：`PatientProfile.customerId` 引用 Vendure Customer；医生：`ClinicStaffMember.administratorId` 引用 Administrator

## 4. 数据模型（三域九实体，全部 `tcm_` 前缀）

临床记录域：
- `PatientProfile` 患者档案：customerId→、clinicId、体质辨识 JSON；跨馆共享一份
- `Encounter` 诊疗过程：patientId、staffId、type（初诊/复诊/上门）、状态机 待接诊→进行中→已完成、乐观锁 version
- `MedicalRecord` 病志（合规核心）：encounterId、chiefComplaint(加密)、diagnosis(加密)、prescription JSON、version、signaturePayload/signatureCert（预留 CA）；**更新不覆盖，旧版整体快照进 `tcm_medical_record_revisions`**

康养规划域：
- `WellnessPlan` 康养规划：patientId、cycleStart/End、状态机 草稿→执行中→暂停→结案
- `PlanItem` 护理计划项：planId、title、frequency、variantId→、orderId→（可关联商城服务商品下单）
- `FollowUpTask` 随访任务：planId/patientId、dueAt、channel（短信/微信）、结果回写 Encounter

基础域：
- `Clinic` 馆：name、licenseNo、address、status
- `ClinicStaffMember` 员工：administratorId、clinicId、role
- `AuditLog` 审计日志：entityType、entityId、staffId、action、diff JSON——所有敏感表 CUD 全量留痕

## 5. 合规设计四件套

1. **修改留痕**：病志/诊疗更新时旧版本快照入 revision 表，AuditLog 记 who/when/diff
2. **保存期限**：`retentionUntil`（门诊病志 ≥15 年），到期自动归档只读，无物理删除接口
3. **敏感字段加密**：主诉/病史/诊断/处方 AES-256-GCM 应用层加密，密钥走环境变量；加密读写失败显式报错、绝不落明文；审计写入与业务操作同事务
4. **预留升级**：电子签名/CA 字段现在建表，未来只加写逻辑

## 6. API 设计（GraphQL）

Admin API（医生）：`clinics`、`clinicStaffs`、`encounters`（创建/流转）、`medicalRecords`（CRUD，更新自动快照）、`wellnessPlans`、`planItems`、`followUpTasks`、`auditLogs`（只读）。按 clinicId 行级过滤。

Shop API（患者）：`myPatientProfile`、`myMedicalRecords`（脱敏摘要）、`myWellnessPlan`、`myPlanItems`（可跳转商品下单）、`myFollowUps`。强制 customerId 归属校验。

预约/下单走现有商城 API，插件不重复造订单；运营统计看板基于同库聚合查询。

## 7. 前端设计（已定稿 mockup）

- **医生工作台 = A/B 混合**：首页用 B 的速查式（今日接诊统计 + 患者列表 + 快捷模板），进入接诊后用 A 的流程式分步录入（问诊→辨证→医嘱→完成，防漏录）
- **患者端双页**：规划总览（体质辨识卡 + 计划打卡进度 + 随访提醒 + 医生建议套餐预约）+ 就诊档案（就诊记录列表 + 诊断摘要脱敏展示）
- 两端遵循模板规范：i18n 多语言（zh-CN/en-US 同步补词条）、动态 origin 静态资源

## 8. 异常与边界

- Encounter 状态机乐观锁，重复接诊拒绝
- 归档期内记录只读
- 加密失败显式报错；审计与业务同事务保证一致性

## 9. 测试与交付

1. 插件 e2e：建档→诊疗→病志版本链→康养计划→随访闭环
2. 权限回归：跨馆医生不可见、患者仅见自己数据
3. 手机视口截图（390×844 dpr=2）补充操作手册与测试用例文档
4. 交付 = 实现 + 回归 + 截图 + 文档，一气呵成（提交→推送→部署）
