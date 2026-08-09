import { useEffect, useState, type ReactNode } from 'react';
import { Download, Search } from 'lucide-react';
import { api, apiRequest, downloadFile, type Role } from './lib/api';

type Props = { section: string; token: string; role: Role };
type Customer = { id:string; customerName:string; businessName:string; mobile:string; email?:string; customerType:string; status:string; address:string; followUpDate?:string };
type Product = { id:string; productName:string; sku:string; category:string; unitPrice:number; currentStock:number; minimumStockAlertQuantity:number; warehouseLocation:string; isLowStock:boolean };
type StockRequest = { id:string; productId:string; productName:string; sku:string; currentStock:number; quantity:number; urgency:'LOW'|'MEDIUM'|'HIGH'; message:string; status:'PENDING'|'APPROVED'|'REJECTED'; requestedBy:string; createdAt:string; reviewNote?:string; reviewedBy?:string };
type Challan = { id:string; challanNumber:string; customerName:string; businessName:string; status:string; totalQuantity:number; createdAt:string; createdBy?:string };
const dateOnly = (value?: string) => value ? new Date(value).toLocaleDateString(undefined, { year:'numeric', month:'short', day:'numeric' }) : 'Not set';

export function Workspace({ section, token, role }: Props) {
  if (section === 'Customers') return <Customers token={token} role={role}/>;
  if (section === 'Products') return <Products token={token} role={role}/>;
  if (section === 'Stock movements') return <Stock token={token} role={role}/>;
  return <Challans token={token}/>;
}

function Customers({ token, role }: {token:string; role:Role}) {
  const [rows,setRows]=useState<Customer[]>([]); const [search,setSearch]=useState(''); const [selected,setSelected]=useState<Customer|null>(null); const [show,setShow]=useState(false); const [message,setMessage]=useState('');
  const load=async (term = search)=>{ try { const result=await api<{data:Customer[]}>(`/api/customers?limit=100&search=${encodeURIComponent(term)}`,token); setRows(result.data); setMessage(''); } catch(e) { setMessage(e instanceof Error?e.message:'Unable to load customers.'); } };
  useEffect(()=>{ const timer=window.setTimeout(()=>load(search),180); return()=>window.clearTimeout(timer); },[search]);
  return <div className="workspace-page"><div className="toolbar"><label className="search toolbar-search"><Search size={16}/><input aria-label="Search customers" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search customers, business, mobile"/></label>{(role==='ADMIN'||role==='SALES')&&<button className="new-button" onClick={()=>setShow(true)}>+ Add customer</button>}</div>{message&&<p className="error">{message}</p>}<div className="workspace-grid"><section className="data-card"><div className="data-card-title"><div><p className="eyebrow">RELATIONSHIP DIRECTORY</p><h2>Customers</h2></div><span>{rows.length} records</span></div><div className="data-table"><div className="data-head"><span>Customer</span><span>Type</span><span>Status</span><span>Follow-up</span></div>{rows.map(r=><button className="data-row" key={r.id} onClick={()=>setSelected(r)}><b>{r.customerName}<small>{r.businessName}</small></b><span>{r.customerType.toLowerCase()}</span><span className={`status ${r.status==='ACTIVE'?'confirmed':''}`}>{r.status.toLowerCase()}</span><span>{dateOnly(r.followUpDate)}</span></button>)}{rows.length===0&&<p className="muted">No customers match “{search}”.</p>}</div></section>{selected?<CustomerDetail customer={selected} token={token}/>:<section className="detail-placeholder"><p className="eyebrow">CUSTOMER PROFILE</p><h2>Select a customer</h2><p>Open a record to see follow-ups, queries, and reviews together.</p></section>}</div>{show&&<CustomerForm token={token} close={()=>setShow(false)} saved={()=>{setShow(false);load()}}/>}</div>;
}

