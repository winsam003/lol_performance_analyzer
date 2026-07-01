"use server";

import { GoogleGenerativeAI } from "@google/generative-ai";

const API_KEY = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
const genAI = new GoogleGenerativeAI(API_KEY || "");

interface AiMatchInput {
    champion: string;
    queueId: number;
    result: string;
    kda: string;
    score: number;
    detail: {
        totalDamageDealtToChampions: number;
        visionScore: number;
    };
}

const QUEUE_LABELS: Record<number, string> = {
    420: "솔로 랭크",
    430: "일반 게임",
    440: "자유 랭크",
    450: "칼바람",
};

export async function getAiMatchFeedback(matches: AiMatchInput[], playerName: string) {
    if (!API_KEY) return "시스템 에러: API 키 설정이 필요합니다.";

    try {
        // 형이 성공했던 그 모델명 유지
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

        const summary = matches.map(m => ({
            champ: m.champion,
            mode: QUEUE_LABELS[m.queueId] || `기타 모드(${m.queueId})`,
            res: m.result === "WIN" ? "승" : "패",
            kda: m.kda,
            sc: m.score,
            dmg: Math.floor(m.detail.totalDamageDealtToChampions / 1000) + "k",
            vis: m.detail.visionScore,
        }));

        const prompt = `
    당신은 롤을 오래 한 분석가입니다.
    소환사 '${playerName}'의 **이번 경기 기록**을 바탕으로 객관적인 퍼포먼스 체크를 수행하세요.
    20~30대 친구에게 말하듯 간결하고 건조하게 쓰고, 낮은 수치는 수치에 근거해 살짝 비꼬아도 됩니다.
    유치한 영웅 서사, 과한 칭찬, 감동적인 격려, 억지 긍정 마무리는 사용하지 마세요.

    [이번 경기 데이터]
    ${JSON.stringify(summary)}

    [분석 가이드라인]
    1. **단판 피드백**: 여러 판의 경향성이 아닌, 오직 이 경기의 수치(KDA, 딜량, 시야 점수)가 팀 내에서 어떤 의미였는지 분석하세요.
    2. **직설적인 톤**: 욕설이나 인신공격 없이 플레이만 평가하고, 수치가 낮다면 짧고 냉정하게 지적하세요. 잘한 수치는 과장 없이 인정하세요.
    3. **상황 고려**: 칼바람(ARAM)인지 협곡인지 구분하여, 모드에 맞는 기대 딜량과 시야 점수를 기준으로 평가하세요.
    4. **판단 유보 금지**: 데이터가 부족하다는 말 대신, "이 경기 기록만으로 본다면 ~한 특성이 보임" 식으로 결론을 내세요.

    [출력 형식 - 반드시 지킬 것]
    Performance: 이번 경기 활약도에 대한 건조한 한 줄 평가
    Fact Check: KDA와 딜량 등 핵심 수치에 대한 객관적 해석
    한 줄 팩폭: 가장 아쉬운 수치를 짚는 짧은 한마디
    ImproveEvent: 다음 경기에서 보완할 구체적인 지표 하나
    Combat Role: 이번 경기 데이터로 본 소환사의 실제 역할
`;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        return response.text();

    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        console.error("❌ 분석 에러:", message);
        if (message.includes("429")) return "요청 초과. 잠시 후 시도.";
        return `분석 오류: ${message}`;
    }
}
