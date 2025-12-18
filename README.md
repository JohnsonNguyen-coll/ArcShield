# ArcShield - FX Protection Protocol

A beautiful, user-friendly dApp for protecting assets from currency risk on Arc Testnet.

## 🛡️ What is ArcShield?

ArcShield is a **non-custodial stablecoin FX protection protocol** that helps users hedge currency risk using borrowed liquidity — **without trading or derivatives**.

### Key Features

- ✅ **1-Click Protection** - Activate hedge protection instantly
- 📊 **Real-time Health Monitoring** - Track health factor and safety buffer
- 💰 **Transparent Costs** - Clear visibility into protection costs
- 🎨 **Beautiful UI** - Modern, responsive design
- 🔒 **Non-Custodial** - You control your assets

## 📁 Project Structure

```
ArcShield/
├── contracts/          # Smart contracts (Foundry)
│   ├── src/
│   ├── test/
│   └── script/
└── frontend/          # Next.js frontend
    ├── app/
    ├── components/
    └── ...
```

## 🚀 Quick Start

### Prerequisites

- [Foundry](https://book.getfoundry.sh/getting-started/installation)
- Node.js 18+
- A wallet with Arc Testnet USDC

### 1. Clone & Setup

```bash
# Install Foundry (if not already installed)
curl -L https://foundry.paradigm.xyz | bash
foundryup

# Install frontend dependencies
cd frontend
npm install
```

### 2. Deploy Contracts

```bash
cd contracts

# Create .env file
cp .env.example .env
# Add your PRIVATE_KEY and ARC_TESTNET_RPC_URL

# Get testnet USDC from https://faucet.circle.com

# Deploy contracts
forge script script/Deploy.s.sol:DeployScript \
  --rpc-url $ARC_TESTNET_RPC_URL \
  --private-key $PRIVATE_KEY \
  --broadcast
```

### 3. Configure Frontend

```bash
cd frontend

# Create .env.local file
cp .env.example .env.local

# Add your contract addresses and WalletConnect Project ID
NEXT_PUBLIC_ARCSHIELD_ROUTER_ADDRESS="0x..."
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID="your-project-id"
```

### 4. Run Frontend

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## 📖 Documentation

- [Contracts README](./contracts/README.md) - Smart contract documentation
- [Frontend README](./frontend/README.md) - Frontend setup and usage

## 🎯 How It Works

### Protection Levels

- **Low** (20% LTV): Very safe, low cost
- **Medium** (35% LTV): Balanced protection  
- **High** (50% LTV): Maximum protection

### Health Factor

- 🟢 **Safe** (≥1.50): Position is healthy
- 🟡 **Warning** (1.30-1.49): Monitor closely
- 🟠 **Strong Warning** (1.15-1.29): Consider reducing
- 🔴 **Emergency** (<1.15): Immediate action required

## 🔧 Development

### Contracts

```bash
cd contracts

# Run tests
forge test

# Compile
forge build

# Deploy
forge script script/Deploy.s.sol:DeployScript --rpc-url $ARC_TESTNET_RPC_URL --private-key $PRIVATE_KEY --broadcast
```

### Frontend

```bash
cd frontend

# Development
npm run dev

# Build
npm run build

# Production
npm start
```

## 🌐 Arc Testnet

- **RPC URL**: `https://rpc.testnet.arc.network`
- **Chain ID**: `1243`
- **Explorer**: [testnet.arcscan.app](https://testnet.arcscan.app)
- **Faucet**: [faucet.circle.com](https://faucet.circle.com)

## 📝 Important Notes

- ⚠️ **Testnet Only** - This is for Arc Testnet only
- 🔐 **Never commit private keys** - Use `.env` files (gitignored)
- ✅ **Approve USDC** - Users must approve the router contract before activating protection
- 🧪 **Testing** - Always test on testnet before mainnet

## 🎨 Features

### MVP Features

- ✅ Hedge Position Creation (1-Click Protection)
- ✅ Protection Level Slider (Low/Medium/High)
- ✅ Health Factor & Safety Buffer Display
- ✅ Close / Reduce Hedge Position
- ✅ Cost Transparency Panel
- ✅ Auto Risk Alerts (UI-based)

### Future Features (v2+)

- Auto-unwind functionality
- Multi-currency hedge
- Income protection mode
- Time-based hedge
- Hedging vaults

## 📄 License

MIT

## 🙏 Acknowledgments

Built on [Arc Network](https://arc.network) - A stablecoin-native blockchain.

---

**Built with ❤️ for the Arc ecosystem**

