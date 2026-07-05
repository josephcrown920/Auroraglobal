/**
 * UI State Configuration
 * Last known working state - loaded automatically on workspace import
 * DO NOT modify unless intentionally changing the default UI
 */

export const LAST_KNOWN_UI_STATE = {
  version: '1.0.0',
  timestamp: '2026-06-11T14:32:04Z',
  branch: 'main',
  commit: 'fac09b6b452f5305a5225ccb4e107d10e6985490',
  
  // Theme & Layout
  theme: 'dark',
  layout: 'sidebar-left',
  sidebarCollapsed: false,
  
  // Visibility
  components: {
    header: { visible: true, height: 80 },
    sidebar: { visible: true, width: 250, collapsed: false },
    footer: { visible: true, height: 40 },
    navigation: { visible: true },
    userMenu: { visible: true }
  },
  
  // Routes Accessible
  routes: [
    '/',
    '/studio',
    '/motion',
    '/lipsync',
    '/dashboard',
    '/dashboard/webhooks',
    '/dashboard/gifts',
    '/dashboard/affiliates'
  ],
  
  // Default View
  defaultRoute: '/studio',
  
  // Provider Status (for banners/indicators)
  providersConfigured: {
    replicate: false,
    lovable: true,
    gemini: true,
    openrouter: true,
    openai: false,
    fal: false,
    huggingface: true,
    sync: true,
    kling: true,
    heygen: true
  }
}

/**
 * Load UI State on App Initialization
 */
export function initializeUIState() {
  if (typeof window !== 'undefined') {
    // Apply theme
    document.documentElement.setAttribute('data-theme', LAST_KNOWN_UI_STATE.theme)
    document.documentElement.setAttribute('data-layout', LAST_KNOWN_UI_STATE.layout)
    
    // Restore sidebar state from localStorage if exists
    const savedSidebarState = localStorage.getItem('sidebar-collapsed')
    if (savedSidebarState !== null) {
      LAST_KNOWN_UI_STATE.components.sidebar.collapsed = JSON.parse(savedSidebarState)
    }
  }
}

/**
 * Get provider availability for UI indicators
 */
export function getProviderStatus(provider: keyof typeof LAST_KNOWN_UI_STATE.providersConfigured) {
  return LAST_KNOWN_UI_STATE.providersConfigured[provider]
}

/**
 * Check if feature is available
 */
export function isFeatureAvailable(feature: 'motion' | 'lipsync' | 'webhooks' | 'gifts' | 'affiliates'): boolean {
  const featureRoutes: Record<string, string> = {
    motion: '/motion',
    lipsync: '/lipsync',
    webhooks: '/dashboard/webhooks',
    gifts: '/dashboard/gifts',
    affiliates: '/dashboard/affiliates'
  }
  return LAST_KNOWN_UI_STATE.routes.includes(featureRoutes[feature])
}
