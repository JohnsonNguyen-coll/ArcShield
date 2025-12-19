/**
 * API Route: Auto-update Oracle Prices
 * 
 * This endpoint is called by Vercel Cron to update oracle prices on-chain periodically.
 * 
 * Security:
 * - Protected by Vercel Cron (only Vercel can call it)
 * - For manual testing, use Authorization header with API key
 * 
 * Usage:
 * - Vercel Cron: Automatically called every hour (configured in vercel.json)
 * - Manual test: curl -H "Authorization: Bearer YOUR_API_KEY" http://localhost:3000/api/update-oracle
 */

import { NextRequest, NextResponse } from 'next/server'
import { createPublicClient, http, createWalletClient, encodeFunctionData } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { fetchExchangeRates, rateTo8Decimals } from '@/lib/priceService'

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

// Arc Testnet configuration
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

export async function GET(request: NextRequest) {
  try {
    // Security: Check if called by Vercel Cron or has valid API key
    const authHeader = request.headers.get('authorization')
    const vercelCronHeader = request.headers.get('x-vercel-cron') // Vercel automatically sets this
    const apiKey = process.env.ORACLE_UPDATE_API_KEY
    
    // Allow if:
    // 1. Called by Vercel Cron (has x-vercel-cron header)
    // 2. Has valid Authorization header with API key
    // 3. No auth required in development (for testing)
    const isVercelCron = !!vercelCronHeader // Vercel sets this header automatically
    const hasValidApiKey = apiKey && authHeader === `Bearer ${apiKey}`
    const isDevelopment = process.env.NODE_ENV === 'development'
    
    if (!isVercelCron && !hasValidApiKey && !isDevelopment) {
      return NextResponse.json(
        { error: 'Unauthorized. This endpoint is protected. Use Authorization header with API key for manual calls.' },
        { status: 401 }
      )
    }

    // Get environment variables
    const oracleAddress = process.env.NEXT_PUBLIC_PRICE_ORACLE_ADDRESS
    const privateKey = process.env.ORACLE_UPDATER_PRIVATE_KEY

    if (!oracleAddress) {
      return NextResponse.json(
        { error: 'NEXT_PUBLIC_PRICE_ORACLE_ADDRESS not configured' },
        { status: 500 }
      )
    }

    if (!privateKey) {
      return NextResponse.json(
        { error: 'ORACLE_UPDATER_PRIVATE_KEY not configured' },
        { status: 500 }
      )
    }

    // Create account from private key
    const account = privateKeyToAccount(privateKey as `0x${string}`)

    // Create clients
    const publicClient = createPublicClient({
      chain: arcTestnet,
      transport: http(),
    })

    const walletClient = createWalletClient({
      account,
      chain: arcTestnet,
      transport: http(),
    })

    // Fetch real-time rates
    const rates = await fetchExchangeRates()

    // Convert to 8 decimals format
    const currencies = ['BRL', 'MXN', 'EUR']
    const rates8Decimals = [
      rateTo8Decimals(rates.BRL),
      rateTo8Decimals(rates.MXN),
      rateTo8Decimals(rates.EUR),
    ]

    // Update on-chain
    const hash = await walletClient.writeContract({
      address: oracleAddress as `0x${string}`,
      abi: PRICE_ORACLE_ABI,
      functionName: 'updatePrices',
      args: [currencies, rates8Decimals],
    })

    // Wait for transaction receipt
    const receipt = await publicClient.waitForTransactionReceipt({ hash })

    return NextResponse.json({
      success: true,
      transactionHash: hash,
      blockNumber: receipt.blockNumber.toString(),
      explorerUrl: `https://testnet.arcscan.app/tx/${hash}`,
      rates: {
        BRL: rates.BRL,
        MXN: rates.MXN,
        EUR: rates.EUR,
      },
      timestamp: new Date().toISOString(),
      updatedBy: isVercelCron ? 'vercel-cron' : hasValidApiKey ? 'api-key' : 'development',
    })
  } catch (error: any) {
    console.error('Failed to update oracle prices:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to update oracle prices' },
      { status: 500 }
    )
  }
}


