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
exports.MessagePushService = void 0;
const common_1 = require("@nestjs/common");
const crypto_1 = require("crypto");
const core_1 = require("@vendure/core");
const constants_1 = require("./constants");
let MessagePushService = class MessagePushService {
    constructor(connection) {
        this.connection = connection;
    }
    async sendPush(ctx, customerId, title, body) {
        var _a, _b;
        const customerRepo = this.connection.getRepository(ctx, core_1.Customer);
        const customer = await customerRepo.findOne({ where: { id: customerId } });
        if (!customer) {
            throw new Error(`Customer ${customerId} not found`);
        }
        const pushCid = (_a = customer.customFields) === null || _a === void 0 ? void 0 : _a.pushCid;
        if (!pushCid) {
            core_1.Logger.warn(`Customer ${customerId} has no pushCid, skipping push`, constants_1.loggerCtx);
            return;
        }
        const cf = (_b = ctx.channel.customFields) !== null && _b !== void 0 ? _b : {};
        const appKey = cf.uniPushAppKey;
        const masterSecret = cf.uniPushMasterSecret;
        if (!appKey || !masterSecret) {
            core_1.Logger.warn(`Channel ${ctx.channelId} has no uniPush credentials, skipping push`, constants_1.loggerCtx);
            return;
        }
        try {
            const token = await this.getToken(appKey, masterSecret);
            await this.pushSingle(appKey, token, pushCid, title, body);
            core_1.Logger.info(`Push sent to customer ${customerId}`, constants_1.loggerCtx);
        }
        catch (e) {
            core_1.Logger.error(`Push failed for customer ${customerId}: ${e.message}`, constants_1.loggerCtx);
            throw e;
        }
    }
    async getToken(appKey, masterSecret) {
        const timestamp = Date.now();
        const sign = Buffer.from(`${appKey}${timestamp}${masterSecret}`).toString('base64');
        const res = await fetch(`https://restapi.getui.com/v2/${appKey}/auth`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ timestamp: String(timestamp), sign }),
        });
        const data = await res.json();
        if (data.code !== 0) {
            throw new Error(`Getui auth failed: ${data.msg}`);
        }
        return data.data.token;
    }
    async pushSingle(appKey, token, cid, title, body) {
        const requestId = (0, crypto_1.randomUUID)();
        const res = await fetch(`https://restapi.getui.com/v2/${appKey}/push/single/cid`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', token },
            body: JSON.stringify({
                request_id: requestId,
                audience: { cid: [cid] },
                push_message: { notification: { title, body, click_type: 'payload' } },
            }),
        });
        const data = await res.json();
        if (data.code !== 0) {
            throw new Error(`Getui push failed: ${data.msg}`);
        }
    }
};
exports.MessagePushService = MessagePushService;
exports.MessagePushService = MessagePushService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [core_1.TransactionalConnection])
], MessagePushService);
