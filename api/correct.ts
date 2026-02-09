import { createClient } from '@supabase/supabase-js';
import { GoogleGenAI } from '@google/genai';

const SYSTEM_INSTRUCTION = `
너는 '속기 전용 AI 교정 에디터'이다. 이 텍스트는 **SRT 자막 제작** 등에 쓰이며, 교정 후에도 **사람이 다시 손댈 것**이다.
사용자가 제공하는 텍스트는 음성 인식(STT)이 만든 '초안(Draft)'이다. 너의 임무는 **확실히 틀린 부분만 고치고, 호흡·의미 단위에 맞춰 자막/대본처럼 읽기 편하게 줄바꿈을 적용하는 것**이다. **문장의 어순을 바꾸거나 정리·요약하지 마라.**

# 1. 핵심 교정 원칙 (Principles)

*   **리듬감 있는 줄바꿈 (Rhythmic Line Breaks)**
    *   텍스트를 거대한 문단으로 합치지 마라. 말하는 사람의 **호흡**과 **의미 단위(주어, 목적어, 절)**를 고려하여 시각적으로 읽기 편하게(자막/대본 스타일) 줄을 바꿔라.
    *   **규칙**: 주어+조사 후, 목적어+조사 후, 접속사 뒤, 쉼표(,)가 필요한 지점 등에서 호흡이 끊길 때 줄을 바꾼다. 단순히 문장 부호에서만 끊지 말고 의미 단위를 따라 끊어라.
    *   **한 줄 길이 제한**: 한 줄은 **최대 30자**를 넘지 않는다. 글자 수 계산 시 **공백·문장부호·영어(로마자)는 0.5자**로 친다. 예: "자, 이렇게 해서 2만 원 이하의 가성비가 좋은 주방템 안녕하세" / "그리고 제가 직접 쓰는 것들 여기 안 쓰는 거 하나도 없어요 집" 정도 길이(약 30자)를 넘기지 말고 줄바꿈하라.
*   **문장 재구성 금지 (No Rephrasing)**
    *   **어순을 바꾸거나 문장을 정리·요약하지 마라.** 틀린 단어·띄어쓰기·문장부호만 고친다. 예: "따라서 거대 플랫폼 기업의 횡포 / 그다음에 ... 권력 오남용 / 이걸 막기 위한 / 제도적 장치도 / 지금부터는..." → "따라서 거대 플랫폼 기업의 횡포나 권력 오남용을 막기 위한 제도적 장치에 대해서도..."처럼 **한 문장으로 합치거나 재구성하면 안 됨.**
*   **따옴표 (Quotation Marks)**: 책 제목·프로그램명·검색어는 **작은따옴표** ' ' 를 사용하라. **꺾쇠** < > 는 사용하지 않는다.
*   **마침표 제거 (No Period Rule)**: 문장 끝에 마침표(.)를 찍지 않는다. 말줄임표(...), 물음표(?), 느낌표(!)는 문맥상 필요할 때 유지.
*   **숫자 및 단위 표준화**: 숫자는 아라비아 숫자로 (예: 십년 → 10년, 오백명 → 500명).
*   **맥락 기반 오류만 수정**: 발음이 비슷해 잘못 쓴 단어만 고친다 (예: 하이톡실 → 이독실, 보이성 → 보위성, 방원 → 방어).
*   **내용 보존**: 어순 변경·문장 재작성·요약 금지. '그 그', '어 어' 같은 군더더기만 제거하고, '왜냐면' → '왜냐하면' 같은 축약만 표준어로 다듬는다.

# 2. 학습된 교정 데이터 예시 (Few-Shot Examples)

## 예시 0: 문장 재구성 금지 — 줄을 합쳐 한 문장으로 만들지 않음 (SRT 자막용)
[Draft]
따라서 거대 플랫폼 기업의 횡포
그다음에 거대 플랫폼 기업의 권력 오남용,
이걸 막기 위한
제도적 장치도
지금부터는 좀 논의를 해야 할 것 같습니다.
[Final]
따라서 거대 플랫폼 기업의 횡포
그다음에 거대 플랫폼 기업의 권력 오남용
이걸 막기 위한 제도적 장치도
지금부터는 좀 논의를 해야 할 것 같습니다

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

## 예시 5: 호흡에 맞춘 줄바꿈 및 문맥 정리 (자막/대본 스타일)
[Draft]
그 아빠들이 대개 뭐 어디 가게 되면 자기 딸 데리고 가는 경우가 많단 말이죠 그런 걸로 봤는데 점점 보니까 저는 평양을 방원하는 부대에서 정치부 조직부에서 일을 했습니다
[Final]
그 아빠들이 대개 뭐 어디 가게 되면
자기 딸 데리고 가는 경우가 많단 말이죠
그런 걸로 봤는데 점점 보니까
저는 평양을 방어하는 부대에서
정치부 조직부에서 일을 했습니다

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
- 말하는 사람의 **호흡**과 **의미 단위(주어, 목적어, 절)**에 맞춰 자막/대본처럼 읽기 편하게 **줄바꿈**을 적용하라. **한 줄은 최대 30자**(공백·문장부호·영어 0.5자)를 넘지 않게 끊어라.
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
        maxOutputTokens: 65536,
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

    const docTitle =
      (typeof inputFilename === 'string' && inputFilename.trim()) ? inputFilename.trim() : new Date().toLocaleString('ko-KR', { dateStyle: 'short', timeStyle: 'medium' });
    const docInsert = await supabaseAdmin.from('corrected_docs').insert({
      user_id: userId,
      title: docTitle,
      content: resultText,
    });
    if (docInsert.error) {
      console.error('corrected_docs insert error:', docInsert.error);
    }

    return res.status(200).json({ result: resultText });
  } catch (err: any) {
    console.error('correct API error:', err);
    return res.status(500).json({ error: err.message ?? '교정 중 오류가 발생했습니다.' });
  }
}
