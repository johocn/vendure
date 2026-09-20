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
exports.AdminTerminalResolver = void 0;
const common_1 = require("@nestjs/common");
const graphql_1 = require("@nestjs/graphql");
const core_1 = require("@vendure/core");
const constants_1 = require("../constants");
const pos_terminal_service_1 = require("../services/pos-terminal.service");
let AdminTerminalResolver = class AdminTerminalResolver {
    constructor(terminalService) {
        this.terminalService = terminalService;
    }
    async posTerminals(ctx, channelId) {
        return this.terminalService.findAll(channelId ? parseInt(channelId, 10) : undefined);
    }
    async posTerminal(id) {
        return this.terminalService.findOne(parseInt(id, 10));
    }
    async createPosTerminal(input, ctx) {
        var _a;
        return this.terminalService.create({
            code: input.code,
            name: input.name,
            channelId: Number(ctx.channelId),
            stockLocationId: parseInt(input.stockLocationId, 10),
            deviceConfig: (_a = input.deviceConfig) !== null && _a !== void 0 ? _a : null,
        });
    }
    async updatePosTerminal(input) {
        return this.terminalService.update(parseInt(input.id, 10), {
            name: input.name,
            stockLocationId: input.stockLocationId ? parseInt(input.stockLocationId, 10) : undefined,
            active: input.active,
            deviceConfig: input.deviceConfig,
        });
    }
    async deletePosTerminal(id) {
        const ok = await this.terminalService.delete(parseInt(id, 10));
        if (!ok)
            throw new core_1.UserInputError(`终端 ${id} 不存在`);
        return true;
    }
};
exports.AdminTerminalResolver = AdminTerminalResolver;
__decorate([
    (0, graphql_1.Query)(),
    (0, core_1.Allow)(core_1.Permission.ReadSettings, constants_1.posTerminalPermission.Read),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('channelId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, String]),
    __metadata("design:returntype", Promise)
], AdminTerminalResolver.prototype, "posTerminals", null);
__decorate([
    (0, graphql_1.Query)(),
    (0, core_1.Allow)(core_1.Permission.ReadSettings, constants_1.posTerminalPermission.Read),
    __param(0, (0, graphql_1.Args)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], AdminTerminalResolver.prototype, "posTerminal", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Allow)(core_1.Permission.CreateSettings, constants_1.posTerminalPermission.Create),
    __param(0, (0, graphql_1.Args)('input')),
    __param(1, (0, core_1.Ctx)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, core_1.RequestContext]),
    __metadata("design:returntype", Promise)
], AdminTerminalResolver.prototype, "createPosTerminal", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Allow)(core_1.Permission.UpdateSettings, constants_1.posTerminalPermission.Update),
    __param(0, (0, graphql_1.Args)('input')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], AdminTerminalResolver.prototype, "updatePosTerminal", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Allow)(core_1.Permission.DeleteSettings, constants_1.posTerminalPermission.Delete),
    __param(0, (0, graphql_1.Args)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], AdminTerminalResolver.prototype, "deletePosTerminal", null);
exports.AdminTerminalResolver = AdminTerminalResolver = __decorate([
    (0, graphql_1.Resolver)(),
    __param(0, (0, common_1.Inject)(pos_terminal_service_1.PosTerminalService)),
    __metadata("design:paramtypes", [pos_terminal_service_1.PosTerminalService])
], AdminTerminalResolver);
//# sourceMappingURL=admin-terminal.resolver.js.map