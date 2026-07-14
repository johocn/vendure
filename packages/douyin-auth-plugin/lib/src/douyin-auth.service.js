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
exports.DouyinAuthService = void 0;
const common_1 = require("@nestjs/common");
let DouyinAuthService = class DouyinAuthService {
    constructor(options) {
        this.options = options;
    }
    async getOpenidByCode(code) {
        const appId = this.options.miniProgramAppId || this.options.appId;
        const secret = this.options.miniProgramAppSecret || this.options.appSecret;
        const response = await fetch('https://developer.toutiao.com/api/apps/v2/jscode2session', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ appid: appId, secret, code }),
        });
        const data = (await response.json());
        return data.openid;
    }
};
exports.DouyinAuthService = DouyinAuthService;
exports.DouyinAuthService = DouyinAuthService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [Object])
], DouyinAuthService);
//# sourceMappingURL=douyin-auth.service.js.map