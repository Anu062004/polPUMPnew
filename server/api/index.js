/**
 * API Server for POL Pump
 * Provides REST endpoints for frontend to query indexed data
 */

const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

// Database connection
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'polpump',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
});

// Middleware for error handling
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

// ==================== TOKENS ====================

/**
 * GET /api/tokens
 * Get paginated list of tokens with filters and sorting
 */
app.get('/api/tokens', asyncHandler(async (req, res) => {
  const {
    page = 1,
    limit = 20,
    sort = 'created_at', // created_at, volume_24h, trades_count
    order = 'DESC',
    search = '',
    creator = '',
  } = req.query;

  const offset = (parseInt(page) - 1) * parseInt(limit);
  const validSorts = ['created_at', 'volume_24h', 'trades_count'];
  const sortField = validSorts.includes(sort) ? sort : 'created_at';
  const sortOrder = order.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

  let query = `
    SELECT 
      t.*,
      COALESCE(SUM(CASE WHEN tr.timestamp > NOW() - INTERVAL '24 hours' 
        THEN tr.amount_in ELSE 0 END), 0) as volume_24h,
      COUNT(DISTINCT tr.id) as trades_count,
      COUNT(DISTINCT tr.trader) as unique_traders
    FROM tokens t
    LEFT JOIN trades tr ON t.id = tr.token_id
    WHERE 1=1
  `;
  const params = [];
  let paramCount = 1;

  if (search) {
    query += ` AND (t.name ILIKE $${paramCount} OR t.symbol ILIKE $${paramCount})`;
    params.push(`%${search}%`);
    paramCount++;
  }

  if (creator) {
    query += ` AND t.creator = $${paramCount}`;
    params.push(creator);
    paramCount++;
  }

  query += ` GROUP BY t.id ORDER BY ${sortField} ${sortOrder} LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
  params.push(parseInt(limit), offset);

  const result = await pool.query(query, params);
  const countResult = await pool.query('SELECT COUNT(DISTINCT t.id) as total FROM tokens t' + (search ? ' WHERE t.name ILIKE $1 OR t.symbol ILIKE $1' : ''), search ? [`%${search}%`] : []);

  res.json({
    tokens: result.rows,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total: parseInt(countResult.rows[0].total),
      totalPages: Math.ceil(countResult.rows[0].total / parseInt(limit)),
    },
  });
}));

/**
 * GET /api/tokens/:address
 * Get detailed token information
 */
app.get('/api/tokens/:address', asyncHandler(async (req, res) => {
  const { address } = req.params;

  const tokenResult = await pool.query(
    `SELECT * FROM tokens WHERE token_address = $1`,
    [address]
  );

  if (tokenResult.rows.length === 0) {
    return res.status(404).json({ error: 'Token not found' });
  }

  const token = tokenResult.rows[0];

  // Get trading stats
  const statsResult = await pool.query(
    `SELECT 
      COUNT(*) as total_trades,
      COUNT(DISTINCT trader) as unique_traders,
      SUM(CASE WHEN trade_type = 'buy' THEN amount_in ELSE 0 END) as total_volume_buy,
      SUM(CASE WHEN trade_type = 'sell' THEN amount_out ELSE 0 END) as total_volume_sell,
      SUM(CASE WHEN timestamp > NOW() - INTERVAL '24 hours' THEN amount_in ELSE 0 END) as volume_24h
    FROM trades WHERE token_id = $1`,
    [token.id]
  );

  // Get recent trades
  const tradesResult = await pool.query(
    `SELECT * FROM trades WHERE token_id = $1 ORDER BY timestamp DESC LIMIT 50`,
    [token.id]
  );

  res.json({
    ...token,
    stats: statsResult.rows[0],
    recentTrades: tradesResult.rows,
  });
}));

// ==================== TRADES ====================

/**
 * GET /api/trades
 * Get paginated trades with filters
 */
app.get('/api/trades', asyncHandler(async (req, res) => {
  const {
    page = 1,
    limit = 50,
    token_address = '',
    trader = '',
  } = req.query;

  const offset = (parseInt(page) - 1) * parseInt(limit);

  let query = `
    SELECT tr.*, t.token_address, t.name, t.symbol
    FROM trades tr
    JOIN tokens t ON tr.token_id = t.id
    WHERE 1=1
  `;
  const params = [];
  let paramCount = 1;

  if (token_address) {
    query += ` AND t.token_address = $${paramCount}`;
    params.push(token_address);
    paramCount++;
  }

  if (trader) {
    query += ` AND tr.trader = $${paramCount}`;
    params.push(trader);
    paramCount++;
  }

  query += ` ORDER BY tr.timestamp DESC LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
  params.push(parseInt(limit), offset);

  const result = await pool.query(query, params);

  res.json({
    trades: result.rows,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
    },
  });
}));

