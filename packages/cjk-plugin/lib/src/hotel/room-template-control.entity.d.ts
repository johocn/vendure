import { VendureEntity } from '@vendure/core';
/**
 * 记录模板删除行为，配合 seed 幂等：客户删除过的房型 code，重启不再补回。
 * 纯内部表，不暴露任何 GraphQL 接口。
 */
export declare class RoomTemplateControl extends VendureEntity {
    constructor(input?: any);
    code: string;
    deleted: boolean;
}
