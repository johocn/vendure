import { DeepPartial, VendureEntity } from '@vendure/core';
export declare class TcmClinic extends VendureEntity {
    constructor(input?: DeepPartial<TcmClinic>);
    name: string;
    /** 医疗机构执业备案号 */
    licenseNo: string;
    address?: string;
    /** enabled | disabled */
    status: string;
}
