import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import Script from 'next/script'
import './globals.css'
import { Providers } from './providers'
import EthereumProviderFix from '@/components/EthereumProviderFix'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'ArcShield - FX Protection Protocol',
  description: 'Non-custodial stablecoin FX protection protocol on Arc Network',
  icons: {
    icon: '/favicon.svg',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        {/* Load fix script early to prevent "Cannot redefine property: ethereum" error */}
        <Script
          src="/ethereum-provider-fix.js"
          strategy="afterInteractive"
        />
        <EthereumProviderFix />
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}

