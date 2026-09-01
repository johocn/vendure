import { RequestContext } from '@vendure/core';

/**
 * 默认商城（默认渠道）判定。
 *
 * 实测（本仓库 @vendure/testing）：
 *  - 生产默认商城 Channel 默认 token 通常是 `__default__`（若未显式配置 defaultChannelToken 则为随机生成）；
 *  - coupon-plugin e2e 走 @vendure/testing 的 testConfig，其中 `defaultChannelToken = 'e2e-default-channel'`，
 *    而默认渠道的 `code` 固定为 `DEFAULT_CHANNEL_CODE = '__default_channel__'`。
 * 因此这里以「默认渠道 code 或 token 二者其一命中」即视为默认商城，保证生产与测试判据一致。
 */
export function isDefaultMallChannel(ctx: RequestContext): boolean {
    const token = String((ctx.channel as any)?.token ?? '');
    const code = String((ctx.channel as any)?.code ?? '');
    return token === '__default__' || code === '__default_channel__';
}

/**
 * 本店商品行判据（沿用 pickup-plugin / shop-plugin 的 orderLineHasShop 语义）：
 * 行商品 Product.customFields.shopId === 指定 shopId。
 * 当券没有发行 shopId（平台级券）时视为不限定，任何行都算本店行。
 */
export function lineHasShopId(line: any, shopId: number | undefined): boolean {
    if (shopId == null) return true;
    const sid = (line?.productVariant?.product?.customFields ?? {})?.shopId;
    return sid != null && Number(sid) === shopId;
}