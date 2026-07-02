'use server';

import * as cheerio from 'cheerio';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';

dayjs.extend(utc);
dayjs.extend(timezone);

export interface PostData {
    postType: 'Post' | 'Reel' | null;
    uploadTime: string; // Original upload time, formatted KST string
    modifiedTime: string | null; // Edited/modified time, formatted KST string
    isEdited: boolean;
    likes: string | null;
    comments: string | null;
    views: string | null; // For Reels
    caption: string | null;
    imageUrl: string | null;
    author: string | null;
    error?: string;
}

type DateCandidate = {
    value: dayjs.Dayjs;
    source: string;
};

const ORIGINAL_TIME_KEYS = new Set([
    'taken_at',
    'taken_at_timestamp',
    'date_taken',
    'original_timestamp',
    'created_time',
    'uploadDate',
    'datePublished',
]);

const MODIFIED_TIME_KEYS = new Set([
    'dateModified',
    'date_modified',
    'modified_time',
    'modified_at',
    'updated_time',
    'updated_at',
    'edited_at',
    'edit_time',
]);

const EDIT_FLAG_KEYS = new Set([
    'is_caption_edited',
    'caption_is_edited',
    'is_edited',
    'has_been_edited',
    'edited',
]);

function parseInstagramDate(value: unknown): dayjs.Dayjs | null {
    if (value === null || value === undefined) return null;

    if (typeof value === 'number') {
        const parsed = value > 100000000000 ? dayjs(value) : dayjs.unix(value);
        return parsed.isValid() ? parsed : null;
    }

    if (typeof value !== 'string') return null;

    const trimmed = value.trim();
    if (!trimmed) return null;

    if (/^\d+$/.test(trimmed)) {
        return parseInstagramDate(Number(trimmed));
    }

    const parsed = dayjs(trimmed);
    return parsed.isValid() ? parsed : null;
}

function formatKst(value: dayjs.Dayjs | null): string {
    if (!value) return '알 수 없음';
    return value.tz('Asia/Seoul').format('YYYY-MM-DD HH:mm') + ' (KST)';
}

function addDateCandidate(candidates: DateCandidate[], value: unknown, source: string) {
    const parsed = parseInstagramDate(value);
    if (parsed) {
        candidates.push({ value: parsed, source });
    }
}

function walkInstagramJson(
    value: unknown,
    path: string,
    originalCandidates: DateCandidate[],
    modifiedCandidates: DateCandidate[],
    editFlags: boolean[]
) {
    if (!value || typeof value !== 'object') return;

    if (Array.isArray(value)) {
        value.forEach((item, index) => {
            walkInstagramJson(item, `${path}[${index}]`, originalCandidates, modifiedCandidates, editFlags);
        });
        return;
    }

    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
        const source = path ? `${path}.${key}` : key;

        if (ORIGINAL_TIME_KEYS.has(key)) {
            addDateCandidate(originalCandidates, child, source);
        }

        if (MODIFIED_TIME_KEYS.has(key)) {
            addDateCandidate(modifiedCandidates, child, source);
        }

        if (EDIT_FLAG_KEYS.has(key) && child === true) {
            editFlags.push(true);
        }

        walkInstagramJson(child, source, originalCandidates, modifiedCandidates, editFlags);
    }
}

function extractJsonTimeCandidates(html: string, $: cheerio.CheerioAPI) {
    const originalCandidates: DateCandidate[] = [];
    const modifiedCandidates: DateCandidate[] = [];
    const editFlags: boolean[] = [];

    $('script').each((_, el) => {
        const text = $(el).html()?.trim();
        if (!text || (!text.startsWith('{') && !text.startsWith('['))) return;

        try {
            const parsed = JSON.parse(text);
            walkInstagramJson(parsed, 'script', originalCandidates, modifiedCandidates, editFlags);
        } catch {
            // Many Instagram scripts are JavaScript chunks, not standalone JSON.
        }
    });

    const rawPatterns: Array<{ key: string; kind: 'original' | 'modified' | 'flag' }> = [
        ...Array.from(ORIGINAL_TIME_KEYS).map((key) => ({ key, kind: 'original' as const })),
        ...Array.from(MODIFIED_TIME_KEYS).map((key) => ({ key, kind: 'modified' as const })),
        ...Array.from(EDIT_FLAG_KEYS).map((key) => ({ key, kind: 'flag' as const })),
    ];

    for (const { key, kind } of rawPatterns) {
        const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(`(?:\\\\?")${escapedKey}(?:\\\\?")\\s*:\\s*(?:\\\\?")?([^,"}\\\\\\]]+)`, 'g');
        let match: RegExpExecArray | null;

        while ((match = regex.exec(html)) !== null) {
            const rawValue = match[1].replace(/\\+$/, '');

            if (kind === 'flag') {
                if (rawValue === 'true') editFlags.push(true);
            } else if (kind === 'original') {
                addDateCandidate(originalCandidates, rawValue, `html.${key}`);
            } else {
                addDateCandidate(modifiedCandidates, rawValue, `html.${key}`);
            }
        }
    }

    return { originalCandidates, modifiedCandidates, editFlags };
}

