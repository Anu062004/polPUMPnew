import crypto from 'crypto'

export type IvsChannelType = 'BASIC' | 'STANDARD' | 'ADVANCED_SD' | 'ADVANCED_HD'

interface AwsCredentials {
  accessKeyId: string
  secretAccessKey: string
  sessionToken?: string
  region: string
}

interface IvsRequestOptions {
  operation: string
  body?: Record<string, any>
}

interface IvsApiResponse {
  ok: boolean
  status: number
  data: any
}

export interface IvsChannelProvisioned {
  channelArn: string
  streamKeyArn: string
  streamKey: string
  ingestEndpoint: string
  playbackUrl: string
  channelType: IvsChannelType
}

export interface IvsLiveStream {
  playbackUrl: string | null
  health?: string | null
  state?: string | null
}

const IVS_SERVICE = 'ivs'

function resolveChannelType(raw?: string | null): IvsChannelType {
  const normalized = String(raw || '').toUpperCase()
  if (
    normalized === 'BASIC' ||
    normalized === 'STANDARD' ||
    normalized === 'ADVANCED_SD' ||
    normalized === 'ADVANCED_HD'
  ) {
    return normalized as IvsChannelType
  }
  return 'BASIC'
}

function getAwsCredentials(): AwsCredentials {
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID || ''
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY || ''
  const sessionToken = process.env.AWS_SESSION_TOKEN || undefined
  const region = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || ''

  if (!accessKeyId || !secretAccessKey || !region) {
    throw new Error(
      'AWS IVS is not configured. Set AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, and AWS_REGION.'
    )
  }

  return { accessKeyId, secretAccessKey, sessionToken, region }
}

export function isIvsConfigured(): boolean {
  return !!(
    process.env.AWS_ACCESS_KEY_ID &&
    process.env.AWS_SECRET_ACCESS_KEY &&
    (process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION)
  )
}

export function getConfiguredIvsChannelType(): IvsChannelType {
  return resolveChannelType(process.env.AWS_IVS_CHANNEL_TYPE)
}

function sha256Hex(value: string): string {
  return crypto.createHash('sha256').update(value, 'utf8').digest('hex')
}

function hmac(key: Buffer | string, value: string): Buffer {
  return crypto.createHmac('sha256', key).update(value, 'utf8').digest()
}

function buildSigningKey(secretAccessKey: string, dateStamp: string, region: string): Buffer {
  const kDate = hmac(`AWS4${secretAccessKey}`, dateStamp)
  const kRegion = hmac(kDate, region)
  const kService = hmac(kRegion, IVS_SERVICE)
  return hmac(kService, 'aws4_request')
}

function toAmzDate(date: Date): { amzDate: string; dateStamp: string } {
  const yyyy = date.getUTCFullYear()
  const mm = String(date.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(date.getUTCDate()).padStart(2, '0')
  const hh = String(date.getUTCHours()).padStart(2, '0')
  const mi = String(date.getUTCMinutes()).padStart(2, '0')
  const ss = String(date.getUTCSeconds()).padStart(2, '0')
  return {
    amzDate: `${yyyy}${mm}${dd}T${hh}${mi}${ss}Z`,
    dateStamp: `${yyyy}${mm}${dd}`,
  }
}

function normalizePayload(body?: Record<string, any>): string {
  if (!body) return '{}'
  return JSON.stringify(body)
}

function buildAuthHeaders(
  host: string,
  path: string,
  payload: string,
  credentials: AwsCredentials,
  extraHeaders?: Record<string, string>
) {
  const now = new Date()
  const { amzDate, dateStamp } = toAmzDate(now)
  const payloadHash = sha256Hex(payload)
  const canonicalUri = path
  const canonicalQueryString = ''

  const headers: Record<string, string> = {
    'content-type': 'application/json',
    host,
    'x-amz-content-sha256': payloadHash,
    'x-amz-date': amzDate,
  }

  if (credentials.sessionToken) {
    headers['x-amz-security-token'] = credentials.sessionToken
  }

  if (extraHeaders) {
    for (const [key, value] of Object.entries(extraHeaders)) {
      headers[key.toLowerCase()] = value
    }
  }

  const sortedHeaderKeys = Object.keys(headers).sort()
  const canonicalHeaders = sortedHeaderKeys
    .map((key) => `${key}:${String(headers[key]).trim()}\n`)
    .join('')
  const signedHeaders = sortedHeaderKeys.join(';')

  const canonicalRequest = [
    'POST',
    canonicalUri,
    canonicalQueryString,
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join('\n')

  const credentialScope = `${dateStamp}/${credentials.region}/${IVS_SERVICE}/aws4_request`
  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    credentialScope,
    sha256Hex(canonicalRequest),
  ].join('\n')

  const signingKey = buildSigningKey(credentials.secretAccessKey, dateStamp, credentials.region)
  const signature = crypto.createHmac('sha256', signingKey).update(stringToSign, 'utf8').digest('hex')

  const authorization = `AWS4-HMAC-SHA256 Credential=${credentials.accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`

  return {
    headers: {
      ...headers,
      Authorization: authorization,
    },
  }
}

function normalizeErrorMessage(data: any, status: number): string {
  if (!data) return `IVS request failed with status ${status}`
  if (typeof data.message === 'string' && data.message) return data.message
  if (typeof data.error === 'string' && data.error) return data.error
  if (typeof data.__type === 'string' && data.__type) return data.__type
  return `IVS request failed with status ${status}`
}

async function postIvs(
  credentials: AwsCredentials,
  path: string,
  body: Record<string, any> | undefined,
  extraHeaders?: Record<string, string>
): Promise<IvsApiResponse> {
  const host = `ivs.${credentials.region}.amazonaws.com`
  const payload = normalizePayload(body)
  const auth = buildAuthHeaders(host, path, payload, credentials, extraHeaders)
  const endpoint = `https://${host}${path}`

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: auth.headers,
    body: payload,
    cache: 'no-store',
  })

  let data: any = null
  try {
    data = await response.json()
  } catch {
    data = null
  }

  return {
    ok: response.ok,
    status: response.status,
    data,
  }
}

