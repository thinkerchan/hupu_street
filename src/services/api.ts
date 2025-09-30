import type {
  Post,
  Comment,
  ApiResponse,
  HupuPostListItem,
  HupuPostDetail,
  HupuComment,
  HupuSearchPostItem,
  SearchPost,
  SearchSortOption,
  LoginResponse,
  UserInfo,
} from '../types';
import { rewriteHtmlMedia, rewriteMediaUrl, rewriteMediaUrls } from '../utils/proxy';

// 检查环境变量是否存在，如果不存在则使用模拟数据
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

const API_BASE = SUPABASE_URL ? `${SUPABASE_URL}/functions/v1` : null;
const HUPU_PROXY_PREFIX = '/hupu';
const HUPU_LIST_ENDPOINT = `${HUPU_PROXY_PREFIX}/api/v2/bbs/walkingStreet/threads`;
const HUPU_DETAIL_ENDPOINT = `${HUPU_PROXY_PREFIX}/api/v1/bbs-thread`;
const HUPU_SEARCH_ENDPOINT = `${HUPU_PROXY_PREFIX}/api/v2/search2`;

interface HupuOfficialLightReply {
  replyUserName: string;
  content: string;
  quoteContent?: string;
  lightCount?: number;
}

interface HupuOfficialVideo {
  img?: string;
  humanDuration?: string;
  playNum?: number;
  url?: string;
}

interface HupuOfficialThreadItem {
  tid: number | string;
  title: string;
  content?: string;
  userName: string;
  userHeader?: string;
  puid: number | string;
  time: string;
  replies?: number | string;
  hits?: number | string;
  recommendCount?: number | string;
  shareNum?: number | string;
  picList?: Array<{ url?: string }>;
  topicName?: string;
  topicIcon?: string;
  topThread?: boolean;
  videoThread?: boolean;
  video?: HupuOfficialVideo;
  lightReplyResult?: HupuOfficialLightReply & {
    quoteContent?: string;
  };
}

interface HupuOfficialThreadListResponse {
  data?: {
    nextPage?: boolean;
    threadList?: HupuOfficialThreadItem[];
    cursor?: string;
  };
}

interface HupuOfficialDetailUser {
  puid?: string | number;
  username?: string;
  header?: string;
  date?: string;
}

interface HupuOfficialDetailInfo {
  tid?: string | number;
  title?: string;
  content?: string;
  user?: HupuOfficialDetailUser;
  f_info?: {
    f_name?: string;
  };
  replies?: string | number;
  hits?: string | number;
  rcmd?: string | number;
  is_top?: string | number;
  lights?: string | number;
  share?: string | number;
}

interface HupuOfficialDetailResponse {
  data?: {
    t_desc?: {
      desc?: string;
    };
    t_detail?: HupuOfficialDetailInfo;
    t_author?: HupuOfficialDetailUser;
    r_list?: HupuOfficialComment[];
    r_total_page?: string | number;
  };
}

interface HupuOfficialComment {
  pid?: string | number;
  content?: string;
  user?: {
    puid?: string | number;
    username?: string;
    header?: string;
    date?: string;
  };
  light?: string | number;
  like_count?: string | number;
  floor?: string | number;
  replies?: string | number;
  quote_info?: {
    username?: string;
    content?: string;
  };
}

