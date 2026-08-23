import { Column, Entity } from 'typeorm';
import { DeepPartial, VendureEntity } from '@vendure/core';

/**
 * 支付档案 × 支付方式 的 join 载荷实体。
 * 存放某一支付方式在某档案下的工作模式（options），如分期：
 * options = { alipay: { huabei: { periods: [...] } } }
 */
@Entity()
export class PaymentProfileMethod extends VendureEntity {
    constructor(input?: DeepPartial<PaymentProfileMethod>) {
        super(input);
    }

    @Column() profileId: string;

    @Column() paymentMethodId: string;

    @Column({ default: 'installment' }) mode: string;

    @Column({ type: 'simple-json', nullable: true })
    options: Record<string, any> | null;
}