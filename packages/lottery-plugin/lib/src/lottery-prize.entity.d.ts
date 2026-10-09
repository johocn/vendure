import { DeepPartial, VendureEntity } from '@vendure/core';
export declare class LotteryPrize extends VendureEntity {
    constructor(input?: DeepPartial<LotteryPrize>);
    /** 奖项名（如「谢谢参与」） */
    name: string;
    /** 奖品图 URL */
    image: string | null;
    /** 中奖权重（相对值；<=0 不参与开奖，但仍展示在九宫格） */
    weight: number;
    /** 每次抽中该奖项消耗的积分（不是分） */
    consume: number;
    /** 剩余库存；null = 不限量。库存为 0 的奖品不参与开奖 */
    stock: number | null;
    enabled: boolean;
    sort: number;
    /** null = 全渠道通用 */
    channelId: number | null;
}
