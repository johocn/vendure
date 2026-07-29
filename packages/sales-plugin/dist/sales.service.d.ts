import { AdministratorService, CustomerService, ID, Order, OrderService, RequestContext, TransactionalConnection } from '@vendure/core';
export declare class SalesOrderLineInput {
    productVariantId: string;
    quantity: number;
    overwrittenPrice?: number;
}
export declare class NewCustomerInput {
    firstName: string;
    lastName: string;
    emailAddress?: string;
    phoneNumber: string;
    customerType: string;
    companyInfo?: any;
}
export declare class SalesCreateOrderInput {
    customerId?: string;
    newCustomer?: NewCustomerInput;
    lines: SalesOrderLineInput[];
    shippingAddress: any;
    shippingMethodId: string;
    salesChannel: string;
    note?: string;
}
export declare class SalesReportTopProduct {
    productVariantId: string;
    name: string;
    quantitySold: number;
    revenue: number;
}
export declare class SalesReportDaily {
    date: string;
    orderCount: number;
    revenue: number;
}
export declare class SalesReportResult {
    totalOrders: number;
    totalRevenue: number;
    uniqueCustomers: number;
    avgOrderValue: number;
    topProducts: SalesReportTopProduct[];
    dailyBreakdown: SalesReportDaily[];
}
export declare class SalesService {
    private connection;
    private orderService;
    private customerService;
    private administratorService;
    constructor(connection: TransactionalConnection, orderService: OrderService, customerService: CustomerService, administratorService: AdministratorService);
    /**
     * 销售开单：单事务完成建客户+加商品行+设地址+设配送+写 salesStaffId
     */
    createOrder(ctx: RequestContext, input: SalesCreateOrderInput): Promise<Order>;
    /**
     * 查询我的销售单（按 salesStaffId 过滤）
     */
    findMySales(ctx: RequestContext, options?: {
        page?: number;
        pageSize?: number;
        state?: string;
    }): Promise<{
        items: Order[];
        totalItems: number;
    }>;
    /**
     * 查询全部销售单（manager+）
     */
    findAllSales(ctx: RequestContext, options?: {
        page?: number;
        pageSize?: number;
        state?: string;
        staffId?: string;
    }): Promise<{
        items: Order[];
        totalItems: number;
    }>;
    /**
     * 修改订单行价格
     */
    modifyOrderLinePrice(ctx: RequestContext, orderLineId: ID, newPrice: number): Promise<Order>;
    /**
     * 取消订单（仅 AddingItems 状态）
     */
    cancelOrder(ctx: RequestContext, orderId: ID, reason?: string): Promise<Order>;
    /**
     * 生成业绩报表
     */
    buildReport(ctx: RequestContext, staffId: string | undefined, range: {
        start: Date;
        end: Date;
    }): Promise<SalesReportResult>;
}
