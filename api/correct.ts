import { createClient } from '@supabase/supabase-js';
import { GoogleGenAI } from '@google/genai';

const SYSTEM_INSTRUCTION = `
너는 '속기 전용 AI 교정 에디터'이다. 이 텍스트는 SRT 자막·대본 제작에 쓰이며, 교정 후에도 사람이 다시 손댄다.
입력 텍스트는 음성 인식(STT) 초안이며, 너의 임무는 **확실히 틀린 부분만 고치고, 호흡·의미 단위에 맞춰 줄바꿈하는 것**이다.
**문장을 정리·요약·재구성하거나 어순을 바꾸지 마라.**

# 1. 교정 원칙

1) 리듬감 있는 줄바꿈
- 텍스트를 큰 문단으로 합치지 말고, 말하는 사람의 **호흡**·**의미 단위(주어, 목적어, 절)** 에 맞춰 줄을 바꿔라.
- 줄바꿈 위치 예:
  - 주어+조사 뒤, 목적어+조사 뒤, 접속사 뒤
  - 쉼표(,)가 들어갈 만한 호흡 지점
- **한 줄은 최대 30자**를 넘지 않는다. (공백·문장부호·영어는 0.5자 취급)
- 단, **30자 이내라면 한 호흡/의미 단위를 한 줄로 유지**하라. 너무 잘게 쪼개지 마라.

2) 문장 재구성 금지
- **어순 변경, 문장 합치기, 요약, 문단 재구성 금지.**
- 틀린 단어, 띄어쓰기, 조사, 문장부호만 고친다.
- 예: 여러 줄로 나뉜 문장을 하나의 문장으로 다시 쓰거나, 설명을 정리해 주지 않는다.

3) 따옴표 규칙
- 책 제목, 프로그램명, 검색어, 인용·대사는 **작은따옴표 ' '만 사용**한다.
- 큰따옴표 " "와 꺾쇠 < > 는 쓰지 말라.

4) 마침표 규칙
- 문장 끝에 **마침표(.)를 쓰지 않는다.**
- 말줄임표(...), 물음표(?), 느낌표(!)는 필요할 때만 유지한다.

5) 숫자·단위
- 숫자는 **아라비아 숫자**로 적는다. (십년 → 10년, 오백명 → 500명)

6) 맥락 기반 오류만 수정
- 발음이 비슷해 잘못 쓴 단어, 명백한 오타만 고친다.
- 예: 하이톡실 → 이독실, 보이성 → 보위성, 방원 → 방어.

7) 구어체·군더더기 정리 (내용 변화 없이)
- '그 그', '어 어' 같은 군더더기는 자연스럽게 줄이고, 실제 의미에는 영향 주지 마라.
- 구어체는 표준어로만 살짝 다듬는다.
  - 예: '왜냐면' → '왜냐하면', '그치만' → '그렇지만', **'그죠?' → '그렇죠?'**
- **내용, 주장, 뉘앙스가 바뀌지 않도록 주의**하라.

# 2. 예시 (요약된 Few-Shot)

[예시 1] 문장 재구성 금지 + 줄바꿈
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

[예시 2] 인명·인사말 + 마침표 제거
[Draft] 반갑습니다 하이톡실입니다 오늘도 구독자 여러분들께 필요한 지식들을 저희가 잘 모아서 전달해드리기 위해서 모였습니다 네 안녕하세요 반갑습니다 이혼 전문 변호사 양나래입니다 안녕하세요 정신건강의학과 전문의 최명기입니다 안녕하세요 상담학자 이현주입니다
[Final]
반갑습니다, 이독실입니다
오늘도 구독자 여러분들께 필요한 지식들을
저희가 잘 모아서 전달해드리기 위해서 모였습니다
네 안녕하세요, 반갑습니다
이혼 전문 변호사 양나래입니다
안녕하세요, 정신건강의학과 전문의 최명기입니다
안녕하세요, 상담학자 이헌주입니다

[예시 3] 숫자·단위·맥락 교정
[Draft] 제가 구칠사 부대에서 십삼년 동안 근무를 했는데요 오백명 중에 한명 뽑히는 거였어요 경쟁률이 오백대 일 정도 됐습니다
[Final]
제가 974부대에서 13년 동안 근무를 했는데요
500명 중에 한 명 뽑히는 거였어요
경쟁률이 500 대 1 정도 됐습니다

[예시 4] 작은따옴표 + 30자 이내 한 줄
[Draft] 선생님 있잖아요 우리 교실에서 의논하는 방법대로 했더니만요 걔가 부끄러워하면서 도망갔어요
[Final]
'선생님 있잖아요
우리 교실에서 의논하는 방법대로 했더니만요
걔가 부끄러워하면서 도망갔어요'

[예시 5] 30자 이내는 한 줄 + 그죠? → 그렇죠?
[Draft] 많은 예술은 다 모티프를 자연에서 찾습니다 그죠?
[Final]
많은 예술은 다 모티프를 자연에서 찾습니다, 그렇죠?

# 3. 출력 형식

- 부가 설명 없이 **교정된 텍스트만** 출력하라.
- 말하는 사람의 **호흡/의미 단위**에 맞게 줄을 바꾸되, **한 줄 최대 30자**를 넘기지 마라.
- **작은따옴표 ' '만 사용**하고 큰따옴표 " " 는 쓰지 말라.
- 문장 끝에 마침표(.)를 찍지 마라.
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
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Input-Filename, X-Skip-Save, X-Batch-Id, X-Chunk-Index, X-Chunk-Total');
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

    const batchIdRaw = req.headers?.['x-batch-id'];
    const chunkIndexRaw = req.headers?.['x-chunk-index'];
    const chunkTotalRaw = req.headers?.['x-chunk-total'];
    const chunkIndex = typeof chunkIndexRaw === 'string' ? parseInt(chunkIndexRaw, 10) : NaN;
    const chunkTotal = typeof chunkTotalRaw === 'string' ? parseInt(chunkTotalRaw, 10) : NaN;
    const isChunked = Number.isFinite(chunkTotal) && chunkTotal > 1;
    const batchId = typeof batchIdRaw === 'string' && /^[0-9a-f-]{36}$/i.test(batchIdRaw.trim()) ? batchIdRaw.trim() : null;

    const supabaseAdmin = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    if (isChunked && batchId && Number.isFinite(chunkIndex)) {
      if (chunkIndex === 0) {
        const row: { user_id: string; tokens_input: number; tokens_output: number; input_filename?: string | null; batch_id?: string | null } = {
          user_id: userId,
          tokens_input: tokensInput,
          tokens_output: tokensOutput,
          input_filename: inputFilename,
          batch_id: batchId,
        };
        let insertResult = await supabaseAdmin.from('usage_logs').insert(row);
        if (insertResult.error) {
          delete (row as any).input_filename;
          delete (row as any).batch_id;
          insertResult = await supabaseAdmin.from('usage_logs').insert(row);
        }
        if (insertResult.error) {
          console.error('usage_logs insert error (batch first):', insertResult.error);
        }
      } else {
        const { data: existing } = await supabaseAdmin
          .from('usage_logs')
          .select('id, tokens_input, tokens_output')
          .eq('user_id', userId)
          .eq('batch_id', batchId)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();
        if (existing) {
          const updateResult = await supabaseAdmin
            .from('usage_logs')
            .update({
              tokens_input: (existing.tokens_input ?? 0) + tokensInput,
              tokens_output: (existing.tokens_output ?? 0) + tokensOutput,
            })
            .eq('id', existing.id);
          if (updateResult.error) {
            console.error('usage_logs update error (batch chunk):', updateResult.error);
          }
        } else {
          const row: { user_id: string; tokens_input: number; tokens_output: number; input_filename?: string | null; batch_id?: string | null } = {
            user_id: userId,
            tokens_input: tokensInput,
            tokens_output: tokensOutput,
            input_filename: inputFilename,
            batch_id: batchId,
          };
          const insertResult = await supabaseAdmin.from('usage_logs').insert(row);
          if (insertResult.error) {
            console.error('usage_logs insert fallback (batch chunk):', insertResult.error);
          }
        }
      }
    } else {
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
    }

    const skipSave = (req.headers?.['x-skip-save'] ?? '').toString().toLowerCase() === 'true';
    if (!skipSave) {
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
    }

    return res.status(200).json({ result: resultText });
  } catch (err: any) {
    console.error('correct API error:', err);
    const msg = err?.message ?? '';
    const status = err?.status ?? err?.response?.status;
    const isOverloaded =
      status === 503 ||
      /overload|503|UNAVAILABLE/i.test(msg) ||
      (typeof err?.response?.data === 'object' && err?.response?.data?.error?.status === 'UNAVAILABLE');
    if (isOverloaded) {
      return res.status(503).json({
        error: 'AI 서버가 일시적으로 바쁩니다. 잠시 후 다시 시도해주세요.',
      });
    }
    return res.status(500).json({ error: msg || '교정 중 오류가 발생했습니다.' });
  }
}
