function bufferToHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

function hexToBuffer(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2)
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16)
  }
  return bytes
}

const ITERATIONS = 100000
const KEY_LEN = 256 // bits (32 bytes)

/**
 * Hashes a password using PBKDF2 with SHA-256.
 */
export async function hashPassword(
  password: string,
  providedSalt?: string
): Promise<{ hash: string; salt: string }> {
  const encoder = new TextEncoder()
  const saltHex =
    providedSalt ??
    bufferToHex(crypto.getRandomValues(new Uint8Array(16)).buffer)
  const saltBytes = hexToBuffer(saltHex)

  const passwordKey = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveBits']
  )

  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: saltBytes as unknown as BufferSource,
      iterations: ITERATIONS,
      hash: 'SHA-256'
    },
    passwordKey,
    KEY_LEN
  )

  const hash = bufferToHex(derivedBits)
  return { hash, salt: saltHex }
}

/**
 * Verifies a password against a hash and salt.
 */
export async function verifyPassword(
  password: string,
  hash: string,
  salt: string
): Promise<boolean> {
  const derived = await hashPassword(password, salt)
  return derived.hash === hash
}

function base64UrlEncode(strOrBuffer: string | Uint8Array): string {
  let base64: string
  if (typeof strOrBuffer === 'string') {
    const bytes = new TextEncoder().encode(strOrBuffer)
    base64 = btoa(String.fromCharCode(...bytes))
  } else {
    base64 = btoa(String.fromCharCode(...strOrBuffer))
  }
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function base64UrlDecode(str: string): string {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/')
  while (base64.length % 4) {
    base64 += '='
  }
  const binaryStr = atob(base64)
  const bytes = new Uint8Array(binaryStr.length)
  for (let i = 0; i < binaryStr.length; i++) {
    bytes[i] = binaryStr.charCodeAt(i)
  }
  return new TextDecoder().decode(bytes)
}

async function getHmacKey(secret: string): Promise<CryptoKey> {
  const encoder = new TextEncoder()
  return crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  )
}

/**
 * Signs a payload creating a JWT token with HMAC-SHA256.
 */
export async function signJwt(
  payload: Record<string, any>,
  secret: string,
  options?: { expiresInSeconds?: number }
): Promise<string> {
  const header = { alg: 'HS256', typ: 'JWT' }
  const now = Math.floor(Date.now() / 1000)

  const fullPayload = {
    ...payload,
    iat: payload.iat ?? now,
    ...(options?.expiresInSeconds ? { exp: now + options.expiresInSeconds } : {})
  }

  const encodedHeader = base64UrlEncode(JSON.stringify(header))
  const encodedPayload = base64UrlEncode(JSON.stringify(fullPayload))
  const dataToSign = `${encodedHeader}.${encodedPayload}`

  const key = await getHmacKey(secret)
  const signatureBuffer = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(dataToSign)
  )

  const encodedSignature = base64UrlEncode(new Uint8Array(signatureBuffer))
  return `${dataToSign}.${encodedSignature}`
}

/**
 * Verifies a JWT token and decodes its payload.
 */
export async function verifyJwt<T = Record<string, any>>(
  token: string,
  secret: string
): Promise<T | null> {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) return null

    const [encodedHeader, encodedPayload, encodedSignature] = parts
    if (!encodedHeader || !encodedPayload || !encodedSignature) return null
    const dataToVerify = `${encodedHeader}.${encodedPayload}`

    const key = await getHmacKey(secret)

    let sigBase64 = encodedSignature.replace(/-/g, '+').replace(/_/g, '/')
    while (sigBase64.length % 4) {
      sigBase64 += '='
    }
    const sigBinary = atob(sigBase64)
    const sigBytes = new Uint8Array(sigBinary.length)
    for (let i = 0; i < sigBinary.length; i++) {
      sigBytes[i] = sigBinary.charCodeAt(i)
    }

    const isValid = await crypto.subtle.verify(
      'HMAC',
      key,
      sigBytes as unknown as BufferSource,
      new TextEncoder().encode(dataToVerify)
    )

    if (!isValid) return null

    const payloadJson = base64UrlDecode(encodedPayload)
    const payload = JSON.parse(payloadJson) as T & { exp?: number }

    if (payload.exp && Math.floor(Date.now() / 1000) > payload.exp) {
      return null
    }

    return payload
  } catch {
    return null
  }
}
