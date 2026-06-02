import { Stream } from 'stream';
import { AssetStorageStrategy } from '@vendure/core';
import { OssPluginOptions } from './types';
export declare class OssAssetStorageStrategy implements AssetStorageStrategy {
    private client;
    private pathPrefix;
    private customDomain;
    constructor(options: OssPluginOptions);
    writeFileFromBuffer(fileName: string, data: Buffer): Promise<string>;
    writeFileFromStream(fileName: string, data: Stream, encoding?: BufferEncoding | null): Promise<string>;
    readFileToBuffer(identifier: string): Promise<Buffer>;
    readFileToStream(identifier: string, encoding?: BufferEncoding | null): Promise<Stream>;
    deleteFile(identifier: string): Promise<void>;
    fileExists(fileName: string): Promise<boolean>;
    toAbsoluteUrl(request: any, identifier: string): string;
    private getKey;
    private getKeyFromIdentifier;
    private toPublicUrl;
}
