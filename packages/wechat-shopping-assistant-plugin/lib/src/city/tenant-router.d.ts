import { CatalogChannel } from './city-catalog';
export type Candidate = CatalogChannel;
export interface RankOptions {
    /** 半径候选的最大距离（km），缺省 3 */
    maxDistanceKm?: number;
}
export declare function rankCandidates(candidates: Candidate[], opts?: RankOptions): Candidate[];
