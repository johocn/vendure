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
exports.GraphiQLService = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@vendure/core");
/**
 * This service is responsible for providing GraphiQL configuration
 * and a fallback UI if needed.
 */
let GraphiQLService = class GraphiQLService {
    constructor(configService) {
        this.configService = configService;
    }
    /**
     * Get the Admin API URL
     */
    getAdminApiUrl() {
        const adminApiPath = this.configService.apiOptions.adminApiPath || 'admin-api';
        return this.createApiUrl(adminApiPath);
    }
    /**
     * Get the Shop API URL
     */
    getShopApiUrl() {
        const shopApiPath = this.configService.apiOptions.shopApiPath || 'shop-api';
        return this.createApiUrl(shopApiPath);
    }
    /**
     * Create a fully-qualified API URL
     */
    createApiUrl(apiPath) {
        // Get API host and port from the config
        const apiHost = this.configService.apiOptions.hostname || '';
        const apiPort = this.configService.apiOptions.port || '';
        const host = apiHost || '';
        const port = apiPort ? `:${apiPort}` : '';
        const pathUrl = apiPath.startsWith('/') ? apiPath : `/${apiPath}`;
        // If the host is specified, create a fully-qualified URL
        if (host) {
            const protocol = host.startsWith('https') ? '' : 'http://';
            return `${protocol}${host}${port}${pathUrl}`;
        }
        // Otherwise use a relative URL
        return pathUrl;
    }
};
exports.GraphiQLService = GraphiQLService;
exports.GraphiQLService = GraphiQLService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [core_1.ConfigService])
], GraphiQLService);
//# sourceMappingURL=graphiql.service.js.map