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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TcmCryptoService = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@vendure/core");
const node_crypto_1 = require("node:crypto");
const constants_1 = require("../constants");
let TcmCryptoService = class TcmCryptoService {
    constructor(options) {
        var _a, _b;
        const hex = (_b = (_a = options.encryptionKey) !== null && _a !== void 0 ? _a : process.env.TCM_RECORD_KEY) !== null && _b !== void 0 ? _b : '';
        if (/^[0-9a-fA-F]{64}$/.test(hex)) {
            this.key = Buffer.from(hex, 'hex');
        }
        else {
            // 仅限开发环境：无密钥时用固定开发密钥派生 32 字节并告警
            core_1.Logger.warn('TCM_RECORD_KEY 未配置，使用开发密钥（禁止用于生产）', constants_1.loggerCtx);
            this.key = (0, node_crypto_1.createHash)('sha256').update('tcm-clinic-plugin-dev-key').digest();
        }
    }
    encrypt(plain) {
        const iv = (0, node_crypto_1.randomBytes)(12);
        const cipher = (0, node_crypto_1.createCipheriv)('aes-256-gcm', this.key, iv);
        const data = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
        const tag = cipher.getAuthTag();
        return `${iv.toString('base64')}.${tag.toString('base64')}.${data.toString('base64')}`;
    }
    decrypt(payload) {
        const [ivB64, tagB64, dataB64] = payload.split('.');
        if (!ivB64 || !tagB64 || !dataB64) {
            throw new Error('密文格式非法');
        }
        const decipher = (0, node_crypto_1.createDecipheriv)('aes-256-gcm', this.key, Buffer.from(ivB64, 'base64'));
        decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
        return Buffer.concat([decipher.update(Buffer.from(dataB64, 'base64')), decipher.final()]).toString('utf8');
    }
};
exports.TcmCryptoService = TcmCryptoService;
exports.TcmCryptoService = TcmCryptoService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(constants_1.TCM_PLUGIN_OPTIONS)),
    __metadata("design:paramtypes", [Object])
], TcmCryptoService);
//# sourceMappingURL=tcm-crypto.service.js.map