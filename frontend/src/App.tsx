import { useEffect, useState } from 'react';
import { Bell, Boxes, ChevronRight, ClipboardList, Download, LayoutDashboard, LogOut, Package, Search, Users } from 'lucide-react';
import { api, apiRequest, downloadFile, login, type Role, type Session } from './lib/api';
import { Workspace } from './Workspace';

type ChallanSummary = { id: string; challanNumber: string; status: string; customerName: string; createdAt: string };
type Dashboard = { data: { metrics: { totalCustomers: number; totalProducts: number; lowStockCount: number }; lowStockProducts: Array<{ id: string; productName: string; sku: string; currentStock: number; minimumStockAlertQuantity: number }>; recentChallans: ChallanSummary[]; upcomingFollowUps: Array<{ id: string; customerName: string; businessName: string; followUpDate: string; status: string }> } };
type AnalyticsDetail = { saleDate: string; challanNumber: string; sellerName: string; customerName: string; businessName: string; productName: string; sku: string; quantity: number; unitPrice: number; revenue: number };
type Analytics = { data: { days: number; daily: Array<{ saleDate: string; challans: number; revenue: number; units: number }>; byUser: Array<{ userId: string; userName: string; challans: number; revenue: number; units: number }>; details: AnalyticsDetail[] } };
type Notification = { id: string; type: string; title: string; detail: string; priority: string; readAt: string | null; createdAt: string };