// ==================== USERS ====================

/**
 * GET /api/users/:wallet
 * Get user profile and stats
 */
app.get('/api/users/:wallet', asyncHandler(async (req, res) => {
  const { wallet } = req.params;

  const userResult = await pool.query(
    `SELECT * FROM users WHERE wallet = $1`,
    [wallet]
  );

  if (userResult.rows.length === 0) {
    return res.status(404).json({ error: 'User not found' });
  }

  const user = userResult.rows[0];

  // Get user's tokens
  const tokensResult = await pool.query(
    `SELECT * FROM tokens WHERE creator = $1 ORDER BY created_at DESC`,
    [wallet]
  );

  // Get user's trades
  const tradesResult = await pool.query(
    `SELECT tr.*, t.name, t.symbol, t.token_address
     FROM trades tr
     JOIN tokens t ON tr.token_id = t.id
     WHERE tr.trader = $1
     ORDER BY tr.timestamp DESC LIMIT 20`,
    [wallet]
  );

  res.json({
    ...user,
    tokens: tokensResult.rows,
    recentTrades: tradesResult.rows,
  });
}));

/**
 * GET /api/leaderboard
 * Get leaderboard by various metrics
 */
app.get('/api/leaderboard', asyncHandler(async (req, res) => {
  const { metric = 'xp', limit = 100 } = req.query;

  const validMetrics = ['xp', 'trades_count', 'total_spent', 'tokens_created'];
  const sortMetric = validMetrics.includes(metric) ? metric : 'xp';

  const result = await pool.query(
    `SELECT wallet, xp, level, total_spent, tokens_created, trades_count
     FROM users
     ORDER BY ${sortMetric} DESC
     LIMIT $1`,
    [parseInt(limit)]
  );

  res.json({
    leaderboard: result.rows,
    metric: sortMetric,
  });
}));

// ==================== STATS ====================

/**
 * GET /api/stats
 * Get global platform statistics
 */
app.get('/api/stats', asyncHandler(async (req, res) => {
  const statsResult = await pool.query(`
    SELECT 
      COUNT(DISTINCT t.id) as total_tokens,
      COUNT(DISTINCT u.wallet) as total_users,
      COUNT(DISTINCT tr.id) as total_trades,
      SUM(CASE WHEN tr.timestamp > NOW() - INTERVAL '24 hours' THEN tr.amount_in ELSE 0 END) as volume_24h,
      SUM(CASE WHEN tr.timestamp > NOW() - INTERVAL '7 days' THEN tr.amount_in ELSE 0 END) as volume_7d
    FROM tokens t
    LEFT JOIN users u ON 1=1
    LEFT JOIN trades tr ON t.id = tr.token_id
  `);

  res.json(statsResult.rows[0]);
}));

// ==================== HEALTH ====================

app.get('/health', asyncHandler(async (req, res) => {
  await pool.query('SELECT 1');
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
}));

// Error handler
app.use((err, req, res, next) => {
  console.error('API Error:', err);
  res.status(500).json({ error: 'Internal server error', message: err.message });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`🚀 API server running on port ${PORT}`);
});

module.exports = app;


