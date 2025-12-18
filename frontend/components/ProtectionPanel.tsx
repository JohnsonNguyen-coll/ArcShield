'use client'

import { useState } from 'react'
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import { Shield, AlertCircle } from 'lucide-react'
import { parseUnits, formatUnits } from 'viem'
import ProtectionSlider from './ProtectionSlider'
import USDCApproval from './USDCApproval'

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
] as const

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
  } = useWriteContract()

  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  })

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
        <div className="mb-4 p-4 bg-danger-50 border border-danger-200 rounded-xl flex items-start space-x-3">
          <AlertCircle className="w-5 h-5 text-danger-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-danger-700">
            {writeError.message || 'Transaction failed'}
          </p>
        </div>
      )}

      {isSuccess && (
        <div className="mb-4 p-4 bg-success-50 border border-success-200 rounded-xl">
          <p className="text-sm text-success-700 font-medium">
            ✅ Protection activated successfully!
          </p>
        </div>
      )}

      {/* USDC Approval Check */}
      {routerAddress && collateralAmount && parseFloat(collateralAmount) > 0 && (
        <USDCApproval
          spender={routerAddress}
          requiredAmount={collateralAmount}
        />
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
            disabled={isPending || isConfirming}
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
            disabled={isPending || isConfirming}
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
            disabled={isPending || isConfirming}
          />
          <div className="mt-4 grid grid-cols-3 gap-3">
            {protectionLevels.map((level) => (
              <button
                key={level.value}
                onClick={() => setProtectionLevel(level.value as 0 | 1 | 2)}
                disabled={isPending || isConfirming}
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

        {/* Activate Button */}
        <button
          onClick={handleActivate}
          disabled={isPending || isConfirming || !isConnected}
          className="btn-primary w-full"
        >
          {isPending || isConfirming
            ? 'Processing...'
            : isSuccess
            ? 'Protection Active'
            : 'Activate Protection'}
        </button>
      </div>
    </div>
  )
}

