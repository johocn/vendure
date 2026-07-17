"use strict";
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSdkConfiguration = getSdkConfiguration;
const auto_instrumentations_node_1 = require("@opentelemetry/auto-instrumentations-node");
const context_async_hooks_1 = require("@opentelemetry/context-async-hooks");
const exporter_logs_otlp_proto_1 = require("@opentelemetry/exporter-logs-otlp-proto");
const exporter_trace_otlp_http_1 = require("@opentelemetry/exporter-trace-otlp-http");
const resources_1 = require("@opentelemetry/resources");
const sdk_logs_1 = require("@opentelemetry/sdk-logs");
const sdk_trace_base_1 = require("@opentelemetry/sdk-trace-base");
// Deep import is intentional: otherwise unwanted code (such as instrumented classes) will get
// loaded too early before the Otel instrumentation has had a chance to do its thing.
const instrument_decorator_1 = require("@vendure/core/dist/common/instrument-decorator");
const traceExporter = new exporter_trace_otlp_http_1.OTLPTraceExporter();
const logExporter = new exporter_logs_otlp_proto_1.OTLPLogExporter();
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
function getSdkConfiguration(options) {
    var _a;
    // This environment variable is used to enable instrumentation in the Vendure core code.
    // Without setting this env var, no instrumentation will be applied to any Vendure classes.
    process.env[instrument_decorator_1.ENABLE_INSTRUMENTATION_ENV_VAR] = 'true';
    const _b = (_a = options === null || options === void 0 ? void 0 : options.config) !== null && _a !== void 0 ? _a : {}, { spanProcessors, logRecordProcessors } = _b, rest = __rest(_b, ["spanProcessors", "logRecordProcessors"]);
    const devModeAwareConfig = (options === null || options === void 0 ? void 0 : options.logToConsole)
        ? {
            spanProcessors: [new sdk_trace_base_1.SimpleSpanProcessor(new sdk_trace_base_1.ConsoleSpanExporter())],
            logRecordProcessors: [new sdk_logs_1.SimpleLogRecordProcessor(new sdk_logs_1.ConsoleLogRecordExporter())],
        }
        : {
            spanProcessors: spanProcessors !== null && spanProcessors !== void 0 ? spanProcessors : [new sdk_trace_base_1.BatchSpanProcessor(traceExporter)],
            logRecordProcessors: logRecordProcessors !== null && logRecordProcessors !== void 0 ? logRecordProcessors : [new sdk_logs_1.BatchLogRecordProcessor(logExporter)],
        };
    return Object.assign(Object.assign(Object.assign({ resource: (0, resources_1.resourceFromAttributes)({
            'service.name': 'vendure',
            'service.namespace': 'vendure',
            'service.environment': process.env.NODE_ENV || 'development',
        }) }, devModeAwareConfig), { contextManager: new context_async_hooks_1.AsyncLocalStorageContextManager(), instrumentations: [(0, auto_instrumentations_node_1.getNodeAutoInstrumentations)()] }), rest);
}
//# sourceMappingURL=instrumentation.js.map