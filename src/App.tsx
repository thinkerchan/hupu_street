import React, { useState } from 'react';
import Header from './components/Header';
import PostList from './components/PostList';
import PostDetail from './components/PostDetail';
import type { Post } from './types';

function App() {
  const [currentView, setCurrentView] = useState<'list' | 'detail'>('list');
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const handlePostClick = (post: Post) => {
    setSelectedPost(post);
    setCurrentView('detail');
  };

  const handleBackToList = () => {
    setCurrentView('list');
    setSelectedPost(null);
  };

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    setCurrentView('list');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {currentView === 'list' && (
        <>
          <Header
            onSearch={handleSearch}
            searchQuery={searchQuery}
          />
          <main className="max-w-4xl mx-auto px-4 py-6">
            <PostList
              searchQuery={searchQuery}
              onPostClick={handlePostClick}
            />
          </main>
        </>
      )}

      {currentView === 'detail' && selectedPost && (
        <PostDetail
          post={selectedPost}
          onBack={handleBackToList}
        />
      )}
    </div>
  );
}

export default App;