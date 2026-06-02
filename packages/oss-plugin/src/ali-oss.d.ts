declare module 'ali-oss' {
    import { Readable } from 'stream';

    interface OSSOptions {
        region: string;
        accessKeyId: string;
        accessKeySecret: string;
        bucket: string;
        endpoint?: string;
    }

    interface PutResult {
        name: string;
        url: string;
        res: any;
    }

    interface GetResult {
        content: Buffer;
        res: any;
    }

    interface GetStreamResult {
        stream: Readable;
        res: any;
    }

    interface HeadResult {
        status: number;
        res: any;
    }

    class OSS {
        constructor(options: OSSOptions);
        put(name: string, data: Buffer | string | Readable, options?: any): Promise<PutResult>;
        putStream(name: string, stream: Readable, options?: any): Promise<PutResult>;
        get(name: string, options?: any): Promise<GetResult>;
        getStream(name: string, options?: any): Promise<GetStreamResult>;
        delete(name: string, options?: any): Promise<any>;
        head(name: string, options?: any): Promise<HeadResult>;
    }

    export = OSS;
}
