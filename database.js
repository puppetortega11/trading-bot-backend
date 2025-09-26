const { Pool } = require('pg')
require('dotenv').config()

// Database connection configuration
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
})

// Initialize database tables
async function initializeDatabase() {
  try {
    console.log('🔧 Initializing database...')
    
    // Create tables
    await pool.query(`
      CREATE TABLE IF NOT EXISTS bot_status (
        id SERIAL PRIMARY KEY,
        is_running BOOLEAN DEFAULT false,
        last_update TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        total_trades INTEGER DEFAULT 0,
        active_positions INTEGER DEFAULT 0,
        backend_connected BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `)

    await pool.query(`
      CREATE TABLE IF NOT EXISTS trades (
        id SERIAL PRIMARY KEY,
        trade_id VARCHAR(255) UNIQUE NOT NULL,
        token_symbol VARCHAR(50) NOT NULL,
        action VARCHAR(10) NOT NULL CHECK (action IN ('buy', 'sell')),
        amount BIGINT NOT NULL,
        price DECIMAL(20, 8) NOT NULL,
        profit_loss DECIMAL(20, 8) DEFAULT 0,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed')),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `)

    await pool.query(`
      CREATE TABLE IF NOT EXISTS profit_data (
        id SERIAL PRIMARY KEY,
        timeframe VARCHAR(20) NOT NULL,
        total_profit DECIMAL(20, 8) DEFAULT 0,
        total_loss DECIMAL(20, 8) DEFAULT 0,
        net_profit DECIMAL(20, 8) DEFAULT 0,
        win_rate DECIMAL(5, 2) DEFAULT 0,
        total_trades INTEGER DEFAULT 0,
        chart_data JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `)

    await pool.query(`
      CREATE TABLE IF NOT EXISTS bot_strategy (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        risk_level VARCHAR(20) NOT NULL,
        expected_return VARCHAR(50),
        max_position VARCHAR(20),
        stop_loss VARCHAR(20),
        take_profit VARCHAR(20),
        enabled BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `)

    await pool.query(`
      CREATE TABLE IF NOT EXISTS wallet_balances (
        id SERIAL PRIMARY KEY,
        wallet_address VARCHAR(255) NOT NULL,
        balance DECIMAL(20, 8) NOT NULL,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `)

    await pool.query(`
      CREATE TABLE IF NOT EXISTS user_interactions (
        id SERIAL PRIMARY KEY,
        user_wallet VARCHAR(255),
        action VARCHAR(100) NOT NULL,
        amount DECIMAL(20, 8),
        status VARCHAR(20) DEFAULT 'pending',
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        metadata JSONB
      )
    `)

    // Insert initial bot status
    await pool.query(`
      INSERT INTO bot_status (is_running, total_trades, active_positions, backend_connected)
      VALUES (false, 0, 0, true)
      ON CONFLICT DO NOTHING
    `)

    // Insert default strategy
    await pool.query(`
      INSERT INTO bot_strategy (name, description, risk_level, expected_return, max_position, stop_loss, take_profit, enabled)
      VALUES (
        'Aggressive Meme Token Strategy',
        'High-frequency trading strategy focused on Solana meme tokens with advanced technical analysis',
        'High',
        '15-25% daily',
        '10%',
        '5%',
        '15%',
        true
      )
      ON CONFLICT DO NOTHING
    `)

    console.log('✅ Database initialized successfully')
  } catch (error) {
    console.error('❌ Database initialization failed:', error)
    throw error
  }
}