function CustomerForm({token,close,saved}:{token:string;close:()=>void;saved:()=>void}) { const [form,setForm]=useState({customerName:'',businessName:'',mobile:'',email:'',customerType:'WHOLESALE',status:'LEAD',address:'',gstNumber:'',followUpDate:''}); const [error,setError]=useState(''); const set=(key:string,value:string)=>setForm({...form,[key]:value}); async function submit(e:React.FormEvent){e.preventDefault();try{await apiRequest('/api/customers',token,'POST',{...form,email:form.email||null,gstNumber:form.gstNumber||null,followUpDate:form.followUpDate||null});saved()}catch(err){setError(err instanceof Error?err.message:'Unable to save customer')}} return <Modal title="Add customer" close={close}><form className="form-grid" onSubmit={submit}>{[['customerName','Customer name'],['businessName','Business name'],['mobile','Mobile'],['email','Email'],['gstNumber','GST number'],['followUpDate','Follow-up date']].map(([key,label])=><label key={key}>{label}<input type={key==='followUpDate'?'date':key==='email'?'email':'text'} value={(form as any)[key]} onChange={e=>set(key,e.target.value)}/></label>)}<label>Customer type<select value={form.customerType} onChange={e=>set('customerType',e.target.value)}><option>RETAIL</option><option>WHOLESALE</option><option>DISTRIBUTOR</option></select></label><label>Status<select value={form.status} onChange={e=>set('status',e.target.value)}><option>LEAD</option><option>ACTIVE</option><option>INACTIVE</option></select></label><label className="wide">Address<textarea required value={form.address} onChange={e=>set('address',e.target.value)}/></label>{error&&<p className="error wide">{error}</p>}<div className="form-actions wide"><button type="button" onClick={close}>Cancel</button><button className="new-button">Save customer</button></div></form></Modal> }

