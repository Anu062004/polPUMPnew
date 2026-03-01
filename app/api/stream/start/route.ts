import { NextRequest, NextResponse } from 'next/server'
import { ethers } from 'ethers'
import { withCreatorAuth } from '../../../../lib/roleMiddleware'
import { getLivestream, getTokenCreator, upsertLivestream } from '../../../../lib/livestreamDatabase'
import {
  createIvsChannel,
  getConfiguredIvsChannelType,
  getIvsStreamKeyValue,
  isIvsConfigured,
} from '../../../../lib/ivsService'

export const dynamic = 'force-dynamic'

function normalizeRtmpIngestUrl(ingestEndpoint: string): string {
  const trimmed = ingestEndpoint.replace(/^https?:\/\//i, '').replace(/\/+$/, '')
  return `rtmps://${trimmed}:443/app`
}

function normalizeIngestEndpoint(input: string | null | undefined): string | null {
  const trimmed = String(input || '').trim()
  if (!trimmed) return null

  const withoutScheme = trimmed.replace(/^[a-z]+:\/\//i, '')
  const [hostPort = ''] = withoutScheme.split('/')
  const host = hostPort.split(':')[0]?.trim()
  return host || null
}

function shouldReprovisionChannel(error: any): boolean {
  const code = String(error?.code || '')
  const message = String(error?.message || '').toLowerCase()
  return (
    code.includes('ResourceNotFound') ||
    code.includes('ValidationException') ||
    message.includes('resource not found') ||
    message.includes('does not exist') ||
    message.includes('invalid arn')
  )
}

function normalizeStartError(error: any): string {
  if (!error) return 'Failed to start livestream'
  if (typeof error === 'string') return error
  if (typeof error?.message === 'string' && error.message.trim()) return error.message.trim()
  if (typeof error?.error === 'string' && error.error.trim()) return error.error.trim()
  if (typeof error?.code === 'string' && error.code.trim()) {
    return `Livestream start failed (${error.code.trim()})`
  }
  try {
    const serialized = JSON.stringify(error)
    if (serialized && serialized !== '{}') {
      return `Livestream start failed: ${serialized.slice(0, 260)}`
    }
  } catch {
    // Ignore serialization issues.
  }
  return 'Failed to start livestream'
}

export const POST = withCreatorAuth(async (request: NextRequest, user) => {
  try {
    const body = await request.json()
    const tokenAddress = body?.tokenAddress as string

    if (!tokenAddress || !ethers.isAddress(tokenAddress)) {
      return NextResponse.json(
        { success: false, error: 'Invalid token address' },
        { status: 400 }
      )
    }

    if (!isIvsConfigured()) {
      return NextResponse.json(
        {
          success: false,
          error:
            'AWS IVS is not configured. Set AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, and AWS_REGION.',
        },
        { status: 500 }
      )
    }

    const normalizedTokenAddress = tokenAddress.toLowerCase()
    const creatorAddress = user.wallet.toLowerCase()

    const tokenCreator = await getTokenCreator(normalizedTokenAddress)
    if (tokenCreator && tokenCreator.toLowerCase() !== creatorAddress) {
      return NextResponse.json(
        { success: false, error: 'Only token creator can start livestream' },
        { status: 403 }
      )
    }

    const existing = await getLivestream(normalizedTokenAddress)
    const configuredChannelType = getConfiguredIvsChannelType()

    let channelArn = existing?.channelArn || null
    let streamKeyArn = existing?.streamKeyArn || null
    let streamKey = existing?.streamKey || null
    let ingestEndpoint = normalizeIngestEndpoint(existing?.ingestEndpoint) || null
    let playbackUrl = existing?.playbackUrl || null
    let channelType = (existing?.channelType || configuredChannelType).toUpperCase()

    const hasProvisionedIvsChannel =
      !!channelArn && !!streamKeyArn && !!streamKey && !!ingestEndpoint && !!playbackUrl

    let shouldProvisionFresh = !hasProvisionedIvsChannel || !streamKey?.startsWith('sk_')

    // Stored IVS resources can become stale (manual deletion/rotation). Refresh key value when possible.
    if (!shouldProvisionFresh && streamKeyArn) {
      try {
        const latestStreamKey = await getIvsStreamKeyValue(streamKeyArn)
        if (latestStreamKey && latestStreamKey.startsWith('sk_')) {
          streamKey = latestStreamKey
        } else {
          shouldProvisionFresh = true
        }
      } catch (streamKeyError: any) {
        if (shouldReprovisionChannel(streamKeyError)) {
          shouldProvisionFresh = true
        } else {
          console.warn(
            'Could not refresh IVS stream key; using stored key:',
            streamKeyError?.message || streamKeyError
          )
        }
      }
    } else if (!shouldProvisionFresh && !streamKeyArn) {
      shouldProvisionFresh = true
    }

    if (shouldProvisionFresh) {
      const provisioned = await createIvsChannel({
        tokenAddress: normalizedTokenAddress,
        creatorAddress,
        channelType,
      })
      channelArn = provisioned.channelArn
      streamKeyArn = provisioned.streamKeyArn
      streamKey = provisioned.streamKey
      ingestEndpoint = normalizeIngestEndpoint(provisioned.ingestEndpoint)
      playbackUrl = provisioned.playbackUrl
      channelType = provisioned.channelType
    }

    if (!channelArn || !streamKeyArn || !streamKey || !ingestEndpoint || !playbackUrl) {
      throw new Error('Failed to provision IVS channel and stream key')
    }

    const ingestUrl = normalizeRtmpIngestUrl(ingestEndpoint)
    const livestream = await upsertLivestream(
      normalizedTokenAddress,
      creatorAddress,
      'live',
      streamKey,
      ingestUrl,
      playbackUrl,
      {
        channelArn,
        streamKeyArn,
        ingestEndpoint,
        playbackUrl,
        provider: 'aws-ivs',
        channelType,
      }
    )

    return NextResponse.json({
      success: true,
      tokenAddress: livestream.tokenAddress,
      creatorAddress: livestream.creatorAddress,
      streamKey: livestream.streamKey,
      ingestEndpoint,
      ingestUrl,
      ingestUrlFull: ingestUrl,
      playbackUrl,
      provider: 'aws-ivs',
      channelType,
    })
  } catch (error: any) {
    console.error('Error starting livestream:', error)
    const message = normalizeStartError(error)
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    )
  }
})





