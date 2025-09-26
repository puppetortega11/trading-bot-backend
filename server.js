const express = require('express')
const cors = require('cors')
const { Connection, PublicKey, LAMPORTS_PER_SOL } = require('@solana/web3.js')
const { initializeDatabase, db } = require('./database')

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

    // Record balance in database
    await db.recordWalletBalance(BOT_WALLET_ADDRESS, balance)

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
app.get('/api/bot/status', async (req, res) => {
  try {
    const botStatus = await db.getBotStatus()
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
app.post('/api/bot/status', async (req, res) => {
  try {
    const { action } = req.body
    
    if (action === 'start') {
      await db.updateBotStatus({
        is_running: true,
        total_trades: 0,
        active_positions: 0,
        backend_connected: true
      })
      res.json({
        success: true,
        message: 'Bot started successfully'
      })
    } else if (action === 'stop') {
      await db.updateBotStatus({
        is_running: false,
        total_trades: 0,
        active_positions: 0,
        backend_connected: true
      })
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
app.get('/api/trades', async (req, res) => {
  try {
    const trades = await db.getTrades()
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
app.get('/api/profit', async (req, res) => {
  try {
    const timeframe = req.query.timeframe || 'day'
    const profitData = await db.getProfitData(timeframe)
    
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
app.get('/api/bot/strategy', async (req, res) => {
  try {
    const strategy = await db.getStrategy()
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
app.post('/api/bot/strategy', async (req, res) => {
  try {
    const strategyData = req.body
    await db.updateStrategy(strategyData)
    
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

// Initialize database and start server
async function startServer() {
  try {
    await initializeDatabase()
    console.log('✅ Database initialized successfully')
    
    app.listen(PORT, () => {
      console.log(`🚀 Trading Bot Backend running on port ${PORT}`)
      console.log(`🔍 Health check: http://localhost:${PORT}/health`)
      console.log(`💰 Bot wallet: ${BOT_WALLET_ADDRESS}`)
      console.log(`📊 Database: Connected and ready`)
    })
  } catch (error) {
    console.error('❌ Failed to start server:', error)
    process.exit(1)
  }
}

startServer()
