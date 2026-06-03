import { Readable, Stream } from 'stream';
import { Logger } from '@vendure/core';
import { AssetStorageStrategy } from '@vendure/core';
import OSS from 'ali-oss';

import { loggerCtx } from './constants';
import { OssPluginOptions } from './types';

export class OssAssetStorageStrategy implements AssetStorageStrategy {
    private client: OSS;
    private pathPrefix: string;
    private customDomain: string;

    constructor(options: OssPluginOptions) {
        this.client = new OSS({
            region: options.region,
            accessKeyId: options.accessKeyId,
            accessKeySecret: options.accessKeySecret,
            bucket: options.bucket,
            endpoint: options.endpoint,
        });
        this.pathPrefix = options.pathPrefix || '';
        this.customDomain = options.customDomain || '';
    }

    async writeFileFromBuffer(fileName: string, data: Buffer): Promise<string> {
        const key = this.getKey(fileName);
        try {
            const result = await this.client.put(key, data);
            return this.toPublicUrl(result.name);
        } catch (e: any) {
            Logger.error(`OSS writeFileFromBuffer failed: ${e.message as string}`, loggerCtx);
            throw e;
        }
    }

    async writeFileFromStream(fileName: string, data: Stream, encoding?: BufferEncoding | null): Promise<string> {
        const key = this.getKey(fileName);
        try {
            const result = await this.client.putStream(key, data as Readable);
            return this.toPublicUrl(result.name);
        } catch (e: any) {
            Logger.error(`OSS writeFileFromStream failed: ${e.message as string}`, loggerCtx);
            throw e;
        }
    }

    async readFileToBuffer(identifier: string): Promise<Buffer> {
        const key = this.getKeyFromIdentifier(identifier);
        try {
            const result = await this.client.get(key);
            return result.content;
        } catch (e: any) {
            Logger.error(`OSS readFileToBuffer failed: ${String(e.message)}`, loggerCtx);
            throw e;
        }
    }

    async readFileToStream(identifier: string, encoding?: BufferEncoding | null): Promise<Stream> {
        const key = this.getKeyFromIdentifier(identifier);
        try {
            const result = await this.client.getStream(key);
            return result.stream as unknown as Stream;
        } catch (e: any) {
            Logger.error(`OSS readFileToStream failed: ${String(e.message)}`, loggerCtx);
            throw e;
        }
    }

    async deleteFile(identifier: string): Promise<void> {
        const key = this.getKeyFromIdentifier(identifier);
        try {
            await this.client.delete(key);
        } catch (e: any) {
            Logger.error(`OSS deleteFile failed: ${String(e.message)}`, loggerCtx);
            throw e;
        }
    }

    async fileExists(fileName: string): Promise<boolean> {
        const key = this.getKey(fileName);
        try {
            await this.client.head(key);
            return true;
        } catch {
            return false;
        }
    }

    toAbsoluteUrl(request: any, identifier: string): string {
        if (this.customDomain) {
            return `https://${this.customDomain}/${identifier}`;
        }
        return identifier;
    }

    private getKey(fileName: string): string {
        return this.pathPrefix ? `${this.pathPrefix}/${fileName}` : fileName;
    }

    private getKeyFromIdentifier(identifier: string): string {
        if (this.customDomain && identifier.startsWith(`https://${this.customDomain}/`)) {
            return identifier.replace(`https://${this.customDomain}/`, '');
        }
        if (identifier.startsWith('http')) {
            const url = new URL(identifier);
            return url.pathname.substring(1);
        }
        return identifier;
    }

    private toPublicUrl(name: string): string {
        if (this.customDomain) {
            return `https://${this.customDomain}/${name}`;
        }
        return name;
    }
}
