// === Utilidades ===
const $ = (sel, ctx = document) => ctx.querySelector(sel);
const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));
const fmt = (n) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 2 }).format(n ?? 0);

// === Estado / Defaults ===
const STORAGE_KEY = 'super_stock_v1';

// Categorías y proveedores por defecto (aparecen aunque no haya productos aún)
const DEFAULT_CATS = ['Lácteos', 'Almacén', 'Bebidas', 'Limpieza', 'Verdulería', 'Carnes', 'Panadería', 'Perfumería', 'Congelados'];
const DEFAULT_SUPS = ['La Serenísima', 'Molinos', 'Coca-Cola', 'Ala', 'Bimbo', 'Swift', 'Arcor'];

let products = load();
let sortState = { key: 'name', dir: 'asc' };
let selection = new Set();

// Semilla de ejemplo si no hay datos
if (products.length === 0) {
  products = [
    { id: crypto.randomUUID(), barcode:'7791234567890', name:'Leche descremada 1L', category:'Lácteos', supplier:'La Serenísima', cost:1100, price:1500, stock:24, minStock:10, location:'Góndola A3', notes:'' },
    { id: crypto.randomUUID(), barcode:'7790001112223', name:'Fideos Spaghetti 500g', category:'Almacén', supplier:'Molinos', cost:700, price:980, stock:8, minStock:12, location:'Góndola B1', notes:'Promo 2x1 martes' },
    { id: crypto.randomUUID(), barcode:'7798887776661', name:'Detergente 750ml', category:'Limpieza', supplier:'Ala', cost:1500, price:2100, stock:0, minStock:5, location:'Góndola D2', notes:'' },
  ];
  save();
}

// === Persistencia ===
function save(){ localStorage.setItem(STORAGE_KEY, JSON.stringify(products)); }
function load(){ try{ return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; }catch{ return []; } }

// === UI - DOM refs ===
const tbody = $('#productTable tbody');
const catSelect = $('#filterCategory');
const supSelect = $('#filterSupplier');
const statusSelect = $('#filterStatus');
const search = $('#search');
const rowCount = $('#rowCount');
const checkAll = $('#checkAll');

const statProducts = $('#statProducts');
const statCost = $('#statCost');
const statPrice = $('#statPrice');
const statLow = $('#statLow');

const productModal = $('#productModal');
const productForm = $('#productForm');
const modalTitle = $('#modalTitle');
const closeModalBtn = $('#closeModal');

const adjustModal = $('#adjustModal');
const adjustForm = $('#adjustForm');
const closeAdjustBtn = $('#closeAdjust');

const csvImport = $('#csvImport');

// === Render ===
function getFilters(){
  return {
    q: search.value.trim().toLowerCase(),
    category: catSelect.value,
    supplier: supSelect.value,
    status: statusSelect.value
  };
}

function filteredProducts(){
  const { q, category, supplier, status } = getFilters();
  let list = [...products];

  if (q) {
    list = list.filter(p =>
      p.name.toLowerCase().includes(q) ||
      p.barcode?.toLowerCase().includes(q) ||
      p.supplier?.toLowerCase().includes(q)
    );
  }
  if (category) list = list.filter(p => (p.category||'') === category);
  if (supplier) list = list.filter(p => (p.supplier||'') === supplier);

  if (status === 'low') list = list.filter(p => p.stock > 0 && p.stock <= (p.minStock||0));
  if (status === 'ok')  list = list.filter(p => p.stock > (p.minStock||0));
  if (status === 'zero')list = list.filter(p => p.stock === 0);

  return list.sort((a,b)=>{
    const k = sortState.key;
    const dir = sortState.dir === 'asc' ? 1 : -1;
    const av = (a[k] ?? '').toString().toLowerCase();
    const bv = (b[k] ?? '').toString().toLowerCase();
    if (!isNaN(+av) && !isNaN(+bv)) return (Number(av) - Number(bv)) * dir;
    return av.localeCompare(bv, 'es') * dir;
  });
}

