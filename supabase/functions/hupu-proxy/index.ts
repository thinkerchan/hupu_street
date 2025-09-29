const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Requested-With, User-Agent",
};

interface HupuPostListItem {
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

interface HupuPostDetail {
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

interface HupuComment {
  pid: string;
  content: string;
  author_name: string;
  author_uid: string;
  author_avatar?: string;
  create_time: string;
  floor: number;
  like_count: number;
}

// 解析虎扑HTML页面的工具函数
class HupuParser {
  static parsePostList(html: string): HupuPostListItem[] {
    const posts: HupuPostListItem[] = [];
    
    try {
      // 使用正则表达式解析帖子列表
      // 这里需要根据虎扑实际的HTML结构来调整正则表达式
      const postRegex = /<li[^>]*class="[^"]*bbs-sl-web-post-layout[^"]*"[^>]*>(.*?)<\/li>/gs;
      const titleRegex = /<a[^>]*href="\/(\d+)\.html"[^>]*title="([^"]*)"[^>]*>/;
      const authorRegex = /<a[^>]*class="[^"]*author[^"]*"[^>]*>([^<]+)<\/a>/;
      const statsRegex = /<span[^>]*class="[^"]*num[^"]*"[^>]*>(\d+)<\/span>/g;
      
      let match;
      while ((match = postRegex.exec(html)) !== null) {
        const postHtml = match[1];
        const titleMatch = titleRegex.exec(postHtml);
        const authorMatch = authorRegex.exec(postHtml);
        
        if (titleMatch && authorMatch) {
          const tid = titleMatch[1];
          const title = titleMatch[2];
          const author_name = authorMatch[1];
          
          // 提取统计数据
          const stats = [];
          let statsMatch;
          while ((statsMatch = statsRegex.exec(postHtml)) !== null) {
            stats.push(parseInt(statsMatch[1]));
          }
          
          posts.push({
            tid,
            title: this.decodeHtml(title),
            author_name: this.decodeHtml(author_name),
            author_uid: `user_${tid}_${Math.random().toString(36).substr(2, 9)}`,
            create_time: new Date().toISOString(),
            reply_count: stats[0] || 0,
            view_count: stats[1] || 0,
            last_reply_time: new Date().toISOString(),
            is_top: postHtml.includes('置顶') || postHtml.includes('top'),
            is_hot: postHtml.includes('热门') || postHtml.includes('hot'),
            content_preview: this.extractPreview(postHtml),
          });
        }
      }
    } catch (error) {
      console.error('Parse post list error:', error);
    }
    
    return posts;
  }

  static parsePostDetail(html: string, tid: string): HupuPostDetail | null {
    try {
      // 解析帖子标题
      const titleMatch = /<h1[^>]*class="[^"]*post-title[^"]*"[^>]*>([^<]+)<\/h1>/.exec(html) ||
                        /<title>([^<]+)<\/title>/.exec(html);
      
      // 解析帖子内容
      const contentMatch = /<div[^>]*class="[^"]*post-content[^"]*"[^>]*>(.*?)<\/div>/s.exec(html);
      
      // 解析作者信息
      const authorMatch = /<a[^>]*class="[^"]*author[^"]*"[^>]*>([^<]+)<\/a>/.exec(html);
      
      if (titleMatch && contentMatch && authorMatch) {
        return {
          tid,
          title: this.decodeHtml(titleMatch[1]),
          content: this.cleanContent(contentMatch[1]),
          author_name: this.decodeHtml(authorMatch[1]),
          author_uid: `user_${tid}_${Math.random().toString(36).substr(2, 9)}`,
          create_time: new Date().toISOString(),
          reply_count: 0,
          view_count: 0,
          images: this.extractImages(contentMatch[1]),
        };
      }
    } catch (error) {
      console.error('Parse post detail error:', error);
    }
    
    return null;
  }

  static parseComments(html: string): HupuComment[] {
    const comments: HupuComment[] = [];
    
    try {
      // 解析评论列表
      const commentRegex = /<div[^>]*class="[^"]*comment[^"]*"[^>]*>(.*?)<\/div>/gs;
      
      let match;
      let floor = 1;
      while ((match = commentRegex.exec(html)) !== null) {
        const commentHtml = match[1];
        const authorMatch = /<a[^>]*class="[^"]*author[^"]*"[^>]*>([^<]+)<\/a>/.exec(commentHtml);
        const contentMatch = /<div[^>]*class="[^"]*content[^"]*"[^>]*>(.*?)<\/div>/s.exec(commentHtml);
        
        if (authorMatch && contentMatch) {
          comments.push({
            pid: `comment_${floor}_${Math.random().toString(36).substr(2, 9)}`,
            content: this.cleanContent(contentMatch[1]),
            author_name: this.decodeHtml(authorMatch[1]),
            author_uid: `user_${floor}_${Math.random().toString(36).substr(2, 9)}`,
            create_time: new Date().toISOString(),
            floor: floor++,
            like_count: 0,
          });
        }
      }
    } catch (error) {
      console.error('Parse comments error:', error);
    }
    
    return comments;
  }

