import { Injector, InstrumentationStrategy, WrappedMethodArgs } from '@vendure/core';
export declare const tracer: import("@opentelemetry/api").Tracer;
export declare class OtelInstrumentationStrategy implements InstrumentationStrategy {
    private spanAttributeService;
    init(injector: Injector): void;
    wrapMethod({ instance, target, methodName, args, applyOriginalFunction }: WrappedMethodArgs): any;
}
