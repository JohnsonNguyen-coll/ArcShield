/**
 * Standalone Script: Update Oracle Prices
 * 
 * Run this script periodically (e.g., every hour) to update oracle prices
 * 
 * Usage:
 *   npm run update-oracle
 *   or
 *   node -r ts-node/register scripts/update-oracle.ts
 * 
 * Setup cron job (Linux/Mac):
 *   0 * * * * cd /path/to/frontend && npm run update-oracle
 */

import { createPublicClient, http, createWalletClient } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { fetchExchangeRates, rateTo8Decimals } from '../lib/priceService'

const PRICE_ORACLE_ABI = [
  {
    inputs: [
      { name: 'currencies', type: 'string[]' },
      { name: 'rates', type: 'uint256[]' },
    ],
    name: 'updatePrices',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
] as const

const arcTestnet = {
  id: 5042002,
  name: 'Arc Testnet',
  network: 'arc-testnet',
  nativeCurrency: {
    decimals: 18,
    name: 'USDC',
    symbol: 'USDC',
  },
  rpcUrls: {
    default: { http: ['https://rpc.testnet.arc.network'] },
  },
  blockExplorers: {
    default: { name: 'ArcScan', url: 'https://testnet.arcscan.app' },
  },
  testnet: true,
} as const

async function updateOraclePrices() {
  try {
    const oracleAddress = process.env.NEXT_PUBLIC_PRICE_ORACLE_ADDRESS
    const privateKey = process.env.ORACLE_UPDATER_PRIVATE_KEY

    if (!oracleAddress) {
      throw new Error('NEXT_PUBLIC_PRICE_ORACLE_ADDRESS not set')
    }

    if (!privateKey) {
      throw new Error('ORACLE_UPDATER_PRIVATE_KEY not set')
    }

    console.log('🔄 Fetching real-time exchange rates...')
    const rates = await fetchExchangeRates()
    console.log('📊 Current rates:', {
      BRL: rates.BRL,
      MXN: rates.MXN,
      EUR: rates.EUR,
    })

    const account = privateKeyToAccount(privateKey as `0x${string}`)

    const publicClient = createPublicClient({
      chain: arcTestnet,
      transport: http(),
    })

    const walletClient = createWalletClient({
      account,
      chain: arcTestnet,
      transport: http(),
    })

    const currencies = ['BRL', 'MXN', 'EUR']
    const rates8Decimals = [
      rateTo8Decimals(rates.BRL),
      rateTo8Decimals(rates.MXN),
      rateTo8Decimals(rates.EUR),
    ]

    console.log('📝 Updating oracle on-chain...')
    const hash = await walletClient.writeContract({
      address: oracleAddress as `0x${string}`,
      abi: PRICE_ORACLE_ABI,
      functionName: 'updatePrices',
      args: [currencies, rates8Decimals],
    })

    console.log('⏳ Waiting for transaction confirmation...')
    const receipt = await publicClient.waitForTransactionReceipt({ hash })

    console.log('✅ Oracle prices updated successfully!')
    console.log('📄 Transaction hash:', hash)
    console.log('🔗 Explorer:', `https://testnet.arcscan.app/tx/${hash}`)
    console.log('📊 Updated rates:', {
      BRL: rates.BRL,
      MXN: rates.MXN,
      EUR: rates.EUR,
    })
  } catch (error: any) {
    console.error('❌ Failed to update oracle prices:', error.message)
    process.exit(1)
  }
}

updateOraclePrices()









