"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OtelLogger = exports.otelLogger = void 0;
const api_logs_1 = require("@opentelemetry/api-logs");
const core_1 = require("@vendure/core");
exports.otelLogger = api_logs_1.logs.getLogger('@vendure/core', core_1.VENDURE_VERSION);
/**
 * @description
 * A logger that emits logs to OpenTelemetry and optionally to the console.
 *
 * @since 3.3.0
 * @docsCategory core plugins/TelemetryPlugin
 * @docsPage OtelLogger
 * @docsWeight 0
 */
class OtelLogger {
    constructor(options) {
        if (options.logToConsole) {
            this.defaultLogger = new core_1.DefaultLogger({
                level: options.logToConsole,
                timestamp: false,
            });
        }
    }
    debug(message, context) {
        var _a;
        this.emitLog(api_logs_1.SeverityNumber.DEBUG, message, context);
        (_a = this.defaultLogger) === null || _a === void 0 ? void 0 : _a.debug(message, context);
    }
    warn(message, context) {
        var _a;
        this.emitLog(api_logs_1.SeverityNumber.WARN, message, context);
        (_a = this.defaultLogger) === null || _a === void 0 ? void 0 : _a.warn(message, context);
    }
    info(message, context) {
        var _a;
        this.emitLog(api_logs_1.SeverityNumber.INFO, message, context);
        (_a = this.defaultLogger) === null || _a === void 0 ? void 0 : _a.info(message, context);
    }
    error(message, context) {
        var _a;
        this.emitLog(api_logs_1.SeverityNumber.ERROR, message, context);
        (_a = this.defaultLogger) === null || _a === void 0 ? void 0 : _a.error(message, context);
    }
    verbose(message, context) {
        var _a;
        this.emitLog(api_logs_1.SeverityNumber.DEBUG, message, context);
        (_a = this.defaultLogger) === null || _a === void 0 ? void 0 : _a.verbose(message, context);
    }
    emitLog(severityNumber, message, context, label) {
        exports.otelLogger.emit({
            severityNumber,
            body: message,
            attributes: Object.assign({ context, service_name: 'vendure' }, (label ? { label } : {})),
        });
    }
}
exports.OtelLogger = OtelLogger;
//# sourceMappingURL=otel-logger.js.map