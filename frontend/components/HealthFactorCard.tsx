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

  const { data: hasPosition } = useReadContract({
    address: address && routerAddress ? routerAddress : undefined,
    abi: ROUTER_ABI,
    functionName: 'hasPosition',
    args: address ? [address] : undefined,
  })

  const { data: positionAddress } = useReadContract({
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
  })

  const { data: healthFactor } = useReadContract({
    address: address && routerAddress && hasPosition ? routerAddress : undefined,
    abi: ROUTER_ABI,
    functionName: 'getHealthFactor',
    args: address ? [address] : undefined,
  })

  const { data: riskStatus } = useReadContract({
    address: positionAddress ? (positionAddress as `0x${string}`) : undefined,
    abi: POSITION_ABI,
    functionName: 'getRiskStatus',
  })

  const { data: safetyBuffer } = useReadContract({
    address: positionAddress ? (positionAddress as `0x${string}`) : undefined,
    abi: POSITION_ABI,
    functionName: 'getSafetyBuffer',
  })

  if (!hasPosition || healthFactor === undefined) {
    return (
      <div className="card">
        <div className="flex items-center space-x-3 mb-4">
          <div className="bg-slate-100 p-2 rounded-lg">
            <CheckCircle className="w-5 h-5 text-slate-400" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-slate-900">
              Health Factor
            </h3>
            <p className="text-xs text-slate-500">No active position</p>
          </div>
        </div>
        <div className="text-center py-4">
          <p className="text-2xl font-bold text-slate-300">—</p>
        </div>
      </div>
    )
  }

  const hfNum = healthFactor === BigInt(0) ? 0 : Number(healthFactor) / 10000
  const risk = riskStatus as number | undefined
  const buffer = safetyBuffer ? Number(safetyBuffer) / 100 : 0

  // Determine status
  let status: 'safe' | 'warning' | 'strong-warning' | 'emergency' = 'safe'
  let statusColor = 'success'
  let statusIcon = CheckCircle
  let statusText = 'Safe'
  let statusMessage = 'Your position is healthy'

  if (hfNum < 1.15) {
    status = 'emergency'
    statusColor = 'danger'
    statusIcon = AlertTriangle
    statusText = 'Emergency'
    statusMessage = 'Immediate action required'
  } else if (hfNum < 1.3) {
    status = 'strong-warning'
    statusColor = 'danger'
    statusIcon = AlertTriangle
    statusText = 'Strong Warning'
    statusMessage = 'Consider reducing position'
  } else if (hfNum < 1.5) {
    status = 'warning'
    statusColor = 'warning'
    statusIcon = AlertCircle
    statusText = 'Warning'
    statusMessage = 'Monitor your position closely'
  }

  const StatusIcon = statusIcon

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-3">
          <div className={`bg-${statusColor}-100 p-2 rounded-lg`}>
            <StatusIcon className={`w-5 h-5 text-${statusColor}-600`} />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-slate-900">
              Health Factor
            </h3>
            <p className={`text-xs text-${statusColor}-600 font-medium`}>
              {statusText}
            </p>
          </div>
        </div>
      </div>

      <div className="mb-4">
        <div className="text-center mb-2">
          <span
            className={`text-4xl font-bold text-${statusColor}-600`}
          >
            {hfNum.toFixed(2)}
          </span>
        </div>
        <div className="h-4 bg-slate-200 rounded-full overflow-hidden">
          <div
            className={`h-full transition-all duration-300 bg-${statusColor}-500`}
            style={{
              width: `${Math.min((hfNum / 2) * 100, 100)}%`,
            }}
          />
        </div>
      </div>

      <div className={`bg-${statusColor}-50 border border-${statusColor}-200 rounded-xl p-3 mb-3`}>
        <p className={`text-sm text-${statusColor}-700 font-medium`}>
          {statusMessage}
        </p>
      </div>

      <div className="bg-slate-50 rounded-xl p-3">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs text-slate-600">Safety Buffer</span>
          <span className="text-sm font-semibold text-slate-900">
            {buffer.toFixed(1)}%
          </span>
        </div>
        <p className="text-xs text-slate-500">
          Price can move {buffer.toFixed(1)}% before risk increases
        </p>
      </div>
    </div>
  )
}

