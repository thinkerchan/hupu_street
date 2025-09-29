import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { Loader2, AlertCircle, MessageCircle, Flame, Filter } from 'lucide-react';
import { hupuApi } from '../services/api';
import type { SearchPost, SearchSortOption } from '../types';
import { rewriteMediaUrl } from '../utils/proxy';

interface SearchPageProps {
  keyword: string;
  onSelectPost: (postId: string) => void;
}

const DEFAULT_SORT = 'general';

const sortLabelMap: Record<string, string> = {
  general: '全部',
  createtime: '最新',
  reply: '最热',
};

const SearchPage: React.FC<SearchPageProps> = ({ keyword, onSelectPost }) => {
  const [results, setResults] = useState<SearchPost[]>([]);
  const [sorts, setSorts] = useState<SearchSortOption[]>([]);
  const [activeSort, setActiveSort] = useState(DEFAULT_SORT);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const resetAndSearch = useCallback((targetSort: string) => {
    setActiveSort(targetSort);
    setResults([]);
    setPage(1);
    setHasMore(false);
  }, []);

  const loadSearchResults = useCallback(async (
    targetPage: number,
    targetSort: string,
    append: boolean,
  ) => {
    if (!keyword.trim()) {
      setResults([]);
      setHasMore(false);
      return;
    }

    try {
      setError(null);
      if (append) {
        setLoadingMore(true);
      } else {
        setLoading(true);
      }

      const response = await hupuApi.searchPostsV2(keyword.trim(), targetPage, targetSort);
      if (response.success) {
        const { posts, sorts: sortList, totalPages } = response.data;
        if (!append) {
          setResults(posts);
        } else {
          setResults((prev) => [...prev, ...posts]);
        }
        if (sortList.length > 0) {
          setSorts(sortList);
        }
        setHasMore(response.hasMore ?? targetPage < totalPages);
        setPage(targetPage);
      } else {
        throw new Error(response.message || '搜索失败');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : '搜索失败，请稍后重试';
      setError(message);
      if (!append) {
        setResults([]);
      }
      console.error('Search request failed:', err);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [keyword]);

  useEffect(() => {
    resetAndSearch(DEFAULT_SORT);
  }, [keyword, resetAndSearch]);

  useEffect(() => {
    if (!keyword.trim()) {
      return;
    }
    loadSearchResults(1, activeSort, false);
  }, [keyword, activeSort, loadSearchResults]);

  const sortOptions = useMemo(() => {
    if (sorts.length > 0) {
      return sorts;
    }
    return [
      { postSort: 'general', name: sortLabelMap.general },
      { postSort: 'createtime', name: sortLabelMap.createtime },
      { postSort: 'reply', name: sortLabelMap.reply },
    ];
  }, [sorts]);

  const formatTime = (isoString: string) => {
    if (!isoString) return '';
    const date = new Date(isoString);
    return date.toLocaleString('zh-CN');
  };

  const handleLoadMore = () => {
    if (!loadingMore && hasMore) {
      loadSearchResults(page + 1, activeSort, true);
    }
  };

  if (!keyword.trim()) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-gray-500">
        <MessageCircle className="h-12 w-12 mb-4" />
        <p>请输入关键词进行搜索</p>
      </div>
    );
  }

  if (loading && results.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-gray-500">
        <Loader2 className="h-8 w-8 animate-spin text-orange-500 mb-4" />
        <p>正在搜索 “{keyword}”...</p>
      </div>
    );
  }

  if (error && results.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center text-gray-500">
        <AlertCircle className="h-12 w-12 text-red-500 mb-4" />
        <p className="mb-2">{error}</p>
        <p className="text-sm">请稍后再试或更换关键词</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">“{keyword}” 的搜索结果</h2>
          <p className="text-sm text-gray-500">找到 {results.length} 条相关帖子{hasMore ? '（可加载更多）' : ''}</p>
        </div>
        <div className="flex items-center space-x-2 bg-white border border-gray-200 rounded-full px-3 py-1">
          <Filter className="h-4 w-4 text-gray-400" />
          <div className="flex space-x-2">
            {sortOptions.map((option) => (
              <button
                key={option.postSort}
                onClick={() => resetAndSearch(option.postSort)}
                className={`px-3 py-1 text-sm rounded-full transition-colors ${
                  activeSort === option.postSort
                    ? 'bg-orange-500 text-white shadow-sm'
                    : 'text-gray-600 hover:bg-orange-50'
                }`}
              >
                {option.name ?? sortLabelMap[option.postSort] ?? option.postSort}
              </button>
            ))}
          </div>
        </div>
      </div>

      {results.length === 0 && !loading ? (
        <div className="flex flex-col items-center justify-center py-20 text-gray-500">
          <MessageCircle className="h-12 w-12 mb-4" />
          <p>暂时没有匹配的帖子，试试其他关键词吧。</p>
        </div>
      ) : (
        <div className="space-y-4">
          {results.map((post) => (
            <article
              key={post.id}
              className="bg-white border border-gray-100 rounded-xl shadow-sm p-5 hover:shadow-md transition-shadow cursor-pointer"
              onClick={() => onSelectPost(post.id)}
            >
              <header className="flex items-start justify-between mb-3">
                <div className="flex items-center space-x-3">
                  <img
                    src={rewriteMediaUrl(post.author.avatar) || post.author.avatar}
                    alt={post.author.username}
                    className="w-10 h-10 rounded-full object-cover"
                  />
                  <div>
                    <p className="text-sm font-medium text-gray-900">{post.author.username}</p>
                    <p className="text-xs text-gray-400">{post.forumName ?? '步行街'}</p>
                  </div>
                </div>
                <time className="text-xs text-gray-400">{formatTime(post.createdAt)}</time>
              </header>

              <div className="space-y-3">
                <h3
                  className="text-lg font-semibold text-gray-900 leading-relaxed"
                  dangerouslySetInnerHTML={{ __html: post.titleHtml || post.contentHtml }}
                />
                {post.contentHtml && (
                  <p
                    className="text-sm text-gray-600 leading-relaxed line-clamp-3"
                    dangerouslySetInnerHTML={{ __html: post.contentHtml }}
                  />
                )}
              </div>

              <footer className="mt-4 flex items-center space-x-6 text-sm text-gray-500">
                <span className="flex items-center space-x-1">
                  <MessageCircle className="h-4 w-4" />
                  <span>{post.replies}</span>
                </span>
                <span className="flex items-center space-x-1">
                  <Flame className="h-4 w-4" />
                  <span>{post.recommends}</span>
                </span>
              </footer>
            </article>
          ))}

          {hasMore && (
            <div className="text-center pt-4">
              <button
                onClick={handleLoadMore}
                disabled={loadingMore}
                className="px-4 py-2 text-sm text-orange-600 border border-orange-200 rounded-full hover:bg-orange-50 disabled:opacity-60"
              >
                {loadingMore ? '加载中...' : '加载更多结果'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default SearchPage;
