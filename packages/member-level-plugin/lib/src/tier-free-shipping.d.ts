import { ShippingCalculator, ShippingEligibilityChecker } from '@vendure/core';
/**
 * 会员等级免运费门槛 checker。
 * 判定条件（写入 check，勿用 shouldRunCheck 缓存——等级随顾客成长值/渠道配置外部变化）：
 * 1. channel.freeShippingLevel > 0 才启用；否则不适用（返回 false）。
 * 2. 当前顾客档位 tierLevel >= channel.freeShippingLevel 即该方式适用。
 * 不适用（未启用 / 等级不足 / 无 customer）返回 false → 结算不展示该运费方式 → calculator 不执行。
 */
export declare const tierFreeShippingEligibilityChecker: ShippingEligibilityChecker<{}>;
/**
 * 会员等级免运费 calculator：报价 0 元（含税）。
 * 仅当勾选该 calculator 的运费方式被选中（checker 通过）时计算，返回 0 即免运费。
 */
export declare const tierFreeShippingCalculator: ShippingCalculator<{}>;
