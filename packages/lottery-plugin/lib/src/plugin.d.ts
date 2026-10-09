import { Type } from '@nestjs/common';
/**
 * 九宫格积分抽奖（usemall F20 对齐）：
 * - 后台配置奖品（名称/图片/权重/消耗积分/库存），服务端加权开奖返回 prizeIndex；
 * - 每次抽中按奖品 consume 经 MemberLevelService.spendPoints 桥扣积分（软依赖，需与 MemberLevelPlugin 同容器）。
 */
export declare class LotteryPlugin {
    static init(): Type<LotteryPlugin>;
}
