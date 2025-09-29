import type { Post, Comment, ApiResponse, HupuPostListItem, HupuPostDetail, HupuComment } from '../types';

// 检查环境变量是否存在，如果不存在则使用模拟数据
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

const API_BASE = SUPABASE_URL ? `${SUPABASE_URL}/functions/v1` : null;

class HupuApiService {
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
  private transformPost(hupuPost: HupuPostListItem): Post {
    return {
      id: hupuPost.tid,
      title: hupuPost.title,
      content: hupuPost.content_preview || '',
      author: {
        username: hupuPost.author_name,
        avatar: hupuPost.author_avatar || this.getDefaultAvatar(),
        level: this.calculateLevel(hupuPost.author_uid),
        uid: hupuPost.author_uid,
      },
      createdAt: hupuPost.create_time,
      replies: hupuPost.reply_count,
      views: hupuPost.view_count,
      likes: 0, // 虎扑列表页不提供点赞数
      isTop: hupuPost.is_top,
      isHot: hupuPost.is_hot,
      url: `https://bbs.hupu.com/${hupuPost.tid}.html`,
    };
  }

  // 转换虎扑帖子详情数据格式
  private transformPostDetail(hupuPost: HupuPostDetail): Post {
    return {
      id: hupuPost.tid,
      title: hupuPost.title,
      content: hupuPost.content,
      author: {
        username: hupuPost.author_name,
        avatar: hupuPost.author_avatar || this.getDefaultAvatar(),
        level: this.calculateLevel(hupuPost.author_uid),
        uid: hupuPost.author_uid,
      },
      createdAt: hupuPost.create_time,
      replies: hupuPost.reply_count,
      views: hupuPost.view_count,
      likes: 0,
      images: hupuPost.images,
      url: `https://bbs.hupu.com/${hupuPost.tid}.html`,
    };
  }

  // 转换虎扑评论数据格式
  private transformComment(hupuComment: HupuComment): Comment {
    return {
      id: hupuComment.pid,
      content: hupuComment.content,
      author: {
        username: hupuComment.author_name,
        avatar: hupuComment.author_avatar || this.getDefaultAvatar(),
        level: this.calculateLevel(hupuComment.author_uid),
        uid: hupuComment.author_uid,
      },
      createdAt: hupuComment.create_time,
      likes: hupuComment.like_count,
      floor: hupuComment.floor,
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

  // 获取步行街帖子列表
  async getGambiaPosts(page: number = 1): Promise<ApiResponse<Post[]>> {
    const response = await this.request<HupuPostListItem[]>(`/gambia/posts?page=${page}`);
    return {
      ...response,
      data: response.data.map(post => this.transformPost(post)),
    };
  }

  // 获取帖子详情
  async getPost(tid: string): Promise<ApiResponse<Post>> {
    const response = await this.request<HupuPostDetail>(`/posts/${tid}`);
    return {
      ...response,
      data: this.transformPostDetail(response.data),
    };
  }

  // 获取帖子评论
  async getComments(tid: string, page: number = 1): Promise<ApiResponse<Comment[]>> {
    const response = await this.request<HupuComment[]>(`/posts/${tid}/comments?page=${page}`);
    return {
      ...response,
      data: response.data.map(comment => this.transformComment(comment)),
    };
  }

  // 搜索步行街帖子
  async searchGambiaPosts(query: string, page: number = 1): Promise<ApiResponse<Post[]>> {
    const response = await this.request<HupuPostListItem[]>(`/gambia/search?q=${encodeURIComponent(query)}&page=${page}`);
    return {
      ...response,
      data: response.data.map(post => this.transformPost(post)),
    };
  }
}

export const hupuApi = new HupuApiService();
export type { Post, Comment, ApiResponse };