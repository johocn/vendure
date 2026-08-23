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
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PaymentTemplateService = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@vendure/core");
const payment_template_entity_1 = require("./payment-template.entity");
let PaymentTemplateService = class PaymentTemplateService {
    constructor(connection, paymentMethodService) {
        this.connection = connection;
        this.paymentMethodService = paymentMethodService;
    }
    /**
     * 查询模板列表（可见规则：全局模板 + 本租户模板）
     */
    async findAll(ctx, options) {
        var _a, _b, _c, _d, _e;
        const qb = this.connection.getRepository(ctx, payment_template_entity_1.PaymentTemplate).createQueryBuilder('pt');
        qb.where('(pt.isGlobal = :isGlobal OR pt.ownerChannelId = :channelId)', {
            isGlobal: true,
            channelId: ctx.channelId,
        });
        if ((_b = (_a = options === null || options === void 0 ? void 0 : options.filter) === null || _a === void 0 ? void 0 : _a.name) === null || _b === void 0 ? void 0 : _b['contains']) {
            qb.andWhere('pt.name LIKE :name', { name: `%${options.filter.name['contains']}%` });
        }
        if ((_d = (_c = options === null || options === void 0 ? void 0 : options.filter) === null || _c === void 0 ? void 0 : _c.code) === null || _d === void 0 ? void 0 : _d['contains']) {
            qb.andWhere('pt.code LIKE :code', { code: `%${options.filter.code['contains']}%` });
        }
        if (((_e = options === null || options === void 0 ? void 0 : options.filter) === null || _e === void 0 ? void 0 : _e.isGlobal) !== undefined) {
            qb.andWhere('pt.isGlobal = :isGlobalFilter', { isGlobalFilter: options.filter.isGlobal });
        }
        const skip = (options === null || options === void 0 ? void 0 : options.skip) || 0;
        const take = (options === null || options === void 0 ? void 0 : options.take) || 10;
        qb.skip(skip).take(take);
        const [items, totalItems] = await qb.getManyAndCount();
        return { items, totalItems };
    }
    /**
     * 查询单个模板
     */
    async findOne(ctx, id) {
        const result = await this.connection.getRepository(ctx, payment_template_entity_1.PaymentTemplate).findOne({
            where: { id: id },
        });
        return result !== null && result !== void 0 ? result : undefined;
    }
    /**
     * 创建模板
     * - 超级管理员：isGlobal=true，ownerChannelId=null
     * - 租户管理员：isGlobal=false，ownerChannelId=当前channelId
     */
    async create(ctx, input) {
        var _a;
        const repo = this.connection.getRepository(ctx, payment_template_entity_1.PaymentTemplate);
        const template = new payment_template_entity_1.PaymentTemplate(input);
        template.channels = [ctx.channel];
        template.ownerChannelId = input.isGlobal ? null : ctx.channelId;
        template.isGlobal = (_a = input.isGlobal) !== null && _a !== void 0 ? _a : false;
        return repo.save(template);
    }
    /**
     * 更新模板（租户只能更新自己的模板，不能更新全局模板）
     */
    async update(ctx, input) {
        const repo = this.connection.getRepository(ctx, payment_template_entity_1.PaymentTemplate);
        const template = await repo.findOne({ where: { id: input.id } });
        if (!template) {
            throw new core_1.EntityNotFoundError('PaymentTemplate', input.id);
        }
        // 租户不能修改全局模板
        if (template.isGlobal && !ctx.userHasPermissions([core_1.Permission.SuperAdmin])) {
            throw new core_1.UserInputError('Cannot modify global template');
        }
        const { id } = input, updateData = __rest(input, ["id"]);
        Object.assign(template, updateData);
        return repo.save(template);
    }
    /**
     * 删除模板（租户只能删除自己的模板，不能删除全局模板）
     */
    async delete(ctx, id) {
        const repo = this.connection.getRepository(ctx, payment_template_entity_1.PaymentTemplate);
        const template = await repo.findOne({ where: { id: id } });
        if (!template) {
            throw new core_1.EntityNotFoundError('PaymentTemplate', id);
        }
        if (template.isGlobal && !ctx.userHasPermissions([core_1.Permission.SuperAdmin])) {
            throw new core_1.UserInputError('Cannot delete global template');
        }
        await repo.delete(id);
    }
    /**
     * 从模板创建支付方式（绑定到当前 Channel）
     * 租户可覆盖名称，否则使用模板名称
     */
    async createPaymentMethodFromTemplate(ctx, templateId, nameOverride, codeOverride) {
        var _a;
        const template = await this.findOne(ctx, templateId);
        if (!template) {
            throw new core_1.EntityNotFoundError('PaymentTemplate', templateId);
        }
        const name = nameOverride || template.name;
        const code = codeOverride || template.code;
        // 使用 Vendure 内置 PaymentMethodService 创建
        const paymentMethod = await this.paymentMethodService.create(ctx, {
            code,
            enabled: true,
            handler: template.handler,
            checker: (_a = template.checker) !== null && _a !== void 0 ? _a : undefined,
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
};
exports.PaymentTemplateService = PaymentTemplateService;
exports.PaymentTemplateService = PaymentTemplateService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [core_1.TransactionalConnection,
        core_1.PaymentMethodService])
], PaymentTemplateService);
//# sourceMappingURL=payment-template.service.js.map