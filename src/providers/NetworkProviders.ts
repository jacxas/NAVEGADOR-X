import { CapabilityProvider, globalProviderResolver } from '@/src/kernel/ProviderResolver';

/**
 * Tor and VPN remain discoverable capability providers, but neither transport
 * is wired to a native process adapter yet. They must fail closed rather than
 * manufacture a successful route, latency or security claim.
 */
export const TorNetworkProvider: CapabilityProvider = {
  id: 'provider-network-tor',
  name: 'Tor transport (native adapter pending)',
  capabilityType: 'network.routeRequest',
  priority: 100,
  supportsContext: (context?: any) => {
    if (!context) return false;
    if (typeof context === 'string' && context.endsWith('.onion')) return true;
    if (context.url && context.url.endsWith('.onion')) return true;
    return context.transport === 'Tor' || Boolean(context.useTor);
  },
  execute: async () => ({
    available: false,
    connected: false,
    proxied: false,
    transport: 'Tor',
    error: 'TOR_NATIVE_ADAPTER_NOT_IMPLEMENTED',
    message: 'No se ha iniciado ningún circuito Tor.',
  }),
};

export const VPNNetworkProvider: CapabilityProvider = {
  id: 'provider-network-vpn',
  name: 'VPN Gate / OpenVPN (native adapter pending)',
  capabilityType: 'network.routeRequest',
  priority: 50,
  supportsContext: (context?: any) => {
    if (!context) return false;
    return Boolean(context.useVPN || context.transport === 'VPN');
  },
  execute: async () => ({
    available: false,
    connected: false,
    proxied: false,
    transport: 'VPN',
    protocol: 'OpenVPN',
    error: 'VPN_NATIVE_ADAPTER_NOT_IMPLEMENTED',
    message: 'El catálogo VPN Gate está disponible, pero todavía no se ha iniciado ningún túnel.',
  }),
};

export const DirectNetworkProvider: CapabilityProvider = {
  id: 'provider-network-direct',
  name: 'Direct system network route',
  capabilityType: 'network.routeRequest',
  priority: 1,
  supportsContext: () => true,
  execute: async (context: any) => {
    const url = typeof context === 'string' ? context : context?.url || '';
    return {
      available: true,
      connected: true,
      proxied: false,
      transport: 'Direct',
      circuitInfo: 'Direct system network route',
      resolvedUrl: url,
      latencyMs: null,
      securityLevel: 'STANDARD',
    };
  },
};

export function registerDefaultNetworkProviders() {
  globalProviderResolver.registerProvider(TorNetworkProvider);
  globalProviderResolver.registerProvider(VPNNetworkProvider);
  globalProviderResolver.registerProvider(DirectNetworkProvider);
}
