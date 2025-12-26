'use client'

import { useState, useEffect } from 'react'
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useReadContract } from 'wagmi'
import { Coins, AlertCircle, TrendingUp, Lock, CheckCircle } from 'lucide-react'
import { parseUnits, formatUnits } from 'viem'

const USDC_ADDRESS = '0x3600000000000000000000000000000000000000' as `0x${string}`

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
  {
    inputs: [{ name: 'account', type: 'address' }],
    name: 'balanceOf',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const

const FUNDING_POOL_ABI = [
  {
    inputs: [{ name: 'amount', type: 'uint256' }],
    name: 'lpDeposit',
    outputs: [{ name: 'shares', type: 'uint256' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [],
    name: 'minLPDeposit',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'lpLockPeriod',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'lpFeeShare',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'totalLPShares',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'totalLPCapital',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'totalFunds',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'availableFunds',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: 'lpAddress', type: 'address' }],
    name: 'getLPPosition',
    outputs: [
      { name: 'shares', type: 'uint256' },
      { name: 'depositTime', type: 'uint256' },
      { name: 'currentValue', type: 'uint256' },
      { name: 'canWithdraw', type: 'bool' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'calculateCurrentLPCapital',
    outputs: [{ name: 'currentCapital', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const

const ROUTER_ABI = [
  {
    inputs: [],
    name: 'fundingPool',
    outputs: [{ name: '', type: 'address' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const

export default function AddLiquidity() {
  const { address, isConnected } = useAccount()
  const [amount, setAmount] = useState('')
  const [error, setError] = useState('')

  const routerAddress = process.env.NEXT_PUBLIC_ARCSHIELD_ROUTER_ADDRESS as `0x${string}`
  
  // Get funding pool address from router if not in env
  const { data: fundingPoolFromRouter } = useReadContract({
    address: routerAddress,
    abi: ROUTER_ABI,
    functionName: 'fundingPool',
  })

  const fundingPoolAddress = (process.env.NEXT_PUBLIC_FUNDING_POOL_ADDRESS as `0x${string}`) || 
    (fundingPoolFromRouter as `0x${string}` | undefined)

  // Read pool information
  const { data: minLPDeposit } = useReadContract({
    address: fundingPoolAddress,
    abi: FUNDING_POOL_ABI,
    functionName: 'minLPDeposit',
  })

  const { data: lpLockPeriod } = useReadContract({
    address: fundingPoolAddress,
    abi: FUNDING_POOL_ABI,
    functionName: 'lpLockPeriod',
  })

  const { data: lpFeeShare } = useReadContract({
    address: fundingPoolAddress,
    abi: FUNDING_POOL_ABI,
    functionName: 'lpFeeShare',
  })

  const { data: totalLPShares } = useReadContract({
    address: fundingPoolAddress,
    abi: FUNDING_POOL_ABI,
    functionName: 'totalLPShares',
    query: {
      refetchInterval: 5000,
    },
  })

  const { data: totalLPCapital } = useReadContract({
    address: fundingPoolAddress,
    abi: FUNDING_POOL_ABI,
    functionName: 'totalLPCapital',
    query: {
      refetchInterval: 5000,
    },
  })

  const { data: totalFunds } = useReadContract({
    address: fundingPoolAddress,
    abi: FUNDING_POOL_ABI,
    functionName: 'totalFunds',
    query: {
      refetchInterval: 5000,
    },
  })

  const { data: availableFunds } = useReadContract({
    address: fundingPoolAddress,
    abi: FUNDING_POOL_ABI,
    functionName: 'availableFunds',
    query: {
      refetchInterval: 5000,
    },
  })

  // Read user's LP position
  const { data: lpPosition, refetch: refetchLPPosition } = useReadContract({
    address: address && fundingPoolAddress ? fundingPoolAddress : undefined,
    abi: FUNDING_POOL_ABI,
    functionName: 'getLPPosition',
    args: address ? [address] : undefined,
    query: {
      refetchInterval: 5000,
    },
  })

  // Read USDC balance
  const { data: usdcBalance } = useReadContract({
    address: address ? USDC_ADDRESS : undefined,
    abi: USDC_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: {
      refetchInterval: 3000,
    },
  })

  // Check USDC allowance
  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    address: address && fundingPoolAddress ? USDC_ADDRESS : undefined,
    abi: USDC_ABI,
    functionName: 'allowance',
    args: address && fundingPoolAddress ? [address, fundingPoolAddress] : undefined,
    query: {
      enabled: !!address && !!fundingPoolAddress && !!amount && parseFloat(amount) > 0,
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

  // Deposit liquidity
  const {
    writeContract: depositLiquidity,
    data: depositHash,
    isPending: isDepositing,
    error: depositError,
    reset: resetDeposit,
  } = useWriteContract()

  const { isLoading: isDepositingConfirming, isSuccess: isDeposited } = useWaitForTransactionReceipt({
    hash: depositHash,
  })

  useEffect(() => {
    if (isDeposited && refetchLPPosition) {
      const timer = setTimeout(() => {
        refetchLPPosition()
        setAmount('')
        setError('')
      }, 2000)
      return () => clearTimeout(timer)
    }
  }, [isDeposited, refetchLPPosition])

  const allowanceNum = allowance ? Number(formatUnits(allowance, 6)) : 0
  const amountNum = amount ? parseFloat(amount) : 0
  const hasEnoughAllowance = amountNum > 0 && allowanceNum >= amountNum
  const needsApproval = amountNum > 0 && !hasEnoughAllowance && !isApproved

  const minDepositNum = minLPDeposit ? Number(formatUnits(minLPDeposit, 6)) : 0
  const lockPeriodDays = lpLockPeriod ? Number(lpLockPeriod) / (24 * 60 * 60) : 0
  const feeSharePercent = lpFeeShare ? Number(lpFeeShare) / 100 : 0

  const usdcBalanceNum = usdcBalance ? Number(formatUnits(usdcBalance, 6)) : 0
  const totalLPSharesNum = totalLPShares ? Number(formatUnits(totalLPShares, 18)) : 0
  const totalLPCapitalNum = totalLPCapital ? Number(formatUnits(totalLPCapital, 6)) : 0
  const totalFundsNum = totalFunds ? Number(formatUnits(totalFunds, 6)) : 0
  const availableFundsNum = availableFunds ? Number(formatUnits(availableFunds, 6)) : 0

  // Parse LP position
  const [userShares, depositTime, currentValue, canWithdraw] = lpPosition as [bigint, bigint, bigint, boolean] ?? [
    BigInt(0),
    BigInt(0),
    BigInt(0),
    false,
  ]
  const userSharesNum = userShares ? Number(formatUnits(userShares, 18)) : 0
  const currentValueNum = currentValue ? Number(formatUnits(currentValue, 6)) : 0
  const depositDate = depositTime && Number(depositTime) > 0 ? new Date(Number(depositTime) * 1000) : null
  const unlockDate = depositTime && Number(depositTime) > 0 && lpLockPeriod
    ? new Date((Number(depositTime) + Number(lpLockPeriod)) * 1000)
    : null

  const isApproveUserRejection = approveError && (
    approveError.message?.toLowerCase().includes('user rejected') ||
    approveError.message?.toLowerCase().includes('user denied') ||
    approveError.message?.toLowerCase().includes('rejected') ||
    (approveError as any)?.code === 4001
  )

  const isDepositUserRejection = depositError && (
    depositError.message?.toLowerCase().includes('user rejected') ||
    depositError.message?.toLowerCase().includes('user denied') ||
    depositError.message?.toLowerCase().includes('rejected') ||
    (depositError as any)?.code === 4001
  )

  const handleApprove = () => {
    if (!fundingPoolAddress) return
    const approveAmount = parseUnits('1000000', 6) // Approve 1M USDC
    approveUSDC({
      address: USDC_ADDRESS,
      abi: USDC_ABI,
      functionName: 'approve',
      args: [fundingPoolAddress, approveAmount],
    })
  }

  const handleDeposit = () => {
    if (!isConnected || !address) {
      setError('Please connect your wallet')
      return
    }

    if (!amount || parseFloat(amount) <= 0) {
      setError('Please enter a valid amount')
      return
    }

    if (parseFloat(amount) < minDepositNum) {
      setError(`Minimum deposit is ${minDepositNum.toFixed(2)} USDC`)
      return
    }

    if (parseFloat(amount) > usdcBalanceNum) {
      setError('Insufficient USDC balance')
      return
    }

    if (!fundingPoolAddress) {
      setError('Funding pool contract not configured')
      return
    }

    setError('')

    try {
      const depositAmount = parseUnits(amount, 6)
      depositLiquidity({
        address: fundingPoolAddress,
        abi: FUNDING_POOL_ABI,
        functionName: 'lpDeposit',
        args: [depositAmount],
      })
    } catch (err: any) {
      setError(err.message || 'Failed to deposit liquidity')
    }
  }

  return (
    <div className="space-y-6">
      {/* Pool Overview */}
      <div className="card">
        <div className="flex items-center space-x-3 mb-6">
          <div className="bg-purple-800/50 p-2 rounded-lg">
            <Coins className="w-5 h-5 text-purple-300" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-white">Funding Pool</h2>
            <p className="text-sm text-purple-400">Add liquidity and earn fees</p>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-purple-800/30 border border-purple-700/30 rounded-xl p-4">
            <div className="text-sm text-purple-300 mb-1">Total Funds</div>
            <div className="text-xl font-bold text-white">
              {totalFundsNum.toLocaleString('en-US', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </div>
            <div className="text-xs text-purple-400 mt-1">USDC</div>
          </div>

          <div className="bg-purple-800/30 border border-purple-700/30 rounded-xl p-4">
            <div className="text-sm text-purple-300 mb-1">Available</div>
            <div className="text-xl font-bold text-white">
              {availableFundsNum.toLocaleString('en-US', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </div>
            <div className="text-xs text-purple-400 mt-1">USDC</div>
          </div>

          <div className="bg-purple-800/30 border border-purple-700/30 rounded-xl p-4">
            <div className="text-sm text-purple-300 mb-1">LP Capital</div>
            <div className="text-xl font-bold text-white">
              {totalLPCapitalNum.toLocaleString('en-US', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </div>
            <div className="text-xs text-purple-400 mt-1">USDC</div>
          </div>

          <div className="bg-purple-800/30 border border-purple-700/30 rounded-xl p-4">
            <div className="text-sm text-purple-300 mb-1">LP Fee Share</div>
            <div className="text-xl font-bold text-white">
              {lpFeeShare ? (Number(lpFeeShare) / 100).toFixed(1) : '0.0'}%
            </div>
            <div className="text-xs text-purple-400 mt-1">of fees</div>
          </div>
        </div>
      </div>

      {/* Add Liquidity Form */}
      <div className="card">
        <div className="flex items-center space-x-3 mb-6">
          <div className="bg-indigo-800/50 p-2 rounded-lg">
            <TrendingUp className="w-5 h-5 text-indigo-300" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-white">Add Liquidity</h2>
            <p className="text-sm text-purple-400">Deposit USDC to earn fees from protection</p>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-4 bg-red-900/30 border border-red-700/50 rounded-xl flex items-start space-x-3">
            <AlertCircle className="w-5 h-5 text-red-300 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-200">{error}</p>
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

        {depositError && (
          <div className="mb-4 p-3 bg-purple-800/30 border border-purple-700/30 rounded-lg">
            <div className="flex items-start justify-between">
              <div className="flex items-start space-x-2 flex-1">
                <AlertCircle className="w-4 h-4 text-purple-300 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-purple-200">
                  {isDepositUserRejection ? 'Transaction cancelled' : depositError.message || 'Transaction failed'}
                </p>
              </div>
              <button
                onClick={() => resetDeposit()}
                className="text-xs text-purple-400 hover:text-purple-200 underline ml-2"
              >
                Close
              </button>
            </div>
          </div>
        )}

        {isDeposited && (
          <div className="mb-4 p-4 bg-emerald-900/30 border border-emerald-700/50 rounded-xl">
            <p className="text-sm text-emerald-200 font-medium">
              Liquidity deposited successfully!
            </p>
          </div>
        )}

        <div className="space-y-6">
          {/* Pool Info */}
          <div className="bg-indigo-900/30 border border-indigo-700/50 rounded-xl p-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <div className="text-xs text-indigo-300 mb-1">Minimum Deposit</div>
                <div className="text-lg font-semibold text-white">
                  {minDepositNum.toFixed(2)} USDC
                </div>
              </div>
              <div>
                <div className="text-xs text-indigo-300 mb-1">Lock Period</div>
                <div className="text-lg font-semibold text-white">
                  {lockPeriodDays.toFixed(0)} days
                </div>
              </div>
            </div>
          </div>

          {/* Amount Input */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-semibold text-purple-200">
                Deposit Amount (USDC)
              </label>
              <span className="text-xs text-purple-400">
                Balance: {usdcBalanceNum.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDC
              </span>
            </div>
            <input
              type="number"
              step="0.01"
              min="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder={`Min: ${minDepositNum.toFixed(2)}`}
              className="input-field"
              disabled={isDepositing || isDepositingConfirming}
            />
            <p className="text-xs text-purple-400 mt-1">
              Minimum deposit: {minDepositNum.toFixed(2)} USDC
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3">
            {needsApproval && (
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
              onClick={handleDeposit}
              disabled={
                isDepositing ||
                isDepositingConfirming ||
                !isConnected ||
                needsApproval ||
                !amount ||
                parseFloat(amount) <= 0
              }
              className={`${needsApproval ? 'flex-1' : 'w-full'} btn-primary`}
            >
              {isDepositing || isDepositingConfirming
                ? 'Depositing...'
                : isDeposited
                ? 'Deposited ✓'
                : 'Deposit Liquidity'}
            </button>
          </div>
        </div>
      </div>

      {/* User's LP Position */}
      {userSharesNum > 0 && (
        <div className="card">
          <div className="flex items-center space-x-3 mb-6">
            <div className="bg-emerald-800/50 p-2 rounded-lg">
              <CheckCircle className="w-5 h-5 text-emerald-300" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white">Your LP Position</h2>
              <p className="text-sm text-purple-400">Your liquidity provider position</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div className="bg-purple-800/30 border border-purple-700/30 rounded-xl p-4">
              <div className="text-sm text-purple-300 mb-1">Your Shares</div>
              <div className="text-2xl font-bold text-white">
                {userSharesNum.toLocaleString('en-US', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </div>
            </div>

            <div className="bg-purple-800/30 border border-purple-700/30 rounded-xl p-4">
              <div className="text-sm text-purple-300 mb-1">Current Value</div>
              <div className="text-2xl font-bold text-white">
                {currentValueNum.toLocaleString('en-US', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </div>
              <div className="text-xs text-purple-400 mt-1">USDC</div>
            </div>
          </div>

          <div className="bg-indigo-900/30 border border-indigo-700/50 rounded-xl p-4">
            <div className="flex items-center space-x-2 mb-3">
              <Lock className="w-5 h-5 text-indigo-300" />
              <span className="text-sm font-semibold text-white">Lock Information</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <div className="text-xs text-indigo-300 mb-1">Deposit Date</div>
                <div className="text-sm font-semibold text-white">
                  {depositDate ? depositDate.toLocaleString() : '—'}
                </div>
              </div>
              <div>
                <div className="text-xs text-indigo-300 mb-1">Unlock Date</div>
                <div className="text-sm font-semibold text-white">
                  {unlockDate ? unlockDate.toLocaleString() : '—'}
                </div>
              </div>
            </div>
            <div className="mt-3 pt-3 border-t border-indigo-700/30">
              <div className="flex items-center justify-between">
                <span className="text-xs text-indigo-300">Withdrawal Status</span>
                <span
                  className={`text-xs px-2 py-1 rounded ${
                    canWithdraw
                      ? 'bg-emerald-900/50 text-emerald-200'
                      : 'bg-orange-900/50 text-orange-200'
                  }`}
                >
                  {canWithdraw ? 'Unlocked' : 'Locked'}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

