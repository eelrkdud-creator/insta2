'use client';

import { useState } from 'react';
import { scrapeInstagramPost, PostData } from './actions';

export default function Home() {
    const [url, setUrl] = useState('');
    const [loading, setLoading] = useState(false);
    const [data, setData] = useState<PostData | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setData(null);

        try {
            const result = await scrapeInstagramPost(url);
            setData(result);
        } catch (err) {
            setData({
                postType: null,
                uploadTime: '',
                likes: null,
                comments: null,
                views: null,
                caption: null,
                imageUrl: null,
                author: null,
                error: '예기치 않은 오류가 발생했습니다.'
            });
        } finally {
            setLoading(false);
        }
    };

    return (
        <main className="flex min-h-screen flex-col items-center justify-center p-4 bg-gray-50">
            <div className="w-full max-w-lg bg-white rounded-xl shadow-lg p-6 space-y-6 transition-all duration-300">
                <div className="text-center space-y-2">
                    <h1 className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-pink-600">
                        인스타그램 게시물 분석
                    </h1>
                    <p className="text-sm text-gray-500">
                        게시물 링크를 이용해 업로드 시간(KST)과 참여 통계를 확인하기
                    </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <input
                            id="url"
                            type="url"
                            required
                            placeholder="https://www.instagram.com/p/..."
                            value={url}
                            onChange={(e) => setUrl(e.target.value)}
                            className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-pink-500 focus:border-pink-500 outline-none transition-all shadow-sm"
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-gradient-to-r from-purple-600 to-pink-500 text-white font-bold py-3 px-4 rounded-xl hover:opacity-90 active:scale-[0.98] transition-all shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {loading ? (
                            <span className="flex items-center justify-center gap-2">
                                <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                분석 중...
                            </span>
                        ) : '정보 조회'}
                    </button>
                </form>

                {data && (
                    <div className="space-y-6 pt-2 animate-in fade-in slide-in-from-bottom-3 duration-500">
                        {data.error ? (
                            <div className="bg-red-50 border border-red-100 text-red-600 p-4 rounded-xl flex items-center justify-center text-center font-medium">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                </svg>
                                {data.error}
                            </div>
                        ) : (
                            <>
                                {/* Header Info: Type & Author */}
                                <div className="flex items-center justify-between px-1">
                                    <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${data.postType === 'Reel'
                                        ? 'bg-pink-100 text-pink-700'
                                        : 'bg-blue-100 text-blue-700'
                                        }`}>
                                        {data.postType === 'Reel' ? '릴스' : '게시물'}
                                    </span>
                                    {data.author && (
                                        <span className="text-gray-600 text-sm font-medium">@{data.author}</span>
                                    )}
                                </div>

                                {/* Main Card: Image & Date */}
                                <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm">
                                    {data.imageUrl ? (
                                        // eslint-disable-next-line @next/next/no-img-element
                                        <img src={data.imageUrl} alt="Post content" className="w-full h-auto max-h-80 object-cover" />
                                    ) : (
                                        <div className="w-full h-40 bg-gray-100 flex items-center justify-center text-gray-400 text-sm">
                                            이미지 미리보기 없음
                                        </div>
                                    )}

                                    <div className="p-4 bg-blue-50/50">
                                        <p className="text-xs text-blue-600 font-bold uppercase mb-1">업로드 시간 (KST)</p>
                                        <p className="text-xl text-gray-900 font-mono font-bold tracking-tight">
                                            {data.uploadTime}
                                        </p>
                                    </div>
                                </div>

                                {/* Metrics Grid */}
                                <div className="grid grid-cols-3 gap-3">
                                    <div className="bg-gray-50 p-3 rounded-xl text-center border border-gray-100">
                                        <p className="text-[10px] text-gray-500 uppercase font-bold tracking-wider mb-1">좋아요</p>
                                        <p className="font-bold text-gray-800 text-lg">{data.likes || '-'}</p>
                                    </div>
                                    <div className="bg-gray-50 p-3 rounded-xl text-center border border-gray-100">
                                        <p className="text-[10px] text-gray-500 uppercase font-bold tracking-wider mb-1">댓글</p>
                                        <p className="font-bold text-gray-800 text-lg">{data.comments || '-'}</p>
                                    </div>
                                    <div className={`p-3 rounded-xl text-center border ${data.postType === 'Reel'
                                        ? 'bg-pink-50 border-pink-100'
                                        : 'bg-gray-50 border-gray-100 opacity-50'
                                        }`}>
                                        <p className={`text-[10px] uppercase font-bold tracking-wider mb-1 ${data.postType === 'Reel' ? 'text-pink-600' : 'text-gray-400'
                                            }`}>조회수</p>
                                        <p className={`font-bold text-lg ${data.postType === 'Reel' ? 'text-gray-800' : 'text-gray-300'
                                            }`}>{data.views || '-'}</p>
                                    </div>
                                </div>

                                {data.caption && (
                                    <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                                        <p className="text-xs text-gray-500 font-bold uppercase mb-2">캡션 미리보기</p>
                                        <p className="text-sm text-gray-600 line-clamp-3 leading-relaxed">
                                            {data.caption}
                                        </p>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                )}
            </div>
        </main>
    );
}
