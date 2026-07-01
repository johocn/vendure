export interface SystemInfo {
    nodeVersion: string;
    platform: string;
}
/**
 * Collects basic system information for telemetry.
 */
export declare class SystemInfoCollector {
    collect(): SystemInfo;
}
