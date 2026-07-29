"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BaseApiKeyStrategy = exports.API_KEY_AUTH_STRATEGY_DEFAULT_DURATION_MS = exports.API_KEY_AUTH_STRATEGY_NAME = void 0;
const ms_1 = __importDefault(require("ms"));
/**
 * Needed to identify types of sessions when creating and deleting.
 *
 * @see {@link SessionService}
 */
exports.API_KEY_AUTH_STRATEGY_NAME = 'apikey';
/**
 * Since API-Keys build upon Vendures Session mechanism, we need to set a very long
 * default duration to mimic the "forever" nature of API-Keys.
 *
 * @unit Milliseconds
 * @see {@link SessionService}
 */
exports.API_KEY_AUTH_STRATEGY_DEFAULT_DURATION_MS = (0, ms_1.default)('100y');
/**
 * @description
 * Intended to be extended by consumers of the {@link ApiKeyStrategy} if they do not
 * require their own construction/parsing logic. Provides default implementations of
 * `constructApiKey`, `parse`, `delimiter`, and `lastUsedAtUpdateInterval`.
 *
 * @docsCategory auth
 * @docsPage ApiKeyStrategy
 */
class BaseApiKeyStrategy {
    constructor() {
        this.delimiter = ':';
        this.lastUsedAtUpdateInterval = 0;
    }
    constructApiKey(lookupId, secret) {
        return `${lookupId}${this.delimiter}${secret}`;
    }
    parse(token) {
        if (!token) {
            return null;
        }
        const [lookupId, apiKey] = token.split(this.delimiter, 2);
        if (!lookupId || !apiKey) {
            return null;
        }
        return { lookupId, apiKey };
    }
}
exports.BaseApiKeyStrategy = BaseApiKeyStrategy;
//# sourceMappingURL=api-key-strategy.js.map