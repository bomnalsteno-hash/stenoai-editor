const API_BASE = import.meta.env.VITE_APP_URL ?? '';

/** 한 청크/요청당 클라이언트에서 기다릴 최대 시간 (ms). */
const CLIENT_TIMEOUT_MS = 600_000; // 600초

/** 한 번에 API로 보낼 최대 글자 수. 이보다 길면 자동으로 잘라서 여러 번 요청 후 합침. (타임아웃 방지로 2500) */
export const CHUNK_SIZE = 2500;

export const correctTranscript = async (
  draftText: string,
  accessToken: string,
  filename?: string | null,
  options?: { skipSave?: boolean; batchId?: string; chunkIndex?: number; chunkTotal?: number; signal?: AbortSignal }
): Promise<string> => {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${accessToken}`,
  };
  if (options?.skipSave) headers['X-Skip-Save'] = 'true';
  if (options?.batchId && options?.chunkTotal != null && options?.chunkIndex != null) {
    headers['X-Batch-Id'] = options.batchId;
    headers['X-Chunk-Index'] = String(options.chunkIndex);
    headers['X-Chunk-Total'] = String(options.chunkTotal);
  }
  // HTTP 헤더는 ISO-8859-1만 허용. 한글 등 비ASCII는 body(JSON UTF-8)로만 전달
  if (filename && typeof filename === 'string' && filename.trim()) {
    const name = filename.trim();
    const isLatin1 = [...name].every((c) => c.charCodeAt(0) <= 255);
    if (isLatin1) headers['X-Input-Filename'] = name;
  }
  const OVERLOADED_MSG = 'AI 서버가 일시적으로 바쁩니다. 잠시 후 다시 시도해주세요.';
  const run = async (isRetry: boolean): Promise<string> => {
    const controller = new AbortController();
    let timedOut = false;
    const timeoutId = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, CLIENT_TIMEOUT_MS);

    // 외부에서 전달된 signal과 내부 controller를 연결
    if (options?.signal) {
      if (options.signal.aborted) {
        controller.abort();
      } else {
        const onAbort = () => controller.abort();
        options.signal.addEventListener('abort', onAbort, { once: true });
      }
    }
    try {
      const res = await fetch(`${API_BASE}/api/correct`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ text: draftText, filename: filename ?? undefined }),
        signal: controller.signal,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const errText = data.error ?? '';
        const isOverloaded =
          res.status === 503 || (typeof errText === 'string' && /overload|바쁩니다/i.test(errText));
        if (isOverloaded) throw new Error(OVERLOADED_MSG);
        if (res.status === 504 && !isRetry) {
          await new Promise((r) => setTimeout(r, 2000));
          return run(true);
        }
        throw new Error(typeof errText === 'string' ? errText : '교정 요청에 실패했습니다.');
      }
      return data.result ?? '';
    } catch (err: any) {
      if (err?.name === 'AbortError') {
        // 내부 타임아웃에 의한 중단인 경우에만 사용자용 메시지로 변환
        if (timedOut) {
          throw new Error('AI 응답이 600초 이상 지연되어 중단했습니다. 된 부분까지만 확인한 뒤 잠시 후 다시 시도해주세요.');
        }
        // 외부(사용자 취소 등)에서 abort 한 경우에는 그대로 전달해 상위에서 처리
        throw err;
      }
      throw err;
    } finally {
      clearTimeout(timeoutId);
    }
  };
  return run(false);
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
  onProgress?: (current: number, total: number) => void,
  options?: { signal?: AbortSignal }
): Promise<string> => {
  const chunks = splitIntoChunks(draftText, CHUNK_SIZE);
  if (chunks.length === 0) return '';
  if (chunks.length === 1) {
    return correctTranscript(draftText, accessToken, filename, options);
  }

  const batchId = crypto.randomUUID();
  const results: string[] = [];
  for (let i = 0; i < chunks.length; i++) {
    try {
      onProgress?.(i + 1, chunks.length);
      const result = await correctTranscript(chunks[i], accessToken, i === 0 ? filename : null, {
        skipSave: true,
        batchId,
        chunkIndex: i,
        chunkTotal: chunks.length,
        signal: options?.signal,
      });
      results.push(result);
    } catch (err: any) {
      // 일부 청크까지만 성공한 경우, 이미 완료된 구간까지의 결과를 포함해서 에러를 래핑
      if (results.length > 0) {
        const partial = results.join('\n\n');
        const remainingChunks = chunks.slice(results.length);
        const remainingText = remainingChunks.join('\n\n');
        const baseMessage = err?.message ?? '교정 중 오류가 발생했습니다.';
        const wrapped: any = new Error(
          `일부 구간까지만 교정되었습니다. (${results.length}/${chunks.length} 구간 완료) 원인: ${baseMessage}`
        );
        wrapped.partialResult = partial;
        wrapped.completedChunks = results.length;
        wrapped.totalChunks = chunks.length;
        wrapped.remainingText = remainingText;
        throw wrapped;
      }
      // 첫 번째 청크에서 바로 실패한 경우에는 기존 에러를 그대로 던짐
      throw err;
    }
  }

  return results.join('\n\n');
};
