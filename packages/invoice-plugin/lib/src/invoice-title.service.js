"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.InvoiceTitleService = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@vendure/core");
const invoice_title_entity_1 = require("./invoice-title.entity");
let InvoiceTitleService = class InvoiceTitleService {
    constructor(connection) {
        this.connection = connection;
    }
    async findOwned(ctx, customerId, id) {
        const repo = this.connection.getRepository(ctx, invoice_title_entity_1.InvoiceTitle);
        const item = await repo.findOne({ where: { id: id, customerId } });
        if (!item) {
            throw new core_1.EntityNotFoundError('InvoiceTitle', id);
        }
        return item;
    }
    async listMine(ctx) {
        if (!ctx.activeUserId) {
            throw new core_1.UnauthorizedError();
        }
        const repo = this.connection.getRepository(ctx, invoice_title_entity_1.InvoiceTitle);
        const items = await repo.find({ where: { customerId: ctx.activeUserId } });
        return items.sort((a, b) => Number(b.isDefault) - Number(a.isDefault));
    }
    async create(ctx, input) {
        var _a, _b, _c, _d, _e, _f;
        if (!ctx.activeUserId) {
            throw new core_1.UnauthorizedError();
        }
        if (!input.title || !input.title.trim()) {
            throw new core_1.UserInputError('title must not be empty');
        }
        const repo = this.connection.getRepository(ctx, invoice_title_entity_1.InvoiceTitle);
        const existing = await repo.count({ where: { customerId: ctx.activeUserId } });
        const item = repo.create({
            title: input.title.trim(),
            taxNumber: (_a = input.taxNumber) !== null && _a !== void 0 ? _a : null,
            email: (_b = input.email) !== null && _b !== void 0 ? _b : null,
            companyAddress: (_c = input.companyAddress) !== null && _c !== void 0 ? _c : null,
            companyPhone: (_d = input.companyPhone) !== null && _d !== void 0 ? _d : null,
            bankName: (_e = input.bankName) !== null && _e !== void 0 ? _e : null,
            bankAccount: (_f = input.bankAccount) !== null && _f !== void 0 ? _f : null,
            customerId: ctx.activeUserId,
            isDefault: input.isDefault || existing === 0, // 首条默认
            channels: [ctx.channel],
        });
        const saved = await repo.save(item);
        if (saved.isDefault) {
            await this.clearOthersDefault(ctx, String(saved.id), String(saved.customerId));
        }
        return saved;
    }
    async update(ctx, id, input) {
        if (!ctx.activeUserId) {
            throw new core_1.UnauthorizedError();
        }
        const item = await this.findOwned(ctx, Number(ctx.activeUserId), id);
        const repo = this.connection.getRepository(ctx, invoice_title_entity_1.InvoiceTitle);
        if (input.title !== undefined) {
            if (!input.title.trim()) {
                throw new core_1.UserInputError('title must not be empty');
            }
            item.title = input.title.trim();
        }
        if (input.taxNumber !== undefined)
            item.taxNumber = input.taxNumber;
        if (input.email !== undefined)
            item.email = input.email;
        if (input.companyAddress !== undefined)
            item.companyAddress = input.companyAddress;
        if (input.companyPhone !== undefined)
            item.companyPhone = input.companyPhone;
        if (input.bankName !== undefined)
            item.bankName = input.bankName;
        if (input.bankAccount !== undefined)
            item.bankAccount = input.bankAccount;
        if (input.isDefault === true && !item.isDefault) {
            item.isDefault = true;
            await this.clearOthersDefault(ctx, String(item.id), String(item.customerId));
        }
        else if (input.isDefault === false && item.isDefault) {
            item.isDefault = false;
        }
        return repo.save(item);
    }
    async setDefault(ctx, id) {
        if (!ctx.activeUserId) {
            throw new core_1.UnauthorizedError();
        }
        const item = await this.findOwned(ctx, Number(ctx.activeUserId), id);
        const repo = this.connection.getRepository(ctx, invoice_title_entity_1.InvoiceTitle);
        item.isDefault = true;
        await this.clearOthersDefault(ctx, String(item.id), String(item.customerId));
        return repo.save(item);
    }
    async delete(ctx, id) {
        if (!ctx.activeUserId) {
            throw new core_1.UnauthorizedError();
        }
        const item = await this.findOwned(ctx, Number(ctx.activeUserId), id);
        const repo = this.connection.getRepository(ctx, invoice_title_entity_1.InvoiceTitle);
        await repo.remove(item);
        return { success: true };
    }
    /** 把同用户其他抬头 isDefault 清掉（trx 内） */
    async clearOthersDefault(ctx, excludeId, customerId) {
        const repo = this.connection.getRepository(ctx, invoice_title_entity_1.InvoiceTitle);
        const items = await repo.find({ where: { customerId: Number(customerId) } });
        for (const t of items) {
            if (String(t.id) !== excludeId && t.isDefault) {
                t.isDefault = false;
                await repo.save(t);
            }
        }
    }
};
exports.InvoiceTitleService = InvoiceTitleService;
exports.InvoiceTitleService = InvoiceTitleService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [core_1.TransactionalConnection])
], InvoiceTitleService);
//# sourceMappingURL=invoice-title.service.js.map