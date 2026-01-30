'use server';

import puppeteer from 'puppeteer';
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
    // 1. Validation
    const instagramRegex = /^https:\/\/(www\.)?instagram\.com\/(p|reel)\/[\w-]+\/?/;
    if (!url || !instagramRegex.test(url)) {
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

    let browser;
    try {
        browser = await puppeteer.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox'],
        });

        const page = await browser.newPage();

        // mimic a real user
        await page.setUserAgent(
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        );

        // Instagram is heavy, give it some time, but fail fast if blocked
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });

        // Wait a bit for dynamic content if needed, but we prioritize static parsing first
        // await new Promise(r => setTimeout(r, 2000));

        // Extract Data
        const data = await page.evaluate(() => {
            let jsonLd = null;
            // Look for the specific JSON-LD script that contains the post data
            // Usually it's strictly inside a schema.org script
            const scripts = Array.from(document.querySelectorAll('script[type="application/ld+json"]'));

            for (const script of scripts) {
                try {
                    const content = JSON.parse(script.textContent || '{}');
                    // We are looking for something that looks like a SocialMediaPosting or Clip
                    // Often Instagram wraps it in a logic graph, but commonly the top level is what we want or part of a graph
                    if (content['@type'] === 'InstagramPublicProfile') continue; // Skip profile data

                    // Check for key fields
                    if (content.uploadDate || content.datePublished || content.interactionStatistic) {
                        jsonLd = content;
                        break;
                    }
                } catch (e) {
                    continue;
                }
            }

            // Fallback: Open Graph
            const ogTitle = document.querySelector('meta[property="og:title"]')?.getAttribute('content');
            const ogDesc = document.querySelector('meta[property="og:description"]')?.getAttribute('content');
            const ogImage = document.querySelector('meta[property="og:image"]')?.getAttribute('content');
            const ogUrl = document.querySelector('meta[property="og:url"]')?.getAttribute('content');

            // Fallback: Time (if hidden in JSON but present in DOM)
            const timeEl = document.querySelector('time');
            const domTime = timeEl ? timeEl.getAttribute('datetime') : null;

            return {
                jsonLd,
                og: { ogTitle, ogDesc, ogImage, ogUrl },
                domTime
            };
        });

        if (!data.jsonLd && !data.og.ogDesc) {
            // Likely private or error page
            // Check for "Restricted profile" text or login redirect
            const pageTitle = await page.title();
            if (pageTitle.includes('Login') || pageTitle.includes('Page Not Found')) {
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
        }

        // --- Process Data ---

        // 1. Determine Post Type & URL Type
        const isReel = url.includes('/reel/');
        const postType = isReel ? 'Reel' : 'Post';

        // 2. Extract Metrics (Likes, Comments, Views)
        let likes = null;
        let comments = null;
        let views = null;
        let uploadDateRaw: string | null = null;
        let caption = null;
        let author = null;
        let imageUrl = data.og.ogImage || null;

        if (data.jsonLd) {
            uploadDateRaw = data.jsonLd.uploadDate || data.jsonLd.datePublished || null;
            caption = data.jsonLd.caption || data.jsonLd.headline || data.jsonLd.articleBody || null;
            author = data.jsonLd.author?.name || data.jsonLd.author?.alternateName || null;

            // Metrics in JSON-LD usually come in interactionStatistic array
            if (Array.isArray(data.jsonLd.interactionStatistic)) {
                for (const stat of data.jsonLd.interactionStatistic) {
                    const type = stat.interactionType;
                    const count = stat.userInteractionCount;

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

        // Fallbacks if JSON-LD missed something
        if (!uploadDateRaw && data.domTime) {
            uploadDateRaw = data.domTime;
        }

        // OG Description fallback for Likes/Comments
        // Format: "100 Likes, 5 Comments - ..."
        if ((!likes || !comments) && data.og.ogDesc) {
            const parts = data.og.ogDesc.split('-');
            if (parts.length > 0) {
                const stats = parts[0].trim(); // "X Likes, Y Comments"
                // Simple regex to extract numbers if needed, but often "1,234 Likes" is good enough string
                // Let's try to be cleaner
                const likeMatch = stats.match(/([\d,.]+[km]?) likes?/i);
                const commentMatch = stats.match(/([\d,.]+[km]?) comments?/i);

                if (!likes && likeMatch) likes = likeMatch[1];
                if (!comments && commentMatch) comments = commentMatch[1];
            }
        }

        // 3. Time Conversion (UTC -> KST)
        let uploadTime = '알 수 없음';
        if (uploadDateRaw) {
            // ISO format usually: 2024-08-16T05:00:00.000Z
            // We want: 2026-02-02 14:37 (KST)
            // dayjs handles the timezone conversion
            uploadTime = dayjs(uploadDateRaw).tz('Asia/Seoul').format('YYYY-MM-DD HH:mm') + ' (KST)';
        }

        return {
            postType,
            uploadTime,
            likes: likes || '0', // Default to 0 if found but empty, null if completely failed? Requirement says "Number", so let's try to show 0 if permissible.
            comments: comments || '0',
            views: isReel ? (views || '비공개') : null, // Views only for reels
            caption: caption || data.og.ogTitle || null,
            imageUrl,
            author,
        };

    } catch (error) {
        console.error('Puppeteer error:', error);
        return {
            postType: null,
            uploadTime: '',
            likes: null,
            comments: null,
            views: null,
            caption: null,
            imageUrl: null,
            author: null,
            error: '데이터를 가져오는데 실패했습니다. 인스타그램에서 요청을 차단했을 수 있습니다.',
        };
    } finally {
        if (browser) {
            await browser.close();
        }
    }
}
