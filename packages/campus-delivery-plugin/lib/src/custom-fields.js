"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.campusCustomFields = void 0;
exports.campusCustomFields = {
    Order: [
        { name: 'fulfillmentRoute', type: 'string', nullable: true }, // R1..R5
        { name: 'orderKind', type: 'string', nullable: true, defaultValue: 'normal' },
        { name: 'buildingId', type: 'string', nullable: true },
        { name: 'campusZone', type: 'string', nullable: true },
        { name: 'deliveryDetail', type: 'string', nullable: true }, // 改址后的门牌/详细地址（覆盖下单地址展示）
        { name: 'hallStatus', type: 'string', nullable: true }, // open/grabbed
        { name: 'hallEnteredAt', type: 'datetime', nullable: true },
        { name: 'riderEarning', type: 'int', nullable: true },
        { name: 'tip', type: 'int', nullable: true },
        { name: 'deliverySlotId', type: 'string', nullable: true }, // ID 存 string，与 customFields 类型系统一致
        { name: 'deliverySlotText', type: 'string', nullable: true }, // '2026-10-06 11:00-11:30'
        { name: 'errandKind', type: 'string', nullable: true }, // pickup_express / bring_food / buy / other
        { name: 'errandFrom', type: 'string', nullable: true },
        { name: 'errandTo', type: 'string', nullable: true },
        { name: 'errandNote', type: 'string', nullable: true }, // 跑腿物品描述/要求
        { name: 'leg1Status', type: 'string', nullable: true }, // R2: preparing / arrived_gate
        { name: 'handoverAt', type: 'datetime', nullable: true }, // R2 到校时间
        { name: 'campusCause', type: 'string', nullable: true }, // 对账标记: slot_full / no_rider
        { name: 'transferPhotos', type: 'string', list: true, nullable: true }, // 已取货转单拍照交接存证
        { name: 'transferNote', type: 'string', nullable: true },
        { name: 'transferAt', type: 'datetime', nullable: true },
        { name: 'riderLat', type: 'float', nullable: true }, // 骑手实时位置（gcj02），仅配送中写入，送达/转单清除
        { name: 'riderLng', type: 'float', nullable: true },
        { name: 'urged', type: 'boolean', nullable: true, defaultValue: false }, // 用户催单标记（plan 2.4）
        { name: 'urgedAt', type: 'datetime', nullable: true }, // 最近一次催单时间，10min 内禁止重复催
        { name: 'scheduledFor', type: 'datetime', nullable: true }, // 预约送达锚点=时段开始时间（plan 3.1），调度 job 到点前 30min 放量入厅
        { name: 'exceptionAction', type: 'string', nullable: true }, // 异常处置动作（plan 3.4）: reassign / refund_diff / coupon / refund_all
        { name: 'exceptionCompensation', type: 'int', nullable: true }, // 退差价金额（分）
        { name: 'exceptionCouponTemplateId', type: 'string', nullable: true }, // 补偿券模板 ID
        { name: 'exceptionHandledNote', type: 'string', nullable: true }, // 处置备注
        { name: 'exceptionHandledAt', type: 'datetime', nullable: true }, // 处置时间
        { name: 'exceptionHandledBy', type: 'string', nullable: true }, // 处置人（admin userId）
        { name: 'routeGroupId', type: 'string', nullable: true }, // 多单顺路路线组（plan 3.3）：同楼栋+同时段打包，整组抢单
        { name: 'invoiceApplied', type: 'boolean', nullable: true, defaultValue: false }, // 开票申请幂等闸（个人中心 spec §4）
        { name: 'invoiceInfo', type: 'string', nullable: true }, // 开票申请快照 JSON：{titleName,titleType,taxNo,email,appliedAt}
        { name: 'waimaiPrintedAt', type: 'datetime', nullable: true }, // 商家小票最近打印时间（防重打 + 补打依据）
        { name: 'note', type: 'string', nullable: true }, // 顾客整单备注（C 端下单填写，≤200 字，工作台展示 + 小票打印）
        { name: 'tablewareCount', type: 'int', nullable: true }, // 顾客餐具份数，0=无需餐具，null=未选择
        // 履约快照（下单固化，后台改配置不影响在途单）
        { name: 'deliveryPlan', type: 'string', nullable: true }, // merchant/owned/external_courier/campus_rider/self_pickup
        { name: 'handoverMode', type: 'string', nullable: true }, // to_campus_rider / direct_to_user
        { name: 'thirdPartyProvider', type: 'string', nullable: true }, // dada / meituan（运营中心派单时确定）
        { name: 'thirdPartyDeliveryOrderId', type: 'string', nullable: true }, // 网关内部单号
        { name: 'thirdPartyNo', type: 'string', nullable: true }, // 外部快递平台单号
        { name: 'thirdPartyState', type: 'string', nullable: true }, // pending/accepted/pickup/delivered/cancelled/exception
        { name: 'thirdPartyCourierName', type: 'string', nullable: true },
        { name: 'thirdPartyCourierPhone', type: 'string', nullable: true },
        { name: 'handoverPointName', type: 'string', nullable: true }, // 校园交接点快照（R1/R2）
        { name: 'handoverPointAddress', type: 'string', nullable: true },
        { name: 'handoverPointLat', type: 'float', nullable: true },
        { name: 'handoverPointLng', type: 'float', nullable: true },
        { name: 'thirdPartyDispatchAt', type: 'datetime', nullable: true }, // 推送外部快递时间
        { name: 'thirdPartySyncAt', type: 'datetime', nullable: true }, // 最近一次轮询对账外部运单时间（限频）
        // 交接码（两段接力防丢餐扯皮）：第一段送达交接点时生成 4 位码，第二段骑手取货时校验
        { name: 'handoverCode', type: 'string', nullable: true },
        { name: 'handoverCodeAt', type: 'datetime', nullable: true },
        // 超时赔付：支付时固化承诺送达时间，送达超时后自动发定向券（幂等闸 + 归因留痕）
        { name: 'promisedAt', type: 'datetime', nullable: true },
        { name: 'promiseSource', type: 'string', nullable: true }, // slot / store_minutes
        { name: 'timeoutCompensatedAt', type: 'datetime', nullable: true },
        { name: 'timeoutCompensationCouponId', type: 'string', nullable: true },
        { name: 'timeoutLateMinutes', type: 'int', nullable: true },
        { name: 'timeoutAttribution', type: 'string', nullable: true }, // merchant / rider / platform
    ],
    Channel: [
        { name: 'waimaiTags', type: 'string', nullable: true }, // '米饭快餐,夜宵' 逗号分隔
        { name: 'waimaiMonthlySales', type: 'int', nullable: true },
        { name: 'waimaiLogo', type: 'string', nullable: true },
        { name: 'waimaiPromoText', type: 'string', nullable: true }, // 满减 tag 文案，如 '满20减4'（spec §12.2 增补）
        { name: 'waimaiBusinessHours', type: 'string', nullable: true }, // 店铺营业时间文案，如 10:00-22:00；C 端店铺页展示
    ],
    Product: [
        { name: 'waimaiMonthlySales', type: 'int', nullable: true }, // 商品月销量，C 端菜单排序用，未设置按 0
    ],
    Customer: [
        { name: 'riderStatus', type: 'string', nullable: true }, // none/pending/approved/suspended
        { name: 'riderRealName', type: 'string', nullable: true },
        { name: 'riderStudentNo', type: 'string', nullable: true },
        { name: 'riderCampus', type: 'string', nullable: true },
        { name: 'riderIdImg', type: 'string', nullable: true },
        { name: 'riderCredit', type: 'int', nullable: true, defaultValue: 100 },
        { name: 'riderOnlineAt', type: 'datetime', nullable: true }, // 心跳时间戳，「在线」= approved && 5min 内有心跳
        { name: 'avatarUrl', type: 'string', nullable: true }, // 头像 URL（uploadCustomerAsset 产物）
        { name: 'invoiceTitles', type: 'string', nullable: true }, // 发票抬头列表 JSON（≤5 条，spec §3.2）
    ],
    Address: [
        { name: 'zoneId', type: 'string', nullable: true }, // 校园分区 ID（campusZones 引用）
        { name: 'buildingId', type: 'string', nullable: true }, // 宿舍楼 ID（campusBuildings 引用）
        { name: 'route', type: 'string', nullable: true }, // 路线快照 R1..R5（备用）
    ],
};
//# sourceMappingURL=custom-fields.js.map