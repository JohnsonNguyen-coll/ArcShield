'use client'

import { useState, useEffect } from 'react'
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useReadContract } from 'wagmi'
import { Shield, AlertCircle } from 'lucide-react'
import { parseUnits, formatUnits } from 'viem'
import ProtectionSlider from './ProtectionSlider'

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

export default function ProtectionPanel() {
  const { address, isConnected } = useAccount()
  const [collateralAmount, setCollateralAmount] = useState('')
  const [targetCurrency, setTargetCurrency] = useState('BRL')
  const [protectionLevel, setProtectionLevel] = useState<0 | 1 | 2>(1) // Medium by default
  const [error, setError] = useState('')

  const routerAddress = process.env.NEXT_PUBLIC_ARCSHIELD_ROUTER_ADDRESS as `0x${string}`

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
  const { data: hasPosition } = useReadContract({
    address: address && routerAddress ? routerAddress : undefined,
    abi: ROUTER_ABI,
    functionName: 'hasPosition',
    args: address ? [address] : undefined,
  })

  // Check USDC allowance
  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    address: address && routerAddress ? USDC_ADDRESS : undefined,
    abi: USDC_ABI,
    functionName: 'allowance',
    args: address && routerAddress ? [address, routerAddress] : undefined,
    query: {
      enabled: !!address && !!routerAddress && !!collateralAmount && parseFloat(collateralAmount) > 0,
      refetchInterval: 3000, // Refetch every 3 seconds to catch approval updates
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

  // Refetch allowance after successful approval
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
  // Hide approve button when approved successfully, even before allowance refetches
  const needsApproval = collateralNum > 0 && !hasEnoughAllowance && !isApproved

  // Check if approve error is user rejection
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

  // Check if error is user rejection
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

    // Approve max amount (1M USDC) for convenience
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

    setError('')

    try {
      // Convert USDC amount to wei (6 decimals for USDC)
      const amount = parseUnits(collateralAmount, 6)

      writeContract({
        address: routerAddress,
        abi: ROUTER_ABI,
        functionName: 'activateProtection',
        args: [amount, targetCurrency, protectionLevel],
      })
    } catch (err: any) {
      setError(err.message || 'Failed to activate protection')
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

  return (
    <div className="card">
      <div className="flex items-center space-x-3 mb-6">
        <div className="bg-primary-100 p-2 rounded-lg">
          <Shield className="w-5 h-5 text-primary-600" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-slate-900">
            Activate Protection
          </h2>
          <p className="text-sm text-slate-500">
            Protect your assets from currency risk
          </p>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-danger-50 border border-danger-200 rounded-xl flex items-start space-x-3">
          <AlertCircle className="w-5 h-5 text-danger-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-danger-700">{error}</p>
        </div>
      )}

      {writeError && (
        <div className="mb-4 p-3 bg-slate-50 border border-slate-200 rounded-lg">
          <div className="flex items-start justify-between">
            <div className="flex items-start space-x-2 flex-1">
              <AlertCircle className="w-4 h-4 text-slate-500 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-slate-700">
                {isUserRejection ? 'Đã hủy giao dịch' : 'Giao dịch thất bại'}
              </p>
            </div>
            <button
              onClick={() => resetWriteError()}
              className="text-xs text-slate-500 hover:text-slate-700 underline ml-2"
            >
              Đóng
            </button>
          </div>
        </div>
      )}

      {isSuccess && (
        <div className="mb-4 p-4 bg-success-50 border border-success-200 rounded-xl">
          <p className="text-sm text-success-700 font-medium">
            ✅ Protection activated successfully!
          </p>
        </div>
      )}

      {/* Position Already Exists Warning */}
      {hasPosition && (
        <div className="mb-4 p-4 bg-warning-50 border border-warning-200 rounded-xl flex items-start space-x-3">
          <AlertCircle className="w-5 h-5 text-warning-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-warning-900 mb-1">
              Bạn đã có một position đang active
            </p>
            <p className="text-xs text-warning-700">
              Vui lòng close position hiện tại trước khi tạo position mới. Bạn có thể close position trong phần "Your Position".
            </p>
          </div>
        </div>
      )}

      {/* Approve Error */}
      {approveError && (
        <div className="mb-4 p-3 bg-slate-50 border border-slate-200 rounded-lg">
          <div className="flex items-start justify-between">
            <div className="flex items-start space-x-2 flex-1">
              <AlertCircle className="w-4 h-4 text-slate-500 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-slate-700">
                {isApproveUserRejection ? 'Đã hủy approval' : 'Approval thất bại'}
              </p>
            </div>
            <button
              onClick={() => resetApprove()}
              className="text-xs text-slate-500 hover:text-slate-700 underline ml-2"
            >
              Đóng
            </button>
          </div>
        </div>
      )}

      <div className="space-y-6">
        {/* Collateral Amount */}
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-2">
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
          <p className="text-xs text-slate-500 mt-1">
            Amount of USDC to use as collateral
          </p>
        </div>

        {/* Target Currency */}
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-2">
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
          <label className="block text-sm font-semibold text-slate-700 mb-4">
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
                    ? 'border-primary-500 bg-primary-50'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="font-semibold text-slate-900">{level.label}</div>
                <div className="text-xs text-slate-600 mt-1">
                  LTV: {level.ltv}
                </div>
                <div className="text-xs text-slate-500 mt-1">
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

