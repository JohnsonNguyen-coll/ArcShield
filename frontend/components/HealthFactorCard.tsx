'use client'

import { useAccount, useReadContract } from 'wagmi'
import { AlertTriangle, CheckCircle, AlertCircle } from 'lucide-react'
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
] as const

export default function HealthFactorCard() {
  const { address } = useAccount()
  const routerAddress = process.env.NEXT_PUBLIC_ARCSHIELD_ROUTER_ADDRESS as `0x${string}`

  const { data: hasPosition, refetch: refetchHasPosition } = useReadContract({
    address: address && routerAddress ? routerAddress : undefined,
    abi: ROUTER_ABI,
    functionName: 'hasPosition',
    args: address ? [address] : undefined,
    query: {
      refetchInterval: 3000, // Auto-refetch every 3 seconds
    },
  })

  const { data: positionAddress, refetch: refetchPositionAddress } = useReadContract({
    address: address && routerAddress && hasPosition ? routerAddress : undefined,
    abi: [
      {
        inputs: [{ name: 'user', type: 'address' }],
        name: 'getPosition',
        outputs: [{ name: '', type: 'address' }],
        stateMutability: 'view',
        type: 'function',
      },
    ],
    functionName: 'getPosition',
    args: address ? [address] : undefined,
    query: {
      refetchInterval: hasPosition ? 3000 : false, // Auto-refetch every 3 seconds if has position
    },
  })

  const { data: healthFactor, refetch: refetchHealthFactor } = useReadContract({
    address: address && routerAddress && hasPosition ? routerAddress : undefined,
    abi: ROUTER_ABI,
    functionName: 'getHealthFactor',
    args: address ? [address] : undefined,
    query: {
      refetchInterval: hasPosition ? 3000 : false, // Auto-refetch every 3 seconds if has position
    },
  })

  const { data: riskStatus, refetch: refetchRiskStatus } = useReadContract({
    address: positionAddress ? (positionAddress as `0x${string}`) : undefined,
    abi: POSITION_ABI,
    functionName: 'getRiskStatus',
    query: {
      refetchInterval: positionAddress ? 3000 : false, // Auto-refetch every 3 seconds if has position
    },
  })

  const { data: safetyBuffer, refetch: refetchSafetyBuffer } = useReadContract({
    address: positionAddress ? (positionAddress as `0x${string}`) : undefined,
    abi: POSITION_ABI,
    functionName: 'getSafetyBuffer',
    query: {
      refetchInterval: positionAddress ? 3000 : false, // Auto-refetch every 3 seconds if has position
    },
  })

  if (!hasPosition || healthFactor === undefined) {
    return (
      <div className="card">
        <div className="flex items-center space-x-3 mb-4">
          <div className="bg-purple-800/50 p-2 rounded-lg">
            <CheckCircle className="w-5 h-5 text-purple-400" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">
              Health Factor
            </h3>
            <p className="text-xs text-purple-400">No active position</p>
          </div>
        </div>
        <div className="text-center py-4">
          <p className="text-2xl font-bold text-purple-600">—</p>
        </div>
      </div>
    )
  }

  const hfNum = healthFactor === BigInt(0) ? 0 : Number(healthFactor) / 10000
  const risk = riskStatus as number | undefined
  const buffer = safetyBuffer ? Number(safetyBuffer) / 100 : 0

  // Determine status with proper color classes
  let statusBgColor = 'bg-emerald-900/50'
  let statusIconColor = 'text-emerald-300'
  let statusIcon = CheckCircle
  let statusText = 'Safe'
  let statusTextColor = 'text-emerald-400'
  let statusMessage = 'Your position is healthy'
  let statusAlertBg = 'bg-emerald-900/30'
  let statusAlertBorder = 'border-emerald-700/50'
  let statusAlertText = 'text-emerald-200'
  let statusNumberColor = 'text-emerald-400'
  let statusBarColor = 'bg-emerald-500'

  if (hfNum < 1.15) {
    statusBgColor = 'bg-red-900/50'
    statusIconColor = 'text-red-300'
    statusIcon = AlertTriangle
    statusText = 'Emergency'
    statusTextColor = 'text-red-400'
    statusMessage = 'Immediate action required'
    statusAlertBg = 'bg-red-900/30'
    statusAlertBorder = 'border-red-700/50'
    statusAlertText = 'text-red-200'
    statusNumberColor = 'text-red-400'
    statusBarColor = 'bg-red-500'
  } else if (hfNum < 1.3) {
    statusBgColor = 'bg-red-900/50'
    statusIconColor = 'text-red-300'
    statusIcon = AlertTriangle
    statusText = 'Strong Warning'
    statusTextColor = 'text-red-400'
    statusMessage = 'Consider reducing position'
    statusAlertBg = 'bg-red-900/30'
    statusAlertBorder = 'border-red-700/50'
    statusAlertText = 'text-red-200'
    statusNumberColor = 'text-red-400'
    statusBarColor = 'bg-red-500'
  } else if (hfNum < 1.5) {
    statusBgColor = 'bg-orange-900/50'
    statusIconColor = 'text-orange-300'
    statusIcon = AlertCircle
    statusText = 'Warning'
    statusTextColor = 'text-orange-400'
    statusMessage = 'Monitor your position closely'
    statusAlertBg = 'bg-orange-900/30'
    statusAlertBorder = 'border-orange-700/50'
    statusAlertText = 'text-orange-200'
    statusNumberColor = 'text-orange-400'
    statusBarColor = 'bg-orange-500'
  }

  const StatusIcon = statusIcon

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-3">
          <div className={`${statusBgColor} p-2 rounded-lg`}>
            <StatusIcon className={`w-5 h-5 ${statusIconColor}`} />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">
              Health Factor
            </h3>
            <p className={`text-xs ${statusTextColor} font-medium`}>
              {statusText}
            </p>
          </div>
        </div>
      </div>

      <div className="mb-4">
        <div className="text-center mb-2">
          <span className={`text-4xl font-bold ${statusNumberColor}`}>
            {hfNum.toFixed(2)}
          </span>
        </div>
        <div className="h-4 bg-purple-950/50 rounded-full overflow-hidden border border-purple-800/30">
          <div
            className={`h-full transition-all duration-300 ${statusBarColor}`}
            style={{
              width: `${Math.min((hfNum / 2) * 100, 100)}%`,
            }}
          />
        </div>
      </div>

      <div className={`${statusAlertBg} border ${statusAlertBorder} rounded-xl p-3 mb-3`}>
        <p className={`text-sm ${statusAlertText} font-medium`}>
          {statusMessage}
        </p>
      </div>

      <div className="bg-purple-800/30 border border-purple-700/30 rounded-xl p-3">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs text-purple-300">Safety Buffer</span>
          <span className="text-sm font-semibold text-white">
            {buffer.toFixed(1)}%
          </span>
        </div>
        <p className="text-xs text-purple-400">
          Price can move {buffer.toFixed(1)}% before risk increases
        </p>
      </div>
    </div>
  )
}