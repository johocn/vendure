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
exports.DeliveryRecordService = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@vendure/core");
const typeorm_1 = require("typeorm");
const delivery_record_entity_1 = require("./delivery-record.entity");
const delivery_state_1 = require("./delivery-state");
const loggerCtx = 'DeliveryRecordService';
let DeliveryRecordService = class DeliveryRecordService {
    constructor(connection) {
        this.connection = connection;
    }
    physicalEnabled(ctx) {
        var _a;
        return Boolean((_a = ctx.channel.customFields) === null || _a === void 0 ? void 0 : _a.physicalStockEnabled);
    }
    /** 依 SALE 事件生成顾客配送记录：按 orderId+sourceLocationId 分组，幂等防重 */
    async createFromSales(ctx, sales) {
        var _a, _b, _c, _d, _e;
        if (!this.physicalEnabled(ctx) || !(sales === null || sales === void 0 ? void 0 : sales.length)) {
            return [];
        }
        const repo = this.connection.getRepository(ctx, delivery_record_entity_1.DeliveryRecord);
        // orderLine -> orderId
        const lineIds = [...new Set(sales.map(s => { var _a, _b; return String((_b = (_a = s.orderLine) === null || _a === void 0 ? void 0 : _a.id) !== null && _b !== void 0 ? _b : s.orderLineId); }))].filter(Boolean);
        const orderLines = lineIds.length
            ? await this.connection.getRepository(ctx, 'OrderLine').find({ where: { id: (0, typeorm_1.In)(lineIds) } })
            : [];
        const lineOrderMap = new Map(orderLines.map((ol) => [String(ol.id), String(ol.orderId)]));
        const groups = new Map();
        for (const sale of sales) {
            const lineId = String((_b = (_a = sale.orderLine) === null || _a === void 0 ? void 0 : _a.id) !== null && _b !== void 0 ? _b : sale.orderLineId);
            const orderId = (_c = lineOrderMap.get(lineId)) !== null && _c !== void 0 ? _c : String((_d = sale.orderId) !== null && _d !== void 0 ? _d : '');
            if (!orderId) {
                continue;
            }
            const key = `${orderId}|${sale.stockLocationId}`;
            const g = (_e = groups.get(key)) !== null && _e !== void 0 ? _e : {
                orderId, sourceLocationId: sale.stockLocationId, quantity: 0, lineIds: [],
            };
            g.quantity += sale.quantity;
            g.lineIds.push(lineId);
            groups.set(key, g);
        }
        const created = [];
        for (const g of groups.values()) {
            const dup = await repo.find({
                where: {
                    orderId: g.orderId,
                    sourceLocationId: g.sourceLocationId,
                },
            });
            const open = dup.filter(d => d.status !== 'Delivered' && d.status !== 'Completed' && d.status !== 'Returned');
            if (open.length) {
                continue; // 防重复
            }
            const record = await repo.save(new delivery_record_entity_1.DeliveryRecord({
                orderId: g.orderId,
                sourceLocationId: g.sourceLocationId,
                mode: 'self',
                status: 'Draft',
            }));
            created.push(record);
            core_1.Logger.info(`配送记录已生成: order=${g.orderId} loc=${g.sourceLocationId}`, loggerCtx);
        }
        return created;
    }
    /** 状态流转（校验合法迁移 + 记录时间戳） */
    async transition(ctx, id, to) {
        const repo = this.connection.getRepository(ctx, delivery_record_entity_1.DeliveryRecord);
        const record = await repo.findOne({ where: { id: id } });
        if (!record) {
            throw new Error(`配送记录不存在: ${id}`);
        }
        if (!(0, delivery_state_1.validateDeliveryTransition)(record.mode, record.status, to)) {
            throw new Error(`非法状态迁移: ${record.mode} ${record.status} -> ${to}`);
        }
        record.status = to;
        const now = new Date();
        if (to === 'Delivered' || to === 'Completed') {
            record.deliveredAt = now;
        }
        else if (to === 'Returned') {
            record.returnedAt = now;
        }
        else if (to === 'Exception') {
            record.exceptionAt = now;
        }
        else if (to === 'Shipped' || to === 'Assigned' || to === 'InProgress') {
            record.sentAt = now;
        }
        return repo.save(record);
    }
    /** 快递录单 */
    async setExpress(ctx, id, expressCompany, trackingNo) {
        const repo = this.connection.getRepository(ctx, delivery_record_entity_1.DeliveryRecord);
        const record = await repo.findOne({ where: { id: id } });
        if (!record) {
            throw new Error(`配送记录不存在: ${id}`);
        }
        record.mode = 'express';
        record.expressCompany = expressCompany;
        record.trackingNo = trackingNo;
        if (record.status === 'Draft') {
            record.status = 'Shipped';
            record.sentAt = new Date();
        }
        return repo.save(record);
    }
    /** 自营指派 */
    async assignStaff(ctx, id, staffId, staffName) {
        const repo = this.connection.getRepository(ctx, delivery_record_entity_1.DeliveryRecord);
        const record = await repo.findOne({ where: { id: id } });
        if (!record) {
            throw new Error(`配送记录不存在: ${id}`);
        }
        record.staffId = staffId;
        record.staffName = staffName !== null && staffName !== void 0 ? staffName : null;
        if (record.status === 'Draft') {
            record.status = 'Assigned';
            record.sentAt = new Date();
        }
        return repo.save(record);
    }
    /** 自提点模式重设（pickup 订单发货时调用） */
    async markAsPickup(ctx, id, pickupLocationId, mode = 'pickup') {
        const repo = this.connection.getRepository(ctx, delivery_record_entity_1.DeliveryRecord);
        const record = await repo.findOne({ where: { id: id } });
        if (!record) {
            throw new Error(`配送记录不存在: ${id}`);
        }
        record.mode = mode;
        record.pickupLocationId = pickupLocationId;
        if (record.status === 'Draft') {
            record.status = mode === 'transfer' ? 'TransferPending' : 'PickupPending';
        }
        return repo.save(record);
    }
    /** 按订单查询配送记录（不传订单则返回全部） */
    async findByOrder(ctx, orderId) {
        const repo = this.connection.getRepository(ctx, delivery_record_entity_1.DeliveryRecord);
        if (orderId) {
            return repo.find({ where: { orderId: orderId } });
        }
        return repo.find({});
    }
    /** 创建内部配送（transfer）：主仓 -> 自提点仓 */
    async createTransfer(ctx, input) {
        var _a, _b;
        const repo = this.connection.getRepository(ctx, delivery_record_entity_1.DeliveryRecord);
        return repo.save(new delivery_record_entity_1.DeliveryRecord({
            orderId: input.orderId,
            mode: 'transfer',
            status: 'TransferPending',
            fromLocationId: input.fromLocationId,
            toLocationId: input.toLocationId,
            itemsJson: JSON.stringify(input.items),
            expressCompany: (_a = input.expressCompany) !== null && _a !== void 0 ? _a : null,
            trackingNo: (_b = input.trackingNo) !== null && _b !== void 0 ? _b : null,
        }));
    }
    /** transfer 到达：入自提点仓（toLocationId），触发 A 镜像 */
    async markTransferArrived(ctx, id, adjustStockPublic) {
        const repo = this.connection.getRepository(ctx, delivery_record_entity_1.DeliveryRecord);
        const record = await repo.findOne({ where: { id: id } });
        if (!record) {
            throw new Error(`配送记录不存在: ${id}`);
        }
        if (record.mode !== 'transfer' || !record.toLocationId || !record.itemsJson) {
            throw new Error(`非 transfer 记录或无明细，无法收货`);
        }
        if (record.status !== 'InTransit') {
            throw new Error(`状态须为 InTransit 才能收货: ${record.status}`);
        }
        const items = JSON.parse(record.itemsJson);
        for (const item of items) {
            await adjustStockPublic(ctx, item.variantId, record.toLocationId, item.quantity, `自提点收货(record=${record.id})`, {
                bizType: 'stockIn',
                bizCode: `transfer-${record.id}`,
            });
        }
        record.status = 'Arrived';
        record.deliveredAt = new Date();
        return repo.save(record);
    }
};
exports.DeliveryRecordService = DeliveryRecordService;
exports.DeliveryRecordService = DeliveryRecordService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [core_1.TransactionalConnection])
], DeliveryRecordService);
//# sourceMappingURL=delivery-record.service.js.map