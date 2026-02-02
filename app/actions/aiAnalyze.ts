"use server";

import { GoogleGenerativeAI } from "@google/generative-ai";

const API_KEY = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
const genAI = new GoogleGenerativeAI(API_KEY || "");

export async function getAiMatchFeedback(matches: any[], playerName: string) {
    if (!API_KEY) return "시스템 에러: API 키 설정이 필요합니다.";

    try {
        // 형이 성공했던 그 모델명 유지
        const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

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
    당신은 롤 데이터 전문가입니다. 소환사 '${playerName}'의 최근 데이터를 분석하세요.

    [데이터 정보]
    ${JSON.stringify(summary)}

    [분석 필수 지침]
    1. **모드 구분**: 'mode'가 '칼바람' 혹은 'ARAM'인 경우, 시야 점수가 낮고 딜량이 높은 것을 정상으로 간주하고 협곡 데이터와 섞어서 비난하지 마세요.
    2. **한글화**: 챔피언 이름은 무조건 한글로 표기하세요.
    3. **간결성**: 모든 답변은 항목당 최대 2줄, 총 6줄 이내로 끝내세요.
    4. **드라이한 분석**: 감정적인 미사여구 없이 수치와 결과만으로 말하세요.

    [형식]
    - [강점]: 수치상 고효율 지표 (챔피언, 승률, KDA)
    - [약점]: 모드 감안 후에도 심각한 수치 (협곡 위주 분석)
    - [퇴출 리스트]: 수치가 처참하여 당장 삭제가 필요한 챔피언 1~2개
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