import { RequestContext } from '@vendure/core';
import { CouponTemplate } from './coupon-template.entity';
/**
 * CouponTemplate 输出字段的本地化解析。
 *
 * `name`/`description`（LocalizedText，DB 内可能是纯字符串或 JSON 字符串/对象）按当前会话
 * 语言 `ctx.languageCode` 经 `localizeText()` 求值后输出，保证 GraphQL 端 `name` 即为当前语言文案，
 * 既有纯字符串数据原样透传（向后兼容）。field resolver 在 admin 与 shop 两套 schema 均注册，
 * 一处实现即可覆盖 couponCentre / myCoupons(template) / pointsMallTemplates / couponTemplates 等所有入口。
 */
export declare class CouponTemplateResolver {
    name(template: CouponTemplate, ctx: RequestContext): string;
    description(template: CouponTemplate, ctx: RequestContext): string | null;
}
