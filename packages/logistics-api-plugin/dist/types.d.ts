export interface LogisticsApiPluginOptions {
    customer?: string;
    key?: string;
    cacheTtlMinutes?: number;
}
export interface TrackingResult {
    carrierCode: string;
    trackingNumber: string;
    traces: TrackingTrace[];
}
export interface TrackingTrace {
    time: string;
    status: string;
    description: string;
}
export interface CarrierDetectResult {
    code: string;
    name: string;
}
