import { NextRequest, NextResponse } from 'next/server'
import { ethers } from 'ethers'
import { withCreatorAuth } from '../../../../lib/roleMiddleware'
import { getLivestream, getTokenCreator, upsertLivestream } from '../../../../lib/livestreamDatabase'
import {
  createIvsChannel,
  getConfiguredIvsChannelType,
  isIvsConfigured,
} from '../../../../lib/ivsService'

export const dynamic = 'force-dynamic'

function normalizeRtmpIngestUrl(ingestEndpoint: string): string {
  const trimmed = ingestEndpoint.replace(/^https?:\/\//i, '').replace(/\/+$/, '')
  return `rtmps://${trimmed}:443/app`
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
    let ingestEndpoint = existing?.ingestEndpoint || null
    let playbackUrl = existing?.playbackUrl || null
    let channelType = (existing?.channelType || configuredChannelType).toUpperCase()

    const hasProvisionedIvsChannel =
      !!channelArn && !!streamKeyArn && !!streamKey && !!ingestEndpoint && !!playbackUrl

    if (!hasProvisionedIvsChannel || !streamKey?.startsWith('sk_')) {
      const provisioned = await createIvsChannel({
        tokenAddress: normalizedTokenAddress,
        creatorAddress,
        channelType,
      })
      channelArn = provisioned.channelArn
      streamKeyArn = provisioned.streamKeyArn
      streamKey = provisioned.streamKey
      ingestEndpoint = provisioned.ingestEndpoint
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
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to start livestream' },
      { status: 500 }
    )
  }
})





