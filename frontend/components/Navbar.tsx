'use client'

import { LayoutDashboard, Coins } from 'lucide-react'

interface NavbarProps {
  activeTab: 'position' | 'liquidity'
  onTabChange: (tab: 'position' | 'liquidity') => void
}

export default function Navbar({ activeTab, onTabChange }: NavbarProps) {
  return (
    <div className="card mb-6">
      <div className="flex space-x-2">
        <button
          onClick={() => onTabChange('position')}
          className={`flex-1 flex items-center justify-center space-x-2 py-3 px-4 rounded-xl font-semibold transition-all duration-200 ${
            activeTab === 'position'
              ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg'
              : 'bg-purple-900/30 text-purple-300 hover:bg-purple-800/40 border border-purple-700/30'
          }`}
        >
          <LayoutDashboard className="w-5 h-5" />
          <span>Your Position</span>
        </button>
        <button
          onClick={() => onTabChange('liquidity')}
          className={`flex-1 flex items-center justify-center space-x-2 py-3 px-4 rounded-xl font-semibold transition-all duration-200 ${
            activeTab === 'liquidity'
              ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg'
              : 'bg-purple-900/30 text-purple-300 hover:bg-purple-800/40 border border-purple-700/30'
          }`}
        >
          <Coins className="w-5 h-5" />
          <span>Add Liquidity</span>
        </button>
      </div>
    </div>
  )
}





