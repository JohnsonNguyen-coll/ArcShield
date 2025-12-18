'use client'

import { useAccount, useReadContract } from 'wagmi'
import { formatUnits } from 'viem'
import { DollarSign, Info } from 'lucide-react'

const ROUTER_ABI = [
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
] as const

export default function CostTransparency() {
  const { address } = useAccount()
  const routerAddress = process.env.NEXT_PUBLIC_ARCSHIELD_ROUTER_ADDRESS as `0x${string}`

  const { data: hasPosition } = useReadContract({
    address: routerAddress,
    abi: ROUTER_ABI,
    functionName: 'hasPosition',
    args: address ? [address] : undefined,
    enabled: !!address && !!routerAddress,
  })

  const { data: positionAddress } = useReadContract({
    address: routerAddress,
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
    enabled: !!address && !!routerAddress && hasPosition,
  })

  const { data: positionDetails } = useReadContract({
    address: positionAddress as `0x${string}`,
    abi: POSITION_ABI,
    functionName: 'getPositionDetails',
    enabled: !!positionAddress,
  })

  if (!hasPosition || !positionDetails) {
    return (
      <div className="card">
        <div className="flex items-center space-x-3 mb-4">
          <div className="bg-primary-100 p-2 rounded-lg">
            <DollarSign className="w-5 h-5 text-primary-600" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-slate-900">
              Protection Cost
            </h3>
            <p className="text-xs text-slate-500">No active position</p>
          </div>
        </div>
        <div className="text-center py-4">
          <p className="text-sm text-slate-500">
            Activate protection to see cost breakdown
          </p>
        </div>
      </div>
    )
  }

  const [, collateral, debt, , , level] = positionDetails as [
    `0x${string}`,
    bigint,
    bigint,
    bigint,
    bigint,
    number,
    boolean,
  ]

  const collateralNum = Number(formatUnits(collateral, 6))
  const debtNum = Number(formatUnits(debt, 6))

  // Estimated costs (simplified - in production would fetch from protocol)
  const borrowAPR = 3.5 // 3.5% annual borrow rate
  const annualBorrowCost = (debtNum * borrowAPR) / 100
  const monthlyBorrowCost = annualBorrowCost / 12
  const swapFee = debtNum * 0.001 // 0.1% swap fee

  return (
    <div className="card">
      <div className="flex items-center space-x-3 mb-4">
        <div className="bg-primary-100 p-2 rounded-lg">
          <DollarSign className="w-5 h-5 text-primary-600" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-slate-900">
            Protection Cost
          </h3>
          <p className="text-xs text-slate-500">Transparent fee breakdown</p>
        </div>
      </div>

      <div className="space-y-3">
        <div className="bg-slate-50 rounded-xl p-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm text-slate-600">Borrow Amount</span>
            <span className="text-sm font-semibold text-slate-900">
              {debtNum.toLocaleString('en-US', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}{' '}
              USDC
            </span>
          </div>
        </div>

        <div className="bg-slate-50 rounded-xl p-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm text-slate-600">Estimated Annual Cost</span>
            <span className="text-sm font-semibold text-slate-900">
              {annualBorrowCost.toLocaleString('en-US', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}{' '}
              USDC
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Based on {borrowAPR}% APR
          </p>
        </div>

        <div className="bg-slate-50 rounded-xl p-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm text-slate-600">Monthly Cost</span>
            <span className="text-sm font-semibold text-slate-900">
              {monthlyBorrowCost.toLocaleString('en-US', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}{' '}
              USDC
            </span>
          </div>
        </div>

        <div className="bg-slate-50 rounded-xl p-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm text-slate-600">Swap Fee (one-time)</span>
            <span className="text-sm font-semibold text-slate-900">
              {swapFee.toLocaleString('en-US', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}{' '}
              USDC
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">0.1% of borrow amount</p>
        </div>

        <div className="bg-primary-50 border border-primary-200 rounded-xl p-3 mt-4">
          <div className="flex items-start space-x-2">
            <Info className="w-4 h-4 text-primary-600 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-primary-700">
              These are estimated costs. Actual costs may vary based on market
              conditions and protocol parameters.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

