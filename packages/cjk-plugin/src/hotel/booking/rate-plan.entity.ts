import { Column, Entity, Index } from 'typeorm';
import { DeepPartial, VendureEntity } from '@vendure/core';

/**
 * 酒店房价方案（P2，房型维度）：
 * - code 行内唯一（unique(productVariantId, code)），下单写入 OrderLine.customFields.ratePlanCode
 * - adjustType：discount（每晚 ×adjustValue/1000）/ fixed（每晚固定价）/ surcharge（每晚 +adjustValue）
 * - adjustValue：discount 存千分比（900 = ×0.9）；fixed/surcharge 存分
 * - memberOnly：会员等级门槛（沿用 vcash-pos myMemberPrice 的会员等级通道，Customer.customFields.memberLevel），
 *   存数字字符串（如 '2' = 达到 2 级及以上可见）；null = 全员可见
 * - dateFrom/dateTo：售卖期（以入住日为准，含两端）；null = 长期有效
 * - cancelPolicyOverride：JSON 字符串 CancelPolicy（{type:'freeUntil'|'nonRefundable', freeUntilHours?}），
 *   P4 取消退款时优先于房型级 hotelRoomConfig.cancelPolicy
 * - name 展示名：纯文本或 LocalizedText JSON 字符串（string | Record<locale,string>），C 端 localizeText 解析
 */
@Entity()
@Index('uk_hotel_rate_plan', ['productVariantId', 'code'], { unique: true })
export class HotelRatePlan extends VendureEntity {
    constructor(input?: DeepPartial<HotelRatePlan>) {
        super(input);
    }

    @Index()
    @Column({ type: 'int' })
    productVariantId: number;

    @Column({ type: 'varchar', length: 64 })
    code: string;

    @Column({ type: 'varchar', length: 255 })
    name: string;

    @Column({ type: 'varchar', length: 16 })
    adjustType: 'discount' | 'fixed' | 'surcharge';

    @Column({ type: 'int' })
    adjustValue: number;

    @Column({ type: 'varchar', length: 32, nullable: true })
    memberOnly: string | null;

    @Column({ type: 'varchar', length: 10, nullable: true })
    dateFrom: string | null; // YYYY-MM-DD

    @Column({ type: 'varchar', length: 10, nullable: true })
    dateTo: string | null; // YYYY-MM-DD

    @Column({ type: 'varchar', nullable: true })
    cancelPolicyOverride: string | null;

    @Column({ type: 'boolean', default: true })
    enabled: boolean;
}
