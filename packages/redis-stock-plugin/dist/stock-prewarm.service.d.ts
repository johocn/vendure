import { StockReserveService } from './stock-reserve.service';
export declare class StockPrewarmService {
    private stockReserveService;
    constructor(stockReserveService: StockReserveService);
    prewarm(key: string, stock: number): Promise<void>;
    removePrewarm(key: string): Promise<void>;
}