class HupuApiService {
  private normalizeDateTime(value?: string | number | null): string {
    if (value === null || value === undefined) {
      return '';
    }

    const stringValue = String(value).trim();
    if (!stringValue) {
      return '';
    }

    // relative descriptors keep original
    if (/刚刚|分钟前|小时前|天前/.test(stringValue)) {
      return stringValue;
    }

    // pure number timestamp
    if (/^\d+$/.test(stringValue)) {
      const numeric = Number(stringValue);
      const timestamp = stringValue.length === 10 ? numeric * 1000 : numeric;
      const date = new Date(timestamp);
      if (!Number.isNaN(date.getTime())) {
        return date.toISOString();
      }
    }

    // month-day format without year
    if (/^\d{1,2}-\d{1,2}(\s+\d{1,2}:\d{2})?$/.test(stringValue)) {
      const [datePart, timePart = '00:00'] = stringValue.split(/\s+/);
      const [monthRaw, dayRaw] = datePart.split('-');
      const now = new Date();
      const year = now.getFullYear();
      const month = Number(monthRaw);
      const day = Number(dayRaw);
      if (!Number.isNaN(month) && !Number.isNaN(day)) {
        const isoCandidate = new Date(`${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}T${timePart.padStart(5, '0')}:00`);
        if (!Number.isNaN(isoCandidate.getTime())) {
          // If the date is in the future (e.g., next year), roll back one year
          if (isoCandidate.getTime() - now.getTime() > 7 * 24 * 60 * 60 * 1000) {
            isoCandidate.setFullYear(year - 1);
          }
          return isoCandidate.toISOString();
        }
      }
    }

    const direct = new Date(stringValue);
    if (!Number.isNaN(direct.getTime())) {
      return direct.toISOString();
    }

    const fallback = new Date(stringValue.replace(/-/g, '/'));
    if (!Number.isNaN(fallback.getTime())) {
      return fallback.toISOString();
    }

    return stringValue;
  }

  private extractCommentsFromDetail(data?: HupuOfficialDetailResponse['data']) {
    const rawComments = data?.r_list ?? [];
    const comments = rawComments.map((item) => this.transformComment(item));
    const totalPages = Number(data?.r_total_page ?? (comments.length > 0 ? 1 : 0)) || 0;

    return {
      comments,
      totalPages,
      hasMore: totalPages > 1 && comments.length > 0,
    };
  }

