import React from 'react';
import { MessageCircle, Clock, Pin, TrendingUp, ExternalLink, ThumbsUp } from 'lucide-react';
import type { Post } from '../types';
import { rewriteMediaUrl } from '../utils/proxy';
import { formatRelativeTime, formatCount } from '../utils/format';

interface PostCardProps {
  post: Post;
  onClick: (post: Post) => void;
}

const PostCard: React.FC<PostCardProps> = ({ post, onClick }) => {
  const handleExternalLink = (e: React.MouseEvent) => {
    e.stopPropagation();
    window.open(post.url, '_blank');
  };

  return (
    <div
      onClick={() => onClick(post)}
      className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 cursor-pointer transition-all duration-200 hover:shadow-md hover:border-orange-200 hover:-translate-y-0.5"
    >
      {/* Header */}
      {/* <img src="https://i5.hoopchina.com.cn/hupuapp/bbs/0/0/thread_0_20250929082008_s_966139_o_w_2160_h_2880_13492.jpg" alt="" /> */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center space-x-3 flex-1 min-w-0">
          <div className="relative flex-shrink-0">
            <img
              src={rewriteMediaUrl(post.author.avatar) || post.author.avatar}
              alt={post.author.username}
              className="w-10 h-10 rounded-full object-cover ring-2 ring-gray-100"
            />
            <div className="absolute top-0 right-0 translate-x-1/2 -translate-y-1/2 bg-gradient-to-r from-orange-500 to-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full flex items-center justify-center font-semibold shadow-sm">
              {post.author.level}
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center space-x-2">
              <span className="font-medium text-gray-900 truncate">
                {post.author.username}
              </span>
              {post.isTop && (
                <Pin className="h-4 w-4 text-orange-500 flex-shrink-0" />
              )}
              {post.isHot && (
                <TrendingUp className="h-4 w-4 text-red-500 flex-shrink-0" />
              )}
            </div>
            <div className="flex items-center space-x-2 text-sm text-gray-500 mt-0.5">
              <Clock className="h-3 w-3" />
              <span>{formatRelativeTime(post.createdAt, '未知时间')}</span>
            </div>
          </div>
        </div>
        <button
          onClick={handleExternalLink}
          className="p-1.5 text-gray-400 hover:text-orange-500 hover:bg-orange-50 rounded-lg transition-colors flex-shrink-0"
          title="在虎扑中查看"
        >
          <ExternalLink className="h-4 w-4" />
        </button>
      </div>

      {/* Title */}
      <h3 className="text-lg font-semibold text-gray-900 mb-3 line-clamp-2 leading-relaxed hover:text-orange-600 transition-colors">
        {post.title}
      </h3>

      {/* Content Preview */}
      {post.content && (
        <p className="text-gray-600 mb-4 line-clamp-3 leading-relaxed text-sm">
          {post.content}
        </p>
      )}

      {/* Images */}
      {post.images && post.images.length > 0 && (
        <div className="mb-4">
          <div className="grid grid-cols-3 gap-2">
            {post.images.slice(0, 3).map((image, index) => (
              <img
                key={index}
                src={rewriteMediaUrl(image) || image}
                alt=""
                className="w-full h-20 object-cover rounded-lg"
                loading="lazy"
              />
            ))}
            {post.images.length > 3 && (
              <div className="relative">
                <img
                  src={rewriteMediaUrl(post.images[3]) || post.images[3]}
                  alt=""
                  className="w-full h-20 object-cover rounded-lg"
                  loading="lazy"
                />
                <div className="absolute inset-0 bg-black bg-opacity-50 rounded-lg flex items-center justify-center">
                  <span className="text-white font-semibold text-sm">
                    +{post.images.length - 3}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center space-x-4 text-gray-500">
          <div className="flex items-center space-x-1">
            <ThumbsUp className="h-4 w-4" />
            <span>{formatCount(post.views)}</span>
          </div>
          <div className="flex items-center space-x-1">
            <MessageCircle className="h-4 w-4" />
            <span>{post.replies}</span>
          </div>
        </div>
        <div className="text-xs text-gray-400">
          点击查看详情
        </div>
      </div>
    </div>
  );
};

export default PostCard;
