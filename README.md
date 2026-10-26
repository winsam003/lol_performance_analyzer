This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## 분석 요청과 캐시

- Riot 응답은 Next Data Cache에 보관합니다. 계정·소환사 300초, 랭크·경기 목록 60초, 경기 상세 24시간입니다.
- 캐시를 조회한 뒤, 캐시가 없을 때만 실제 요청 큐에 들어갑니다. 동일 URL의 진행 중인 조회는 공유합니다.
- 서버 프로세스 하나에서 최대 동시 요청 3개, 750ms당 3개, 120초당 90개로 제한합니다. 429의 Retry-After를 따르며 10초를 넘는 대기는 오류로 반환합니다. 519 등 다른 오류를 요청 제한으로 간주하지 않습니다.
- 위 제한은 보수적인 기본값이며 Riot 키의 실제 한도를 보장하지 않습니다. 서버 인스턴스가 여러 개라면 공유 저장소 기반 호출 제한이 필요합니다.
- AI 성공 결과는 동일 프롬프트 기준으로 프로세스 메모리에 1시간(최대 100개) 보관합니다. 동시 생성은 2개, 신규 생성은 분당 6개로 제한합니다. 스쿼드 리포트는 JSON 한 번 생성으로 처리하며, 미완성 응답은 캐시하지 않습니다. 재시작하면 이 캐시와 제한 상태는 초기화됩니다.
- `RIOT_API_KEY`, `GOOGLE_GENERATIVE_AI_API_KEY`를 서버 환경 변수로 설정하세요. 기존 `NEXT_PUBLIC_RIOT_API_KEY`는 호환용으로만 지원합니다.

## 검증

```bash
npm test
npm run lint
npx tsc --noEmit --incremental false
npm run build
```

테스트는 Riot·AI 네트워크를 모킹하여 요청 병합, 캐시 적중 시 무대기, 호출 간격, 429 대기, 부분 실패와 통계 집계를 검증합니다. 실제 API 쿼터나 운영 응답 속도 측정을 대신하지 않습니다.
