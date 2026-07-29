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
exports.MultivendorResolver = void 0;
const graphql_1 = require("@nestjs/graphql");
const core_1 = require("@vendure/core");
const mv_service_1 = require("../service/mv.service");
let MultivendorResolver = class MultivendorResolver {
    constructor(multivendorService) {
        this.multivendorService = multivendorService;
    }
    registerNewSeller(ctx, args) {
        return this.multivendorService.registerNewSeller(ctx, args.input);
    }
};
exports.MultivendorResolver = MultivendorResolver;
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Transaction)(),
    (0, core_1.Allow)(core_1.Permission.Public),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", void 0)
], MultivendorResolver.prototype, "registerNewSeller", null);
exports.MultivendorResolver = MultivendorResolver = __decorate([
    (0, graphql_1.Resolver)(),
    __metadata("design:paramtypes", [mv_service_1.MultivendorService])
], MultivendorResolver);
//# sourceMappingURL=mv.resolver.js.map