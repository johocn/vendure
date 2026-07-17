// ANSI color codes
const colors = {
    grey: '\x1b[90m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    reset: '\x1b[0m',
};
export const debugLogger = {
    info: (message) => {
        // eslint-disable-next-line no-console
        console.log(`[INFO] ${message}`);
    },
    warn: (message) => {
        // eslint-disable-next-line no-console
        console.warn(`${colors.yellow}[WARN] ${message}${colors.reset}`);
    },
    debug: (message) => {
        // eslint-disable-next-line no-console
        console.debug(`${colors.grey}[DEBUG] ${message}${colors.reset}`);
    },
    error: (message) => {
        // eslint-disable-next-line no-console
        console.error(`${colors.red}[ERROR] ${message}${colors.reset}`);
    },
};
export const noopLogger = {
    info: () => {
        /* noop */
    },
    warn: () => {
        /* noop */
    },
    debug: () => {
        /* noop */
    },
    error: () => {
        /* noop */
    },
};
