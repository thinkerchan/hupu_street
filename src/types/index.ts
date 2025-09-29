export interface Post {
  id: string;
  title: string;
  content: string;
  author: {
    username: string;
    avatar: string;
    level: number;
    uid: string;
  };
  createdAt: string;
  replies: number;
  views: number;
  likes: number;
  images?: string[];
  isTop?: boolean;
  isHot?: boolean;
  url: string;
  topicName?: string;
  shareNum?: number;
  lightReply?: {
    username: string;
    content: string;
    quote?: string;
    lightCount: number;
  };
  video?: {
    cover?: string;
    duration?: string;
    playNum: number;
    url?: string;
  };
}

export interface Comment {
  id: string;
  content: string;
  author: {
    username: string;
    avatar: string;
    level: number;
    uid: string;
  };
  createdAt: string;
  likes: number;
  floor: number;
  replies?: Comment[];
  quote?: {
    username: string;
    content: string;
  };
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
  total?: number;
  page?: number;
  hasMore?: boolean;
}

export interface HupuPostListItem {
  tid: string;
  title: string;
  author_name: string;
  author_uid: string;
  author_avatar?: string;
  create_time: string;
  reply_count: number;
  view_count: number;
  last_reply_time: string;
  is_top: boolean;
  is_hot: boolean;
  content_preview?: string;
}

export interface HupuPostDetail {
  tid: string;
  title: string;
  content: string;
  author_name: string;
  author_uid: string;
  author_avatar?: string;
  create_time: string;
  reply_count: number;
  view_count: number;
  images?: string[];
}

export interface HupuComment {
  pid: string;
  content: string;
  author_name: string;
  author_uid: string;
  author_avatar?: string;
  create_time: string;
  floor: number;
  like_count: number;
}