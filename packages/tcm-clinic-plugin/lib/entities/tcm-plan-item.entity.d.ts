import { DeepPartial, VendureEntity } from '@vendure/core';
export declare class TcmPlanItem extends VendureEntity {
    constructor(input?: DeepPartial<TcmPlanItem>);
    planId: number;
    title: string;
    /** 频次描述，如“每周二/四”“每晚” */
    frequency?: string;
    /** 关联商城服务商品（不建外键） */
    productVariantId?: number;
    /** 患者下单后回填（不建外键） */
    orderId?: number;
}
