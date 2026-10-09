import { CirclePost } from './circle-post.entity';
/** 帖子列表/详情查询参数（shop 与 admin 共用，均只分页）。 */
export interface CirclePostListOptions {
    skip?: number;
    take?: number;
}
export interface CreateCirclePostInput {
    title?: string | null;
    content: string;
    images?: string[] | null;
    videoUrl?: string | null;
    productId?: string | null;
}
export interface UpdateCirclePostInput {
    id: string;
    status?: string | null;
    isPinned?: boolean | null;
}
export interface ToggleCircleResult {
    liked: boolean;
    favorited: boolean;
    likeCount: number;
    favoriteCount: number;
}
/** shop 端帖子视图：实体字段 + nickname + viewer 状态；images 已解析为字符串数组。 */
export interface CirclePostView extends Omit<CirclePost, 'images'> {
    images: string[];
    nickname: string;
    viewerLiked: boolean;
    viewerFavorited: boolean;
}