function originalCandidateScore(candidate: DateCandidate): number {
    if (/taken_at(_timestamp)?$/.test(candidate.source)) return 100;
    if (/date_taken|original_timestamp/.test(candidate.source)) return 90;
    if (/uploadDate|datePublished/.test(candidate.source)) return 50;
    return 10;
}

function pickOriginalTime(candidates: DateCandidate[]): dayjs.Dayjs | null {
    if (candidates.length === 0) return null;

    return [...candidates].sort((a, b) => {
        const scoreDiff = originalCandidateScore(b) - originalCandidateScore(a);
        if (scoreDiff !== 0) return scoreDiff;
        return a.value.valueOf() - b.value.valueOf();
    })[0].value;
}

function pickModifiedTime(candidates: DateCandidate[], uploadDate: dayjs.Dayjs | null): dayjs.Dayjs | null {
    if (candidates.length === 0) return null;

    const validCandidates = uploadDate
        ? candidates.filter((candidate) => candidate.value.diff(uploadDate, 'minute') >= 1)
        : candidates;

    if (validCandidates.length === 0) return null;

    return [...validCandidates].sort((a, b) => b.value.valueOf() - a.value.valueOf())[0].value;
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
            modifiedTime: null,
            isEdited: false,
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
                modifiedTime: null,
                isEdited: false,
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
        const domTimeRaw = $('time').attr('datetime') || null;
        const jsonTimeCandidates = extractJsonTimeCandidates(html, $);
        const originalDateCandidates = [...jsonTimeCandidates.originalCandidates];
        const modifiedDateCandidates = [...jsonTimeCandidates.modifiedCandidates];

        if (domTimeRaw) {
            addDateCandidate(modifiedDateCandidates, domTimeRaw, 'dom.time.datetime');
        }

        let caption = null;
        let author = null;
        let imageUrl = ogImage || null;

        if (jsonLd) {
            addDateCandidate(originalDateCandidates, jsonLd.uploadDate || jsonLd.datePublished, 'jsonLd.published');
            addDateCandidate(modifiedDateCandidates, jsonLd.dateModified, 'jsonLd.dateModified');
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

        const uploadDate = pickOriginalTime(originalDateCandidates) || parseInstagramDate(domTimeRaw);
        const modifiedDate = pickModifiedTime(modifiedDateCandidates, uploadDate);
        const isEdited = Boolean(
            jsonTimeCandidates.editFlags.length > 0 ||
            (uploadDate && modifiedDate && modifiedDate.diff(uploadDate, 'minute') >= 1)
        );

        if (!uploadDate) {
            const isMetadataMissing = !ogTitle && !jsonLd && !domTimeRaw && originalDateCandidates.length === 0;

            return {
                postType: null,
                uploadTime: '',
                modifiedTime: null,
                isEdited: false,
                likes: null,
                comments: null,
                views: null,
                caption: null,
                imageUrl: null,
                author: null,
                error: isMetadataMissing
                    ? '인스타그램 접속 제한으로 게시물 시간 데이터를 가져오지 못했습니다. 잠시 후 다시 시도해주세요.'
                    : '인스타그램에서 게시물 시간 데이터를 제공하지 않아 확인할 수 없습니다.',
            };
        }

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
        const uploadTime = formatKst(uploadDate);
        const modifiedTime = isEdited ? formatKst(modifiedDate) : null;

        return {
            postType,
            uploadTime,
            modifiedTime,
            isEdited,
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
            modifiedTime: null,
            isEdited: false,
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
