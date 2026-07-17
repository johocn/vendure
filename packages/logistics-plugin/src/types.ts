import { LogisticsTrackingProvider } from './tracking-provider';

export interface LogisticsPluginOptions {
    defaultShippingStrategy?: 'priority' | 'nearest' | 'stock-first';
    trackingProvider?: LogisticsTrackingProvider;
}
