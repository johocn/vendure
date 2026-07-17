"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RandomBytesApiKeyStrategy = exports.DEFAULT_LAST_USED_AT_UPDATE_INTERVAL = exports.DEFAULT_SIZE_RANDOM_BYTES_LOOKUP = exports.DEFAULT_SIZE_RANDOM_BYTES_SECRET = void 0;
const node_crypto_1 = require("node:crypto");
const bcrypt_password_hashing_strategy_1 = require("../auth/bcrypt-password-hashing-strategy");
const api_key_strategy_1 = require("./api-key-strategy");
exports.DEFAULT_SIZE_RANDOM_BYTES_SECRET = 32;
exports.DEFAULT_SIZE_RANDOM_BYTES_LOOKUP = 12;
exports.DEFAULT_LAST_USED_AT_UPDATE_INTERVAL = 0;
/**
 * @description
 * A generation strategy that uses `node:crypto` to generate random hex strings for API-Keys via `randomBytes`.
 *
 * This strategy defines API-Keys where both parts are the aforementioned random bytes like so:
 *
 * ```text
 * <lookupId>:<apiKey>
 * ```
 *
 * Note the colon `':'` delimiter between the lookup ID and the api key.
 *
 * @docsCategory auth
 * @docsPage ApiKeyStrategy
 * @since 3.6.0
 */
class RandomBytesApiKeyStrategy extends api_key_strategy_1.BaseApiKeyStrategy {
    constructor(input) {
        var _a, _b, _c, _d;
        super();
        this.secretSize = (_a = input === null || input === void 0 ? void 0 : input.secretSize) !== null && _a !== void 0 ? _a : exports.DEFAULT_SIZE_RANDOM_BYTES_SECRET;
        this.lookupSize = (_b = input === null || input === void 0 ? void 0 : input.lookupSize) !== null && _b !== void 0 ? _b : exports.DEFAULT_SIZE_RANDOM_BYTES_LOOKUP;
        this.lastUsedAtUpdateInterval =
            (_c = input === null || input === void 0 ? void 0 : input.lastUsedAtUpdateInterval) !== null && _c !== void 0 ? _c : exports.DEFAULT_LAST_USED_AT_UPDATE_INTERVAL;
        this.hashingStrategy = (_d = input === null || input === void 0 ? void 0 : input.hashingStrategy) !== null && _d !== void 0 ? _d : new bcrypt_password_hashing_strategy_1.BcryptPasswordHashingStrategy();
    }
    generateSecret(ctx) {
        return this.promisifyRandomBytes(this.secretSize);
    }
    generateLookupId(ctx) {
        return this.promisifyRandomBytes(this.lookupSize);
    }
    promisifyRandomBytes(size) {
        return new Promise((resolve, reject) => {
            (0, node_crypto_1.randomBytes)(size, (err, buf) => {
                if (err) {
                    reject(err);
                }
                else {
                    resolve(buf.toString('hex'));
                }
            });
        });
    }
}
exports.RandomBytesApiKeyStrategy = RandomBytesApiKeyStrategy;
//# sourceMappingURL=random-bytes-api-key-strategy.js.map