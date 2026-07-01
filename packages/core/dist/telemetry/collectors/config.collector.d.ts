import { ConfigService } from '../../config/config.service';
import { TelemetryConfig } from '../telemetry.types';
/**
 * Collects configuration information for telemetry.
 * Only collects strategy class names and non-sensitive configuration values.
 */
export declare class ConfigCollector {
    private readonly configService;
    constructor(configService: ConfigService);
    collect(): TelemetryConfig;
    private getDefaultLanguage;
    private getAssetStorageType;
    private getJobQueueType;
    private getEntityIdStrategy;
    private getAuthenticationMethods;
    private getMoneyStrategy;
    private getCacheStrategy;
    private getTaxLineCalculationStrategy;
    private getOrderSellerStrategy;
    private getPaymentHandlerCodes;
    private getShippingCalculatorCodes;
    private getFulfillmentHandlerCodes;
    private getPromotionConditionCount;
    private getPromotionActionCount;
    private getScheduledTaskCount;
    private getCustomFieldsPerEntity;
    private hasCustomOrderProcess;
    private hasCustomPaymentProcess;
    private hasCustomFulfillmentProcess;
}
