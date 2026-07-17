import { AssetStorageStrategy } from '@vendure/core';
import { Request } from 'express';
import { ReadStream } from 'fs';
import { Stream } from 'stream';
/**
 * @description
 * A persistence strategy which saves files to the local file system.
 *
 * @docsCategory core plugins/AssetServerPlugin
 */
export declare class LocalAssetStorageStrategy implements AssetStorageStrategy {
    private readonly uploadPath;
    private readonly toAbsoluteUrlFn?;
    toAbsoluteUrl: ((reqest: Request, identifier: string) => string) | undefined;
    constructor(uploadPath: string, toAbsoluteUrlFn?: ((reqest: Request, identifier: string) => string) | undefined);
    writeFileFromStream(fileName: string, data: ReadStream, encoding?: BufferEncoding | null): Promise<string>;
    writeFileFromBuffer(fileName: string, data: Buffer): Promise<string>;
    fileExists(fileName: string): Promise<boolean>;
    readFileToBuffer(identifier: string): Promise<Buffer>;
    readFileToStream(identifier: string, encoding?: BufferEncoding | null): Promise<Stream>;
    deleteFile(identifier: string): Promise<void>;
    private filePathToIdentifier;
    private identifierToFilePath;
}
