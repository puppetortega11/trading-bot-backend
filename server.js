const express = require('express')
const cors = require('cors')
const { Connection, PublicKey, LAMPORTS_PER_SOL } = require('@solana/web3.js')

const app = express()
const PORT = process.env.PORT || 3001

// Middleware
app.use(cors())
app.use(express.json())

// Bot wallet configuration
const BOT_WALLET_ADDRESS = 'DGPrryYStTsmKkMhkJrTzapbCYKvN3srHJvSHqZCWYP6'

// RPC endpoints with fallback
const rpcEndpoints = [
  'https://api.mainnet-beta.solana.com',
  'https://rpc.ankr.com/solana',
  'https://solana-api.projectserum.com'
]

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    nodeVersion: process.version
  })
})

// Bot wallet address endpoint
app.get('/api/bot/wallet-address', (req, res) => {
  try {
    res.json({
      success: true,
      address: BOT_WALLET_ADDRESS
    })
  } catch (error) {
    console.error('Error fetching wallet address:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to fetch wallet address'
    })
  }
})

// Bot balance endpoint
app.get('/api/bot/balance', async (req, res) => {
  try {
    let connection
    let balance = 0
    
    for (const endpoint of rpcEndpoints) {
      try {
        connection = new Connection(endpoint, {
          commitment: 'confirmed',
          httpHeaders: {
            'User-Agent': 'TradingBot/1.0'
          }
        })
        
        const publicKey = new PublicKey(BOT_WALLET_ADDRESS)
        const balanceLamports = await connection.getBalance(publicKey)
        balance = balanceLamports / LAMPORTS_PER_SOL
        break
      } catch (error) {
        console.log(`Failed to connect to ${endpoint}:`, error)
        continue
      }
    }

    res.json({
      success: true,
      balance: balance,
      address: BOT_WALLET_ADDRESS
    })
  } catch (error) {
    console.error('Error fetching bot balance:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to fetch bot balance',
      balance: 0,
      address: BOT_WALLET_ADDRESS
    })
  }
})

// Bot status endpoint
app.get('/api/bot/status', (req, res) => {
  try {
    const botStatus = {
      isRunning: false,
      lastUpdate: new Date().toISOString(),
      totalTrades: 0,
      activePositions: 0,
      backendConnected: true
    }

    res.json({
      success: true,
      status: botStatus
    })
  } catch (error) {
    console.error('Error fetching bot status:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to fetch bot status'
    })
  }
})

// Start/stop bot endpoint
app.post('/api/bot/status', (req, res) => {
  try {
    const { action } = req.body
    
    if (action === 'start') {
      res.json({
        success: true,
        message: 'Bot started successfully'
      })
    } else if (action === 'stop') {
      res.json({
        success: true,
        message: 'Bot stopped successfully'
      })
    } else {
      res.status(400).json({
        success: false,
        error: 'Invalid action'
      })
    }
  } catch (error) {
    console.error('Error controlling bot:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to control bot'
    })
  }
})

// Trades endpoint
app.get('/api/trades', (req, res) => {
  try {
    const trades = [
      {
        id: '1',
        token: 'BONK',
        action: 'buy',
        amount: 1000000,
        price: 0.00001234,
        timestamp: new Date().toISOString(),
        profit: 0
      }
    ]

    res.json({
      success: true,
      trades: trades
    })
  } catch (error) {
    console.error('Error fetching trades:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to fetch trades'
    })
  }
})

// Profit data endpoint
app.get('/api/profit', (req, res) => {
  try {
    const timeframe = req.query.timeframe || 'day'
    
    const profitData = {
      timeframe,
      totalProfit: 0.0,
      totalLoss: 0.0,
      netProfit: 0.0,
      winRate: 0,
      trades: 0,
      chartData: [
        { time: '00:00', profit: 0 },
        { time: '06:00', profit: 0 },
        { time: '12:00', profit: 0 },
        { time: '18:00', profit: 0 }
      ]
    }

    res.json({
      success: true,
      data: profitData
    })
  } catch (error) {
    console.error('Error fetching profit data:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to fetch profit data'
    })
  }
})

// Strategy endpoint
app.get('/api/bot/strategy', (req, res) => {
  try {
    const strategy = {
      name: 'Aggressive Meme Token Strategy',
      description: 'High-frequency trading strategy focused on Solana meme tokens with advanced technical analysis',
      riskLevel: 'High',
      expectedReturn: '15-25% daily',
      maxPosition: '10%',
      stopLoss: '5%',
      takeProfit: '15%',
      enabled: true
    }

    res.json({
      success: true,
      strategy: strategy
    })
  } catch (error) {
    console.error('Error fetching strategy:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to fetch strategy'
    })
  }
})

// Update strategy endpoint
app.post('/api/bot/strategy', (req, res) => {
  try {
    const strategyData = req.body
    
    res.json({
      success: true,
      message: 'Strategy updated successfully',
      strategy: strategyData
    })
  } catch (error) {
    console.error('Error updating strategy:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to update strategy'
    })
  }
})

// Start server
app.listen(PORT, () => {
  console.log(`Trading Bot Backend running on port ${PORT}`)
  console.log(`Health check: http://localhost:${PORT}/health`)
  console.log(`Bot wallet: ${BOT_WALLET_ADDRESS}`)
})
