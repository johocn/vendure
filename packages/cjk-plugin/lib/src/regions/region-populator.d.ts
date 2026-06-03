import { Injector, RequestContext } from '@vendure/core';
export declare class RegionPopulator {
    populate(injector: Injector, ctx: RequestContext, countries: ('CN' | 'JP' | 'KR')[]): Promise<void>;
    private populateChina;
    private populateJapan;
    private populateKorea;
}
