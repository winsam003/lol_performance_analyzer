"use server";

import { GoogleGenerativeAI } from "@google/generative-ai";

const API_KEY = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
const genAI = new GoogleGenerativeAI(API_KEY || "");

export async function getAiMatchFeedback(matches: any[], playerName: string) {
    if (!API_KEY) return "시스템 에러: API 키 설정이 필요합니다.";

    try {
        // 형이 성공했던 그 모델명 유지
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

        const summary = matches.map(m => ({
            champ: m.champion,
            mode: m.queueType, // [추가] 솔랭, 자유랭, 칼바람 등 구분용
            res: m.result === "WIN" ? "승" : "패",
            kda: m.kda,
            sc: m.score,
            dmg: Math.floor(m.detail.totalDamageDealtToChampions / 1000) + "k",
            vis: m.detail.visionScore,
        }));

        const prompt = `
    당신은 데이터 기반의 롤 전략 분석가입니다. 
    소환사 '${playerName}'의 **이번 경기 기록**을 바탕으로 객관적인 퍼포먼스 체크를 수행하세요.

    [이번 경기 데이터]
    ${JSON.stringify(summary)}

    [분석 가이드라인]
    1. **단판 피드백**: 여러 판의 경향성이 아닌, 오직 이 경기의 수치(KDA, 딜량, 시야 점수)가 팀 내에서 어떤 의미였는지 분석하세요.
    2. **전문적 톤**: 공격적인 언행은 지양하되, 수치가 낮다면 '개선이 시급한 지표'로 냉정하게 지적하세요.
    3. **상황 고려**: 칼바람(ARAM)인지 협곡인지 구분하여, 모드에 맞는 기대 딜량과 시야 점수를 기준으로 평가하세요.
    4. **판단 유보 금지**: 데이터가 부족하다는 말 대신, "이 경기 기록만으로 본다면 ~한 특성이 보임" 식으로 결론을 내세요.

    [출력 형식 - 반드시 지킬 것]
    📊 **PERFORMANCE**: 이번 경기 활약도 요약 (한 줄)
    💡 **KEY ANALYSIS**: KDA와 딜량 등 핵심 수치에 대한 객관적 해석
    ⚠️ **IMPROVEMENT**: 다음 경기에서 반드시 보완해야 할 구체적인 지표
    🎯 **COMBAT ROLE**: 이번 경기 데이터로 본 소환사의 역할 (예: 메인 캐리, 서포팅 딜러, 전방 방패 등)
`;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        return response.text();

    } catch (error: any) {
        console.error("❌ 분석 에러:", error.message);
        if (error.message?.includes("429")) return "요청 초과. 잠시 후 시도.";
        return `분석 오류: ${error.message}`;
    }
}