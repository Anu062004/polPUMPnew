'use client'
import { WagmiProvider, createConfig, http } from 'wagmi'
import { getDefaultWallets, RainbowKitProvider, darkTheme } from '@rainbow-me/rainbowkit'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { polygon, polygonAmoy } from 'wagmi/chains'
import '@rainbow-me/rainbowkit/styles.css'

const { connectors } = getDefaultWallets({
  appName: 'POL Pump - Polygon Meme Token Creator',
  projectId: 'a14234612450c639dd0adcbb729ddfd8',
})

// Determine which chain to use based on environment
const isMainnet = process.env.NEXT_PUBLIC_NETWORK === 'polygon'
const targetChain = isMainnet 
  ? {
      ...polygon,
      name: 'Polygon Mainnet', // Override name to ensure correct display
    }
  : polygonAmoy

const config = createConfig({
  chains: [targetChain],
  connectors,
  transports: {
    [targetChain.id]: http(
      isMainnet 
        ? (process.env.NEXT_PUBLIC_EVM_RPC || 'https://polygon-mainnet.infura.io/v3/2a16fc884a10441eae11c29cd9b9aa5f')
        : 'https://polygon-amoy.infura.io/v3/b4f237515b084d4bad4e5de070b0452f'
    ),
  },
})

const qc = new QueryClient()

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={qc}>
        <RainbowKitProvider theme={darkTheme({ overlayBlur: 'small' })}>
          {children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  )
}

