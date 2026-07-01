import { AwsCredentialIdentity, AwsCredentialIdentityProvider } from '@aws-sdk/types';
import { AssetStorageStrategy } from '@vendure/core';
import { Request } from 'express';
import { Readable } from 'node:stream';
import { AssetServerOptions } from '../types';
/**
 * @description
 * Configuration for connecting to AWS S3.
 *
 * @docsCategory core plugins/AssetServerPlugin
 * @docsPage S3AssetStorageStrategy
 */
export interface S3Config {
    /**
     * @description
     * The credentials used to access your s3 account. You can supply either the access key ID & secret, or you can make use of a
     * [shared credentials file](https://docs.aws.amazon.com/sdk-for-javascript/v2/developer-guide/loading-node-credentials-shared.html)
     * To use a shared credentials file, import the `fromIni()` function from the "@aws-sdk/credential-provider-ini" or "@aws-sdk/credential-providers" package and supply
     * the profile name (e.g. `{ profile: 'default' }`) as its argument.
     */
    credentials: AwsCredentialIdentity | AwsCredentialIdentityProvider;
    /**
     * @description
     * The S3 bucket in which to store the assets. If it does not exist, it will be created on startup.
     */
    bucket: string;
    /**
     * @description
     * Configuration object passed directly to the AWS SDK.
     * S3.Types.ClientConfiguration can be used after importing aws-sdk.
     * Using type `any` in order to avoid the need to include `aws-sdk` dependency in general.
     */
    nativeS3Configuration?: any;
    /**
     * @description
     * Configuration object passed directly to the AWS SDK.
     * ManagedUpload.ManagedUploadOptions can be used after importing aws-sdk.
     * Using type `any` in order to avoid the need to include `aws-sdk` dependency in general.
     */
    nativeS3UploadConfiguration?: any;
}
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
export declare function configureS3AssetStorage(s3Config: S3Config): (options: AssetServerOptions) => S3AssetStorageStrategy;
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
export declare class S3AssetStorageStrategy implements AssetStorageStrategy {
    private s3Config;
    readonly toAbsoluteUrl: (request: Request, identifier: string) => string;
    private AWS;
    private libStorage;
    private s3Client;
    constructor(s3Config: S3Config, toAbsoluteUrl: (request: Request, identifier: string) => string);
    init(): Promise<void>;
    destroy?: (() => void | Promise<void>) | undefined;
    writeFileFromBuffer(fileName: string, data: Buffer): Promise<string>;
    writeFileFromStream(fileName: string, data: Readable): Promise<string>;
    readFileToBuffer(identifier: string): Promise<Buffer<ArrayBuffer>>;
    readFileToStream(identifier: string): Promise<Readable>;
    private readFile;
    private writeFile;
    deleteFile(identifier: string): Promise<void>;
    fileExists(fileName: string): Promise<boolean>;
    private getObjectParams;
    private ensureBucket;
    private getCredentials;
    private isCredentialsProfile;
}
