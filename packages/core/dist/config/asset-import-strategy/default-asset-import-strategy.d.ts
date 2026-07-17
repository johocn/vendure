import { Readable } from 'stream';
import { Injector } from '../../common/injector';
import { AssetImportStrategy } from './asset-import-strategy';
/**
 * @description
 * Options for {@link DefaultAssetImportStrategy}.
 *
 * @since 1.7.0
 * @docsCategory import-export
 */
export interface DefaultAssetImportStrategyOptions {
    /**
     * @description
     * Delay between retries when a fetch fails, in milliseconds.
     *
     * @default 200
     */
    retryDelayMs?: number;
    /**
     * @description
     * Maximum number of retries when a fetch fails.
     *
     * @default 3
     */
    retryCount?: number;
    /**
     * @description
     * If `true`, the strategy permits fetching from hostnames that resolve to
     * private, loopback, link-local or other non-public IP addresses. The
     * default `false` rejects such hostnames in order to mitigate server-side
     * request forgery against the host's internal network and cloud metadata
     * services. Enable only when importing from a trusted internal asset
     * server or for local development.
     *
     * @default false
     * @since 3.6.4
     */
    allowPrivateNetworks?: boolean;
}
/**
 * @description
 * The DefaultAssetImportStrategy is able to import paths from the local filesystem (taking into account the
 * `importExportOptions.importAssetsDir` setting) as well as remote http/https urls.
 *
 * @since 1.7.0
 * @docsCategory import-export
 */
export declare class DefaultAssetImportStrategy implements AssetImportStrategy {
    private options?;
    private configService;
    constructor(options?: DefaultAssetImportStrategyOptions | undefined);
    init(injector: Injector): void;
    getStreamFromPath(assetPath: string): Readable | Promise<Readable>;
    private getStreamFromUrl;
    private getStreamFromLocalFile;
}
