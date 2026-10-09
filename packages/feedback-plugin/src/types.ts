/** 反馈列表查询参数（shop 端不含 status）。 */
export interface FeedbackListOptions {
    skip?: number;
    take?: number;
    status?: string;
}

/** FAQ 列表查询参数。 */
export interface FaqListOptions {
    skip?: number;
    take?: number;
}

export interface CreateFeedbackInput {
    type?: string;
    title: string;
    content: string;
    imgs?: string[] | null;
    contactWay?: string | null;
}

export interface SaveFaqInput {
    id?: string;
    title: string;
    content: string;
    type?: string;
    sort?: number;
    enabled?: boolean;
}
