import React, { useState, useEffect, useCallback } from 'react';
import { Loader2, AlertCircle, RefreshCw } from 'lucide-react';
import PostCard from './PostCard';
import { hupuApi } from '../services/api';
import type { Post } from '../types';

interface PostListProps {
  searchQuery?: string;
  onPostClick: (post: Post) => void;
}

const PostList: React.FC<PostListProps> = ({ searchQuery, onPostClick }) => {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  const loadPosts = useCallback(async (pageNum: number, reset = false) => {
    try {
      setError(null);
      if (pageNum === 1) {
        setLoading(true);
      } else {
        setLoadingMore(true);
      }

      const response = searchQuery 
        ? await hupuApi.searchGambiaPosts(searchQuery, pageNum)
        : await hupuApi.getGambiaPosts(pageNum);

      if (response.success) {
        if (reset || pageNum === 1) {
          setPosts(response.data);
        } else {
          setPosts(prev => [...prev, ...response.data]);
        }
        setHasMore(response.hasMore ?? response.data.length >= 20);
      } else {
        throw new Error(response.message || '加载失败');
      }

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '网络错误，请重试';
      setError(errorMessage);
      console.error('Failed to load posts:', err);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [searchQuery]);

  useEffect(() => {
    setPage(1);
    loadPosts(1, true);
  }, [searchQuery, loadPosts]);

  const handleLoadMore = () => {
    if (!loadingMore && hasMore) {
      const nextPage = page + 1;
      setPage(nextPage);
      loadPosts(nextPage);
    }
  };

  const handleRefresh = () => {
    setPage(1);
    loadPosts(1, true);
  };

  // Infinite scroll
  useEffect(() => {
    const handleScroll = () => {
      if (
        window.innerHeight + document.documentElement.scrollTop >=
        document.documentElement.offsetHeight - 1000
      ) {
        if (!loadingMore && hasMore && !loading) {
          handleLoadMore();
        }
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [loadingMore, hasMore, loading]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-orange-500 mb-4" />
        <p className="text-gray-600">正在加载步行街内容...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <AlertCircle className="h-12 w-12 text-red-500 mb-4" />
        <p className="text-gray-600 mb-4">{error}</p>
        <button
          onClick={handleRefresh}
          className="flex items-center space-x-2 px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors"
        >
          <RefreshCw className="h-4 w-4" />
          <span>重试</span>
        </button>
      </div>
    );
  }

  if (posts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
          <MessageCircle className="h-8 w-8 text-gray-400" />
        </div>
        <p className="text-gray-600 mb-2">
          {searchQuery ? '没有找到相关帖子' : '暂无帖子'}
        </p>
        {searchQuery && (
          <p className="text-sm text-gray-500">
            尝试使用其他关键词搜索
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Refresh Button */}
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold text-gray-900">
          {searchQuery ? `搜索结果: ${searchQuery}` : '最新帖子'}
        </h2>
        <button
          onClick={handleRefresh}
          disabled={loading}
          className="flex items-center space-x-1 px-3 py-1.5 text-sm text-gray-600 hover:text-orange-600 hover:bg-orange-50 rounded-lg transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          <span>刷新</span>
        </button>
      </div>

      {/* Posts */}
      {posts.map((post) => (
        <PostCard
          key={post.id}
          post={post}
          onClick={onPostClick}
        />
      ))}

      {/* Loading More */}
      {loadingMore && (
        <div className="flex justify-center py-8">
          <div className="flex items-center space-x-2 text-gray-600">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span>加载更多...</span>
          </div>
        </div>
      )}

      {/* No More Content */}
      {!hasMore && posts.length > 0 && (
        <div className="text-center py-8">
          <div className="inline-flex items-center space-x-2 px-4 py-2 bg-gray-100 rounded-full text-sm text-gray-600">
            <span>已加载全部内容</span>
          </div>
        </div>
      )}

      {/* Load More Button (fallback for infinite scroll) */}
      {hasMore && !loadingMore && posts.length >= 20 && (
        <div className="text-center py-6">
          <button
            onClick={handleLoadMore}
            className="px-6 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
          >
            加载更多
          </button>
        </div>
      )}
    </div>
  );
};

export default PostList;