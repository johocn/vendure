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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var TelemetryPlugin_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.TelemetryPlugin = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@vendure/core");
const default_method_hooks_1 = require("./config/default-method-hooks");
const otel_instrumentation_strategy_1 = require("./config/otel-instrumentation-strategy");
const otel_logger_1 = require("./config/otel-logger");
const constants_1 = require("./constants");
const method_hooks_service_1 = require("./service/method-hooks.service");
/**
 * @description
 * The TelemetryPlugin is used to instrument the Vendure application and collect telemetry data using
 * [OpenTelemetry](https://opentelemetry.io/).
 *
 * ## Installation
 *
 * ```
 * npm install \@vendure/telemetry-plugin
 * ```
 *
 * :::info
 * For a complete guide to setting up and working with Open Telemetry, see
 * the [Implementing Open Telemetry guide](/how-to/telemetry/).
 * :::
 *
 * ## Configuration
 *
 * The plugin is configured via the `TelemetryPlugin.init()` method. This method accepts an options object
 * which defines the OtelLogger options and method hooks.
 *
 * @example
 * ```ts
 * import { VendureConfig } from '\@vendure/core';
 * import { TelemetryPlugin, registerMethodHooks } from '\@vendure/telemetry-plugin';
 *
 * export const config: VendureConfig = {
 *   // ...
 *   plugins: [
 *     TelemetryPlugin.init({
 *       loggerOptions: {
 *         // Log to the console at the verbose level
 *         logToConsole: LogLevel.Verbose,
 *       },
 *     }),
 *   ],
 * };
 * ```
 *
 * ## Preloading the SDK
 *
 * In order to use the OpenTelemetry SDK, you must preload it before the Vendure server is started.
 * This is done by using the `--require` flag when starting the server with a custom preload script.
 *
 * Create a file named `instrumentation.ts` in the root of your project and add the following code:
 *
 * ```ts
 * import { OTLPLogExporter } from '\@opentelemetry/exporter-logs-otlp-proto';
 * import { OTLPTraceExporter } from '\@opentelemetry/exporter-trace-otlp-http';
 * import { BatchLogRecordProcessor } from '\@opentelemetry/sdk-logs';
 * import { NodeSDK } from '\@opentelemetry/sdk-node';
 * import { BatchSpanProcessor } from '\@opentelemetry/sdk-trace-base';
 * import { getSdkConfiguration } from '\@vendure/telemetry-plugin/preload';
 *
 * // In this example we are using Loki as the OTLP endpoint for logging
 * process.env.OTEL_EXPORTER_OTLP_ENDPOINT = 'http://localhost:3100/otlp';
 * process.env.OTEL_LOGS_EXPORTER = 'otlp';
 * process.env.OTEL_RESOURCE_ATTRIBUTES = 'service.name=vendure-dev-server';
 *
 * // We are using Jaeger as the OTLP endpoint for tracing
 * const traceExporter = new OTLPTraceExporter({
 *     url: 'http://localhost:4318/v1/traces',
 * });
 * const logExporter = new OTLPLogExporter();
 *
 * // The getSdkConfiguration method returns a configuration object for the OpenTelemetry Node SDK.
 * // It also performs other configuration tasks such as setting a special environment variable
 * // to enable instrumentation in the Vendure core code.
 * const config = getSdkConfiguration({
 *     config: {
 *         // Pass in any custom configuration options for the Node SDK here
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
 * The server would then be started with the following command:
 *
 * ```bash
 * node --require ./dist/instrumentation.js ./dist/server.js
 * ```
 *
 * or for development with ts-node:
 *
 * ```bash
 * npx ts-node --require ./src/instrumentation.ts ./src/server.ts
 * ```
 *
 * @since 3.3.0
 * @docsCategory core plugins/TelemetryPlugin
 */
let TelemetryPlugin = TelemetryPlugin_1 = class TelemetryPlugin {
    constructor(methodHooksService, options) {
        var _a;
        if (process.env[core_1.ENABLE_INSTRUMENTATION_ENV_VAR]) {
            const allMethodHooks = [...default_method_hooks_1.defaultMethodHooks, ...((_a = options.methodHooks) !== null && _a !== void 0 ? _a : [])];
            for (const methodHook of allMethodHooks) {
                methodHooksService.registerHooks(methodHook.target, methodHook.hooks);
            }
        }
    }
    static init(options) {
        TelemetryPlugin_1.options = options;
        return TelemetryPlugin_1;
    }
};
exports.TelemetryPlugin = TelemetryPlugin;
TelemetryPlugin.options = {};
exports.TelemetryPlugin = TelemetryPlugin = TelemetryPlugin_1 = __decorate([
    (0, core_1.VendurePlugin)({
        imports: [core_1.PluginCommonModule],
        providers: [
            method_hooks_service_1.MethodHooksService,
            {
                provide: constants_1.TELEMETRY_PLUGIN_OPTIONS,
                useFactory: () => TelemetryPlugin.options,
            },
        ],
        configuration: config => {
            var _a;
            config.systemOptions.instrumentationStrategy = new otel_instrumentation_strategy_1.OtelInstrumentationStrategy();
            config.logger = new otel_logger_1.OtelLogger((_a = TelemetryPlugin.options.loggerOptions) !== null && _a !== void 0 ? _a : {});
            return config;
        },
        compatibility: '>=3.3.0',
    }),
    __param(1, (0, common_1.Inject)(constants_1.TELEMETRY_PLUGIN_OPTIONS)),
    __metadata("design:paramtypes", [method_hooks_service_1.MethodHooksService, Object])
], TelemetryPlugin);
//# sourceMappingURL=telemetry.plugin.js.map