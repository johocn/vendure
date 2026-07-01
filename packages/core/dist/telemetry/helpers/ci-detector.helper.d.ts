/**
 * CI environment variables to check for.
 * These are standard environment variables set by popular CI/CD systems.
 * Exported for testing purposes.
 */
export declare const CI_ENV_VARS: string[];
/**
 * Detects if the current process is running in a CI/CD environment.
 * Returns true if any known CI environment variable is set.
 */
export declare function isCI(): boolean;
