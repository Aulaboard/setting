const STORAGE_KEY = 'kb-shop-orders';
let orders = [];
let selectedMonth = null;

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

  document.getElementById('itemName').value = '';
  document.getElementById('priceInput').value = '';
  document.getElementById('costInput').value = '';
  document.getElementById('shipInput').value = '';
  computeProfit();

  selectedMonth = monthKey(date);
  showToast('ບັນທຶກອໍເດີແລ້ວ ✓');
  render();
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
