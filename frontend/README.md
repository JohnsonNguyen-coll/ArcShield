# ArcShield Frontend

Beautiful, user-friendly frontend for the ArcShield FX Protection Protocol.

## Features

- 🛡️ 1-Click Protection Activation
- 📊 Real-time Health Factor Monitoring
- 💰 Transparent Cost Display
- 🎨 Modern, Responsive UI
- 🔒 Wallet Connection (RainbowKit)

## Tech Stack

- **Next.js 14** - React framework
- **TypeScript** - Type safety
- **Tailwind CSS** - Styling
- **Wagmi** - Ethereum React Hooks
- **RainbowKit** - Wallet connection UI
- **Viem** - Ethereum utilities

## Setup

### Prerequisites

- Node.js 18+
- Deployed ArcShield contracts (see `/contracts`)

### Installation

1. Install dependencies:
```bash
npm install
```

2. Create `.env.local` file:
```bash
cp .env.example .env.local
```

3. Add configuration:
```env
NEXT_PUBLIC_ARCSHIELD_ROUTER_ADDRESS="0x..."
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID="your-project-id"
```

### Get WalletConnect Project ID

1. Go to [WalletConnect Cloud](https://cloud.walletconnect.com)
2. Create a new project
3. Copy the Project ID

### Development

Run development server:
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

### Build

Build for production:
```bash
npm run build
```

Start production server:
```bash
npm start
```

## Usage

### 1. Connect Wallet

Click "Connect Wallet" and select your preferred wallet (MetaMask, WalletConnect, etc.)

### 2. Fund Wallet

Get testnet USDC from [Circle Faucet](https://faucet.circle.com):
- Select **Arc Testnet**
- Paste your wallet address
- Request testnet USDC

### 3. Approve USDC

Before activating protection, you need to approve the router contract to spend your USDC:
- Use a block explorer or wallet interface
- Approve `NEXT_PUBLIC_ARCSHIELD_ROUTER_ADDRESS` to spend your USDC

### 4. Activate Protection

1. Enter collateral amount (USDC)
2. Select currency to hedge (BRL, MXN, EUR)
3. Choose protection level (Low/Medium/High)
4. Click "Activate Protection"

### 5. Monitor Position

- View health factor and safety buffer
- Check protection costs
- Close or reduce position as needed

## Project Structure

```
frontend/
├── app/
│   ├── layout.tsx       # Root layout
│   ├── page.tsx         # Home page
│   ├── providers.tsx    # Wagmi/RainbowKit providers
│   └── globals.css      # Global styles
├── components/
│   ├── ProtectionPanel.tsx    # Protection activation UI
│   ├── ProtectionSlider.tsx   # Protection level slider
│   ├── PositionDashboard.tsx # Position management
│   ├── HealthFactorCard.tsx  # Health factor display
│   └── CostTransparency.tsx  # Cost breakdown
└── ...
```

## Features

### Protection Levels

- **Low** (20% LTV): Very safe, low cost
- **Medium** (35% LTV): Balanced protection
- **High** (50% LTV): Maximum protection

### Health Factor Alerts

- 🟢 **Safe** (≥1.50): Position is healthy
- 🟡 **Warning** (1.30-1.49): Monitor closely
- 🟠 **Strong Warning** (1.15-1.29): Consider reducing
- 🔴 **Emergency** (<1.15): Immediate action required

## Troubleshooting

### "Router contract not configured"
- Make sure `NEXT_PUBLIC_ARCSHIELD_ROUTER_ADDRESS` is set in `.env.local`
- Restart the dev server after changing env variables

### "USDC transfer failed"
- Approve the router contract to spend your USDC
- Check you have sufficient USDC balance

### Wallet connection issues
- Make sure you're on Arc Testnet (Chain ID: 1243)
- Add Arc Testnet to your wallet if needed

## License

MIT



