const API_BASE = import.meta.env.VITE_APP_URL ?? '';

export const correctTranscript = async (draftText: string, accessToken: string): Promise<string> => {
  const res = await fetch(`${API_BASE}/api/correct`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ text: draftText }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? '교정 요청에 실패했습니다.');
  return data.result ?? '';
};
