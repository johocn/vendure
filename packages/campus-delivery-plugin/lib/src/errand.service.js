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
exports.ErrandService = exports.ERRAND_TIP_SURCHARGE_DESC = exports.ERRAND_KINDS = exports.ERRAND_BASE_SLUG = exports.ERRAND_BASE_SKU = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@nestjs/core");
const core_2 = require("@vendure/core");
const campus_building_entity_1 = require("./campus-building.entity");
const campus_fulfillment_config_entity_1 = require("./campus-fulfillment-config.entity");
const campus_zone_entity_1 = require("./campus-zone.entity");
const shipping_calculator_1 = require("./shipping-calculator");
/** 0 元载体商品 SKU：幂等创建的查重键，C 端 addItemToOrder 用其 variantId 加购物车 */
exports.ERRAND_BASE_SKU = 'CAMPUS-ERRAND-BASE';
exports.ERRAND_BASE_SLUG = 'campus-errand-base';
/** 跑腿类型白名单（与发单页/调度统计口径一致） */
exports.ERRAND_KINDS = ['pickup_express', 'bring_food', 'buy', 'other'];
/** 小费 surcharge 标识（幂等清理键：同单重复设置按此描述清旧补新，防重复计费） */
exports.ERRAND_TIP_SURCHARGE_DESC = '跑腿小费';
/**
 * R5 跑腿单：两步式链路——
 * 1) admin 用 ensureErrandProduct 幂等建 0 元载体（SKU 查重入口）；
 * 2) C 端先 addItemToOrder(variantId)，再 campusSetErrandInfo 写 errand 标记 + 小费 surcharge。
 * 支付金额 = 商品(0) + shipping(campusErrandCalculator 按 zone.fee) + surcharge(tip)；
 * 分成按 shipping + tip 计算（surcharge 不进 order.shipping，无双算）。
 */
