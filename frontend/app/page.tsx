'use client'

import { ConnectButton } from '@rainbow-me/rainbowkit'
import { useAccount } from 'wagmi'
import { Shield, TrendingUp, AlertTriangle, DollarSign } from 'lucide-react'
import ProtectionPanel from '@/components/ProtectionPanel'
import PositionDashboard from '@/components/PositionDashboard'
import HealthFactorCard from '@/components/HealthFactorCard'
import CostTransparency from '@/components/CostTransparency'

export default function Home() {
  const { isConnected } = useAccount()

  return (
    <main className="min-h-screen">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-md border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="bg-gradient-to-br from-primary-600 to-primary-800 p-2 rounded-xl">
                <Shield className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-primary-600 to-primary-800 bg-clip-text text-transparent">
                  ArcShield
                </h1>
                <p className="text-xs text-slate-500">FX Protection Protocol</p>
              </div>
            </div>
            <ConnectButton />
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 pb-8">
        <div className="text-center mb-12 animate-fade-in">
          <h2 className="text-5xl font-bold text-slate-900 mb-4">
            Protect Your Assets from
            <span className="bg-gradient-to-r from-primary-600 to-primary-800 bg-clip-text text-transparent">
              {' '}Currency Risk
            </span>
          </h2>
          <p className="text-xl text-slate-600 max-w-2xl mx-auto">
            Non-custodial stablecoin FX protection using borrowed liquidity.
            Activate protection with one click, no trading required.
          </p>
        </div>

        {/* Feature Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          <div className="card hover:shadow-xl transition-shadow duration-300">
            <div className="bg-primary-100 w-12 h-12 rounded-xl flex items-center justify-center mb-4">
              <Shield className="w-6 h-6 text-primary-600" />
            </div>
            <h3 className="text-xl font-semibold text-slate-900 mb-2">
              1-Click Protection
            </h3>
            <p className="text-slate-600">
              Activate hedge protection instantly. No complex trading, just simple
              currency risk management.
            </p>
          </div>

          <div className="card hover:shadow-xl transition-shadow duration-300">
            <div className="bg-success-100 w-12 h-12 rounded-xl flex items-center justify-center mb-4">
              <TrendingUp className="w-6 h-6 text-success-600" />
            </div>
            <h3 className="text-xl font-semibold text-slate-900 mb-2">
              Smart Risk Management
            </h3>
            <p className="text-slate-600">
              Real-time health factor monitoring with automatic risk alerts to
              keep your position safe.
            </p>
          </div>

          <div className="card hover:shadow-xl transition-shadow duration-300">
            <div className="bg-warning-100 w-12 h-12 rounded-xl flex items-center justify-center mb-4">
              <DollarSign className="w-6 h-6 text-warning-600" />
            </div>
            <h3 className="text-xl font-semibold text-slate-900 mb-2">
              Transparent Costs
            </h3>
            <p className="text-slate-600">
              Clear visibility into protection costs. No hidden fees, no
              surprises.
            </p>
          </div>
        </div>

        {/* Main Content */}
        {isConnected ? (
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
            </div>
          </div>
        ) : (
          <div className="card max-w-2xl mx-auto text-center py-12">
            <div className="bg-primary-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
              <Shield className="w-8 h-8 text-primary-600" />
            </div>
            <h3 className="text-2xl font-semibold text-slate-900 mb-2">
              Connect Your Wallet
            </h3>
            <p className="text-slate-600 mb-6">
              Connect your wallet to start protecting your assets from currency
              risk on Arc Testnet.
            </p>
            <ConnectButton />
          </div>
        )}
      </section>

      {/* Footer */}
      <footer className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 mt-12 border-t border-slate-200">
        <div className="text-center text-slate-500 text-sm">
          <p>
            Built on{' '}
            <a
              href="https://arc.network"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary-600 hover:text-primary-700 font-medium"
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

