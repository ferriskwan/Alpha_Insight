import React, { useState, useEffect } from 'react';
import {
  Plus,
  Trash2,
  Edit2,
  Database,
  RefreshCw,
  Check,
  X,
  AlertCircle,
} from 'lucide-react';
import { apiClient } from '../../services/apiClient';
import {
  BentoCard,
  SegmentedControl,
  ResponsiveTable,
  TableColumn,
  Button,
  FormField,
  Input,
  Select,
  Badge,
} from '../../design-system';

type SubTab = 'watchlist' | 'trade' | 'capital' | 'sysvalue';

export const TransactionEditor: React.FC = () => {
  const [activeSubTab, setActiveSubTab] = useState<SubTab>('watchlist');
  const [items, setItems] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState<boolean>(false);

  // Forms State
  const [wlForm, setWlForm] = useState({
    watchlistname: 'Default',
    symbol: '',
    name: '',
    timezone: 'America/New_York',
    currency: 'USD',
  });

  const [tradeForm, setTradeForm] = useState({
    symbol: '',
    buysell: 'B',
    tradedate: new Date().toISOString().slice(0, 10),
    investment: true,
    price: '',
    quantity: '',
    remarks: '',
  });

  const [capitalForm, setCapitalForm] = useState({
    broker: 'IBKR',
    transtype: 'D',
    accounttype: 'C',
    amount: '',
    date: new Date().toISOString().slice(0, 10),
    currency: 'USD',
    remarks: '',
  });

  const [sysForm, setSysForm] = useState({
    name: '',
    type: 'STR',
    strvalue: '',
    numvalue: '',
    datevalue: '',
    description: '',
  });

  const loadData = async (entity: SubTab) => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiClient.getTransactions<Record<string, unknown>>(entity);
      setItems(data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to fetch items';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData(activeSubTab);
    setShowAddForm(false);
  }, [activeSubTab]);

  const handleDelete = async (row: Record<string, unknown>) => {
    if (!window.confirm('Are you sure you want to delete this record?')) return;
    try {
      await apiClient.deleteTransaction(activeSubTab, row);
      loadData(activeSubTab);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Delete failed';
      setError(msg);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      let payload: unknown = null;
      if (activeSubTab === 'watchlist') {
        payload = { ...wlForm };
      } else if (activeSubTab === 'trade') {
        payload = {
          ...tradeForm,
          price: Number(tradeForm.price),
          quantity: Number(tradeForm.quantity),
        };
      } else if (activeSubTab === 'capital') {
        payload = {
          ...capitalForm,
          amount: Number(capitalForm.amount),
        };
      } else if (activeSubTab === 'sysvalue') {
        payload = {
          ...sysForm,
          numvalue: sysForm.numvalue ? Number(sysForm.numvalue) : null,
        };
      }

      await apiClient.createTransaction(activeSubTab, payload);
      setShowAddForm(false);
      loadData(activeSubTab);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Create failed';
      setError(msg);
    }
  };

  // Dynamic columns based on subTab
  const getColumns = (): TableColumn<Record<string, unknown>>[] => {
    const actionColumn: TableColumn<Record<string, unknown>> = {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      render: (r) => (
        <button
          type="button"
          onClick={() => handleDelete(r)}
          className="p-1 text-secondary hover:text-semantic-negative transition-colors"
          title="Delete"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      ),
    };

    if (activeSubTab === 'watchlist') {
      return [
        { key: 'watchlistname', header: 'Watchlist' },
        { key: 'symbol', header: 'Symbol', render: (r) => <strong className="text-primary font-bold">{String(r.symbol)}</strong> },
        { key: 'name', header: 'Company Name' },
        { key: 'timezone', header: 'Timezone' },
        { key: 'currency', header: 'Currency', render: (r) => <Badge variant="neutral">{String(r.currency)}</Badge> },
        actionColumn,
      ];
    }

    if (activeSubTab === 'trade') {
      return [
        { key: 'tradedate', header: 'Trade Date' },
        { key: 'symbol', header: 'Symbol', render: (r) => <strong className="text-primary">{String(r.symbol)}</strong> },
        {
          key: 'buysell',
          header: 'Side',
          render: (r) => (
            <Badge variant={r.buysell === 'B' ? 'buy' : 'sell'}>
              {r.buysell === 'B' ? 'BUY' : 'SELL'}
            </Badge>
          ),
        },
        {
          key: 'investment',
          header: 'Ledger',
          render: (r) => (
            <Badge variant={r.investment ? 'cash' : 'margin'}>
              {r.investment ? 'Investment' : 'Leverage'}
            </Badge>
          ),
        },
        { key: 'quantity', header: 'Quantity', align: 'right', render: (r) => Number(r.quantity).toLocaleString() },
        { key: 'price', header: 'Price', align: 'right', render: (r) => `$${Number(r.price).toFixed(2)}` },
        { key: 'remarks', header: 'Remarks' },
        actionColumn,
      ];
    }

    if (activeSubTab === 'capital') {
      return [
        { key: 'date', header: 'Date' },
        { key: 'broker', header: 'Broker' },
        {
          key: 'transtype',
          header: 'Type',
          render: (r) => {
            const t = String(r.transtype);
            const label = t === 'D' ? 'Deposit' : t === 'W' ? 'Withdrawal' : t === 'I' ? 'Initial Funding' : t;
            return <Badge variant={t === 'D' || t === 'I' ? 'positive' : 'negative'}>{label}</Badge>;
          },
        },
        {
          key: 'accounttype',
          header: 'Account',
          render: (r) => (
            <Badge variant={r.accounttype === 'C' || r.accounttype === 'Cash' ? 'cash' : 'margin'}>
              {r.accounttype === 'C' || r.accounttype === 'Cash' ? 'Cash' : 'Margin'}
            </Badge>
          ),
        },
        {
          key: 'amount',
          header: 'Amount',
          align: 'right',
          render: (r) => `$${Number(r.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}`,
        },
        { key: 'currency', header: 'Currency', render: (r) => <Badge variant="neutral">{String(r.currency)}</Badge> },
        actionColumn,
      ];
    }

    // sysvalue
    return [
      { key: 'name', header: 'Param Name', render: (r) => <strong className="text-primary">{String(r.name)}</strong> },
      { key: 'type', header: 'Type', render: (r) => <Badge variant="neutral">{String(r.type)}</Badge> },
      { key: 'strvalue', header: 'String Value' },
      { key: 'numvalue', header: 'Numeric Value', align: 'right' },
      { key: 'datevalue', header: 'Date Value' },
      { key: 'description', header: 'Description' },
      actionColumn,
    ];
  };

  return (
    <div className="space-y-4">
      <BentoCard
        title="Transaction & Master Data Editor"
        subtitle="Maintain watchlists, trade executions, capital funding, and system parameters"
        icon={<Database className="w-4 h-4 text-accent-primary" />}
        headerRight={
          <div className="flex items-center gap-2">
            <Button
              variant="primary"
              size="sm"
              onClick={() => setShowAddForm((prev) => !prev)}
              icon={showAddForm ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
            >
              {showAddForm ? 'Cancel' : 'New Entry'}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              loading={loading}
              onClick={() => loadData(activeSubTab)}
              icon={<RefreshCw className="w-3.5 h-3.5" />}
            />
          </div>
        }
      >
        <SegmentedControl<SubTab>
          options={[
            { value: 'watchlist', label: 'Watchlist' },
            { value: 'trade', label: 'Trades' },
            { value: 'capital', label: 'Capital' },
            { value: 'sysvalue', label: 'System Params' },
          ]}
          value={activeSubTab}
          onChange={(tab) => setActiveSubTab(tab)}
          size="md"
        />

        {error && (
          <div className="mt-3 p-3 rounded-lg bg-semantic-negative/15 border border-semantic-negative/30 flex items-start gap-2 text-xs text-semantic-negative">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Add Entry Drawer / Card */}
        {showAddForm && (
          <form onSubmit={handleCreate} className="mt-4 p-4 rounded-xl bg-surface-elevated/70 border border-subtle space-y-3">
            <span className="text-xs font-bold text-accent-primary uppercase tracking-wider block">
              Add New {activeSubTab.toUpperCase()} Record
            </span>

            {activeSubTab === 'watchlist' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                <FormField label="Symbol" required>
                  <Input
                    value={wlForm.symbol}
                    onChange={(e) => setWlForm({ ...wlForm, symbol: e.target.value.toUpperCase() })}
                    placeholder="AAPL"
                    required
                  />
                </FormField>
                <FormField label="Name" required>
                  <Input
                    value={wlForm.name}
                    onChange={(e) => setWlForm({ ...wlForm, name: e.target.value })}
                    placeholder="Apple Inc."
                    required
                  />
                </FormField>
                <FormField label="Currency">
                  <Select
                    value={wlForm.currency}
                    onChange={(e) => setWlForm({ ...wlForm, currency: e.target.value })}
                  >
                    <option value="USD">USD</option>
                    <option value="HKD">HKD</option>
                    <option value="SGD">SGD</option>
                  </Select>
                </FormField>
                <FormField label="Timezone">
                  <Input
                    value={wlForm.timezone}
                    onChange={(e) => setWlForm({ ...wlForm, timezone: e.target.value })}
                    placeholder="America/New_York"
                  />
                </FormField>
              </div>
            )}

            {activeSubTab === 'trade' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                <FormField label="Symbol" required>
                  <Input
                    value={tradeForm.symbol}
                    onChange={(e) => setTradeForm({ ...tradeForm, symbol: e.target.value.toUpperCase() })}
                    placeholder="AAPL"
                    required
                  />
                </FormField>
                <FormField label="Side">
                  <Select
                    value={tradeForm.buysell}
                    onChange={(e) => setTradeForm({ ...tradeForm, buysell: e.target.value })}
                  >
                    <option value="B">Buy</option>
                    <option value="S">Sell</option>
                  </Select>
                </FormField>
                <FormField label="Ledger">
                  <Select
                    value={tradeForm.investment ? 'true' : 'false'}
                    onChange={(e) => setTradeForm({ ...tradeForm, investment: e.target.value === 'true' })}
                  >
                    <option value="true">Investment (Cash)</option>
                    <option value="false">Leverage (Margin)</option>
                  </Select>
                </FormField>
                <FormField label="Trade Date" required>
                  <Input
                    type="date"
                    value={tradeForm.tradedate}
                    onChange={(e) => setTradeForm({ ...tradeForm, tradedate: e.target.value })}
                    required
                  />
                </FormField>
                <FormField label="Price" required>
                  <Input
                    type="number"
                    step="0.01"
                    value={tradeForm.price}
                    onChange={(e) => setTradeForm({ ...tradeForm, price: e.target.value })}
                    placeholder="150.00"
                    required
                  />
                </FormField>
                <FormField label="Quantity" required>
                  <Input
                    type="number"
                    step="1"
                    value={tradeForm.quantity}
                    onChange={(e) => setTradeForm({ ...tradeForm, quantity: e.target.value })}
                    placeholder="100"
                    required
                  />
                </FormField>
                <FormField label="Remarks" className="md:col-span-2">
                  <Input
                    value={tradeForm.remarks}
                    onChange={(e) => setTradeForm({ ...tradeForm, remarks: e.target.value })}
                    placeholder="Trade notes"
                  />
                </FormField>
              </div>
            )}

            {activeSubTab === 'capital' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                <FormField label="Broker" required>
                  <Input
                    value={capitalForm.broker}
                    onChange={(e) => setCapitalForm({ ...capitalForm, broker: e.target.value })}
                    required
                  />
                </FormField>
                <FormField label="Transaction Type">
                  <Select
                    value={capitalForm.transtype}
                    onChange={(e) => setCapitalForm({ ...capitalForm, transtype: e.target.value })}
                  >
                    <option value="D">Deposit</option>
                    <option value="W">Withdrawal</option>
                    <option value="I">Initial Funding</option>
                  </Select>
                </FormField>
                <FormField label="Account Type">
                  <Select
                    value={capitalForm.accounttype}
                    onChange={(e) => setCapitalForm({ ...capitalForm, accounttype: e.target.value })}
                  >
                    <option value="C">Cash</option>
                    <option value="M">Margin</option>
                  </Select>
                </FormField>
                <FormField label="Amount" required>
                  <Input
                    type="number"
                    step="0.01"
                    value={capitalForm.amount}
                    onChange={(e) => setCapitalForm({ ...capitalForm, amount: e.target.value })}
                    placeholder="10000.00"
                    required
                  />
                </FormField>
              </div>
            )}

            {activeSubTab === 'sysvalue' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                <FormField label="Param Name" required>
                  <Input
                    value={sysForm.name}
                    onChange={(e) => setSysForm({ ...sysForm, name: e.target.value })}
                    placeholder="GLOBAL_TODAY"
                    required
                  />
                </FormField>
                <FormField label="Type">
                  <Select
                    value={sysForm.type}
                    onChange={(e) =>
                      setSysForm({
                        ...sysForm,
                        type: e.target.value,
                        strvalue: '',
                        numvalue: '',
                        datevalue: '',
                      })
                    }
                  >
                    <option value="STR">STR</option>
                    <option value="NUM">NUM</option>
                    <option value="DATE">DATE</option>
                  </Select>
                </FormField>
                <FormField label="Value" required>
                  <Input
                    type={sysForm.type === 'NUM' ? 'number' : sysForm.type === 'DATE' ? 'date' : 'text'}
                    step={sysForm.type === 'NUM' ? 'any' : undefined}
                    value={
                      sysForm.type === 'NUM'
                        ? sysForm.numvalue
                        : sysForm.type === 'DATE'
                          ? sysForm.datevalue
                          : sysForm.strvalue
                    }
                    onChange={(e) => {
                      const val = e.target.value;
                      if (sysForm.type === 'NUM') {
                        setSysForm({ ...sysForm, numvalue: val, strvalue: '', datevalue: '' });
                      } else if (sysForm.type === 'DATE') {
                        setSysForm({ ...sysForm, datevalue: val, strvalue: '', numvalue: '' });
                      } else {
                        setSysForm({ ...sysForm, strvalue: val, numvalue: '', datevalue: '' });
                      }
                    }}
                    placeholder="Value"
                    required
                  />
                </FormField>
                <FormField label="Description">
                  <Input
                    value={sysForm.description}
                    onChange={(e) => setSysForm({ ...sysForm, description: e.target.value })}
                    placeholder="Parameter description"
                  />
                </FormField>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="ghost" size="sm" onClick={() => setShowAddForm(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" size="sm" icon={<Check className="w-3.5 h-3.5" />}>
                Save Record
              </Button>
            </div>
          </form>
        )}

        <div className="mt-4">
          <ResponsiveTable<Record<string, unknown>>
            columns={getColumns()}
            data={items}
            keyExtractor={(r, idx) => String(r.id ?? r.name ?? r.symbol ?? idx)}
            loading={loading}
          />
        </div>
      </BentoCard>
    </div>
  );
};

export default TransactionEditor;
