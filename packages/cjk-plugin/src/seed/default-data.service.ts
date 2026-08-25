import { Injectable } from '@nestjs/common';
import {
    ID,
    LanguageCode,
    Logger,
    PaymentMethodService,
    RequestContext,
    RequestContextService,
    ShippingMethodService,
    TransactionalConnection,
} from '@vendure/core';

import { loggerCtx } from '../constants';
import { PaymentProfile } from '../payment/payment-profile.entity';
import { PaymentProfileService } from '../payment/payment-profile.service';
import { PickupLocation } from '../pickup/pickup-location.entity';
import { ShippingProfile } from '../shipping/shipping-profile.entity';
import { ShippingProfileService } from '../shipping/shipping-profile.service';
import { ShippingTemplate } from '../shipping/shipping-template.entity';
import { ShippingTemplateService } from '../shipping/shipping-template.service';

import { PaymentTemplate } from '../payment/payment-template.entity';
import { PaymentTemplateService } from '../payment/payment-template.service';
import { TenantMember } from '../tenant/tenant-member.entity';
import { OFFICIAL_ROLE_TEMPLATES, RoleTemplate } from '../tenant/role-templates';

export { OFFICIAL_ROLE_TEMPLATES, RoleTemplate };

/**
 * 插件默认数据初始化
 *
 * 商品级配送/支付方案（ShippingProfile/PaymentProfile）建表后为空。
 * 本服务在 onApplicationBootstrap 阶段幂等创建一套全局默认数据，便于快速投入使用：
 * - 自提点（门店）
 * - 门店自提配送方式 + 配送模板 + 配送档案
 * - 门店收银支付方式 + 支付档案
 *
 * 默认数据均为全局档案（isGlobal=true），所有租户共享。
 * 通过 CjkPlugin.options.seedDefaultData = false 可禁用。
 */
@Injectable()
export class DefaultDataService {
    constructor(
        private connection: TransactionalConnection,
        private requestContextService: RequestContextService,
        private shippingMethodService: ShippingMethodService,
        private paymentMethodService: PaymentMethodService,
        private shippingTemplateService: ShippingTemplateService,
        private shippingProfileService: ShippingProfileService,
        private paymentProfileService: PaymentProfileService,
        private paymentTemplateService: PaymentTemplateService,
    ) {}

    /**
     * 幂等创建默认数据。任何单项失败仅记日志，不阻塞应用启动。
     */
    async seed(): Promise<void> {
        try {
            const ctx = await this.requestContextService.create({ apiType: 'admin' });
            Logger.info('开始初始化购物配送/支付默认数据', loggerCtx);
            await this.seedPickupLocation(ctx);
            await this.seedStorePickupMethod(ctx);
            await this.seedStorePickupTemplate(ctx);
            await this.seedStorePickupProfile(ctx);
            await this.seedCashierPaymentMethod(ctx);
            await this.seedCashierPaymentProfile(ctx);
            // 全局方案池：配送模板（自提点/职工自提/同城/邮寄）
            await this.seedPickupPointTemplate(ctx);
            await this.seedEmployeePickupTemplate(ctx);
            await this.seedLocalDeliveryTemplate(ctx);
            await this.seedMailTemplate(ctx);
            // 全局方案池：支付模板（货到付款/余额支付/聚合码）
            await this.seedCashOnDeliveryPaymentTemplate(ctx);
            await this.seedBalancePayPaymentTemplate(ctx);
            await this.seedAggregatePaymentTemplate(ctx);
            await this.seedFixedAggregatePaymentTemplate(ctx);
            // 前 20 个官方自营租户（幂等）
            await this.seedOfficialTenants(ctx);
            Logger.info('购物配送/支付默认数据初始化完成', loggerCtx);
        } catch (e: any) {
            Logger.error(`默认数据初始化失败: ${e.message}`, loggerCtx);
        }
    }

    /** 默认门店自提点 */
    private async seedPickupLocation(ctx: RequestContext): Promise<void> {
        const existing = await this.connection
            .getRepository(ctx, PickupLocation)
            .findOne({ where: { name: DEFAULT_STORE.name } });
        if (existing) return;
        const repo = this.connection.getRepository(ctx, PickupLocation);
        const location = new PickupLocation({
            ...DEFAULT_STORE,
            isPublic: true,
            ownerChannelId: null,
        } as any);
        location.channels = [ctx.channel];
        await repo.save(location);
        Logger.info(`已创建默认自提点: ${DEFAULT_STORE.name}`, loggerCtx);
    }

