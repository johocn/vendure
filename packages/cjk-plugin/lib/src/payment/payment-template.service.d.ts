import { ConfigService, ID, PaginatedList, ListQueryOptions, PaymentMethodService, RequestContext, TransactionalConnection } from '@vendure/core';
import { PaymentTemplate } from './payment-template.entity';
export declare class PaymentTemplateService {
    private connection;
    private paymentMethodService;
    private configService;
    constructor(connection: TransactionalConnection, paymentMethodService: PaymentMethodService, configService: ConfigService);
    /**
     * 查询模板列表（可见规则：全局模板 + 本租户模板）
     */
    findAll(ctx: RequestContext, options?: ListQueryOptions<PaymentTemplate>): Promise<PaginatedList<PaymentTemplate>>;
    /**
     * 查询单个模板
     */
    findOne(ctx: RequestContext, id: ID): Promise<PaymentTemplate | undefined>;
    /**
     * 创建模板
     * - 超级管理员：isGlobal=true，ownerChannelId=null
     * - 租户管理员：isGlobal=false，ownerChannelId=当前channelId
     */
    create(ctx: RequestContext, input: any): Promise<PaymentTemplate>;
    /**
     * 更新模板（租户只能更新自己的模板，不能更新全局模板）
     */
    update(ctx: RequestContext, input: any): Promise<PaymentTemplate>;
    /**
     * 删除模板（租户只能删除自己的模板，不能删除全局模板）
     */
    delete(ctx: RequestContext, id: ID): Promise<void>;
    /**
     * 从模板创建支付方式（绑定到当前 Channel）
     * 租户可覆盖名称，否则使用模板名称
     */
    createPaymentMethodFromTemplate(ctx: RequestContext, templateId: ID, nameOverride?: string, codeOverride?: string): Promise<any>;
}
