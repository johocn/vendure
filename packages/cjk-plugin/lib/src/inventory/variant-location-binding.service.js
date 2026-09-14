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
exports.VariantLocationBindingService = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@vendure/core");
const typeorm_1 = require("typeorm");
const variant_location_binding_entity_1 = require("./variant-location-binding.entity");
let VariantLocationBindingService = class VariantLocationBindingService {
    constructor(connection) {
        this.connection = connection;
    }
    findByVariant(variantId) {
        return this.connection
            .getRepository(undefined, variant_location_binding_entity_1.VariantLocationBinding)
            .find({ where: { variantId: variantId } });
    }
    findByVariants(variantIds) {
        return this.connection
            .getRepository(undefined, variant_location_binding_entity_1.VariantLocationBinding)
            .find({ where: { variantId: (0, typeorm_1.In)(variantIds.map(String)) } });
    }
};
exports.VariantLocationBindingService = VariantLocationBindingService;
exports.VariantLocationBindingService = VariantLocationBindingService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [core_1.TransactionalConnection])
], VariantLocationBindingService);
//# sourceMappingURL=variant-location-binding.service.js.map