const STORAGE_KEY = 'kb-shop-orders';
const PRODUCTS_KEY = 'kb-shop-products';
let orders = [];
let products = [];
let selectedMonth = null;
let manageMode = false;

const LAO_MONTHS = ['ມັງກອນ','ກຸມພາ','ມີນາ','ເມສາ','ພຶດສະພາ','ມິຖຸນາ','ກໍລະກົດ','ສິງຫາ','ກັນຍາ','ຕຸລາ','ພະຈິກ','ທັນວາ'];

function todayStr(){
  const d = new Date();
  return d.toISOString().slice(0,10);
}
function fmt(n){
  return Number(n||0).toLocaleString('en-US', {maximumFractionDigits:2});
}
function laoDate(dateStr){
  const [y,m,d] = dateStr.split('-').map(Number);
  return `${d} ${LAO_MONTHS[m-1]} ${y}`;
}
function monthKey(dateStr){ return dateStr.slice(0,7); }
function monthLabel(key){
  const [y,m] = key.split('-').map(Number);
  return `${LAO_MONTHS[m-1]} ${y}`;
}

function showToast(msg){
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(showToast._tid);
  showToast._tid = setTimeout(()=>t.classList.remove('show'), 1700);
}

document.querySelectorAll('.tab-btn').forEach(btn=>{
  btn.addEventListener('click', ()=>{
    document.querySelectorAll('.tab-btn').forEach(b=>b.classList.remove('active'));
    document.querySelectorAll('.view').forEach(v=>v.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById(btn.dataset.view).classList.add('active');
  });
});

async function loadOrders(){
  try{
    const raw = localStorage.getItem(STORAGE_KEY);
    orders = raw ? JSON.parse(raw) : [];
  }catch(e){
    orders = [];
  }
  render();
}
async function saveOrders(){
  try{
    localStorage.setItem(STORAGE_KEY, JSON.stringify(orders));
  }catch(e){
    showToast('ບັນທຶກບໍ່ສຳເລັດ ລອງໃໝ່ອີກຄັ້ງ');
  }
}

function loadProducts(){
  try{
    const raw = localStorage.getItem(PRODUCTS_KEY);
    products = raw ? JSON.parse(raw) : [];
  }catch(e){
    products = [];
  }
}
function saveProducts(){
  try{
    localStorage.setItem(PRODUCTS_KEY, JSON.stringify(products));
  }catch(e){
    showToast('ບັນທຶກສິນຄ້າບໍ່ສຳເລັດ');
  }
}
function upsertProduct(name, price, cost, ship){
  const key = name.trim().toLowerCase();
  const existing = products.find(p => p.name.trim().toLowerCase() === key);
  if(existing){
    existing.price = price;
    existing.cost = cost;
    existing.ship = ship;
    existing.lastUsed = Date.now();
  }else{
    products.push({
      id: Date.now().toString(36) + Math.random().toString(36).slice(2,6),
      name, price, cost, ship, lastUsed: Date.now()
    });
  }
  saveProducts();
}
function selectProduct(p){
  document.getElementById('itemName').value = p.name;
  document.getElementById('priceInput').value = p.price;
  document.getElementById('costInput').value = p.cost;
  document.getElementById('shipInput').value = p.ship;
  computeProfit();
  renderProductChips(p.id);
}
function deleteProduct(id){
  products = products.filter(p => p.id !== id);
  saveProducts();
  renderProductChips();
  showToast('ລຶບສິນຄ້າອອກຈາກລາຍການແລ້ວ');
}
function renderProductChips(activeId){
  const row = document.getElementById('productChips');
  const empty = document.getElementById('emptyPresets');
  if(products.length === 0){
    row.innerHTML = '';
    row.classList.remove('manage-mode');
    empty.style.display = 'block';
    return;
  }
  empty.style.display = 'none';
  row.classList.toggle('manage-mode', manageMode);
  const sorted = products.slice().sort((a,b)=> (b.lastUsed||0) - (a.lastUsed||0));
  row.innerHTML = sorted.map(p => `
    <button type="button" class="chip product-chip ${p.id===activeId?'active':''}" data-id="${p.id}">
      <span class="nm">${escapeHtml(p.name)}</span>
      <span class="rm" data-del="${p.id}">✕</span>
    </button>
  `).join('');

  row.querySelectorAll('.product-chip').forEach(btn=>{
    btn.addEventListener('click', (e)=>{
      const delId = e.target.dataset.del;
      if(delId){
        e.stopPropagation();
        deleteProduct(delId);
        return;
      }
      if(manageMode) return;
      const p = products.find(x => x.id === btn.dataset.id);
      if(p) selectProduct(p);
    });
  });
}
document.getElementById('manageBtn').addEventListener('click', ()=>{
  manageMode = !manageMode;
  const btn = document.getElementById('manageBtn');
  btn.textContent = manageMode ? 'ສຳເລັດ' : 'ຈັດການ';
  btn.classList.toggle('on', manageMode);
  renderProductChips();
});

function computeProfit(){
  const price = parseFloat(document.getElementById('priceInput').value) || 0;
  const cost = parseFloat(document.getElementById('costInput').value) || 0;
  const ship = parseFloat(document.getElementById('shipInput').value) || 0;
  const profit = price - cost - ship;
  const el = document.getElementById('previewProfit');
  el.textContent = fmt(profit) + ' ກີບ';
  el.className = 'val display ' + (profit >= 0 ? 'pos' : 'neg');
  return profit;
}
['priceInput','costInput','shipInput'].forEach(id=>{
  document.getElementById(id).addEventListener('input', computeProfit);
});

document.getElementById('saveBtn').addEventListener('click', async ()=>{
  const date = document.getElementById('orderDate').value || todayStr();
  const name = document.getElementById('itemName').value.trim() || 'ບໍ່ລະບຸຮຸ່ນ';
  const price = parseFloat(document.getElementById('priceInput').value) || 0;
  const cost = parseFloat(document.getElementById('costInput').value) || 0;
  const ship = parseFloat(document.getElementById('shipInput').value) || 0;

  if(price === 0 && cost === 0){
    showToast('ກະລຸນາໃສ່ລາຄາຂາຍ ຫຼື ຕົ້ນທຶນ');
    return;
  }

  const order = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2,6),
    date, name, price, cost, ship,
    profit: price - cost - ship
  };
  orders.push(order);
  await saveOrders();

  if(name !== 'ບໍ່ລະບຸຮຸ່ນ'){
    upsertProduct(name, price, cost, ship);
  }

  document.getElementById('itemName').value = '';
  document.getElementById('priceInput').value = '';
  document.getElementById('costInput').value = '';
  document.getElementById('shipInput').value = '';
  computeProfit();

  selectedMonth = monthKey(date);
  showToast('ບັນທຶກອໍເດີແລ້ວ ✓');
  render();
  renderProductChips();
});

