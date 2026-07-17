import { NodeSDKConfiguration } from '@opentelemetry/sdk-node';
/**
 * @description
 * Options for configuring the OpenTelemetry Node SDK.
 *
 * @docsCategory core plugins/TelemetryPlugin
 * @docsPage getSdkConfiguration
 */
export interface SdkConfigurationOptions {
    /**
     * @description
     * When set to `true`, the SDK will log spans to the console instead of sending them to an
     * exporter. This should just be used for debugging purposes.
     *
     * @default false
     */
    logToConsole?: boolean;
    /**
     * @description
     * The configuration object for the OpenTelemetry Node SDK.
     */
    config: Partial<NodeSDKConfiguration>;
}
/**
 * @description
 * Creates a configuration object for the OpenTelemetry Node SDK. This is used to set up a custom
 * preload script which must be run before the main Vendure server is loaded by means of the
 * Node.js `--require` flag.
 *
 * @example
 * ```ts
 * // instrumentation.ts
 * import { OTLPLogExporter } from '\@opentelemetry/exporter-logs-otlp-proto';
 * import { OTLPTraceExporter } from '\@opentelemetry/exporter-trace-otlp-http';
 * import { BatchLogRecordProcessor } from '\@opentelemetry/sdk-logs';
 * import { NodeSDK } from '\@opentelemetry/sdk-node';
 * import { BatchSpanProcessor } from '\@opentelemetry/sdk-trace-base';
 * import { getSdkConfiguration } from '\@vendure/telemetry-plugin/preload';
 *
 * process.env.OTEL_EXPORTER_OTLP_ENDPOINT = 'http://localhost:3100/otlp';
 * process.env.OTEL_LOGS_EXPORTER = 'otlp';
 * process.env.OTEL_RESOURCE_ATTRIBUTES = 'service.name=vendure-dev-server';
 *
 * const traceExporter = new OTLPTraceExporter({
 *     url: 'http://localhost:4318/v1/traces',
 * });
 * const logExporter = new OTLPLogExporter();
 *
 * const config = getSdkConfiguration({
 *     config: {
 *         spanProcessors: [new BatchSpanProcessor(traceExporter)],
 *         logRecordProcessors: [new BatchLogRecordProcessor(logExporter)],
 *     },
 * });
 *
 * const sdk = new NodeSDK(config);
 *
 * sdk.start();
 * ```
 *
 * This would them be run as:
 * ```bash
 * node --require ./dist/instrumentation.js ./dist/server.js
 * ```
 *
 * @docsCategory core plugins/TelemetryPlugin
 * @docsPage getSdkConfiguration
 * @docsWeight 0
 */
export declare function getSdkConfiguration(options?: SdkConfigurationOptions): Partial<NodeSDKConfiguration>;