// Database query helpers
const db = {
  // Bot status operations
  async getBotStatus() {
    const result = await pool.query(`
      SELECT is_running, last_update, total_trades, active_positions, backend_connected
      FROM bot_status
      ORDER BY created_at DESC
      LIMIT 1
    `)
    return result.rows[0] || {
      is_running: false,
      last_update: new Date().toISOString(),
      total_trades: 0,
      active_positions: 0,
      backend_connected: true
    }
  },

  async updateBotStatus(status) {
    await pool.query(`
      INSERT INTO bot_status (is_running, total_trades, active_positions, backend_connected)
      VALUES ($1, $2, $3, $4)
    `, [status.is_running, status.total_trades, status.active_positions, status.backend_connected])
  },

  // Trades operations
  async getTrades() {
    const result = await pool.query(`
      SELECT trade_id as id, token_symbol as token, action, amount, price, profit_loss as profit, timestamp
      FROM trades
      ORDER BY timestamp DESC
      LIMIT 100
    `)
    return result.rows
  },

  async addTrade(trade) {
    await pool.query(`
      INSERT INTO trades (trade_id, token_symbol, action, amount, price, profit_loss, status)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    `, [trade.id, trade.token, trade.action, trade.amount, trade.price, trade.profit || 0, 'completed'])
  },

  // Profit data operations
  async getProfitData(timeframe = 'day') {
    const result = await pool.query(`
      SELECT total_profit, total_loss, net_profit, win_rate, total_trades, chart_data
      FROM profit_data
      WHERE timeframe = $1
      ORDER BY updated_at DESC
      LIMIT 1
    `, [timeframe])
    
    if (result.rows.length === 0) {
      return {
        timeframe,
        totalProfit: 0,
        totalLoss: 0,
        netProfit: 0,
        winRate: 0,
        trades: 0,
        chartData: [
          { time: '00:00', profit: 0 },
          { time: '06:00', profit: 0 },
          { time: '12:00', profit: 0 },
          { time: '18:00', profit: 0 }
        ]
      }
    }

    const row = result.rows[0]
    return {
      timeframe,
      totalProfit: parseFloat(row.total_profit),
      totalLoss: parseFloat(row.total_loss),
      netProfit: parseFloat(row.net_profit),
      winRate: parseFloat(row.win_rate),
      trades: row.total_trades,
      chartData: row.chart_data || []
    }
  },

  async updateProfitData(timeframe, data) {
    await pool.query(`
      INSERT INTO profit_data (timeframe, total_profit, total_loss, net_profit, win_rate, total_trades, chart_data)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (timeframe) DO UPDATE SET
        total_profit = EXCLUDED.total_profit,
        total_loss = EXCLUDED.total_loss,
        net_profit = EXCLUDED.net_profit,
        win_rate = EXCLUDED.win_rate,
        total_trades = EXCLUDED.total_trades,
        chart_data = EXCLUDED.chart_data,
        updated_at = CURRENT_TIMESTAMP
    `, [timeframe, data.totalProfit, data.totalLoss, data.netProfit, data.winRate, data.trades, JSON.stringify(data.chartData)])
  },

  // Strategy operations
  async getStrategy() {
    const result = await pool.query(`
      SELECT name, description, risk_level, expected_return, max_position, stop_loss, take_profit, enabled
      FROM bot_strategy
      ORDER BY updated_at DESC
      LIMIT 1
    `)
    return result.rows[0] || {
      name: 'Default Strategy',
      description: 'Basic trading strategy',
      riskLevel: 'Medium',
      expectedReturn: '10% daily',
      maxPosition: '5%',
      stopLoss: '3%',
      takeProfit: '10%',
      enabled: true
    }
  },

  async updateStrategy(strategy) {
    await pool.query(`
      INSERT INTO bot_strategy (name, description, risk_level, expected_return, max_position, stop_loss, take_profit, enabled)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT (name) DO UPDATE SET
        description = EXCLUDED.description,
        risk_level = EXCLUDED.risk_level,
        expected_return = EXCLUDED.expected_return,
        max_position = EXCLUDED.max_position,
        stop_loss = EXCLUDED.stop_loss,
        take_profit = EXCLUDED.take_profit,
        enabled = EXCLUDED.enabled,
        updated_at = CURRENT_TIMESTAMP
    `, [strategy.name, strategy.description, strategy.riskLevel, strategy.expectedReturn, strategy.maxPosition, strategy.stopLoss, strategy.takeProfit, strategy.enabled])
  },

  // Wallet balance operations
  async recordWalletBalance(address, balance) {
    await pool.query(`
      INSERT INTO wallet_balances (wallet_address, balance)
      VALUES ($1, $2)
    `, [address, balance])
  },

  // User interaction logging
  async logUserInteraction(userWallet, action, amount = null, status = 'completed', metadata = {}) {
    await pool.query(`
      INSERT INTO user_interactions (user_wallet, action, amount, status, metadata)
      VALUES ($1, $2, $3, $4, $5)
    `, [userWallet, action, amount, status, JSON.stringify(metadata)])
  }
}

module.exports = { pool, initializeDatabase, db }
