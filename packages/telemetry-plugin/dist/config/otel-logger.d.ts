import { LogLevel, VendureLogger } from '@vendure/core';
export declare const otelLogger: import("@opentelemetry/api-logs").Logger;
/**
 * @description
 * Options for the OtelLogger.
 *
 * @since 3.3.0
 * @docsCategory core plugins/TelemetryPlugin
 * @docsPage OtelLogger
 */
export interface OtelLoggerOptions {
    /**
     * @description
     * If set to a LogLevel, the logger will also log to the console.
     * This can be useful for local development or debugging.
     *
     * @example
     * ```ts
     * import { LogLevel } from '@vendure/core';
     * import { TelemetryPlugin } from '@vendure/telemetry-plugin';
     *
     * // ...
     *
     * TelemetryPlugin.init({
     *   loggerOptions: {
     *     logToConsole: LogLevel.Verbose,
     *   },
     * });
     * ```
     */
    logToConsole?: LogLevel;
}
/**
 * @description
 * A logger that emits logs to OpenTelemetry and optionally to the console.
 *
 * @since 3.3.0
 * @docsCategory core plugins/TelemetryPlugin
 * @docsPage OtelLogger
 * @docsWeight 0
 */
export declare class OtelLogger implements VendureLogger {
    private defaultLogger?;
    constructor(options: OtelLoggerOptions);
    debug(message: string, context?: string): void;
    warn(message: string, context?: string): void;
    info(message: string, context?: string): void;
    error(message: string, context?: string): void;
    verbose(message: string, context?: string): void;
    private emitLog;
}
