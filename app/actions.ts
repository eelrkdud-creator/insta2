'use server';

import * as cheerio from 'cheerio';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';

dayjs.extend(utc);
dayjs.extend(timezone);

export interface PostData {
    postType: 'Post' | 'Reel' | null;
    uploadTime: string; // Formatted KST string
    likes: string | null;
    comments: string | null;
    views: string | null; // For Reels
    caption: string | null;
    imageUrl: string | null;
    author: string | null;
    error?: string;
}

export async function scrapeInstagramPost(url: string): Promise<PostData> {
    // 1. Validation & Cleaning
    // Remove query parameters to handle links like ?img_index=1
    const cleanUrl = url.split('?')[0];

    const instagramRegex = /^https:\/\/(www\.)?instagram\.com\/(p|reel)\/[\w-]+\/?/;
    if (!cleanUrl || !instagramRegex.test(cleanUrl)) {
        return {
            postType: null,
            uploadTime: '',
            likes: null,
            comments: null,
            views: null,
            caption: null,
            imageUrl: null,
            author: null,
            error: '유효하지 않은 인스타그램 URL입니다. https://www.instagram.com/p/... 또는 https://www.instagram.com/reel/... 형식을 사용해주세요.',
        };
    }

    try {
        // use fetch to get the HTML
        // Note: server-side fetch in Next.js/Node
        const response = await fetch(cleanUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
                'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
                'Cache-Control': 'max-age=0',
                'Sec-Fetch-Dest': 'document',
                'Sec-Fetch-Mode': 'navigate',
                'Sec-Fetch-Site': 'none',
                'Sec-Fetch-User': '?1',
                'Upgrade-Insecure-Requests': '1'
            },
            next: { revalidate: 0 } // No cache for fresh results
        });

        if (!response.ok) {
            if (response.status === 404) {
                throw new Error('게시물을 찾을 수 없습니다.');
            }
            if (response.status === 429) {
                throw new Error('요청이 너무 많습니다. 잠시 후 다시 시도해주세요.');
            }
            if (response.status === 401 || response.status === 403) {
                // Often means Instagram blocked the IP or requires login
                console.warn('Access denied/Login required:', response.status);
                // We can proceed to try reading whatever HTML came back, sometimes it has info, but usually likely an error page.
                // But usually fetch throws/returns error page.
            }
        }

        const html = await response.text();
        const $ = cheerio.load(html);

        // --- Extract Data using Cheerio ---

        // 1. Open Graph Meta Tags (Most reliable for public info)
        const ogTitle = $('meta[property="og:title"]').attr('content');
        const ogDesc = $('meta[property="og:description"]').attr('content');
        const ogImage = $('meta[property="og:image"]').attr('content');
        // const ogUrl = $('meta[property="og:url"]').attr('content');
        const pageTitle = $('title').text();

        // Check for login page redirection or error page in content
        if ((pageTitle.includes('Login') || pageTitle.includes('Page Not Found')) && !ogTitle) {
            return {
                postType: null,
                uploadTime: '',
                likes: null,
                comments: null,
                views: null,
                caption: null,
                imageUrl: null,
                author: null,
                error: '비공개 게시물이거나, 삭제된 게시물, 또는 로그인이 필요합니다.',
            };
        }

        // 2. JSON-LD parsing (Rich data)
        let jsonLd: any = null;
        $('script[type="application/ld+json"]').each((_, el) => {
            try {
                const text = $(el).html();
                if (!text) return;

                const content = JSON.parse(text);

                // Sometimes it's an array of objects
                const items = Array.isArray(content) ? content : [content];

                for (const item of items) {
                    if (item['@type'] === 'InstagramPublicProfile') continue;

                    if (item.uploadDate || item.datePublished || item.interactionStatistic) {
                        jsonLd = item;
                        return false; // break loop
                    }
                }
            } catch (e) {
                // ignore parse error
            }
        });

        // --- Process Data ---

        // 1. Determine Post Type
        const isReel = cleanUrl.includes('/reel/');
        const postType = isReel ? 'Reel' : 'Post';

        // 2. Extract Metrics
        let likes = null;
        let comments = null;
        let views = null;
        // Prioritize <time> tag from DOM as requested by user
        let uploadDateRaw: string | null = $('time').attr('datetime') || null;
        let caption = null;
        let author = null;
        let imageUrl = ogImage || null;

        if (jsonLd) {
            // Only use JSON-LD date if we didn't find specific time tag
            if (!uploadDateRaw) {
                uploadDateRaw = jsonLd.uploadDate || jsonLd.datePublished || null;
            }
            caption = jsonLd.caption || jsonLd.headline || jsonLd.articleBody || null;
            author = jsonLd.author?.name || jsonLd.author?.alternateName || null;

            if (Array.isArray(jsonLd.interactionStatistic)) {
                for (const stat of jsonLd.interactionStatistic) {
                    const type = stat.interactionType;
                    const count = stat.userInteractionCount;

                    // Support both full URL and short type
                    if (type === 'http://schema.org/LikeAction' || type === 'LikeAction') {
                        likes = count.toString();
                    } else if (type === 'http://schema.org/CommentAction' || type === 'CommentAction') {
                        comments = count.toString();
                    } else if (type === 'http://schema.org/WatchAction' || type === 'WatchAction') {
                        views = count.toString();
                    }
                }
            }
        }

        // Fallback: Time from DOM (explicitly checked above)

        // Parsing OG Description for Likes/Comments if JSON-LD failed
        // Format: "100 Likes, 5 Comments - ..."
        if ((!likes || !comments) && ogDesc) {
            const parts = ogDesc.split('-');
            if (parts.length > 0) {
                const stats = parts[0].trim();
                const likeMatch = stats.match(/([\d,.]+[km]?) likes?/i);
                const commentMatch = stats.match(/([\d,.]+[km]?) comments?/i);

                if (!likes && likeMatch) likes = likeMatch[1];
                if (!comments && commentMatch) comments = commentMatch[1];
            }
        }

        // Sometimes the title has the author: "User (@username) on Instagram:..." or "Name (@username) • Instagram photos..."
        if (!author && pageTitle) {
            // Pattern: "Name (@username) •"
            const authorMatch = pageTitle.match(/\(@([^\)]+)\)/);
            if (authorMatch) {
                author = authorMatch[1];
            }
        }


        // 3. Time Conversion (UTC -> KST)
        let uploadTime = '알 수 없음';
        if (uploadDateRaw) {
            uploadTime = dayjs(uploadDateRaw).tz('Asia/Seoul').format('YYYY-MM-DD HH:mm') + ' (KST)';
        }

        return {
            postType,
            uploadTime,
            likes: likes || '0',
            comments: comments || '0',
            views: isReel ? (views || '비공개') : null,
            caption: caption || ogTitle || null,
            imageUrl,
            author,
        };

    } catch (error: any) {
        console.error('Scraping error:', error);

        let errorMessage = '데이터를 가져오는데 실패했습니다.';
        if (error.message.includes('404')) errorMessage = '게시물을 찾을 수 없습니다.';
        if (error.message.includes('429')) errorMessage = '인스타그램 요청 제한에 걸렸습니다. 나중에 다시 시도해주세요.';

        return {
            postType: null,
            uploadTime: '',
            likes: null,
            comments: null,
            views: null,
            caption: null,
            imageUrl: null,
            author: null,
            error: errorMessage,
        };
    }
}