  private static decodeHtml(html: string): string {
    const entities: { [key: string]: string } = {
      '&amp;': '&',
      '&lt;': '<',
      '&gt;': '>',
      '&quot;': '"',
      '&#39;': "'",
      '&nbsp;': ' ',
    };
    
    return html.replace(/&[#\w]+;/g, (entity) => entities[entity] || entity);
  }

  private static cleanContent(html: string): string {
    // 移除HTML标签，保留文本内容
    return html
      .replace(/<script[^>]*>.*?<\/script>/gs, '')
      .replace(/<style[^>]*>.*?<\/style>/gs, '')
      .replace(/<[^>]+>/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private static extractPreview(html: string): string {
    const preview = this.cleanContent(html);
    return preview.length > 100 ? preview.substring(0, 100) + '...' : preview;
  }

  private static extractImages(html: string): string[] {
    const images: string[] = [];
    const imgRegex = /<img[^>]*src="([^"]+)"[^>]*>/g;
    
    let match;
    while ((match = imgRegex.exec(html)) !== null) {
      const src = match[1];
      if (src.startsWith('http')) {
        images.push(src);
      }
    }
    
    return images;
  }
}

// 请求虎扑页面的函数
async function fetchHupuPage(url: string): Promise<string> {
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
    'Accept-Encoding': 'gzip, deflate, br',
    'Connection': 'keep-alive',
    'Upgrade-Insecure-Requests': '1',
  };

  const response = await fetch(url, { headers });
  
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  
  return await response.text();
}

Deno.serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const url = new URL(req.url);
    const pathname = url.pathname.replace('/functions/v1/hupu-proxy', '');
    
    console.log('Request pathname:', pathname);

    // 步行街帖子列表
    if (pathname === '/gambia/posts') {
      const page = parseInt(url.searchParams.get('page') || '1');
      const hupuUrl = `https://bbs.hupu.com/all-gambia${page > 1 ? `-${page}` : ''}`;
      
      console.log('Fetching Hupu URL:', hupuUrl);
      
      try {
        const html = await fetchHupuPage(hupuUrl);
        const posts = HupuParser.parsePostList(html);
        
        return new Response(
          JSON.stringify({
            success: true,
            data: posts,
            page,
            hasMore: posts.length >= 20,
            total: posts.length,
          }),
          {
            status: 200,
            headers: {
              'Content-Type': 'application/json',
              ...corsHeaders,
            },
          }
        );
      } catch (fetchError) {
        console.error('Fetch error:', fetchError);
        
        // 返回模拟数据作为后备
        const mockPosts: HupuPostListItem[] = [
          {
            tid: '1',
            title: '【讨论】步行街日常话题讨论',
            content_preview: '这是一个关于步行街的日常讨论话题...',
            author_name: '步行街网友',
            author_uid: 'user_1',
            create_time: new Date(Date.now() - 3600000).toISOString(),
            reply_count: 128,
            view_count: 15420,
            last_reply_time: new Date().toISOString(),
            is_top: false,
            is_hot: true,
          },
          {
            tid: '2',
            title: '分享一些生活中的小确幸',
            content_preview: '今天遇到了一些让人开心的小事情，想和大家分享一下...',
            author_name: '生活达人',
            author_uid: 'user_2',
            create_time: new Date(Date.now() - 7200000).toISOString(),
            reply_count: 89,
            view_count: 8900,
            last_reply_time: new Date().toISOString(),
            is_top: false,
            is_hot: false,
          },
        ];
        
        return new Response(
          JSON.stringify({
            success: true,
            data: mockPosts,
            page,
            hasMore: page < 3,
            total: mockPosts.length,
            message: '使用模拟数据（网络请求失败）',
          }),
          {
            status: 200,
            headers: {
              'Content-Type': 'application/json',
              ...corsHeaders,
            },
          }
        );
      }
    }
    
