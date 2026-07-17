"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __asyncValues = (this && this.__asyncValues) || function (o) {
    if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
    var m = o[Symbol.asyncIterator], i;
    return m ? m.call(o) : (o = typeof __values === "function" ? __values(o) : o[Symbol.iterator](), i = {}, verb("next"), verb("throw"), verb("return"), i[Symbol.asyncIterator] = function () { return this; }, i);
    function verb(n) { i[n] = o[n] && function (v) { return new Promise(function (resolve, reject) { v = o[n](v), settle(resolve, reject, v.done, v.value); }); }; }
    function settle(resolve, reject, d, v) { Promise.resolve(v).then(function(v) { resolve({ value: v, done: d }); }, reject); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.S3AssetStorageStrategy = void 0;
exports.configureS3AssetStorage = configureS3AssetStorage;
const core_1 = require("@vendure/core");
const path = __importStar(require("node:path"));
const node_stream_1 = require("node:stream");
const common_1 = require("../common");
const constants_1 = require("../constants");
/**
 * @description
 * Returns a configured instance of the {@link S3AssetStorageStrategy} which can then be passed to the {@link AssetServerOptions}
 * `storageStrategyFactory` property.
 *
 * Before using this strategy, make sure you have the `@aws-sdk/client-s3` and `@aws-sdk/lib-storage` package installed:
 *
 * ```sh
 * npm install \@aws-sdk/client-s3 \@aws-sdk/lib-storage
 * ```
 *
 * @example
 * ```ts
 * import { AssetServerPlugin, configureS3AssetStorage } from '\@vendure/asset-server-plugin';
 * import { DefaultAssetNamingStrategy } from '\@vendure/core';
 * import { fromEnv } from '\@aws-sdk/credential-providers';
 *
 * // ...
 *
 * plugins: [
 *   AssetServerPlugin.init({
 *     route: 'assets',
 *     assetUploadDir: path.join(__dirname, 'assets'),
 *     namingStrategy: new DefaultAssetNamingStrategy(),
 *     storageStrategyFactory: configureS3AssetStorage({
 *       bucket: 'my-s3-bucket',
 *       credentials: fromEnv(), // or any other credential provider
 *       nativeS3Configuration: {
 *         region: process.env.AWS_REGION,
 *       },
 *     }),
 * }),
 * ```
 *
 * ## Usage with MinIO
 *
 * Reference: [How to use AWS SDK for Javascript with MinIO Server](https://docs.min.io/docs/how-to-use-aws-sdk-for-javascript-with-minio-server.html)
 *
 * @example
 * ```ts
 * import { AssetServerPlugin, configureS3AssetStorage } from '\@vendure/asset-server-plugin';
 * import { DefaultAssetNamingStrategy } from '\@vendure/core';
 *
 * // ...
 *
 * plugins: [
 *   AssetServerPlugin.init({
 *     route: 'assets',
 *     assetUploadDir: path.join(__dirname, 'assets'),
 *     namingStrategy: new DefaultAssetNamingStrategy(),
 *     storageStrategyFactory: configureS3AssetStorage({
 *       bucket: 'my-minio-bucket',
 *       credentials: {
 *         accessKeyId: process.env.MINIO_ACCESS_KEY_ID,
 *         secretAccessKey: process.env.MINIO_SECRET_ACCESS_KEY,
 *       },
 *       nativeS3Configuration: {
 *         endpoint: process.env.MINIO_ENDPOINT ?? 'http://localhost:9000',
 *         forcePathStyle: true,
 *         signatureVersion: 'v4',
 *         // The `region` is required by the AWS SDK even when using MinIO,
 *         // so we just use a dummy value here.
 *         region: 'eu-west-1',
 *       },
 *     }),
 * }),
 * ```
 * @docsCategory core plugins/AssetServerPlugin
 * @docsPage S3AssetStorageStrategy
 */
function configureS3AssetStorage(s3Config) {
    return (options) => {
        const prefixFn = (0, common_1.getAssetUrlPrefixFn)(options);
        const toAbsoluteUrlFn = (request, identifier) => {
            if (!identifier) {
                return '';
            }
            const prefix = prefixFn(request, identifier);
            return identifier.startsWith(prefix) ? identifier : `${prefix}${identifier}`;
        };
        return new S3AssetStorageStrategy(s3Config, toAbsoluteUrlFn);
    };
}
/**
 * @description
 * An {@link AssetStorageStrategy} which uses [Amazon S3](https://aws.amazon.com/s3/) object storage service.
 * To us this strategy you must first have access to an AWS account.
 * See their [getting started guide](https://aws.amazon.com/s3/getting-started/) for how to get set up.
 *
 * Before using this strategy, make sure you have the `@aws-sdk/client-s3` and `@aws-sdk/lib-storage` package installed:
 *
 * ```sh
 * npm install \@aws-sdk/client-s3 \@aws-sdk/lib-storage
 * ```
 *
 * **Note:** Rather than instantiating this manually, use the {@link configureS3AssetStorage} function.
 *
 * ## Use with S3-compatible services (MinIO)
 * This strategy will also work with any S3-compatible object storage solutions, such as [MinIO](https://min.io/).
 * See the {@link configureS3AssetStorage} for an example with MinIO.
 *
 * @docsCategory asset-server-plugin
 * @docsPage S3AssetStorageStrategy
 * @docsWeight 0
 */
class S3AssetStorageStrategy {
    constructor(s3Config, toAbsoluteUrl) {
        this.s3Config = s3Config;
        this.toAbsoluteUrl = toAbsoluteUrl;
    }
    async init() {
        try {
            this.AWS = await import('@aws-sdk/client-s3');
        }
        catch (err) {
            core_1.Logger.error('Could not find the "@aws-sdk/client-s3" package. Make sure it is installed', constants_1.loggerCtx, err.stack);
        }
        try {
            this.libStorage = await import('@aws-sdk/lib-storage');
        }
        catch (err) {
            core_1.Logger.error('Could not find the "@aws-sdk/lib-storage" package. Make sure it is installed', constants_1.loggerCtx, err.stack);
        }
        const config = Object.assign(Object.assign({}, this.s3Config.nativeS3Configuration), { credentials: await this.getCredentials() });
        this.s3Client = new this.AWS.S3Client(config);
        await this.ensureBucket();
    }
    async writeFileFromBuffer(fileName, data) {
        return this.writeFile(fileName, data);
    }
    async writeFileFromStream(fileName, data) {
        return this.writeFile(fileName, data);
    }
    async readFileToBuffer(identifier) {
        var _a, e_1, _b, _c;
        const body = await this.readFile(identifier);
        if (!body) {
            core_1.Logger.error(`Got undefined Body for ${identifier}`, constants_1.loggerCtx);
            return Buffer.from('');
        }
        const chunks = [];
        try {
            for (var _d = true, body_1 = __asyncValues(body), body_1_1; body_1_1 = await body_1.next(), _a = body_1_1.done, !_a; _d = true) {
                _c = body_1_1.value;
                _d = false;
                const chunk = _c;
                chunks.push(chunk);
            }
        }
        catch (e_1_1) { e_1 = { error: e_1_1 }; }
        finally {
            try {
                if (!_d && !_a && (_b = body_1.return)) await _b.call(body_1);
            }
            finally { if (e_1) throw e_1.error; }
        }
        return Buffer.concat(chunks);
    }
    async readFileToStream(identifier) {
        const body = await this.readFile(identifier);
        if (!body) {
            return new node_stream_1.Readable({
                read() {
                    this.push(null);
                },
            });
        }
        return body;
    }
    async readFile(identifier) {
        const { GetObjectCommand } = this.AWS;
        const result = await this.s3Client.send(new GetObjectCommand(this.getObjectParams(identifier)));
        return result.Body;
    }
    async writeFile(fileName, data) {
        const { Upload } = this.libStorage;
        const upload = new Upload({
            client: this.s3Client,
            params: Object.assign(Object.assign({}, this.s3Config.nativeS3UploadConfiguration), { Bucket: this.s3Config.bucket, Key: fileName, Body: data }),
        });
        return upload.done().then(result => {
            if (!('Key' in result) || !result.Key) {
                core_1.Logger.error(`Got undefined Key for ${fileName}`, constants_1.loggerCtx);
                throw new Error(`Got undefined Key for ${fileName}`);
            }
            return result.Key;
        });
    }
    async deleteFile(identifier) {
        const { DeleteObjectCommand } = this.AWS;
        await this.s3Client.send(new DeleteObjectCommand(this.getObjectParams(identifier)));
    }
    async fileExists(fileName) {
        const { HeadObjectCommand } = this.AWS;
        try {
            await this.s3Client.send(new HeadObjectCommand(this.getObjectParams(fileName)));
            return true;
        }
        catch (err) {
            return false;
        }
    }
    getObjectParams(identifier) {
        return {
            Bucket: this.s3Config.bucket,
            Key: path.join(identifier.replace(/^\//, '')),
        };
    }
    async ensureBucket(bucket = this.s3Config.bucket) {
        const { HeadBucketCommand, CreateBucketCommand } = this.AWS;
        try {
            await this.s3Client.send(new HeadBucketCommand({ Bucket: bucket }));
            core_1.Logger.verbose(`Found S3 bucket "${bucket}"`, constants_1.loggerCtx);
            return;
        }
        catch (err) {
            core_1.Logger.verbose(`Could not find bucket "${bucket}: ${JSON.stringify(err.message)}". Attempting to create...`);
        }
        try {
            await this.s3Client.send(new CreateBucketCommand({ Bucket: bucket, ACL: 'private' }));
            core_1.Logger.verbose(`Created S3 bucket "${bucket}"`, constants_1.loggerCtx);
        }
        catch (err) {
            core_1.Logger.error(`Could not find nor create the S3 bucket "${bucket}: ${JSON.stringify(err.message)}"`, constants_1.loggerCtx, err.stack);
        }
    }
    async getCredentials() {
        if (this.s3Config.credentials == null) {
            return undefined;
        }
        if (this.isCredentialsProfile(this.s3Config.credentials)) {
            core_1.Logger.warn('The "profile" property of the "s3Config.credentials" is deprecated. ' +
                'Please use the "fromIni()" function from the "@aws-sdk/credential-provider-ini" or "@aws-sdk/credential-providers" package instead.', constants_1.loggerCtx);
            return (await import('@aws-sdk/credential-provider-ini')).fromIni({
                profile: this.s3Config.credentials.profile,
            });
        }
        return this.s3Config.credentials;
    }
    isCredentialsProfile(credentials) {
        return (credentials !== null &&
            typeof credentials === 'object' &&
            'profile' in credentials &&
            Object.keys(credentials).length === 1);
    }
}
exports.S3AssetStorageStrategy = S3AssetStorageStrategy;
//# sourceMappingURL=s3-asset-storage-strategy.js.map