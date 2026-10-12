"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SmsService = void 0;
const node_crypto_1 = require("node:crypto");
const common_1 = require("@nestjs/common");
const dysmsapi20170525_1 = __importStar(require("@alicloud/dysmsapi20170525"));
const openapi_client_1 = require("@alicloud/openapi-client");
const core_1 = require("@vendure/core");
const constants_1 = require("./constants");
const SEND_COOLDOWN_MS = 60000; // 同号发码冷却
const DAILY_SEND_LIMIT = 10; // 同号每日发码上限
const MAX_VERIFY_FAILURES = 5; // 同一验证码连续失败 N 次后作废
let SmsService = class SmsService {
    constructor(options) {
        this.signName = options.signName;
        this.templateCode = options.templateCode;
        this.codeLength = options.codeLength || 6;
        this.codeExpirySeconds = options.codeExpirySeconds || 300;
        this.codeStore = new Map();
        this.sendCooldowns = new Map();
        this.dailyCounts = new Map();
        this.clients = new Map();
        // 生产环境强制关闭 devBypass 后门（防环境变量误配导致任意手机号接管账号）
        this.devBypass = options.devBypass || false;
        if (this.devBypass && process.env.NODE_ENV === 'production') {
            core_1.Logger.warn('devBypass is ignored in production', constants_1.loggerCtx);
            this.devBypass = false;
        }
        this.devBypassCode = options.devBypassCode || '123456';
    }
    /** 判定能否立即发码；返回 null 表示放行，否则返回拒绝原因（供日志） */
    checkRateLimit(phoneNumber) {
        this.sweepExpired(phoneNumber);
        const last = this.sendCooldowns.get(phoneNumber);
        if (last && Date.now() - last < SEND_COOLDOWN_MS) {
            return 'cooldown';
        }
        const dayKey = `${phoneNumber}:${this.dayKey()}`;
        if ((this.dailyCounts.get(dayKey) || 0) >= DAILY_SEND_LIMIT) {
            return 'daily-limit';
        }
        return null;
    }
    async sendVerificationCode(phoneNumber, credentials) {
        var _a, _b;
        const code = this.generateCode();
        this.codeStore.set(phoneNumber, {
            code,
            expiresAt: Date.now() + this.codeExpirySeconds * 1000,
            failures: 0,
        });
        this.sendCooldowns.set(phoneNumber, Date.now());
        const dayKey = `${phoneNumber}:${this.dayKey()}`;
        this.dailyCounts.set(dayKey, (this.dailyCounts.get(dayKey) || 0) + 1);
        if (this.devBypass) {
            core_1.Logger.info(`[DEV BYPASS] Verification code for ${phoneNumber}: ${code}`, constants_1.loggerCtx);
            return true;
        }
        const creds = credentials || {
            accessKeyId: '',
            accessKeySecret: '',
            signName: this.signName,
            templateCode: this.templateCode,
        };
        // 兜底凭证缺失（未配置短信/租户覆盖也不完整）时，验证码仅存内存不发真实短信
        if (!creds.accessKeyId || !creds.accessKeySecret) {
            core_1.Logger.warn(`SMS credentials missing, code stored without sending (${phoneNumber})`, constants_1.loggerCtx);
            return false;
        }
        try {
            const client = this.getClient(creds);
            const request = new dysmsapi20170525_1.SendSmsRequest({
                phoneNumbers: phoneNumber,
                signName: creds.signName,
                templateCode: creds.templateCode,
                templateParam: JSON.stringify({ code }),
            });
            const result = await client.sendSms(request);
            if (((_a = result.body) === null || _a === void 0 ? void 0 : _a.code) === 'OK') {
                core_1.Logger.info(`SMS sent to ${phoneNumber}`, constants_1.loggerCtx);
                return true;
            }
            core_1.Logger.error(`SMS send failed: ${(_b = result.body) === null || _b === void 0 ? void 0 : _b.message}`, constants_1.loggerCtx);
            return false;
        }
        catch (e) {
            core_1.Logger.error(`SMS send error: ${e.message}`, constants_1.loggerCtx);
            return false;
        }
    }
    verifyCode(phoneNumber, code) {
        const stored = this.codeStore.get(phoneNumber);
        if (!stored)
            return false;
        if (Date.now() > stored.expiresAt) {
            this.codeStore.delete(phoneNumber);
            return false;
        }
        // 连续失败超过阈值则作废当前验证码（防 6 位码暴力枚举），需重新发码
        if (stored.code === code) {
            this.codeStore.delete(phoneNumber);
            return true;
        }
        stored.failures += 1;
        if (stored.failures >= MAX_VERIFY_FAILURES) {
            this.codeStore.delete(phoneNumber);
            core_1.Logger.warn(`Verification code invalidated after ${stored.failures} failures (${phoneNumber})`, constants_1.loggerCtx);
            return false;
        }
        if (this.devBypass && code === this.devBypassCode) {
            this.codeStore.delete(phoneNumber);
            core_1.Logger.info(`[DEV BYPASS] Accepted bypass code for ${phoneNumber}`, constants_1.loggerCtx);
            return true;
        }
        return false;
    }
    /** devBypass 透传（registerCustomer 等调用方需要知道验证流程是否在旁路模式） */
    isDevBypass() {
        return this.devBypass;
    }
    getClient(creds) {
        const fingerprint = `${creds.accessKeyId}:${creds.accessKeySecret}`;
        let client = this.clients.get(fingerprint);
        if (!client) {
            client = new dysmsapi20170525_1.default(new openapi_client_1.Config({
                accessKeyId: creds.accessKeyId,
                accessKeySecret: creds.accessKeySecret,
                endpoint: 'dysmsapi.aliyuncs.com',
            }));
            this.clients.set(fingerprint, client);
        }
        return client;
    }
    generateCode() {
        let code = '';
        for (let i = 0; i < this.codeLength; i++) {
            code += String((0, node_crypto_1.randomInt)(0, 10));
        }
        return code;
    }
    /** 本地时区当日键（如 20261012） */
    dayKey() {
        const d = new Date();
        return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
    }
    /** 惰性清理：该号的过期验证码/冷却记录 + 全局过载兜底清扫 */
    sweepExpired(phoneNumber) {
        if (phoneNumber && this.codeStore.has(phoneNumber)) {
            const stored = this.codeStore.get(phoneNumber);
            if (Date.now() > stored.expiresAt)
                this.codeStore.delete(phoneNumber);
        }
        if (this.codeStore.size > 10000) {
            const now = Date.now();
            for (const [k, v] of this.codeStore) {
                if (now > v.expiresAt)
                    this.codeStore.delete(k);
            }
        }
        if (this.sendCooldowns.size > 10000) {
            const now = Date.now();
            for (const [k, t] of this.sendCooldowns) {
                if (now - t >= SEND_COOLDOWN_MS)
                    this.sendCooldowns.delete(k);
            }
        }
        if (this.dailyCounts.size > 50000) {
            const today = this.dayKey();
            for (const k of this.dailyCounts.keys()) {
                if (!k.endsWith(`:${today}`))
                    this.dailyCounts.delete(k);
            }
        }
    }
};
exports.SmsService = SmsService;
exports.SmsService = SmsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [Object])
], SmsService);
//# sourceMappingURL=sms.service.js.map