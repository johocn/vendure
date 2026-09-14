import { RoomTemplate } from './room-template.entity';
import { CancelPolicy, LongStayDiscount, PriceSegment } from './hotel-config';
export type BedType = 'king' | 'twin' | 'single' | 'triple' | 'family' | 'suite';
export interface RoomTemplateSeed {
    code: string;
    name: string;
    sortOrder: number;
    override?: {
        specs?: {
            bedType?: BedType;
            bedDesc?: string;
            area?: number;
            capacity?: number;
            maxCapacity?: number;
            addBed?: boolean;
            addBedFeeCent?: number;
            smoke?: 'allowed' | 'forbidden';
            window?: 'has' | 'none';
            breakfast?: 'included' | 'notIncluded';
            breakfastCount?: number;
            amenities?: string[];
            tags?: string[];
        };
        roomsView?: string;
        basePriceCent?: number;
        priceCalendar?: PriceSegment[];
        longStayDiscount?: LongStayDiscount[];
        minNights?: number;
        maxNights?: number;
        advanceDays?: number;
        checkInTime?: string;
        checkOutTime?: string;
        cancelPolicy?: CancelPolicy;
        depositType?: string;
    };
}
export declare const ROOM_TEMPLATE_SEEDS: RoomTemplateSeed[];
/** 默认价格段（16 项中 theme-game 手写扩展；theme-movie/psych 用默认） */
export declare const DEFAULT_PRICE_CALENDAR: PriceSegment[];
export declare const DEFAULT_LONG_STAY: LongStayDiscount[];
/** 由种子 + base 生成完整模板输入（DOMAIN 即 RoomTemplate 字段）。 */
export declare function buildSeedTemplate(seed: RoomTemplateSeed): Omit<RoomTemplate, 'id' | 'createdAt' | 'updatedAt'>;
