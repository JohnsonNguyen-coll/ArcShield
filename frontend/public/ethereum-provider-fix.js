// Suppress "Cannot redefine property: ethereum" error
// This happens when multiple wallet extensions try to inject window.ethereum
// This script must run as early as possible, before wallet extensions inject

(function() {
  if (typeof window === 'undefined') return;
  
  // Check if already patched (to avoid double patching)
  if (window.__ethereumProviderFixPatched) {
    return;
  }
  
  const originalDefineProperty = Object.defineProperty;
  
  Object.defineProperty = function(obj, prop, descriptor) {
    // If trying to redefine window.ethereum and it already exists, just return
    if (prop === 'ethereum' && obj === window && window.ethereum) {
      try {
        // Try to merge providers if ethereum.providers exists
        if (descriptor.value && descriptor.value.providers) {
          const existingProviders = window.ethereum.providers || [];
          const newProviders = descriptor.value.providers || [];
          const allProviders = [...existingProviders, ...newProviders];
          
          // If we have multiple providers, set them up properly
          if (allProviders.length > 1) {
            window.ethereum.providers = allProviders;
          }
        }
      } catch (e) {
        // Silently ignore errors during merge
      }
      
      // Return without redefining
      return obj;
    }
    
    // For all other cases, use the original defineProperty
    return originalDefineProperty.call(this, obj, prop, descriptor);
  };
  
  // Mark as patched
  window.__ethereumProviderFixPatched = true;
})();

