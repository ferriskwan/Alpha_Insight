/**
 * API Contracts & Data Transfer Objects (DTO)
 * Epic 0.2: Foundational Admin, Site Map, Trans Cost, Ref Data
 * Frozen Contract for [STREAM: BE], [STREAM: FE], [STREAM: QA]
 */

export type UserRoleType = 'admin' | 'analyst' | 'user';

export interface UserSummary {
  id: number;
  email: string;
  name: string | null;
  picture: string | null;
  roles: UserRoleType[];
  status: 'active' | 'suspended';
  created_at: string;
}

export interface SiteMapNode {
  id: number;
  parent_id: number | null;
  menu_code: string;
  label: string;
  route: string;
  icon: string | null;
  role_required: UserRoleType;
  order_index: number;
  is_active: boolean;
  children?: SiteMapNode[];
}

export interface SiteMapCreateRequest {
  parent_id?: number | null;
  menu_code: string;
  label: string;
  route: string;
  icon?: string | null;
  role_required?: UserRoleType;
  order_index?: number;
  is_active?: boolean;
}

export interface SiteMapUpdateRequest {
  label?: string;
  route?: string;
  icon?: string | null;
  role_required?: UserRoleType;
  order_index?: number;
  is_active?: boolean;
}

export interface AuditLogEntry {
  id: number;
  user_id: number | null;
  user_email?: string | null;
  action: string;
  entity: string;
  entity_id: string | null;
  old_values: Record<string, unknown> | null;
  new_values: Record<string, unknown> | null;
  ip_address: string | null;
  user_agent: string | null;
  timestamp: string;
}

export interface TransCostItem {
  id: number;
  user_id: number;
  trade_id: number | null;
  cost_type: 'commission' | 'sec_fee' | 'finra_taf' | 'platform_fee' | 'borrow_fee' | 'other';
  amount: number;
  currency: string;
  date: string;
  remarks: string | null;
  created_at: string;
}

export interface TransCostCreateRequest {
  trade_id?: number | null;
  cost_type: string;
  amount: number;
  currency?: string;
  date: string;
  remarks?: string | null;
}

export interface RefChartSettingsDTO {
  id: number;
  user_id: number | null;
  symbol: string | null;
  sma_period: number;
  ema_period: number;
  bb_period: number;
  bb_std: number;
  rsi_period: number;
  rsi_ob: number;
  rsi_os: number;
  macd_fast: number;
  macd_slow: number;
  macd_signal: number;
}

export interface RefDataSysValue {
  name: string;
  type: string;
  strvalue: string | null;
  numvalue: number | null;
  datevalue: string | null;
  description: string | null;
  updatetimestamp?: string | null;
}

export interface RefDataSysValueUpdate {
  strvalue?: string | null;
  numvalue?: number | null;
  datevalue?: string | null;
  description?: string | null;
}
