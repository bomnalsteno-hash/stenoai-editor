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
  if (filename && typeof filename === 'string' && filename.trim()) {
    headers['X-Input-Filename'] = filename.trim();
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