let ErrandService = class ErrandService {
    constructor(connection, orderService, moduleRef) {
        this.connection = connection;
        this.orderService = orderService;
        this.moduleRef = moduleRef;
    }
    /** vendure Injector 需由 ModuleRef 构造（Nest 不直接提供 Injector 作为可注入项） */
    get injector() {
        return new core_2.Injector(this.moduleRef);
    }
    /** 幂等创建 0 元载体：按 SKU 查 ProductVariant，已存在直接返回。
     * ProductVariant 有 product FK，必须走 ProductService/ProductVariantService 组合（禁裸 repo.save 单表）。 */
    async ensureErrandProduct(ctx) {
        const existing = await this.connection
            .getRepository(ctx, core_2.ProductVariant)
            .findOne({ where: { sku: exports.ERRAND_BASE_SKU } });
        if (existing) {
            return { variantId: existing.id, sku: exports.ERRAND_BASE_SKU, created: false };
        }
        const productService = this.injector.get(core_2.ProductService);
        const variantService = this.injector.get(core_2.ProductVariantService);
        const product = await productService.create(ctx, {
            translations: [{
                    languageCode: ctx.languageCode, name: '校园跑腿服务',
                    slug: exports.ERRAND_BASE_SLUG, description: '跑腿单 0 元载体商品',
                }],
        });
        const [variant] = await variantService.create(ctx, [
            {
                productId: product.id,
                sku: exports.ERRAND_BASE_SKU,
                price: 0,
                translations: [{ languageCode: ctx.languageCode, name: '校园跑腿服务' }],
            },
        ]);
        return { variantId: variant.id, sku: exports.ERRAND_BASE_SKU, created: true };
    }
    /**
     * C 端跑腿单第二步：写 errand customFields（标记 orderKind/R5 + 起止 + 小费），
     * tip>0 时给订单加小费 surcharge（listPrice=tip，含税口径）。
     */
    async setErrandInfo(ctx, input) {
        var _a, _b, _c, _d, _e, _f, _g;
        if (!ctx.activeUserId)
            throw new core_2.ForbiddenError();
        const orderId = (_a = ctx.session) === null || _a === void 0 ? void 0 : _a.activeOrderId;
        if (!orderId)
            throw new core_2.UserInputError('购物车为空');
        // kind 白名单：防任意字符串写入后调度/统计按未知类型走
        const kind = String((_b = input.kind) !== null && _b !== void 0 ? _b : '').trim();
        if (!exports.ERRAND_KINDS.includes(kind))
            throw new core_2.UserInputError('跑腿类型不合法');
        const fromText = String((_c = input.fromText) !== null && _c !== void 0 ? _c : '').trim();
        const toText = String((_d = input.toText) !== null && _d !== void 0 ? _d : '').trim();
        if (!fromText || !toText)
            throw new core_2.UserInputError('请填写跑腿起点和终点');
        const note = input.note == null ? null : String(input.note).trim();
        const errandFrom = input.errandFrom == null ? null : String(input.errandFrom).trim();
        // 文本长度上限（字段无长度约束，防超长文本撑爆库/前端渲染）
        if (fromText.length > 100 || toText.length > 100)
            throw new core_2.UserInputError('起点/终点不能超过 100 个字符');
        if (note && note.length > 200)
            throw new core_2.UserInputError('备注不能超过 200 个字符');
        if (errandFrom && errandFrom.length > 64)
            throw new core_2.UserInputError('来源单号不合法');
        if (!Number.isFinite(input.tip) || input.tip < 0)
            throw new core_2.UserInputError('小费金额不合法');
        const tip = Math.floor(input.tip);
        if (tip > 10000000)
            throw new core_2.UserInputError('小费金额过大');
        // 分区/楼栋归属校验：只允许本渠道的地址体系，防写入他店 ID 导致调度/计价串店
        let campusZone = input.campusZone == null ? null : String(input.campusZone).trim();
        let buildingId = input.buildingId == null ? null : String(input.buildingId).trim();
        let zone = null;
        if (campusZone) {
            zone = await this.connection.getRepository(ctx, campus_zone_entity_1.CampusZone).findOne({
                where: { name: campusZone, channelId: ctx.channelId },
            });
            if (!zone)
                throw new core_2.UserInputError('跑腿分区不属于当前店铺');
        }
        if (buildingId) {
            const bid = Number(buildingId);
            if (!Number.isInteger(bid) || bid <= 0)
                throw new core_2.UserInputError('楼栋不合法');
            const building = await this.connection.getRepository(ctx, campus_building_entity_1.CampusBuilding).findOne({
                where: { id: bid, channelId: ctx.channelId },
            });
            if (!building)
                throw new core_2.UserInputError('楼栋不属于当前店铺');
            if (zone && Number(building.zoneId) !== Number(zone.id)) {
                throw new core_2.UserInputError('楼栋不属于所选分区');
            }
            buildingId = String(bid);
            if (!zone) {
                const buildingZone = await this.connection.getRepository(ctx, campus_zone_entity_1.CampusZone).findOne({
                    where: { id: building.zoneId, channelId: ctx.channelId },
                });
                campusZone = (_e = buildingZone === null || buildingZone === void 0 ? void 0 : buildingZone.name) !== null && _e !== void 0 ? _e : null;
            }
        }
        const order = await this.orderService.updateCustomFields(ctx, orderId, {
            orderKind: 'errand',
            fulfillmentRoute: 'R5',
            errandKind: kind,
            // R2 接力单：errandFrom 存原单号（campusR2Relay 反查键）；普通 R5 缺省落 A 点文字
            errandFrom: errandFrom !== null && errandFrom !== void 0 ? errandFrom : fromText,
            errandTo: toText,
            errandNote: note,
            tip,
            buildingId,
            campusZone,
        });
        // 小费 surcharge 幂等：先清本单全部旧小费，再按新 tip 加一条（tip=0 只清不加），
        // 防止同单重复设置（改小费/改地址/重复提交）叠加多条 surcharge 重复计费
        const existing = await this.connection.getRepository(ctx, core_2.Order).findOne({
            where: { id: orderId },
            relations: ['surcharges'],
        });
        const oldTips = ((_f = existing === null || existing === void 0 ? void 0 : existing.surcharges) !== null && _f !== void 0 ? _f : []).filter(x => x.description === exports.ERRAND_TIP_SURCHARGE_DESC);
        for (const s of oldTips) {
            await this.orderService.removeSurchargeFromOrder(ctx, orderId, s.id);
        }
        if (tip > 0) {
            // 本 fork 无独立 SurchargeService，surcharge 原语在 OrderService.addSurchargeToOrder（service 层无权限校验，shop ctx 可用）
            try {
                await this.orderService.addSurchargeToOrder(ctx, orderId, {
                    description: exports.ERRAND_TIP_SURCHARGE_DESC,
                    listPrice: tip,
                    listPriceIncludesTax: true,
                });
            }
            catch (e) {
                // 先清后加非事务：新增失败时回补刚清掉的旧小费（尽力而为），避免用户已填小费静默丢失
                for (const s of oldTips) {
                    await this.orderService.addSurchargeToOrder(ctx, orderId, {
                        description: exports.ERRAND_TIP_SURCHARGE_DESC,
                        listPrice: Number((_g = s.listPrice) !== null && _g !== void 0 ? _g : 0),
                        listPriceIncludesTax: true,
                    }).catch(() => undefined);
                }
                throw e;
            }
        }
        return order;
    }
    /** R5 发单页读起步价：起步价 + 当前时段/供需/倍率后的实时价格（null → 默认 200 分） */
    async getErrandBaseFee(ctx) {
        var _a;
        const cfg = await this.connection.getRepository(ctx, campus_fulfillment_config_entity_1.CampusFulfillmentConfig).findOne({
            where: { channelId: ctx.channelId },
        });
        const quote = await (0, shipping_calculator_1.quoteDynamicBaseFee)(this.connection, ctx.channelId, (_a = cfg === null || cfg === void 0 ? void 0 : cfg.errandBaseFee) !== null && _a !== void 0 ? _a : 200, cfg, 'errand');
        return quote.price;
    }
};
exports.ErrandService = ErrandService;
exports.ErrandService = ErrandService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [core_2.TransactionalConnection,
        core_2.OrderService,
        core_1.ModuleRef])
], ErrandService);
//# sourceMappingURL=errand.service.js.map