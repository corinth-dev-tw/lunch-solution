export function b64uEncode(data: Uint8Array): string {
  return btoa(String.fromCharCode(...data))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

export function b64uDecode(str: string): Uint8Array {
  const padded = str.replace(/-/g, '+').replace(/_/g, '/')
  const pad = (4 - padded.length % 4) % 4
  return Uint8Array.from(atob(padded + '='.repeat(pad)), (c) => c.charCodeAt(0))
}
