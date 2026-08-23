import { Injectable } from '@nestjs/common';
import {
    Channel,
    EntityNotFoundError,
    ID,
    PaginatedList,
    ListQueryOptions,
    PaymentMethodService,
    Permission,
    RequestContext,
    TransactionalConnection,
    UserInputError,
} from '@vendure/core';
import { PaymentTemplate } from './payment-template.entity';

@Injectable()
export class PaymentTemplateService {
    constructor(
        private connection: TransactionalConnection,
        private paymentMethodService: PaymentMethodService,
    ) {}

    /**
     * 查询模板列表（可见规则：全局模板 + 本租户模板）
     */
    async findAll(
        ctx: RequestContext,
        options?: ListQueryOptions<PaymentTemplate>,
    ): Promise<PaginatedList<PaymentTemplate>> {
        const qb = this.connection.getRepository(ctx, PaymentTemplate).createQueryBuilder('pt');
        qb.where('(pt.isGlobal = :isGlobal OR pt.ownerChannelId = :channelId)', {
            isGlobal: true,
            channelId: ctx.channelId,
        });

        if (options?.filter?.name?.['contains']) {
            qb.andWhere('pt.name LIKE :name', { name: `%${options.filter.name['contains']}%` });
        }
        if (options?.filter?.code?.['contains']) {
            qb.andWhere('pt.code LIKE :code', { code: `%${options.filter.code['contains']}%` });
        }
        if (options?.filter?.isGlobal !== undefined) {
            qb.andWhere('pt.isGlobal = :isGlobalFilter', { isGlobalFilter: options.filter.isGlobal });
        }

        const skip = options?.skip || 0;
        const take = options?.take || 10;
        qb.skip(skip).take(take);

        const [items, totalItems] = await qb.getManyAndCount();
        return { items, totalItems };
    }

    /**
     * 查询单个模板
     */
    async findOne(ctx: RequestContext, id: ID): Promise<PaymentTemplate | undefined> {
        const result = await this.connection.getRepository(ctx, PaymentTemplate).findOne({
            where: { id: id as any },
        });
        return result ?? undefined;
    }

    /**
     * 创建模板
     * - 超级管理员：isGlobal=true，ownerChannelId=null
     * - 租户管理员：isGlobal=false，ownerChannelId=当前channelId
     */
    async create(ctx: RequestContext, input: any): Promise<PaymentTemplate> {
        const repo = this.connection.getRepository(ctx, PaymentTemplate);
        const template = new PaymentTemplate(input);
        template.channels = [ctx.channel];
        template.ownerChannelId = input.isGlobal ? null : ctx.channelId;
        template.isGlobal = input.isGlobal ?? false;
        return repo.save(template);
    }

    /**
     * 更新模板（租户只能更新自己的模板，不能更新全局模板）
     */
    async update(ctx: RequestContext, input: any): Promise<PaymentTemplate> {
        const repo = this.connection.getRepository(ctx, PaymentTemplate);
        const template = await repo.findOne({ where: { id: input.id } });
        if (!template) {
            throw new EntityNotFoundError('PaymentTemplate', input.id);
        }
        // 租户不能修改全局模板
        if (template.isGlobal && !ctx.userHasPermissions([Permission.SuperAdmin])) {
            throw new UserInputError('Cannot modify global template');
        }
        const { id, ...updateData } = input;
        Object.assign(template, updateData);
        return repo.save(template);
    }

    /**
     * 删除模板（租户只能删除自己的模板，不能删除全局模板）
     */
    async delete(ctx: RequestContext, id: ID): Promise<void> {
        const repo = this.connection.getRepository(ctx, PaymentTemplate);
        const template = await repo.findOne({ where: { id: id as any } });
        if (!template) {
            throw new EntityNotFoundError('PaymentTemplate', id);
        }
        if (template.isGlobal && !ctx.userHasPermissions([Permission.SuperAdmin])) {
            throw new UserInputError('Cannot delete global template');
        }
        await repo.delete(id);
    }

    /**
     * 从模板创建支付方式（绑定到当前 Channel）
     * 租户可覆盖名称，否则使用模板名称
     */
    async createPaymentMethodFromTemplate(
        ctx: RequestContext,
        templateId: ID,
        nameOverride?: string,
        codeOverride?: string,
    ): Promise<any> {
        const template = await this.findOne(ctx, templateId);
        if (!template) {
            throw new EntityNotFoundError('PaymentTemplate', templateId);
        }

        const name = nameOverride || template.name;
        const code = codeOverride || template.code;

        // 使用 Vendure 内置 PaymentMethodService 创建
        const paymentMethod = await this.paymentMethodService.create(ctx, {
            code,
            enabled: true,
            handler: template.handler,
            checker: template.checker ?? undefined,
            translations: [
                {
                    languageCode: ctx.languageCode,
                    name,
                    description: template.description,
                },
            ],
        });

        return paymentMethod;
    }
}