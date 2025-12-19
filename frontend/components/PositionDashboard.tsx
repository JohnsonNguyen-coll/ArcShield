'use client'

import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import { formatUnits, parseUnits } from 'viem'
import { TrendingUp, TrendingDown, X, AlertCircle } from 'lucide-react'
import { useState, useEffect } from 'react'

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
] as const

export default function PositionDashboard() {
  const { address } = useAccount()
  const routerAddress = process.env.NEXT_PUBLIC_ARCSHIELD_ROUTER_ADDRESS as `0x${string}`
  const [showReduceModal, setShowReduceModal] = useState(false)
  const [reduceAmount, setReduceAmount] = useState('')
  const [error, setError] = useState('')

  const { 
    writeContract: writeClose, 
    data: closeHash,
    isPending: isClosing,
    error: closeError,
    reset: resetCloseError,
  } = useWriteContract()
  
  const { 
    writeContract: writeReduce, 
    data: reduceHash,
    isPending: isReducing 
  } = useWriteContract()

  const { isLoading: isConfirmingClose, isSuccess: isClosed } = useWaitForTransactionReceipt({
    hash: closeHash,
  })

  const { isLoading: isConfirmingReduce, isSuccess: isReduced } = useWaitForTransactionReceipt({
    hash: reduceHash,
  })

  // Close modal when reduce is successful
  useEffect(() => {
    if (isReduced && showReduceModal) {
      const timer = setTimeout(() => {
        setShowReduceModal(false)
        setReduceAmount('')
        setError('')
      }, 2000)
      return () => clearTimeout(timer)
    }
  }, [isReduced, showReduceModal])

  const { data: hasPosition, refetch: refetchHasPosition } = useReadContract({
    address: address && routerAddress ? routerAddress : undefined,
    abi: ROUTER_ABI,
    functionName: 'hasPosition',
    args: address ? [address] : undefined,
    query: {
      refetchInterval: 3000, // Auto-refetch every 3 seconds
    },
  })

  // Refetch hasPosition after closing position
  useEffect(() => {
    if (isClosed && refetchHasPosition) {
      const timer = setTimeout(() => {
        refetchHasPosition()
      }, 2000)
      return () => clearTimeout(timer)
    }
  }, [isClosed, refetchHasPosition])

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

  const healthFactorNum = Number(healthFactor) / 10000
  const collateralNum = Number(formatUnits(collateral, 6))
  const debtNum = Number(formatUnits(debt, 6))
  const safetyBufferNum = Number(safetyBuffer) / 100

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

      {/* Close Error */}
      {closeError && (
        <div className="mb-4 p-3 bg-purple-800/30 border border-purple-700/30 rounded-lg">
          <div className="flex items-start justify-between">
            <div className="flex items-start space-x-2 flex-1">
              <AlertCircle className="w-4 h-4 text-purple-300 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-purple-200">
                {closeError.message?.toLowerCase().includes('user rejected') ||
                closeError.message?.toLowerCase().includes('user denied') ||
                closeError.message?.toLowerCase().includes('rejected') ||
                (closeError as any)?.code === 4001
                  ? 'Transaction cancelled'
                  : closeError.message || 'Failed to close position'}
              </p>
            </div>
            <button
              onClick={() => resetCloseError()}
              className="text-xs text-purple-400 hover:text-purple-200 underline ml-2"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Close Success */}
      {isClosed && (
        <div className="mb-4 p-4 bg-emerald-900/30 border border-emerald-700/50 rounded-xl">
          <p className="text-sm text-emerald-200 font-medium">
            ✅ Position closed successfully!
          </p>
        </div>
      )}

      <div className="flex space-x-3">
        <button
          onClick={() => setShowReduceModal(true)}
          className="btn-secondary flex-1"
          disabled={isClosing || isReducing || isConfirmingClose}
        >
          Reduce Protection
        </button>
        <button
          onClick={handleClose}
          disabled={isClosing || isReducing || isConfirmingClose}
          className="flex-1 bg-gradient-to-r from-red-600 to-red-700 text-white font-semibold py-3 px-6 rounded-xl hover:from-red-700 hover:to-red-800 transition-all duration-200 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isClosing || isConfirmingClose ? 'Closing...' : 'Close Position'}
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
                  ✅ Protection reduced successfully!
                </p>
              </div>
            )}

            <div className="mb-4">
              <label className="block text-sm font-semibold text-purple-200 mb-2">
                Amount to Repay (USDC)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                max={debtNum}
                value={reduceAmount}
                onChange={(e) => setReduceAmount(e.target.value)}
                placeholder={`Max: ${debtNum.toFixed(2)}`}
                className="input-field"
                disabled={isReducing || isConfirmingReduce}
              />
              <p className="text-xs text-purple-400 mt-1">
                Current debt: {debtNum.toFixed(2)} USDC
              </p>
            </div>

            <div className="flex space-x-3">
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

    setError('')
    writeClose({
      address: routerAddress,
      abi: ROUTER_ABI,
      functionName: 'closeProtection',
    })
  }

  function handleReduce() {
    if (!routerAddress) {
      setError('Router contract not configured')
      return
    }

    const amount = parseFloat(reduceAmount)
    if (!amount || amount <= 0) {
      setError('Please enter a valid amount')
      return
    }

    if (amount > debtNum) {
      setError('Cannot repay more than current debt')
      return
    }

    setError('')
    const repayAmount = parseUnits(reduceAmount, 6)

    writeReduce({
      address: routerAddress,
      abi: ROUTER_ABI,
      functionName: 'reduceProtection',
      args: [repayAmount],
    })
  }
}