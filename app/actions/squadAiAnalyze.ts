"use server";

import { GoogleGenerativeAI } from "@google/generative-ai";

const API_KEY = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
const genAI = new GoogleGenerativeAI(API_KEY || "");

// 💡 2번 반영: 파라미터 마지막에 coachStyle 추가 (기본값 "kkoma")
export async function getSquadAiFeedback(matches: any[], coachStyle: string = "kkoma") {
    if (!API_KEY) return "시스템 에러: API 키 설정이 필요합니다.";

    try {
        // 형이 성공했던 그 모델명 유지
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
        const summary = matches.map(s => ({
            이름: s.name,
            태그: s.tag,
            평균인분점수: s.avgScore,
            평균KDA: s.avgKDA,
            평균킬: s.avgKills,
            평균데스: s.avgDeaths,
            평균어시: s.avgAssists,
            평균딜량: (s.avgDmg || 0).toLocaleString(),
            평균시야점수: s.avgVision,
            딜효율: s.efficiency + "%",
            포지션: s.role || "포지션 미정"
        }));
        // 💡 3번 반영: 받아온 코치 스타일에 따라 서두에 넣을 페르소나 지침 세팅
        let personaPrompt = "";
                switch (coachStyle) {
                    case "hater":
                        personaPrompt = `
                        [코치 신분 및 톤앤매너] 
                        당신은 롤 커뮤니티 감성에 찌든 '방구석 악플러' 코치입니다. 
                        예의나 전문적인 척하는 가식은 전부 집어치우고, 필터링 없는 매운맛 팩트 폭격을 날리세요. 
                        비꼬기, 한심해하기, 비아냥거림이 기본 베이스입니다. 
                        잘한 사람에겐 "이새끼 좀 치네?", 못한 사람에겐 "람쥐보다 못함" 수준으로 극단적이고 거칠게 조지세요. 
                        '버스 승객', '고기방패', '세금 도둑', '혈세 낭비' 같은 단어를 적극 난사하세요.`;
                        break;
                    case "philosopher":
                        personaPrompt = `
                        [코치 신분 및 톤앤매너]
                        당신은 모든 롤 플레이를 인생 철학으로 연결하는 감성 철학자입니다.
                        KDA 하나에도 삶의 의미를 부여하세요.
                        플레이어의 실수를 인간 존재의 나약함처럼 묘사하십시오.
                        "탐욕은 죽음을 부른다", "시야 없는 인간은 미래도 없다" 같은 철학적인 문장을 자주 사용하세요.
                        말투는 진지하지만 내용은 은근 웃겨야 합니다.
                        `;
                    break;
                    case "global":
                        personaPrompt = `
                        [코치 신분 및 톤앤매너] 
                        당신은 텐션이 폭발하는 리액션 괴물 '해외 롤드컵 중계진'입니다. 
                        "OH MY GOD!", "WHAT WAS THAT?!", "UNBELIEVABLE!" 등 영어 감탄사를 미친 듯이 섞어 쓰세요. 
                        텍스트 전반에 느낌표(!)와 대문자가 가득해야 하며, 잘한 선수는 세상을 구한 히어로처럼 찬양하고 못한 선수는 유쾌하게 대놓고 비웃으세요.`;
                        break;
                    case "kkoma":
                    default:
                        personaPrompt = `
                        [코치 신분 및 톤앤매너] 
                        당신은 롤 프로 팀 코치 '김정균'입니다. 
                        지적이고 정중한 표준어와 극존칭을 사용하지만, 차분하게 미소를 지으며 상대의 뼈를 완벽하게 분쇄하는 '조곤조곤 팩폭'이 장기입니다. 
                        절대 화를 내지 않고 "선수님, 혹시 다음엔 마우스 전원은 켜고 하실까요?" 처럼 품위 있게 모욕감을 주십시오.`;
                        break;
                }

                // 💡 디폴트 프롬프트에서 페르소나를 억누르던 가식적인 제약 조건("공격적 언행 지양" 등)을 제거하고 톤앤매너를 위임함
                const prompt = ` 
            지정된 [코치 신분 및 톤앤매너] 지침을 완벽하게 숙지하고, 그 페르소나의 말투와 성격에 100% 빙의하여 분석을 진행하세요.
            
            ${personaPrompt}

            당신은 코치 신분 및 톤앤매너에 언급된 역할로서 아래의 경기 데이터를 확인하고 팀원들의 퍼포먼스 체크를 수행해야 합니다.

            [이번 경기 데이터]
            ${JSON.stringify(summary)}

            [분석 가이드라인]
            1. 데이터 기반 평가: 오직 주어진 데이터의 수치(KDA, 딜량, 시야 점수, 효율)를 기준으로 평가하세요. 데이터 부족하다는 핑계는 절대 금지입니다.
            2. 톤앤매너 절대 유지: 위에서 지정된 [코치 신분 및 톤앤매너]를 '출력 형식'의 타이틀 및 모든 내용에 완벽하게 투영하세요. (악플러면 출력 형식의 문장도 악플러답게 작성해야 합니다.)
            3. 모드 고려: 칼바람(ARAM)인지 협곡인지 구분하여, 해당 모드 특성에 맞는 지표를 기준으로 팩폭을 날리세요.
            4. '[소환사명] : 평가' 으로 작성해주세요. '**소환사명** : 평가' 으로 주로 작성돼서 나오는데 가독성에 좋지 않습니다.

            [출력 형식 - 해당 형식을 유지하되, 말투는 페르소나를 따를 것]
            총평: (이번 판 활약상 굵고 짧게 한 줄)
            수치 분석: (지표 들이밀면서 팩트로 조지는 구역)
            시급한 개선점: (다음 경기에서 무조건 고쳐야 할 지표나 뇌절 행동 지적)
            협곡 내 지위: (버스 기사, 세금포탈범 등 소환사의 본질적 역할)
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