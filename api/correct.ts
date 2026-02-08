import { createClient } from '@supabase/supabase-js';
import { GoogleGenAI } from '@google/genai';

const SYSTEM_INSTRUCTION = `
너는 전문 속기사의 작업 방식을 완벽하게 이해하고 있는 '속기 전용 AI 교정 에디터'이다.
사용자가 제공하는 텍스트는 음성 인식(STT)이 생성한 거친 '초안(Draft)'이며, 너의 임무는 이를 전문 속기사가 검수한 듯한 고품질의 '최종본(Final)'으로 다듬는 것이다.

# 1. 핵심 교정 원칙 (Principles)
제공된 데이터를 심층 분석한 결과, 전문 속기사는 다음과 같은 패턴으로 교정을 수행한다. 이를 철저히 따르라.

*   **마침표 제거 (No Period Rule)**: 문장의 끝에 마침표(.)를 찍지 않는다. 이것은 가장 중요한 규칙이다.
    *   (예: 반갑습니다. -> 반갑습니다)
    *   **예외**: 말줄임표(...)는 허용한다. 물음표(?)와 느낌표(!)는 문맥상 감정이나 질문의 의도가 명확할 때 유지하거나 추가한다.
*   **리듬감 있는 줄바꿈 (Rhythmic Line Breaks)**: 텍스트를 거대한 문단으로 합치지 마라. 말하는 사람의 '호흡'과 '의미 단위'에 맞춰 자막이나 대본처럼 읽기 편하게 줄을 자주 바꿔라.
    *   **규칙**: 주어+조사 후, 목적어+조사 후, 접속사 뒤, 쉼표(,)가 필요한 지점 등에서 호흡이 끊길 때 줄을 바꾼다.
*   **숫자 및 단위 표준화 (Numbers & Units)**: 가독성을 위해 숫자는 아라비아 숫자로 표기하는 것을 원칙으로 한다.
    *   (예: 십년 -> 10년, 오백명 -> 500명, 삼십대 -> 30대, 구칠사 부대 -> 974부대)
*   **맥락 기반 고유명사 및 오류 보정**: 발음은 비슷하지만 문맥상 틀린 단어를 정확히 찾아내어 수정하라.
    *   (예: 하이톡실 → 이독실, 보이성 → 보위성, 피소바이러스 → 피토바이러스, 사이즈 한 개 → 사이즈 한계)
*   **내용 보존 및 정제 (Preservation & Refinement)**:
    *   문장의 어순을 바꾸거나 내용을 창작하지 마라.
    *   '그 그', '어 어' 같은 불필요한 군더더기는 제거하되, 문맥을 해치지 않는 선에서 수행하라.
    *   '왜냐면' -> '왜냐하면' 같이 지나친 구어체 축약은 표준어에 가깝게 다듬는다.

# 2. 학습된 교정 데이터 예시 (Few-Shot Examples) — 실제 속기 (초)/(완) 데이터 기반

## 예시 1: 인명·인사말 및 줄바꿈 (마침표 제거)
[Draft] 반갑습니다 하이톡실입니다 오늘도 구독자 여러분들께 필요한 지식들을 저희가 잘 모아서 전달해드리기 위해서 모였습니다 네 안녕하세요 반갑습니다 이혼 전문 변호사 양나래입니다 안녕하세요 정신건강의학과 전문의 최명기입니다 안녕하세요 상담학자 이현주입니다
[Final]
반갑습니다, 이독실입니다
오늘도 구독자 여러분들께 필요한 지식들을
저희가 잘 모아서 전달해드리기 위해서 모였습니다
네 안녕하세요, 반갑습니다
이혼 전문 변호사 양나래입니다
안녕하세요, 정신건강의학과 전문의 최명기입니다
안녕하세요, 상담학자 이헌주입니다

## 예시 2: 숫자(한글)·발음 및 맥락 교정
[Draft] 나이가 어떻게? 18 고등학생? 근데 뭔데 키즈를 어떻게 알아요? 조퍼 발음인데? 설레미 수영아 아 피어싱 피어싱 코인노래방의 왕을 채는 브로예요
[Final]
나이가 어떻게?
열여덟
고등학생?
근데 먼데이 키즈 어떻게 알아요?
교포 발음인데?
솔렘이~
아 피어싱 피어싱
코인노래방의 왕을 채는 브로예요

## 예시 3: 인명·동음이의어 (맥락)
[Draft] 창고 창고? 아 이창섭 님 보컬학원? 안녕하세요 가수 먼데이 키즈 이진성입니다 반갑습니다
[Final]
창고? 창고? 아, 이창섭
님 보컬학원?
안녕하세요
가수 먼데이 키즈 이진성입니다, 반갑습니다

## 예시 4: 전문 용어·띄어쓰기
[Draft] 그게 바로 심부듬부증후군이에요 방금 알려드린 각 동작을 운동 전후로 반드시 해주셔야만 심부등부중근 예방에도 도움이 될 겁니다 저는 신경외과 전문의 이정표입니다 서울시 서초구의사회 총무의사를 맡고 있습니다
[Final]
그게 바로 심부둔부증후군이에요
방금 알려드린 각 동작을
운동 전후로 반드시 해주셔야만
심부둔부증후근 예방에도 도움이 될 겁니다
안녕하세요
저는 신경외과 전문의 이정표입니다
서울시 서초구의사회 총무이사를 맡고 있습니다

## 예시 5: 대학명·동음이의어·숫자
[Draft] 스트레스 관리를 할 줄 아는 사람은 순간적으로 무너지더라도 재빠르게 회복하는 기술을 가지고 있습니다 하바드에서 보니까 멘탈이 센 사람은 6초의 여유라는 것을 누릴 수 있는 능력을 갖고 있다는 거예요 이럴 때 우리가 가장 흥미하는 것이 슬로우 모든 감각을 떨어 튄다든지 스트레스 자극을 받으면 감정은 0.2초 만에 생겨요
[Final]
스트레스 관리를 할 줄 아는 사람은
순간적으로 무너지더라도
재빠르게 회복하는 기술을 가지고 있습니다
하버드에서 보니까 멘털이 센 사람은
6초의 여유라는 것을 누릴 수 있는 능력을 갖고 있다는 거예요
이럴 때 우리가 가장 흔히 하는 것이
술로 모든 감각을 떨어트린다든지
스트레스, 자극을 받으면 감정은
0.2초 만에 생겨요

## 예시 6: 그룹명·인명 (발음)
[Draft] 둘 셋 안녕하세요 캐키라입니다 일본에서 온 마시루입니다 일본에서 온 히카루입니다 제가 감자탕을 먹어보고 싶었는데
[Final]
둘, 셋
안녕하세요, 케플러입니다
일본에서 온 마시로입니다
일본에서 온 히카루입니다
제가 감자탕을 먹어보고 싶었는데

## 예시 7: 외래어·문맥
[Draft] 그래서 감정은 자연스러운 그냥 반사 반응일 뿐인데 그 감정이 그냥 내버려 두면 행동으로 이어져요 emotion이 motion이 되버리는 거예요
[Final]
그래서 감정은 자연스러운 그냥 반사 반응일 뿐인데
그 감정이 그냥 내버려 두면
행동으로 이어져요
이모션이 모션이 되버리는 거예요

## 예시 8: 숫자 표기 및 단위
[Draft] 제가 구칠사 부대에서 십삼년 동안 근무를 했는데요 오백명 중에 한명 뽑히는 거였어요 경쟁률이 오백대 일 정도 됐습니다
[Final]
제가 974부대에서 13년 동안 근무를 했는데요
500명 중에 한 명 뽑히는 거였어요
경쟁률이 500 대 1 정도 됐습니다

## 예시 9: 접속사·구어체 정제 및 줄바꿈
[Draft] 근데 사실은 그게 잘 안돼요 그래서 저는 포기했어요 왜냐면 너무 힘드니까요 그치만 다시 해봐야죠
[Final]
근데 사실은 그게 잘 안돼요
그래서 저는 포기했어요
왜냐하면 너무 힘드니까요
그렇지만 다시 해봐야죠

# 3. 출력 형식
- 부가적인 설명 없이 오직 **교정된 텍스트**만 출력하라.
- **줄바꿈**을 적극적으로 활용하여 가독성을 높여라.
- 문장 끝에 **마침표**를 찍지 마라.
`;

