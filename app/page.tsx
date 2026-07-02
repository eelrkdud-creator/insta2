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
                modifiedTime: null,
                isEdited: false,
                likes: null,
                comments: null,
                views: null,
                caption: null,
                imageUrl: null,
                author: null,
                error: '오류가 발생했습니다.'
            });
        } finally {
            setLoading(false);
        }
    };

    return (
        <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-gradient-to-br from-[#fff7fb] via-white to-[#ecfbff] px-4 pb-16 pt-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
                src="/watermark-meitu.png"
                alt=""
                aria-hidden="true"
                className="pointer-events-none absolute -left-10 top-16 w-56 max-w-[52vw] select-none opacity-[0.045] md:w-80"
            />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
                src="/watermark-beautycam.png"
                alt=""
                aria-hidden="true"
                className="pointer-events-none absolute -right-24 bottom-20 w-[34rem] max-w-[86vw] select-none opacity-[0.035] md:-right-28 md:w-[46rem]"
            />

            <div className="relative z-10 w-full max-w-lg bg-white/95 rounded-xl shadow-lg shadow-[#f41846]/10 p-6 space-y-6 transition-all duration-300 border border-[#f368dc]/15 backdrop-blur">
                <div className="text-center space-y-2">
                    <h1 className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-[#f41846] to-[#f368dc]">
                        인플루언서 게시물 업로드 시간 확인
                    </h1>
                    <p className="text-xs text-gray-500 leading-relaxed">
                        게시물 링크를 이용해 인플루언서 게시물 업로드 시간을 확인해보세요!<br />
                        * 공개 게시물만 조회할 수 있으며, 비공개/삭제/로그인 필요 게시물은 확인이 어려울 수 있습니다.<br />
                        * 인스타그램 정책이나 접속 제한에 따라 일시적으로 조회가 실패할 수 있습니다.<br />
                        * 업로드 직후에는 정보 반영이 늦을 수 있으니 일정 시간 후 다시 조회해주세요.<br />
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
                            className="w-full px-4 py-3 border border-[#f368dc]/25 rounded-xl focus:ring-2 focus:ring-[#f41846]/30 focus:border-[#f41846] outline-none transition-all shadow-sm"
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-gradient-to-r from-[#f41846] to-[#f368dc] text-white font-bold py-3 px-4 rounded-xl hover:opacity-90 active:scale-[0.98] transition-all shadow-md shadow-[#f41846]/20 disabled:opacity-50 disabled:cursor-not-allowed"
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
                                    <div className="flex items-center gap-2">
                                        <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase ${data.postType === 'Reel'
                                            ? 'bg-[#fff1f7] text-[#f41846]'
                                            : 'bg-[#fff1f7] text-[#f368dc]'
                                            }`}>
                                            {data.postType === 'Reel' ? '릴스' : '게시물'}
                                        </span>
                                        <span className={`px-3 py-1 rounded-full text-xs font-bold ${data.isEdited
                                            ? 'bg-[#fff7df] text-[#d97800]'
                                            : 'bg-[#ecfbff] text-[#069eb7]'
                                            }`}>
                                            {data.isEdited ? '수정됨' : '수정 없음'}
                                        </span>
                                    </div>
                                    {data.author && (
                                        <span className="text-gray-600 text-sm font-medium">@{data.author}</span>
                                    )}
                                </div>

                                {/* Main Card: Date & Image */}
                                <div className="bg-white border border-[#f368dc]/15 rounded-2xl overflow-hidden shadow-sm">
                                    <div className="p-4 bg-gradient-to-r from-[#fff1f7] via-[#fff9ed] to-[#ecfbff] space-y-4">
                                        <div>
                                            <p className="text-xs text-[#f41846] font-bold uppercase mb-1">최초 업로드 시간 (KST)</p>
                                            <p className="text-xl text-gray-900 font-mono font-bold">
                                                {data.uploadTime}
                                            </p>
                                        </div>

                                        {data.isEdited && (
                                            <div className="pt-4 border-t border-[#f368dc]/20">
                                                <p className="text-xs text-[#d97800] font-bold uppercase mb-1">수정 시간 (KST)</p>
                                                <p className="text-xl text-gray-900 font-mono font-bold">
                                                    {data.modifiedTime || '알 수 없음'}
                                                </p>
                                            </div>
                                        )}
                                    </div>

                                    {data.imageUrl ? (
                                        // eslint-disable-next-line @next/next/no-img-element
                                        <img src={data.imageUrl} alt="Post content" className="w-full h-auto max-h-80 object-cover" />
                                    ) : (
                                        <div className="w-full h-40 bg-[#fff7fb] flex items-center justify-center text-gray-400 text-sm border-t border-[#f368dc]/10">
                                            이미지 미리보기 없음
                                        </div>
                                    )}
                                </div>

                                {/* Metrics Grid */}
                                <div className="grid grid-cols-3 gap-3">
                                    <div className="bg-[#fff1f7] p-3 rounded-xl text-center border border-[#f368dc]/15">
                                        <p className="text-[10px] text-[#f41846] uppercase font-bold mb-1">좋아요</p>
                                        <p className="font-bold text-gray-800 text-lg">{data.likes || '-'}</p>
                                    </div>
                                    <div className="bg-[#fff9ed] p-3 rounded-xl text-center border border-[#ffbf2f]/20">
                                        <p className="text-[10px] text-[#d97800] uppercase font-bold mb-1">댓글</p>
                                        <p className="font-bold text-gray-800 text-lg">{data.comments || '-'}</p>
                                    </div>
                                    <div className={`p-3 rounded-xl text-center border ${data.postType === 'Reel'
                                        ? 'bg-[#ecfbff] border-[#20cfe8]/20'
                                        : 'bg-gray-50 border-gray-100 opacity-50'
                                        }`}>
                                        <p className={`text-[10px] uppercase font-bold mb-1 ${data.postType === 'Reel' ? 'text-[#069eb7]' : 'text-gray-400'
                                            }`}>조회수</p>
                                        <p className={`font-bold text-lg ${data.postType === 'Reel' ? 'text-gray-800' : 'text-gray-300'
                                            }`}>{data.views || '-'}</p>
                                    </div>
                                </div>

                                {data.caption && (
                                    <div className="bg-[#fff7fb] p-4 rounded-xl border border-[#f368dc]/15">
                                        <p className="text-xs text-[#f41846] font-bold uppercase mb-2">캡션 미리보기</p>
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

            <footer className="absolute bottom-4 left-0 right-0 z-10 text-center text-[10px] leading-relaxed text-gray-400">
                <p>제작 : 李佳鍈 Kaylen</p>
                <p>gayeonglee@iwink.tw</p>
            </footer>
        </main>
    );
}
