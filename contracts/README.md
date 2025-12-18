# ArcShield Smart Contracts

Smart contracts for the ArcShield FX Protection Protocol on Arc Testnet.

## Overview

ArcShield is a non-custodial stablecoin FX protection protocol that helps users hedge currency risk using borrowed liquidity — without trading or derivatives.

### Contracts

- **HedgePositionFactory**: Factory contract for creating new hedge positions
- **HedgePosition**: Individual position contract managing collateral, debt, and health factor
- **ArcShieldRouter**: Main router contract for 1-click protection activation

## Setup

### Prerequisites

- [Foundry](https://book.getfoundry.sh/getting-started/installation)
- Node.js 18+

### Installation

1. Install Foundry:
```bash
curl -L https://foundry.paradigm.xyz | bash
foundryup
```

2. Install dependencies:
```bash
forge install
```

3. Create `.env` file from `.env.example`:
```bash
cp .env.example .env
```

4. Add your private key and RPC URL to `.env`:
```env
ARC_TESTNET_RPC_URL="https://rpc.testnet.arc.network"
PRIVATE_KEY="0x..."
```

## Testing

Run tests:
```bash
forge test
```

Run tests with verbosity:
```bash
forge test -vvv
```

## Compilation

Compile contracts:
```bash
forge build
```

## Deployment

### 1. Fund Your Wallet

Get testnet USDC from the [Circle Faucet](https://faucet.circle.com):
- Select **Arc Testnet**
- Paste your wallet address
- Request testnet USDC

### 2. Deploy Contracts

Deploy to Arc Testnet:
```bash
forge script script/Deploy.s.sol:DeployScript \
  --rpc-url $ARC_TESTNET_RPC_URL \
  --private-key $PRIVATE_KEY \
  --broadcast
```

### 3. Verify Contracts (Optional)

Verify on ArcScan:
```bash
forge verify-contract <CONTRACT_ADDRESS> <CONTRACT_NAME> \
  --chain-id 1243 \
  --etherscan-api-key $ARC_TESTNET_ETHERSCAN_API_KEY \
  --constructor-args $(cast abi-encode "constructor(address)" <FACTORY_ADDRESS>)
```

## Contract Addresses

After deployment, save the contract addresses:

- `HedgePositionFactory`: `<FACTORY_ADDRESS>`
- `ArcShieldRouter`: `<ROUTER_ADDRESS>`

Add the router address to your frontend `.env` file.

## Architecture

### Protection Levels

- **Low**: LTV 20% - Very safe, low cost
- **Medium**: LTV 35% - Balanced protection
- **High**: LTV 50% - Maximum protection

### Health Factor

Health Factor = (Collateral × Collateral Factor) / Debt

- **Safe**: HF ≥ 1.50
- **Warning**: 1.30 ≤ HF < 1.50
- **Strong Warning**: 1.15 ≤ HF < 1.30
- **Emergency**: HF < 1.15

## Security Notes

- This is testnet code. Do not use in production without audit.
- Never commit private keys or sensitive data.
- Always verify contract addresses before interacting.

## License

MIT
