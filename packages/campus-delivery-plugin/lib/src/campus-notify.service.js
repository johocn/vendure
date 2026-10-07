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
var CampusNotifyService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.CampusNotifyService = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@nestjs/core");
const core_2 = require("@vendure/core");
const wechat_auth_plugin_1 = require("@vendure/wechat-auth-plugin");
const campus_config_service_1 = require("./campus-config.service");
/** 触点 → 配置实体模板 ID 字段（未配置 = 该节点静默跳过） */
const TEMPLATE_FIELD = {
    orderAccepted: 'notifyTemplateAccepted',
    riderAssigned: 'notifyTemplateRiderAssigned',
    cookingDone: 'notifyTemplateCookingDone',
    orderDelivered: 'notifyTemplateDelivered',
    exceptionHandled: 'notifyTemplateExceptionHandled',
};
/** 状态文案（公众号模板 thing 字段 ≤20 字符） */
const STATUS_TEXT = {
    orderAccepted: '商家已接单，备餐中',
    riderAssigned: '骑手已接单，待取货',
    cookingDone: '出餐完成，等待取货',
    orderDelivered: '订单已送达',
    exceptionHandled: '异常已处理',
};
/**
 * 用户侧节点通知（公众号模板消息，touser = Customer.customFields.wechatOpenid）。
 * 设计约束：fire-and-forget——模板未配置/用户无 openid（未关注公众号）/服务未注册/
 * 发送失败一律只记日志，绝不阻塞、绝不抛出到业务主流程。
 * 字段名映射（character_string1/thing1/time2）按申请到的订单类模板而定，
 * 若模板字段不同仅需调整本文件 buildData 一处。
 */
let CampusNotifyService = CampusNotifyService_1 = class CampusNotifyService {
    constructor(connection, config, moduleRef) {
        this.connection = connection;
        this.config = config;
        this.moduleRef = moduleRef;
    }
    /** vendure Injector 需由 ModuleRef 构造（与 hall.service 同款惰性解析，避免插件未注册时构造期报错） */
    get injector() {
        return new core_2.Injector(this.moduleRef);
    }
    /** 发送节点通知（异步不等待，不抛错）。text：动态文案覆盖 thing1（如异常处置结果，超 20 字符自动截断） */
    user(ctx, orderId, event, text) {
        void (async () => {
            var _a, _b, _c, _d;
            try {
                const cfg = await this.config.getConfig(ctx);
                const templateId = cfg[TEMPLATE_FIELD[event]];
                if (!templateId) {
                    core_2.Logger.debug(`channel ${ctx.channelId} has no ${TEMPLATE_FIELD[event]}, skip user notify`, 'CampusNotify');
                    return;
                }
                const order = await this.connection.getRepository(ctx, core_2.Order).findOne({
                    where: { id: orderId },
                    relations: ['customer'],
                });
                const openid = (_b = (_a = order === null || order === void 0 ? void 0 : order.customer) === null || _a === void 0 ? void 0 : _a.customFields) === null || _b === void 0 ? void 0 : _b.wechatOpenid;
                if (!order || !openid) {
                    core_2.Logger.debug(`order ${orderId} customer has no wechatOpenid, skip user notify (${event})`, 'CampusNotify');
                    return;
                }
                const wx = this.injector.get(wechat_auth_plugin_1.WechatAuthService);
                const res = await wx.sendTemplate({
                    touser: openid,
                    template_id: templateId,
                    data: this.buildData(order.code, event, text),
                });
                core_2.Logger.info(`user notify ${event} sent for ${order.code} (msgid=${(_c = res === null || res === void 0 ? void 0 : res.msgid) !== null && _c !== void 0 ? _c : '?'})`, 'CampusNotify');
            }
            catch (e) {
                core_2.Logger.warn(`user notify ${event} for order ${orderId} failed: ${(_d = e === null || e === void 0 ? void 0 : e.message) !== null && _d !== void 0 ? _d : e}`, 'CampusNotify');
            }
        })();
    }
    /** 模板字段映射（订单号/状态/时间），字段名以申请到的模板为准 */
    buildData(orderCode, event, text) {
        return {
            character_string1: { value: orderCode },
            thing1: { value: (text !== null && text !== void 0 ? text : STATUS_TEXT[event]).slice(0, 20) },
            time2: { value: CampusNotifyService_1.formatTime(new Date()) },
        };
    }
    static formatTime(d) {
        const pad = (n) => String(n).padStart(2, '0');
        return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
    }
};
exports.CampusNotifyService = CampusNotifyService;
exports.CampusNotifyService = CampusNotifyService = CampusNotifyService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [core_2.TransactionalConnection,
        campus_config_service_1.CampusConfigService,
        core_1.ModuleRef])
], CampusNotifyService);
//# sourceMappingURL=campus-notify.service.js.map