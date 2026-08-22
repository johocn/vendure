import { Injectable } from '@nestjs/common';
import { EntityNotFoundError, ForbiddenError, ID, RequestContext, TransactionalConnection, UnauthorizedError, UserInputError } from '@vendure/core';

import { InvoiceTitle } from './invoice-title.entity';

export interface CreateInvoiceTitleInput {
    title: string;
    taxNumber?: string;
    email?: string;
    companyAddress?: string;
    companyPhone?: string;
    bankName?: string;
    bankAccount?: string;
    isDefault?: boolean;
}

export interface UpdateInvoiceTitleInput extends Partial<CreateInvoiceTitleInput> {}

@Injectable()
export class InvoiceTitleService {
    constructor(private connection: TransactionalConnection) {}

    private async findOwned(ctx: RequestContext, customerId: number, id: ID): Promise<InvoiceTitle> {
        const repo = this.connection.getRepository(ctx, InvoiceTitle);
        const item = await repo.findOne({ where: { id: id as any, customerId } });
        if (!item) {
            throw new EntityNotFoundError('InvoiceTitle', id);
        }
        return item;
    }

    /** 供发票创建复用：按 id 取抬头（管理员可为客户代取）。不强制归属当前 activeUser。 */
    async getOwned(ctx: RequestContext, id: ID): Promise<InvoiceTitle> {
        const repo = this.connection.getRepository(ctx, InvoiceTitle);
        const item = await repo.findOne({ where: { id: id as any } });
        if (!item) {
            throw new EntityNotFoundError('InvoiceTitle', id);
        }
        return item;
    }

    async listMine(ctx: RequestContext): Promise<InvoiceTitle[]> {
        if (!ctx.activeUserId) {
            throw new UnauthorizedError();
        }
        const repo = this.connection.getRepository(ctx, InvoiceTitle);
        const items = await repo.find({ where: { customerId: ctx.activeUserId as any } });
        return items.sort((a, b) => Number(b.isDefault) - Number(a.isDefault));
    }

    async create(ctx: RequestContext, input: CreateInvoiceTitleInput): Promise<InvoiceTitle> {
        if (!ctx.activeUserId) {
            throw new UnauthorizedError();
        }
        if (!input.title || !input.title.trim()) {
            throw new UserInputError('title must not be empty');
        }
        const repo = this.connection.getRepository(ctx, InvoiceTitle);
        const existing = await repo.count({ where: { customerId: ctx.activeUserId as any } });
        const item = repo.create({
            title: input.title.trim(),
            taxNumber: input.taxNumber ?? null,
            email: input.email ?? null,
            companyAddress: input.companyAddress ?? null,
            companyPhone: input.companyPhone ?? null,
            bankName: input.bankName ?? null,
            bankAccount: input.bankAccount ?? null,
            customerId: ctx.activeUserId as any,
            isDefault: input.isDefault || existing === 0, // 首条默认
            channels: [ctx.channel],
        });
        const saved = await repo.save(item);
        if (saved.isDefault) {
            await this.clearOthersDefault(ctx, String(saved.id), String(saved.customerId));
        }
        return saved;
    }

    async update(ctx: RequestContext, id: ID, input: UpdateInvoiceTitleInput): Promise<InvoiceTitle> {
        if (!ctx.activeUserId) {
            throw new UnauthorizedError();
        }
        const item = await this.findOwned(ctx, Number(ctx.activeUserId), id);
        const repo = this.connection.getRepository(ctx, InvoiceTitle);
        if (input.title !== undefined) {
            if (!input.title.trim()) {
                throw new UserInputError('title must not be empty');
            }
            item.title = input.title.trim();
        }
        if (input.taxNumber !== undefined) item.taxNumber = input.taxNumber;
        if (input.email !== undefined) item.email = input.email;
        if (input.companyAddress !== undefined) item.companyAddress = input.companyAddress;
        if (input.companyPhone !== undefined) item.companyPhone = input.companyPhone;
        if (input.bankName !== undefined) item.bankName = input.bankName;
        if (input.bankAccount !== undefined) item.bankAccount = input.bankAccount;
        if (input.isDefault === true && !item.isDefault) {
            item.isDefault = true;
            await this.clearOthersDefault(ctx, String(item.id), String(item.customerId));
        } else if (input.isDefault === false && item.isDefault) {
            item.isDefault = false;
        }
        return repo.save(item);
    }

    async setDefault(ctx: RequestContext, id: ID): Promise<InvoiceTitle> {
        if (!ctx.activeUserId) {
            throw new UnauthorizedError();
        }
        const item = await this.findOwned(ctx, Number(ctx.activeUserId), id);
        const repo = this.connection.getRepository(ctx, InvoiceTitle);
        item.isDefault = true;
        await this.clearOthersDefault(ctx, String(item.id), String(item.customerId));
        return repo.save(item);
    }

    async delete(ctx: RequestContext, id: ID): Promise<{ success: boolean }> {
        if (!ctx.activeUserId) {
            throw new UnauthorizedError();
        }
        const item = await this.findOwned(ctx, Number(ctx.activeUserId), id);
        const repo = this.connection.getRepository(ctx, InvoiceTitle);
        await repo.remove(item);
        return { success: true };
    }

    /** 把同用户其他抬头 isDefault 清掉（trx 内） */
    private async clearOthersDefault(ctx: RequestContext, excludeId: string, customerId: string): Promise<void> {
        const repo = this.connection.getRepository(ctx, InvoiceTitle);
        const items = await repo.find({ where: { customerId: Number(customerId) } });
        for (const t of items) {
            if (String(t.id) !== excludeId && t.isDefault) {
                t.isDefault = false;
                await repo.save(t);
            }
        }
    }
}