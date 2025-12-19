'use client'

import { useEffect, useState } from 'react'
import { useReadContract } from 'wagmi'
import { RefreshCw } from 'lucide-react'
import { fetchExchangeRates, rateFrom8Decimals } from '@/lib/priceService'

const PRICE_ORACLE_ABI = [
  {
    inputs: [{ name: 'currency', type: 'string' }],
    name: 'getPrice',
    outputs: [
      { name: 'rate', type: 'uint256' },
      { name: 'isStale', type: 'bool' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
] as const

interface PriceDisplayProps {
  oracleAddress?: `0x${string}`
  currency: 'BRL' | 'MXN' | 'EUR'
}

export default function PriceDisplay({ oracleAddress, currency }: PriceDisplayProps) {
  const [apiRate, setApiRate] = useState<number | null>(null)
  const [isRefreshing, setIsRefreshing] = useState(false)

  // Read on-chain price
  const { data: onChainPrice, refetch: refetchOnChain } = useReadContract({
    address: oracleAddress,
    abi: PRICE_ORACLE_ABI,
    functionName: 'getPrice',
    args: [currency],
  })

  // Fetch API price
  const fetchApiPrice = async () => {
    setIsRefreshing(true)
    try {
      const rates = await fetchExchangeRates()
      setApiRate(rates[currency])
      // Refetch on-chain price after a delay
      setTimeout(() => {
        refetchOnChain()
      }, 1000)
    } catch (error) {
      console.error('Failed to fetch API price:', error)
    } finally {
      setIsRefreshing(false)
    }
  }

  useEffect(() => {
    if (oracleAddress) {
      fetchApiPrice()
      // Refresh every 30 seconds
      const interval = setInterval(fetchApiPrice, 30000)
      return () => clearInterval(interval)
    }
  }, [currency, oracleAddress])

  const onChainRate = onChainPrice
    ? rateFrom8Decimals((onChainPrice as [bigint, boolean])[0])
    : null
  const isStale = onChainPrice ? (onChainPrice as [bigint, boolean])[1] : false

  // Ưu tiên hiển thị giá API (real-time), nếu không có thì dùng on-chain
  const displayRate = apiRate || onChainRate || 0
  const currencyNames = {
    BRL: 'Brazilian Real',
    MXN: 'Mexican Peso',
    EUR: 'Euro',
  }

  return (
    <div className="bg-purple-800/30 border border-purple-700/30 rounded-xl p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center space-x-2">
          <span className="text-sm font-semibold text-white">
            {currencyNames[currency]}
          </span>
          {isStale && (
            <span className="text-xs px-2 py-0.5 bg-orange-900/50 text-orange-300 rounded border border-orange-700/50">
              Stale
            </span>
          )}
        </div>
        <button
          onClick={fetchApiPrice}
          disabled={isRefreshing}
          className="text-purple-400 hover:text-purple-200 transition-colors"
          title="Refresh price"
        >
          <RefreshCw
            className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`}
          />
        </button>
      </div>
      <div className="text-lg font-bold text-purple-100">
        1 {currency} = ${displayRate.toFixed(4)} USD
      </div>
    </div>
  )
}