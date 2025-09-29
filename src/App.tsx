import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Loader2 } from 'lucide-react';
import Header from './components/Header';
import PostList from './components/PostList';
import PostDetail from './components/PostDetail';
import SearchPage from './components/SearchPage';
import { hupuApi } from './services/api';

function App() {
  const [currentView, setCurrentView] = useState<'list' | 'detail' | 'search'>('list');
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [initializingDetail, setInitializingDetail] = useState(false);
  const selectedPostRef = useRef<Post | null>(selectedPost);
  const [preloadedDetail, setPreloadedDetail] = useState<{
    post: Post;
    comments: Comment[];
    hasMoreComments: boolean;
  } | null>(null);

  useEffect(() => {
    selectedPostRef.current = selectedPost;
  }, [selectedPost]);

  const applyDetailHash = useCallback((postId: string) => {
    window.location.hash = `/post/${postId}`;
  }, []);

  const clearHash = useCallback(() => {
    if (window.location.hash !== '#/' && window.location.hash !== '#') {
      window.location.hash = '#/';
    } else if (!window.location.hash) {
      window.location.hash = '#/';
    }
  }, []);

  const handlePostClick = (post: Post) => {
    setPreloadedDetail(null);
    selectedPostRef.current = post;
    setSelectedPost(post);
    setCurrentView('detail');
    applyDetailHash(post.id);
  };

  const handleBackToList = () => {
    setCurrentView('list');
    setSelectedPost(null);
    selectedPostRef.current = null;
    setPreloadedDetail(null);
    clearHash();
  };

  const handleSearch = (query: string) => {
    const trimmed = query.trim();
    if (!trimmed) {
      clearHash();
      setCurrentView('list');
      setSearchKeyword('');
      return;
    }
    setSearchKeyword(trimmed);
    setSelectedPost(null);
    selectedPostRef.current = null;
    setPreloadedDetail(null);
    setInitializingDetail(false);
    setCurrentView('search');
    window.location.hash = `/search/${encodeURIComponent(trimmed)}`;
  };

  useEffect(() => {
    let cancelled = false;

    const syncFromHash = async () => {
      const hash = window.location.hash;
      if (!hash || hash === '#' || hash === '#/') {
        if (!cancelled) {
          setCurrentView('list');
          setSelectedPost(null);
          setPreloadedDetail(null);
          selectedPostRef.current = null;
          setInitializingDetail(false);
        }
        return;
      }

      const searchMatch = hash.match(/^#\/search\/(.+)$/);
      if (searchMatch) {
        const keywordValue = decodeURIComponent(searchMatch[1] ?? '').trim();
        if (!cancelled) {
          setSearchKeyword(keywordValue);
          setCurrentView('search');
          setSelectedPost(null);
          selectedPostRef.current = null;
          setPreloadedDetail(null);
          setInitializingDetail(false);
        }
        return;
      }

      const match = hash.match(/^#\/post\/(.+)$/);
      if (!match) {
        if (!cancelled) {
          setCurrentView('list');
          setSelectedPost(null);
          setPreloadedDetail(null);
          selectedPostRef.current = null;
          setInitializingDetail(false);
        }
        return;
      }

      const targetId = match[1];
      const currentSelected = selectedPostRef.current;

      if (currentSelected && currentSelected.id === targetId) {
        setCurrentView('detail');
        return;
      }

      setCurrentView('detail');
      setInitializingDetail(true);
      try {
        const response = await hupuApi.getPostWithComments(targetId);
        if (cancelled) {
          return;
        }
        if (response.success) {
          selectedPostRef.current = response.data.post;
          setSelectedPost(response.data.post);
          setPreloadedDetail({
            post: response.data.post,
            comments: response.data.comments,
            hasMoreComments: response.data.hasMoreComments,
          });
        } else {
          console.warn('Failed to load post from hash:', response.message);
          setCurrentView('list');
          setSelectedPost(null);
          selectedPostRef.current = null;
          setPreloadedDetail(null);
          clearHash();
        }
      } catch (error) {
        if (!cancelled) {
          console.error('Failed to load post from hash:', error);
          setCurrentView('list');
          setSelectedPost(null);
          selectedPostRef.current = null;
          setPreloadedDetail(null);
          clearHash();
        }
      } finally {
        if (!cancelled) {
          setInitializingDetail(false);
        }
      }
    };

    const handleHashChange = () => {
      syncFromHash();
    };

    syncFromHash();
    window.addEventListener('hashchange', handleHashChange);
    return () => {
      cancelled = true;
      window.removeEventListener('hashchange', handleHashChange);
    };
  }, [clearHash]);

  const handleSelectPostFromSearch = useCallback(
    (postId: string) => {
      setSelectedPost(null);
      selectedPostRef.current = null;
      setPreloadedDetail(null);
      setInitializingDetail(true);
      setCurrentView('detail');
      applyDetailHash(postId);
    },
    [applyDetailHash],
  );

  return (
    <div className="min-h-screen bg-gray-50">
      {(currentView === 'list' || currentView === 'search') && (
        <>
          <Header
            onSearch={handleSearch}
            searchQuery={currentView === 'search' ? searchKeyword : ''}
          />
          <main className="max-w-4xl mx-auto px-4 py-6">
            {currentView === 'list' ? (
              <PostList onPostClick={handlePostClick} />
            ) : (
              <SearchPage
                keyword={searchKeyword}
                onSelectPost={handleSelectPostFromSearch}
              />
            )}
          </main>
        </>
      )}

      {currentView === 'detail' && (
        initializingDetail || !selectedPost ? (
          <div className="flex flex-col items-center justify-center py-20 text-gray-600">
            <Loader2 className="h-8 w-8 animate-spin text-orange-500 mb-4" />
            <p>正在加载详情...</p>
          </div>
        ) : (
          <PostDetail
            post={selectedPost}
            onBack={handleBackToList}
            initialComments={preloadedDetail && preloadedDetail.post.id === selectedPost.id ? preloadedDetail.comments : undefined}
            initialHasMoreComments={preloadedDetail && preloadedDetail.post.id === selectedPost.id ? preloadedDetail.hasMoreComments : undefined}
          />
        )
      )}
    </div>
  );
}

export default App;
