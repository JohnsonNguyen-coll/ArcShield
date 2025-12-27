'use client'

import { useLayoutEffect } from 'react'

/**
 * Component to fix "Cannot redefine property: ethereum" error
 * This happens when multiple wallet extensions try to inject window.ethereum
 * 
 * Note: This runs as early as possible using useLayoutEffect, but wallet extensions
 * may still inject before React hydrates. The error is usually harmless and doesn't
 * affect functionality, but this helps suppress it.
 */
export default function EthereumProviderFix() {
  useLayoutEffect(() => {
    // Suppress "Cannot redefine property: ethereum" error
    // This happens when multiple wallet extensions try to inject window.ethereum
    if (typeof window === 'undefined') return

    // Check if already patched (to avoid double patching)
    if ((window as any).__ethereumProviderFixPatched) {
      return
    }

    const originalDefineProperty = Object.defineProperty
    
    Object.defineProperty = function(obj: any, prop: string | symbol, descriptor: PropertyDescriptor) {
      // If trying to redefine window.ethereum and it already exists, just return
      if (prop === 'ethereum' && obj === window && window.ethereum) {
        try {
          // Try to merge providers if ethereum.providers exists
          if (descriptor.value && (descriptor.value as any).providers) {
            const existingProviders = (window.ethereum as any).providers || []
            const newProviders = (descriptor.value as any).providers || []
            const allProviders = [...existingProviders, ...newProviders]
            
            // If we have multiple providers, set them up properly
            if (allProviders.length > 1) {
              (window.ethereum as any).providers = allProviders
            }
          }
        } catch (e) {
          // Silently ignore errors during merge
        }
        
        // Return without redefining
        return obj
      }
      
      // For all other cases, use the original defineProperty
      return originalDefineProperty.call(this, obj, prop, descriptor)
    }

    // Mark as patched
    ;(window as any).__ethereumProviderFixPatched = true
  }, [])

  return null // This component doesn't render anything
}

