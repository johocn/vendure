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
exports.SlugService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("../../config");
/**
 * @description
 * A service that handles slug generation using the configured SlugStrategy.
 *
 * @docsCategory services
 * @since 3.5.0
 */
let SlugService = class SlugService {
    constructor(configService) {
        this.configService = configService;
    }
    /**
     * @description
     * Generates a slug from the input string using the configured SlugStrategy.
     *
     * @param ctx The request context
     * @param params The parameters for slug generation
     * @returns A URL-friendly slug string
     */
    async generate(ctx, params) {
        const strategy = this.configService.entityOptions.slugStrategy;
        if (!strategy) {
            throw new Error('No SlugStrategy configured');
        }
        return strategy.generate(ctx, params);
    }
};
exports.SlugService = SlugService;
exports.SlugService = SlugService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], SlugService);
//# sourceMappingURL=slug.service.js.map