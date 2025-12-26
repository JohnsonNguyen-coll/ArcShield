'use client'

import { useAccount, useReadContract } from 'wagmi'
import { AlertTriangle, CheckCircle, AlertCircle, Shield, Activity, TrendingDown } from 'lucide-react'
import { formatUnits } from 'viem'

const ROUTER_ABI = [
  {
    inputs: [{ name: 'user', type: 'address' }],
    name: 'getHealthFactor',
    outputs: [{ name: '', type: 'uint256' }],
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
    inputs: [{ name: 'user', type: 'address' }],
    name: 'getPosition',
    outputs: [{ name: '', type: 'address' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'LIQUIDATION_THRESHOLD',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const

const POSITION_ABI = [
  {
    inputs: [],
    name: 'getRiskStatus',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'getSafetyBuffer',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
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
    name: 'LIQUIDATION_THRESHOLD',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'WARNING_THRESHOLD',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'STRONG_WARNING_THRESHOLD',
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
  {
    inputs: [],
    name: 'entryRate',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const

export default function HealthFactorCard() {
  const { address } = useAccount()
  const routerAddress = process.env.NEXT_PUBLIC_ARCSHIELD_ROUTER_ADDRESS as `0x${string}`

  // Check if user has position
  const { data: hasPosition } = useReadContract({
    address: address && routerAddress ? routerAddress : undefined,
    abi: ROUTER_ABI,
    functionName: 'hasPosition',
    args: address ? [address] : undefined,
    query: {
      refetchInterval: 3000,
    },
  })

  // Get position address
  const { data: positionAddress } = useReadContract({
    address: address && routerAddress && hasPosition ? routerAddress : undefined,
    abi: ROUTER_ABI,
    functionName: 'getPosition',
    args: address ? [address] : undefined,
    query: {
      refetchInterval: hasPosition ? 3000 : false,
    },
  })

  // Get health factor from router
  const { data: healthFactor } = useReadContract({
    address: address && routerAddress && hasPosition ? routerAddress : undefined,
    abi: ROUTER_ABI,
    functionName: 'getHealthFactor',
    args: address ? [address] : undefined,
    query: {
      refetchInterval: hasPosition ? 3000 : false,
    },
  })

  // Get position details (includes health factor calculated directly)
  const { data: positionDetails } = useReadContract({
    address: positionAddress ? (positionAddress as `0x${string}`) : undefined,
    abi: POSITION_ABI,
    functionName: 'getPositionDetails',
    query: {
      refetchInterval: positionAddress ? 3000 : false,
    },
  })

  // Get risk status (0=Safe, 1=Warning, 2=StrongWarning, 3=Liquidation)
  const { data: riskStatus } = useReadContract({
    address: positionAddress ? (positionAddress as `0x${string}`) : undefined,
    abi: POSITION_ABI,
    functionName: 'getRiskStatus',
    query: {
      refetchInterval: positionAddress ? 3000 : false,
    },
  })

  // Get safety buffer
  const { data: safetyBuffer } = useReadContract({
    address: positionAddress ? (positionAddress as `0x${string}`) : undefined,
    abi: POSITION_ABI,
    functionName: 'getSafetyBuffer',
    query: {
      refetchInterval: positionAddress ? 3000 : false,
    },
  })

  // Get liquidation threshold from position contract (11500 = 1.15)
  const { data: liquidationThreshold } = useReadContract({
    address: positionAddress ? (positionAddress as `0x${string}`) : undefined,
    abi: POSITION_ABI,
    functionName: 'LIQUIDATION_THRESHOLD',
  })

  // Get warning thresholds
  const { data: warningThreshold } = useReadContract({
    address: positionAddress ? (positionAddress as `0x${string}`) : undefined,
    abi: POSITION_ABI,
    functionName: 'WARNING_THRESHOLD',
  })

  const { data: strongWarningThreshold } = useReadContract({
    address: positionAddress ? (positionAddress as `0x${string}`) : undefined,
    abi: POSITION_ABI,
    functionName: 'STRONG_WARNING_THRESHOLD',
  })

  // Get oracle validation
  const { data: oracleValidation } = useReadContract({
    address: positionAddress ? (positionAddress as `0x${string}`) : undefined,
    abi: POSITION_ABI,
    functionName: 'validateOracle',
    query: {
      refetchInterval: positionAddress ? 30000 : false,
    },
  })

  // Get safe exchange rate and entry rate for fallback detection
  const { data: safeExchangeRate } = useReadContract({
    address: positionAddress ? (positionAddress as `0x${string}`) : undefined,
    abi: POSITION_ABI,
    functionName: 'getSafeExchangeRate',
    query: {
      refetchInterval: positionAddress ? 30000 : false,
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

  if (!hasPosition || healthFactor === undefined) {
    return (
      <div className="bg-gradient-to-br from-slate-900 via-purple-900/20 to-slate-900 rounded-2xl border border-purple-500/20 p-6 shadow-2xl">
        <div className="flex items-center space-x-3 mb-6">
          <div className="bg-gradient-to-br from-purple-500 to-indigo-600 p-3 rounded-xl shadow-lg">
            <Shield className="w-6 h-6 text-white" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-white">Health Factor</h3>
            <p className="text-sm text-purple-300">Position safety indicator</p>
          </div>
        </div>
        <div className="text-center py-8">
          <div className="bg-purple-500/10 rounded-xl p-6 border border-purple-500/20">
            <p className="text-5xl font-bold text-purple-600 mb-2">—</p>
            <p className="text-sm text-purple-400">No active position</p>
          </div>
        </div>
      </div>
    )
  }

  // Get collateral and debt for additional context
  const [, collateral, debt] = positionDetails as [
    `0x${string}`,
    bigint,
    bigint,
    bigint,
    bigint,
    number,
    boolean,
  ] || [undefined, BigInt(0), BigInt(0), BigInt(0), BigInt(0), 0, false]

  const collateralNum = Number(formatUnits(collateral || BigInt(0), 6))
  const debtNum = Number(formatUnits(debt || BigInt(0), 6))

  // Parse health factor (stored as 10000 = 1.0)
  // Validate health factor - if it's unreasonably large or debt is 0, it's likely invalid
  // When debt = 0, health factor calculation may be invalid (division by zero in contract)
  const hfNumRaw = healthFactor === BigInt(0) ? 0 : Number(healthFactor) / 10000
  const isValidHealthFactor = hfNumRaw > 0 && hfNumRaw < 1000 && !isNaN(hfNumRaw) && isFinite(hfNumRaw)
  const hfNum = isValidHealthFactor ? hfNumRaw : 0

  // Parse thresholds (stored as 10000 = 1.0)
  const liqThreshold = liquidationThreshold ? Number(liquidationThreshold) / 10000 : 1.15
  const warnThreshold = warningThreshold ? Number(warningThreshold) / 10000 : 1.30
  const strongWarnThreshold = strongWarningThreshold ? Number(strongWarningThreshold) / 10000 : 1.50

  // Parse safety buffer (stored as percentage * 100)
  const bufferPct = safetyBuffer ? Number(safetyBuffer) / 100 : 0

  // Parse oracle validation
  const [oracleIsValid, oracleReason] = oracleValidation as [boolean, string] ?? [true, '']
  
  // Check if using fallback rate
  const entryRateNum = entryRateRaw ? Number(entryRateRaw) / 1e8 : null
  const safeRateNum = safeExchangeRate ? Number(safeExchangeRate) / 1e8 : null
  const isUsingFallback = entryRateNum && safeRateNum ? safeRateNum < entryRateNum * 0.9 : false

  // Determine status based on thresholds from contract (only if health factor is valid)
  let statusBgColor = 'from-emerald-500 to-teal-600'
  let statusIconColor = 'text-emerald-300'
  let statusIcon = CheckCircle
  let statusText = 'Safe'
  let statusTextColor = 'text-emerald-400'
  let statusMessage = 'Your position is healthy and well-collateralized'
  let statusAlertBg = 'bg-emerald-900/20'
  let statusAlertBorder = 'border-emerald-500/30'
  let statusAlertText = 'text-emerald-200'
  let statusNumberColor = 'text-emerald-400'
  let statusBarColor = 'bg-gradient-to-r from-emerald-500 to-teal-500'
  let statusGlow = 'shadow-emerald-500/20'
  let recommendation = 'Continue monitoring your position'

  if (isValidHealthFactor) {
    if (hfNum < liqThreshold) {
      // Risk Status 3 - Liquidation Zone
      statusBgColor = 'from-red-500 to-rose-600'
      statusIconColor = 'text-red-300'
      statusIcon = AlertTriangle
      statusText = 'LIQUIDATION RISK'
      statusTextColor = 'text-red-400'
      statusMessage = '🚨 URGENT: Your position may be liquidated at any moment'
      statusAlertBg = 'bg-red-900/30'
      statusAlertBorder = 'border-red-500/50'
      statusAlertText = 'text-red-200'
      statusNumberColor = 'text-red-400'
      statusBarColor = 'bg-gradient-to-r from-red-600 to-rose-600'
      statusGlow = 'shadow-red-500/40'
      recommendation = 'Add collateral or repay debt immediately to avoid liquidation'
    } else if (hfNum < warnThreshold) {
      // Risk Status 2 - Strong Warning
      statusBgColor = 'from-orange-500 to-red-600'
      statusIconColor = 'text-orange-300'
      statusIcon = AlertTriangle
      statusText = 'STRONG WARNING'
      statusTextColor = 'text-orange-400'
      statusMessage = '⚠️ Position approaching liquidation threshold'
      statusAlertBg = 'bg-orange-900/30'
      statusAlertBorder = 'border-orange-500/40'
      statusAlertText = 'text-orange-200'
      statusNumberColor = 'text-orange-400'
      statusBarColor = 'bg-gradient-to-r from-orange-500 to-red-500'
      statusGlow = 'shadow-orange-500/30'
      recommendation = 'Consider adding collateral or reducing your debt'
    } else if (hfNum < strongWarnThreshold) {
      // Risk Status 1 - Warning
      statusBgColor = 'from-yellow-500 to-orange-600'
      statusIconColor = 'text-yellow-300'
      statusIcon = AlertCircle
      statusText = 'Warning'
      statusTextColor = 'text-yellow-400'
      statusMessage = '⚡ Monitor your position closely'
      statusAlertBg = 'bg-yellow-900/20'
      statusAlertBorder = 'border-yellow-500/30'
      statusAlertText = 'text-yellow-200'
      statusNumberColor = 'text-yellow-400'
      statusBarColor = 'bg-gradient-to-r from-yellow-500 to-orange-500'
      statusGlow = 'shadow-yellow-500/20'
      recommendation = 'Watch exchange rate movements and be ready to act'
    }
  } else if (debtNum === 0) {
    // When debt is 0, show a neutral/safe status
    statusBgColor = 'from-indigo-500 to-purple-600'
    statusIconColor = 'text-indigo-300'
    statusIcon = CheckCircle
    statusText = 'Debt Repaid'
    statusTextColor = 'text-indigo-400'
    statusNumberColor = 'text-indigo-400'
  } else {
    // Invalid health factor
    statusBgColor = 'from-orange-500 to-yellow-600'
    statusIconColor = 'text-orange-300'
    statusIcon = AlertCircle
    statusText = 'Invalid'
    statusTextColor = 'text-orange-400'
    statusNumberColor = 'text-orange-400'
  }

  const StatusIcon = statusIcon

  // Calculate health bar width (scale to 200% for better visualization) - only if valid
  const healthBarWidth = isValidHealthFactor ? Math.min((hfNum / 2.5) * 100, 100) : 0

  return (
    <div className="bg-gradient-to-br from-slate-900 via-purple-900/20 to-slate-900 rounded-2xl border border-purple-500/20 p-6 shadow-2xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-3">
          <div className={`bg-gradient-to-br ${statusBgColor} p-3 rounded-xl shadow-lg ${statusGlow}`}>
            <StatusIcon className={`w-6 h-6 ${statusIconColor}`} />
          </div>
          <div>
            <h3 className="text-xl font-bold text-white">Health Factor</h3>
            <p className={`text-sm ${statusTextColor} font-semibold`}>
              {statusText}
            </p>
          </div>
        </div>
        <div className="text-right">
          <div className="text-xs text-purple-400">Liquidation at</div>
          <div className="text-sm font-bold text-red-400">&lt; {liqThreshold.toFixed(2)}</div>
        </div>
      </div>

      {/* Main Health Factor Display */}
      <div className="mb-6">
        {isValidHealthFactor ? (
          <div className="text-center mb-4">
            <div className={`text-6xl font-bold ${statusNumberColor} mb-2 drop-shadow-lg`}>
              {hfNum.toFixed(2)}
            </div>
            <div className="text-sm text-purple-300">
              Current Health Factor
            </div>
          </div>
        ) : debtNum === 0 ? (
          <div className="text-center mb-4">
            <div className="text-5xl font-bold text-indigo-400 mb-2 drop-shadow-lg">
              N/A
            </div>
            <div className="text-sm text-purple-300">
              Debt Fully Repaid
            </div>
            <div className="text-xs text-purple-400 mt-2">
              Health factor is not applicable when debt is zero
            </div>
          </div>
        ) : (
          <div className="text-center mb-4">
            <div className="text-5xl font-bold text-orange-400 mb-2 drop-shadow-lg">
              —
            </div>
            <div className="text-sm text-purple-300">
              Invalid Health Factor
            </div>
            <div className="text-xs text-purple-400 mt-2">
              Unable to calculate health factor
            </div>
          </div>
        )}

        {/* Visual Health Bar */}
        {isValidHealthFactor && (
          <div className="relative">
            <div className="h-6 bg-slate-800/50 rounded-full overflow-hidden border border-purple-800/30 shadow-inner">
              <div
                className={`h-full transition-all duration-500 ${statusBarColor} shadow-lg`}
                style={{
                  width: `${healthBarWidth}%`,
                }}
              />
            </div>
            
            {/* Threshold Markers */}
            <div className="flex justify-between mt-2 text-xs">
              <span className="text-red-400">Liq: {liqThreshold.toFixed(2)}</span>
              <span className="text-yellow-400">Warn: {warnThreshold.toFixed(2)}</span>
              <span className="text-emerald-400">Safe: {strongWarnThreshold.toFixed(2)}+</span>
            </div>
          </div>
        )}
      </div>

      {/* Status Message */}
      {isValidHealthFactor ? (
        <div className={`${statusAlertBg} border ${statusAlertBorder} rounded-xl p-4 mb-4 shadow-lg`}>
          <p className={`text-sm ${statusAlertText} font-medium mb-2`}>
            {statusMessage}
          </p>
          <p className="text-xs text-purple-300">
            💡 {recommendation}
          </p>
        </div>
      ) : debtNum === 0 ? (
        <div className="bg-indigo-900/30 border border-indigo-500/30 rounded-xl p-4 mb-4 shadow-lg">
          <p className="text-sm text-indigo-200 font-medium mb-2">
            Debt Fully Repaid
          </p>
          <p className="text-xs text-indigo-300">
            💡 All debt has been repaid. Health factor is not applicable when debt is zero.
          </p>
        </div>
      ) : null}

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 gap-3">
        {/* Safety Buffer */}
        <div className="bg-purple-900/30 border border-purple-500/30 rounded-xl p-3">
          <div className="flex items-center space-x-2 mb-2">
            <Shield className="w-4 h-4 text-purple-300" />
            <span className="text-xs text-purple-300">Safety Buffer</span>
          </div>
          <div className="text-xl font-bold text-white">
            {bufferPct.toFixed(1)}%
          </div>
          <p className="text-xs text-purple-400 mt-1">
            Price cushion remaining
          </p>
        </div>

        {/* Collateralization Ratio */}
        <div className="bg-indigo-900/30 border border-indigo-500/30 rounded-xl p-3">
          <div className="flex items-center space-x-2 mb-2">
            <Activity className="w-4 h-4 text-indigo-300" />
            <span className="text-xs text-indigo-300">Coll. Ratio</span>
          </div>
          <div className="text-xl font-bold text-white">
            {debtNum > 0 ? ((collateralNum / debtNum) * 100).toFixed(0) : '∞'}%
          </div>
          <p className="text-xs text-indigo-400 mt-1">
            {collateralNum.toFixed(2)} / {debtNum.toFixed(2)}
          </p>
        </div>
      </div>

      {/* Oracle Status */}
      {(!oracleIsValid || isUsingFallback) && (
        <div className={`mt-4 p-3 rounded-xl border ${
          !oracleIsValid 
            ? 'bg-orange-900/30 border-orange-500/40' 
            : 'bg-yellow-900/20 border-yellow-500/30'
        }`}>
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-semibold text-white">Oracle Status</span>
            <span className={`text-xs px-2 py-0.5 rounded ${
              !oracleIsValid 
                ? 'bg-orange-900/50 text-orange-200' 
                : 'bg-yellow-900/50 text-yellow-200'
            }`}>
              {!oracleIsValid ? 'Warning' : 'Fallback Active'}
            </span>
          </div>
          {!oracleIsValid && oracleReason && (
            <p className="text-xs text-orange-300 mt-1">{oracleReason}</p>
          )}
          {isUsingFallback && (
            <p className="text-xs text-yellow-300 mt-1">
              ⚠️ Using fallback rate (90% of entry rate) - Oracle may be unavailable or stale
            </p>
          )}
        </div>
      )}

      {/* Risk Explanation */}
      <div className="mt-4 bg-indigo-900/20 border border-indigo-500/30 rounded-xl p-4">
        <div className="flex items-start space-x-3">
          <TrendingDown className="w-5 h-5 text-indigo-300 flex-shrink-0 mt-0.5" />
          <div className="text-xs text-indigo-200 space-y-1">
            <p><strong>Health Factor Formula:</strong> (Collateral × 80%) / (Debt × Exchange Rate Adjustment)</p>
            <p><strong>What affects it:</strong> Currency depreciation increases adjusted debt, lowering your health factor</p>
            <p><strong>Liquidation:</strong> Occurs when HF drops below {liqThreshold.toFixed(2)}</p>
            {isUsingFallback && (
              <p className="text-yellow-300"><strong>Note:</strong> Health factor calculated using fallback rate due to oracle issues</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}