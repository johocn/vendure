export interface OssPluginOptions {
    region: string;
    accessKeyId: string;
    accessKeySecret: string;
    bucket: string;
    endpoint?: string;
    pathPrefix?: string;
    customDomain?: string;
}
