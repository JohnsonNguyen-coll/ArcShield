'use client'

import { useState, useEffect } from 'react'
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useReadContract } from 'wagmi'
import { Shield, AlertCircle } from 'lucide-react'
import { parseUnits, formatUnits, createPublicClient, http } from 'viem'
import ProtectionSlider from './ProtectionSlider'
import { fetchExchangeRates, rateFrom8Decimals } from '@/lib/priceService'

// Arc Testnet configuration (same as API route)
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

// Contract ABI (simplified - in production, import from artifacts)
const ROUTER_ABI = [
  {
    inputs: [
      { name: 'collateralAmount', type: 'uint256' },
      { name: 'targetCurrency', type: 'string' },
      { name: 'level', type: 'uint8' },
    ],
    name: 'activateProtection',
    outputs: [{ name: 'positionAddress', type: 'address' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ name: 'user', type: 'address' }],
    name: 'hasPosition',
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const

const PRICE_ORACLE_ABI = [
  {
    inputs: [{ name: 'currency', type: 'string' }],
    name: 'getPrice',
    outputs: [
      { name: 'rate', type: 'uint256' },
      { name: 'isStale', type: 'bool' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
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

const USDC_ABI = [
  {
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' },
    ],
    name: 'allowance',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    name: 'approve',
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
] as const

const USDC_ADDRESS = '0x3600000000000000000000000000000000000000' as `0x${string}`

interface ExchangeRates {
  BRL: number
  MXN: number
  EUR: number
}

export default function ProtectionPanel() {
  const { address, isConnected } = useAccount()
  const [collateralAmount, setCollateralAmount] = useState('')
  const [targetCurrency, setTargetCurrency] = useState('BRL')
  const [protectionLevel, setProtectionLevel] = useState<0 | 1 | 2>(1)
  const [error, setError] = useState('')
  const [exchangeRates, setExchangeRates] = useState<ExchangeRates | null>(null)
  const [isSyncingOracle, setIsSyncingOracle] = useState(false)

  const routerAddress = process.env.NEXT_PUBLIC_ARCSHIELD_ROUTER_ADDRESS as `0x${string}`
  const oracleAddress = process.env.NEXT_PUBLIC_PRICE_ORACLE_ADDRESS as `0x${string}`

  // Fetch exchange rates from API (same as PriceDisplay)
  useEffect(() => {
    const fetchRates = async () => {
      try {
        const rates = await fetchExchangeRates()
        setExchangeRates(rates)
      } catch (error) {
        console.error('Failed to fetch exchange rates:', error)
      }
    }

    fetchRates()
    // Refresh every 30 seconds to stay in sync with PriceDisplay
    const interval = setInterval(fetchRates, 30000)
    return () => clearInterval(interval)
  }, [])

  // Read on-chain prices with auto-refetch (for display after oracle updates)
  const { data: onChainPriceBRL } = useReadContract({
    address: oracleAddress,
    abi: PRICE_ORACLE_ABI,
    functionName: 'getPrice',
    args: ['BRL'],
    query: {
      refetchInterval: 15000, // Auto-refetch every 15 seconds
    },
  })

  const { data: onChainPriceMXN } = useReadContract({
    address: oracleAddress,
    abi: PRICE_ORACLE_ABI,
    functionName: 'getPrice',
    args: ['MXN'],
    query: {
      refetchInterval: 15000,
    },
  })

  const { data: onChainPriceEUR } = useReadContract({
    address: oracleAddress,
    abi: PRICE_ORACLE_ABI,
    functionName: 'getPrice',
    args: ['EUR'],
    query: {
      refetchInterval: 15000,
    },
  })

  const {
    writeContract,
    data: hash,
    isPending,
    error: writeError,
    reset: resetWriteError,
  } = useWriteContract()

  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  })

  // Check if user already has a position
  const { data: hasPosition, refetch: refetchHasPosition } = useReadContract({
    address: address && routerAddress ? routerAddress : undefined,
    abi: ROUTER_ABI,
    functionName: 'hasPosition',
    args: address ? [address] : undefined,
  })

  useEffect(() => {
    if (isSuccess && refetchHasPosition) {
      const timer = setTimeout(() => {
        refetchHasPosition()
      }, 2000)
      return () => clearTimeout(timer)
    }
  }, [isSuccess, refetchHasPosition])

  // Check USDC allowance
  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    address: address && routerAddress ? USDC_ADDRESS : undefined,
    abi: USDC_ABI,
    functionName: 'allowance',
    args: address && routerAddress ? [address, routerAddress] : undefined,
    query: {
      enabled: !!address && !!routerAddress && !!collateralAmount && parseFloat(collateralAmount) > 0,
      refetchInterval: 3000,
    },
  })

  // Approve USDC
  const {
    writeContract: approveUSDC,
    data: approveHash,
    isPending: isApproving,
    error: approveError,
    reset: resetApprove,
  } = useWriteContract()

  const { isLoading: isApprovingConfirming, isSuccess: isApproved } = useWaitForTransactionReceipt({
    hash: approveHash,
  })

  useEffect(() => {
    if (isApproved && refetchAllowance) {
      const timer = setTimeout(() => {
        refetchAllowance()
      }, 1000)
      return () => clearTimeout(timer)
    }
  }, [isApproved, refetchAllowance])

  const allowanceNum = allowance ? Number(formatUnits(allowance, 6)) : 0
  const collateralNum = collateralAmount ? parseFloat(collateralAmount) : 0
  const hasEnoughAllowance = collateralNum > 0 && allowanceNum >= collateralNum
  const needsApproval = collateralNum > 0 && !hasEnoughAllowance && !isApproved

  const isApproveUserRejection = approveError && (
    approveError.message?.toLowerCase().includes('user rejected') ||
    approveError.message?.toLowerCase().includes('user denied') ||
    approveError.message?.toLowerCase().includes('rejected') ||
    approveError.message?.toLowerCase().includes('cancelled') ||
    approveError.message?.toLowerCase().includes('denied request') ||
    (approveError as any)?.code === 4001 ||
    (approveError as any)?.shortMessage?.toLowerCase().includes('rejected') ||
    (approveError as any)?.shortMessage?.toLowerCase().includes('denied')
  )

  const isUserRejection = writeError && (
    writeError.message?.toLowerCase().includes('user rejected') ||
    writeError.message?.toLowerCase().includes('user denied') ||
    writeError.message?.toLowerCase().includes('rejected') ||
    writeError.message?.toLowerCase().includes('cancelled') ||
    writeError.message?.toLowerCase().includes('denied request') ||
    (writeError as any)?.code === 4001 ||
    (writeError as any)?.shortMessage?.toLowerCase().includes('rejected') ||
    (writeError as any)?.shortMessage?.toLowerCase().includes('denied')
  )

  const handleApprove = () => {
    if (!routerAddress) return
    const amount = parseUnits('1000000', 6)
    approveUSDC({
      address: USDC_ADDRESS,
      abi: USDC_ABI,
      functionName: 'approve',
      args: [routerAddress, amount],
    })
  }

  const handleActivate = async () => {
    if (!isConnected || !address) {
      setError('Please connect your wallet')
      return
    }

    if (!collateralAmount || parseFloat(collateralAmount) <= 0) {
      setError('Please enter a valid collateral amount')
      return
    }

    if (!routerAddress) {
      setError('Router contract not configured')
      return
    }

    // Prevent multiple simultaneous activations
    if (isPending || isSyncingOracle) {
      return
    }

    setError('')

    try {
      // Sync Oracle with API rate before activating to ensure Entry Rate matches PriceDisplay
      const apiRate = exchangeRates?.[targetCurrency as keyof ExchangeRates]
      const onChainPriceData = 
        targetCurrency === 'BRL' ? onChainPriceBRL :
        targetCurrency === 'MXN' ? onChainPriceMXN :
        onChainPriceEUR
      
      if (apiRate && onChainPriceData) {
        const onChainRate = rateFrom8Decimals((onChainPriceData as [bigint, boolean])[0])
        const rateDiff = Math.abs(apiRate - onChainRate)
        const rateDiffPct = (rateDiff / apiRate) * 100
        
        // If on-chain Oracle rate differs from API rate by more than 0.1%, try to sync
        if (rateDiffPct > 0.1) {
          setIsSyncingOracle(true)
          try {
            // Try to call API endpoint to update Oracle
            const response = await fetch('/api/update-oracle', {
              method: 'GET',
              cache: 'no-cache',
            })
              
            if (response.ok) {
              const result = await response.json()
              const txHash = result.transactionHash
              
              if (txHash) {
                // Create public client to wait for transaction
                const client = createPublicClient({
                  chain: arcTestnet,
                  transport: http(),
                })
                
                // Wait for the Oracle update transaction to be confirmed
                try {
                  await client.waitForTransactionReceipt({ 
                    hash: txHash as `0x${string}`,
                    timeout: 30000 // 30 seconds timeout
                  })
                  
                  // Verify the on-chain rate was updated (poll up to 5 times with 2s delay)
                  let verified = false
                  for (let i = 0; i < 5; i++) {
                    await new Promise(resolve => setTimeout(resolve, 2000))
                    
                    // Refetch on-chain price
                    const updatedPriceData = await client.readContract({
                      address: oracleAddress,
                      abi: PRICE_ORACLE_ABI,
                      functionName: 'getPrice',
                      args: [targetCurrency],
                    })
                    
                    const updatedRate = rateFrom8Decimals((updatedPriceData as [bigint, boolean])[0])
                    const newRateDiff = Math.abs(apiRate - updatedRate)
                    const newRateDiffPct = (newRateDiff / apiRate) * 100
                    
                    // If rate is now within 0.1% of API rate, consider it verified
                    if (newRateDiffPct <= 0.1) {
                      verified = true
                      break
                    }
                  }
                  
                  // Refetch exchange rates to update display after oracle sync
                  try {
                    const updatedRates = await fetchExchangeRates()
                    setExchangeRates(updatedRates)
                  } catch (err) {
                    console.error('Failed to refetch exchange rates after oracle sync:', err)
                  }
                  
                  if (!verified) {
                    // Get final on-chain rate for warning
                    const finalPriceData = await client.readContract({
                      address: oracleAddress,
                      abi: PRICE_ORACLE_ABI,
                      functionName: 'getPrice',
                      args: [targetCurrency],
                    })
                    const finalRate = rateFrom8Decimals((finalPriceData as [bigint, boolean])[0])
                    setError(`Warning: Oracle was updated but rate may still differ. Entry Rate will be ${finalRate.toFixed(4)} (on-chain) instead of ${apiRate.toFixed(4)} (API). The position will still be created.`)
                  }
                } catch (waitError: any) {
                  console.error('Error waiting for Oracle update:', waitError)
                  setError(`Warning: Oracle update transaction sent but confirmation timed out. Entry Rate may be ${onChainRate.toFixed(4)} (on-chain) instead of ${apiRate.toFixed(4)} (API). The position will still be created.`)
                }
              } else {
                // No transaction hash in response, but API call succeeded
                // Wait a bit and proceed
                await new Promise(resolve => setTimeout(resolve, 5000))
              }
            } else {
              const errorData = await response.json().catch(() => ({}))
              // Show warning but allow user to proceed
              setError(`Warning: Could not update Oracle automatically. Entry Rate will be ${onChainRate.toFixed(4)} (on-chain) instead of ${apiRate.toFixed(4)} (API). The position will still be created, but Entry Rate may differ from the displayed price.`)
              // Don't return - allow activation to proceed with warning
            }
          } catch (syncError: any) {
            // Show warning but allow activation to proceed
            setError(`Warning: Could not sync Oracle. Entry Rate will be ${onChainRate.toFixed(4)} (on-chain) instead of ${apiRate.toFixed(4)} (API). You can still proceed, but Entry Rate may differ from displayed price.`)
            // Don't return - allow activation to proceed with warning
          } finally {
            setIsSyncingOracle(false)
          }
        }
      }

      const amount = parseUnits(collateralAmount, 6)
      writeContract({
        address: routerAddress,
        abi: ROUTER_ABI,
        functionName: 'activateProtection',
        args: [amount, targetCurrency, protectionLevel],
      })
    } catch (err: any) {
      setError(err.message || 'Failed to activate protection')
      setIsSyncingOracle(false)
    }
  }

  const protectionLevels = [
    { value: 0, label: 'Low', ltv: '20%', description: 'Very safe, low cost' },
    {
      value: 1,
      label: 'Medium',
      ltv: '35%',
      description: 'Balanced protection',
    },
    {
      value: 2,
      label: 'High',
      ltv: '50%',
      description: 'Maximum protection',
    },
  ]

  // Display current exchange rate - prefer on-chain if available and not stale
  const onChainPriceData = 
    targetCurrency === 'BRL' ? onChainPriceBRL :
    targetCurrency === 'MXN' ? onChainPriceMXN :
    onChainPriceEUR
  
  const onChainRateForDisplay = onChainPriceData
    ? rateFrom8Decimals((onChainPriceData as [bigint, boolean])[0])
    : null
  const isStaleForDisplay = onChainPriceData ? (onChainPriceData as [bigint, boolean])[1] : false
  const apiRateForDisplay = exchangeRates?.[targetCurrency as keyof ExchangeRates] || null
  
  // Prefer on-chain rate if available and not stale (matches PriceDisplay logic)
  const currentRate = (onChainRateForDisplay && !isStaleForDisplay) 
    ? onChainRateForDisplay 
    : (apiRateForDisplay || onChainRateForDisplay || 0)

  return (
    <div className="card">
      <div className="flex items-center space-x-3 mb-6">
        <div className="bg-purple-800/50 p-2 rounded-lg">
          <Shield className="w-5 h-5 text-purple-300" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-white">
            Activate Protection
          </h2>
          <p className="text-sm text-purple-400">
            Protect your assets from currency risk
          </p>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-900/30 border border-red-700/50 rounded-xl flex items-start space-x-3">
          <AlertCircle className="w-5 h-5 text-red-300 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-200">{error}</p>
        </div>
      )}

      {writeError && (
        <div className="mb-4 p-3 bg-purple-800/30 border border-purple-700/30 rounded-lg">
          <div className="flex items-start justify-between">
            <div className="flex items-start space-x-2 flex-1">
              <AlertCircle className="w-4 h-4 text-purple-300 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-purple-200">
                {isUserRejection ? 'Transaction cancelled' : 'Transaction failed'}
              </p>
            </div>
            <button
              onClick={() => resetWriteError()}
              className="text-xs text-purple-400 hover:text-purple-200 underline ml-2"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {isSuccess && (
        <div className="mb-4 p-4 bg-emerald-900/30 border border-emerald-700/50 rounded-xl">
          <p className="text-sm text-emerald-200 font-medium">
            Protection activated successfully!
          </p>
        </div>
      )}

      {hasPosition && (
        <div className="mb-4 p-4 bg-orange-900/30 border border-orange-700/50 rounded-xl flex items-start space-x-3">
          <AlertCircle className="w-5 h-5 text-orange-300 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-orange-200 mb-1">
              You already have an active position
            </p>
            <p className="text-xs text-orange-300">
              Please close your current position before creating a new one. You can close it in the "Your Position" section below.
            </p>
          </div>
        </div>
      )}

      {approveError && (
        <div className="mb-4 p-3 bg-purple-800/30 border border-purple-700/30 rounded-lg">
          <div className="flex items-start justify-between">
            <div className="flex items-start space-x-2 flex-1">
              <AlertCircle className="w-4 h-4 text-purple-300 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-purple-200">
                {isApproveUserRejection ? 'Approval cancelled' : 'Approval failed'}
              </p>
            </div>
            <button
              onClick={() => resetApprove()}
              className="text-xs text-purple-400 hover:text-purple-200 underline ml-2"
            >
              Close
            </button>
          </div>
        </div>
      )}

      <div className="space-y-6">
        {/* Current Exchange Rate Display */}
        {currentRate > 0 && (
          <div className="bg-purple-800/20 border border-purple-700/30 rounded-xl p-3">
            <div className="text-xs text-purple-400 mb-1">Current Rate</div>
            <div className="text-lg font-bold text-purple-100">
              1 {targetCurrency} = ${currentRate.toFixed(4)} USD
            </div>
          </div>
        )}

        {/* Collateral Amount */}
        <div>
          <label className="block text-sm font-semibold text-purple-200 mb-2">
            Collateral Amount (USDC)
          </label>
          <input
            type="number"
            step="0.01"
            min="0"
            value={collateralAmount}
            onChange={(e) => setCollateralAmount(e.target.value)}
            placeholder="1000"
            className="input-field"
            disabled={isPending || isConfirming || hasPosition}
          />
          <p className="text-xs text-purple-400 mt-1">
            Amount of USDC to use as collateral
          </p>
        </div>

        {/* Target Currency */}
        <div>
          <label className="block text-sm font-semibold text-purple-200 mb-2">
            Currency to Hedge
          </label>
          <select
            value={targetCurrency}
            onChange={(e) => setTargetCurrency(e.target.value)}
            className="input-field"
            disabled={isPending || isConfirming || hasPosition}
          >
            <option value="BRL">Brazilian Real (BRL)</option>
            <option value="MXN">Mexican Peso (MXN)</option>
            <option value="EUR">Euro (EUR)</option>
          </select>
        </div>

        {/* Protection Level Slider */}
        <div>
          <label className="block text-sm font-semibold text-purple-200 mb-4">
            Protection Level
          </label>
          <ProtectionSlider
            value={protectionLevel}
            onChange={setProtectionLevel}
            disabled={isPending || isConfirming || hasPosition}
          />
          <div className="mt-4 grid grid-cols-3 gap-3">
            {protectionLevels.map((level) => (
              <button
                key={level.value}
                onClick={() => setProtectionLevel(level.value as 0 | 1 | 2)}
                disabled={isPending || isConfirming || hasPosition}
                className={`p-4 rounded-xl border-2 transition-all ${
                  protectionLevel === level.value
                    ? 'border-purple-500 bg-purple-800/50'
                    : 'border-purple-700/30 hover:border-purple-600/50 bg-purple-900/20'
                }`}
              >
                <div className="font-semibold text-white">{level.label}</div>
                <div className="text-xs text-purple-300 mt-1">
                  LTV: {level.ltv}
                </div>
                <div className="text-xs text-purple-400 mt-1">
                  {level.description}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3">
          {needsApproval && !hasPosition && (
            <button
              onClick={handleApprove}
              disabled={isApproving || isApprovingConfirming || isApproved || !isConnected}
              className="btn-primary flex-1"
            >
              {isApproving || isApprovingConfirming
                ? 'Approving...'
                : isApproved
                ? 'Approved ✓'
                : 'Approve USDC'}
            </button>
          )}
          <button
            onClick={handleActivate}
            disabled={isPending || isConfirming || !isConnected || needsApproval || hasPosition}
            className={`${needsApproval && !hasPosition ? 'flex-1' : 'w-full'} btn-primary`}
          >
            {isPending || isConfirming
              ? 'Processing...'
              : isSuccess
              ? 'Protection Active'
              : hasPosition
              ? 'Close Position First'
              : 'Activate Protection'}
          </button>
        </div>
      </div>
    </div>
  )
}