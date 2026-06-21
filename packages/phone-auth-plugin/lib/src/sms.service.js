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
const common_1 = require("@nestjs/common");
const dysmsapi20170525_1 = __importStar(require("@alicloud/dysmsapi20170525"));
const openapi_client_1 = require("@alicloud/openapi-client");
const core_1 = require("@vendure/core");
const constants_1 = require("./constants");
let SmsService = class SmsService {
    constructor(options) {
        const config = new openapi_client_1.Config({
            accessKeyId: options.accessKeyId,
            accessKeySecret: options.accessKeySecret,
            endpoint: 'dysmsapi.aliyuncs.com',
        });
        this.client = new dysmsapi20170525_1.default(config);
        this.signName = options.signName;
        this.templateCode = options.templateCode;
        this.codeLength = options.codeLength || 6;
        this.codeExpirySeconds = options.codeExpirySeconds || 300;
        this.codeStore = new Map();
        this.devBypass = options.devBypass || false;
        this.devBypassCode = options.devBypassCode || '123456';
    }
    async sendVerificationCode(phoneNumber) {
        var _a, _b;
        const code = this.generateCode();
        this.codeStore.set(phoneNumber, {
            code,
            expiresAt: Date.now() + this.codeExpirySeconds * 1000,
        });
        if (this.devBypass) {
            core_1.Logger.info(`[DEV BYPASS] Verification code for ${phoneNumber}: ${code}`, constants_1.loggerCtx);
            return true;
        }
        try {
            const request = new dysmsapi20170525_1.SendSmsRequest({
                phoneNumbers: phoneNumber,
                signName: this.signName,
                templateCode: this.templateCode,
                templateParam: JSON.stringify({ code }),
            });
            const result = await this.client.sendSms(request);
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
        if (stored.code === code) {
            this.codeStore.delete(phoneNumber);
            return true;
        }
        if (this.devBypass && code === this.devBypassCode) {
            this.codeStore.delete(phoneNumber);
            core_1.Logger.info(`[DEV BYPASS] Accepted bypass code for ${phoneNumber}`, constants_1.loggerCtx);
            return true;
        }
        return false;
    }
    generateCode() {
        const digits = '0123456789';
        let code = '';
        for (let i = 0; i < this.codeLength; i++) {
            code += digits[Math.floor(Math.random() * 10)];
        }
        return code;
    }
};
exports.SmsService = SmsService;
exports.SmsService = SmsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [Object])
], SmsService);
//# sourceMappingURL=sms.service.js.map