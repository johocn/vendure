import { DeepPartial, VendureEntity } from '@vendure/core';
/**
 * 江湖事件（方向二多人拼图 / 方向三剧本母版）。
 * collected 由运营或脚本更新；参与者均分 rewardPoolRep。
 */
export declare class JianghuEvent extends VendureEntity {
    [key: string]: any;
    constructor(input?: DeepPartial<JianghuEvent>);
    name: string;
    desc: string;
    /** 线索总数 */
    total: number;
    /** 已收集数 */
    collected: number;
    /** 单人最多贡献条数 */
    perPersonLimit: number;
    endAt: string | null;
    rewardPoolRep: number | null;
}