function renderFiltersOptions(){
  // Unimos categorías/proveedores de productos con los defaults
  const cats = Array.from(new Set(
    [...DEFAULT_CATS, ...products.map(p=>p.category).filter(Boolean)]
  )).sort((a,b)=>a.localeCompare(b,'es'));

  const sups = Array.from(new Set(
    [...DEFAULT_SUPS, ...products.map(p=>p.supplier).filter(Boolean)]
  )).sort((a,b)=>a.localeCompare(b,'es'));

  catSelect.innerHTML = `<option value="">Todas las categorías</option>` + cats.map(c=>`<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('');
  supSelect.innerHTML = `<option value="">Todos los proveedores</option>` + sups.map(s=>`<option value="${escapeHtml(s)}">${escapeHtml(s)}</option>`).join('');

  // datalists (modal)
  $('#catList').innerHTML = cats.map(c=>`<option value="${escapeHtml(c)}">`).join('');
  $('#supList').innerHTML = sups.map(s=>`<option value="${escapeHtml(s)}">`).join('');
}

function renderStats(){
  const total = products.length;
  const valCost = products.reduce((acc,p)=> acc + (Number(p.cost||0)*Number(p.stock||0)), 0);
  const valPrice = products.reduce((acc,p)=> acc + (Number(p.price||0)*Number(p.stock||0)), 0);
  const low = products.filter(p=> p.stock === 0 || p.stock <= (p.minStock||0)).length;

  statProducts.textContent = total;
  statCost.textContent = fmt(valCost);
  statPrice.textContent = fmt(valPrice);
  statLow.textContent = low;
}

function renderTable(){
  const list = filteredProducts();
  tbody.innerHTML = list.map(p=>{
    const state = p.stock === 0 ? 'zero' : (p.stock <= (p.minStock||0) ? 'low' : 'ok');
    const badge = state === 'zero' ? 'Sin stock' : (state === 'low' ? 'Stock bajo' : 'OK');
    const checked = selection.has(p.id) ? 'checked' : '';
    return `<tr data-id="${p.id}">
      <td><input type="checkbox" class="rowCheck" ${checked} aria-label="Seleccionar fila"></td>
      <td>${escapeHtml(p.barcode||'')}</td>
      <td>${escapeHtml(p.name||'')}</td>
      <td class="clickable" data-filter="category">${escapeHtml(p.category||'')}</td>
      <td class="clickable" data-filter="supplier">${escapeHtml(p.supplier||'')}</td>
      <td class="num">${fmt(Number(p.cost||0))}</td>
      <td class="num">${fmt(Number(p.price||0))}</td>
      <td class="num">${Number(p.stock||0)}</td>
      <td class="num">${Number(p.minStock||0)}</td>
      <td>${escapeHtml(p.location||'')}</td>
      <td><span class="badge ${state}">${badge}</span></td>
      <td>
        <button class="icon-btn" data-action="adjust" title="Ajustar stock">📦</button>
        <button class="icon-btn" data-action="edit" title="Editar">✏️</button>
        <button class="icon-btn" data-action="delete" title="Eliminar">🗑️</button>
      </td>
    </tr>`;
  }).join('');

  rowCount.textContent = `${list.length} resultado${list.length!==1?'s':''}`;
  renderStats();
}

function escapeHtml(s=''){
  return s.replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
}

// === Eventos ===
$('#btnAdd').addEventListener('click', ()=> openModal());
$('#btnExport').addEventListener('click', exportCSV);
$('#btnBulkDelete').addEventListener('click', bulkDelete);
$('#btnBulkIn').addEventListener('click', ()=> bulkAdjust('in'));
$('#btnBulkOut').addEventListener('click', ()=> bulkAdjust('out'));

$('#btnClearFilters').addEventListener('click', ()=>{
  search.value = ''; catSelect.value=''; supSelect.value=''; statusSelect.value='';
  renderTable();
});
[search, catSelect, supSelect, statusSelect].forEach(el => el.addEventListener('input', renderTable));

checkAll.addEventListener('change', (e)=>{
  const list = filteredProducts();
  selection.clear();
  if (e.target.checked) list.forEach(p=> selection.add(p.id));
  renderTable();
});

tbody.addEventListener('change', (e)=>{
  if (e.target.classList.contains('rowCheck')) {
    const tr = e.target.closest('tr');
    const id = tr.dataset.id;
    e.target.checked ? selection.add(id) : selection.delete(id);
  }
});

// Orden por columnas
$('#productTable thead').addEventListener('click', (e)=>{
  const th = e.target.closest('th');
  const key = th?.dataset?.sort;
  if (!key) return;
  sortState = { key, dir: (sortState.key===key && sortState.dir==='asc') ? 'desc' : 'asc' };
  renderTable();
});

// Botones por fila
tbody.addEventListener('click', (e)=>{
  // Click en celdas de categoría / proveedor -> aplica filtro directo
  const td = e.target.closest('td.clickable');
  if (td && td.dataset.filter === 'category') {
    const val = td.textContent.trim();
    $('#filterCategory').value = val;
    renderTable();
    return;
  }
  if (td && td.dataset.filter === 'supplier') {
    const val = td.textContent.trim();
    $('#filterSupplier').value = val;
    renderTable();
    return;
  }

  // Acciones
  const btn = e.target.closest('button[data-action]');
  if (!btn) return;
  const tr = btn.closest('tr');
  const id = tr.dataset.id;
  const action = btn.dataset.action;
  const item = products.find(p=>p.id===id);
  if (!item) return;

  if (action === 'edit') openModal(item);
  if (action === 'delete') deleteProduct(id);
  if (action === 'adjust') openAdjustModal(item);
});

closeModalBtn.addEventListener('click', ()=> productModal.close());
closeAdjustBtn.addEventListener('click', ()=> adjustModal.close());

// Guardar producto (crear/editar)
productForm.addEventListener('submit', (e)=>{
  e.preventDefault();
  const data = getProductFormData();
  if (!data.name) return alert('El nombre es obligatorio.');
  const id = $('#productId').value;
  if (id) {
    const idx = products.findIndex(p=>p.id===id);
    products[idx] = { ...products[idx], ...data };
  } else {
    products.unshift({ id: crypto.randomUUID(), ...data });
  }
  save(); renderFiltersOptions(); productModal.close(); renderTable();
});

// Importar CSV
csvImport.addEventListener('change', importCSV);

// Ajuste de stock
adjustForm.addEventListener('submit', (e)=>{
  e.preventDefault();
  const id = $('#adjustProductId').value;
  const qty = Number($('#adjustQty').value || 0);
  const type = $('#adjustType').value;
  if (!qty || qty < 0) return alert('Indicá una cantidad válida.');
  const idx = products.findIndex(p=>p.id===id);
  if (idx < 0) return;
  const delta = type === 'in' ? qty : -qty;
  products[idx].stock = Math.max(0, Number(products[idx].stock||0) + delta);
  save(); adjustModal.close(); renderTable();
});

// === Acciones ===
function openModal(item){
  modalTitle.textContent = item ? 'Editar producto' : 'Nuevo producto';
  $('#productId').value = item?.id ?? '';
  $('#barcode').value = item?.barcode ?? '';
  $('#name').value = item?.name ?? '';
  $('#category').value = item?.category ?? '';
  $('#supplier').value = item?.supplier ?? '';
  $('#cost').value = item?.cost ?? '';
  $('#price').value = item?.price ?? '';
  $('#stock').value = item?.stock ?? 0;
  $('#minStock').value = item?.minStock ?? 0;
  $('#location').value = item?.location ?? '';
  $('#notes').value = item?.notes ?? '';

  productModal.showModal();
  setTimeout(()=> $('#barcode').focus(), 50);
}

function getProductFormData(){
  return {
    barcode: $('#barcode').value.trim(),
    name: $('#name').value.trim(),
    category: $('#category').value.trim(),
    supplier: $('#supplier').value.trim(),
    cost: Number($('#cost').value||0),
    price: Number($('#price').value||0),
    stock: Number($('#stock').value||0),
    minStock: Number($('#minStock').value||0),
    location: $('#location').value.trim(),
    notes: $('#notes').value.trim(),
  };
}

function deleteProduct(id){
  if (!confirm('¿Eliminar producto?')) return;
  products = products.filter(p=>p.id!==id);
  selection.delete(id);
  save(); renderFiltersOptions(); renderTable();
}

function openAdjustModal(item){
  $('#adjustProductId').value = item.id;
  $('#adjustQty').value = '';
  $('#adjustType').value = 'in';
  adjustModal.showModal();
  setTimeout(()=> $('#adjustQty').focus(), 50);
}

function bulkDelete(){
  if (selection.size === 0) return alert('Seleccioná al menos un producto.');
  if (!confirm(`¿Eliminar ${selection.size} producto(s)?`)) return;
  products = products.filter(p=> !selection.has(p.id));
  selection.clear(); checkAll.checked = false;
  save(); renderFiltersOptions(); renderTable();
}

function bulkAdjust(type){
  if (selection.size === 0) return alert('Seleccioná al menos un producto.');
  const qty = Number(prompt(`Cantidad a ${type==='in'?'ingresar (+)':'retirar (−)'}:`) || 0);
  if (!qty) return;

  products = products.map(p=>{
    if (!selection.has(p.id)) return p;
    const delta = type === 'in' ? qty : -qty;
    return { ...p, stock: Math.max(0, Number(p.stock||0) + delta) };
  });
  save(); renderTable();
}

// === CSV ===
function exportCSV(){
  const headers = ['id','barcode','name','category','supplier','cost','price','stock','minStock','location','notes'];
  const rows = [headers.join(',')].concat(products.map(p => headers.map(h => csvCell(p[h])).join(',')));
  const blob = new Blob([rows.join('\n')], {type:'text/csv;charset=utf-8;'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `stock_${new Date().toISOString().slice(0,10)}.csv`;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}
function csvCell(v){
  if (v == null) return '';
  const s = String(v).replace(/"/g,'""');
  return /[",\n]/.test(s) ? `"${s}"` : s;
}
function importCSV(e){
  const file = e.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (evt)=>{
    const text = evt.target.result;
    const parsed = parseCSV(text);
    if (!parsed.length) return alert('CSV vacío o inválido.');
    const normalized = parsed.map(row => ({
      id: row.id || crypto.randomUUID(),
      barcode: row.barcode || '',
      name: row.name || '',
      category: row.category || '',
      supplier: row.supplier || '',
      cost: Number(row.cost||0),
      price: Number(row.price||0),
      stock: Number(row.stock||0),
      minStock: Number(row.minStock||0),
      location: row.location || '',
      notes: row.notes || '',
    }));
    normalized.forEach(n=>{
      const idx = products.findIndex(p => (n.id && p.id===n.id) || (n.barcode && p.barcode===n.barcode) || (n.name && p.name===n.name));
      if (idx>=0) products[idx] = {...products[idx], ...n};
      else products.push(n);
    });
    save(); renderFiltersOptions(); renderTable();
    csvImport.value = '';
  };
  reader.readAsText(file, 'utf-8');
}
function parseCSV(text){
  const lines = text.replace(/\r/g,'').split('\n').filter(Boolean);
  if (!lines.length) return [];
  const headers = splitCSVLine(lines[0]).map(h => h.trim());
  return lines.slice(1).map(line=>{
    const cells = splitCSVLine(line);
    const obj = {};
    headers.forEach((h,i)=> obj[h] = cells[i]?.trim() ?? '');
    return obj;
  });
}
function splitCSVLine(line){
  const out = []; let cur = ''; let inQ = false;
  for (let i=0;i<line.length;i++){
    const ch = line[i];
    if (ch === '"' ){
      if (inQ && line[i+1] === '"'){ cur += '"'; i++; }
      else inQ = !inQ;
    } else if (ch === ',' && !inQ){
      out.push(cur); cur = '';
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out;
}

// === Init ===
renderFiltersOptions();
renderTable();

// Acceso rápido: Enter en búsqueda abre el primero para editar
search.addEventListener('keydown', (e)=>{
  if (e.key === 'Enter'){
    const first = filteredProducts()[0];
    if (first) openModal(first);
  }
});

// Mejor foco al abrir modal con lector de código
$('#barcode').addEventListener('keydown', (e)=>{
  if (e.key === 'Enter') $('#name').focus();
});
