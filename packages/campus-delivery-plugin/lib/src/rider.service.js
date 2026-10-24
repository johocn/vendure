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
        var _a, _b, _c, _d, _e;
        const customer = await this.requireCustomer(ctx);
        const realName = String((_a = input.realName) !== null && _a !== void 0 ? _a : '').trim();
        const studentNo = String((_b = input.studentNo) !== null && _b !== void 0 ? _b : '').trim();
        const campus = String((_c = input.campus) !== null && _c !== void 0 ? _c : '').trim();
        const idImg = input.idImg == null ? null : String(input.idImg).trim();
        if (!realName || !studentNo || !campus) {
            throw new core_1.UserInputError('请填写姓名、学号和校区');
        }
        // 入参上限：防超长文本写库（字段无长度约束，前端也校验）
        if ([realName, studentNo, campus].some(v => v.length > 30)) {
            throw new core_1.UserInputError('姓名、学号、校区均不能超过 30 个字符');
        }
        if (idImg && idImg.length > 500) {
            throw new core_1.UserInputError('证件图片地址不合法');
        }
        const current = String((_e = (_d = customer.customFields) === null || _d === void 0 ? void 0 : _d.riderStatus) !== null && _e !== void 0 ? _e : 'none');
        // 已停用账号不得自助复申请（否则改回 pending 可绕过停用）；
        // 已通过审核者仅更新资料，保留 approved（重新提交不能把在职骑手打回待审）
        if (current === 'suspended')
            throw new core_1.UserInputError('骑手账号已停用，请联系管理员');
        const status = current === 'approved' ? 'approved' : 'pending';
        await this.connection.getRepository(ctx, core_1.Customer).update(customer.id, {
            customFields: {
                riderStatus: status,
                riderRealName: realName,
                riderStudentNo: studentNo,
                riderCampus: campus,
                riderIdImg: idImg,
            },
        });
        return { status };
    }
    /** 骑手归属渠守卫：Customer 的渠道是多对多，必须 join customer.channels。
     * 否则 A 店审核员可按 customerId 查看/停用 B 店骑手（含学号、证件照）。 */
    async assertCustomerInChannel(ctx, customerId) {
        const inChannel = await this.connection
            .getRepository(ctx, core_1.Customer)
            .createQueryBuilder('customer')
            .leftJoin('customer.channels', 'channel')
            .where('customer.id = :id', { id: customerId })
            .andWhere('channel.id = :ch', { ch: ctx.channelId })
            .getOne();
        if (!inChannel)
            throw new core_1.UserInputError('骑手不存在或不属于当前店铺');
    }
    async setRiderStatus(ctx, customerId, status) {
        if (!['none', 'approved', 'suspended'].includes(String(status !== null && status !== void 0 ? status : ''))) {
            throw new core_1.UserInputError('骑手状态不合法');
        }
        await this.assertCustomerInChannel(ctx, customerId);
        const customFields = { riderStatus: status };
        // 停用/重置即强制下线：否则残留的心跳时间仍让对方出现在在线运力池里被派单
        if (status !== 'approved')
            customFields.riderOnlineAt = null;
        await this.connection.getRepository(ctx, core_1.Customer).update(customerId, {
            customFields,
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
        var _a, _b;
        const customer = await this.requireCustomer(ctx);
        const status = String((_b = (_a = customer.customFields) === null || _a === void 0 ? void 0 : _a.riderStatus) !== null && _b !== void 0 ? _b : 'none');
        // 未过审（none/pending/suspended）不得上线：避免待审/停用账号写心跳污染在线运力
        if (online && status !== 'approved')
            throw new core_1.ForbiddenError();
        await this.connection.getRepository(ctx, core_1.Customer).update(customer.id, {
            customFields: { riderOnlineAt: online ? new Date() : null },
        });
        return { online };
    }
    /**
     * 按 riderStatus 查询入驻申请列表。
     * customFields 为嵌入式物理列，QueryBuilder 用 embedded 路径
     * customer.customFields.riderStatus（与 delivery-plugin 的 order.customFields.* 写法一致）。
     * F8 分页：skip/take 由前端传参，take 缺省 200 兜底防全量。
     */
    async listApplications(ctx, status, skip, take) {
        // 分页参数钳制：防 GraphQL Int 负数（take<1 生成非法 LIMIT）与超大 take 绕过兜底全量拉取
        const safeSkip = Math.max(0, skip !== null && skip !== void 0 ? skip : 0);
        const safeTake = Math.min(Math.max(take !== null && take !== void 0 ? take : 200, 1), 500);
        const [items, total] = await this.connection
            .getRepository(ctx, core_1.Customer)
            .createQueryBuilder('customer')
            // 渠道隔离：Customer 的渠道为多对多，join 后仅返回本店骑手申请
            .leftJoin('customer.channels', 'channel')
            .where('customer.customFields.riderStatus = :status', { status })
            .andWhere('channel.id = :ch', { ch: ctx.channelId })
            .orderBy('customer.id', 'ASC')
            .skip(safeSkip)
            .take(safeTake)
            .getManyAndCount();
        return { items, total };
    }
};
exports.RiderService = RiderService;
exports.RiderService = RiderService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [core_1.TransactionalConnection, core_1.CustomerService])
], RiderService);
//# sourceMappingURL=rider.service.js.map