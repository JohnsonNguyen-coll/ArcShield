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
  })

  // Refetch hasPosition after closing position
  useEffect(() => {
    if (isClosed && refetchHasPosition) {
      const timer = setTimeout(() => {
        refetchHasPosition()
      }, 2000) // Wait for blockchain to update
      return () => clearTimeout(timer)
    }
  }, [isClosed, refetchHasPosition])

  const { data: positionAddress } = useReadContract({
    address: address && routerAddress && hasPosition ? routerAddress : undefined,
    abi: ROUTER_ABI,
    functionName: 'getPosition',
    args: address ? [address] : undefined,
  })

  const { data: positionDetails } = useReadContract({
    address: positionAddress ? (positionAddress as `0x${string}`) : undefined,
    abi: POSITION_ABI,
    functionName: 'getPositionDetails',
  })

  if (!hasPosition || !positionDetails) {
    return (
      <div className="card">
        <div className="text-center py-8">
          <p className="text-slate-500">No active position</p>
          <p className="text-sm text-slate-400 mt-2">
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
  const levelColors = ['success', 'warning', 'danger']

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-slate-900">Your Position</h2>
        <span
          className={`px-3 py-1 rounded-full text-xs font-semibold bg-${levelColors[level]}-100 text-${levelColors[level]}-700`}
        >
          {levelNames[level]} Protection
        </span>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-slate-50 rounded-xl p-4">
          <div className="text-sm text-slate-600 mb-1">Collateral</div>
          <div className="text-2xl font-bold text-slate-900">
            {collateralNum.toLocaleString('en-US', {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </div>
          <div className="text-xs text-slate-500 mt-1">USDC</div>
        </div>

        <div className="bg-slate-50 rounded-xl p-4">
          <div className="text-sm text-slate-600 mb-1">Debt</div>
          <div className="text-2xl font-bold text-slate-900">
            {debtNum.toLocaleString('en-US', {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </div>
          <div className="text-xs text-slate-500 mt-1">USDC</div>
        </div>
      </div>

      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-semibold text-slate-700">
            Health Factor
          </span>
          <span
            className={`text-lg font-bold ${
              healthFactorNum >= 1.5
                ? 'text-success-600'
                : healthFactorNum >= 1.3
                ? 'text-warning-600'
                : healthFactorNum >= 1.15
                ? 'text-danger-600'
                : 'text-danger-700'
            }`}
          >
            {healthFactorNum.toFixed(2)}
          </span>
        </div>
        <div className="h-3 bg-slate-200 rounded-full overflow-hidden">
          <div
            className={`h-full transition-all duration-300 ${
              healthFactorNum >= 1.5
                ? 'bg-success-500'
                : healthFactorNum >= 1.3
                ? 'bg-warning-500'
                : healthFactorNum >= 1.15
                ? 'bg-danger-500'
                : 'bg-danger-700'
            }`}
            style={{ width: `${Math.min((healthFactorNum / 2) * 100, 100)}%` }}
          />
        </div>
      </div>

      <div className="bg-primary-50 border border-primary-200 rounded-xl p-4 mb-6">
        <div className="flex items-center space-x-2 mb-2">
          <TrendingUp className="w-5 h-5 text-primary-600" />
          <span className="text-sm font-semibold text-primary-900">
            Safety Buffer
          </span>
        </div>
        <div className="text-2xl font-bold text-primary-700">
          {safetyBufferNum.toFixed(1)}%
        </div>
        <p className="text-xs text-primary-600 mt-1">
          Price can move this much before risk increases
        </p>
      </div>

      {/* Close Error */}
      {closeError && (
        <div className="mb-4 p-3 bg-slate-50 border border-slate-200 rounded-lg">
          <div className="flex items-start justify-between">
            <div className="flex items-start space-x-2 flex-1">
              <AlertCircle className="w-4 h-4 text-slate-500 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-slate-700">
                {closeError.message?.toLowerCase().includes('user rejected') ||
                closeError.message?.toLowerCase().includes('user denied') ||
                closeError.message?.toLowerCase().includes('rejected') ||
                (closeError as any)?.code === 4001
                  ? 'Đã hủy giao dịch'
                  : closeError.message || 'Close position thất bại'}
              </p>
            </div>
            <button
              onClick={() => resetCloseError()}
              className="text-xs text-slate-500 hover:text-slate-700 underline ml-2"
            >
              Đóng
            </button>
          </div>
        </div>
      )}

      {/* Close Success */}
      {isClosed && (
        <div className="mb-4 p-4 bg-success-50 border border-success-200 rounded-xl">
          <p className="text-sm text-success-700 font-medium">
            ✅ Position đã được close thành công!
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
          className="btn-primary flex-1 bg-danger-600 hover:bg-danger-700"
        >
          {isClosing || isConfirmingClose ? 'Closing...' : 'Close Position'}
        </button>
      </div>

      {/* Reduce Protection Modal */}
      {showReduceModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full mx-4 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-slate-900">Reduce Protection</h3>
              <button
                onClick={() => {
                  setShowReduceModal(false)
                  setReduceAmount('')
                  setError('')
                }}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {error && (
              <div className="mb-4 p-3 bg-danger-50 border border-danger-200 rounded-xl flex items-start space-x-2">
                <AlertCircle className="w-4 h-4 text-danger-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-danger-700">{error}</p>
              </div>
            )}

            <div className="mb-4">
              <label className="block text-sm font-semibold text-slate-700 mb-2">
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
              <p className="text-xs text-slate-500 mt-1">
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

    // Modal will close when isReduced becomes true (handled by useEffect)
  }
}

