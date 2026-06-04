/** Verify HMAC-SHA256 signature from Sheets Apps Script webhook */
export async function verifySheetsSig(
  payload: string,
  secret: string,
  signature: string
): Promise<boolean> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload))
  const expected = btoa(String.fromCharCode(...new Uint8Array(sig)))
  return expected === signature
}