    /** 门店自提配送方式 */
    private async seedStorePickupMethod(ctx: RequestContext): Promise<void> {
        const existing = await this.connection
            .getRepository(ctx, 'ShippingMethod')
            .findOne({ where: { code: STORE_PICKUP_METHOD_CODE } });
        if (existing) return;
        await this.shippingMethodService.create(ctx, {
            code: STORE_PICKUP_METHOD_CODE,
            fulfillmentHandler: 'store-pickup',
            checker: { code: 'store-pickup-eligibility', arguments: [] },
            calculator: { code: 'store-pickup-calculator', arguments: [] },
            translations: [
                { languageCode: LanguageCode.zh_Hans, name: '门店自提', description: '到指定门店自提商品' },
                { languageCode: LanguageCode.en, name: 'Store Pickup', description: 'Pick up at the store' },
            ],
        } as any);
        Logger.info(`已创建默认配送方式: ${STORE_PICKUP_METHOD_CODE}`, loggerCtx);
    }

    /** 门店自提配送模板 */
    private async seedStorePickupTemplate(ctx: RequestContext): Promise<void> {
        const existing = await this.connection
            .getRepository(ctx, ShippingTemplate)
            .findOne({ where: { code: STORE_PICKUP_TEMPLATE_CODE } });
        if (existing) return;
        await this.shippingTemplateService.create(ctx, {
            name: '门店自提模板',
            description: '到指定门店自提',
            code: STORE_PICKUP_TEMPLATE_CODE,
            fulfillmentHandler: 'store-pickup',
            checker: { code: 'store-pickup-eligibility', arguments: [] },
            calculator: { code: 'store-pickup-calculator', arguments: [] },
            isGlobal: true,
        } as any);
        Logger.info(`已创建默认配送模板: ${STORE_PICKUP_TEMPLATE_CODE}`, loggerCtx);
    }

    /** 门店自提配送档案（关联配送方式 + 自提点） */
    private async seedStorePickupProfile(ctx: RequestContext): Promise<void> {
        const existing = await this.shippingProfileService.findByCode(ctx, STORE_PICKUP_PROFILE_CODE);
        if (existing) return;
        const method = await this.connection
            .getRepository(ctx, 'ShippingMethod')
            .findOne({ where: { code: STORE_PICKUP_METHOD_CODE } });
        const location = await this.connection
            .getRepository(ctx, PickupLocation)
            .findOne({ where: { name: DEFAULT_STORE.name } });
        if (!method) {
            Logger.warn(`配送方式 ${STORE_PICKUP_METHOD_CODE} 不存在，跳过配送档案`, loggerCtx);
            return;
        }
        await this.shippingProfileService.create(ctx, {
            name: '门店自提配送档案',
            description: '到指定门店自提',
            code: STORE_PICKUP_PROFILE_CODE,
            isGlobal: true,
            shippingMethodIds: [method.id],
            pickupLocationIds: location ? [location.id] : [],
        } as any);
        Logger.info(`已创建默认配送档案: ${STORE_PICKUP_PROFILE_CODE}`, loggerCtx);
    }

    /** 门店收银支付方式（货到付款处理器） */
    private async seedCashierPaymentMethod(ctx: RequestContext): Promise<void> {
        const existing = await this.connection
            .getRepository(ctx, 'PaymentMethod')
            .findOne({ where: { code: CASHIER_PAYMENT_METHOD_CODE } });
        if (existing) return;
        await this.paymentMethodService.create(ctx, {
            code: CASHIER_PAYMENT_METHOD_CODE,
            enabled: true,
            handler: { code: 'cash-on-delivery', arguments: [] },
            translations: [
                { languageCode: LanguageCode.zh_Hans, name: '门店收银', description: '到店扫码/收银台支付' },
                { languageCode: LanguageCode.en, name: 'Store Cashier', description: 'Pay at the store cashier' },
            ],
        } as any);
        Logger.info(`已创建默认支付方式: ${CASHIER_PAYMENT_METHOD_CODE}`, loggerCtx);
    }

    /** 门店收银支付档案 */
    private async seedCashierPaymentProfile(ctx: RequestContext): Promise<void> {
        const existing = await this.paymentProfileService.findByCode(ctx, CASHIER_PAYMENT_PROFILE_CODE);
        if (existing) return;
        const method = await this.connection
            .getRepository(ctx, 'PaymentMethod')
            .findOne({ where: { code: CASHIER_PAYMENT_METHOD_CODE } });
        if (!method) {
            Logger.warn(`支付方式 ${CASHIER_PAYMENT_METHOD_CODE} 不存在，跳过支付档案`, loggerCtx);
            return;
        }
        await this.paymentProfileService.create(ctx, {
            name: '门店收银支付档案',
            description: '到店收银台支付',
            code: CASHIER_PAYMENT_PROFILE_CODE,
            isGlobal: true,
            paymentMethodIds: [method.id],
        } as any);
        Logger.info(`已创建默认支付档案: ${CASHIER_PAYMENT_PROFILE_CODE}`, loggerCtx);
    }

