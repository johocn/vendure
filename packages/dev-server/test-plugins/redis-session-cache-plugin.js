"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RedisSessionCachePlugin = exports.RedisSessionCacheStrategy = void 0;
const core_1 = require("@vendure/core");
const ioredis_1 = require("ioredis");
const loggerCtx = 'RedisSessionCacheStrategy';
const DEFAULT_NAMESPACE = 'vendure-session-cache';
class RedisSessionCacheStrategy {
    constructor(options) {
        this.options = options;
    }
    init() {
        this.client = new ioredis_1.Redis(this.options.redisOptions);
        this.client.on('error', err => core_1.Logger.error(err.message, loggerCtx, err.stack));
    }
    async destroy() {
        await this.client.quit();
    }
    async get(sessionToken) {
        try {
            const retrieved = await this.client.get(this.namespace(sessionToken));
            if (retrieved) {
                try {
                    return JSON.parse(retrieved);
                }
                catch (e) {
                    core_1.Logger.error(`Could not parse cached session data: ${e.message}`, loggerCtx);
                }
            }
        }
        catch (e) {
            core_1.Logger.error(`Could not get cached session: ${e.message}`, loggerCtx);
        }
    }
    async set(session) {
        try {
            await this.client.set(this.namespace(session.token), JSON.stringify(session));
        }
        catch (e) {
            core_1.Logger.error(`Could not set cached session: ${e.message}`, loggerCtx);
        }
    }
    async delete(sessionToken) {
        try {
            await this.client.del(this.namespace(sessionToken));
        }
        catch (e) {
            core_1.Logger.error(`Could not delete cached session: ${e.message}`, loggerCtx);
        }
    }
    clear() {
        // not implemented
    }
    namespace(key) {
        var _a;
        return `${(_a = this.options.namespace) !== null && _a !== void 0 ? _a : DEFAULT_NAMESPACE}:${key}`;
    }
}
exports.RedisSessionCacheStrategy = RedisSessionCacheStrategy;
let RedisSessionCachePlugin = class RedisSessionCachePlugin {
    static init(options) {
        this.options = options;
        return this;
    }
};
exports.RedisSessionCachePlugin = RedisSessionCachePlugin;
exports.RedisSessionCachePlugin = RedisSessionCachePlugin = __decorate([
    (0, core_1.VendurePlugin)({
        configuration: config => {
            config.authOptions.sessionCacheStrategy = new RedisSessionCacheStrategy(RedisSessionCachePlugin.options);
            return config;
        },
    })
], RedisSessionCachePlugin);
//# sourceMappingURL=redis-session-cache-plugin.js.map