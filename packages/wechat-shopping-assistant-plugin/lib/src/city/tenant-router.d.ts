import { CatalogChannel, Precision } from './city-catalog';
export type Candidate = CatalogChannel;
declare const PRECISION_WEIGHT: Record<Precision, number>;
export { PRECISION_WEIGHT };
export interface RankOptions {
    /** 半径候选的最大距离（km），缺省 3 */
    maxDistanceKm?: number;
}
export declare function rankCandidates(candidates: Candidate[], opts?: RankOptions): Candidate[];
