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
exports.RiderService = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@vendure/core");
const CREDIT_LIMIT = 60;
let RiderService = class RiderService {
    constructor(connection, customerService) {
        this.connection = connection;
        this.customerService = customerService;
    }
    /** 当前登录顾客；未登录或无对应顾客一律 ForbiddenError。 */
    async requireCustomer(ctx) {
        if (!ctx.activeUserId) {
            throw new core_1.ForbiddenError();
        }
        const customer = await this.customerService.findOneByUserId(ctx, ctx.activeUserId);
        if (!customer) {
            throw new core_1.ForbiddenError();
        }
        return customer;
    }
    async applyRider(ctx, input) {
        var _a;
        const customer = await this.requireCustomer(ctx);
        await this.connection.getRepository(ctx, core_1.Customer).update(customer.id, {
            customFields: {
                riderStatus: 'pending',
                riderRealName: input.realName,
                riderStudentNo: input.studentNo,
                riderCampus: input.campus,
                riderIdImg: (_a = input.idImg) !== null && _a !== void 0 ? _a : null,
            },
        });
        return { status: 'pending' };
    }
    async setRiderStatus(ctx, customerId, status) {
        await this.connection.getRepository(ctx, core_1.Customer).update(customerId, {
            customFields: { riderStatus: status },
        });
        return { status };
    }
    async assertApprovedRider(ctx) {
        var _a;
        const customer = await this.requireCustomer(ctx);
        const cf = customer.customFields;
        if (cf.riderStatus !== 'approved') {
            throw new core_1.ForbiddenError();
        }
        if (((_a = cf.riderCredit) !== null && _a !== void 0 ? _a : 100) < CREDIT_LIMIT) {
            throw new core_1.ForbiddenError();
        }
        return customer;
    }
    async myRiderProfile(ctx) {
        var _a, _b, _c, _d, _e, _f;
        const customer = await this.requireCustomer(ctx);
        const cf = ((_a = customer.customFields) !== null && _a !== void 0 ? _a : {});
        return {
            customerId: customer.id,
            riderStatus: (_b = cf.riderStatus) !== null && _b !== void 0 ? _b : null,
            riderRealName: (_c = cf.riderRealName) !== null && _c !== void 0 ? _c : null,
            riderStudentNo: (_d = cf.riderStudentNo) !== null && _d !== void 0 ? _d : null,
            riderCampus: (_e = cf.riderCampus) !== null && _e !== void 0 ? _e : null,
            riderCredit: (_f = cf.riderCredit) !== null && _f !== void 0 ? _f : null,
        };
    }
    /** 骑手上下线开关 + 心跳：大厅轮询页每 15s 调 online=true 即续命 */
    async setOnline(ctx, online) {
        const customer = await this.requireCustomer(ctx);
        await this.connection.getRepository(ctx, core_1.Customer).update(customer.id, {
            customFields: { riderOnlineAt: online ? new Date() : null },
        });
        return { online };
    }
    /**
     * 按 riderStatus 查询入驻申请列表。
     * customFields 为嵌入式物理列，QueryBuilder 用 embedded 路径
     * customer.customFields.riderStatus（与 delivery-plugin 的 order.customFields.* 写法一致）。
     */
    async listApplications(ctx, status) {
        return this.connection
            .getRepository(ctx, core_1.Customer)
            .createQueryBuilder('customer')
            .where('customer.customFields.riderStatus = :status', { status })
            .getMany();
    }
};
exports.RiderService = RiderService;
exports.RiderService = RiderService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [core_1.TransactionalConnection, core_1.CustomerService])
], RiderService);
//# sourceMappingURL=rider.service.js.map