    /** 自提点配送全局模板（固定运费，租户引用后在实例上配 shippingPrice） */
    private async seedPickupPointTemplate(ctx: RequestContext): Promise<void> {
        if (await this.shippingTemplateExists(ctx, PICKUP_POINT_TEMPLATE_CODE)) return;
        await this.shippingTemplateService.create(ctx, {
            name: '自提点配送',
            description: '到指定自提点取货，固定运费',
            code: PICKUP_POINT_TEMPLATE_CODE,
            fulfillmentHandler: 'pickup-point',
            checker: { code: 'pickup-point-eligibility', arguments: [] },
            calculator: { code: 'pickup-point-calculator', arguments: [] },
            isGlobal: true,
        } as any);
        Logger.info(`已创建默认配送模板: ${PICKUP_POINT_TEMPLATE_CODE}`, loggerCtx);
    }

    /** 职工单位自提配送全局模板（固定运费） */
    private async seedEmployeePickupTemplate(ctx: RequestContext): Promise<void> {
        if (await this.shippingTemplateExists(ctx, EMPLOYEE_PICKUP_TEMPLATE_CODE)) return;
        await this.shippingTemplateService.create(ctx, {
            name: '职工单位自提',
            description: '送达职工单位自提点，固定运费',
            code: EMPLOYEE_PICKUP_TEMPLATE_CODE,
            fulfillmentHandler: 'employee-pickup',
            checker: { code: 'employee-pickup-eligibility', arguments: [] },
            calculator: { code: 'employee-pickup-calculator', arguments: [] },
            isGlobal: true,
        } as any);
        Logger.info(`已创建默认配送模板: ${EMPLOYEE_PICKUP_TEMPLATE_CODE}`, loggerCtx);
    }

    /** 同城快递配送全局模板（固定运费） */
    private async seedLocalDeliveryTemplate(ctx: RequestContext): Promise<void> {
        if (await this.shippingTemplateExists(ctx, LOCAL_DELIVERY_TEMPLATE_CODE)) return;
        await this.shippingTemplateService.create(ctx, {
            name: '同城快递',
            description: '同城当日/次日达，固定运费',
            code: LOCAL_DELIVERY_TEMPLATE_CODE,
            fulfillmentHandler: 'manual-fulfillment',
            checker: { code: 'tiered-shipping-eligibility-checker', arguments: [] },
            calculator: { code: 'local-delivery-calculator', arguments: [] },
            isGlobal: true,
        } as any);
        Logger.info(`已创建默认配送模板: ${LOCAL_DELIVERY_TEMPLATE_CODE}`, loggerCtx);
    }

    /** 邮寄配送全局模板（阶梯重量/件数计费） */
    private async seedMailTemplate(ctx: RequestContext): Promise<void> {
        if (await this.shippingTemplateExists(ctx, MAIL_TEMPLATE_CODE)) return;
        await this.shippingTemplateService.create(ctx, {
            name: '邮寄配送',
            description: '全国邮寄，按重量/件数阶梯计费',
            code: MAIL_TEMPLATE_CODE,
            fulfillmentHandler: 'manual-fulfillment',
            checker: { code: 'tiered-shipping-eligibility-checker', arguments: [] },
            calculator: { code: 'tiered-weight-shipping-calculator', arguments: [] },
            isGlobal: true,
        } as any);
        Logger.info(`已创建默认配送模板: ${MAIL_TEMPLATE_CODE}`, loggerCtx);
    }

    private async shippingTemplateExists(ctx: RequestContext, code: string): Promise<boolean> {
        const t = await this.connection
            .getRepository(ctx, ShippingTemplate)
            .findOne({ where: { code } });
        return !!t;
    }

    /** 货到付款支付全局模板 */
    private async seedCashOnDeliveryPaymentTemplate(ctx: RequestContext): Promise<void> {
        if (await this.paymentTemplateExists(ctx, COD_PAYMENT_TEMPLATE_CODE)) return;
        await this.paymentTemplateService.create(ctx, {
            name: '货到付款',
            description: '货到验货后付款',
            code: COD_PAYMENT_TEMPLATE_CODE,
            handler: { code: 'cash-on-delivery', arguments: [] },
            isGlobal: true,
        } as any);
        Logger.info(`已创建默认支付模板: ${COD_PAYMENT_TEMPLATE_CODE}`, loggerCtx);
    }

