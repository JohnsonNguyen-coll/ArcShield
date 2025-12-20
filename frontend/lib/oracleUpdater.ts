/**
 * Oracle Updater - Update prices on-chain using PriceOracle contract
 */

import { writeContract } from 'wagmi/actions'
import { parseUnits } from 'viem'
import { fetchExchangeRates, rateTo8Decimals } from './priceService'

const PRICE_ORACLE_ABI = [
  {
    inputs: [
      { name: 'currencies', type: 'string[]' },
      { name: 'rates', type: 'uint256[]' },
    ],
    name: 'updatePrices',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
] as const

/**
 * Update oracle prices on-chain
 * @param oracleAddress PriceOracle contract address
 * @param config Wagmi config
 */
export async function updateOraclePrices(
  oracleAddress: `0x${string}`,
  config: any
): Promise<boolean> {
  try {
    // Fetch real-time rates
    const rates = await fetchExchangeRates()
    
    // Convert to 8 decimals format
    const currencies = ['BRL', 'MXN', 'EUR']
    const rates8Decimals = [
      rateTo8Decimals(rates.BRL),
      rateTo8Decimals(rates.MXN),
      rateTo8Decimals(rates.EUR),
    ]
    
    // Update on-chain
    await writeContract(config, {
      address: oracleAddress,
      abi: PRICE_ORACLE_ABI,
      functionName: 'updatePrices',
      args: [currencies, rates8Decimals],
    })
    
    return true
  } catch (error) {
    console.error('Failed to update oracle prices:', error)
    return false
  }
}