async function deleteOrder(id){
  orders = orders.filter(o => o.id !== id);
  await saveOrders();
  showToast('ລຶບອໍເດີແລ້ວ');
  render();
}

function render(){
  const months = Array.from(new Set(orders.map(o=>monthKey(o.date)))).sort().reverse();
  const currentMonth = monthKey(todayStr());
  if(!months.includes(currentMonth)) months.unshift(currentMonth);
  if(!selectedMonth || !months.includes(selectedMonth)) selectedMonth = currentMonth;

  const chipRow = document.getElementById('monthChips');
  chipRow.innerHTML = months.map(m=>
    `<button class="chip ${m===selectedMonth?'active':''}" data-month="${m}">${monthLabel(m)}</button>`
  ).join('');
  chipRow.querySelectorAll('.chip').forEach(c=>{
    c.addEventListener('click', ()=>{
      selectedMonth = c.dataset.month;
      render();
    });
  });

  renderStats(selectedMonth);
  renderList();
}

function renderStats(mKey){
  const monthOrders = orders.filter(o => monthKey(o.date) === mKey);
  const revenue = monthOrders.reduce((s,o)=>s+o.price,0);
  const cost = monthOrders.reduce((s,o)=>s+o.cost+o.ship,0);
  const profit = monthOrders.reduce((s,o)=>s+o.profit,0);
  document.getElementById('statRevenue').textContent = fmt(revenue);
  document.getElementById('statCost').textContent = fmt(cost);
  const profitEl = document.getElementById('statProfit');
  profitEl.textContent = fmt(profit);
  profitEl.style.color = profit >= 0 ? 'var(--green)' : 'var(--rust)';
}

