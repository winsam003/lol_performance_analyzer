"use server";

import { GoogleGenerativeAI } from "@google/generative-ai";

const API_KEY = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
const genAI = new GoogleGenerativeAI(API_KEY || "");

export async function getSquadAiFeedback(squadStats: any[]) {
    if (!API_KEY) return "시스템 에러: API 키 설정이 필요합니다.";

    try {
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

        // AI에게 보낼 데이터 다이어트 (가독성을 위해 한글화)
        const teamSummary = squadStats.map(s => ({
            이름: s.name,
            평균점수: s.avgScore,
            KDA: s.avgKDA,
            딜효율: s.efficiency + "%",
            시야: s.avgVision,
            데스: s.avgDeaths
        }));

        const prompt = `
    당신은 핵심만 짚어주는 프로팀 전략 컨설턴트입니다. 
    스쿼드 데이터를 분석하여 짧고 강렬한 '팀 진단서'를 작성하세요.

    [팀 통계 데이터]
    ${JSON.stringify(teamSummary)}

    [분석 가이드라인]
    1. **극강의 요약**: 각 항목당 2~3줄 이내로 핵심 수치만 언급하며 아주 빠르게 읽히도록 하세요.
    2. **품격 있는 비판**: 표준어를 사용하되, 지표가 낮은 멤버에게는 뼈아픈 팩트 폭격을 날리세요.
    3. **데이터 기반**: 딜 효율(efficiency)과 평균 점수를 근거로 실질적인 기여도를 판별하세요.

    [형식]
    - [성과 분석]: 가장 높은 기여를 한 멤버와 수치 요약
    - [개선 과제]: 지표가 저조한 멤버에 대한 날카로운 지적
    - [전략적 제언]: 승리를 위해 당장 고쳐야 할 팀적 문제

    마지막에 **[스쿼드 한줄평 칭호]** 섹션을 만들고, 모든 멤버에게 아래와 같은 느낌으로 짧은 칭호를 부여하세요.
    (예: 금광동 쏘스윗 - 풀악셀 버스기사 / AHN KEEP ING - 무임승차 상습범)
`;
        const result = await model.generateContent(prompt);
        return result.response.text();

    } catch (error: any) {
        console.error("❌ 스쿼드 분석 에러:", error.message);
        return "코치님이 분석 중에 뒷목을 잡으셨습니다. (데이터가 너무 처참하거나 API 오류입니다.)";
    }
}