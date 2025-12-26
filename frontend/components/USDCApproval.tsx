'use client'

import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import { parseUnits, formatUnits } from 'viem'
import { AlertCircle, CheckCircle } from 'lucide-react'
import { useState, useEffect } from 'react'

// Arc Testnet USDC address
const USDC_ADDRESS = '0x3600000000000000000000000000000000000000' as `0x${string}`

const USDC_ABI = [
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
    inputs: [{ name: 'account', type: 'address' }],
    name: 'balanceOf',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const

interface USDCApprovalProps {
  spender: `0x${string}`
  requiredAmount?: string
}

export default function USDCApproval({ spender, requiredAmount }: USDCApprovalProps) {
  const { address } = useAccount()
  const [approveAmount, setApproveAmount] = useState('')

  const { data: balance } = useReadContract({
    address: address ? USDC_ADDRESS : undefined,
    abi: USDC_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
  })

  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    address: address && spender ? USDC_ADDRESS : undefined,
    abi: USDC_ABI,
    functionName: 'allowance',
    args: address && spender ? [address, spender] : undefined,
  })

  const {
    writeContract: approve,
    data: approveHash,
    isPending: isApproving,
    error: approveError,
    reset: resetApprove,
  } = useWriteContract()

  const { isLoading: isConfirming, isSuccess: isApproved } = useWaitForTransactionReceipt({
    hash: approveHash,
  })

  // Refetch allowance after successful approval
  useEffect(() => {
    if (isApproved && refetchAllowance) {
      // Small delay to ensure blockchain state is updated
      const timer = setTimeout(() => {
        refetchAllowance()
      }, 1000)
      return () => clearTimeout(timer)
    }
  }, [isApproved, refetchAllowance])

  const balanceNum = balance ? Number(formatUnits(balance, 6)) : 0
  const allowanceNum = allowance ? Number(formatUnits(allowance, 6)) : 0
  const requiredNum = requiredAmount ? parseFloat(requiredAmount) : 0
  // Hide component if approval is successful (allowance will be updated and needsApproval becomes false)
  // Also hide immediately when isApproved is true, even before allowance refetches
  const needsApproval = requiredNum > 0 && allowanceNum < requiredNum && !isApproved

  // Check if error is user rejection
  const isUserRejection = approveError && (
    approveError.message?.toLowerCase().includes('user rejected') ||
    approveError.message?.toLowerCase().includes('user denied') ||
    approveError.message?.toLowerCase().includes('rejected') ||
    approveError.message?.toLowerCase().includes('cancelled') ||
    (approveError as any)?.code === 4001 ||
    (approveError as any)?.shortMessage?.toLowerCase().includes('rejected')
  )

  const handleApprove = () => {
    if (!spender) return

    // Approve max amount for convenience (or specific amount if provided)
    const amount = approveAmount || '1000000' // Default to 1M USDC
    const amountWei = parseUnits(amount, 6)

    approve({
      address: USDC_ADDRESS,
      abi: USDC_ABI,
      functionName: 'approve',
      args: [spender, amountWei],
    })
  }

  if (!address || !needsApproval) {
    return null
  }

  return (
    <div className="card border-warning-200 bg-warning-50">
      <div className="flex items-start space-x-3">
        <AlertCircle className="w-5 h-5 text-warning-600 flex-shrink-0 mt-0.5" />
        <div className="flex-1">
          <h3 className="text-sm font-semibold text-warning-900 mb-1">
            USDC Approval Required
          </h3>
          <p className="text-xs text-warning-700 mb-3">
            You need to approve the router contract to spend your USDC before activating
            protection.
          </p>

          {approveError && (
            <div className="mb-3 p-2 bg-slate-50 border border-slate-200 rounded-lg">
              <p className="text-xs text-slate-700">
                {isUserRejection 
                  ? 'Cancelled' 
                  : approveError.message || 'Approval failed'}
              </p>
              <button
                onClick={() => resetApprove()}
                className="text-xs text-slate-500 hover:text-slate-700 mt-1 underline"
              >
                Close
              </button>
            </div>
          )}

          {isApproved && (
            <div className="mb-3 p-2 bg-success-50 border border-success-200 rounded-lg flex items-center space-x-2">
              <CheckCircle className="w-4 h-4 text-success-600" />
              <p className="text-xs text-success-700 font-medium">
                Approval successful!
              </p>
            </div>
          )}

          <div className="space-y-2">
            <div className="text-xs text-warning-700">
              <div>Current Allowance: {allowanceNum.toFixed(2)} USDC</div>
              <div>Required: {requiredNum.toFixed(2)} USDC</div>
              <div>Balance: {balanceNum.toFixed(2)} USDC</div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-warning-900 mb-1">
                Approve Amount (USDC)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={approveAmount}
                onChange={(e) => setApproveAmount(e.target.value)}
                placeholder={requiredNum > 0 ? requiredNum.toFixed(2) : '1000000'}
                className="input-field text-sm"
                disabled={isApproving || isConfirming}
              />
              <p className="text-xs text-warning-600 mt-1">
                Leave empty to approve 1,000,000 USDC (recommended)
              </p>
            </div>

            <button
              onClick={handleApprove}
              disabled={isApproving || isConfirming || isApproved}
              className="btn-primary w-full text-sm py-2"
            >
              {isApproving || isConfirming
                ? 'Approving...'
                : isApproved
                ? 'Approved ✓'
                : 'Approve USDC'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}