function CustomerDetail({customer,token,role}:{customer:Customer;token:string;role?:Role}) {
  const userRole:Role = role ?? (()=>{ try { return (JSON.parse(localStorage.getItem('stockflow-session') ?? '{}').user?.role ?? 'SALES') as Role; } catch { return 'SALES'; } })();
  const [tab,setTab]=useState('Timeline');
  const [items,setItems]=useState<any[]>([]);
  const [text,setText]=useState('');
  const [rating,setRating]=useState('5');
  const [error,setError]=useState('');
  const [replyToId,setReplyToId]=useState<string|null>(null);

  const pathFor = (currentTab:string) => currentTab === 'Queries'
    ? `/api/customers/${customer.id}/queries`
    : currentTab === 'Reviews'
      ? `/api/customers/${customer.id}/reviews`
      : `/api/customers/${customer.id}`;

  const loadCurrent = async (currentTab = tab) => {
    const result = await api<any>(pathFor(currentTab),token);
    const data = currentTab === 'Timeline' ? result.data?.followUps ?? [] : result.data ?? [];
    return Array.isArray(data) ? data : [];
  };

  useEffect(() => {
    // Clear the previous tab immediately. This prevents a query or timeline
    // response from remaining visible while Reviews is loading.
    setItems([]);
    setError('');
    setText('');
    setReplyToId(null);
    let active = true;
    loadCurrent(tab)
      .then(next => { if (active) setItems(next); })
      .catch(e => {
        if (!active) return;
        setItems([]);
        setError(e instanceof Error ? e.message : 'Unable to load customer activity.');
      });
    return () => { active = false; };
  },[tab,customer.id,token]);

  async function add() {
    if (!text.trim()) return;
    try {
      if (tab === 'Timeline') {
        await apiRequest(`/api/customers/${customer.id}/follow-ups`,token,'POST',{note:text.trim()});
      } else if (tab === 'Queries') {
        if (replyToId) await apiRequest(`/api/customers/${customer.id}/queries/${replyToId}/replies`,token,'POST',{message:text.trim()});
        else await apiRequest(`/api/customers/${customer.id}/queries`,token,'POST',{subject:'Customer query',message:text.trim(),priority:'MEDIUM'});
      } else {
        await apiRequest(`/api/customers/${customer.id}/reviews`,token,'POST',{rating:Number(rating),review:text.trim()});
      }
      setText('');
      setReplyToId(null);
      setError('');
      setItems(await loadCurrent());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to save customer activity.');
    }
  }

  const label = tab === 'Queries' ? 'query' : tab === 'Reviews' ? 'review' : 'follow-up';
  return <section className="detail-card">
    <p className="eyebrow">CUSTOMER PROFILE</p>
    <h2>{customer.customerName}</h2>
    <p className="muted">{customer.businessName} · {customer.mobile}</p>
    <div className="tabs">{['Timeline','Queries','Reviews'].map(t=><button className={tab===t?'selected':''} onClick={()=>setTab(t)} key={t}>{t}</button>)}</div>
    {error&&<p className="error">{error}</p>}
    <div className="detail-list">
      {items.map((item:any)=><article key={item.id}>
        <div><b>{tab==='Queries' ? item.subject : tab==='Reviews' ? `${'★'.repeat(Number(item.rating)||0)} review` : 'Follow-up note'}</b><small>{item.createdAt?new Date(item.createdAt).toLocaleString():''}</small></div>
        <p>{tab==='Timeline' ? item.note : tab==='Queries' ? item.message : item.review}</p>
        {tab==='Queries'&&item.replies?.map((reply:any)=><div className="query-reply" key={reply.id}><b>Reply from {reply.createdBy}</b><small>{reply.createdAt?new Date(reply.createdAt).toLocaleString():''}</small><p>{reply.message}</p></div>)}
        {tab==='Queries'&&item.status!=='RESOLVED'&&<div className="query-actions">{userRole==='SALES'&&<button onClick={()=>{setReplyToId(item.id);setText('')}}>Reply</button>}{(userRole==='ADMIN'||userRole==='SALES')&&<button onClick={async()=>{try{await apiRequest(`/api/customers/${customer.id}/queries/${item.id}/resolve`,token,'PATCH');setItems(await loadCurrent('Queries'));}catch(e){setError(e instanceof Error?e.message:'Unable to resolve query.')}}}>Resolve query</button>}</div>}
      </article>)}
      {items.length===0&&<p className="muted">No {label}s recorded yet.</p>}
    </div>
    {tab==='Queries'&&userRole==='ADMIN'&&<p className="muted workflow-note">Sales records incoming questions and sends replies. Admin reviews the thread and resolves it when complete.</p>}
    {tab==='Reviews'&&userRole!=='SALES'&&<p className="muted workflow-note">Reviews are recorded by Sales after customer feedback is received.</p>}
    {(tab==='Timeline'||(tab==='Queries'&&userRole==='SALES')||(tab==='Reviews'&&userRole==='SALES'))&&<div className="composer">
      {tab==='Reviews'&&<select value={rating} onChange={e=>setRating(e.target.value)}><option value="5">5 stars</option><option value="4">4 stars</option><option value="3">3 stars</option><option value="2">2 stars</option><option value="1">1 star</option></select>}
      {tab==='Queries'&&replyToId&&<button type="button" className="text-button" onClick={()=>{setReplyToId(null);setText('')}}>Cancel reply</button>}
      <textarea value={text} onChange={e=>setText(e.target.value)} placeholder={tab==='Queries'?(replyToId?'Write a reply to this customer question...':'Log an incoming customer question...'):tab==='Reviews'?'Record feedback received from the customer...':'Log a follow-up note...'}/>
      <button className="new-button" onClick={add}>{tab==='Queries'?(replyToId?'Send reply':'Log incoming query'):tab==='Reviews'?'Record review':'Add note'}</button>
    </div>}
  </section>;
}

