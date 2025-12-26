'use client'

import { useAccount, useReadContract } from 'wagmi'
import { formatUnits } from 'viem'
import { DollarSign, Info, TrendingUp, Clock, Zap } from 'lucide-react'

const ROUTER_ABI = [
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
    name: 'fundingFeeRate',
    outputs: [{ name: '', type: 'uint256' }],
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
  {
    inputs: [],
    name: 'getDebtDetails',
    outputs: [
      { name: '_principalDebt', type: 'uint256' },
      { name: '_accruedInterest', type: 'uint256' },
      { name: '_totalDebt', type: 'uint256' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'INTEREST_RATE',
    outputs: [{ name: '', type: 'uint256' }],
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
] as const

export default function CostTransparency() {
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

  // Get funding fee rate from router
  const { data: fundingFeeRate } = useReadContract({
    address: routerAddress,
    abi: ROUTER_ABI,
    functionName: 'fundingFeeRate',
  })

  // Get position details
  const { data: positionDetails } = useReadContract({
    address: positionAddress ? (positionAddress as `0x${string}`) : undefined,
    abi: POSITION_ABI,
    functionName: 'getPositionDetails',
    query: {
      refetchInterval: positionAddress ? 3000 : false,
    },
  })

  // Get debt details (principal vs interest)
  const { data: debtDetails } = useReadContract({
    address: positionAddress ? (positionAddress as `0x${string}`) : undefined,
    abi: POSITION_ABI,
    functionName: 'getDebtDetails',
    query: {
      refetchInterval: positionAddress ? 3000 : false,
    },
  })

  // Get interest rate from contract
  const { data: interestRate } = useReadContract({
    address: positionAddress ? (positionAddress as `0x${string}`) : undefined,
    abi: POSITION_ABI,
    functionName: 'INTEREST_RATE',
  })

  // Get position creation time
  const { data: createdAt } = useReadContract({
    address: positionAddress ? (positionAddress as `0x${string}`) : undefined,
    abi: POSITION_ABI,
    functionName: 'createdAt',
  })

  if (!hasPosition || !positionDetails || !debtDetails) {
    return (
      <div className="bg-gradient-to-br from-slate-900 via-purple-900/20 to-slate-900 rounded-2xl border border-purple-500/20 p-6 shadow-2xl">
        <div className="flex items-center space-x-3 mb-6">
          <div className="bg-gradient-to-br from-indigo-500 to-purple-600 p-3 rounded-xl shadow-lg">
            <DollarSign className="w-6 h-6 text-white" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-white">
              Protection Cost
            </h3>
            <p className="text-sm text-purple-300">Real-time cost breakdown</p>
          </div>
        </div>
        <div className="text-center py-8">
          <div className="bg-purple-500/10 rounded-xl p-6 border border-purple-500/20">
            <p className="text-purple-200 mb-2">No Active Position</p>
            <p className="text-sm text-purple-400">
              Activate protection to see your cost breakdown
            </p>
          </div>
        </div>
      </div>
    )
  }

  const [, collateral] = positionDetails as [
    `0x${string}`,
    bigint,
    bigint,
    bigint,
    bigint,
    number,
    boolean,
  ]

  const [principalDebt, accruedInterest, totalDebt] = debtDetails as [bigint, bigint, bigint]

  // Format values
  const collateralNum = Number(formatUnits(collateral, 6))
  const principalDebtNum = Number(formatUnits(principalDebt, 6))
  const accruedInterestNum = Number(formatUnits(accruedInterest, 6))
  const totalDebtNum = Number(formatUnits(totalDebt, 6))

  // Calculate actual APR from contract (INTEREST_RATE is in basis points, e.g., 500 = 5%)
  const actualAPR = interestRate ? Number(interestRate) / 100 : 5.0 // Default 5% if not available

  // Calculate funding fee (already paid at activation)
  const fundingFeePercentage = fundingFeeRate ? Number(fundingFeeRate) / 100 : 1.0 // Default 1%
  const fundingFeePaid = (collateralNum * fundingFeePercentage) / 100

  // Calculate time elapsed since position creation
  const now = Math.floor(Date.now() / 1000)
  const positionAge = createdAt ? now - Number(createdAt) : 0
  const daysElapsed = positionAge / 86400

  // Calculate costs
  const annualInterestCost = (principalDebtNum * actualAPR) / 100
  const dailyInterestCost = annualInterestCost / 365
  const monthlyInterestCost = annualInterestCost / 12

  // Calculate projected total cost
  const projectedMonthlyCost = monthlyInterestCost
  const projectedYearlyCost = annualInterestCost

  return (
    <div className="bg-gradient-to-br from-slate-900 via-purple-900/20 to-slate-900 rounded-2xl border border-purple-500/20 p-6 shadow-2xl">
      {/* Header */}
      <div className="flex items-center space-x-3 mb-6">
        <div className="bg-gradient-to-br from-indigo-500 to-purple-600 p-3 rounded-xl shadow-lg">
          <DollarSign className="w-6 h-6 text-white" />
        </div>
        <div>
          <h3 className="text-xl font-bold text-white">
            Protection Cost
          </h3>
          <p className="text-sm text-purple-300">Transparent fee breakdown</p>
        </div>
      </div>

      <div className="space-y-4">
        {/* Active Borrowed Amount */}
        <div className="bg-gradient-to-br from-purple-900/40 to-indigo-900/40 border border-purple-500/30 rounded-xl p-4 shadow-lg">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center space-x-2">
              <TrendingUp className="w-4 h-4 text-purple-300" />
              <span className="text-sm font-medium text-purple-200">Active Borrowed Amount</span>
            </div>
            <span className="text-lg font-bold text-white">
              {principalDebtNum.toLocaleString('en-US', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}{' '}
              USDC
            </span>
          </div>
          <div className="text-xs text-purple-400">
            Principal debt (excludes accrued interest)
          </div>
        </div>

        {/* Accrued Interest */}
        <div className="bg-gradient-to-br from-amber-900/30 to-orange-900/30 border border-amber-500/30 rounded-xl p-4 shadow-lg">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center space-x-2">
              <Clock className="w-4 h-4 text-amber-300" />
              <span className="text-sm font-medium text-amber-200">Accrued Interest</span>
            </div>
            <span className="text-lg font-bold text-white">
              {accruedInterestNum.toLocaleString('en-US', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}{' '}
              USDC
            </span>
          </div>
          <div className="text-xs text-amber-400">
            Interest accumulated over {daysElapsed.toFixed(1)} days
          </div>
        </div>

        {/* Total Current Debt */}
        <div className="bg-gradient-to-br from-rose-900/30 to-red-900/30 border border-rose-500/30 rounded-xl p-4 shadow-lg">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center space-x-2">
              <DollarSign className="w-4 h-4 text-rose-300" />
              <span className="text-sm font-medium text-rose-200">Total Current Debt</span>
            </div>
            <span className="text-xl font-bold text-white">
              {totalDebtNum.toLocaleString('en-US', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}{' '}
              USDC
            </span>
          </div>
          <div className="text-xs text-rose-400">
            Principal + Accrued Interest
          </div>
        </div>

        {/* Divider */}
        <div className="border-t border-purple-500/20 my-4"></div>

        {/* Interest Rate & Projections */}
        <div className="bg-gradient-to-br from-blue-900/30 to-cyan-900/30 border border-blue-500/30 rounded-xl p-4 shadow-lg">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center space-x-2">
              <TrendingUp className="w-4 h-4 text-blue-300" />
              <span className="text-sm font-medium text-blue-200">Interest Rate (APR)</span>
            </div>
            <span className="text-lg font-bold text-white">
              {actualAPR.toFixed(2)}%
            </span>
          </div>

          <div className="space-y-2 mt-3 pt-3 border-t border-blue-500/20">
            <div className="flex justify-between items-center">
              <span className="text-xs text-blue-300">Daily Interest Cost</span>
              <span className="text-sm font-semibold text-white">
                ~{dailyInterestCost.toFixed(4)} USDC
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs text-blue-300">Monthly Interest Cost</span>
              <span className="text-sm font-semibold text-white">
                ~{monthlyInterestCost.toFixed(2)} USDC
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs text-blue-300">Yearly Interest Cost</span>
              <span className="text-sm font-semibold text-white">
                ~{annualInterestCost.toFixed(2)} USDC
              </span>
            </div>
          </div>
        </div>

        {/* One-time Funding Fee (Already Paid) */}
        <div className="bg-gradient-to-br from-emerald-900/30 to-teal-900/30 border border-emerald-500/30 rounded-xl p-4 shadow-lg">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center space-x-2">
              <Zap className="w-4 h-4 text-emerald-300" />
              <span className="text-sm font-medium text-emerald-200">Funding Fee (Paid)</span>
            </div>
            <span className="text-lg font-bold text-white">
              {fundingFeePaid.toFixed(2)} USDC
            </span>
          </div>
          <div className="text-xs text-emerald-400">
            One-time fee ({fundingFeePercentage}% of collateral) - Already deducted at activation
          </div>
        </div>

      </div>
    </div>
  )
}