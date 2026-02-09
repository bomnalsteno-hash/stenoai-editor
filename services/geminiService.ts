const API_BASE = import.meta.env.VITE_APP_URL ?? '';

/** 한 번에 API로 보낼 최대 글자 수. 이보다 길면 자동으로 잘라서 여러 번 요청 후 합침. */
export const CHUNK_SIZE = 3500;

export const correctTranscript = async (
  draftText: string,
  accessToken: string,
  filename?: string | null,
  options?: { skipSave?: boolean }
): Promise<string> => {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${accessToken}`,
  };
  if (options?.skipSave) headers['X-Skip-Save'] = 'true';
  // HTTP 헤더는 ISO-8859-1만 허용. 한글 등 비ASCII는 body(JSON UTF-8)로만 전달
  if (filename && typeof filename === 'string' && filename.trim()) {
    const name = filename.trim();
    const isLatin1 = [...name].every((c) => c.charCodeAt(0) <= 255);
    if (isLatin1) headers['X-Input-Filename'] = name;
  }
  const res = await fetch(`${API_BASE}/api/correct`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ text: draftText, filename: filename ?? undefined }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? '교정 요청에 실패했습니다.');
  return data.result ?? '';
};

/** maxLen 이내에서 줄바꿈·공백 등 자연스러운 끊김으로 잘라서 청크 배열 반환 */
function splitIntoChunks(text: string, maxLen: number = CHUNK_SIZE): string[] {
  const trimmed = text.trim();
  if (!trimmed) return [];
  if (trimmed.length <= maxLen) return [trimmed];

  const chunks: string[] = [];
  let start = 0;

  while (start < trimmed.length) {
    let end = Math.min(start + maxLen, trimmed.length);
    if (end >= trimmed.length) {
      chunks.push(trimmed.slice(start));
      break;
    }
    // 끊김 좋은 위치 찾기: \n\n → \n → . ? ! 다음 공백 → 공백
    const slice = trimmed.slice(start, end);
    const lastNewline2 = slice.lastIndexOf('\n\n');
    const lastNewline = slice.lastIndexOf('\n');
    const lastSentence = Math.max(
      slice.lastIndexOf('. '),
      slice.lastIndexOf('? '),
      slice.lastIndexOf('! ')
    );
    const lastSpace = slice.lastIndexOf(' ');

    let cut = slice.length;
    if (lastNewline2 >= maxLen >> 1) cut = lastNewline2 + 2;
    else if (lastNewline >= maxLen >> 1) cut = lastNewline + 1;
    else if (lastSentence >= maxLen >> 1) cut = lastSentence + 2;
    else if (lastSpace >= maxLen >> 1) cut = lastSpace + 1;

    end = start + cut;
    chunks.push(trimmed.slice(start, end).trim());
    start = end;
  }

  return chunks.filter((c) => c.length > 0);
}

/** 긴 텍스트를 청크로 나눠 순차 교정 후 합쳐서 반환. onProgress(현재, 전체) 호출. */
export const correctTranscriptChunked = async (
  draftText: string,
  accessToken: string,
  filename: string | null | undefined,
  onProgress?: (current: number, total: number) => void
): Promise<string> => {
  const chunks = splitIntoChunks(draftText, CHUNK_SIZE);
  if (chunks.length === 0) return '';
  if (chunks.length === 1) {
    return correctTranscript(draftText, accessToken, filename);
  }

  const results: string[] = [];
  for (let i = 0; i < chunks.length; i++) {
    onProgress?.(i + 1, chunks.length);
    const result = await correctTranscript(chunks[i], accessToken, i === 0 ? filename : null, {
      skipSave: true,
    });
    results.push(result);
  }

  return results.join('\n\n');
};
