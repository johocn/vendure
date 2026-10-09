import { DeepPartial, VendureEntity } from '@vendure/core';
export declare class TcmPatientProfile extends VendureEntity {
    constructor(input?: DeepPartial<TcmPatientProfile>);
    /** 引用 Customer.id，不建外键；一名患者（SSO 用户）一份档案 */
    customerId: number;
    /** 建档案馆 */
    clinicId: number;
    /** 体质辨识等结构化结果 */
    constitution?: Record<string, any>;
}