    // 单个帖子详情
    else if (pathname.match(/^\/posts\/\d+$/)) {
      const tid = pathname.split('/').pop()!;
      const hupuUrl = `https://bbs.hupu.com/${tid}.html`;
      
      console.log('Fetching post detail:', hupuUrl);
      
      try {
        const html = await fetchHupuPage(hupuUrl);
        const post = HupuParser.parsePostDetail(html, tid);
        
        if (post) {
          return new Response(
            JSON.stringify({
              success: true,
              data: post,
            }),
            {
              status: 200,
              headers: {
                'Content-Type': 'application/json',
                ...corsHeaders,
              },
            }
          );
        } else {
          throw new Error('Failed to parse post detail');
        }
      } catch (fetchError) {
        console.error('Fetch post detail error:', fetchError);
        
        // 返回模拟数据
        const mockPost: HupuPostDetail = {
          tid,
          title: '帖子详情标题',
          content: '这是帖子的详细内容。由于网络请求失败，这里显示的是模拟数据。',
          author_name: '步行街网友',
          author_uid: 'user_1',
          create_time: new Date().toISOString(),
          reply_count: 50,
          view_count: 1000,
        };
        
        return new Response(
          JSON.stringify({
            success: true,
            data: mockPost,
            message: '使用模拟数据（网络请求失败）',
          }),
          {
            status: 200,
            headers: {
              'Content-Type': 'application/json',
              ...corsHeaders,
            },
          }
        );
      }
    }
    
    // 帖子评论
    else if (pathname.match(/^\/posts\/\d+\/comments$/)) {
      const tid = pathname.split('/')[2];
      const page = parseInt(url.searchParams.get('page') || '1');
      const hupuUrl = `https://bbs.hupu.com/${tid}${page > 1 ? `-${page}` : ''}.html`;
      
      console.log('Fetching comments:', hupuUrl);
      
      try {
        const html = await fetchHupuPage(hupuUrl);
        const comments = HupuParser.parseComments(html);
        
        return new Response(
          JSON.stringify({
            success: true,
            data: comments,
            page,
            hasMore: comments.length >= 20,
          }),
          {
            status: 200,
            headers: {
              'Content-Type': 'application/json',
              ...corsHeaders,
            },
          }
        );
      } catch (fetchError) {
        console.error('Fetch comments error:', fetchError);
        
        // 返回模拟评论数据
        const mockComments: HupuComment[] = [
          {
            pid: 'comment_1',
            content: '这是一条模拟评论内容。',
            author_name: '评论用户1',
            author_uid: 'commenter_1',
            create_time: new Date(Date.now() - 1800000).toISOString(),
            floor: 1,
            like_count: 5,
          },
          {
            pid: 'comment_2',
            content: '这是另一条模拟评论内容。',
            author_name: '评论用户2',
            author_uid: 'commenter_2',
            create_time: new Date(Date.now() - 3600000).toISOString(),
            floor: 2,
            like_count: 3,
          },
        ];
        
        return new Response(
          JSON.stringify({
            success: true,
            data: mockComments,
            page,
            hasMore: page < 2,
            message: '使用模拟数据（网络请求失败）',
          }),
          {
            status: 200,
            headers: {
              'Content-Type': 'application/json',
              ...corsHeaders,
            },
          }
        );
      }
    }
    
    // 搜索步行街
    else if (pathname === '/gambia/search') {
      const query = url.searchParams.get('q') || '';
      const page = parseInt(url.searchParams.get('page') || '1');
      
      // 虎扑搜索URL（需要根据实际情况调整）
      const searchUrl = `https://bbs.hupu.com/search?q=${encodeURIComponent(query)}&forum=all-gambia&page=${page}`;
      
      console.log('Searching:', searchUrl);
      
      try {
        const html = await fetchHupuPage(searchUrl);
        const posts = HupuParser.parsePostList(html);
        
        return new Response(
          JSON.stringify({
            success: true,
            data: posts,
            page,
            hasMore: posts.length >= 20,
            query,
          }),
          {
            status: 200,
            headers: {
              'Content-Type': 'application/json',
              ...corsHeaders,
            },
          }
        );
      } catch (fetchError) {
        console.error('Search error:', fetchError);
        
        // 返回空搜索结果
        return new Response(
          JSON.stringify({
            success: true,
            data: [],
            page,
            hasMore: false,
            query,
            message: '搜索功能暂时不可用',
          }),
          {
            status: 200,
            headers: {
              'Content-Type': 'application/json',
              ...corsHeaders,
            },
          }
        );
      }
    }
    
    else {
      return new Response(
        JSON.stringify({
          success: false,
          message: 'Endpoint not found',
        }),
        {
          status: 404,
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders,
          },
        }
      );
    }

  } catch (error) {
    console.error('Proxy error:', error);
    
    return new Response(
      JSON.stringify({
        success: false,
        message: '代理请求失败',
        error: error.message,
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders,
        },
      }
    );
  }
});