export async function downloadQuotePdf(slug: string, id: string, number: string) {
  const response = await fetch(`/api/v1/quotes/${id}/pdf`, { credentials: 'same-origin', headers: { 'X-Organization-Slug': slug } });
  if (!response.ok) { const data: unknown = await response.json().catch(() => null); throw new Error(data && typeof data === 'object' && 'message' in data ? String(data.message) : 'No pudimos generar el PDF'); }
  if (!response.headers.get('content-type')?.includes('application/pdf')) throw new Error('El servidor no devolvió un PDF válido');
  const url = URL.createObjectURL(await response.blob()); const anchor = document.createElement('a'); anchor.href = url; anchor.download = `${number}.pdf`; document.body.appendChild(anchor); anchor.click(); anchor.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
