"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OtelInstrumentationStrategy = exports.tracer = void 0;
const api_1 = require("@opentelemetry/api");
const core_1 = require("@vendure/core");
const method_hooks_service_1 = require("../service/method-hooks.service");
exports.tracer = api_1.trace.getTracer('@vendure/core', core_1.VENDURE_VERSION);
const recordException = (span, error) => {
    span.recordException(error);
    span.setStatus({ code: api_1.SpanStatusCode.ERROR, message: error.message });
};
class OtelInstrumentationStrategy {
    init(injector) {
        this.spanAttributeService = injector.get(method_hooks_service_1.MethodHooksService);
    }
    wrapMethod({ instance, target, methodName, args, applyOriginalFunction }) {
        const spanName = `${String(target.name)}.${String(methodName)}`;
        return exports.tracer.startActiveSpan(spanName, {}, span => {
            var _a, _b;
            const hooks = (_a = this.spanAttributeService) === null || _a === void 0 ? void 0 : _a.getHooks(target, methodName);
            (_b = hooks === null || hooks === void 0 ? void 0 : hooks.pre) === null || _b === void 0 ? void 0 : _b.call(hooks, { args, span, instance });
            if (applyOriginalFunction.constructor.name === 'AsyncFunction') {
                return (applyOriginalFunction()
                    .then((result) => {
                    if (hooks === null || hooks === void 0 ? void 0 : hooks.post) {
                        hooks.post({ args, result, span, instance });
                    }
                    return result;
                })
                    // @ts-expect-error
                    .catch(error => {
                    recordException(span, error);
                    // Throw error to propagate it further
                    throw error;
                })
                    .finally(() => {
                    span.end();
                }));
            }
            try {
                const result = applyOriginalFunction();
                if (hooks === null || hooks === void 0 ? void 0 : hooks.post) {
                    hooks.post({ args, result, span, instance });
                }
                return result;
            }
            catch (error) {
                recordException(span, error);
                // throw for further propagation
                throw error;
            }
            finally {
                span.end();
            }
        });
    }
}
exports.OtelInstrumentationStrategy = OtelInstrumentationStrategy;
//# sourceMappingURL=otel-instrumentation-strategy.js.map