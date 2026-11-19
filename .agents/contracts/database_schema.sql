-- Database Schema Snapshot: 4leafclover_dev (PostgreSQL)
-- Epic 0.2: Foundational Admin, Site Map, Trans Cost, Ref Chart Settings
-- Revision: 0003

CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255),
    picture TEXT,
    google_id VARCHAR(255),
    status VARCHAR(32) DEFAULT 'active' NOT NULL,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updatetimestamp TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS user_roles (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(64) NOT NULL,
    status VARCHAR(32) DEFAULT 'active' NOT NULL,
    assigned_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updatetimestamp TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_user_roles_user_role UNIQUE (user_id, role)
);

CREATE TABLE IF NOT EXISTS site_map (
    id SERIAL PRIMARY KEY,
    parent_id INTEGER REFERENCES site_map(id) ON DELETE CASCADE,
    menu_code VARCHAR(64) UNIQUE NOT NULL,
    label VARCHAR(128) NOT NULL,
    route VARCHAR(255) NOT NULL,
    icon VARCHAR(64),
    role_required VARCHAR(64) DEFAULT 'user' NOT NULL,
    order_index INTEGER DEFAULT 0 NOT NULL,
    is_active BOOLEAN DEFAULT TRUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_site_map_parent_id ON site_map(parent_id);
CREATE INDEX IF NOT EXISTS ix_site_map_menu_code ON site_map(menu_code);
CREATE INDEX IF NOT EXISTS ix_site_map_order_index ON site_map(order_index);

CREATE TABLE IF NOT EXISTS audit_log (
    id BIGSERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(64) NOT NULL,
    entity VARCHAR(64) NOT NULL,
    entity_id VARCHAR(64),
    old_values JSONB,
    new_values JSONB,
    ip_address VARCHAR(45),
    user_agent VARCHAR(512),
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_audit_log_user_id ON audit_log(user_id);
CREATE INDEX IF NOT EXISTS ix_audit_log_action ON audit_log(action);
CREATE INDEX IF NOT EXISTS ix_audit_log_entity ON audit_log(entity);
CREATE INDEX IF NOT EXISTS ix_audit_log_timestamp ON audit_log(timestamp);

CREATE TABLE IF NOT EXISTS trans_cost (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    trade_id INTEGER REFERENCES trade(id) ON DELETE SET NULL,
    cost_type VARCHAR(32) NOT NULL,
    amount NUMERIC(12, 4) NOT NULL,
    currency VARCHAR(8) DEFAULT 'USD' NOT NULL,
    date DATE NOT NULL,
    remarks TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_trans_cost_user_id ON trans_cost(user_id);
CREATE INDEX IF NOT EXISTS ix_trans_cost_trade_id ON trans_cost(trade_id);
CREATE INDEX IF NOT EXISTS ix_trans_cost_date ON trans_cost(date);

CREATE TABLE IF NOT EXISTS ref_chart_settings (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    symbol VARCHAR(16),
    sma_period INTEGER DEFAULT 30 NOT NULL,
    ema_period INTEGER DEFAULT 100 NOT NULL,
    bb_period INTEGER DEFAULT 30 NOT NULL,
    bb_std FLOAT DEFAULT 2.0 NOT NULL,
    rsi_period INTEGER DEFAULT 13 NOT NULL,
    rsi_ob FLOAT DEFAULT 70.0 NOT NULL,
    rsi_os FLOAT DEFAULT 30.0 NOT NULL,
    macd_fast INTEGER DEFAULT 12 NOT NULL,
    macd_slow INTEGER DEFAULT 26 NOT NULL,
    macd_signal INTEGER DEFAULT 9 NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_ref_chart_settings_user_id ON ref_chart_settings(user_id);
CREATE INDEX IF NOT EXISTS ix_ref_chart_settings_symbol ON ref_chart_settings(symbol);
