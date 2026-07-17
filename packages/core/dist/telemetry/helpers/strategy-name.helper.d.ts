/**
 * Gets the name of a strategy, resilient to code minification.
 * Prefers an explicit `name` property (e.g. AuthenticationStrategy.name),
 * then falls back to `constructor.name`. Returns 'unknown' if the name
 * appears to be minified (single char or empty).
 */
export declare function getStrategyName(strategy: object | null | undefined): string;
