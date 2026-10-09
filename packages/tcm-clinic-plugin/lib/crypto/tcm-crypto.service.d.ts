import { TcmClinicPluginOptions } from '../types';
export declare class TcmCryptoService {
    private readonly key;
    constructor(options: TcmClinicPluginOptions);
    encrypt(plain: string): string;
    decrypt(payload: string): string;
}
