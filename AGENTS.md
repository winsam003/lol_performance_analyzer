# AGENTS.md

# Project Overview

이 프로젝트는 Riot API를 이용한 리그 오브 레전드 AI 분석 서비스입니다.

목표는 단순 전적 조회가 아니라
AI를 이용하여 플레이를 분석하고 개선점을 제공하는 것입니다.

---

# Stack

- Next.js (App Router)
- TypeScript
- Server Actions
- TailwindCSS
- Riot API

---

# Folder Responsibilities

app/

- Page
- Server Actions
- Route

components/

- UI 컴포넌트
- 화면 구성

lib/

- Riot API
- 공통 함수
- 외부 API 호출

public/

- 정적 파일

---

# Development Rules

기존 프로젝트 구조를 최대한 유지합니다.

새로운 폴더를 만드는 것보다
기존 책임이 맞다면 기존 위치에 구현합니다.

불필요한 추상화는 하지 않습니다.

기존 네이밍 스타일을 유지합니다.

---

# Code Style

- TypeScript strict 유지
- any 사용 금지
- async / await 사용
- const 우선 사용
- 중복 코드는 공통 함수로 분리

---

# AI Rules

코드를 수정하기 전에

1. 무엇을 수정하는지
2. 왜 수정하는지
3. 어떤 파일을 수정하는지

먼저 설명합니다.

설명 없이 바로 수정하지 않습니다.

---

# Before Adding New Features

새 기능을 구현하기 전에

- 기존 기능으로 해결 가능한지 먼저 검토합니다.
- 기존 Service 또는 lib에서 재사용 가능한 코드가 있는지 확인합니다.
- 동일한 API 호출이 있는지 확인합니다.

---

# Riot API

가능하면 동일한 Riot API를 여러 번 호출하지 않습니다.

기존 함수가 있다면 재사용합니다.

Rate Limit을 고려하여 구현합니다.

---

# Performance

불필요한 API 호출을 줄입니다.

가능하면 캐싱 가능한 구조를 우선 고려합니다.

중복 계산은 피합니다.

---

# Response

항상

1. 분석
2. 설계
3. 구현

순서로 진행합니다.

필요하지 않은 리팩토링은 하지 않습니다.

요청한 범위만 수정합니다.