    /** 余额支付全局模板 */
    private async seedBalancePayPaymentTemplate(ctx: RequestContext): Promise<void> {
        if (await this.paymentTemplateExists(ctx, BALANCE_PAY_TEMPLATE_CODE)) return;
        await this.paymentTemplateService.create(ctx, {
            name: '余额支付',
            description: '使用账户余额支付',
            code: BALANCE_PAY_TEMPLATE_CODE,
            handler: { code: 'balance-pay', arguments: [] },
            isGlobal: true,
        } as any);
        Logger.info(`已创建默认支付模板: ${BALANCE_PAY_TEMPLATE_CODE}`, loggerCtx);
    }

    private async paymentTemplateExists(ctx: RequestContext, code: string): Promise<boolean> {
        const t = await this.connection
            .getRepository(ctx, PaymentTemplate)
            .findOne({ where: { code } });
        return !!t;
    }

    /** 聚合码支付全局模板（租户可在全局方案池「引用到本店」） */
    private async seedAggregatePaymentTemplate(ctx: RequestContext): Promise<void> {
        const existing = await this.connection
            .getRepository(ctx, PaymentTemplate)
            .findOne({ where: { code: AGGREGATE_PAYMENT_TEMPLATE_CODE } });
        if (existing) return;
        await this.paymentTemplateService.create(ctx, {
            name: '聚合码',
            description: '顾客扫描商家聚合收款码后确认，到账后发货',
            code: AGGREGATE_PAYMENT_TEMPLATE_CODE,
            handler: { code: 'aggregate-pay', arguments: [] },
            isGlobal: true,
        } as any);
        Logger.info(`已创建默认支付模板: ${AGGREGATE_PAYMENT_TEMPLATE_CODE}`, loggerCtx);
    }

    /** 固定聚合码收款支付全局模板（门店到店收银，租户可在全局方案池「引用到本店」） */
    private async seedFixedAggregatePaymentTemplate(ctx: RequestContext): Promise<void> {
        const existing = await this.connection
            .getRepository(ctx, PaymentTemplate)
            .findOne({ where: { code: FIXED_AGGREGATE_COLLECTION_TEMPLATE_CODE } });
        if (existing) return;
        await this.paymentTemplateService.create(ctx, {
            name: '固定聚合码收款',
            description: '门店到店收银：顾客扫门店固定聚合收款码付款到商户，店员确认到账后完成订单',
            code: FIXED_AGGREGATE_COLLECTION_TEMPLATE_CODE,
            handler: { code: 'fixed-aggregate-collection', arguments: [] },
            isGlobal: true,
        } as any);
        Logger.info(`已创建默认支付模板: ${FIXED_AGGREGATE_COLLECTION_TEMPLATE_CODE}`, loggerCtx);
    }