  private async request<T>(endpoint: string, options?: RequestInit): Promise<ApiResponse<T>> {
    // 如果没有配置 Supabase，直接返回模拟数据
    if (!API_BASE || !SUPABASE_ANON_KEY) {
      console.warn('Supabase not configured, using mock data');
      return this.getMockData<T>(endpoint);
    }

    try {
      const headers = {
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        ...options?.headers,
      };

      const response = await fetch(`${API_BASE}/hupu-proxy${endpoint}`, {
        headers,
        ...options,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('API request failed:', error);
      throw error;
    }
  }

  private async requestOfficial<T>(url: string, options?: RequestInit): Promise<T> {
    const response = await fetch(url, options);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return response.json();
  }

  // 模拟数据方法
  private getMockData<T>(endpoint: string): Promise<ApiResponse<T>> {
    return new Promise((resolve) => {
      setTimeout(() => {
        if (endpoint.includes('/gambia/posts')) {
          const mockPosts: HupuPostListItem[] = [
            {
              tid: '1',
              title: '【讨论】步行街日常话题讨论',
              content_preview: '这是一个关于步行街的日常讨论话题，大家可以在这里分享生活中的趣事...',
              author_name: '步行街网友',
              author_uid: 'user_1',
              create_time: new Date(Date.now() - 3600000).toISOString(),
              reply_count: 128,
              view_count: 15420,
              last_reply_time: new Date().toISOString(),
              is_top: false,
              is_hot: true,
            },
            {
              tid: '2',
              title: '分享一些生活中的小确幸',
              content_preview: '今天遇到了一些让人开心的小事情，想和大家分享一下，希望能给大家带来正能量...',
              author_name: '生活达人',
              author_uid: 'user_2',
              create_time: new Date(Date.now() - 7200000).toISOString(),
              reply_count: 89,
              view_count: 8900,
              last_reply_time: new Date().toISOString(),
              is_top: false,
              is_hot: false,
            },
            {
              tid: '3',
              title: '求助：关于工作选择的困惑',
              content_preview: '最近面临工作选择的问题，不知道该如何决定，希望大家能给点建议...',
              author_name: '迷茫青年',
              author_uid: 'user_3',
              create_time: new Date(Date.now() - 10800000).toISOString(),
              reply_count: 45,
              view_count: 3200,
              last_reply_time: new Date().toISOString(),
              is_top: false,
              is_hot: false,
            },
          ];

          resolve({
            success: true,
            data: mockPosts as T,
            page: 1,
            hasMore: true,
            message: '使用模拟数据（请配置 Supabase 环境变量）',
          });
        } else {
          resolve({
            success: false,
            data: [] as T,
            message: '请配置 Supabase 环境变量',
          });
        }
      }, 500);
    });
  }

  // 转换虎扑帖子数据格式
  private isOfficialThreadItem(post: HupuOfficialThreadItem | HupuPostListItem): post is HupuOfficialThreadItem {
    return 'userName' in post;
  }

  private isOfficialDetail(detail: HupuOfficialDetailInfo | HupuPostDetail): detail is HupuOfficialDetailInfo {
    return 'user' in detail;
  }

  private isOfficialComment(comment: HupuOfficialComment | HupuComment): comment is HupuOfficialComment {
    return 'user' in comment;
  }

  private transformPost(hupuPost: HupuOfficialThreadItem | HupuPostListItem): Post {
    if (this.isOfficialThreadItem(hupuPost)) {
      const picList = Array.isArray(hupuPost.picList) ? hupuPost.picList : [];
      const images = rewriteMediaUrls(picList.map((item) => item?.url).filter(Boolean) as string[]);

      return {
        id: String(hupuPost.tid),
        title: hupuPost.title,
        content: rewriteHtmlMedia(hupuPost.content ?? ''),
        author: {
          username: hupuPost.userName,
          avatar: rewriteMediaUrl(hupuPost.userHeader) || this.getDefaultAvatar(),
          level: this.calculateLevel(String(hupuPost.puid)),
          uid: String(hupuPost.puid),
        },
        createdAt: this.normalizeDateTime(hupuPost.time),
        replies: Number(hupuPost.replies ?? 0),
        views: Number(hupuPost.hits ?? hupuPost.recommendCount ?? 0),
        likes: Number(hupuPost.recommendCount ?? 0),
        images,
        isTop: Boolean(hupuPost.topThread),
        isHot: Number(hupuPost.recommendCount ?? 0) > 100,
        url: `https://m.hupu.com/bbs/${hupuPost.tid}.html`,
        lightReply: hupuPost.lightReplyResult ? {
          username: hupuPost.lightReplyResult.replyUserName,
          content: hupuPost.lightReplyResult.content,
          quote: hupuPost.lightReplyResult.quoteContent,
          lightCount: Number(hupuPost.lightReplyResult.lightCount ?? 0),
        } : undefined,
        topicName: hupuPost.topicName,
        shareNum: Number(hupuPost.shareNum ?? 0),
        video: hupuPost.videoThread ? {
          cover: rewriteMediaUrl(hupuPost.video?.img),
          duration: hupuPost.video?.humanDuration,
          playNum: Number(hupuPost.video?.playNum ?? 0),
          url: rewriteMediaUrl(hupuPost.video?.url),
        } : undefined,
      };
    }

    return {
      id: String(hupuPost.tid),
      title: hupuPost.title,
      content: rewriteHtmlMedia(hupuPost.content_preview ?? ''),
      author: {
        username: hupuPost.author_name,
        avatar: rewriteMediaUrl(hupuPost.author_avatar) || this.getDefaultAvatar(),
        level: this.calculateLevel(String(hupuPost.author_uid)),
        uid: String(hupuPost.author_uid),
      },
      createdAt: this.normalizeDateTime(hupuPost.create_time ?? hupuPost.last_reply_time),
      replies: Number(hupuPost.reply_count ?? 0),
      views: Number(hupuPost.view_count ?? 0),
      likes: Number(hupuPost.reply_count ?? 0),
      images: [],
      isTop: Boolean(hupuPost.is_top),
      isHot: Boolean(hupuPost.is_hot),
      url: `https://m.hupu.com/bbs/${hupuPost.tid}.html`,
      lightReply: undefined,
      topicName: undefined,
      shareNum: undefined,
      video: undefined,
    };
  }

  // 转换虎扑帖子详情数据格式
  private transformPostDetail(detail: HupuOfficialDetailInfo | HupuPostDetail): Post {
    if (this.isOfficialDetail(detail)) {
      const contentHtml = rewriteHtmlMedia(detail.content ?? '');
      const images = rewriteMediaUrls(this.extractImagesFromContent(contentHtml));

      return {
        id: String(detail.tid),
        title: detail.title ?? '',
        content: contentHtml,
        author: {
          username: detail.user?.username ?? '匿名用户',
          avatar: rewriteMediaUrl(detail.user?.header?.replace('@45h_45w_2e', '')) || this.getDefaultAvatar(),
          level: this.calculateLevel(String(detail.user?.puid ?? detail.tid)),
          uid: String(detail.user?.puid ?? detail.tid),
        },
        createdAt: this.normalizeDateTime(detail.user?.date),
        replies: Number(detail.replies ?? 0),
        views: Number(detail.hits ?? 0),
        likes: Number(detail.rcmd ?? 0),
        images,
        isTop: detail.is_top === '1' || detail.is_top === 1,
        isHot: Number(detail.lights ?? 0) > 100,
        url: `https://m.hupu.com/bbs/${detail.tid}.html`,
        lightReply: undefined,
        topicName: detail.f_info?.f_name,
        shareNum: Number(detail.share ?? 0),
      };
    }

    const contentHtml = rewriteHtmlMedia(detail.content ?? '');
    const images = rewriteMediaUrls([...(detail.images ?? [])]);

    return {
      id: String(detail.tid),
      title: detail.title,
      content: contentHtml,
      author: {
        username: detail.author_name,
        avatar: rewriteMediaUrl(detail.author_avatar) || this.getDefaultAvatar(),
        level: this.calculateLevel(String(detail.author_uid ?? detail.tid)),
        uid: String(detail.author_uid ?? detail.tid),
      },
      createdAt: this.normalizeDateTime(detail.create_time),
      replies: Number(detail.reply_count ?? 0),
      views: Number(detail.view_count ?? 0),
      likes: Number(detail.reply_count ?? 0),
      images,
      isTop: false,
      isHot: Number(detail.view_count ?? 0) > 10000,
      url: `https://m.hupu.com/bbs/${detail.tid}.html`,
      lightReply: undefined,
      topicName: undefined,
      shareNum: undefined,
    };
  }

  // 转换虎扑评论数据格式
  private transformComment(hupuComment: HupuOfficialComment | HupuComment): Comment {
    if (this.isOfficialComment(hupuComment)) {
      const content = rewriteHtmlMedia(hupuComment.content ?? '');
      return {
        id: String(hupuComment.pid),
        content,
        author: {
          username: hupuComment.user?.username ?? '匿名评论',
          avatar: rewriteMediaUrl(hupuComment.user?.header?.replace('@45h_45w_2e', '')) || this.getDefaultAvatar(),
          level: this.calculateLevel(String(hupuComment.user?.puid ?? hupuComment.pid)),
          uid: String(hupuComment.user?.puid ?? hupuComment.pid),
        },
        createdAt: this.normalizeDateTime(hupuComment.user?.date),
        likes: Number(hupuComment.light ?? hupuComment.like_count ?? 0),
        floor: Number(hupuComment.floor ?? hupuComment.pid ?? 0),
        replies: hupuComment.replies ? Number(hupuComment.replies) : undefined,
        quote: hupuComment.quote_info ? {
          username: hupuComment.quote_info.username ?? '匿名评论',
          content: rewriteHtmlMedia(hupuComment.quote_info.content ?? ''),
        } : undefined,
        images: rewriteMediaUrls(this.extractImagesFromContent(content)),
      };
    }

    const content = rewriteHtmlMedia(hupuComment.content ?? '');
    return {
      id: String(hupuComment.pid),
      content,
      author: {
        username: hupuComment.author_name,
        avatar: rewriteMediaUrl(hupuComment.author_avatar) || this.getDefaultAvatar(),
        level: this.calculateLevel(String(hupuComment.author_uid ?? hupuComment.pid)),
        uid: String(hupuComment.author_uid ?? hupuComment.pid),
      },
      createdAt: this.normalizeDateTime(hupuComment.create_time),
      likes: Number(hupuComment.like_count ?? 0),
      floor: Number(hupuComment.floor ?? hupuComment.pid ?? 0),
      replies: hupuComment.replies ? Number(hupuComment.replies) : undefined,
      quote: undefined,
      images: rewriteMediaUrls(this.extractImagesFromContent(content)),
    };
  }

  private getDefaultAvatar(): string {
    return 'https://images.pexels.com/photos/771742/pexels-photo-771742.jpeg?auto=compress&cs=tinysrgb&w=64&h=64&fit=crop';
  }

  private calculateLevel(uid: string): number {
    // 根据用户ID计算等级（简单算法）
    const hash = uid.split('').reduce((a, b) => {
      a = ((a << 5) - a) + b.charCodeAt(0);
      return a & a;
    }, 0);
    return Math.abs(hash) % 25 + 1;
  }

  private extractImagesFromContent(html: string): string[] {
    if (!html) return [];
    const regex = /<img[^>]+src=['"]([^'"\s>]+)['"][^>]*>/g;
    const images: string[] = [];
    let match;
    while ((match = regex.exec(html)) !== null) {
      const url = match[1];
      if (url.startsWith('http')) {
        images.push(url);
      }
    }
    return images;
  }

  // 获取步行街帖子列表
  async getGambiaPosts(page: number = 1, cursor?: string): Promise<ApiResponse<Post[]>> {
    try {
      const params = new URLSearchParams({ page: String(page) });
      if (cursor) {
        params.set('cursor', cursor);
      }
      const url = `${HUPU_LIST_ENDPOINT}?${params.toString()}`;
      const response = await this.requestOfficial<HupuOfficialThreadListResponse>(url);
      const data = response.data ?? { threadList: [] };
      const posts = (data.threadList ?? []).map((item) => this.transformPost(item));
      return {
        success: true,
        data: posts,
        hasMore: Boolean(data.nextPage),
        total: posts.length,
        page,
        message: undefined,
      };
    } catch (error) {
      console.error('Failed to fetch official list:', error);
      if (API_BASE) {
        return this.getGambiaPostsViaProxy(page);
      }
      throw error;
    }
  }

  private async getGambiaPostsViaProxy(page: number): Promise<ApiResponse<Post[]>> {
    const response = await this.request<HupuPostListItem[]>(`/gambia/posts?page=${page}`);
    return {
      ...response,
      data: response.data.map(post => this.transformPost(post)),
    };
  }

  // 获取帖子详情
  async getPost(tid: string, page: number = 1): Promise<ApiResponse<Post>> {
    if (page === 1) {
      const response = await this.getPostWithComments(tid);
      return {
        success: response.success,
        data: response.data.post,
        message: response.message,
      };
    }

    try {
      const url = `${HUPU_DETAIL_ENDPOINT}/${tid}?page=${page}`;
      const response = await this.requestOfficial<HupuOfficialDetailResponse>(url);
      const data = response.data ?? {};
      const detail = {
        ...(data.t_detail ?? {}),
        content: data.t_detail?.content ?? data.t_desc?.desc,
        user: data.t_detail?.user ?? data.t_author,
      };
      return {
        success: true,
        data: this.transformPostDetail(detail),
        message: undefined,
      };
    } catch (error) {
      console.error('Failed to fetch official detail:', error);
      if (API_BASE) {
        const response = await this.request<HupuPostDetail>(`/posts/${tid}`);
        return {
          ...response,
          data: this.transformPostDetail(response.data),
        };
      }
      throw error;
    }
  }

  async getPostWithComments(tid: string): Promise<ApiResponse<{
    post: Post;
    comments: Comment[];
    hasMoreComments: boolean;
    totalCommentPages: number;
  }>> {
    try {
      const url = `${HUPU_DETAIL_ENDPOINT}/${tid}?page=1`;
      const response = await this.requestOfficial<HupuOfficialDetailResponse>(url);
      const data = response.data ?? {};
      const detail = {
        ...(data.t_detail ?? {}),
        content: data.t_detail?.content ?? data.t_desc?.desc,
        user: data.t_detail?.user ?? data.t_author,
      };

      const { comments, hasMore, totalPages } = this.extractCommentsFromDetail(data);

      return {
        success: true,
        data: {
          post: this.transformPostDetail(detail),
          comments,
          hasMoreComments: hasMore,
          totalCommentPages: totalPages,
        },
      };
    } catch (error) {
      console.error('Failed to fetch official detail with comments:', error);

      if (API_BASE) {
        const [postResponse, commentsResponse] = await Promise.all([
          this.request<HupuPostDetail>(`/posts/${tid}`),
          this.request<HupuComment[]>(`/posts/${tid}/comments?page=1`),
        ]);

        const post = this.transformPostDetail(postResponse.data);
        const comments = commentsResponse.success
          ? commentsResponse.data.map((comment) => this.transformComment(comment))
          : [];

        return {
          success: postResponse.success,
          data: {
            post,
            comments,
            hasMoreComments: commentsResponse.success ? (commentsResponse.hasMore ?? false) : false,
            totalCommentPages: commentsResponse.success && commentsResponse.hasMore ? 2 : 1,
          },
          message: postResponse.message ?? commentsResponse.message,
        };
      }

      throw error;
    }
  }

  // 获取帖子评论
  async getComments(tid: string, page: number = 1): Promise<ApiResponse<Comment[]>> {
    try {
      const url = `${HUPU_DETAIL_ENDPOINT}/${tid}?page=${page}`;
      const response = await this.requestOfficial<HupuOfficialDetailResponse>(url);
      const data = response.data ?? {};
      const comments = (data.r_list ?? []).map((item) => this.transformComment(item));
      const totalPages = Number(data.r_total_page ?? page);
      return {
        success: true,
        data: comments,
        hasMore: page < totalPages,
        page,
      };
    } catch (error) {
      console.error('Failed to fetch official comments:', error);
      if (API_BASE) {
        const response = await this.request<HupuComment[]>(`/posts/${tid}/comments?page=${page}`);
        return {
          ...response,
          data: response.data.map(comment => this.transformComment(comment)),
        };
      }
      throw error;
    }
  }

  // 搜索步行街帖子
  async searchGambiaPosts(query: string, page: number = 1): Promise<ApiResponse<Post[]>> {
    try {
      const params = new URLSearchParams({ keyword: query, page: String(page) });
      const url = `${HUPU_LIST_ENDPOINT}?${params.toString()}`;
      const response = await this.requestOfficial<HupuOfficialThreadListResponse>(url);
      const data = response.data ?? {};
      const posts = (data.threadList ?? []).map((item) => this.transformPost(item));
      return {
        success: true,
        data: posts,
        hasMore: Boolean(data.nextPage),
        page,
      };
    } catch (error) {
      console.error('Failed to search official list:', error);
      if (API_BASE) {
        const response = await this.request<HupuPostListItem[]>(`/gambia/search?q=${encodeURIComponent(query)}&page=${page}`);
        return {
          ...response,
          data: response.data.map(post => this.transformPost(post)),
        };
      }
      throw error;
    }
  }

  async searchPostsV2(
    keyword: string,
    page: number = 1,
    sort: string = 'general',
  ): Promise<ApiResponse<{ posts: SearchPost[]; sorts: SearchSortOption[]; totalPages: number }>> {
    try {
      const params = new URLSearchParams({
        keyword,
        puid: '0',
        type: 'posts',
        topicId: '0',
      });
      params.append('post_sort', sort);
      params.append('page', String(page));

      const url = `${HUPU_SEARCH_ENDPOINT}?${params.toString()}`;
      const response = await this.requestOfficial<{ data?: { result?: any; postSortList?: Array<{ postSort: string; name: string }> } }>(url);
      const result = response.data?.result;

      const items: HupuSearchPostItem[] = Array.isArray(result?.data) ? result.data : [];

      const posts: SearchPost[] = items
        .filter((item) => !item.display_type || item.display_type === 'threads')
        .map((item) => {
          const createdAt = item.addtime ? new Date(Number(item.addtime) * 1000).toISOString() : '';
          return {
            id: String(item.id ?? item.itemid ?? ''),
            titleHtml: rewriteHtmlMedia(item.title ?? ''),
            contentHtml: rewriteHtmlMedia(item.content ?? ''),
            author: {
              username: item.username ?? '匿名用户',
              avatar: rewriteMediaUrl(item.header) || this.getDefaultAvatar(),
              uid: String(item.puid ?? ''),
            },
            replies: Number(item.replies ?? 0),
            lights: Number(item.lights ?? 0),
            recommends: Number(item.recNum ?? 0),
            createdAt,
            forumName: item.forum_name,
            link: item.link,
          };
        });

      const hasNext = Boolean(result?.hasNextPage);
      const totalPages = Number(result?.totalPage ?? page);
      const sorts: SearchSortOption[] = Array.isArray(response.data?.postSortList)
        ? response.data?.postSortList.map((item) => ({
            postSort: item.postSort,
            name: item.name,
          }))
        : [];

      return {
        success: true,
        data: {
          posts,
          sorts,
          totalPages,
        },
        hasMore: hasNext,
        total: Number(result?.count ?? posts.length),
        page,
        message: undefined,
      };
    } catch (error) {
      console.error('Failed to fetch search results:', error);
      return {
        success: false,
        data: {
          posts: [],
          sorts: [],
          totalPages: 0,
        },
        message: '搜索失败，请稍后重试',
        page,
        hasMore: false,
      };
    }
  }

  // 用户登录 - 通过后端 API
  async login(username: string, password: string): Promise<LoginResponse> {
    try {
      const response = await fetch('/api/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, password }),
      });

      const data = await response.json();

      if (data.success && data.data) {
        return {
          success: true,
          data: {
            authToken: data.data.authToken,
            userInfo: data.data.userInfo,
          },
          message: data.message || '登录成功',
        };
      } else {
        return {
          success: false,
          message: data.message || '登录失败，请检查用户名和密码',
        };
      }
    } catch (error) {
      console.error('Login failed:', error);
      return {
        success: false,
        message: '登录失败，请稍后重试',
      };
    }
  }

  // 获取当前登录用户信息
  getCurrentUser(): { authToken: string | null; userInfo: UserInfo | null } {
    const authToken = localStorage.getItem('hupu_auth_token');
    const userInfoStr = localStorage.getItem('hupu_user_info');

    return {
      authToken,
      userInfo: userInfoStr ? JSON.parse(userInfoStr) : null,
    };
  }

  // 退出登录
  logout(): void {
    localStorage.removeItem('hupu_auth_token');
    localStorage.removeItem('hupu_user_info');
  }

  // 检查是否已登录
  isLoggedIn(): boolean {
    return !!localStorage.getItem('hupu_auth_token');
  }
}

export const hupuApi = new HupuApiService();
export type { Post, Comment, ApiResponse, LoginResponse, UserInfo };
