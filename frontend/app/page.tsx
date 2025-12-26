'use client'

import { ConnectButton } from '@rainbow-me/rainbowkit'
import { useAccount } from 'wagmi'
import { Shield, TrendingUp, AlertTriangle, DollarSign, Settings } from 'lucide-react'
import { useState, useEffect } from 'react'
import ProtectionPanel from '@/components/ProtectionPanel'
import PositionDashboard from '@/components/PositionDashboard'
import HealthFactorCard from '@/components/HealthFactorCard'
import CostTransparency from '@/components/CostTransparency'
import PriceDisplay from '@/components/PriceDisplay'
import Navbar from '@/components/Navbar'
import AddLiquidity from '@/components/AddLiquidity'

export default function Home() {
  const { isConnected } = useAccount()
  const [mounted, setMounted] = useState(false)
  const [activeTab, setActiveTab] = useState<'position' | 'liquidity'>('position')

  useEffect(() => {
    setMounted(true)
  }, [])

  return (
    <main className="min-h-screen relative">
      {/* Decorative Background Elements */}
      <div className="bg-decorative-1"></div>
      <div className="bg-decorative-2"></div>

      {/* Decorative Silhouette */}
      <div className="fixed top-10 right-32 opacity-20 pointer-events-none hidden lg:block">
        <svg width="120" height="80" viewBox="0 0 120 80" fill="currentColor" className="text-purple-400">
          <path d="M20,60 Q30,20 50,40 T80,30 L85,50 Q70,45 60,60 Z" />
          <circle cx="100" cy="20" r="15" opacity="0.6" />
        </svg>
      </div>

      {/* Header */}
      <header className="bg-purple-950/50 backdrop-blur-md border-b border-purple-800/50 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="bg-gradient-to-br from-purple-600 to-pink-600 p-2 rounded-xl">
                <Shield className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                  ArcShield
                </h1>
                <p className="text-xs text-purple-400">FX Protection Protocol</p>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <button className="p-2 hover:bg-purple-800/30 rounded-lg transition-colors">
                <Settings className="w-5 h-5 text-purple-300" />
              </button>
              <ConnectButton />
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 pb-8 relative z-10">
        <div className="text-center mb-12 animate-fade-in">
          <h2 className="text-5xl font-bold text-white mb-4">
            Protect Your Assets from
            <span className="bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
              {' '}Currency Risk
            </span>
          </h2>
          <p className="text-xl text-purple-300 max-w-2xl mx-auto">
            Non-custodial stablecoin FX protection using borrowed liquidity.
            Activate protection with one click, no trading required.
          </p>
        </div>

        {/* Feature Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          <div className="card hover:shadow-2xl hover:border-purple-600/50 transition-all duration-300">
            <div className="bg-purple-800/50 w-12 h-12 rounded-xl flex items-center justify-center mb-4">
              <Shield className="w-6 h-6 text-purple-300" />
            </div>
            <h3 className="text-xl font-semibold text-white mb-2">
              1-Click Protection
            </h3>
            <p className="text-purple-300">
              Activate hedge protection instantly. No complex trading, just simple
              currency risk management.
            </p>
          </div>

          <div className="card hover:shadow-2xl hover:border-purple-600/50 transition-all duration-300">
            <div className="bg-pink-900/50 w-12 h-12 rounded-xl flex items-center justify-center mb-4">
              <TrendingUp className="w-6 h-6 text-pink-300" />
            </div>
            <h3 className="text-xl font-semibold text-white mb-2">
              Smart Risk Management
            </h3>
            <p className="text-purple-300">
              Real-time health factor monitoring with automatic risk alerts to
              keep your position safe.
            </p>
          </div>

          <div className="card hover:shadow-2xl hover:border-purple-600/50 transition-all duration-300">
            <div className="bg-indigo-900/50 w-12 h-12 rounded-xl flex items-center justify-center mb-4">
              <DollarSign className="w-6 h-6 text-indigo-300" />
            </div>
            <h3 className="text-xl font-semibold text-white mb-2">
              Transparent Costs
            </h3>
            <p className="text-purple-300">
              Clear visibility into protection costs. No hidden fees, no
              surprises.
            </p>
          </div>
        </div>

        {/* Main Content */}
        {!mounted ? (
          <div className="card max-w-2xl mx-auto text-center py-12">
            <div className="bg-purple-800/50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
              <Shield className="w-8 h-8 text-purple-300" />
            </div>
            <h3 className="text-2xl font-semibold text-white mb-2">
              Loading...
            </h3>
          </div>
        ) : isConnected ? (
          <>
            {/* Navbar */}
            <Navbar activeTab={activeTab} onTabChange={setActiveTab} />

            {activeTab === 'position' ? (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left Column - Protection Panel */}
                <div className="lg:col-span-2 space-y-6">
                  <ProtectionPanel />
                  <PositionDashboard />
                </div>

                {/* Right Column - Status Cards */}
                <div className="space-y-6">
                  <HealthFactorCard />
                  <CostTransparency />
                  
                  {/* Real-time FX Rates */}
                  <div className="card">
                    <h3 className="text-lg font-semibold text-white mb-4">
                      Real-time FX Rates
                    </h3>
                    <div className="space-y-3">
                      <PriceDisplay
                        oracleAddress={process.env.NEXT_PUBLIC_PRICE_ORACLE_ADDRESS as `0x${string}`}
                        currency="BRL"
                      />
                      <PriceDisplay
                        oracleAddress={process.env.NEXT_PUBLIC_PRICE_ORACLE_ADDRESS as `0x${string}`}
                        currency="MXN"
                      />
                      <PriceDisplay
                        oracleAddress={process.env.NEXT_PUBLIC_PRICE_ORACLE_ADDRESS as `0x${string}`}
                        currency="EUR"
                      />
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left Column - Add Liquidity */}
                <div className="lg:col-span-2">
                  <AddLiquidity />
                </div>

                {/* Right Column - Info Cards */}
                <div className="space-y-6">
                  {/* Real-time FX Rates */}
                  <div className="card">
                    <h3 className="text-lg font-semibold text-white mb-4">
                      Real-time FX Rates
                    </h3>
                    <div className="space-y-3">
                      <PriceDisplay
                        oracleAddress={process.env.NEXT_PUBLIC_PRICE_ORACLE_ADDRESS as `0x${string}`}
                        currency="BRL"
                      />
                      <PriceDisplay
                        oracleAddress={process.env.NEXT_PUBLIC_PRICE_ORACLE_ADDRESS as `0x${string}`}
                        currency="MXN"
                      />
                      <PriceDisplay
                        oracleAddress={process.env.NEXT_PUBLIC_PRICE_ORACLE_ADDRESS as `0x${string}`}
                        currency="EUR"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="card max-w-2xl mx-auto text-center py-12">
            <div className="bg-purple-800/50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
              <Shield className="w-8 h-8 text-purple-300" />
            </div>
            <h3 className="text-2xl font-semibold text-white mb-2">
              Connect Your Wallet
            </h3>
            <p className="text-purple-300 mb-6">
              Connect your wallet to start protecting your assets from currency
              risk on Arc Testnet.
            </p>
            <div className="flex justify-center">
              <ConnectButton />
            </div>
          </div>
        )}
      </section>

      {/* Footer */}
      <footer className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 mt-12 border-t border-purple-800/50 relative z-10">
        <div className="text-center text-purple-400 text-sm">
          <p>
            Built on{' '}
            <a
              href="https://arc.network"
              target="_blank"
              rel="noopener noreferrer"
              className="text-purple-300 hover:text-purple-200 font-medium transition-colors"
            >
              Arc Network
            </a>
            {' '}• Testnet Only
          </p>
        </div>
      </footer>
    </main>
  )
}