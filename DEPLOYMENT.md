# ArcShield Deployment Guide

Complete guide to deploying ArcShield on Arc Testnet.

## Prerequisites

1. **Install Foundry**
   ```bash
   curl -L https://foundry.paradigm.xyz | bash
   foundryup
   ```

2. **Get Testnet USDC**
   - Visit [Circle Faucet](https://faucet.circle.com)
   - Select **Arc Testnet**
   - Request testnet USDC to your wallet

3. **Setup Wallet**
   - Use MetaMask or any Web3 wallet
   - Add Arc Testnet:
     - Network Name: Arc Testnet
     - RPC URL: `https://rpc.testnet.arc.network`
     - Chain ID: `1243`
     - Currency Symbol: USDC
     - Block Explorer: `https://testnet.arcscan.app`

## Step 1: Deploy Smart Contracts

### 1.1 Configure Contracts

```bash
cd contracts

# Create .env file
cat > .env << EOF
ARC_TESTNET_RPC_URL="https://rpc.testnet.arc.network"
PRIVATE_KEY="0xYOUR_PRIVATE_KEY_HERE"
EOF
```

### 1.2 Deploy

```bash
# Load environment variables
source .env

# Deploy contracts
forge script script/Deploy.s.sol:DeployScript \
  --rpc-url $ARC_TESTNET_RPC_URL \
  --private-key $PRIVATE_KEY \
  --broadcast
```

### 1.3 Save Contract Addresses

After deployment, you'll see output like:
```
HedgePositionFactory deployed at: 0x...
ArcShieldRouter deployed at: 0x...
```

Save the **ArcShieldRouter** address - you'll need it for the frontend.

## Step 2: Setup Frontend

### 2.1 Install Dependencies

```bash
cd frontend
npm install
```

### 2.2 Get WalletConnect Project ID

1. Go to [WalletConnect Cloud](https://cloud.walletconnect.com)
2. Sign up / Log in
3. Create a new project
4. Copy the Project ID

### 2.3 Configure Frontend

```bash
# Create .env.local file
cat > .env.local << EOF
NEXT_PUBLIC_ARCSHIELD_ROUTER_ADDRESS="0xYOUR_ROUTER_ADDRESS"
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID="your-walletconnect-project-id"
EOF
```

### 2.4 Run Frontend

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Step 3: Using the dApp

### 3.1 Connect Wallet

1. Click "Connect Wallet"
2. Select your wallet (MetaMask, WalletConnect, etc.)
3. Approve connection

### 3.2 Approve USDC

Before activating protection, you must approve the router contract:

1. The dApp will show an approval prompt if needed
2. Or manually approve:
   - Go to [ArcScan](https://testnet.arcscan.app)
   - Find USDC contract: `0x3600000000000000000000000000000000000000`
   - Call `approve` function
   - Spender: Your router address
   - Amount: Amount you want to use (or max)

### 3.3 Activate Protection

1. Enter collateral amount (USDC)
2. Select currency to hedge (BRL, MXN, EUR)
3. Choose protection level:
   - **Low** (20% LTV): Very safe
   - **Medium** (35% LTV): Balanced
   - **High** (50% LTV): Maximum protection
4. Click "Activate Protection"
5. Confirm transaction in wallet

### 3.4 Monitor Position

- View health factor (should be ≥ 1.5 for safety)
- Check safety buffer
- Review protection costs
- Close or reduce position as needed

## Troubleshooting

### "Router contract not configured"
- Check `.env.local` has `NEXT_PUBLIC_ARCSHIELD_ROUTER_ADDRESS`
- Restart dev server after changing env vars

### "USDC transfer failed"
- Approve the router contract to spend your USDC
- Check you have sufficient USDC balance
- Ensure you're on Arc Testnet (Chain ID: 1243)

### "Transaction reverted"
- Check you have enough USDC for gas
- Verify contract addresses are correct
- Check contract is deployed and verified

### Wallet connection issues
- Add Arc Testnet to your wallet
- Check network is set to Arc Testnet
- Try disconnecting and reconnecting

## Contract Verification (Optional)

Verify contracts on ArcScan:

```bash
# Verify Factory
forge verify-contract <FACTORY_ADDRESS> HedgePositionFactory \
  --chain-id 1243 \
  --etherscan-api-key $ARC_TESTNET_ETHERSCAN_API_KEY

# Verify Router
forge verify-contract <ROUTER_ADDRESS> ArcShieldRouter \
  --chain-id 1243 \
  --etherscan-api-key $ARC_TESTNET_ETHERSCAN_API_KEY \
  --constructor-args $(cast abi-encode "constructor(address)" <FACTORY_ADDRESS>)
```

## Production Checklist

Before going to production:

- [ ] Audit smart contracts
- [ ] Test all functions thoroughly
- [ ] Verify contracts on explorer
- [ ] Update frontend with production contract addresses
- [ ] Set up monitoring and alerts
- [ ] Document all contract addresses
- [ ] Test with multiple wallets
- [ ] Verify USDC approval flow works
- [ ] Test all protection levels
- [ ] Test close/reduce functions

## Support

- Arc Docs: https://docs.arc.network
- Arc Explorer: https://testnet.arcscan.app
- Arc Faucet: https://faucet.circle.com

---

**Remember**: This is testnet code. Do not use in production without proper audit and testing.

