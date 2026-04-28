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
  /** 板块 id，从 t_detail.f_info.fid 拿，PC web light 接口必传 */
  fid?: string;
  /** PC web 子话题 id，仅 PC SSR __NEXT_DATA__ 里有，createReply 接口必传 */
  topicId?: string;
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

// ---- Login types (from APK reverse engineering) ----

export interface LoginResultError {
  id: number;
  text?: string;
}

export interface BindInfo {
  bind_name?: string;
  channel: number;
  is_bind: number;
  status: number;
}

export interface LoginResponse {
  authToken?: string;
  token?: string;
  uid: number;
  puid: number;
  nickname?: string;
  header?: string;
  newJr?: boolean;
  jumpUrl?: string;
  nickname_set_url?: string;
  bind?: BindInfo[];
}

export interface LoginResult {
  error?: LoginResultError;
  result?: LoginResponse;
}

export interface PhoneVerifyCodeResponse {
  status: number;
  expire: number;
}

export interface PhoneVerifyCodeResult {
  error?: { id?: string; text?: string };
  result?: PhoneVerifyCodeResponse;
}

export interface UserSession {
  token: string;
  authToken?: string;
  uid: number;
  puid: number;
  nickname: string;
  avatar: string;
}

// 来自 APK bbslightapi/light/v1/replyLightNew
export interface LightReplyResult {
  status?: number;
  error?: LoginResultError;
}

// 来自 APK bbslightapi/light/v1/cancelLight
export interface LightCancelResult {
  code?: number;
  msg?: string;
}

// 来自 PC web /pcmapi/pc/bbs/v1/createReply
export interface CreateReplyData {
  pid: number;
  uid?: number; // 注意：实际是 15 位 puid
  content?: string;
  header?: string;
  postdate?: number;
  audit_status?: number;
  toastMsg?: string | null;
}

export interface CreateReplyResult {
  code: number;
  msg?: string | null;
  internalCode?: string;
  data?: CreateReplyData | null;
}
