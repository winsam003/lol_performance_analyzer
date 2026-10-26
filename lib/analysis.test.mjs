import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { createHash } from 'node:crypto';

function load(file, dependencies = {}, globals = {}) {
  const exports = {};
  const source = ts.transpileModule(readFileSync(new URL(file, import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  vm.runInNewContext(source, {
    exports,
    require: (name) => {
      if (!(name in dependencies)) throw new Error(`Unexpected dependency: ${name}`);
      return dependencies[name];
    },
    process: { env: {} },
    console: { error() {}, warn() {} },
    Date,
    setTimeout,
    AbortSignal,
    ...globals,
  });
  return exports;
}

function riotHarness(
  responder = () => ({ ok: true, status: 200, json: async () => ({ id: 'match' }) }),
) {
  let now = 1_000_000;
  let active = 0;
  let maxActive = 0;
  const calls = [];
  const waits = [];
  const cache = new Map();
  const api = load(
    './riot.ts',
    {
      'next/cache': {
        unstable_cache: (fn, key) => async () => {
          const id = key.join(':');
          if (cache.has(id)) return cache.get(id);
          const result = await fn();
          cache.set(id, result);
          return result;
        },
      },
    },
    {
      Date: class extends Date {
        static now() {
          return now;
        }
      },
      setTimeout: (callback, ms) => {
        waits.push(ms);
        now += ms;
        queueMicrotask(callback);
      },
      fetch: async (url) => {
        calls.push({ url, time: now });
        active += 1;
        maxActive = Math.max(maxActive, active);
        await new Promise((resolve) => setImmediate(resolve));
        active -= 1;
        return responder(calls.length);
      },
    },
  );
  return {
    api,
    calls,
    waits,
    get maxActive() {
      return maxActive;
    },
  };
}

test('identical in-flight matches share a request; warm cache adds no requests or waits', async () => {
  const h = riotHarness();
  await Promise.all(Array.from({ length: 10 }, () => h.api.getMatchDetail('same')));
  assert.equal(h.calls.length, 1);
  await h.api.getMatchDetail('same');
  assert.equal(h.calls.length, 1);
  assert.equal(h.waits.length, 0);
});

test('cold matches retain 3-per-750ms pacing and at most 3 concurrent requests', async () => {
  const h = riotHarness();
  await Promise.all(Array.from({ length: 20 }, (_, i) => h.api.getMatchDetail(String(i))));
  assert.equal(h.calls.length, 20);
  assert.ok(h.maxActive <= 3);
  assert.ok(h.maxActive > 1);
  for (let i = 3; i < h.calls.length; i++) assert.ok(h.calls[i].time - h.calls[i - 3].time >= 750);
  const before = h.waits.length;
  await Promise.all(Array.from({ length: 20 }, (_, i) => h.api.getMatchDetail(String(i))));
  assert.equal(h.calls.length, 20);
  assert.equal(h.waits.length, before);
});

test('429 respects Retry-After; failed responses are not cached', async () => {
  const h = riotHarness((count) =>
    count === 1
      ? { ok: false, status: 429, headers: { get: () => '2' } }
      : { ok: true, status: 200, json: async () => ({ ok: true }) },
  );
  await h.api.getMatchDetail('retry');
  assert.equal(h.calls.length, 2);
  assert.ok(h.calls[1].time - h.calls[0].time >= 2000);
  const failures = riotHarness(() => ({ ok: false, status: 519 }));
  await assert.rejects(failures.api.getMatchDetail('error'), /519/);
  await assert.rejects(failures.api.getMatchDetail('error'), /519/);
  assert.equal(failures.calls.length, 2);
});

test('long Retry-After fails promptly without retrying', async () => {
  const h = riotHarness(() => ({ ok: false, status: 429, headers: { get: () => '120' } }));
  await assert.rejects(h.api.getMatchDetail('limited'), /120/);
  await assert.rejects(h.api.getMatchDetail('another'), /120/);
  assert.equal(h.calls.length, 1);
});

test('missing Summoner ID does not trigger match API recovery', async () => {
  const h = riotHarness(() => ({ ok: true, status: 200, json: async () => ({ puuid: 'p' }) }));
  await h.api.getSummonerByPuuid('p');
  assert.equal(h.calls.length, 1);
});

const participant = (puuid, teamId) => ({
  puuid,
  teamId,
  riotIdGameName: puuid,
  riotIdTagline: 'KR1',
  championName: 'Ahri',
  teamPosition: 'MIDDLE',
  kills: 5,
  deaths: 2,
  assists: 6,
  goldEarned: 10000,
  totalDamageDealtToChampions: 15000,
  totalDamageTaken: 10000,
  visionScore: 20,
  timePlayed: 1800,
  win: teamId === 100,
});
const match = {
  metadata: { matchId: 'good' },
  info: {
    gameEndTimestamp: Date.now(),
    queueId: 420,
    participants: [participant('player', 100), participant('enemy', 200)],
  },
};

test('partial match failure keeps valid results and distinguishes unavailable ranks', async () => {
  const { analyzeSummoner } = load('../app/actions/analyze.ts', {
    '@/lib/riot': {
      getAccount: async () => ({ puuid: 'player', gameName: 'player', tagLine: 'KR1' }),
      getSummonerByPuuid: async () => ({ summonerLevel: 100, profileIconId: 1 }),
      getLeagueEntries: async () => {
        throw new Error('429');
      },
      getMatchIds: async () => ['good', 'bad'],
      getMatchDetail: async (id) => {
        if (id === 'bad') throw new Error('519');
        return match;
      },
    },
  });
  const result = await analyzeSummoner('player', 'KR1');
  assert.equal(result.matches.length, 1);
  assert.equal(result.warnings.length, 2);
  assert.equal(result.profile.tier, '조회 실패');
  assert.equal(result.matches[0].teamId, 100);
  const main = result.matches[0].allParticipants[0];
  assert.equal(main.puuid, 'player');
  assert.equal(main.score, result.matches[0].score);
  const { aggregateSquad } = load('./squad.ts');
  const stats = aggregateSquad(result.matches, ['PLAYER#KR1']);
  assert.equal(stats[0].avgScore, main.score);
  assert.equal(stats[0].primaryRole, 'MIDDLE');
  assert.equal(aggregateSquad([], ['PLAYER#KR1']).length, 0);
});

test('AI calls are coalesced and successful results reused; failures remain retryable', async () => {
  const { reuseAiReport, validateAiInput } = load('./ai.ts', { 'node:crypto': { createHash } });
  let calls = 0;
  const generate = async () => {
    calls++;
    await new Promise((resolve) => setImmediate(resolve));
    return 'report';
  };
  await Promise.all([reuseAiReport('same', generate), reuseAiReport('same', generate)]);
  await reuseAiReport('same', generate);
  assert.equal(calls, 1);
  await assert.rejects(
    reuseAiReport('bad', async () => {
      throw new Error('failed');
    }),
  );
  assert.equal(await reuseAiReport('bad', generate), 'report');
  assert.throws(() => validateAiInput({ value: Infinity }));
  assert.throws(() => validateAiInput({ name: 'x'.repeat(201) }));
});

test('long-window budget blocks excess requests even across separate batches', async () => {
  const h = riotHarness();
  for (let i = 0; i < 90; i++) await h.api.getMatchDetail(`budget-${i}`);
  await assert.rejects(h.api.getMatchDetail('budget-91'), /요청 제한/);
  assert.equal(h.calls.length, 90);
  // Existing cache entries remain available even while new requests are blocked.
  await h.api.getMatchDetail('budget-0');
  assert.equal(h.calls.length, 90);
});

test('AI concurrency cap permits shared work but rejects a third distinct generation', async () => {
  const { reuseAiReport } = load('./ai.ts', { 'node:crypto': { createHash } });
  let release;
  const ready = new Promise((resolve) => {
    release = resolve;
  });
  const generate = async () => {
    await ready;
    return 'ok';
  };
  const first = reuseAiReport('first', generate);
  const duplicate = reuseAiReport('first', generate);
  const second = reuseAiReport('second', generate);
  await assert.rejects(reuseAiReport('third', generate), /요청이 많습니다/);
  release();
  await Promise.all([first, duplicate, second]);
});

function squadMember(overrides = {}) {
  return {
    name: '테스트',
    tag: 'KR1',
    matchCount: 2,
    wins: 1,
    losses: 1,
    primaryRole: 'MIDDLE',
    roleDistribution: { MIDDLE: 2 },
    championDistribution: { Ahri: 2 },
    avgScore: 105,
    avgKDA: '5/3/8',
    avgKills: 5,
    avgDeaths: 3,
    avgAssists: 8,
    avgDamage: 25000,
    avgGold: 12000,
    avgVision: 20,
    damageEfficiency: 208,
    advancedMetrics: {
      killParticipationPercent: 60,
      damageSharePercent: 25,
      damagePerMinute: 700,
      damageTakenPerMinute: 400,
      damageMitigatedPerMinute: 200,
      turretDamagePerMinute: 30,
      csPerMinute: 7,
      ccSecondsPerMinute: 2,
      allyHealingPerMinute: 0,
      allyShieldingPerMinute: 0,
    },
    objectivesPerMatch: { dragons: 1, barons: 0, heralds: 0, steals: 0 },
    scoreBreakdown: { baseline: 100, vision: 0, role: 5, survival: 0 },
    ...overrides,
  };
}
const squadContext = {
  matchCount: 2,
  mode: 'SUMMONERS_RIFT',
  queueDistribution: [{ queueId: 420, label: '솔로 랭크', count: 2 }],
};
const sampleRoast =
  '테스트 선수님, 기록부터 확인하겠습니다. 상대 포지션 대비 역할 기여가 좋았네요. 맡은 역할을 해주신 점은 인정하겠습니다. 그런데 이 기록 하나로 다음 판까지 면제받으신 건 아닙니다. 오늘은 근거가 좋으니 자신 있게 말씀하셔도 됩니다.\n\n다만 다음 판에도 같은 기준으로 평가받으실 준비는 해주세요.';
function generatedReport(ids = ['player-0']) {
  return JSON.stringify({
    teamSummary:
      '선택한 협곡 2경기의 역할 기여를 확인했습니다. 테스트 선수님은 맡은 역할에 맞는 기여를 남기셨습니다. 기록으로 보여주신 점은 인정하겠습니다. 다른선수 선수님도 본인의 역할을 수행하셨습니다. 각자 잘한 부분을 유지하면서 다음 경기에도 기록으로 답변해 주시면 되겠습니다.',
    players: ids.map((playerId) => ({
      playerId,
      roast: sampleRoast.split('\n\n'),
    })),
    shareLine: '선수님들, 기록은 말보다 오래 남습니다.',
  });
}

test('support zero kills and low damage get role-based recognition, not a damage insult', () => {
  const { getSquadVerdict } = load('./squad-report.ts');
  const support = squadMember({
    primaryRole: 'UTILITY',
    roleDistribution: { UTILITY: 2 },
    championDistribution: { Lulu: 2 },
    avgKills: 0,
    avgDamage: 1000,
    damageEfficiency: 10,
    avgScore: 112,
    scoreBreakdown: { baseline: 105, vision: 5, role: 2, survival: 0 },
  });
  const result = getSquadVerdict(support, 'SUMMONERS_RIFT');
  assert.match(result.title, /무킬 유공자|킬 없는 지분왕|밥상 주인/);
  assert.match(result.description, /0킬과 무기여는 다른/);
  assert.equal(result.title, getSquadVerdict(support, 'SUMMONERS_RIFT').title);
});

test('low mid vision alone does not override strong role performance', () => {
  const { getSquadVerdict } = load('./squad-report.ts');
  const result = getSquadVerdict(
    squadMember({
      avgVision: 5,
      avgScore: 125,
      scoreBreakdown: { baseline: 105, role: 25, vision: -5, survival: 0 },
    }),
    'SUMMONERS_RIFT',
  );
  assert.match(result.title, /실적 있는 입|캐리 영수증|팀의 실소유주/);
});

test('mixed modes, ARAM and mixed roles never receive a support vision insult', () => {
  const { getSquadVerdict } = load('./squad-report.ts');
  const member = squadMember({
    avgScore: 85,
    primaryRole: 'UTILITY',
    roleDistribution: { UTILITY: 2 },
    scoreBreakdown: { baseline: 100, vision: -14, role: 0, survival: 0 },
  });
  for (const mode of ['ARAM', 'MIXED', 'OTHER'])
    assert.doesNotMatch(getSquadVerdict(member, mode).title, /미니맵|관제실|시야/);
  assert.doesNotMatch(
    getSquadVerdict({ ...member, roleDistribution: { UTILITY: 1, MIDDLE: 1 } }, 'SUMMONERS_RIFT')
      .title,
    /미니맵|관제실|시야/,
  );
});

test('high deaths do not make a performing engage support a culprit', () => {
  const { getSquadVerdict } = load('./squad-report.ts');
  const member = squadMember({
    primaryRole: 'UTILITY',
    roleDistribution: { UTILITY: 2 },
    championDistribution: { Leona: 2 },
    avgScore: 115,
    avgDeaths: 12,
    avgKills: 2,
    scoreBreakdown: { baseline: 115, vision: 0, role: 5, survival: -5 },
  });
  assert.match(
    getSquadVerdict(member, 'SUMMONERS_RIFT').title,
    /캐리의 보호자|조용한 지분왕|팀원 품질관리/,
  );
});

test('damage/death paradox and good performance in losses get different titles', () => {
  const { getSquadVerdict } = load('./squad-report.ts');
  const paradox = squadMember({
    avgDeaths: 9,
    scoreBreakdown: { baseline: 100, vision: 0, role: 10, survival: -6 },
  });
  assert.match(
    getSquadVerdict(paradox, 'SUMMONERS_RIFT').title,
    /양팀의 가장|쌍방 에이스|딜하고 장례식/,
  );
  const losing = squadMember({ avgScore: 115, wins: 0, losses: 2 });
  assert.match(getSquadVerdict(losing, 'SUMMONERS_RIFT').title, /패배 동석자|패배석 VIP|무죄 출석/);
});

test('structured report joins exact player IDs to trusted names and deterministic titles', () => {
  const { parseSquadReport, getSquadVerdict, formatSquadReport } = load('./squad-report.ts');
  const members = [squadMember(), squadMember({ name: '다른선수' })];
  const parsed = parseSquadReport(generatedReport(['player-1', 'player-0']), members, squadContext);
  assert.equal(parsed.players[0].name, '테스트');
  assert.equal(parsed.players[0].title, getSquadVerdict(members[0], squadContext.mode).title);
  assert.match(formatSquadReport(parsed), /이번|근거/);
  assert.throws(
    () => parseSquadReport(generatedReport(['player-0', 'player-0']), members, squadContext),
    /식별/,
  );
  assert.throws(
    () => parseSquadReport(generatedReport(['player-0']), members, squadContext),
    /누락/,
  );
  assert.throws(
    () => parseSquadReport(generatedReport(['player-0', 'player-9']), members, squadContext),
    /식별/,
  );
  const short = JSON.parse(generatedReport());
  short.players[0].roast = '못하셨습니다.';
  assert.throws(() => parseSquadReport(JSON.stringify(short), [members[0]], squadContext), /내용/);
});

test('coach prompt contains one polite persona, role safeguards and paragraph-length feedback', () => {
  const { buildSquadPrompt } = load('./squad-report.ts');
  const prompt = buildSquadPrompt([squadMember()], squadContext);
  assert.match(prompt, /끝까지 존댓말/);
  assert.match(prompt, /allowedCriticisms/);
  assert.match(prompt, /경기당 평균 시야/);
  assert.match(prompt, /빈 배열이면 변호/);
  assert.match(prompt, /짧은 2~3문장/);
  assert.match(prompt, /playerId와 roast만 반환/);
  assert.match(prompt, /7~10문장/);
  assert.match(prompt, /서포터:.*0킬/);
  assert.match(prompt, /미드:.*보조 지표/);
  assert.match(prompt, /진입형에게 회복·보호막을 요구하지/);
  assert.doesNotMatch(prompt, /COACH_PERSONAS|coachStyle/);
});

test('squad action validates JSON before caching and retries a previously malformed result', async () => {
  const ai = load('./ai.ts', { 'node:crypto': { createHash } });
  const reports = load('./squad-report.ts');
  let calls = 0;
  const sdk = {
    FinishReason: { STOP: 'STOP' },
    SchemaType: { OBJECT: 'object', ARRAY: 'array', STRING: 'string' },
    GoogleGenerativeAI: class {
      getGenerativeModel(options) {
        assert.equal(options.generationConfig.responseMimeType, 'application/json');
        return {
          generateContent: async () => {
            calls++;
            return {
              response: {
                candidates: [{ finishReason: 'STOP' }],
                text: () => (calls === 1 ? '{broken' : generatedReport()),
              },
            };
          },
        };
      }
    },
  };
  const { getSquadAiFeedback } = load(
    '../app/actions/squadAiAnalyze.ts',
    { '@/lib/ai': ai, '@/lib/squad-report': reports, '@google/generative-ai': sdk },
    { process: { env: { GOOGLE_GENERATIVE_AI_API_KEY: 'test-only' } } },
  );
  assert.ok('error' in (await getSquadAiFeedback([squadMember()], squadContext)));
  assert.ok('report' in (await getSquadAiFeedback([squadMember()], squadContext)));
  assert.ok('report' in (await getSquadAiFeedback([squadMember()], squadContext)));
  assert.equal(calls, 2);
});

test('report normalizes model HTML breaks into plain text', () => {
  const { parseSquadReport } = load('./squad-report.ts');
  const raw = JSON.parse(generatedReport());
  raw.teamSummary =
    '선택한 협곡 2경기에서 기여를 남기셨습니다.<br>선수님들, 다음 경기에도 기록으로 답해주세요.';
  raw.players[0].roast[0] += '<BR />추가 설명입니다.&lt;br&gt;기록을 확인하세요.';
  const parsed = parseSquadReport(JSON.stringify(raw), [squadMember()], squadContext);
  assert.doesNotMatch(parsed.teamSummary, /<|>|\n/);
  assert.match(parsed.players[0].roast, /추가 설명입니다.\n기록을 확인하세요/);
});
