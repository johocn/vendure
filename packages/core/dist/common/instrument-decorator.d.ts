export declare const ENABLE_INSTRUMENTATION_ENV_VAR = "VENDURE_ENABLE_INSTRUMENTATION";
/**
 * @description
 * This decorator is used to apply instrumentation to a class. It is intended to be used in conjunction
 * with an {@link InstrumentationStrategy} which defines how the instrumentation should be applied.
 *
 * In order for the instrumentation to be applied, the `VENDURE_ENABLE_INSTRUMENTATION` environment
 * variable (exported from the `@vendure/core` package as `ENABLE_INSTRUMENTATION_ENV_VAR`) must be set to `true`.
 * This is done to avoid the overhead of instrumentation in environments where it is not needed.
 *
 * :::warning
 * You should _not_ decorate GraphQL resolvers & REST controllers with this decorator. Those will
 * already be instrumented, and adding the `@Instrument()` decorator will potentially
 * interfere with other NestJS decorators on your resolver methods.
 * :::
 *
 * For more information on how instrumentation is used, see docs on the TelemetryPlugin.
 *
 * @example
 * ```ts
 * import { Instrument } from '\@vendure/core';
 * import { Injectable } from '\@nestjs/common';
 *
 * \@Injectable()
 * \@Instrument() // [!code highlight]
 * export class MyService {
 *
 *   // Calls to this method will be instrumented
 *   myMethod() {
 *     // ...
 *   }
 * }
 * ```
 *
 * @since 3.3.0
 * @docsCategory telemetry
 */
export declare function Instrument(): ClassDecorator;
/**
 * @description
 * This function is used to retrieve the original class of an instrumented class. It is intended for
 * use in an {@link InstrumentationStrategy} only, and should not generally be used in application code.
 *
 * @since 3.3.0
 */
export declare function getInstrumentedClassTarget<T>(input: T): T | undefined;
