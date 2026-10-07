import { Column, Entity } from 'typeorm';
import { DeepPartial, ID, VendureEntity } from '@vendure/core';

@Entity()
export class CampusFulfillmentConfig extends VendureEntity {
    [key: string]: any;
    @Column('int', { unique: true }) channelId: ID;
    @Column({ type: 'simple-json', default: '["R1","R3","R4","R5"]' })
    routesEnabled: string[];
    @Column({ type: 'int', default: 100 }) riderCommissionRate: number; // 百分比
    @Column({ type: 'int', default: 10 }) autoAssignMinutes: number;
    @Column({ default: false }) paused: boolean; // 运力暂停开关
    @Column({ type: 'int', default: 30 }) autoRefundMinutes: number; // T4 终态
    @Column({ type: 'int', default: 45 }) inProgressSlaMinutes: number; // T3 SLA 告警
    @Column({ type: 'varchar', nullable: true }) compensationCouponTemplateId: string; // T4 补偿券模板
    @Column({ type: 'int', nullable: true }) deliveryMinutes: number | null; // 配送时长（分钟）
    @Column({ type: 'int', nullable: true }) minOrderAmount: number | null; // 起送价（分）
    @Column({ type: 'int', nullable: true }) deliveryFee: number | null; // 配送费（分，本期仅展示）
    @Column({ type: 'varchar', nullable: true }) storeAddress: string | null; // 自提地址
    @Column({ type: 'varchar', nullable: true }) storePhone: string | null; // 联系电话
    @Column({ type: 'varchar', nullable: true }) storeNotice: string | null; // 店铺公告
    @Column({ type: 'int', nullable: true }) errandBaseFee: number | null; // R5 跑腿起步价（分；null=默认 200）
    @Column({ type: 'int', nullable: true }) freeShippingThreshold: number | null; // 满 X 元免配送费（分；null=不启用，仅 R1/R3 外卖单）
    @Column({ default: false }) merchantConfirmEnabled: boolean; // 商家接单确认模式：支付后先待商家接单，出餐完成才入大厅
    @Column({ type: 'int', default: 15 }) merchantAutoOpenMinutes: number; // 商家未处理（待接单/备餐中）超时自动入厅，防卡单
    // 用户侧节点通知（公众号模板消息）：五个触点的模板 ID，未配置 = 该节点静默跳过
    @Column({ type: 'varchar', nullable: true }) notifyTemplateAccepted: string | null; // 商家已接单
    @Column({ type: 'varchar', nullable: true }) notifyTemplateRiderAssigned: string | null; // 骑手已接单
    @Column({ type: 'varchar', nullable: true }) notifyTemplateCookingDone: string | null; // 出餐完成
    @Column({ type: 'varchar', nullable: true }) notifyTemplateDelivered: string | null; // 已送达
    @Column({ type: 'varchar', nullable: true }) notifyTemplateExceptionHandled: string | null; // 异常处置完结
    // 订单域通知（spec §4.1）：4 个模板 ID + H5 落地页域名（禁硬编码域名，per-channel 配置）
    @Column({ type: 'varchar', nullable: true }) notifyTemplateOrderPlaced: string | null; // 下单成功
    @Column({ type: 'varchar', nullable: true }) notifyTemplatePaymentPending: string | null; // 待付款提醒
    @Column({ type: 'varchar', nullable: true }) notifyTemplateCancelled: string | null; // 取消通知
    @Column({ type: 'varchar', nullable: true }) notifyTemplateAfterSales: string | null; // 售后进度
    @Column({ type: 'varchar', nullable: true }) h5BaseUrl: string | null; // C 端 H5 站点 origin，如 https://www.yourbao.cn
    constructor(input?: DeepPartial<CampusFulfillmentConfig>) {
        super(input);
    }
}
