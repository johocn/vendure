import { ShippingEligibilityChecker } from '@vendure/core';
/**
 * 结算拦截：逐店校验配送范围（circle/district/all），任一店不可达即视为该 ShippingMethod 不适用
 * （结算不展示该方式，报价阶段即拦截）。每次求值都从 DB 读取最新配送范围，故不定义 shouldRunCheck
 * （Vendure 会缓存 shouldRunCheck 返回值，而 range 由 admin 外部修改，缓存会导致旧判定复用）。
 * 未设置收件区码/经纬度 → 直接放行（让常规流程执行）。
 */
export declare const rangeShippingEligibilityChecker: ShippingEligibilityChecker<{}>;
