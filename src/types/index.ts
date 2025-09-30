export interface LoginResponse {
  success: boolean;
  data?: {
    authToken: string;
    userInfo: UserInfo;
  };
  message?: string;
}

export interface UserInfo {
  uid?: string;
  username?: string;
  avatar?: string;
  [key: string]: any;
}

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
  replies?: number;
  quote?: {
    username: string;
    content: string;
  };
  images?: string[];
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
  replies?: number | string;
  quote_info?: {
    username?: string;
    content?: string;
  };
}

export interface HupuSearchPostItem {
  id: number | string;
  itemid?: string;
  title?: string;
  content?: string;
  replies?: number;
  lights?: number;
  recNum?: number;
  username?: string;
  header?: string;
  puid?: number | string;
  addtime?: number;
  lastPostTime?: number;
  picture?: string;
  pic?: boolean;
  img?: string | null;
  forum_name?: string;
  link?: string;
  display_type?: string;
}

export interface SearchPost {
  id: string;
  titleHtml: string;
  contentHtml: string;
  author: {
    username: string;
    avatar: string;
    uid: string;
  };
  replies: number;
  lights: number;
  recommends: number;
  createdAt: string;
  forumName?: string;
  link?: string;
}

export interface SearchSortOption {
  postSort: string;
  name: string;
}