    /**
     * 幂等创建前 20 个官方自营租户（tenantNo 1-20，isOfficial=true）。
     * 每个租户：3 个内置角色（租户管理员/销售/库存）+ 默认管理员 admin
     *            + 门店自提配送方式 + 门店收银支付方式（复用全局 handler）。
     * 已存在（按 channel.code 判重）则跳过。
     */
    private async seedOfficialTenants(ctx: RequestContext): Promise<void> {
        const { Channel, Role, Administrator } = await this.ensureCoreEntities(['Channel', 'Role', 'Administrator']);
        const channelRepo = this.connection.getRepository(ctx, Channel);
        const roleRepo = this.connection.getRepository(ctx, Role);
        const adminRepo = this.connection.getRepository(ctx, Administrator);
        const memberRepo = this.connection.getRepository(ctx, TenantMember);

        for (let i = 1; i <= 20; i++) {
            const code = `official-${String(i).padStart(2, '0')}`;
            const exists = await channelRepo.findOne({ where: { code } } as any);
            if (exists) {
                Logger.info(`官方自营租户 ${code} 已存在，跳过`, loggerCtx);
                continue;
            }

            const channel = await channelRepo.save(
                new Channel({
                    code,
                    token: `official-${i}`,
                    defaultLanguageCode: LanguageCode.zh_Hans,
                    currencyCode: 'CNY',
                    pricesIncludeTax: true,
                    customFields: {
                        enabled: true,
                        tenantNo: i,
                        isOfficial: true,
                        shopName: `官方自营${String(i).padStart(2, '0')}`,
                    },
                } as any),
            );
            Logger.info(`已创建官方自营租户 ${code}`, loggerCtx);

            // 3 个内置角色（限定该 channel；权限清单来自单一模板）
            const [tenantAdminRole, salesRole, stockRole] = await Promise.all(
                OFFICIAL_ROLE_TEMPLATES.map((tpl) =>
                    this.createTenantRoleRecord(ctx, roleRepo, channel, `official-${tpl.busiPrefix}-${i}`, tpl.description, tpl.permissions),
                ),
            );

            // 默认管理员 admin（绑定租户管理员角色）
            const admin = await adminRepo.save(
                new Administrator({
                    firstName: '官方自营',
                    lastName: `自营${String(i).padStart(2, '0')}`,
                    emailAddress: `admin-official-${i}@local.dev`,
                    passwordHash: await this.hashPassword('Admin@123456'),
                    roles: [tenantAdminRole],
                } as any),
            );
            await memberRepo.save(
                new TenantMember({
                    administratorId: String(admin.id),
                    channelId: String(channel.id),
                    enabled: true,
                    displayName: `官方自营${String(i).padStart(2, '0')}管理员`,
                    remark: 'seed 默认管理员',
                } as any),
            );

            // 门店自提配送方式 + 门店收银支付方式（复用全局 handler，限定该 channel）
            try {
                await this.shippingMethodService.create(ctx, {
                    code: `store-pickup-${code}`,
                    fulfillmentHandler: 'store-pickup',
                    checker: { code: 'store-pickup-eligibility', arguments: [] },
                    calculator: { code: 'store-pickup-calculator', arguments: [] },
                    translations: [{ languageCode: LanguageCode.zh_Hans, name: '门店自提', description: '到指定门店自提商品' }],
                    channels: [channel],
                } as any);
                await this.paymentMethodService.create(ctx, {
                    code: `cashier-${code}`,
                    enabled: true,
                    handler: { code: 'cash-on-delivery', arguments: [] },
                    translations: [{ languageCode: LanguageCode.zh_Hans, name: '门店收银', description: '到店收银台支付' }],
                    channels: [channel],
                } as any);
            } catch (e: any) {
                Logger.warn(`官方租户 ${code} 履约初始化失败: ${e.message}`, loggerCtx);
            }
        }
    }

    /** 延迟加载 Vendure 核心实体，避免 seed 阶段循环依赖 */
    private async ensureCoreEntities(names: string[]): Promise<Record<string, any>> {
        const core = await import('@vendure/core');
        const result: Record<string, any> = {};
        for (const name of names) result[name] = (core as any)[name];
        return result;
    }

    private async createTenantRoleRecord(
        ctx: RequestContext,
        roleRepo: any,
        channel: any,
        code: string,
        description: string,
        permissions: string[],
    ): Promise<any> {
        const { Role } = await this.ensureCoreEntities(['Role']);
        const role = new Role({ code, description, permissions, channels: [channel] } as any);
        return roleRepo.save(role);
    }

    private async hashPassword(plain: string): Promise<string> {
        const { BcryptPasswordHashingStrategy } = await import('@vendure/core');
        const s = new BcryptPasswordHashingStrategy();
        return s.hash(plain);
    }
}

export const DEFAULT_STORE = {
    name: '自由大路店',
    type: 'store' as const,
    address: '自由大路',
    phoneNumber: '',
    businessHours: '09:00-21:00',
};

export const STORE_PICKUP_METHOD_CODE = 'store-pickup';
export const STORE_PICKUP_TEMPLATE_CODE = 'store-pickup-template';
export const PICKUP_POINT_TEMPLATE_CODE = 'pickup-point-template';
export const EMPLOYEE_PICKUP_TEMPLATE_CODE = 'employee-pickup-template';
export const LOCAL_DELIVERY_TEMPLATE_CODE = 'local-delivery-template';
export const MAIL_TEMPLATE_CODE = 'mail-template';
export const STORE_PICKUP_PROFILE_CODE = 'store-pickup-profile';
export const CASHIER_PAYMENT_METHOD_CODE = 'cash-on-delivery';
export const CASHIER_PAYMENT_PROFILE_CODE = 'store-cashier-profile';
export const COD_PAYMENT_TEMPLATE_CODE = 'cod-payment-template';
export const BALANCE_PAY_TEMPLATE_CODE = 'balance-pay-template';
export const AGGREGATE_PAYMENT_TEMPLATE_CODE = 'aggregate-pay';
export const FIXED_AGGREGATE_COLLECTION_TEMPLATE_CODE = 'fixed-aggregate-collection';