async function callIvsApi(options: IvsRequestOptions): Promise<any> {
  const credentials = getAwsCredentials()
  const path = `/${options.operation}`

  // First attempt: REST-style operation endpoint (most IVS deployments).
  const first = await postIvs(credentials, path, options.body)
  if (first.ok) return first.data

  // Fallback attempt: JSON-RPC style target header.
  const second = await postIvs(credentials, '/', options.body, {
    'x-amz-target': `TrentService.${options.operation}`,
  })
  if (second.ok) return second.data

  const message = normalizeErrorMessage(second.data || first.data, second.status || first.status)
  const error = new Error(message) as Error & { status?: number; code?: string }
  error.status = second.status || first.status
  error.code = second.data?.__type || first.data?.__type
  throw error
}

export async function createIvsChannel(input: {
  tokenAddress: string
  creatorAddress: string
  channelType?: string | null
}): Promise<IvsChannelProvisioned> {
  const channelType = resolveChannelType(input.channelType || getConfiguredIvsChannelType())
  const now = Date.now()
  const shortToken = input.tokenAddress.toLowerCase().replace(/[^a-z0-9]/g, '').slice(-12)
  const shortCreator = input.creatorAddress.toLowerCase().replace(/[^a-z0-9]/g, '').slice(-8)
  const channelName = `polpump-${shortToken}-${shortCreator}-${now}`

  const data = await callIvsApi({
    operation: 'CreateChannel',
    body: {
      name: channelName,
      latencyMode: 'LOW',
      type: channelType,
      authorized: false,
      tags: {
        app: 'polpump',
        tokenAddress: input.tokenAddress.toLowerCase(),
        creatorAddress: input.creatorAddress.toLowerCase(),
      },
    },
  })

  const channelArn = data?.channel?.arn || ''
  const ingestEndpoint = data?.channel?.ingestEndpoint || ''
  const playbackUrl = data?.channel?.playbackUrl || ''
  const streamKeyArn = data?.streamKey?.arn || ''
  const streamKey = data?.streamKey?.value || ''

  if (!channelArn || !ingestEndpoint || !playbackUrl || !streamKeyArn || !streamKey) {
    throw new Error('IVS channel provisioning returned incomplete data')
  }

  return {
    channelArn,
    streamKeyArn,
    streamKey,
    ingestEndpoint,
    playbackUrl,
    channelType,
  }
}

export async function createIvsStreamKey(channelArn: string): Promise<{ arn: string; value: string }> {
  const data = await callIvsApi({
    operation: 'CreateStreamKey',
    body: { channelArn },
  })

  const arn = data?.streamKey?.arn || ''
  const value = data?.streamKey?.value || ''
  if (!arn || !value) {
    throw new Error('Failed to create IVS stream key')
  }
  return { arn, value }
}

export async function getIvsStreamKeyValue(streamKeyArn: string): Promise<string | null> {
  const data = await callIvsApi({
    operation: 'GetStreamKey',
    body: { arn: streamKeyArn },
  })
  const value = data?.streamKey?.value
  return typeof value === 'string' && value ? value : null
}

export async function getIvsLiveStream(channelArn: string): Promise<IvsLiveStream | null> {
  try {
    const data = await callIvsApi({
      operation: 'GetStream',
      body: { channelArn },
    })
    const playbackUrl = data?.stream?.playbackUrl || null
    const health = data?.stream?.health || null
    const state = data?.stream?.state || null
    if (!playbackUrl && !state && !health) {
      return null
    }
    return { playbackUrl, health, state }
  } catch (error: any) {
    const message = String(error?.message || '').toLowerCase()
    const code = String(error?.code || '').toLowerCase()
    if (
      message.includes('not broadcasting') ||
      code.includes('channelnotbroadcasting') ||
      message.includes('resource not found') ||
      String(error?.status || '') === '404'
    ) {
      return null
    }
    throw error
  }
}

