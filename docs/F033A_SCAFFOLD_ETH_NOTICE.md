# F033A wallet toolkit provenance

Floww adapts the provider nesting, wagmi configuration, connector selection and custom connect button pattern from the official [Scaffold-ETH 2 repository](https://github.com/scaffold-eth/scaffold-eth-2/tree/6cdf354a4a02aded39c92d5e0d83cd24e4628239) at commit `6cdf354a4a02aded39c92d5e0d83cd24e4628239`. Specific reference files are `packages/nextjs/components/ScaffoldEthAppWithProviders.tsx`, `packages/nextjs/services/web3/wagmiConfig.tsx`, `packages/nextjs/services/web3/wagmiConnectors.tsx`, and `packages/nextjs/components/scaffold-eth/RainbowKitCustomConnectButton/index.tsx`. This is a bounded adaptation inside the existing Floww client; no contracts, burner wallet, faucet or starter application were imported.

Scaffold-ETH 2 is MIT licensed. Its [license file](https://github.com/scaffold-eth/scaffold-eth-2/blob/6cdf354a4a02aded39c92d5e0d83cd24e4628239/LICENCE) states:

```text
MIT License

Copyright (c) 2023 BuidlGuidl

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

Installed package versions are pinned in `package-lock.json`: RainbowKit `2.2.11`, wagmi `2.19.5`, viem `2.53.1`, and TanStack React Query `5.100.5`. Their own transitive package notices remain with those packages.
