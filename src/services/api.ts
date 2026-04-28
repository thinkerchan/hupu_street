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
  LoginResult,
  PhoneVerifyCodeResult,
  UserSession,
  LightReplyResult,
  LightCancelResult,
  CreateReplyResult,
} from '../types';
import JSEncrypt from 'jsencrypt';
import SparkMD5 from 'spark-md5';
import { rewriteHtmlMedia, rewriteMediaUrl, rewriteMediaUrls } from '../utils/proxy';
import { getShumeiDeviceId } from './passport';
import {
  GAMES_API_VERSION_PATH,
  APK_RSA_PUBLIC_KEY,
  APK_SIGN_SALT,
} from '../../api/_lib';
import { hupuFetch } from './http';

// 检查环境变量是否存在，如果不存在则使用模拟数据
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

const API_BASE = SUPABASE_URL ? `${SUPABASE_URL}/functions/v1` : null;
// 各 m.hupu.com endpoint 相对路径（不含代理前缀，hupuFetch 会拼）。
const HUPU_LIST_PATH = 'api/v2/bbs/walkingStreet/threads';
const HUPU_DETAIL_PATH = 'api/v1/bbs-thread';
const HUPU_SEARCH_PATH = 'api/v2/search2';

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
  fid?: number | string;
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
    fid?: string | number;
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
    // 已不再走 Supabase BFF（环境变量都没配），保留 stub 兼容历史调用，直接走 mock。
    if (!API_BASE || !SUPABASE_ANON_KEY) {
      return this.getMockData<T>(endpoint);
    }
    try {
      const headers = {
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
        ...options?.headers,
      };
      const response = await fetch(`${API_BASE}/hupu-proxy${endpoint}`, { headers, ...options });
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      return await response.json();
    } catch (error) {
      console.error('API request failed:', error);
      throw error;
    }
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
        fid: hupuPost.fid != null ? String(hupuPost.fid) : undefined,
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
        fid: detail.f_info?.fid != null ? String(detail.f_info.fid) : undefined,
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
      const response = await hupuFetch<HupuOfficialThreadListResponse>({
        via: 'm',
        path: HUPU_LIST_PATH,
        query: { page, ...(cursor ? { cursor } : {}) },
      });
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
      const response = await hupuFetch<HupuOfficialDetailResponse>({
        via: 'm',
        path: `${HUPU_DETAIL_PATH}/${tid}`,
        query: { page },
      });
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
      const response = await hupuFetch<HupuOfficialDetailResponse>({
        via: 'm',
        path: `${HUPU_DETAIL_PATH}/${tid}`,
        query: { page: 1 },
      });
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
      const response = await hupuFetch<HupuOfficialDetailResponse>({
        via: 'm',
        path: `${HUPU_DETAIL_PATH}/${tid}`,
        query: { page },
      });
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
      const response = await hupuFetch<HupuOfficialThreadListResponse>({
        via: 'm',
        path: HUPU_LIST_PATH,
        query: { keyword: query, page },
      });
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
      const response = await hupuFetch<{
        data?: { result?: any; postSortList?: Array<{ postSort: string; name: string }> };
      }>({
        via: 'm',
        path: HUPU_SEARCH_PATH,
        query: {
          keyword,
          puid: '0',
          type: 'posts',
          topicId: '0',
          post_sort: sort,
          page,
        },
      });
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

  // ---- Login APIs (from APK: LoginRemoteService + HpCipher + CommonInterceptor + SignInterceptor) ----

  private readonly SESSION_KEY = 'hupu_session';
  private readonly DEVICE_ID_KEY = 'hupu_device_id';

  // 协议常量从 lib/hupu-config 拿，不在类里再硬编码一份
  private readonly RSA_PUBLIC_KEY = APK_RSA_PUBLIC_KEY;
  private readonly SIGN_SALT = APK_SIGN_SALT;

  /**
   * 设备 ID：APK 真机上是 ANDROID_ID（hex）或 UUID。但 games-api 登录接口服务端会调
   * Long.parseLong(deviceId)，因此必须是纯十进制数字。这里生成 15 位数字（imei 风格），
   * 持久化在 localStorage，模拟同一台"设备"。
   */
  private getDeviceId(): string {
    let id = localStorage.getItem(this.DEVICE_ID_KEY);
    if (!id || !/^\d{15,18}$/.test(id)) {
      id = this.generateNumericId(15);
      localStorage.setItem(this.DEVICE_ID_KEY, id);
    }
    return id;
  }

  private generateNumericId(length: number): string {
    let s = String(Math.floor(Math.random() * 9) + 1); // 首位非 0
    while (s.length < length) {
      s += Math.floor(Math.random() * 10);
    }
    return s;
  }

  /** 与 APK HpCipher.encryptByPublicKey 一致：RSA/ECB/PKCS1Padding，Base64 输出。 */
  private rsaEncrypt(plainText: string): string {
    const encrypt = new JSEncrypt();
    encrypt.setPublicKey(this.RSA_PUBLIC_KEY);
    const result = encrypt.encrypt(plainText);
    if (!result) {
      throw new Error('RSA encryption failed');
    }
    return result;
  }

  /**
   * 与 APK RequestParams.getSign 一致：
   * 1. key 字典序排序
   * 2. 拼成 k1=v1&k2=v2...（不做 URL encode）
   * 3. 末尾追加 SIGN_SALT
   * 4. MD5 小写 hex（HPMd5 用 Integer.toHexString，等价于小写）
   * 注：APK 中 TextUtils.isEmpty 的 value 不写入 form，因此空值字段不参与签名。
   */
  private computeSign(params: Record<string, string>): string {
    const entries = Object.entries(params).filter(([, v]) => v !== '' && v != null);
    entries.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    const joined = entries.map(([k, v]) => `${k}=${v}`).join('&');
    return SparkMD5.hash(joined + this.SIGN_SALT);
  }

  /** 公共参数（CommonInterceptor + NetConfig.createInitNetParams），所有字段进入 form body 并参与签名。 */
  private buildCommonParams(): Record<string, string> {
    const deviceId = this.getDeviceId();
    const session = this.getSession();
    return {
      android_id: deviceId,
      client: deviceId,
      _imei: '',
      oaid: '',
      teenagers: '0',
      channel: 'hupu_main',
      night: '0',
      crt: String(Date.now()),
      time_zone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Shanghai',
      token: session?.token ?? '',
      clientId: deviceId,
      deviceId,
    };
  }

  private async gamesApiPost<T>(endpoint: string, body: Record<string, string>): Promise<T> {
    const allParams: Record<string, string> = {
      ...this.buildCommonParams(),
      ...body,
    };

    // 移除空值（APK 的 RequestParams.putParams 跳过 isEmpty 的 value，不写入 form）
    const formParams: Record<string, string> = {};
    for (const [k, v] of Object.entries(allParams)) {
      if (v !== '' && v != null) formParams[k] = v;
    }

    formParams.sign = this.computeSign(formParams);

    return hupuFetch<T>({
      via: 'gamesApi',
      // games-api 的 path 前缀含版本段 /1/8.1.12，这里拼到相对 path 上
      path: `${GAMES_API_VERSION_PATH.replace(/^\/+/, '')}/${endpoint}`,
      // CommonInterceptor 还会把 client 单独写到 URL query
      query: { client: formParams.client ?? '' },
      body: formParams,
      contentType: 'form',
    });
  }

  async sendMobileCode(phone: string): Promise<PhoneVerifyCodeResult> {
    return this.gamesApiPost<PhoneVerifyCodeResult>('user/getMobileCode', {
      mobile: phone,
    });
  }

  async loginByPhone(phone: string, code: string, areaCode: string = '86'): Promise<LoginResult> {
    const encryptedMobile = this.rsaEncrypt(phone);
    const timeline = String(Math.floor(Date.now() / 1000));
    return this.gamesApiPost<LoginResult>('bplapi/user/v2/loginByMobileCode', {
      encryptedMobile,
      areaCode,
      mobileCode: code,
      timeline,
    });
  }

  async loginByAccount(account: string, password: string): Promise<LoginResult> {
    const encryptedUsername = this.rsaEncrypt(account);
    const timeline = String(Math.floor(Date.now() / 1000));
    return this.gamesApiPost<LoginResult>('bplapi/user/v1/loginByEmailPassword', {
      encryptedUsername,
      password,
      timeline,
    });
  }

  async logout(): Promise<void> {
    const session = this.getSession();
    if (session) {
      try {
        await this.gamesApiPost('user/logout', { token: session.token });
      } catch { /* ignore */ }
    }
    localStorage.removeItem(this.SESSION_KEY);
  }

  /** 从 .hupu.com cookie u=<puid>|... 拿当前登录用户 puid。passport 登录响应没显式返回 puid。 */
  private getCurrentPuidFromCookie(): number {
    const m = document.cookie.match(/(?:^|;\s*)u=([^|;]+)/);
    return m ? Number(m[1]) : 0;
  }

  /**
   * 解析 hupu cookie `u=<uid>|<base64(username)>|<...>|...`，返回当前登录用户信息。
   * passport 登录响应里没有 username，必须从这个 cookie 拿。
   */
  getCurrentUserFromCookie(): { uid: number; username: string } | null {
    const m = document.cookie.match(/(?:^|;\s*)u=([^;]+)/);
    if (!m) return null;
    const segments = m[1].split('|');
    const uid = Number(segments[0]);
    if (!uid) return null;
    let username = '';
    try {
      const bytes = Uint8Array.from(atob(segments[1] ?? ''), (c) => c.charCodeAt(0));
      username = new TextDecoder('utf-8').decode(bytes);
    } catch {
      username = '';
    }
    return { uid, username };
  }

  /** 用 cookie 当前用户信息覆盖/修正本地 session（昵称、uid、puid）。 */
  syncSessionFromCookie(): UserSession | null {
    const cookieUser = this.getCurrentUserFromCookie();
    if (!cookieUser) return null;
    const old = this.getSession();
    const session: UserSession = {
      token: old?.token ?? '',
      uid: cookieUser.uid,
      // PC light/createReply 等接口的 puid 字段实际收的就是 uid 值
      puid: cookieUser.uid,
      nickname: cookieUser.username || old?.nickname || '虎扑用户',
      avatar: old?.avatar ?? '',
    };
    this.saveSession(session);
    return session;
  }

  /**
   * PC web 通用 cookie 调用器。在 header 里多塞一个 X-Hupu-Tid，让 vite/vercel proxy
   * 把 Referer 重写成 bbs.hupu.com/<tid>.html（反作弊会校验 referer 必须是该帖子页）。
   */
  private async bbsPcPost<T = unknown>(path: string, body: unknown, tid: string | number): Promise<{
    code: number;
    msg: string;
    internalCode?: string;
    data: T | null;
  }> {
    return hupuFetch({ via: 'bbsPc', path, body, tid });
  }

  /**
   * 点亮一条评论。PC web 接口：bbs.hupu.com/pcmapi/pc/bbs/v1/reply/light
   * 字段全部是 number：{fid, tid, pid, puid}，puid 是当前登录用户自己的 puid（不是被亮回复者）。
   * fid 是该帖子所属板块（步行街主干道是 34，但每个帖子可能不同）。
   */
  async lightReply(tid: string, pid: string, fid: string): Promise<LightReplyResult> {
    if (!this.getSession()) return { error: { id: 401, text: '请先登录' } };
    const puid = this.getCurrentPuidFromCookie();
    if (!puid) return { error: { id: 401, text: '登录态已失效，请重新登录' } };
    const r = await this.bbsPcPost(
      '/pcmapi/pc/bbs/v1/reply/light',
      { fid: Number(fid), tid: Number(tid), pid: Number(pid), puid },
      tid,
    );
    if (r.code === 1) return { status: 1 };
    return { error: { id: r.code, text: r.msg || r.internalCode || '点亮失败' } };
  }

  /** 取消点亮。PC web 接口：bbs.hupu.com/pcmapi/pc/bbs/v1/reply/cancelLight */
  async cancelLightReply(tid: string, pid: string, fid: string): Promise<LightCancelResult> {
    if (!this.getSession()) return { code: 401, msg: '请先登录' };
    const puid = this.getCurrentPuidFromCookie();
    if (!puid) return { code: 401, msg: '登录态已失效，请重新登录' };
    const r = await this.bbsPcPost(
      '/pcmapi/pc/bbs/v1/reply/cancelLight',
      { fid: Number(fid), tid: Number(tid), pid: Number(pid), puid },
      tid,
    );
    if (r.code === 1) return { code: 0, msg: 'ok' };
    return { code: r.code, msg: r.msg || r.internalCode || '取消失败' };
  }

  /**
   * 拉 PC SSR 帖子页 HTML，从 __NEXT_DATA__ 抽取 PC 子话题 topicId 和 fid。
   * createReply 必须用 PC topicId（177 这种），不是 m 站列表里的 topicId（1 = 步行街父话题）。
   */
  async getThreadPcMeta(tid: string): Promise<{ topicId?: string; fid?: string }> {
    try {
      const html = await hupuFetch<string>({
        via: 'bbsPc',
        path: `${tid}.html`,
        tid,
        responseType: 'text',
      });
      const m = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
      if (!m) return {};
      const data = JSON.parse(m[1]);
      const thread = data?.props?.pageProps?.detail?.thread;
      return {
        topicId: thread?.topicId != null ? String(thread.topicId) : undefined,
        fid: thread?.fid != null ? String(thread.fid) : undefined,
      };
    } catch (e) {
      console.warn('getThreadPcMeta failed:', e);
      return {};
    }
  }

  /**
   * 发表回复。PC web 接口：bbs.hupu.com/pcmapi/pc/bbs/v1/createReply
   * - 楼主回复（顶层）：传 {topicId, tid, content, shumeiId, deviceid}
   * - 引用回复（针对某条评论）：再加 {pid: <被回复评论 id>, quoteId: <被回复评论 id>}
   * 注意 deviceid 全小写，跟 light 接口的 deviceId 拼写不同（hupu 后端字段名不一致是已知现象）。
   */
  async replyThread(params: {
    tid: string;
    topicId: string;
    content: string;
    /** 楼层 pid，引用回复时传被回复评论的 pid */
    pid?: string;
    /** 引用 id，通常等于 pid；不引用时可省略 */
    quoteId?: string;
  }): Promise<CreateReplyResult> {
    if (!this.getSession()) {
      return { code: 0, msg: '请先登录', data: null };
    }
    const shumeiId = (await getShumeiDeviceId().catch(() => '')) || '';
    const body: Record<string, string> = {
      topicId: String(params.topicId),
      tid: String(params.tid),
      content: params.content,
      shumeiId,
      deviceid: shumeiId,
    };
    if (params.pid) body.pid = String(params.pid);
    if (params.quoteId) body.quoteId = String(params.quoteId);
    const r = await this.bbsPcPost<CreateReplyResult['data']>(
      '/pcmapi/pc/bbs/v1/createReply',
      body,
      params.tid,
    );
    return r as CreateReplyResult;
  }

  /** 保存登录会话 */
  saveSession(session: UserSession): void {
    localStorage.setItem(this.SESSION_KEY, JSON.stringify(session));
  }

  /** 获取当前会话 */
  getSession(): UserSession | null {
    try {
      const raw = localStorage.getItem(this.SESSION_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }
}

export const hupuApi = new HupuApiService();
export type { Post, Comment, ApiResponse };
