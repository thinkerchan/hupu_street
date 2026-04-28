import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ArrowLeft, Eye, MessageCircle, Clock, ExternalLink, RefreshCw, Loader2, Flame, Send, Reply, X } from 'lucide-react';
import { hupuApi } from '../services/api';
import type { Post, Comment } from '../types';
import { rewriteMediaUrl } from '../utils/proxy';
import { formatRelativeTime, formatCount } from '../utils/format';

interface PostDetailProps {
  post: Post;
  onBack: () => void;
  initialComments?: Comment[];
  initialHasMoreComments?: boolean;
  onLoginRequired?: () => void;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const PostDetail: React.FC<PostDetailProps> = ({
  post: initialPost,
  onBack,
  initialComments,
  initialHasMoreComments,
  onLoginRequired,
}) => {
  const hasInitialComments = Array.isArray(initialComments);
  const [post, setPost] = useState<Post>(initialPost);
  const [comments, setComments] = useState<Comment[]>(initialComments ?? []);
  const [loading, setLoading] = useState(!hasInitialComments);
  const [loadingComments, setLoadingComments] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [commentsPage, setCommentsPage] = useState(hasInitialComments ? 1 : 0);
  const [hasMoreComments, setHasMoreComments] = useState(
    hasInitialComments ? (initialHasMoreComments ?? (initialComments?.length ?? 0) >= 20) : true
  );

  const isFetchingRef = useRef(false);
  // 本地维护点亮态：APK 接口不返回新的亮数，UI 只能本地累加。
  const [lightingPid, setLightingPid] = useState<string | null>(null);
  const [lightedPids, setLightedPids] = useState<Set<string>>(() => new Set());
  const [lightDelta, setLightDelta] = useState<Record<string, number>>({});
  // 回帖输入框（兼"评论回复"，复用同一框；replyTo 非空时带 pid/quoteId 引用）
  const [replyContent, setReplyContent] = useState('');
  const [submittingReply, setSubmittingReply] = useState(false);
  const [replyError, setReplyError] = useState('');
  const [replyTo, setReplyTo] = useState<Comment | null>(null);
  const replyTextareaRef = useRef<HTMLTextAreaElement | null>(null);

  const handleStartReplyToComment = useCallback((comment: Comment) => {
    if (!hupuApi.getSession()) {
      onLoginRequired?.();
      return;
    }
    setReplyTo(comment);
    setReplyError('');
    // 滚动 + 聚焦输入框
    setTimeout(() => {
      replyTextareaRef.current?.focus();
      replyTextareaRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }, 0);
  }, [onLoginRequired]);

  const handleSubmitReply = useCallback(async () => {
    const text = replyContent.trim();
    if (!text || submittingReply) return;
    if (!hupuApi.getSession()) {
      onLoginRequired?.();
      return;
    }
    if (!post.topicId) {
      setReplyError('帖子话题信息加载中，请稍候再试');
      return;
    }
    setReplyError('');
    setSubmittingReply(true);
    try {
      // 简单地把每行包成 <p>，与 PC 编辑器最简文本一致
      const html = text
        .split(/\n+/)
        .map((line) => `<p>${escapeHtml(line)}</p>`)
        .join('');
      const r = await hupuApi.replyThread({
        tid: post.id,
        topicId: post.topicId,
        content: html,
        pid: replyTo?.id,
        quoteId: replyTo?.id,
      });
      if (r.code !== 1) {
        setReplyError(r.msg || r.internalCode || '发表失败');
        return;
      }
      // 把新回复乐观地拼到列表末尾，刷新 UI
      const session = hupuApi.getSession();
      const newComment: Comment = {
        id: String(r.data?.pid ?? Date.now()),
        content: r.data?.content ?? html,
        author: {
          username: session?.nickname ?? '我',
          avatar: r.data?.header ?? session?.avatar ?? '',
          level: 1,
          uid: String(r.data?.uid ?? session?.puid ?? 0),
        },
        createdAt: r.data?.postdate
          ? new Date(r.data.postdate * 1000).toISOString()
          : new Date().toISOString(),
        likes: 0,
        floor: comments.length + 1,
        quote: replyTo
          ? { username: replyTo.author.username, content: replyTo.content }
          : undefined,
      };
      setComments((prev) => [...prev, newComment]);
      setReplyContent('');
      setReplyTo(null);
      if (r.data?.toastMsg) alert(r.data.toastMsg);
    } catch (e) {
      console.error('replyThread failed:', e);
      setReplyError('网络异常，请稍后重试');
    } finally {
      setSubmittingReply(false);
    }
  }, [replyContent, submittingReply, post.id, post.topicId, comments.length, onLoginRequired, replyTo]);

  const handleToggleLight = useCallback(
    async (comment: Comment) => {
      if (!hupuApi.getSession()) {
        onLoginRequired?.();
        return;
      }
      if (lightingPid === comment.id) return;
      const wasLighted = lightedPids.has(comment.id);
      const fid = post.fid;
      if (!fid) {
        alert('帖子板块信息缺失，请刷新后重试');
        return;
      }
      setLightingPid(comment.id);
      try {
        let errorId: number | undefined;
        let errorText: string | undefined;
        if (wasLighted) {
          const r = await hupuApi.cancelLightReply(post.id, comment.id, fid);
          if (r.code && r.code !== 0) {
            errorId = r.code;
            errorText = r.msg;
          }
        } else {
          const r = await hupuApi.lightReply(post.id, comment.id, fid);
          if (r.error?.id) {
            errorId = r.error.id;
            errorText = r.error.text;
          }
        }
        if (errorId) {
          alert(errorText ?? `操作失败 (${errorId})`);
          return;
        }
        setLightedPids((prev) => {
          const next = new Set(prev);
          if (wasLighted) next.delete(comment.id);
          else next.add(comment.id);
          return next;
        });
        setLightDelta((prev) => ({
          ...prev,
          [comment.id]: (prev[comment.id] ?? 0) + (wasLighted ? -1 : 1),
        }));
      } catch (e) {
        console.error('light reply failed:', e);
        alert('网络异常，请稍后重试');
      } finally {
        setLightingPid(null);
      }
    },
    [lightingPid, lightedPids, post.id, onLoginRequired],
  );

  const loadPostDetail = useCallback(async () => {
    if (isFetchingRef.current) {
      return;
    }
    try {
      isFetchingRef.current = true;
      setLoading(true);
      setError(null);
      setComments([]);
      setCommentsPage(1);
      setHasMoreComments(false);

      const response = await hupuApi.getPostWithComments(initialPost.id);

      if (response.success) {
        setPost(response.data.post);
        setComments(response.data.comments);
        setCommentsPage(1);
        setHasMoreComments(response.data.hasMoreComments);
      } else {
        setError(response.message ?? '加载失败');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '加载失败';
      setError(errorMessage);
      console.error('Failed to load post detail:', err);
    } finally {
      isFetchingRef.current = false;
      setLoading(false);
    }
  }, [initialPost.id]);

  useEffect(() => {
    setPost(initialPost);
    if (hasInitialComments) {
      setComments(initialComments ?? []);
      setHasMoreComments(initialHasMoreComments ?? ((initialComments?.length ?? 0) >= 20));
      setCommentsPage(1);
      setError(null);
      setLoading(false);
    } else {
      loadPostDetail();
    }
  }, [initialPost, hasInitialComments, initialComments, initialHasMoreComments, loadPostDetail]);

  // PC SSR 才有的 topicId：m.hupu.com 接口里没这个字段，createReply 必须用它。
  // 第一次进帖子时如果缺，就拉一次 PC 帖子页 HTML 解析 __NEXT_DATA__ 拿。
  useEffect(() => {
    let cancelled = false;
    if (!post.topicId && post.id) {
      hupuApi.getThreadPcMeta(post.id).then((meta) => {
        if (cancelled) return;
        if (meta.topicId) {
          setPost((prev) => ({
            ...prev,
            topicId: meta.topicId,
            fid: prev.fid ?? meta.fid,
          }));
        }
      });
    }
    return () => {
      cancelled = true;
    };
  }, [post.id, post.topicId]);

  const loadMoreComments = async () => {
    if (loadingComments || !hasMoreComments) return;

    try {
      setLoadingComments(true);
      const nextPage = commentsPage + 1;
      const response = await hupuApi.getComments(post.id, nextPage);

      if (response.success) {
        setComments(prev => [...prev, ...response.data]);
        setCommentsPage(nextPage);
        setHasMoreComments(response.hasMore ?? response.data.length >= 20);
      }
    } catch (err) {
      console.error('Failed to load more comments:', err);
    } finally {
      setLoadingComments(false);
    }
  };

  const handleExternalLink = () => {
    window.open(post.url, '_blank');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="bg-white shadow-sm sticky top-0 z-10">
          <div className="max-w-4xl mx-auto px-4 py-4">
            <div className="flex items-center space-x-4">
              <button
                onClick={onBack}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
              <h1 className="text-lg font-semibold">加载中...</h1>
            </div>
          </div>
        </div>
        <div className="flex justify-center items-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="bg-white shadow-sm sticky top-0 z-10">
          <div className="max-w-4xl mx-auto px-4 py-4">
            <div className="flex items-center space-x-4">
              <button
                onClick={onBack}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
              <h1 className="text-lg font-semibold">加载失败</h1>
            </div>
          </div>
        </div>
        <div className="flex flex-col items-center justify-center py-20">
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={loadPostDetail}
            className="flex items-center space-x-2 px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors"
          >
            <RefreshCw className="h-4 w-4" />
            <span>重试</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button
                onClick={onBack}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
              <h1 className="text-lg font-semibold truncate">帖子详情</h1>
            </div>
            <button
              onClick={handleExternalLink}
              className="flex items-center space-x-2 px-3 py-1.5 text-sm text-orange-600 hover:bg-orange-50 rounded-lg transition-colors"
            >
              <ExternalLink className="h-4 w-4" />
              <span className="hidden sm:inline">在虎扑中查看</span>
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-0 md:px-4 md:py-6 pt-2">
        {/* Post Content */}
        <div className="bg-white md:rounded-xl shadow-sm border border-gray-100 p-3 md:p-6 mb-6">
          {/* Author Info */}
          <div className="flex items-center space-x-3 mb-4">
            <div className="relative">
              <img
                src={rewriteMediaUrl(post.author.avatar) || post.author.avatar}
                alt={post.author.username}
                className="w-12 h-12 rounded-full object-cover ring-2 ring-gray-100"
              />
              <div className="absolute top-0 right-0 translate-x-1/2 -translate-y-1/2 bg-gradient-to-r from-orange-500 to-red-500 text-white text-xs px-1.5 py-0.5 rounded-full flex items-center justify-center font-semibold shadow-sm">
                {post.author.level}
              </div>
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-medium text-gray-900">{post.author.username}</span>
                <span className="bg-orange-100 text-orange-700 px-2 py-0.5 rounded text-xs font-medium">
                  步行街
                </span>
              </div>
              <div className="flex items-center space-x-2 text-sm text-gray-500">
                <Clock className="h-3 w-3" />
                <span>{formatRelativeTime(post.createdAt)}</span>
              </div>
            </div>
          </div>

          {/* Title */}
          <h1 className="text-2xl font-bold text-gray-900 mb-4 leading-relaxed">
            {post.title}
          </h1>

          {/* Content */}
          <div className="prose prose-gray max-w-none mb-6">
            <div
              className="text-gray-700 leading-relaxed whitespace-pre-wrap"
              dangerouslySetInnerHTML={{
                __html: post.content?.replace(
                  /<video([^>]*)>/g,
                  '<video$1 controls style="display:block;width: 100%;">'
                ) || ''
              }}
            />
          </div>

          {/* Images */}
          {post.images && post.images.length > 0 && (
            <div className="mb-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {post.images.map((image, index) => (
                  <img
                    key={index}
                    src={rewriteMediaUrl(image) || image}
                    alt=""
                    className="w-full h-64 object-cover rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
                    loading="lazy"
                    onClick={() => window.open(rewriteMediaUrl(image) || image, '_blank')}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Stats */}
          <div className="flex items-center justify-between pt-4 border-t border-gray-100">
            <div className="flex items-center space-x-6 text-gray-500">
              <div className="flex items-center space-x-1">
                <Eye className="h-5 w-5" />
                <span>{formatCount(post.views)}</span>
              </div>
              <div className="flex items-center space-x-1">
                <MessageCircle className="h-5 w-5" />
                <span>{post.replies}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Comments */}
        <div className="bg-white md:rounded-xl shadow-sm md:border border-gray-100 p-3 md:p-6">
          <h3 className="font-semibold mb-4 flex items-center space-x-2">
            <MessageCircle className="h-5 w-5" />
            <span>评论 ({post.replies})</span>
          </h3>

          {/* Reply form（楼层引用复用同一框，replyTo 非空时上面显示"回复 @xxx"提示） */}
          <div className="mb-6 border-t pt-4">
            {hupuApi.getSession() ? (
              <div>
                {replyTo && (
                  <div className="mb-2 flex items-start gap-2 px-3 py-2 bg-orange-50 border border-orange-100 rounded-lg text-xs">
                    <Reply className="h-3.5 w-3.5 text-orange-500 mt-0.5 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <span className="text-orange-600 font-medium">
                        回复 @{replyTo.author.username}
                      </span>
                      <div
                        className="mt-1 text-gray-500 line-clamp-2 break-words"
                        dangerouslySetInnerHTML={{ __html: replyTo.content }}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => setReplyTo(null)}
                      className="text-gray-400 hover:text-gray-600 flex-shrink-0"
                      title="取消引用"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
                <textarea
                  ref={replyTextareaRef}
                  value={replyContent}
                  onChange={(e) => {
                    setReplyContent(e.target.value);
                    if (replyError) setReplyError('');
                  }}
                  placeholder={
                    post.topicId
                      ? replyTo
                        ? `回复 @${replyTo.author.username}...`
                        : '说点什么...'
                      : '加载帖子信息中，稍候...'
                  }
                  disabled={!post.topicId || submittingReply}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent text-sm resize-none disabled:bg-gray-50 disabled:text-gray-400"
                />
                {replyError && (
                  <div className="mt-2 text-sm text-red-500">{replyError}</div>
                )}
                <div className="mt-2 flex justify-end">
                  <button
                    type="button"
                    onClick={handleSubmitReply}
                    disabled={!replyContent.trim() || !post.topicId || submittingReply}
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-lg text-sm font-medium hover:from-orange-600 hover:to-red-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                  >
                    {submittingReply ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                    发表回复
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => onLoginRequired?.()}
                className="w-full py-3 border border-dashed border-gray-300 text-gray-500 hover:border-orange-300 hover:text-orange-600 rounded-lg text-sm transition-colors"
              >
                登录后参与讨论
              </button>
            )}
          </div>

          <div className="space-y-6">
            {comments.map((comment) => (
              <div key={comment.id} className="flex space-x-3 border-t pt-5">
                <div className="relative flex-shrink-0">
                  <img
                    src={rewriteMediaUrl(comment.author.avatar) || comment.author.avatar}
                    alt={comment.author.username}
                    className="w-10 h-10 rounded-full object-cover ring-2 ring-gray-100"
                  />
                  <div data-desc="用户级别" className="absolute top-0 right-0 translate-x-1/2 -translate-y-1/2 bg-gradient-to-r from-orange-500 to-red-500 text-white text-[10px] px-1 py-0.5 rounded-full flex items-center justify-center font-semibold shadow-sm">
                    {comment.author.level}
                  </div>
                </div>
                <div className="flex-1">
                  <div className="flex items-center space-x-2 mb-2">
                    <span className="font-medium text-gray-900">
                      {comment.author.username}
                    </span>
                    <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                      {comment.floor}楼
                    </span>
                    <span className="text-sm text-gray-500">
                      {formatRelativeTime(comment.createdAt)}
                    </span>
                  </div>
                  {comment.quote && (
                    <div className="mb-3 rounded-lg border border-gray-100 bg-gray-50 px-3 py-2">
                      <div className="text-xs text-gray-500 mb-1">
                        @{comment.quote.username}
                      </div>
                      <div
                        className="text-sm text-gray-600 leading-relaxed"
                        dangerouslySetInnerHTML={{ __html: comment.quote.content }}
                      />
                    </div>
                  )}
                  <div
                    className="text-gray-700 mb-3 leading-relaxed break-words"
                    dangerouslySetInnerHTML={{ __html: comment.content }}
                  />
                  {comment.images && comment.images.length > 0 && (
                    <div className="mb-3 grid grid-cols-2 gap-3">
                      {comment.images.map((imgUrl, index) => (
                        <img
                          key={`${comment.id}-img-${index}`}
                          src={rewriteMediaUrl(imgUrl) || imgUrl}
                          alt=""
                          className="w-full h-36 object-cover rounded-lg border border-gray-100"
                          loading="lazy"
                          onClick={() => window.open(rewriteMediaUrl(imgUrl) || imgUrl, '_blank')}
                        />
                      ))}
                    </div>
                  )}
                  <div className="flex items-center gap-4 text-sm text-gray-500">
                    {(() => {
                      const isLighted = lightedPids.has(comment.id);
                      const isPending = lightingPid === comment.id;
                      const lights = Math.max(0, comment.likes + (lightDelta[comment.id] ?? 0));
                      return (
                        <button
                          type="button"
                          onClick={() => handleToggleLight(comment)}
                          disabled={isPending}
                          className={`inline-flex items-center gap-1 px-2 py-1 rounded-md transition-colors disabled:opacity-50 ${
                            isLighted
                              ? 'text-orange-600 bg-orange-50 hover:bg-orange-100'
                              : 'hover:bg-gray-100'
                          }`}
                          title={isLighted ? '取消点亮' : '点亮'}
                        >
                          {isPending ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Flame className={`h-4 w-4 ${isLighted ? 'fill-orange-500' : ''}`} />
                          )}
                          <span>{lights > 0 ? lights : '亮'}</span>
                        </button>
                      );
                    })()}
                    <button
                      type="button"
                      onClick={() => handleStartReplyToComment(comment)}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded-md hover:bg-gray-100 transition-colors"
                      title="回复"
                    >
                      <Reply className="h-4 w-4" />
                      <span>回复</span>
                    </button>
                    {(comment.replies ?? 0) > 0 && (
                      <span>{comment.replies} 条回复</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Load More Comments */}
          {hasMoreComments && (
            <div className="text-center mt-6">
              <button
                onClick={loadMoreComments}
                disabled={loadingComments}
                className="flex items-center space-x-2 mx-auto px-4 py-2 text-orange-600 hover:bg-orange-50 rounded-lg transition-colors disabled:opacity-50"
              >
                {loadingComments ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
                <span>{loadingComments ? '加载中...' : '加载更多评论'}</span>
              </button>
            </div>
          )}

          {comments.length === 0 && (
            <div className="text-center py-12 text-gray-500">
              <MessageCircle className="h-12 w-12 mx-auto mb-4 text-gray-300" />
              <p>暂无评论</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PostDetail;