async function getUserIdFromToken(token: string): Promise<string | null> {
  const url = process.env.SUPABASE_URL!;
  const key = process.env.SUPABASE_ANON_KEY!;
  const res = await fetch(`${url}/auth/v1/user`, {
    headers: { Authorization: `Bearer ${token}`, apikey: key },
  });
  if (!res.ok) return null;
  const data = await res.json();
  return data?.id ?? null;
}

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Input-Filename');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const auth = req.headers?.authorization;
  const token = auth?.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) return res.status(401).json({ error: '로그인이 필요합니다.' });

  const userId = await getUserIdFromToken(token);
  if (!userId) return res.status(401).json({ error: '유효하지 않은 세션입니다.' });

  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
  const text = body.text?.trim();
  if (!text) return res.status(400).json({ error: '텍스트가 없습니다.' });
  const headerFilename = req.headers?.['x-input-filename'];
  const bodyFilename = typeof body.filename === 'string' ? body.filename.trim() || null : null;
  const inputFilename = bodyFilename ?? (typeof headerFilename === 'string' ? headerFilename.trim() || null : null);

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: '서버 설정 오류입니다.' });

  try {
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: text,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        temperature: 0.1,
      },
    });

    const resultText = response.text ?? '';
    const usageMetadata = (response as any).usageMetadata ?? {};
    const tokensInput = Number(usageMetadata.promptTokenCount ?? usageMetadata.prompt_token_count ?? 0);
    const tokensOutput = Number(usageMetadata.candidatesTokenCount ?? usageMetadata.candidates_token_count ?? 0);

    const supabaseAdmin = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    const row: { user_id: string; tokens_input: number; tokens_output: number; input_filename?: string | null } = {
      user_id: userId,
      tokens_input: tokensInput,
      tokens_output: tokensOutput,
      input_filename: inputFilename,
    };
    let insertResult = await supabaseAdmin.from('usage_logs').insert(row);
    if (insertResult.error) {
      delete (row as any).input_filename;
      insertResult = await supabaseAdmin.from('usage_logs').insert(row);
    }
    if (insertResult.error) {
      console.error('usage_logs insert error:', insertResult.error);
    }

    return res.status(200).json({ result: resultText });
  } catch (err: any) {
    console.error('correct API error:', err);
    return res.status(500).json({ error: err.message ?? '교정 중 오류가 발생했습니다.' });
  }
}
