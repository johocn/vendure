export interface PhoneAuthPluginOptions {
    accessKeyId: string;
    accessKeySecret: string;
    signName: string;
    templateCode: string;
    codeLength?: number;
    codeExpirySeconds?: number;
    devBypass?: boolean;
    devBypassCode?: string;
    /**
     * 可选 Redis 连接（如 redis://127.0.0.1:6379）。
     * 配置后验证码/限流状态存 Redis（多实例部署共享）；未配置时使用进程内存（单实例）。
     */
    redisUrl?: string;
}
export interface RegisterCustomerInput {
    phoneNumber?: string;
    code?: string;
    password: string;
    emailAddress?: string;
}
