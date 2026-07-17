import { ConfigService } from '@vendure/core';
/**
 * This service is responsible for providing GraphiQL configuration
 * and a fallback UI if needed.
 */
export declare class GraphiQLService {
    private configService;
    constructor(configService: ConfigService);
    /**
     * Get the Admin API URL
     */
    getAdminApiUrl(): string;
    /**
     * Get the Shop API URL
     */
    getShopApiUrl(): string;
    /**
     * Create a fully-qualified API URL
     */
    private createApiUrl;
}
