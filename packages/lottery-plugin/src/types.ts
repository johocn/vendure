/** 奖品分页查询参数（admin 端）。 */
export interface LotteryPrizeListOptions {
    skip?: number;
    take?: number;
}

/** 抽奖记录分页查询参数（shop/admin 端通用）。 */
export interface LotteryRecordListOptions {
    skip?: number;
    take?: number;
}

export interface CreateLotteryPrizeInput {
    name: string;
    image?: string | null;
    /** 中奖权重（相对值；<=0 不参与开奖） */
    weight: number;
    /** 每次抽中该奖项消耗的积分（不是分） */
    consume: number;
    /** 剩余库存；null/缺省 = 不限量 */
    stock?: number | null;
    enabled?: boolean;
    sort?: number;
}

export interface UpdateLotteryPrizeInput {
    id: string;
    name?: string;
    image?: string | null;
    weight?: number;
    consume?: number;
    stock?: number | null;
    enabled?: boolean;
    sort?: number;
}

/** 服务端开奖结果：prizeIndex 为奖品在 myLotteryPrizes 返回顺序（sort ASC/id ASC）下的数组下标。 */
export interface LotteryDrawResult {
    prizeIndex: number;
    prize: import('./lottery-prize.entity').LotteryPrize;
}
