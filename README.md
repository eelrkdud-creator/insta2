# 📸 인스타그램 게시물 분석기 (Instagram Metadata Viewer)

인스타그램 게시물 URL만 있으면 로그인 없이 업로드 시간(KST), 좋아요, 댓글, 조회수(릴스) 정보를 확인할 수 있는 웹 서비스입니다.

![App Screenshot](./public/screenshot.png) 
*(스크린샷 이미지가 있다면 여기에 추가해주세요)*

## ✨ 주요 기능

- **로그인 불필요**: 인스타그램 계정 없이 공개 게시물의 정보를 조회할 수 있습니다.
- **업로드 시간 확인**: UTC 시간을 한국 표준시(KST)로 자동 변환하여 보여줍니다.
- **참여도 분석**:
  - 게시물: 좋아요, 댓글 수
  - 릴스: 좋아요, 댓글 수 + **조회수**
- **반응형 디자인**: PC와 모바일 모두에서 최적화된 UI를 제공합니다.

## 🛠️ 기술 스택

- **Framework**: Next.js 15+ (App Router)
- **Styling**: Tailwind CSS
- **Scraping**: Puppeteer (Server Actions)
- **Time Handling**: Day.js

## 🚀 실행 방법

1. **저장소 클론 및 이동**
   ```bash
   git clone https://github.com/your-username/insta-viewer.git
   cd insta-viewer
   ```

2. **의존성 설치**
   ```bash
   npm install
   ```

3. **개발 서버 실행**
   ```bash
   npm run dev
   ```

4. **접속**
   브라우저에서 `http://localhost:3000` 주소로 접속합니다.

## ⚠️ 주의사항

- 이 프로젝트는 학습 및 개인 연구 목적으로 제작되었습니다.
- 인스타그램의 정책 변경이나 과도한 요청 시 데이터 조회가 제한될 수 있습니다 (Rate Limiting).
- `Puppeteer`를 사용한 스크래핑 방식이므로, 서버 환경(Vercel 등)에 배포 시 추가 설정이 필요할 수 있습니다.

## 📝 라이선스

This project is open source and available under the [MIT License](LICENSE).