function Products({token,role}:{token:string;role:Role}) { const [rows,setRows]=useState<Product[]>([]);const [search,setSearch]=useState('');const [show,setShow]=useState(false);const [requestProduct,setRequestProduct]=useState<Product|null>(null);const load=()=>api<{data:Product[]}>(`/api/products?limit=100&search=${encodeURIComponent(search)}`,token).then(r=>setRows(r.data));useEffect(()=>{const timer=window.setTimeout(load,180);return()=>window.clearTimeout(timer)},[search]);return <div className="workspace-page"><div className="toolbar"><label className="search toolbar-search"><Search size={16}/><input aria-label="Search products" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search name, SKU, category"/></label>{(role==='ADMIN'||role==='WAREHOUSE')&&<button className="new-button" onClick={()=>setShow(true)}>+ Add product</button>}</div><section className="data-card"><div className="data-card-title"><div><p className="eyebrow">CATALOGUE CONTROL</p><h2>Products & inventory</h2></div><span>{rows.length} products</span></div><div className="data-head"><span>Product</span><span>SKU / category</span><span>Stock</span><span>Status</span><span>Action</span></div>{rows.map(r=><div className="data-row" key={r.id}><b>{r.productName}<small>{r.warehouseLocation}</small></b><span>{r.sku}<small>{r.category}</small></span><span>{r.currentStock} units</span><span className={`status ${r.isLowStock?'attention':'confirmed'}`}>{r.isLowStock?'Low stock':'Healthy'}</span><span>{role==='SALES'&&<button className="text-button" onClick={()=>setRequestProduct(r)}>Request stock</button>}</span></div>)}{rows.length===0&&<p className="muted">No products match “{search}”.</p>}</section>{show&&<ProductForm token={token} close={()=>setShow(false)} saved={()=>{setShow(false);load()}}/>}{requestProduct&&<StockRequestForm token={token} product={requestProduct} close={()=>setRequestProduct(null)} saved={()=>setRequestProduct(null)}/>}</div> }
function ProductForm({token,close,saved}:{token:string;close:()=>void;saved:()=>void}) {const [form,setForm]=useState({productName:'',sku:'',category:'',unitPrice:'',currentStock:'0',minimumStockAlertQuantity:'0',warehouseLocation:''});const [error,setError]=useState('');const set=(k:string,v:string)=>setForm({...form,[k]:v});return <Modal title="Add product" close={close}><form className="form-grid" onSubmit={e=>{e.preventDefault();apiRequest('/api/products',token,'POST',{...form,unitPrice:Number(form.unitPrice),currentStock:Number(form.currentStock),minimumStockAlertQuantity:Number(form.minimumStockAlertQuantity)}).then(saved).catch(e=>setError(e instanceof Error?e.message:'Unable to save product'))}}>{[['productName','Product name'],['sku','SKU'],['category','Category'],['unitPrice','Unit price'],['currentStock','Opening stock'],['minimumStockAlertQuantity','Minimum stock'],['warehouseLocation','Warehouse location']].map(([k,l])=><label key={k}>{l}<input required value={(form as any)[k]} onChange={e=>set(k,e.target.value)}/></label>)}{error&&<p className="error wide">{error}</p>}<div className="form-actions wide"><button type="button" onClick={close}>Cancel</button><button className="new-button">Save product</button></div></form></Modal>}

function Stock({token,role}:{token:string;role:Role}) {const [rows,setRows]=useState<Product[]>([]);const [requests,setRequests]=useState<StockRequest[]>([]);const [search,setSearch]=useState('');const [selected,setSelected]=useState<Product|null>(null);const [requestProduct,setRequestProduct]=useState<Product|null>(null);const load=()=>api<{data:Product[]}>(`/api/products?limit=100&search=${encodeURIComponent(search)}`,token).then(r=>setRows(r.data));const loadRequests=()=>api<{data:StockRequest[]}>(`/api/stock-requests${role==='WAREHOUSE'?'?status=PENDING':''}`,token).then(r=>setRequests(r.data));useEffect(()=>{const timer=window.setTimeout(load,180);return()=>window.clearTimeout(timer)},[search]);useEffect(()=>{loadRequests().catch(()=>setRequests([]))},[role]);async function review(id:string,action:'approve'|'reject'){const note=action==='approve'?'Approved by warehouse':'';await apiRequest(`/api/stock-requests/${id}/${action}`,token,'PATCH',{note});await Promise.all([loadRequests(),load()]);}return <div className="workspace-page"><div className="toolbar"><label className="search toolbar-search"><Search size={16}/><input aria-label="Search stock" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search stock by name or SKU"/></label></div>{(role==='WAREHOUSE'||role==='ADMIN'||role==='SALES')&&<section className="data-card request-card"><div className="data-card-title"><div><p className="eyebrow">STOCK COORDINATION</p><h2>{role==='SALES'?'My stock requests':'Sales stock requests'}</h2></div><span>{requests.filter(r=>r.status==='PENDING').length} pending</span></div>{requests.length===0?<p className="muted">No stock requests yet.</p>:requests.map(r=><div className="request-row" key={r.id}><div><b>{r.productName}<small>{r.sku} · requested by {r.requestedBy}</small></b><p>{r.message}</p></div><span className={`status urgency-${r.urgency.toLowerCase()}`}>{r.urgency}</span><span>{r.quantity} units<br/><small>{new Date(r.createdAt).toLocaleDateString()}</small></span>{role!=='SALES'&&r.status==='PENDING'&&<span className="row-actions"><button className="new-button" onClick={()=>review(r.id,'approve')}>Approve & add stock</button><button className="text-button" onClick={()=>review(r.id,'reject')}>Reject</button></span>}<span className={`status ${r.status==='APPROVED'?'confirmed':r.status==='REJECTED'?'attention':''}`}>{r.status}</span></div>)}</section>}<section className="data-card"><div className="data-card-title"><div><p className="eyebrow">AUDIT TRAIL</p><h2>Stock movements</h2></div><span>{rows.length} products</span></div><div className="data-head"><span>Product</span><span>Current stock</span><span>Minimum</span><span>Action</span></div>{rows.map(r=><div className="data-row" key={r.id}><b>{r.productName}<small>{r.sku}</small></b><span>{r.currentStock} units</span><span>{r.minimumStockAlertQuantity} units</span>{role==='SALES'?<button className="text-button" onClick={()=>setRequestProduct(r)}>Request stock</button>:<button onClick={()=>setSelected(r)}>Receive stock</button>}</div>)}{rows.length===0&&<p className="muted">No products match “{search}”.</p>}</section>{selected&&<ReceiveStock token={token} product={selected} close={()=>setSelected(null)} saved={()=>{setSelected(null);load()}}/>}{requestProduct&&<StockRequestForm token={token} product={requestProduct} close={()=>setRequestProduct(null)} saved={()=>{setRequestProduct(null);loadRequests()}}/>}</div>}
function StockRequestForm({token,product,close,saved}:{token:string;product:Product;close:()=>void;saved:()=>void}) {const [quantity,setQuantity]=useState('');const [urgency,setUrgency]=useState('MEDIUM');const [message,setMessage]=useState('');const [error,setError]=useState('');const submit=async(e:React.FormEvent)=>{e.preventDefault();try{await apiRequest('/api/stock-requests',token,'POST',{productId:product.id,quantity:Number(quantity),urgency,message});saved()}catch(err){setError(err instanceof Error?err.message:'Unable to send stock request.')}};return <Modal title={`Request stock · ${product.productName}`} close={close}><form className="form-grid" onSubmit={submit}><p className="muted wide">Current stock: {product.currentStock} units · Warehouse: {product.warehouseLocation}</p><label>Quantity<input required min="1" type="number" value={quantity} onChange={e=>setQuantity(e.target.value)}/></label><label>Urgency<select value={urgency} onChange={e=>setUrgency(e.target.value)}><option value="LOW">Low</option><option value="MEDIUM">Medium</option><option value="HIGH">High</option></select></label><label className="wide">Message<textarea required value={message} onChange={e=>setMessage(e.target.value)} placeholder="Why does Sales need this stock?"/></label>{error&&<p className="error wide">{error}</p>}<div className="form-actions wide"><button type="button" onClick={close}>Cancel</button><button className="new-button">Send request</button></div></form></Modal>}
function ReceiveStock({token,product,close,saved}:{token:string;product:Product;close:()=>void;saved:()=>void}) {const [quantity,setQuantity]=useState('');const [reason,setReason]=useState('Warehouse receipt');const [error,setError]=useState('');return <Modal title={`Receive stock · ${product.productName}`} close={close}><form className="form-grid" onSubmit={e=>{e.preventDefault();apiRequest(`/api/products/${product.id}/stock-movements`,token,'POST',{quantity:Number(quantity),movementType:'IN',reason}).then(saved).catch(e=>setError(e instanceof Error?e.message:'Unable to receive stock'))}}><label>Quantity<input required min="1" type="number" value={quantity} onChange={e=>setQuantity(e.target.value)}/></label><label>Reason<input required value={reason} onChange={e=>setReason(e.target.value)}/></label>{error&&<p className="error wide">{error}</p>}<div className="form-actions wide"><button type="button" onClick={close}>Cancel</button><button className="new-button">Record movement</button></div></form></Modal>}

function Challans({token}:{token:string}) {const [rows,setRows]=useState<Challan[]>([]);const [search,setSearch]=useState('');const [selected,setSelected]=useState<Challan|null>(null);const load=()=>api<{data:Challan[]}>(`/api/challans?limit=100&search=${encodeURIComponent(search)}`,token).then(r=>setRows(r.data));useEffect(()=>{const timer=window.setTimeout(load,180);return()=>window.clearTimeout(timer)},[search]);return <div className="workspace-page"><div className="toolbar"><label className="search toolbar-search"><Search size={16}/><input aria-label="Search challans" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search challan, customer, business"/></label><button className="export-button" onClick={()=>downloadFile(`/api/challans/export.csv${search?`?search=${encodeURIComponent(search)}`:''}`,token,'stockflow-challans.csv')}><Download size={15}/> Export CSV</button></div><section className="data-card"><div className="data-card-title"><div><p className="eyebrow">SALES DOCUMENTS</p><h2>Sales challans</h2></div><span>{rows.length} records</span></div><div className="data-head data-head-challans"><span>Challan</span><span>Customer</span><span>Quantity</span><span>Status</span><span>Actions</span></div>{rows.map(r=><div className="data-row data-row-challan" role="button" tabIndex={0} key={r.id} onClick={()=>setSelected(r)} onKeyDown={e=>{if(e.key==='Enter'||e.key===' ')setSelected(r)}}><b>{r.challanNumber}<small>{dateOnly(r.createdAt)}</small></b><span>{r.customerName}<small>{r.businessName}</small></span><span>{r.totalQuantity} units</span><span className={`status ${r.status==='CONFIRMED'?'confirmed':''}`}>{r.status.toLowerCase()}</span><span className="row-actions"><button type="button" className="text-button" onClick={e=>{e.stopPropagation();downloadFile(`/api/challans/${r.id}/pdf`,token,`${r.challanNumber}.pdf`)}}><Download size={13}/> PDF</button></span></div>)}{rows.length===0&&<p className="muted">No challans match “{search}”.</p>}</section>{selected&&<ChallanDetail token={token} challan={selected} close={()=>setSelected(null)} changed={()=>{setSelected(null);load()}}/>}</div>}
function ChallanDetail({token,challan,close,changed}:{token:string;challan:Challan;close:()=>void;changed:()=>void}) {const [detail,setDetail]=useState<any>(null);const [error,setError]=useState('');useEffect(()=>{api<any>(`/api/challans/${challan.id}`,token).then(r=>setDetail(r.data)).catch(e=>setError(e.message))},[challan.id]);return <Modal title={challan.challanNumber} close={close}>{error&&<p className="error">{error}</p>}{detail&&<><p className="muted">{detail.customerName} · {detail.businessName} · {detail.status.toLowerCase()}</p><div className="chosen-items">{detail.items.map((item:any)=><div key={item.id}><span>{item.productName}<small>{item.sku}</small></span><span>{item.quantity} × ₹{Number(item.unitPrice).toFixed(2)}</span></div>)}</div><div className="form-actions modal-actions"><button onClick={()=>downloadFile(`/api/challans/${challan.id}/pdf`,token,`${challan.challanNumber}.pdf`)}><Download size={14}/> PDF</button>{detail.status==='DRAFT'&&<><button onClick={()=>apiRequest(`/api/challans/${challan.id}/cancel`,token,'PATCH').then(changed)}>Cancel draft</button><button className="new-button" onClick={()=>apiRequest(`/api/challans/${challan.id}/confirm`,token,'PATCH').then(changed)}>Confirm</button></>}</div></>}</Modal>}

function Modal({title,close,children}:{title:string;close:()=>void;children:ReactNode}){return <div className="modal-backdrop"><section className="challan-modal" role="dialog" aria-modal="true"><div className="card-heading"><h2>{title}</h2><button onClick={close}>Close</button></div>{children}</section></div>}
