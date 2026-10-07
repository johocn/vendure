import { OrderService, RequestContext } from '@vendure/core';
import { DataSource } from 'typeorm';
/**
 * C 端发票轻量闭环（个人中心 spec §3.3/§4）：
 * 对已支付的历史订单写 invoiceApplied/invoiceInfo customFields（Vendure updateOrderCustomFields
 * 只作用于 activeOrder，历史单不可用，故加本 mutation）。幂等：invoiceApplied=true 再调报错。
 * 商家线下人工开票，B 端本期不动。
 * 写路径用 OrderService.updateCustomFields（同 after-sales-plugin 惯例）：裸 repo save 会因
 * Order.discounts getter 缺 lines 关联报 500。
 */
export declare class InvoiceShopResolver {
    private dataSource;
    private orderService;
    constructor(dataSource: DataSource, orderService: OrderService);
    applyOrderInvoice(ctx: RequestContext, orderId: string, invoiceInfo: string): Promise<boolean>;
}
