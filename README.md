# 메이투 & 뷰티캠 코리아 협업 게시물 조회

Next.js 16 / React 19 기반의 Instagram 게시물 단건·대량 조회 및 협업 업로드 분석 도구입니다.

## 사용

- **조회**: URL을 조회한 뒤 메이투 또는 뷰티캠을 선택하면 해당 결과가 DB에 저장됩니다. 브랜드를 바꾸면 기존 게시물의 브랜드가 갱신됩니다.
- **대량 확인**: 기본 OFF. ON으로 전환하고 브랜드를 선택한 뒤 한 줄에 링크 하나씩 최대 20개를 입력합니다. 빈 줄 및 동일 게시물의 추적 파라미터/호스트/경로 변형 중복을 제거합니다.
- 각 게시물을 별도 요청으로 순차 처리하여 Vercel 요청 시간 제한과 요청 폭주를 줄입니다. 일부 조회·저장 실패는 다른 행에 영향을 주지 않으며 해당 행만 재시도할 수 있습니다. 처리 중에는 화면을 유지해 주세요.
- **분석**: DB의 전체 저장 데이터에 대해 브랜드 × 유형 필터를 조합합니다. 시간대·유형·브랜드 수와 비율은 선택한 조건을 기준으로 계산합니다. DB 오류는 0건으로 숨기지 않고 별도 안내합니다.

## 영구 DB: Vercel + Neon PostgreSQL

앱은 로컬 JSON, SQLite, 브라우저 저장소에 게시물 데이터를 저장하지 않습니다. 이미지·동영상·캡션·반응 수치도 DB 저장 대상이 아닙니다.

1. Vercel의 `postingtime_kst` 프로젝트에 Storage → Neon PostgreSQL을 연결합니다.
2. 실행 환경에 서버 전용 `DATABASE_URL`을 설정합니다. Production과 Preview의 연결 대상을 확인하세요. 검토용 Preview는 별도 Neon 브랜치를 권장합니다.
3. `.env.example`을 참고해 로컬 `.env.local`에 개발 DB 연결을 설정합니다. 비밀번호는 저장소에 커밋하지 않습니다.
4. `npm ci` 후 `npm run db:migrate`로 `db/001_posts.sql`을 실행합니다. 기존 게시물 데이터는 삭제하지 않습니다. Vercel에서 DB SQL 에디터로 같은 SQL을 실행해도 됩니다.
5. 배포를 갱신하여 새 환경변수를 적용합니다. `npm run build`는 `DATABASE_URL`이 설정되어 있으면 동일한 마이그레이션을 먼저 실행하므로 Vercel 재배포에서도 테이블이 자동 초기화됩니다. DB가 설정된 상태에서 초기화에 실패하면 빌드를 중단합니다.

`POST_RESULT_SIGNING_SECRET`은 선택적인 서버 전용 서명 키입니다. 생략하면 `DATABASE_URL`을 서명에 사용합니다. 클라이언트가 변경한 메타데이터를 저장하지 않도록 서버가 조회 결과에 서명하며 유효기간은 24시간입니다. 키 변경 후에는 다시 조회해야 합니다. 이 서명은 사용자 인증을 대신하지 않으며 현재 제품에는 별도의 로그인 기능이 없습니다.

DB 미설정 상태에서도 기존 단건 조회는 동작합니다. 저장·분석에는 연결 필요 안내가 표시되며 저장 완료로 잘못 표시하지 않습니다.

## 스키마와 중복 처리

`instagram_posts` 한 테이블에 단건·대량 결과를 함께 저장합니다.

| 컬럼                    | 형식 / 의미                                                                             |
| ----------------------- | --------------------------------------------------------------------------------------- |
| instagram_post_id       | TEXT PRIMARY KEY. URL의 대소문자를 보존한 Instagram shortcode를 게시물의 고유 ID로 사용 |
| instagram_url           | 정규화된 HTTPS URL (추적 쿼리 제거)                                                     |
| account_name            | 프로필 표시 이름. 제공되지 않으면 NULL                                                  |
| account_id              | @를 제외한 username. 숫자 사용자 ID와 다름                                              |
| uploaded_at             | TIMESTAMPTZ. UTC instant를 보존                                                         |
| post_type               | reels / post                                                                            |
| edited                  | BOOLEAN                                                                                 |
| brand                   | meitu / beautycam                                                                       |
| created_at / updated_at | TIMESTAMPTZ                                                                             |

`INSERT ... ON CONFLICT (instagram_post_id) DO UPDATE`로 동시 저장에도 중복 row가 생기지 않습니다. 마지막으로 선택한 브랜드가 해당 게시물의 브랜드가 됩니다. 새 조회에 이름이 없으면 기존 이름을 보존합니다.

## 시간 및 데이터 정확성

Instagram Unix epoch와 명시적 offset이 포함된 ISO 시각을 UTC instant로 해석합니다. timezone 없는 문자열을 서버 지역 시각으로 추측하지 않습니다. 표시는 `Asia/Seoul`, 분석 집계는 PostgreSQL `uploaded_at AT TIME ZONE 'Asia/Seoul'`을 사용합니다. 자정 경계를 포함해 KST 기준 0~23시를 집계하며 빈 시간대도 0으로 표시합니다.

페이지 내 추천 게시물·댓글의 시간이 섞이지 않도록 요청한 shortcode의 데이터와 해당 게시물의 JSON-LD를 우선 사용합니다. 확인할 수 없는 최초 업로드 시각은 저장하거나 추측하지 않습니다. Instagram이 공개 페이지의 메타데이터를 제한하면 조회가 실패할 수 있습니다. 계정 이름·username도 확인할 수 없으면 `—`로 표시합니다. 편집 여부는 공개 응답에 제공된 편집 플래그/수정 시각 기준입니다.

## 개발 및 검증

```sh
npm ci
npm run db:migrate # DATABASE_URL 설정 후 한 번 실행
npm run dev
npm test
npm run build
```

테스트는 실제 PostgreSQL 엔진(PGlite)의 **메모리 내 테스트 전용 DB**로 upsert, 제약조건, KST 자정 경계, 조합 필터를 검증합니다. 서비스의 영구 DB를 대체하거나 로컬 파일에 운영 데이터를 저장하는 용도가 아닙니다. URL 검증, 20개 제한, 중복 제거, 메타데이터 파싱 및 서명 변조·만료도 검증합니다.

참고: [Vercel Postgres](https://vercel.com/docs/postgres), [Neon 드라이버](https://neon.com/docs/serverless/serverless-driver), [PostgreSQL timezone](https://www.postgresql.org/docs/current/functions-datetime.html).
