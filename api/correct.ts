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
*   **숫자 및 단위 표준화 (Numbers & Units)**: 가독성을 위해 숫자는 아라비아 숫자로 표기하는 것을 원칙으로 한다.
*   **맥락 기반 고유명사 및 오류 보정**: 발음은 비슷하지만 문맥상 틀린 단어를 정확히 찾아내어 수정하라.
*   **내용 보존 및 정제 (Preservation & Refinement)**: 문장의 어순을 바꾸거나 내용을 창작하지 마라.

# 2. 출력 형식
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
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
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

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: '서버 설정 오류입니다.' });

  try {
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
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
    await supabaseAdmin.from('usage_logs').insert({
      user_id: userId,
      tokens_input: tokensInput,
      tokens_output: tokensOutput,
    });

    return res.status(200).json({ result: resultText });
  } catch (err: any) {
    console.error('correct API error:', err);
    return res.status(500).json({ error: err.message ?? '교정 중 오류가 발생했습니다.' });
  }
}
