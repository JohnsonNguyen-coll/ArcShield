'use client'

import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import { formatUnits, parseUnits } from 'viem'
import { TrendingUp, TrendingDown, X, AlertCircle, ShieldCheck, Coins, Globe2, Info } from 'lucide-react'
import { useState, useEffect } from 'react'
import { fetchExchangeRates } from '@/lib/priceService'

const ROUTER_ABI = [
  {
    inputs: [{ name: 'user', type: 'address' }],
    name: 'getPosition',
    outputs: [{ name: '', type: 'address' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: 'user', type: 'address' }],
    name: 'hasPosition',
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'closeProtection',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [],
    name: 'settleProtection',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ name: 'user', type: 'address' }],
    name: 'calculateProtectionOutcome',
    outputs: [
      { name: 'protectionAmount', type: 'uint256' },
      { name: 'depreciationPct', type: 'uint256' },
      { name: 'currentRate', type: 'uint256' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: 'repayAmount', type: 'uint256' }],
    name: 'reduceProtection',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
] as const

const POSITION_ABI = [
  {
    inputs: [],
    name: 'getPositionDetails',
    outputs: [
      { name: '_owner', type: 'address' },
      { name: '_collateral', type: 'uint256' },
      { name: '_debt', type: 'uint256' },
      { name: '_healthFactor', type: 'uint256' },
      { name: '_safetyBuffer', type: 'uint256' },
      { name: '_level', type: 'uint8' },
      { name: '_isActive', type: 'bool' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'close',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [],
    name: 'targetCurrency',
    outputs: [{ name: '', type: 'string' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'createdAt',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'entryRate',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'validateOracle',
    outputs: [
      { name: 'isValid', type: 'bool' },
      { name: 'reason', type: 'string' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'getSafeExchangeRate',
    outputs: [{ name: 'safeRate', type: 'uint256' }],
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
] as const

export default function PositionDashboard() {
  const { address } = useAccount()
  const routerAddress = process.env.NEXT_PUBLIC_ARCSHIELD_ROUTER_ADDRESS as `0x${string}`
  const oracleAddress = process.env.NEXT_PUBLIC_PRICE_ORACLE_ADDRESS as `0x${string}`
  const [showReduceModal, setShowReduceModal] = useState(false)
  const [reduceAmount, setReduceAmount] = useState('')
  const [error, setError] = useState('')
  const [apiRate, setApiRate] = useState<number | null>(null)
  const [useSettleProtection, setUseSettleProtection] = useState(false)

  const { 
    writeContract: writeClose, 
    data: closeHash,
    isPending: isClosing,
    error: closeError,
    reset: resetCloseError,
  } = useWriteContract()
  
  const { 
    writeContract: writeSettle, 
    data: settleHash,
    isPending: isSettling,
    error: settleError,
    reset: resetSettleError,
  } = useWriteContract()
  
  const { 
    writeContract: writeReduce, 
    data: reduceHash,
    isPending: isReducing 
  } = useWriteContract()

  const { isLoading: isConfirmingClose, isSuccess: isClosed } = useWaitForTransactionReceipt({
    hash: closeHash,
  })

  const { isLoading: isConfirmingSettle, isSuccess: isSettled } = useWaitForTransactionReceipt({
    hash: settleHash,
  })

  const { isLoading: isConfirmingReduce, isSuccess: isReduced } = useWaitForTransactionReceipt({
    hash: reduceHash,
  })

  // Don't auto-close modal - let user close it manually after seeing success message

  const { data: hasPosition, refetch: refetchHasPosition } = useReadContract({
    address: address && routerAddress ? routerAddress : undefined,
    abi: ROUTER_ABI,
    functionName: 'hasPosition',
    args: address ? [address] : undefined,
    query: {
      refetchInterval: 3000, // Auto-refetch every 3 seconds
    },
  })

  // Refetch hasPosition after closing or settling position
  useEffect(() => {
    if ((isClosed || isSettled) && refetchHasPosition) {
      const timer = setTimeout(() => {
        refetchHasPosition()
      }, 2000)
      return () => clearTimeout(timer)
    }
  }, [isClosed, isSettled, refetchHasPosition])

  const { data: positionAddress } = useReadContract({
    address: address && routerAddress && hasPosition ? routerAddress : undefined,
    abi: ROUTER_ABI,
    functionName: 'getPosition',
    args: address ? [address] : undefined,
    query: {
      refetchInterval: hasPosition ? 3000 : false, // Auto-refetch every 3 seconds if has position
    },
  })

  const { data: positionDetails } = useReadContract({
    address: positionAddress ? (positionAddress as `0x${string}`) : undefined,
    abi: POSITION_ABI,
    functionName: 'getPositionDetails',
    query: {
      refetchInterval: positionAddress ? 3000 : false, // Auto-refetch every 3 seconds if has position
    },
  })

  const { data: targetCurrency } = useReadContract({
    address: positionAddress ? (positionAddress as `0x${string}`) : undefined,
    abi: POSITION_ABI,
    functionName: 'targetCurrency',
    query: {
      refetchInterval: positionAddress ? 3000 : false,
    },
  })

  const { data: createdAt } = useReadContract({
    address: positionAddress ? (positionAddress as `0x${string}`) : undefined,
    abi: POSITION_ABI,
    functionName: 'createdAt',
    query: {
      refetchInterval: positionAddress ? 3000 : false,
    },
  })

  const { data: entryRateRaw } = useReadContract({
    address: positionAddress ? (positionAddress as `0x${string}`) : undefined,
    abi: POSITION_ABI,
    functionName: 'entryRate',
    query: {
      refetchInterval: positionAddress ? 30000 : false,
    },
  })

  const { data: onChainRate } = useReadContract({
    address: oracleAddress && targetCurrency ? oracleAddress : undefined,
    abi: PRICE_ORACLE_ABI,
    functionName: 'getPrice',
    args: targetCurrency ? [targetCurrency as string] : undefined,
    query: {
      refetchInterval: targetCurrency ? 15000 : false, // Auto-refetch every 15 seconds
    },
  })

  // Get protection outcome calculation
  const { data: protectionOutcome } = useReadContract({
    address: address && routerAddress && hasPosition ? routerAddress : undefined,
    abi: ROUTER_ABI,
    functionName: 'calculateProtectionOutcome',
    args: address ? [address] : undefined,
    query: {
      refetchInterval: hasPosition ? 30000 : false,
    },
  })

  // Get oracle validation from position
  const { data: oracleValidation } = useReadContract({
    address: positionAddress ? (positionAddress as `0x${string}`) : undefined,
    abi: POSITION_ABI,
    functionName: 'validateOracle',
    query: {
      refetchInterval: positionAddress ? 30000 : false,
    },
  })

  // Get safe exchange rate (with fallback)
  const { data: safeExchangeRate } = useReadContract({
    address: positionAddress ? (positionAddress as `0x${string}`) : undefined,
    abi: POSITION_ABI,
    functionName: 'getSafeExchangeRate',
    query: {
      refetchInterval: positionAddress ? 30000 : false,
    },
  })

  useEffect(() => {
    const loadApiRate = async () => {
      try {
        const rates = await fetchExchangeRates()
        if (targetCurrency) {
          const currency = targetCurrency as 'BRL' | 'MXN' | 'EUR'
          setApiRate(rates[currency] ?? null)
        }
      } catch (err) {
        console.error('Failed to fetch FX rate', err)
      }
    }

    if (targetCurrency) {
      loadApiRate()
      const id = setInterval(loadApiRate, 30000)
      return () => clearInterval(id)
    }
  }, [targetCurrency])

  // Calculate rates for debug logging (before early return to maintain hook order)
  const entryFxRateCalc =
    entryRateRaw && typeof entryRateRaw === 'bigint'
      ? Number(entryRateRaw) / 1e8
      : null

  // Prefer on-chain rate if available and not stale (source of truth after oracle updates)
  const onChainFxRateCalc = onChainRate ? Number((onChainRate as [bigint, boolean])[0]) / 1e8 : null
  const isOnChainStale = onChainRate ? (onChainRate as [bigint, boolean])[1] : false
  
  const currentFxRateCalc =
    (onChainFxRateCalc && !isOnChainStale) 
      ? onChainFxRateCalc 
      : (apiRate ?? onChainFxRateCalc ?? null)
  

  if (!hasPosition || !positionDetails) {
    return (
      <div className="card">
        <div className="text-center py-8">
          <p className="text-purple-300">No active position</p>
          <p className="text-sm text-purple-400 mt-2">
            Activate protection to see your position details here
          </p>
        </div>
      </div>
    )
  }

  const [
    owner,
    collateral,
    debt,
    healthFactor,
    safetyBuffer,
    level,
    isActive,
  ] = positionDetails as [
    `0x${string}`,
    bigint,
    bigint,
    bigint,
    bigint,
    number,
    boolean,
  ]

  // Check if position is active
  if (!isActive) {
    return (
      <div className="card">
        <div className="text-center py-8">
          <p className="text-purple-300">Position Closed</p>
          <p className="text-sm text-purple-400 mt-2">
            This position has been closed. No active position to display.
          </p>
        </div>
      </div>
    )
  }

  const healthFactorNum = Number(healthFactor) / 10000
  const collateralNum = Number(formatUnits(collateral, 6))
  const debtNum = Number(formatUnits(debt, 6))
  // Validate health factor - if it's unreasonably large or debt is 0, it's likely invalid
  // When debt = 0, health factor calculation may be invalid (division by zero in contract)
  const isValidHealthFactor = healthFactorNum > 0 && healthFactorNum < 1000 && !isNaN(healthFactorNum) && isFinite(healthFactorNum)
  const safetyBufferNum = Number(safetyBuffer) / 100
  const levelLtvPercents = [20, 35, 50]
  const valueProtectedPct = levelLtvPercents[level] ?? 0
  // Use pre-calculated values (already calculated before early return)
  const entryFxRate = entryFxRateCalc
  const currentFxRate = currentFxRateCalc
  const onChainFxRate = onChainFxRateCalc
  const isRateStale = onChainRate ? (onChainRate as [bigint, boolean])[1] : false
  
  // Parse protection outcome
  const [protectionAmount, depreciationPct, outcomeCurrentRate] = protectionOutcome as [bigint, bigint, bigint] ?? [BigInt(0), BigInt(0), BigInt(0)]
  const protectionAmountNum = Number(formatUnits(protectionAmount, 6))
  const depreciationPctNum = Number(depreciationPct) / 100
  const outcomeRateNum = outcomeCurrentRate ? Number(outcomeCurrentRate) / 1e8 : null
  
  // Parse oracle validation
  const [oracleIsValid, oracleReason] = oracleValidation as [boolean, string] ?? [true, '']
  
  // Parse safe exchange rate
  const safeRateNum = safeExchangeRate ? Number(safeExchangeRate) / 1e8 : null
  const isUsingFallback = safeRateNum && entryFxRate ? safeRateNum < entryFxRate * 0.9 : false

  const fxChangePct =
    entryFxRate && currentFxRate
      ? ((currentFxRate - entryFxRate) / entryFxRate) * 100
      : null

  // Estimate: assume hedge notional ~= borrowed USDC (debtNum)
  const lossAvoidedEstimate: number | null =
    fxChangePct !== null ? (debtNum * fxChangePct) / 100 : null

  const createdAtDate =
    createdAt && typeof createdAt === 'bigint'
      ? new Date(Number(createdAt) * 1000)
      : null

  const levelNames = ['Low', 'Medium', 'High']
  const levelBgColors = ['bg-emerald-900/30', 'bg-orange-900/30', 'bg-red-900/30']
  const levelTextColors = ['text-emerald-300', 'text-orange-300', 'text-red-300']

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-white">Your Position</h2>
        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${levelBgColors[level]} ${levelTextColors[level]} border border-purple-700/30`}>
          {levelNames[level]} Protection
        </span>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-purple-800/30 border border-purple-700/30 rounded-xl p-4">
          <div className="text-sm text-purple-300 mb-1">Collateral</div>
          <div className="text-2xl font-bold text-white">
            {collateralNum.toLocaleString('en-US', {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </div>
          <div className="text-xs text-purple-400 mt-1">USDC</div>
        </div>

        <div className="bg-purple-800/30 border border-purple-700/30 rounded-xl p-4">
          <div className="text-sm text-purple-300 mb-1">Debt</div>
          <div className="text-2xl font-bold text-white">
            {debtNum.toLocaleString('en-US', {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </div>
          <div className="text-xs text-purple-400 mt-1">USDC</div>
        </div>
      </div>

      {isValidHealthFactor ? (
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-semibold text-purple-200">
              Health Factor
            </span>
            <span
              className={`text-lg font-bold ${
                healthFactorNum >= 1.5
                  ? 'text-emerald-400'
                  : healthFactorNum >= 1.3
                  ? 'text-orange-400'
                  : healthFactorNum >= 1.15
                  ? 'text-red-400'
                  : 'text-red-500'
              }`}
            >
              {healthFactorNum.toFixed(2)}
            </span>
          </div>
          <div className="h-3 bg-purple-950/50 rounded-full overflow-hidden border border-purple-800/30">
            <div
              className={`h-full transition-all duration-300 ${
                healthFactorNum >= 1.5
                  ? 'bg-emerald-500'
                  : healthFactorNum >= 1.3
                  ? 'bg-orange-500'
                  : healthFactorNum >= 1.15
                  ? 'bg-red-500'
                  : 'bg-red-600'
              }`}
              style={{ width: `${Math.min((healthFactorNum / 2) * 100, 100)}%` }}
            />
          </div>
        </div>
      ) : debtNum === 0 ? (
        <div className="mb-6 p-4 bg-indigo-900/30 border border-indigo-700/50 rounded-xl">
          <div className="flex items-center space-x-2">
            <ShieldCheck className="w-5 h-5 text-indigo-300" />
            <div>
              <p className="text-sm font-semibold text-indigo-200">Debt Fully Repaid</p>
              <p className="text-xs text-indigo-300 mt-1">
                All debt has been repaid. Health factor is not applicable when debt is zero.
              </p>
            </div>
          </div>
        </div>
      ) : null}

      <div className="bg-indigo-900/30 border border-indigo-700/50 rounded-xl p-4 mb-6">
        <div className="flex items-center space-x-2 mb-2">
          <TrendingUp className="w-5 h-5 text-indigo-300" />
          <span className="text-sm font-semibold text-white">
            Safety Buffer
          </span>
        </div>
        <div className="text-2xl font-bold text-indigo-300">
          {safetyBufferNum.toFixed(1)}%
        </div>
        <p className="text-xs text-indigo-200 mt-1">
          Price can move this much before risk increases
        </p>
      </div>

      <div className="bg-purple-900/30 border border-purple-800/40 rounded-xl p-4 mb-6">
        <div className="flex items-center space-x-2 mb-3">
          <ShieldCheck className="w-5 h-5 text-purple-200" />
          <div>
            <p className="text-sm font-semibold text-white">Protection Outcome</p>
            <p className="text-xs text-purple-300">Real-time protection calculation</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
          <div className="bg-purple-800/30 border border-purple-700/30 rounded-lg p-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-purple-300">Value Protected</span>
              <TrendingUp className="w-4 h-4 text-emerald-300" />
            </div>
            <div className="text-2xl font-bold text-white">
              {valueProtectedPct.toFixed(1)}%
            </div>
            <p className="text-[11px] text-purple-400 mt-1">
              Based on collateral vs total exposure
            </p>
          </div>

          <div className="bg-purple-800/30 border border-purple-700/30 rounded-lg p-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-purple-300">Protection Amount</span>
              <Coins className="w-4 h-4 text-indigo-300" />
            </div>
            {protectionAmountNum > 0 ? (
              <>
                <div className="text-2xl font-bold text-white">
                  {protectionAmountNum.toLocaleString('en-US', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}{' '}
                  USDC
                </div>
                <p className="text-[11px] text-purple-400 mt-1">
                  {depreciationPctNum > 0 ? `${depreciationPctNum.toFixed(2)}% depreciation` : 'No depreciation'}
                </p>
              </>
            ) : (
              <div className="text-sm text-purple-300">
                {outcomeRateNum === null ? 'Calculating...' : 'No protection needed (currency appreciated)'}
              </div>
            )}
          </div>
        </div>
        
        {/* Oracle Status */}
        <div className={`mt-3 p-3 rounded-lg border ${
          oracleIsValid 
            ? 'bg-emerald-900/20 border-emerald-700/30' 
            : 'bg-orange-900/20 border-orange-700/30'
        }`}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-white">Oracle Status</span>
            <span className={`text-xs px-2 py-1 rounded ${
              oracleIsValid 
                ? 'bg-emerald-900/50 text-emerald-200' 
                : 'bg-orange-900/50 text-orange-200'
            }`}>
              {oracleIsValid ? 'Healthy' : 'Warning'}
            </span>
          </div>
          {!oracleIsValid && oracleReason && (
            <p className="text-xs text-orange-300 mt-1">{oracleReason}</p>
          )}
          {isUsingFallback && (
            <p className="text-xs text-yellow-300 mt-1">
              ⚠️ Using fallback rate (90% of entry rate)
            </p>
          )}
        </div>
      </div>

      <div className="bg-indigo-900/30 border border-indigo-800/40 rounded-xl p-4 mb-6">
        <div className="flex items-center space-x-2 mb-3">
          <Globe2 className="w-5 h-5 text-indigo-200" />
          <div>
            <p className="text-sm font-semibold text-white">FX Info</p>
            <p className="text-xs text-indigo-300">Target currency & entry context</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="bg-indigo-800/30 border border-indigo-700/30 rounded-lg p-3">
            <div className="text-xs text-indigo-200 mb-1">Target Currency</div>
            <div className="text-lg font-semibold text-white">
              {targetCurrency ? (targetCurrency as string) : '—'}
            </div>
          </div>

          <div className="bg-indigo-800/30 border border-indigo-700/30 rounded-lg p-3">
            <div className="text-xs text-indigo-200 mb-1">Entry Time</div>
            <div className="text-sm font-semibold text-white">
              {createdAtDate
                ? createdAtDate.toLocaleString()
                : 'Not available'}
            </div>
          </div>

          <div className="bg-indigo-800/30 border border-indigo-700/30 rounded-lg p-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-indigo-200">Entry FX Rate</span>
            </div>
            <div className="text-lg font-semibold text-white">
              {entryFxRate ? `$${entryFxRate.toFixed(4)} USD` : 'Loading...'}
            </div>
          </div>

          <div className="bg-indigo-800/30 border border-indigo-700/30 rounded-lg p-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-indigo-200">Current FX Rate</span>
              {isRateStale && (
                <span className="text-[11px] px-2 py-0.5 bg-orange-900/40 text-orange-200 rounded border border-orange-700/50">
                  Stale
                </span>
              )}
            </div>
            <div className="text-lg font-semibold text-white">
              {currentFxRate ? `$${currentFxRate.toFixed(4)} USD` : 'Loading...'}
            </div>
            <p className="text-[11px] text-indigo-300 mt-1">
              {apiRate ? 'From API (real-time)' : 'From on-chain Oracle'}
              {onChainFxRate && apiRate && (
                <span className="ml-1 text-indigo-400">
                  (On-chain: ${onChainFxRate.toFixed(4)})
                </span>
              )}
            </p>
          </div>
          
        </div>

      </div>

      {/* Close/Settle Error */}
      {(closeError || settleError) && (
        <div className="mb-4 p-3 bg-purple-800/30 border border-purple-700/30 rounded-lg">
          <div className="flex items-start justify-between">
            <div className="flex items-start space-x-2 flex-1">
              <AlertCircle className="w-4 h-4 text-purple-300 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-purple-200">
                {((closeError || settleError)?.message?.toLowerCase().includes('user rejected') ||
                (closeError || settleError)?.message?.toLowerCase().includes('user denied') ||
                (closeError || settleError)?.message?.toLowerCase().includes('rejected') ||
                ((closeError || settleError) as any)?.code === 4001)
                  ? 'Transaction cancelled'
                  : (closeError || settleError)?.message || 'Transaction failed'}
              </p>
            </div>
            <button
              onClick={() => {
                resetCloseError()
                resetSettleError()
              }}
              className="text-xs text-purple-400 hover:text-purple-200 underline ml-2"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Close/Settle Success */}
      {(isClosed || isSettled) && (
        <div className="mb-4 p-4 bg-emerald-900/30 border border-emerald-700/50 rounded-xl">
          <p className="text-sm text-emerald-200 font-medium">
            {isSettled ? 'Protection settled successfully!' : 'Position closed successfully!'}
          </p>
          {isSettled && protectionAmountNum > 0 && (
            <p className="text-xs text-emerald-300 mt-1">
              Protection payout: {protectionAmountNum.toFixed(2)} USDC
            </p>
          )}
        </div>
      )}

      {/* Settlement Option */}
      {debtNum === 0 && (
        <div className="mb-4 p-3 bg-indigo-900/20 border border-indigo-700/30 rounded-xl">
          <div className="flex items-center space-x-2 mb-2">
            <input
              type="checkbox"
              id="settle-protection"
              checked={useSettleProtection}
              onChange={(e) => setUseSettleProtection(e.target.checked)}
              className="w-4 h-4 text-indigo-600 rounded"
            />
            <label htmlFor="settle-protection" className="text-sm text-indigo-200 cursor-pointer">
              Settle Protection (calculate payout if currency depreciated)
            </label>
          </div>
          <p className="text-xs text-indigo-300">
            {useSettleProtection 
              ? 'This will calculate and pay out protection if your currency depreciated. Otherwise, it will just close the position.'
              : 'Check this to settle protection and receive payout if currency depreciated'}
          </p>
        </div>
      )}

      {/* Warning if trying to close with debt */}
      {debtNum > 0 && (
        <div className="mb-4 p-4 bg-orange-900/30 border border-orange-700/50 rounded-xl">
          <div className="flex items-start space-x-2">
            <AlertCircle className="w-5 h-5 text-orange-300 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-orange-200 mb-1">
                Cannot close position with outstanding debt
              </p>
              <p className="text-xs text-orange-300">
                You have <strong>{debtNum.toFixed(2)} USDC</strong> in debt. 
                Please use "Reduce Protection" to repay your debt first before closing the position.
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="flex space-x-3">
        <button
          onClick={() => setShowReduceModal(true)}
          className="btn-secondary flex-1"
          disabled={isClosing || isSettling || isReducing || isConfirmingClose || isConfirmingSettle}
        >
          Reduce Protection
        </button>
        <button
          onClick={debtNum === 0 && useSettleProtection ? handleSettle : handleClose}
          disabled={
            debtNum > 0 || // Disable if there's debt
            isClosing || 
            isSettling || 
            isReducing || 
            isConfirmingClose || 
            isConfirmingSettle
          }
          className="flex-1 bg-gradient-to-r from-red-600 to-red-700 text-white font-semibold py-3 px-6 rounded-xl hover:from-red-700 hover:to-red-800 transition-all duration-200 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
          title={debtNum > 0 ? 'Please repay debt first using "Reduce Protection"' : ''}
        >
          {isSettling || isConfirmingSettle 
            ? 'Settling...' 
            : isClosing || isConfirmingClose 
            ? 'Closing...' 
            : debtNum === 0 && useSettleProtection
            ? 'Settle Protection'
            : debtNum > 0
            ? 'Repay Debt First'
            : 'Close Position'}
        </button>
      </div>

      {/* Reduce Protection Modal */}
      {showReduceModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-gradient-to-br from-purple-900 to-indigo-900 border border-purple-700/50 rounded-2xl p-6 max-w-md w-full mx-4 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-white">Reduce Protection</h3>
              <button
                onClick={() => {
                  setShowReduceModal(false)
                  setReduceAmount('')
                  setError('')
                }}
                className="text-purple-400 hover:text-purple-200 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {error && (
              <div className="mb-4 p-3 bg-red-900/30 border border-red-700/50 rounded-xl flex items-start space-x-2">
                <AlertCircle className="w-4 h-4 text-red-300 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-200">{error}</p>
              </div>
            )}

            {isReduced && (
              <div className="mb-4 p-3 bg-emerald-900/30 border border-emerald-700/50 rounded-xl">
                <p className="text-sm text-emerald-200 font-medium">
                  Protection reduced successfully!
                </p>
              </div>
            )}

            <div className="mb-4">
              <label className="block text-sm font-semibold text-purple-200 mb-2">
                Amount to Repay (USDC)
              </label>
              <div className="flex items-center space-x-2">
                <input
                  type="number"
                  step="0.000001"
                  min="0"
                  max={debtNum}
                  value={reduceAmount}
                  onChange={(e) => setReduceAmount(e.target.value)}
                  placeholder={`Max: ${debtNum.toFixed(6)}`}
                  className="input-field flex-1"
                  disabled={isReducing || isConfirmingReduce}
                />
                <button
                  type="button"
                  onClick={() => setReduceAmount(debtNum.toFixed(6))}
                  className="px-3 py-2 text-xs bg-purple-700/50 hover:bg-purple-700/70 text-purple-200 rounded-lg border border-purple-600/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={isReducing || isConfirmingReduce}
                >
                  Max
                </button>
              </div>
              <p className="text-xs text-purple-400 mt-1">
                Current debt: {debtNum.toFixed(6)} USDC
                {debtNum > 0 && debtNum < 0.01 && (
                  <span className="ml-2 text-orange-300">
                    (Note: Very small amounts may have precision differences)
                  </span>
                )}
              </p>
            </div>

            <div className="flex space-x-3">
              {isReduced ? (
                <button
                  onClick={() => {
                    setShowReduceModal(false)
                    setReduceAmount('')
                    setError('')
                  }}
                  className="btn-primary w-full"
                >
                  Close
                </button>
              ) : (
                <>
                  <button
                    onClick={() => {
                      setShowReduceModal(false)
                      setReduceAmount('')
                      setError('')
                    }}
                    className="btn-secondary flex-1"
                    disabled={isReducing || isConfirmingReduce}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleReduce}
                    disabled={isReducing || isConfirmingReduce || !reduceAmount}
                    className="btn-primary flex-1"
                  >
                    {isReducing || isConfirmingReduce ? 'Processing...' : 'Reduce'}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )

  function handleClose() {
    if (!routerAddress) {
      setError('Router contract not configured')
      return
    }

    // Check if there's outstanding debt
    if (debtNum > 0) {
      setError(`Cannot close position with outstanding debt. Please repay ${debtNum.toFixed(2)} USDC first using "Reduce Protection".`)
      return
    }

    setError('')
    writeClose({
      address: routerAddress,
      abi: ROUTER_ABI,
      functionName: 'closeProtection',
    })
  }

  function handleSettle() {
    if (!routerAddress) {
      setError('Router contract not configured')
      return
    }

    setError('')
    writeSettle({
      address: routerAddress,
      abi: ROUTER_ABI,
      functionName: 'settleProtection',
    })
  }

  function handleReduce() {
    if (!routerAddress) {
      setError('Router contract not configured')
      return
    }

    const amount = Number.parseFloat(reduceAmount)
    if (!amount || amount <= 0) {
      setError('Please enter a valid amount')
      return
    }

    // Convert to bigint for precise comparison (avoid floating point issues)
    const repayAmountBigInt = parseUnits(reduceAmount, 6)
    const debtBigInt = parseUnits(debtNum.toFixed(6), 6)
    
    // Allow small tolerance (0.000001 USDC) for rounding differences
    const tolerance = parseUnits('0.000001', 6)
    
    if (repayAmountBigInt > debtBigInt + tolerance) {
      setError(`Cannot repay more than current debt. Maximum: ${debtNum.toFixed(6)} USDC`)
      return
    }

    setError('')
    
    writeReduce({
      address: routerAddress,
      abi: ROUTER_ABI,
      functionName: 'reduceProtection',
      args: [repayAmountBigInt],
    })
  }
}