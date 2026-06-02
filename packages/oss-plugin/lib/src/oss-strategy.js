"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.OssAssetStorageStrategy = void 0;
const core_1 = require("@vendure/core");
const ali_oss_1 = __importDefault(require("ali-oss"));
const constants_1 = require("./constants");
class OssAssetStorageStrategy {
    constructor(options) {
        this.client = new ali_oss_1.default({
            region: options.region,
            accessKeyId: options.accessKeyId,
            accessKeySecret: options.accessKeySecret,
            bucket: options.bucket,
            endpoint: options.endpoint,
        });
        this.pathPrefix = options.pathPrefix || '';
        this.customDomain = options.customDomain || '';
    }
    async writeFileFromBuffer(fileName, data) {
        const key = this.getKey(fileName);
        try {
            const result = await this.client.put(key, data);
            return this.toPublicUrl(result.name);
        }
        catch (e) {
            core_1.Logger.error(`OSS writeFileFromBuffer failed: ${e.message}`, constants_1.loggerCtx);
            throw e;
        }
    }
    async writeFileFromStream(fileName, data, encoding) {
        const key = this.getKey(fileName);
        try {
            const result = await this.client.putStream(key, data);
            return this.toPublicUrl(result.name);
        }
        catch (e) {
            core_1.Logger.error(`OSS writeFileFromStream failed: ${e.message}`, constants_1.loggerCtx);
            throw e;
        }
    }
    async readFileToBuffer(identifier) {
        const key = this.getKeyFromIdentifier(identifier);
        try {
            const result = await this.client.get(key);
            return result.content;
        }
        catch (e) {
            core_1.Logger.error(`OSS readFileToBuffer failed: ${e.message}`, constants_1.loggerCtx);
            throw e;
        }
    }
    async readFileToStream(identifier, encoding) {
        const key = this.getKeyFromIdentifier(identifier);
        try {
            const result = await this.client.getStream(key);
            return result.stream;
        }
        catch (e) {
            core_1.Logger.error(`OSS readFileToStream failed: ${e.message}`, constants_1.loggerCtx);
            throw e;
        }
    }
    async deleteFile(identifier) {
        const key = this.getKeyFromIdentifier(identifier);
        try {
            await this.client.delete(key);
        }
        catch (e) {
            core_1.Logger.error(`OSS deleteFile failed: ${e.message}`, constants_1.loggerCtx);
            throw e;
        }
    }
    async fileExists(fileName) {
        const key = this.getKey(fileName);
        try {
            await this.client.head(key);
            return true;
        }
        catch (_a) {
            return false;
        }
    }
    toAbsoluteUrl(request, identifier) {
        if (this.customDomain) {
            return `https://${this.customDomain}/${identifier}`;
        }
        return identifier;
    }
    getKey(fileName) {
        return this.pathPrefix ? `${this.pathPrefix}/${fileName}` : fileName;
    }
    getKeyFromIdentifier(identifier) {
        if (this.customDomain && identifier.startsWith(`https://${this.customDomain}/`)) {
            return identifier.replace(`https://${this.customDomain}/`, '');
        }
        if (identifier.startsWith('http')) {
            const url = new URL(identifier);
            return url.pathname.substring(1);
        }
        return identifier;
    }
    toPublicUrl(name) {
        if (this.customDomain) {
            return `https://${this.customDomain}/${name}`;
        }
        return name;
    }
}
exports.OssAssetStorageStrategy = OssAssetStorageStrategy;
//# sourceMappingURL=oss-strategy.js.map