const nav: Array<{ label: string; icon: typeof LayoutDashboard; roles: Role[] }> = [
  { label: 'Overview', icon: LayoutDashboard, roles: ['ADMIN', 'SALES', 'WAREHOUSE', 'ACCOUNTS'] },
  { label: 'Customers', icon: Users, roles: ['ADMIN', 'SALES'] },
  { label: 'Products', icon: Package, roles: ['ADMIN', 'SALES', 'WAREHOUSE'] },
  { label: 'Stock movements', icon: Boxes, roles: ['ADMIN', 'SALES', 'WAREHOUSE'] },
  { label: 'Challans', icon: ClipboardList, roles: ['ADMIN', 'SALES', 'WAREHOUSE', 'ACCOUNTS'] },
];
const money = (value: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(Number(value));

function readStoredSession(): Session | null {
  try {
    const raw = localStorage.getItem('stockflow-session');
    if (!raw) return null;
    const candidate = JSON.parse(raw) as Session;
    const validRoles: Role[] = ['ADMIN', 'SALES', 'WAREHOUSE', 'ACCOUNTS'];
    if (!candidate?.token || typeof candidate.token !== 'string' || !candidate.user?.name || !candidate.user.email || !validRoles.includes(candidate.user.role)) {
      localStorage.removeItem('stockflow-session');
      return null;
    }
    return candidate;
  } catch {
    localStorage.removeItem('stockflow-session');
    return null;
  }
}

export function App() {
  const [session, setSession] = useState<Session | null>(readStoredSession);
  const [dashboard, setDashboard] = useState<Dashboard['data'] | null>(null);
  const [analytics, setAnalytics] = useState<Analytics['data'] | null>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [active, setActive] = useState('Overview');
  const [error, setError] = useState('');
  const [showChallan, setShowChallan] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);

  async function refreshWorkspace() {
    if (!session) return;
    try {
      const [dashboardResult, analyticsResult, notificationResult] = await Promise.all([
        api<Dashboard>('/api/dashboard', session.token),
        api<Analytics>('/api/analytics/sales?days=30', session.token),
        api<{ data: Notification[]; unreadCount: number }>('/api/notifications', session.token),
      ]);
      setDashboard(dashboardResult.data); setAnalytics(analyticsResult.data); setNotifications(notificationResult.data); setUnreadCount(notificationResult.unreadCount); setError('');
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Unable to load the workspace.'); }
  }

  useEffect(() => { refreshWorkspace(); const timer = window.setInterval(refreshWorkspace, 30000); return () => window.clearInterval(timer); }, [session]);
  useEffect(() => { const expire = () => setSession(null); window.addEventListener('stockflow-auth-expired', expire); return () => window.removeEventListener('stockflow-auth-expired', expire); }, []);
  if (!session) return <Login onSuccess={(next) => { localStorage.setItem('stockflow-session', JSON.stringify(next)); setSession(next); }} />;
  const visibleNav = nav.filter((item) => item.roles.includes(session.user.role));
  const canCreateChallan = session.user.role === 'ADMIN' || session.user.role === 'SALES';

  return <main className="shell">
    <aside className="sidebar"><div className="brand"><span className="brand-mark">S</span><span>Stockflow</span></div><p className="workspace">OPERATIONS PORTAL</p>
      <nav>{visibleNav.map(({ label, icon: Icon }) => <button key={label} className={active === label ? 'nav-item active' : 'nav-item'} onClick={() => setActive(label)}><Icon size={18}/><span>{label}</span></button>)}</nav>
      <div className="profile"><span className="avatar">{session.user.name[0]}</span><div><b>{session.user.name}</b><small>{session.user.role.toLowerCase()}</small></div><button aria-label="Sign out" onClick={() => { localStorage.removeItem('stockflow-session'); setSession(null); }}><LogOut size={17}/></button></div>
    </aside>
    <section className="content"><header><div><p className="eyebrow">Good morning, {session.user.name.split(' ')[0]}</p><h1>{active === 'Overview' ? 'Operations at a glance' : active}</h1></div><div className="header-actions"><div className="notification-wrap"><button className="icon-button" aria-label={`Notifications${unreadCount ? ` (${unreadCount} unread)` : ''}`} aria-expanded={showNotifications} onClick={() => setShowNotifications((shown) => !shown)}><Bell size={19}/>{unreadCount > 0 && <i/>}</button>{showNotifications && <NotificationPanel notifications={notifications} unreadCount={unreadCount} token={session.token} close={() => setShowNotifications(false)} refresh={refreshWorkspace} />}</div>{canCreateChallan && <button className="new-button" onClick={() => setShowChallan(true)}>+ New challan</button>}</div></header>
      {error && <p className="error">{error}</p>}
      {active === 'Overview' && <DashboardView dashboard={dashboard} analytics={analytics} token={session.token} />}
      {active !== 'Overview' && <Workspace section={active} token={session.token} role={session.user.role} />}
      {showChallan && canCreateChallan && <NewChallan token={session.token} onClose={() => setShowChallan(false)} onCreated={() => { setShowChallan(false); refreshWorkspace(); }} />}
    </section>
  </main>;
}

function Login({ onSuccess }: { onSuccess: (session: Session) => void }) {
  const [email, setEmail] = useState(import.meta.env.DEV ? 'sales@stockflow.test' : ''); const [password, setPassword] = useState(import.meta.env.DEV ? 'FundsRoom@123' : ''); const [error, setError] = useState(''); const [loading, setLoading] = useState(false);
  async function submit(event: React.FormEvent) { event.preventDefault(); setLoading(true); setError(''); try { onSuccess(await login(email, password)); } catch (reason) { setError(reason instanceof Error ? reason.message : 'Unable to sign in.'); } finally { setLoading(false); } }
  return <main className="login-page"><section className="login-copy"><span className="brand-mark">S</span><p className="eyebrow">WHOLESALE OPERATIONS</p><h1>Every order has a story.<br/>Keep it moving.</h1><p>Stockflow keeps sales, customers, and inventory in one calm, reliable workspace.</p><div className="ornament">01&nbsp;&nbsp; Customer to challan<br/>02&nbsp;&nbsp; Challan to stock movement</div></section><section className="login-panel"><form onSubmit={submit}><p className="eyebrow">WELCOME BACK</p><h2>Sign in to Stockflow</h2><p className="hint">{import.meta.env.DEV ? 'Use the local Sales account to explore the demo.' : 'Use the account assigned to you by your administrator.'}</p><label>Email<input value={email} onChange={(event) => setEmail(event.target.value)} type="email" autoComplete="username" /></label><label>Password<input value={password} onChange={(event) => setPassword(event.target.value)} type="password" autoComplete="current-password" /></label>{error && <p className="error">{error}</p>}<button className="login-button" disabled={loading}>{loading ? 'Signing in...' : 'Enter workspace'} <ChevronRight size={18}/></button>{import.meta.env.DEV && <p className="demo">Local demo password: <b>FundsRoom@123</b></p>}</form></section></main>;
}

function DashboardView(props: { dashboard: Dashboard['data'] | null; analytics: Analytics['data'] | null; token: string }) {
  if (!props.dashboard) return <p className="loading">Loading the live workspace...</p>;
  return <DashboardBody {...props} dashboard={props.dashboard} />;
}

function DashboardBody({ dashboard, analytics, token }: { dashboard: Dashboard['data']; analytics: Analytics['data'] | null; token: string }) {
  const [search, setSearch] = useState('');
  const [searchResults, setSearchResults] = useState<ChallanSummary[]>(dashboard.recentChallans);
  const [searching, setSearching] = useState(false);
  useEffect(() => {
    const handle = window.setTimeout(async () => {
      if (!search.trim()) { setSearchResults(dashboard.recentChallans); return; }
      setSearching(true);
      try { const result = await api<{ data: ChallanSummary[] }>(`/api/challans?limit=20&search=${encodeURIComponent(search.trim())}`, token); setSearchResults(result.data); }
      finally { setSearching(false); }
    }, 180);
    return () => window.clearTimeout(handle);
  }, [search, dashboard.recentChallans, token]);

  const daily = analytics?.daily ?? [];
  const maxRevenue = Math.max(...daily.map((item) => Number(item.revenue)), 1);
  const maxUserRevenue = Math.max(...(analytics?.byUser ?? []).map((item) => Number(item.revenue)), 1);
  const details = analytics?.details ?? [];
  const detailsByDate = new Map<string, AnalyticsDetail[]>();
  details.forEach((detail) => { const key = String(detail.saleDate).slice(0, 10); detailsByDate.set(key, [...(detailsByDate.get(key) ?? []), detail]); });
  const detailsByUser = (name: string) => details.filter((detail) => detail.sellerName === name);

  return <><div className="metric-grid"><Metric label="Customers" value={dashboard.metrics.totalCustomers} note="active relationships"/><Metric label="Products" value={dashboard.metrics.totalProducts} note="in catalogue"/><Metric label="Needs attention" value={dashboard.metrics.lowStockCount} note="low-stock products" tone="warm"/></div><div className="board"><section className="table-card"><div className="card-heading"><div><p className="eyebrow">INVENTORY WATCH</p><h2>Low-stock items</h2></div><button>View inventory <ChevronRight size={16}/></button></div><div className="table-head"><span>Product</span><span>SKU</span><span>Stock</span><span>Status</span></div>{dashboard.lowStockProducts.map((item) => <div className="table-row" key={item.id}><b>{item.productName}</b><span>{item.sku}</span><span>{item.currentStock} units</span><span className="status attention">Low stock</span></div>)}</section><section className="followups"><p className="eyebrow">CUSTOMER CARE</p><h2>Upcoming follow-ups</h2>{dashboard.upcomingFollowUps.map((item) => <div className="followup" key={item.id}><span className="avatar small">{item.customerName[0]}</span><div><b>{item.customerName}</b><small>{item.businessName}</small></div><span>{new Date(item.followUpDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span></div>)}</section></div><section className="analytics-grid"><section className="chart-card"><div className="card-heading"><div><p className="eyebrow">SALES TREND</p><h2>Daily sales · last 30 days</h2></div><span className="chart-total">{money(daily.reduce((sum, item) => sum + Number(item.revenue), 0))}</span></div><div className="bar-chart" aria-label="Daily sales chart">{daily.length === 0 ? <p className="muted">No confirmed sales in this period yet.</p> : daily.map((item) => { const sales = detailsByDate.get(String(item.saleDate).slice(0, 10)) ?? []; return <div className="bar-column" key={item.saleDate}><div className="chart-tooltip" role="tooltip"><strong>{new Date(item.saleDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} · {money(Number(item.revenue))}</strong>{sales.map((sale) => <div className="tooltip-sale" key={`${sale.challanNumber}-${sale.sku}`}><b>{sale.sellerName} → {sale.customerName}</b><span>{sale.productName} · {sale.quantity} units · {money(Number(sale.revenue))}</span></div>)}</div><div className="bar" style={{ height: `${Math.max(6, Number(item.revenue) / maxRevenue * 100)}%` }}/><small>{new Date(item.saleDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</small></div>; })}</div></section><section className="chart-card"><div className="card-heading"><div><p className="eyebrow">SALES OWNERSHIP</p><h2>Sales by teammate</h2></div></div><div className="user-chart">{(analytics?.byUser ?? []).length === 0 ? <p className="muted">No confirmed sales in this period yet.</p> : analytics!.byUser.map((item) => <div className="user-bar" key={item.userId}><div><b>{item.userName}</b><small>{item.challans} challans · {item.units} units</small></div><div className="user-track user-track-tooltip"><span style={{ width: `${Math.max(8, Number(item.revenue) / maxUserRevenue * 100)}%` }}/><div className="chart-tooltip user-tooltip" role="tooltip">{detailsByUser(item.userName).map((sale) => <div className="tooltip-sale" key={`${sale.challanNumber}-${sale.sku}`}><b>{sale.customerName}</b><span>{sale.productName} · {sale.quantity} units · {money(Number(sale.revenue))}</span></div>)}</div></div><strong>{money(Number(item.revenue))}</strong></div>)}</div></section></section><section className="recent"><div className="card-heading"><div><p className="eyebrow">SALES DESK</p><h2>Recent challans</h2></div><label className="search search-input"><Search size={16}/><input aria-label="Search challans" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search challans, customer, business" />{searching && <small>Searching...</small>}</label><button className="export-button" onClick={() => downloadFile(`/api/challans/export.csv${search ? `?search=${encodeURIComponent(search)}` : ''}`, token, 'stockflow-challans.csv')}><Download size={15}/> Export CSV</button></div>{searchResults.length === 0 ? <p className="muted">No challans match “{search}”.</p> : searchResults.map((item) => <div className="challan" key={item.id}><b>{item.challanNumber}</b><span>{item.customerName}</span><span className={`status ${item.status === 'CONFIRMED' ? 'confirmed' : ''}`}>{item.status.toLowerCase()}</span><button className="text-button" onClick={() => downloadFile(`/api/challans/${item.id}/pdf`, token, `${item.challanNumber}.pdf`)}><Download size={14}/> PDF</button></div>)}</section></>;
}

function NotificationPanel({ notifications, unreadCount, token, close, refresh }: { notifications: Notification[]; unreadCount: number; token: string; close: () => void; refresh: () => Promise<void> }) { return <aside className="notification-panel"><div className="notification-heading"><div><p className="eyebrow">INBOX</p><h2>Notifications</h2><small>{unreadCount} unread · updates every 30 seconds</small></div><div className="notification-actions"><button disabled={!unreadCount} onClick={() => apiRequest('/api/notifications/read-all', token, 'PATCH').then(refresh)}>Mark all read</button><button onClick={close}>Close</button></div></div>{notifications.length === 0 ? <p className="muted">You are all caught up.</p> : notifications.map((item) => <button className={`notification-item ${item.readAt ? 'read' : ''}`} key={item.id} onClick={() => !item.readAt && apiRequest(`/api/notifications/${item.id}/read`, token, 'PATCH').then(refresh)}><span className={`priority-dot ${item.priority.toLowerCase()}`}/><div><b>{item.title}{item.title.endsWith(' ') ? '' : ' '}{item.detail}</b><small>{item.type.replace('_', ' ').toLowerCase()} · {new Date(item.createdAt).toLocaleDateString()}{item.readAt ? ' · read' : ''}</small></div></button>)}</aside>; }
function Metric({ label, value, note, tone }: { label: string; value: number; note: string; tone?: string }) { return <section className={`metric ${tone ?? ''}`}><span>{label}</span><b>{value}</b><small>{note}</small></section>; }

function NewChallan({ token, onClose, onCreated }: { token: string; onClose: () => void; onCreated: () => void }) {
  const [customers, setCustomers] = useState<Array<{ id: string; customerName: string; businessName: string }>>([]); const [products, setProducts] = useState<Array<{ id: string; productName: string; sku: string; currentStock: number }>>([]);
  const [customerId, setCustomerId] = useState(''); const [productId, setProductId] = useState(''); const [quantity, setQuantity] = useState(1); const [items, setItems] = useState<Array<{ productId: string; quantity: number }>>([]); const [status, setStatus] = useState(''); const [saving, setSaving] = useState(false);
  useEffect(() => { Promise.all([api<{ data: typeof customers }>('/api/customers?limit=100', token), api<{ data: typeof products }>('/api/products?limit=100', token)]).then(([c, p]) => { setCustomers(c.data); setProducts(p.data); }).catch((reason) => setStatus(reason.message)); }, [token]);
  async function create(confirm: boolean) { if (!customerId || items.length === 0) return setStatus('Choose a customer and at least one product.'); setSaving(true); setStatus(''); try { const result = await apiRequest<{ data: { id: string; challanNumber: string } }>('/api/challans', token, 'POST', { customerId, items }); if (confirm) await apiRequest(`/api/challans/${result.data.id}/confirm`, token, 'PATCH'); setStatus(confirm ? `${result.data.challanNumber} confirmed. Stock was updated.` : `${result.data.challanNumber} saved as a draft.`); if (confirm) setTimeout(onCreated, 700); } catch (reason) { setStatus(reason instanceof Error ? reason.message : 'Unable to save challan.'); } finally { setSaving(false); } }
  return <div className="modal-backdrop" role="presentation"><section className="challan-modal" role="dialog" aria-modal="true" aria-label="Create new challan"><div className="card-heading"><div><p className="eyebrow">SALES DESK</p><h2>New challan</h2></div><button onClick={onClose}>Close</button></div><label>Customer<select value={customerId} onChange={(event) => setCustomerId(event.target.value)}><option value="">Select customer</option>{customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.customerName} - {customer.businessName}</option>)}</select></label><div className="item-picker"><label>Product<select value={productId} onChange={(event) => setProductId(event.target.value)}><option value="">Select product</option>{products.map((product) => <option key={product.id} value={product.id}>{product.productName} ({product.currentStock} available)</option>)}</select></label><label>Quantity<input type="number" min="1" value={quantity} onChange={(event) => setQuantity(Number(event.target.value))}/></label><button type="button" onClick={() => { if (productId && quantity > 0 && !items.some((item) => item.productId === productId)) setItems([...items, { productId, quantity }]); }}>Add item</button></div><div className="chosen-items">{items.map((item) => { const product = products.find((row) => row.id === item.productId)!; return <div key={item.productId}><span>{product.productName}</span><span>{item.quantity} units</span><button onClick={() => setItems(items.filter((row) => row.productId !== item.productId))}>Remove</button></div>; })}</div>{status && <p className={status.includes('confirmed') || status.includes('draft') ? 'success' : 'error'}>{status}</p>}<div className="modal-actions"><button onClick={onClose}>Cancel</button><button disabled={saving} onClick={() => create(false)}>Save draft</button><button className="new-button" disabled={saving} onClick={() => create(true)}>Confirm challan</button></div></section></div>;
}
