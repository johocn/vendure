export interface CarrierDef {
    code: string;
    name: string;
    shortName: string;
    sort: number;
}
export declare const CARRIERS: CarrierDef[];
export declare function getCarrierByCode(code: string): CarrierDef | undefined;
