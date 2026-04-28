import React, { useState } from 'react';
import { Search, Menu, Home, User, LogOut } from 'lucide-react';
import type { UserSession } from '../types';

interface HeaderProps {
  onSearch: (query: string) => void;
  searchQuery: string;
  userSession?: UserSession | null;
  onLoginClick?: () => void;
  onLogout?: () => void;
}

const Header: React.FC<HeaderProps> = ({ onSearch, searchQuery, userSession, onLoginClick, onLogout }) => {
  const [localSearchQuery, setLocalSearchQuery] = useState(searchQuery);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  React.useEffect(() => {
    setLocalSearchQuery(searchQuery);
  }, [searchQuery]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    onSearch(localSearchQuery);
  };

  return (
    <header className="bg-white shadow-md sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-gradient-to-br from-orange-500 to-red-500 rounded-lg flex items-center justify-center">
              <Home className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">虎扑步行街</h1>
            </div>
          </div>

          {/* Search Bar - Desktop */}
          <form onSubmit={handleSearch} className="hidden md:flex flex-1 max-w-md mx-8">
            <div className="relative w-full">
              <input
                type="text"
                value={localSearchQuery}
                onChange={(e) => setLocalSearchQuery(e.target.value)}
                placeholder="搜索步行街..."
                className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-full focus:ring-2 focus:ring-orange-500 focus:border-transparent bg-gray-50 focus:bg-white transition-colors"
              />
              <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
            </div>
          </form>

          {/* User area */}
          <div className="hidden md:flex items-center">
            {userSession ? (
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5">
                  {userSession.avatar ? (
                    <img src={userSession.avatar} alt="" className="w-7 h-7 rounded-full object-cover" />
                  ) : (
                    <div className="w-7 h-7 rounded-full bg-orange-100 flex items-center justify-center">
                      <User className="h-4 w-4 text-orange-600" />
                    </div>
                  )}
                  <span className="text-sm text-gray-700 max-w-[100px] truncate">{userSession.nickname}</span>
                </div>
                <button
                  onClick={onLogout}
                  className="p-1.5 text-gray-400 hover:text-gray-600 transition-colors"
                  title="退出登录"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <button
                onClick={onLoginClick}
                className="px-4 py-1.5 bg-gradient-to-r from-orange-500 to-red-500 text-white text-sm rounded-full hover:from-orange-600 hover:to-red-600 transition-all"
              >
                登录
              </button>
            )}
          </div>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="md:hidden p-2 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <Menu className="h-5 w-5" />
          </button>
        </div>

        {/* Mobile Menu */}
        {isMenuOpen && (
          <div className="md:hidden border-t border-gray-200 bg-white">
            <div className="px-4 py-4">
              {/* Mobile Search */}
              <form onSubmit={handleSearch}>
                <div className="relative">
                  <input
                    type="text"
                    value={localSearchQuery}
                    onChange={(e) => setLocalSearchQuery(e.target.value)}
                    placeholder="搜索步行街..."
                    className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  />
                  <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                </div>
              </form>
              {/* Mobile user area */}
              <div className="mt-3">
                {userSession ? (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {userSession.avatar ? (
                        <img src={userSession.avatar} alt="" className="w-7 h-7 rounded-full object-cover" />
                      ) : (
                        <div className="w-7 h-7 rounded-full bg-orange-100 flex items-center justify-center">
                          <User className="h-4 w-4 text-orange-600" />
                        </div>
                      )}
                      <span className="text-sm text-gray-700">{userSession.nickname}</span>
                    </div>
                    <button onClick={onLogout} className="text-sm text-gray-500 hover:text-gray-700">
                      退出登录
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={onLoginClick}
                    className="w-full py-2 bg-gradient-to-r from-orange-500 to-red-500 text-white text-sm rounded-lg hover:from-orange-600 hover:to-red-600 transition-all"
                  >
                    登录
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </header>
  );
};

export default Header;
