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
    ['sign', 'verify']
  )
  // Decode the incoming signature to raw bytes
  let sigBytes: Uint8Array
  try {
    sigBytes = Uint8Array.from(atob(signature), (c) => c.charCodeAt(0))
  } catch {
    return false
  }
  // Use constant-time verify to prevent timing side-channels
  return crypto.subtle.verify('HMAC', key, sigBytes, new TextEncoder().encode(payload))
}
