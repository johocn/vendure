import { Column, Entity } from 'typeorm';
import { DeepPartial, VendureEntity } from '@vendure/core';

/**
 * 全局共享余额钱包
 *
 * **全局唯一共享账户**：所有租户 / 所有档案合单共用同一个余额，总合并清算。
 * 表中仅维护一行（全局只有这一份余额）。跨租户、跨档案的余额支付统一从此扣减。
 *
 * `createdAt` / `updatedAt` 由 VendureEntity 基类提供（CreateDateColumn / UpdateDateColumn）。
 */
@Entity()
export class Wallet extends VendureEntity {
    constructor(input?: DeepPartial<Wallet>) {
        super(input);
    }

    /** 当前余额（分）。Money 语义，int 列存储。 */
    @Column({ type: 'int', default: 0 })
    balance: number;

    /** 币种（如 CNY / USD）。全局共享钱包的单一币种。 */
    @Column({ nullable: true })
    currencyCode: string;
}