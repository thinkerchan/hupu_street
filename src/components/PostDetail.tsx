import React, { useState, useEffect } from 'react';
import { ArrowLeft, Eye, MessageCircle, Clock, ExternalLink, RefreshCw, Loader2 } from 'lucide-react';
import { hupuApi } from '../services/api';
import type { Post, Comment } from '../types';

interface PostDetailProps {
  post: Post;
  onBack: () => void;
}

const PostDetail: React.FC<PostDetailProps> = ({ post: initialPost, onBack }) => {
  const [post, setPost] = useState<Post>(initialPost);
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingComments, setLoadingComments] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [commentsPage, setCommentsPage] = useState(1);
  const [hasMoreComments, setHasMoreComments] = useState(true);

  useEffect(() => {
    loadPostDetail();
  }, [initialPost.id]);

  const loadPostDetail = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // 加载帖子详情
      const postResponse = await hupuApi.getPost(initialPost.id);
      if (postResponse.success) {
        setPost(postResponse.data);
      }

      // 加载评论
      const commentsResponse = await hupuApi.getComments(initialPost.id, 1);
      if (commentsResponse.success) {
        setComments(commentsResponse.data);
        setHasMoreComments(commentsResponse.hasMore ?? commentsResponse.data.length >= 20);
      }

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '加载失败';
      setError(errorMessage);
      console.error('Failed to load post detail:', err);
    } finally {
      setLoading(false);
    }
  };

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

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return '刚刚';
    if (minutes < 60) return `${minutes}分钟前`;
    if (hours < 24) return `${hours}小时前`;
    if (days < 7) return `${days}天前`;
    return date.toLocaleDateString('zh-CN');
  };

  const formatNumber = (num: number) => {
    if (num >= 10000) {
      return `${(num / 10000).toFixed(1)}万`;
    }
    return num.toLocaleString();
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

      <div className="max-w-4xl mx-auto px-4 py-6">
        {/* Post Content */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mb-6">
          {/* Author Info */}
          <div className="flex items-center space-x-3 mb-4">
            <div className="relative">
              <img
                src={post.author.avatar}
                alt={post.author.username}
                className="w-12 h-12 rounded-full object-cover ring-2 ring-gray-100"
              />
              <div className="absolute -bottom-1 -right-1 bg-gradient-to-r from-orange-500 to-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-medium">
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
                <span>{formatTime(post.createdAt)}</span>
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
              dangerouslySetInnerHTML={{ __html: post.content }}
            />
          </div>

          {/* Images */}
          {post.images && post.images.length > 0 && (
            <div className="mb-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {post.images.map((image, index) => (
                  <img
                    key={index}
                    src={image}
                    alt=""
                    className="w-full h-64 object-cover rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
                    loading="lazy"
                    onClick={() => window.open(image, '_blank')}
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
                <span>{formatNumber(post.views)}</span>
              </div>
              <div className="flex items-center space-x-1">
                <MessageCircle className="h-5 w-5" />
                <span>{post.replies}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Comments */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h3 className="font-semibold mb-6 flex items-center space-x-2">
            <MessageCircle className="h-5 w-5" />
            <span>评论 ({post.replies})</span>
          </h3>
          
          <div className="space-y-6">
            {comments.map((comment) => (
              <div key={comment.id} className="flex space-x-3">
                <div className="relative flex-shrink-0">
                  <img
                    src={comment.author.avatar}
                    alt={comment.author.username}
                    className="w-10 h-10 rounded-full object-cover ring-2 ring-gray-100"
                  />
                  <div className="absolute -bottom-1 -right-1 bg-gradient-to-r from-orange-500 to-red-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center">
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
                      {formatTime(comment.createdAt)}
                    </span>
                  </div>
                  <div 
                    className="text-gray-700 mb-3 leading-relaxed"
                    dangerouslySetInnerHTML={{ __html: comment.content }}
                  />
                  <div className="flex items-center space-x-4">
                    <span className="text-sm text-gray-500">
                      {comment.likes > 0 && `${comment.likes} 个赞`}
                    </span>
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