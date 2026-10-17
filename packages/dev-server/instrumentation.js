"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const exporter_logs_otlp_proto_1 = require("@opentelemetry/exporter-logs-otlp-proto");
const exporter_trace_otlp_http_1 = require("@opentelemetry/exporter-trace-otlp-http");
const sdk_logs_1 = require("@opentelemetry/sdk-logs");
const sdk_node_1 = require("@opentelemetry/sdk-node");
const sdk_trace_base_1 = require("@opentelemetry/sdk-trace-base");
const preload_1 = require("@vendure/telemetry-plugin/preload");
process.env.OTEL_EXPORTER_OTLP_ENDPOINT = 'http://localhost:3100/otlp';
process.env.OTEL_LOGS_EXPORTER = 'otlp';
process.env.OTEL_RESOURCE_ATTRIBUTES = 'service.name=vendure-dev-server';
const traceExporter = new exporter_trace_otlp_http_1.OTLPTraceExporter({
    url: 'http://localhost:4318/v1/traces',
});
const logExporter = new exporter_logs_otlp_proto_1.OTLPLogExporter();
const config = (0, preload_1.getSdkConfiguration)({
    config: {
        spanProcessors: [new sdk_trace_base_1.BatchSpanProcessor(traceExporter)],
        logRecordProcessors: [new sdk_logs_1.BatchLogRecordProcessor(logExporter)],
    },
});
const sdk = new sdk_node_1.NodeSDK(config);
sdk.start();
//# sourceMappingURL=instrumentation.js.map