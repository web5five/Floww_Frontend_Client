import { connectorsForWallets } from "@rainbow-me/rainbowkit";
import { injectedWallet, metaMaskWallet, walletConnectWallet } from "@rainbow-me/rainbowkit/wallets";
import { http } from "viem";
import { sepolia } from "viem/chains";
import { createConfig } from "wagmi";

// Adapted from Scaffold-ETH 2's wagmiConnectors and wagmiConfig at
// 6cdf354a4a02aded39c92d5e0d83cd24e4628239 (MIT). Floww intentionally
// has only Sepolia, no burner wallet, local faucet, or application contracts.
const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID?.trim() ?? "";
const wallets = projectId
  ? [metaMaskWallet, injectedWallet, walletConnectWallet]
  : [injectedWallet];

export const walletToolkitConfig = createConfig({
  chains: [sepolia],
  ssr: true,
  connectors: typeof window === "undefined" ? [] : connectorsForWallets(
    [{ groupName: "Wallets", wallets }],
    { appName: "Floww", projectId },
  ),
  transports: { [sepolia.id]: http() },
});
