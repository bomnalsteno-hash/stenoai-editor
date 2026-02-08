const API_BASE = import.meta.env.VITE_APP_URL ?? '';

export const correctTranscript = async (
  draftText: string,
  accessToken: string,
  filename?: string | null
): Promise<string> => {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${accessToken}`,
  };
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
