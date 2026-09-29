"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { RainbowKitProvider, lightTheme } from "@rainbow-me/rainbowkit";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider, useAccount } from "wagmi";
import { isProvider } from "@/lib/auth/wallet";
import { walletToolkitConfig } from "@/lib/auth/wallet-toolkit";
import { WalletProvider, useWallet } from "./wallet-provider";

function WalletConnectorBridge() {
  const { address, chainId, connector, status } = useAccount();
  const wallet = useWallet();
  const bridge = useRef(wallet);
  useEffect(() => { bridge.current = wallet; }, [wallet]);
  const last = useRef("");
  useEffect(() => {
    if (status !== "connected" || !address || !chainId || !connector) {
      if (last.current && bridge.current.connection) bridge.current.disconnect();
      last.current = "";
      return;
    }
    const key = `${connector.uid}:${address.toLowerCase()}:${chainId}`;
    if (key === last.current || bridge.current.connection?.address.toLowerCase() === address.toLowerCase() && BigInt(bridge.current.connection.chainId) === BigInt(chainId)) {
      last.current = key;
      return;
    }
    let active = true;
    void connector.getProvider().then(provider => {
      if (!active || !isProvider(provider)) return;
      last.current = key;
      void bridge.current.connect({ id: connector.uid, name: connector.name, provider }, true);
    }).catch(() => { /* The existing wallet UI reports connection failures. */ });
    return () => { active = false; };
  }, [address, chainId, connector, status, wallet.connection]);
  return null;
}

// Same provider nesting as Scaffold-ETH 2, with the existing Floww wallet
// session kept separate from a wagmi connection.
export function WalletToolkitProvider({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({ defaultOptions: { queries: { refetchOnWindowFocus: false } } }));
  return <WagmiProvider config={walletToolkitConfig} reconnectOnMount={false}>
    <QueryClientProvider client={queryClient}>
      <RainbowKitProvider theme={lightTheme({ accentColor: "#4261ff" })}>
        <WalletProvider><WalletConnectorBridge />{children}</WalletProvider>
      </RainbowKitProvider>
    </QueryClientProvider>
  </WagmiProvider>;
}