function renderList(){
  const listEl = document.getElementById('orderList');
  if(orders.length === 0){
    listEl.innerHTML = '<div class="empty">ຍັງບໍ່ມີອໍເດີ — ເລີ່ມບັນທຶກອໍເດີທຳອິດເລີຍ</div>';
    return;
  }

  const byDate = {};
  orders.forEach(o=>{
    if(!byDate[o.date]) byDate[o.date] = [];
    byDate[o.date].push(o);
  });
  const dates = Object.keys(byDate).sort().reverse();

  listEl.innerHTML = dates.map(date=>{
    const dayOrders = byDate[date].slice().reverse();
    const dayTotal = dayOrders.reduce((s,o)=>s+o.profit,0);
    const items = dayOrders.map(o=>`
      <div class="order-item ${o.profit < 0 ? 'neg' : ''}">
        <div class="switch-mark"></div>
        <div class="info">
          <div class="item-name">${escapeHtml(o.name)}</div>
          <div class="item-sub">ຂາຍ ${fmt(o.price)} · ຕົ້ນທຶນ ${fmt(o.cost)} · ສົ່ງ ${fmt(o.ship)}</div>
        </div>
        <div class="profit" style="color:${o.profit>=0?'var(--green)':'var(--rust)'}">${fmt(o.profit)}</div>
        <button class="del-btn" data-id="${o.id}">✕</button>
      </div>
    `).join('');
    return `
      <div class="day-group">
        <div class="day-header">
          <span>${laoDate(date)}</span>
          <span class="day-total">ລວມ ${fmt(dayTotal)} ກີບ</span>
        </div>
        ${items}
      </div>
    `;
  }).join('');

  listEl.querySelectorAll('.del-btn').forEach(btn=>{
    btn.addEventListener('click', ()=> deleteOrder(btn.dataset.id));
  });
}

function escapeHtml(str){
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

/* ---------- backup / transfer data between devices ---------- */
function exportData(){
  const payload = {
    app: 'aura-board-tracker',
    exportedAt: new Date().toISOString(),
    orders,
    products
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], {type:'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `aura-board-backup-${todayStr()}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast('ດາວໂຫຼດຂໍ້ມູນແລ້ວ ✓');
}

async function importData(file){
  try{
    const text = await file.text();
    const data = JSON.parse(text);

    let addedOrders = 0;
    if(Array.isArray(data.orders)){
      const existingIds = new Set(orders.map(o => o.id));
      data.orders.forEach(o=>{
        if(o && o.id && !existingIds.has(o.id)){
          orders.push(o);
          existingIds.add(o.id);
          addedOrders++;
        }
      });
      await saveOrders();
    }

    if(Array.isArray(data.products)){
      data.products.forEach(p=>{
        if(!p || !p.name) return;
        const key = p.name.trim().toLowerCase();
        const existing = products.find(x => x.name.trim().toLowerCase() === key);
        if(!existing){
          products.push(p);
        }else if((p.lastUsed||0) > (existing.lastUsed||0)){
          existing.price = p.price;
          existing.cost = p.cost;
          existing.ship = p.ship;
          existing.lastUsed = p.lastUsed;
        }
      });
      saveProducts();
    }

    render();
    renderProductChips();
    showToast(addedOrders > 0 ? `ນຳເຂົ້າສຳເລັດ (+${addedOrders} ອໍເດີໃໝ່)` : 'ຂໍ້ມູນນີ້ມີຢູ່ໃນເຄື່ອງແລ້ວ');
  }catch(err){
    showToast('ໄຟລ໌ບໍ່ຖືກຕ້ອງ ລອງໃໝ່ອີກຄັ້ງ');
  }
}

document.getElementById('exportBtn').addEventListener('click', exportData);
document.getElementById('importBtn').addEventListener('click', ()=>{
  document.getElementById('importFile').click();
});
document.getElementById('importFile').addEventListener('change', (e)=>{
  const file = e.target.files[0];
  if(file) importData(file);
  e.target.value = '';
});

function updateDateDisplay(){
  const val = document.getElementById('orderDate').value || todayStr();
  document.getElementById('dateDisplayText').textContent = laoDate(val);
}
document.getElementById('orderDate').addEventListener('change', updateDateDisplay);
document.getElementById('orderDate').addEventListener('input', updateDateDisplay);

document.getElementById('orderDate').value = todayStr();
updateDateDisplay();
computeProfit();
loadOrders();
loadProducts();
renderProductChips();
