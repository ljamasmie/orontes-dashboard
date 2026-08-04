/* ============================================================
   ORONTES · SEGUIMIENTO DE TAREAS (versión simplificada)
   JavaScript Vanilla — sin backend, persistencia en LocalStorage
   ============================================================
   Vistas: Tareas (lista) · Dashboard · Encargados
   Cada tarea: nombre, notas, encargado, fecha inicio, fecha término,
   estado (Pendiente / Completado). La "urgencia" (Vencida / Pendiente /
   Completada) se calcula automáticamente a partir de la fecha término.
   ============================================================ */

(function(){
"use strict";

/* ============================================================
   1. DATOS Y ALMACENAMIENTO
   ============================================================ */
const STORAGE_KEYS = {
  tasks: 'orontes_tasks_v2',
  people: 'orontes_people_v2',
  theme: 'orontes_theme',
  sidebarCollapsed: 'orontes_sidebar_collapsed'
};

const PALETTE = ['#4A4F54','#B5654F','#C08A4E','#BFA246','#6F8F72','#5D7C8A','#8B7FA6','#A9A48F','#7C8B99','#B08968'];

function loadJSON(key, fallback){
  try{ const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; }
  catch(e){ return fallback; }
}
function saveJSON(key, value){
  try{ localStorage.setItem(key, JSON.stringify(value)); }catch(e){ console.error('Error guardando', key, e); }
}
function uid(prefix){ return prefix + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2,7); }

function seedPeople(){
  return [
    {id:uid('p'), nombre:'Camila Rojas', cargo:'KAM', email:'camila@empresa.cl', color:PALETTE[0]},
    {id:uid('p'), nombre:'Matías Fuentes', cargo:'Backoffice', email:'matias@empresa.cl', color:PALETTE[1]},
    {id:uid('p'), nombre:'Valentina Soto', cargo:'Comercial', email:'valentina@empresa.cl', color:PALETTE[4]},
    {id:uid('p'), nombre:'Ignacio Pérez', cargo:'Operaciones', email:'ignacio@empresa.cl', color:PALETTE[5]}
  ];
}
function seedTasks(people){
  const p = people;
  const addDays = (n)=>{ const d = new Date(); d.setDate(d.getDate()+n); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; };
  return [
    {id:uid('t'), nombre:'Lanzar campaña "18" (bundle + deadline de pedido)', descripcion:'Coordinar con Back el armado del bundle.', responsable:p[0].id, fechaInicio:addDays(0), fechaTermino:addDays(3), estado:'pendiente'},
    {id:uid('t'), nombre:'Demos a 5 cuentas prioritarias', descripcion:'', responsable:p[2].id, fechaInicio:addDays(-2), fechaTermino:addDays(2), estado:'pendiente'},
    {id:uid('t'), nombre:'Preparar battlecard comparativo', descripcion:'Validar tratamiento tributario con Back.', responsable:p[1].id, fechaInicio:addDays(-5), fechaTermino:addDays(-1), estado:'pendiente'},
    {id:uid('t'), nombre:'Reactivar cuentas dormidas', descripcion:'', responsable:p[0].id, fechaInicio:addDays(-1), fechaTermino:addDays(4), estado:'pendiente'},
    {id:uid('t'), nombre:'Segmentar cartera de clientes por área', descripcion:'', responsable:p[3].id, fechaInicio:addDays(-10), fechaTermino:addDays(-6), estado:'completada'},
    {id:uid('t'), nombre:'Análisis de cuentas traspasadas', descripcion:'', responsable:p[1].id, fechaInicio:addDays(-8), fechaTermino:addDays(-4), estado:'completada'},
    {id:uid('t'), nombre:'Validar estrategia de partners con CCO', descripcion:'', responsable:p[2].id, fechaInicio:addDays(1), fechaTermino:addDays(6), estado:'pendiente'},
    {id:uid('t'), nombre:'Levantar información de ventas por rubro', descripcion:'', responsable:p[0].id, fechaInicio:addDays(2), fechaTermino:addDays(9), estado:'pendiente'}
  ];
}

let STATE = {
  people: loadJSON(STORAGE_KEYS.people, null),
  tasks: loadJSON(STORAGE_KEYS.tasks, null),
  listSort: 'fecha',
  filters: { responsable:'', estado:'' },
  search: '',
  pendingDeleteAction: null
};

if(!Array.isArray(STATE.people)){ STATE.people = seedPeople(); saveJSON(STORAGE_KEYS.people, STATE.people); }
if(!Array.isArray(STATE.tasks)){ STATE.tasks = seedTasks(STATE.people); saveJSON(STORAGE_KEYS.tasks, STATE.tasks); }

function persistTasks(){ saveJSON(STORAGE_KEYS.tasks, STATE.tasks); }
function persistPeople(){ saveJSON(STORAGE_KEYS.people, STATE.people); }

/* Backup automático cada 30s */
setInterval(()=>{ saveJSON('orontes_backup_v2', {tasks:STATE.tasks, people:STATE.people, ts:Date.now()}); }, 30000);

window.resetOrontesData = function(){
  Object.values(STORAGE_KEYS).forEach(k=> localStorage.removeItem(k));
  localStorage.removeItem('orontes_backup_v2');
  location.reload();
};

/* ============================================================
   2. UTILIDADES GENERALES
   ============================================================ */
function pad2(n){ return n.toString().padStart(2,'0'); }
/* Nunca usar Date.toISOString() para fechas locales: convierte a UTC y
   puede devolver el día equivocado según la zona horaria del usuario. */
function toISODate(d){ return `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}`; }
function todayStr(){ return toISODate(new Date()); }
function parseDate(str){ if(!str) return null; const [y,m,d] = str.split('-').map(Number); return new Date(y, m-1, d); }
function fmtDateHuman(str){
  if(!str) return '—';
  const d = parseDate(str);
  const meses = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
  return `${d.getDate()} ${meses[d.getMonth()]} ${d.getFullYear()}`;
}
function daysBetween(a,b){ return Math.round((a-b)/(1000*60*60*24)); }

function getPerson(id){ return STATE.people.find(p=>p.id===id); }
function getPersonName(id){ const p=getPerson(id); return p ? p.nombre : 'Sin asignar'; }
function getPersonColor(id){ const p=getPerson(id); return p ? p.color : '#999'; }
function initials(name){
  if(!name) return '?';
  return name.split(' ').filter(Boolean).slice(0,2).map(w=>w[0].toUpperCase()).join('');
}

const ESTADOS = {
  pendiente:{label:'Pendiente'},
  completada:{label:'Completado'}
};
function getEstadoMeta(key){ return ESTADOS[key] || {label:'Sin definir'}; }

/* Estado visual derivado: si está "completada" se muestra verde. Si está
   "pendiente" y ya pasó la fecha término, se muestra "Vencida" (rojo).
   Si está pendiente y vence hoy/mañana, aviso naranja/amarillo. Si no, neutro. */
function getUrgencyState(task){
  if(task.estado === 'completada') return {key:'done', label:'Completado', fg:'#6F8F72', bg:'var(--state-done-bg)'};
  const due = parseDate(task.fechaTermino || task.fechaInicio);
  const now = parseDate(todayStr());
  const diff = daysBetween(due, now); // due - now: negativo = ya pasó
  if(diff < 0) return {key:'overdue', label:'Vencida', fg:'#B5654F', bg:'var(--state-overdue-bg)'};
  if(diff === 0) return {key:'today', label:'Vence hoy', fg:'#C08A4E', bg:'var(--state-today-bg)'};
  if(diff === 1) return {key:'tomorrow', label:'Vence mañana', fg:'#BFA246', bg:'var(--state-tomorrow-bg)'};
  return {key:'pending', label:'Pendiente', fg:'#8B7FA6', bg:'var(--state-waiting-bg)'};
}

function escapeHtml(str){
  const div = document.createElement('div');
  div.textContent = str == null ? '' : str;
  return div.innerHTML;
}

/* ============================================================
   3. MARCA / RELOJ / TEMA / SIDEBAR
   ============================================================ */
function brandMarkSVG(size, variant){
  // Usa el logo real de Orontes (logo-mark.png). variant 'light' = versión
  // blanca para fondos oscuros (sidebar); 'muted' = versión gris tenue para
  // estados vacíos sobre fondo claro.
  const cls = variant === 'light' ? 'brand-mark-light' : 'brand-mark-muted';
  return `<img src="logo-mark.png" width="${size}" height="${size}" class="${cls}" alt="Orontes" style="display:block;">`;
}
document.getElementById('brandMarkSidebar').innerHTML = brandMarkSVG(28, 'light');

function tickClock(){
  const now = new Date();
  const dias = ['dom','lun','mar','mié','jue','vie','sáb'];
  const meses = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
  const el = document.getElementById('topbarClock');
  el.querySelector('.clock-time').textContent = `${pad2(now.getHours())}:${pad2(now.getMinutes())}:${pad2(now.getSeconds())}`;
  el.querySelector('.clock-date').textContent = `${dias[now.getDay()]}, ${now.getDate()} ${meses[now.getMonth()]}`;
}
setInterval(tickClock, 1000);
tickClock();

function applyTheme(theme){
  document.body.setAttribute('data-theme', theme);
  saveJSON(STORAGE_KEYS.theme, theme);
  const btn = document.getElementById('themeToggle');
  btn.innerHTML = theme==='dark'
    ? '<i class="fa-solid fa-sun"></i><span class="nav-label">Modo claro</span>'
    : '<i class="fa-solid fa-moon"></i><span class="nav-label">Modo oscuro</span>';
}
applyTheme(loadJSON(STORAGE_KEYS.theme, 'light'));
document.getElementById('themeToggle').addEventListener('click', ()=>{
  const cur = document.body.getAttribute('data-theme');
  applyTheme(cur==='dark' ? 'light' : 'dark');
  if(window.ORONTES.renderCharts && document.getElementById('view-dashboard').classList.contains('active')){
    window.ORONTES.renderCharts();
  }
});

function applySidebarState(collapsed){
  document.getElementById('sidebar').classList.toggle('collapsed', collapsed);
  saveJSON(STORAGE_KEYS.sidebarCollapsed, collapsed);
  const btn = document.getElementById('collapseToggle');
  btn.innerHTML = collapsed
    ? '<i class="fa-solid fa-angles-right"></i>'
    : '<i class="fa-solid fa-angles-left"></i><span class="nav-label">Colapsar</span>';
}
applySidebarState(loadJSON(STORAGE_KEYS.sidebarCollapsed, false));
document.getElementById('collapseToggle').addEventListener('click', ()=>{
  applySidebarState(!document.getElementById('sidebar').classList.contains('collapsed'));
});

document.getElementById('resetDataBtn').addEventListener('click', ()=>{
  if(confirm('Esto borrará todas las tareas y encargados guardados en este navegador, y volverá a los datos de ejemplo. ¿Continuar?')){
    resetOrontesData();
  }
});

/* Navegación entre vistas */
const views = ['list','dashboard','people'];
function safeRender(fn, containerEl){
  try{ fn(); }
  catch(err){
    console.error('Orontes · error al renderizar vista:', err);
    if(containerEl){
      containerEl.innerHTML = `<div class="empty-state">
        <i class="fa-solid fa-triangle-exclamation" style="font-size:26px;color:var(--state-overdue);margin-bottom:10px;"></i>
        <p>Ocurrió un problema al mostrar esta vista. Esto suele deberse a datos guardados dañados.</p>
        <button class="btn btn-danger btn-sm" style="margin-top:12px;" onclick="if(confirm('Esto borrará todos los datos guardados en este navegador y volverá a los datos de ejemplo. ¿Continuar?')) resetOrontesData();">
          <i class="fa-solid fa-arrows-rotate"></i> Restablecer datos
        </button>
      </div>`;
    }
  }
}
function switchView(view){
  views.forEach(v=> document.getElementById('view-'+v).classList.toggle('active', v===view));
  document.querySelectorAll('.nav-item').forEach(btn=> btn.classList.toggle('active', btn.dataset.view===view));
  if(view==='list') safeRender(()=>window.ORONTES.renderList(), document.getElementById('listTableBody'));
  if(view==='dashboard') safeRender(()=>window.ORONTES.renderDashboard(), document.getElementById('statGrid'));
  if(view==='people') safeRender(()=>window.ORONTES.renderPeople(), document.getElementById('peopleGrid'));
}
document.querySelectorAll('.nav-item').forEach(btn=> btn.addEventListener('click', ()=> switchView(btn.dataset.view)));

function refreshCurrentView(){
  const activeView = document.querySelector('.view.active').id.replace('view-','');
  switchView(activeView);
}

/* ============================================================
   TOASTS
   ============================================================ */
function toast(msg, type='info', icon='fa-circle-check'){
  const stack = document.getElementById('toastStack');
  const el = document.createElement('div');
  el.className = 'toast ' + type;
  el.innerHTML = `<i class="fa-solid ${icon}"></i><span>${escapeHtml(msg)}</span>`;
  stack.appendChild(el);
  setTimeout(()=>{ el.style.opacity='0'; el.style.transition='opacity 300ms'; setTimeout(()=>el.remove(),300); }, 3200);
}

/* ============================================================
   CONFIRM DIALOG genérico
   ============================================================ */
function askConfirm(title, text, onConfirm){
  document.getElementById('confirmTitle').textContent = title;
  document.getElementById('confirmText').textContent = text;
  STATE.pendingDeleteAction = onConfirm;
  document.getElementById('confirmBackdrop').classList.add('show');
}
document.getElementById('confirmCancel').addEventListener('click', ()=>{
  document.getElementById('confirmBackdrop').classList.remove('show');
  STATE.pendingDeleteAction = null;
});
document.getElementById('confirmOk').addEventListener('click', ()=>{
  if(STATE.pendingDeleteAction) STATE.pendingDeleteAction();
  document.getElementById('confirmBackdrop').classList.remove('show');
  STATE.pendingDeleteAction = null;
});

window.ORONTES = { STATE, STORAGE_KEYS, PALETTE, saveJSON, loadJSON, uid, todayStr, parseDate, fmtDateHuman, toISODate,
  daysBetween, getPerson, getPersonName, getPersonColor, initials, ESTADOS, getEstadoMeta, getUrgencyState,
  escapeHtml, persistTasks, persistPeople, toast, askConfirm, switchView, refreshCurrentView, brandMarkSVG };

})();

/* ============================================================
   4. GESTIÓN DE ENCARGADOS (PERSONAS)
   ============================================================ */
(function(){
const O = window.ORONTES;
const { STATE, PALETTE, persistPeople, uid, initials, toast, askConfirm } = O;

function renderPersonColorSwatches(selected){
  const wrap = document.getElementById('personColorSwatches');
  wrap.innerHTML = PALETTE.map(c=>`<span class="color-swatch" data-color="${c}" style="background:${c};"></span>`).join('');
  wrap.querySelectorAll('.color-swatch').forEach(el=>{
    if(el.dataset.color===selected) el.classList.add('selected');
    el.addEventListener('click', ()=>{
      wrap.querySelectorAll('.color-swatch').forEach(s=>s.classList.remove('selected'));
      el.classList.add('selected');
    });
  });
}
function getSelectedPersonColor(){
  const sel = document.querySelector('#personColorSwatches .selected');
  return sel ? sel.dataset.color : PALETTE[0];
}

function openPersonModal(personId){
  const p = personId ? O.getPerson(personId) : null;
  document.getElementById('personModalTitle').textContent = p ? 'Editar encargado' : 'Nuevo encargado';
  document.getElementById('p-id').value = p ? p.id : '';
  document.getElementById('p-nombre').value = p ? p.nombre : '';
  document.getElementById('p-cargo').value = p ? p.cargo : '';
  document.getElementById('p-email').value = p ? (p.email||'') : '';
  renderPersonColorSwatches(p ? p.color : PALETTE[Math.floor(Math.random()*PALETTE.length)]);
  document.getElementById('personModalBackdrop').classList.add('show');
}
function closePersonModal(){ document.getElementById('personModalBackdrop').classList.remove('show'); }

document.getElementById('personModalClose').addEventListener('click', closePersonModal);
document.getElementById('personModalCancel').addEventListener('click', closePersonModal);
document.getElementById('personModalSave').addEventListener('click', ()=>{
  const nombre = document.getElementById('p-nombre').value.trim();
  if(!nombre){ toast('El nombre es obligatorio', 'error', 'fa-triangle-exclamation'); return; }
  const id = document.getElementById('p-id').value;
  const data = {
    nombre,
    cargo: document.getElementById('p-cargo').value.trim(),
    email: document.getElementById('p-email').value.trim(),
    color: getSelectedPersonColor()
  };
  if(id){
    Object.assign(O.getPerson(id), data);
    toast('Encargado actualizado', 'success', 'fa-circle-check');
  } else {
    STATE.people.push({id: uid('p'), ...data});
    toast('Encargado creado', 'success', 'fa-circle-check');
  }
  persistPeople();
  closePersonModal();
  renderPeople();
  O.refreshAllSelects && O.refreshAllSelects();
});

function deletePerson(id){
  const p = O.getPerson(id);
  askConfirm('¿Eliminar encargado?', `Se eliminará a "${p.nombre}". Las tareas asignadas quedarán sin responsable.`, ()=>{
    STATE.people = STATE.people.filter(x=>x.id!==id);
    STATE.tasks.forEach(t=>{ if(t.responsable===id) t.responsable=''; });
    persistPeople(); O.persistTasks();
    toast('Encargado eliminado', 'success', 'fa-trash');
    renderPeople();
    O.refreshAllSelects && O.refreshAllSelects();
    O.refreshCurrentView();
  });
}

function renderPeople(){
  const grid = document.getElementById('peopleGrid');
  grid.innerHTML = STATE.people.map(p=>{
    const count = STATE.tasks.filter(t=>t.responsable===p.id).length;
    return `<div class="person-card" style="border-left:4px solid ${p.color};">
      <span class="avatar" style="background:${p.color};">${initials(p.nombre)}</span>
      <div class="pc-body">
        <h4>${O.escapeHtml(p.nombre)}</h4>
        <div class="pc-role">${O.escapeHtml(p.cargo||'Sin cargo asignado')}</div>
        ${p.email ? `<div class="pc-email"><i class="fa-regular fa-envelope"></i> ${O.escapeHtml(p.email)}</div>` : ''}
        <div class="pc-role" style="margin-top:6px;"><i class="fa-solid fa-list-check"></i> ${count} tarea(s)</div>
      </div>
      <div class="pc-actions">
        <button class="icon-btn" style="width:30px;height:30px;font-size:12px;" onclick="ORONTES.openPersonModal('${p.id}')"><i class="fa-solid fa-pen"></i></button>
        <button class="icon-btn" style="width:30px;height:30px;font-size:12px;" onclick="ORONTES.deletePerson('${p.id}')"><i class="fa-solid fa-trash"></i></button>
      </div>
    </div>`;
  }).join('') + `<button class="add-person-card" onclick="ORONTES.openPersonModal()"><i class="fa-solid fa-user-plus" style="font-size:20px;"></i><span>Agregar encargado</span></button>`;
}

O.openPersonModal = openPersonModal;
O.deletePerson = deletePerson;
O.renderPeople = renderPeople;
})();

/* ============================================================
   5. GESTIÓN DE TAREAS (CRUD simplificado)
   ============================================================ */
(function(){
const O = window.ORONTES;
const { STATE, persistTasks, uid, toast, askConfirm, todayStr } = O;

function refreshAllSelects(){
  const opts = '<option value="">Sin asignar</option>' + STATE.people.map(p=>`<option value="${p.id}">${O.escapeHtml(p.nombre)}</option>`).join('');
  const sel = document.getElementById('f-responsable');
  const cur = sel.value;
  sel.innerHTML = opts;
  sel.value = cur;
}
refreshAllSelects();
O.refreshAllSelects = refreshAllSelects;

function openTaskModal(taskId){
  const t = taskId ? STATE.tasks.find(x=>x.id===taskId) : null;
  document.getElementById('taskModalTitle').textContent = t ? 'Editar tarea' : 'Nueva tarea';
  document.getElementById('f-id').value = t ? t.id : '';
  document.getElementById('f-nombre').value = t ? t.nombre : '';
  document.getElementById('f-descripcion').value = t ? (t.descripcion||'') : '';
  refreshAllSelects();
  document.getElementById('f-responsable').value = t ? (t.responsable||'') : '';
  document.getElementById('f-fechaInicio').value = t ? t.fechaInicio : todayStr();
  document.getElementById('f-fechaTermino').value = t ? (t.fechaTermino||'') : todayStr();
  document.getElementById('f-estado').value = t ? t.estado : 'pendiente';
  document.getElementById('taskModalBackdrop').classList.add('show');
}
function closeTaskModal(){ document.getElementById('taskModalBackdrop').classList.remove('show'); }
O.openTaskModal = openTaskModal;

document.getElementById('newTaskBtn').addEventListener('click', ()=> openTaskModal());
document.getElementById('taskModalClose').addEventListener('click', closeTaskModal);
document.getElementById('taskModalCancel').addEventListener('click', closeTaskModal);

document.getElementById('taskModalSave').addEventListener('click', ()=>{
  const nombre = document.getElementById('f-nombre').value.trim();
  const fechaInicio = document.getElementById('f-fechaInicio').value;
  if(!nombre){ toast('El nombre de la tarea es obligatorio', 'error', 'fa-triangle-exclamation'); return; }
  if(!fechaInicio){ toast('La fecha de inicio es obligatoria', 'error', 'fa-triangle-exclamation'); return; }

  const data = {
    nombre,
    descripcion: document.getElementById('f-descripcion').value.trim(),
    responsable: document.getElementById('f-responsable').value,
    fechaInicio,
    fechaTermino: document.getElementById('f-fechaTermino').value || fechaInicio,
    estado: document.getElementById('f-estado').value
  };

  const id = document.getElementById('f-id').value;
  let savedTask;
  if(id){
    const t = STATE.tasks.find(x=>x.id===id);
    Object.assign(t, data);
    savedTask = t;
    toast('Tarea actualizada correctamente', 'success', 'fa-circle-check');
  } else {
    const t = {id: uid('t'), ...data};
    STATE.tasks.push(t);
    savedTask = t;
    toast('Tarea creada correctamente', 'success', 'fa-circle-check');
  }
  persistTasks();
  closeTaskModal();
  O.refreshCurrentView();
  const stillVisible = O.applyFilters([savedTask]).length > 0;
  if(!stillVisible){
    toast('La tarea se guardó, pero un filtro activo la está ocultando de esta vista', 'info', 'fa-filter');
  }
});

function deleteTask(id){
  const t = STATE.tasks.find(x=>x.id===id);
  askConfirm('¿Eliminar tarea?', `Se eliminará "${t.nombre}" de forma permanente.`, ()=>{
    STATE.tasks = STATE.tasks.filter(x=>x.id!==id);
    persistTasks();
    toast('Tarea eliminada', 'success', 'fa-trash');
    O.closeTaskDrawer && O.closeTaskDrawer();
    O.refreshCurrentView();
  });
}
function changeTaskStatus(id, estado){
  const t = STATE.tasks.find(x=>x.id===id);
  t.estado = estado;
  persistTasks();
  toast('Estado actualizado', 'success', 'fa-circle-check');
  O.refreshCurrentView();
}
function changeTaskResponsable(id, respId){
  const t = STATE.tasks.find(x=>x.id===id);
  t.responsable = respId;
  persistTasks();
  toast('Encargado actualizado', 'success', 'fa-circle-check');
  O.refreshCurrentView();
}
function moveTaskDate(id, field, newDate){
  const t = STATE.tasks.find(x=>x.id===id);
  t[field] = newDate;
  persistTasks();
  toast('Fecha actualizada', 'success', 'fa-circle-check');
  O.refreshCurrentView();
}

O.deleteTask = deleteTask;
O.changeTaskStatus = changeTaskStatus;
O.changeTaskResponsable = changeTaskResponsable;
O.moveTaskDate = moveTaskDate;
})();

/* ============================================================
   6. TASK DETAIL DRAWER (panel lateral de tarea)
   ============================================================ */
(function(){
const O = window.ORONTES;
const { STATE } = O;

function openTaskDrawer(taskId){
  const t = STATE.tasks.find(x=>x.id===taskId);
  if(!t) return;
  const urgency = O.getUrgencyState(t);
  const estadoOpts = Object.entries(O.ESTADOS).map(([k,v])=>`<option value="${k}" ${t.estado===k?'selected':''}>${v.label}</option>`).join('');
  const respOpts = '<option value="">Sin asignar</option>' + STATE.people.map(p=>`<option value="${p.id}" ${t.responsable===p.id?'selected':''}>${O.escapeHtml(p.nombre)}</option>`).join('');

  document.getElementById('taskDrawerBody').innerHTML = `
    <div class="chip" style="background:${urgency.bg};color:${urgency.fg};margin-bottom:12px;">
      <span class="dot" style="background:${urgency.fg};"></span> ${urgency.label}
    </div>
    <div class="task-detail-title">${O.escapeHtml(t.nombre)}</div>
    <div class="task-detail-desc">${O.escapeHtml(t.descripcion || 'Sin notas.')}</div>

    <div class="detail-meta-grid">
      <div class="detail-meta-item">
        <label>Encargado</label>
        <select id="dd-responsable">${respOpts}</select>
      </div>
      <div class="detail-meta-item">
        <label>Estado</label>
        <select id="dd-estado">${estadoOpts}</select>
      </div>
      <div class="detail-meta-item">
        <label>Fecha inicio</label>
        <input type="date" id="dd-fecha-inicio" value="${t.fechaInicio}">
      </div>
      <div class="detail-meta-item">
        <label>Fecha término</label>
        <input type="date" id="dd-fecha-termino" value="${t.fechaTermino||t.fechaInicio}">
      </div>
    </div>

    <div class="detail-section-title">Acciones</div>
    <div class="detail-actions-row">
      <button class="btn btn-secondary btn-sm" id="dd-edit"><i class="fa-solid fa-pen"></i> Editar</button>
      <button class="btn btn-danger btn-sm" id="dd-delete"><i class="fa-solid fa-trash"></i> Eliminar</button>
    </div>
  `;

  document.getElementById('dd-responsable').addEventListener('change', e=> O.changeTaskResponsable(t.id, e.target.value));
  document.getElementById('dd-estado').addEventListener('change', e=> O.changeTaskStatus(t.id, e.target.value));
  document.getElementById('dd-fecha-inicio').addEventListener('change', e=> O.moveTaskDate(t.id, 'fechaInicio', e.target.value));
  document.getElementById('dd-fecha-termino').addEventListener('change', e=> O.moveTaskDate(t.id, 'fechaTermino', e.target.value));
  document.getElementById('dd-edit').addEventListener('click', ()=>{ closeTaskDrawer(); O.openTaskModal(t.id); });
  document.getElementById('dd-delete').addEventListener('click', ()=> O.deleteTask(t.id));

  document.getElementById('taskDrawer').classList.add('show');
  document.getElementById('overlay').classList.add('show');
}
function closeTaskDrawer(){
  document.getElementById('taskDrawer').classList.remove('show');
  if(!document.getElementById('dayDrawer').classList.contains('show')) document.getElementById('overlay').classList.remove('show');
}
document.getElementById('taskDrawerClose').addEventListener('click', closeTaskDrawer);
O.openTaskDrawer = openTaskDrawer;
O.closeTaskDrawer = closeTaskDrawer;
})();

/* ============================================================
   7. PANEL GENÉRICO DE LISTA DE TAREAS (notificaciones / gráficos)
   ============================================================ */
(function(){
const O = window.ORONTES;
const { STATE } = O;

function openTaskListDrawer(title, tasks){
  document.getElementById('dayDrawerTitle').textContent = title;
  const body = document.getElementById('dayDrawerBody');
  if(!tasks.length){
    body.innerHTML = `<div class="empty-state"><span class="brand-mark">${O.brandMarkSVG(48,'muted')}</span><p>No hay tareas que coincidan.</p></div>`;
  } else {
    body.innerHTML = tasks.map(t=>{
      const urgency = O.getUrgencyState(t);
      return `<div class="day-drawer-item" style="border-left-color:${urgency.fg};" data-id="${t.id}">
        <h4>${O.escapeHtml(t.nombre)}</h4>
        <div class="ddi-meta">
          <span class="chip" style="background:${urgency.bg};color:${urgency.fg};padding:2px 8px;"><span class="dot" style="background:${urgency.fg};"></span>${urgency.label}</span>
          <span><i class="fa-regular fa-user"></i> ${O.escapeHtml(O.getPersonName(t.responsable))}</span>
          <span><i class="fa-regular fa-calendar"></i> ${O.fmtDateHuman(t.fechaTermino||t.fechaInicio)}</span>
        </div>
      </div>`;
    }).join('');
    body.querySelectorAll('.day-drawer-item').forEach(el=> el.addEventListener('click', ()=> O.openTaskDrawer(el.dataset.id)));
  }
  document.getElementById('dayDrawer').classList.add('show');
  document.getElementById('overlay').classList.add('show');
}
function closeDayDrawer(){
  document.getElementById('dayDrawer').classList.remove('show');
  if(!document.getElementById('taskDrawer').classList.contains('show')) document.getElementById('overlay').classList.remove('show');
}
document.getElementById('dayDrawerClose').addEventListener('click', closeDayDrawer);
document.getElementById('overlay').addEventListener('click', ()=>{ closeDayDrawer(); O.closeTaskDrawer(); });
O.openTaskListDrawer = openTaskListDrawer;
O.closeDayDrawer = closeDayDrawer;
})();

/* ============================================================
   8. NOTIFICACIONES (solo tareas vencidas)
   ============================================================ */
(function(){
const O = window.ORONTES;
const { STATE } = O;

function getOverdueTasks(){
  return STATE.tasks.filter(t=> t.estado==='pendiente' && O.getUrgencyState(t).key==='overdue');
}

function renderNotifications(){
  const overdue = getOverdueTasks();
  const badge = document.getElementById('notifBadge');
  if(overdue.length){ badge.style.display='flex'; badge.textContent = overdue.length>9?'9+':overdue.length; }
  else { badge.style.display='none'; }

  const list = document.getElementById('notifList');
  if(!overdue.length){
    list.innerHTML = `<div class="notif-empty"><i class="fa-regular fa-circle-check" style="font-size:20px;display:block;margin-bottom:8px;"></i>No tienes tareas vencidas.</div>`;
    return;
  }
  list.innerHTML = overdue.map(t=>`
    <div class="notif-item" data-task="${t.id}">
      <span class="ni-icon" style="background:var(--state-overdue-bg);color:#B5654F;"><i class="fa-solid fa-triangle-exclamation"></i></span>
      <div class="ni-text"><div><b>${O.escapeHtml(t.nombre)}</b> está vencida</div><div class="ni-time">Venció el ${O.fmtDateHuman(t.fechaTermino||t.fechaInicio)}</div></div>
    </div>`).join('');
  list.querySelectorAll('.notif-item').forEach(el=>{
    el.addEventListener('click', ()=>{
      document.getElementById('notifDropdown').classList.remove('show');
      O.openTaskDrawer(el.dataset.task);
    });
  });
}
O.renderNotifications = renderNotifications;

document.getElementById('notifBtn').addEventListener('click', (e)=>{
  e.stopPropagation();
  document.getElementById('notifDropdown').classList.toggle('show');
});
document.addEventListener('click', (e)=>{
  const dd = document.getElementById('notifDropdown');
  if(dd.classList.contains('show') && !dd.contains(e.target) && e.target.id!=='notifBtn') dd.classList.remove('show');
});
setInterval(renderNotifications, 60000);
})();

/* ============================================================
   9. FILTROS Y RENDER: LISTA DE TAREAS
   ============================================================ */
(function(){
const O = window.ORONTES;
const { STATE } = O;

function applyFilters(list){
  const f = STATE.filters;
  const s = STATE.search.toLowerCase().trim();
  return list.filter(t=>{
    if(f.responsable && t.responsable!==f.responsable) return false;
    if(f.estado && t.estado!==f.estado) return false;
    if(s){
      const hay = [t.nombre, t.descripcion||'', O.getPersonName(t.responsable)].join(' ').toLowerCase();
      if(!hay.includes(s)) return false;
    }
    return true;
  });
}
O.applyFilters = applyFilters;

function buildFilterBar(containerId){
  const container = document.getElementById(containerId);
  container.innerHTML = `
    <select id="${containerId}-responsable"><option value="">Todos los encargados</option>${STATE.people.map(p=>`<option value="${p.id}">${O.escapeHtml(p.nombre)}</option>`).join('')}</select>
    <select id="${containerId}-estado"><option value="">Todos los estados</option>${Object.entries(O.ESTADOS).map(([k,v])=>`<option value="${k}">${v.label}</option>`).join('')}</select>
    <span class="filter-clear" id="${containerId}-clear">Limpiar filtros</span>
  `;
  ['responsable','estado'].forEach(key=>{
    const el = document.getElementById(`${containerId}-${key}`);
    el.value = STATE.filters[key];
    el.addEventListener('change', ()=>{ STATE.filters[key]=el.value; O.refreshCurrentView(); });
  });
  document.getElementById(`${containerId}-clear`).addEventListener('click', ()=>{
    STATE.filters = {responsable:'', estado:''};
    O.refreshCurrentView();
  });
}
O.buildFilterBar = buildFilterBar;

const URGENCY_RANK = {overdue:0, today:1, tomorrow:2, pending:3, done:4};

/* Rango de fechas: si inicio y término son el mismo día, muestra solo esa fecha con formato largo;
   se usa en el detalle. Para la tabla mostramos ambas fechas en columnas separadas, tal como se pidió. */
function fmtDate(str){ return str ? O.fmtDateHuman(str) : '—'; }

function renderList(){
  buildFilterBar('listFilters');
  let tasks = applyFilters(STATE.tasks);

  if(STATE.listSort === 'urgencia'){
    tasks = tasks.sort((a,b)=>{
      const ra = URGENCY_RANK[O.getUrgencyState(a).key] ?? 9;
      const rb = URGENCY_RANK[O.getUrgencyState(b).key] ?? 9;
      if(ra !== rb) return ra - rb;
      return a.fechaInicio.localeCompare(b.fechaInicio);
    });
  } else {
    tasks = tasks.sort((a,b)=> a.fechaInicio.localeCompare(b.fechaInicio));
  }

  document.getElementById('listSubtitle').textContent = `${tasks.length} tarea(s)`;
  const tbody = document.getElementById('listTableBody');
  if(!tasks.length){
    tbody.innerHTML = `<tr><td colspan="5"><div class="empty-state"><span class="brand-mark">${O.brandMarkSVG(44,'muted')}</span><p>No se encontraron tareas con los filtros aplicados.</p></div></td></tr>`;
    return;
  }
  tbody.innerHTML = tasks.map(t=>{
    const urgency = O.getUrgencyState(t);
    const p = O.getPerson(t.responsable);
    const done = t.estado==='completada';
    return `<tr data-id="${t.id}">
      <td>
        <label class="task-check" title="${done ? 'Marcar como pendiente' : 'Marcar como completada'}">
          <input type="checkbox" data-check-id="${t.id}" ${done ? 'checked' : ''}>
          <span class="task-check-box"><i class="fa-solid fa-check"></i></span>
        </label>
        <b class="${done ? 'task-name-done' : ''}">${O.escapeHtml(t.nombre)}</b>${t.descripcion ? `<div style="font-size:11px;color:var(--text-3);margin-top:2px;">${O.escapeHtml(t.descripcion.slice(0,60))}${t.descripcion.length>60?'…':''}</div>` : ''}
      </td>
      <td>${p ? `<div class="person-cell"><span class="avatar" style="background:${p.color};width:24px;height:24px;font-size:9.5px;">${O.initials(p.nombre)}</span>${O.escapeHtml(p.nombre)}</div>` : '<span style="color:var(--text-3);">Sin asignar</span>'}</td>
      <td>${fmtDate(t.fechaInicio)}</td>
      <td>${fmtDate(t.fechaTermino)}</td>
      <td><span class="chip" style="background:${urgency.bg};color:${urgency.fg};"><span class="dot" style="background:${urgency.fg};"></span>${urgency.label}</span></td>
    </tr>`;
  }).join('');
  tbody.querySelectorAll('tr[data-id]').forEach(tr=> tr.addEventListener('click', ()=> O.openTaskDrawer(tr.dataset.id)));
  tbody.querySelectorAll('input[data-check-id]').forEach(cb=>{
    cb.addEventListener('click', (e)=> e.stopPropagation());
    cb.addEventListener('change', (e)=>{
      O.changeTaskStatus(e.target.dataset.checkId, e.target.checked ? 'completada' : 'pendiente');
    });
  });
}
O.renderList = renderList;

document.getElementById('listSortSwitch').addEventListener('click', (e)=>{
  const btn = e.target.closest('button'); if(!btn) return;
  STATE.listSort = btn.dataset.sort;
  document.querySelectorAll('#listSortSwitch button').forEach(b=>b.classList.toggle('active', b===btn));
  renderList();
});
})();

/* ============================================================
   10. RENDER: DASHBOARD (Chart.js)
   ============================================================ */
(function(){
const O = window.ORONTES;
const { STATE } = O;
let charts = {};

function themeColors(){
  const dark = document.body.getAttribute('data-theme')==='dark';
  return { text: dark? '#C7C5BC':'#5B6066', grid: dark? '#3E4146':'#E4E1D8' };
}

function renderStats(){
  const tasks = STATE.tasks;
  const total = tasks.length;
  const completadas = tasks.filter(t=>t.estado==='completada').length;
  const pendientes = tasks.filter(t=>t.estado==='pendiente').length;
  const vencidas = tasks.filter(t=> O.getUrgencyState(t).key==='overdue').length;

  const cards = [
    {label:'Total de tareas', value: total, icon:'fa-list-check', fg:'#4A4F54', bg:'#E7E4DA'},
    {label:'Pendientes', value: pendientes, icon:'fa-circle-dot', fg:'#8B7FA6', bg:'var(--state-waiting-bg)'},
    {label:'Completadas', value: completadas, icon:'fa-circle-check', fg:'#6F8F72', bg:'var(--state-done-bg)'},
    {label:'Vencidas', value: vencidas, icon:'fa-triangle-exclamation', fg:'#B5654F', bg:'var(--state-overdue-bg)'}
  ];
  document.getElementById('statGrid').innerHTML = cards.map(c=>`
    <div class="stat-card">
      <div class="stat-icon" style="background:${c.bg};color:${c.fg};"><i class="fa-solid ${c.icon}"></i></div>
      <div class="stat-value">${c.value}</div>
      <div class="stat-label">${c.label}</div>
    </div>`).join('');
}

function destroyChart(key){ if(charts[key]){ charts[key].destroy(); delete charts[key]; } }

function renderCharts(){
  const tasks = STATE.tasks;
  const tc = themeColors();
  Chart.defaults.color = tc.text;
  Chart.defaults.font.family = "'Inter', sans-serif";
  Chart.defaults.font.size = 11;

  /* --- Por estado (derivado: Vencida / Pendiente / Completada) --- */
  destroyChart('estado');
  const buckets = [
    {key:'overdue', label:'Vencida', color:'#B5654F'},
    {key:'pending', label:'Pendiente', color:'#8B7FA6'},
    {key:'done', label:'Completada', color:'#6F8F72'}
  ];
  const estadoData = buckets.map(b=> tasks.filter(t=>{
    const u = O.getUrgencyState(t);
    if(b.key==='pending') return u.key!=='overdue' && u.key!=='done';
    return u.key===b.key;
  }).length);
  charts.estado = new Chart(document.getElementById('chartEstado'), {
    type:'doughnut',
    data:{ labels:buckets.map(b=>b.label), datasets:[{data:estadoData, backgroundColor:buckets.map(b=>b.color), borderWidth:0}] },
    options:{
      plugins:{legend:{position:'bottom', labels:{boxWidth:10,padding:12}}}, cutout:'62%',
      onClick:(evt, elements)=>{
        if(!elements.length) return;
        const b = buckets[elements[0].index];
        const matching = tasks.filter(t=>{
          const u = O.getUrgencyState(t);
          if(b.key==='pending') return u.key!=='overdue' && u.key!=='done';
          return u.key===b.key;
        });
        O.openTaskListDrawer(`Estado: ${b.label}`, matching);
      },
      onHover:(evt, elements)=>{ evt.native.target.style.cursor = elements.length ? 'pointer' : 'default'; }
    }
  });

  /* --- Por responsable --- */
  destroyChart('responsable');
  const respLabels = STATE.people.map(p=>p.nombre.split(' ')[0]);
  const respData = STATE.people.map(p=> tasks.filter(t=>t.responsable===p.id).length);
  const respColors = STATE.people.map(p=>p.color);
  charts.responsable = new Chart(document.getElementById('chartResponsable'), {
    type:'bar',
    data:{ labels:respLabels, datasets:[{data:respData, backgroundColor:respColors, borderRadius:6, maxBarThickness:36}] },
    options:{
      indexAxis:'y', plugins:{legend:{display:false}}, scales:{ x:{grid:{color:tc.grid}, beginAtZero:true, ticks:{precision:0}}, y:{grid:{display:false}} },
      onClick:(evt, elements)=>{
        if(!elements.length) return;
        const p = STATE.people[elements[0].index];
        O.openTaskListDrawer(`Encargado: ${p.nombre}`, tasks.filter(t=>t.responsable===p.id));
      },
      onHover:(evt, elements)=>{ evt.native.target.style.cursor = elements.length ? 'pointer' : 'default'; }
    }
  });
}

function renderDashboard(){ renderStats(); renderCharts(); }
O.renderDashboard = renderDashboard;
O.renderCharts = renderCharts;
})();

/* ============================================================
   11. BUSCADOR GLOBAL
   ============================================================ */
(function(){
const O = window.ORONTES;
let debounceTimer;
document.getElementById('globalSearch').addEventListener('input', (e)=>{
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(()=>{ O.STATE.search = e.target.value; O.refreshCurrentView(); }, 220);
});
})();

/* ============================================================
   12. EXPORTAR / IMPORTAR
   ============================================================ */
(function(){
const O = window.ORONTES;
const { STATE } = O;

function downloadFile(filename, content, type){
  const blob = new Blob([content], {type});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

document.getElementById('exportJsonBtn').addEventListener('click', ()=>{
  downloadFile('orontes_tareas.json', JSON.stringify({tasks:STATE.tasks, people:STATE.people}, null, 2), 'application/json');
  O.toast('Exportado como JSON', 'success', 'fa-file-code');
});

function tasksToCSV(){
  const headers = ['Nombre','Notas','Encargado','FechaInicio','FechaTermino','Estado'];
  const rows = STATE.tasks.map(t=> [
    t.nombre, t.descripcion||'', O.getPersonName(t.responsable), t.fechaInicio, t.fechaTermino||'', O.getEstadoMeta(t.estado).label
  ].map(v => `"${String(v||'').replace(/"/g,'""')}"`).join(','));
  return [headers.join(','), ...rows].join('\n');
}
document.getElementById('exportCsvBtn').addEventListener('click', ()=>{
  downloadFile('orontes_tareas.csv', tasksToCSV(), 'text/csv;charset=utf-8;');
  O.toast('Exportado como CSV', 'success', 'fa-file-csv');
});

document.getElementById('exportPdfBtn').addEventListener('click', ()=>{
  const tasks = O.applyFilters(STATE.tasks);
  const win = window.open('', '_blank');
  win.document.write(`
    <html><head><title>Orontes - Tareas</title>
    <style>
      body{font-family:Arial, sans-serif; padding:30px; color:#2E3134;}
      h1{font-family:Arial; letter-spacing:2px; color:#4A4F54; font-size:20px;}
      table{width:100%; border-collapse:collapse; margin-top:16px;}
      th,td{border:1px solid #ddd; padding:8px 10px; font-size:12px; text-align:left;}
      th{background:#EFEDE6;}
    </style></head><body>
    <h1>ORONTES - Listado de tareas</h1>
    <p style="color:#8B8F92;font-size:12px;">Generado el ${new Date().toLocaleString('es-CL')}</p>
    <table><thead><tr><th>Tarea</th><th>Encargado</th><th>Fecha inicio</th><th>Fecha término</th><th>Estado</th></tr></thead><tbody>
    ${tasks.map(t=>`<tr><td>${O.escapeHtml(t.nombre)}</td><td>${O.escapeHtml(O.getPersonName(t.responsable))}</td><td>${t.fechaInicio}</td><td>${t.fechaTermino||''}</td><td>${O.getEstadoMeta(t.estado).label}</td></tr>`).join('')}
    </tbody></table>
    </body></html>`);
  win.document.close();
  setTimeout(()=> win.print(), 350);
});

document.getElementById('importInput').addEventListener('change', (e)=>{
  const file = e.target.files[0];
  if(!file) return;
  const reader = new FileReader();
  reader.onload = (ev)=>{
    try{
      if(file.name.endsWith('.json')){
        const data = JSON.parse(ev.target.result);
        if(data.tasks){ data.tasks.forEach(t=> STATE.tasks.push({...t, id: O.uid('t')})); O.persistTasks(); }
        if(data.people){ data.people.forEach(p=> STATE.people.push({...p, id:O.uid('p')})); O.persistPeople(); }
      } else {
        const lines = ev.target.result.split(/\r?\n/).filter(Boolean);
        const headers = lines[0].split(',').map(h=>h.replace(/"/g,'').trim().toLowerCase());
        lines.slice(1).forEach(line=>{
          const cols = line.match(/(".*?"|[^,]+)(?=,|$)/g).map(c=>c.replace(/^"|"$/g,'').replace(/""/g,'"'));
          const get = (name)=>{ const i = headers.indexOf(name); return i>=0 ? cols[i] : ''; };
          STATE.tasks.push({
            id:O.uid('t'), nombre:get('nombre')||'Tarea importada', descripcion:get('notas')||'',
            responsable:'', fechaInicio:get('fechainicio')||O.todayStr(), fechaTermino:get('fechatermino')||get('fechainicio')||O.todayStr(),
            estado:'pendiente'
          });
        });
        O.persistTasks();
      }
      O.toast('Importación completada', 'success', 'fa-file-import');
      O.refreshCurrentView();
      O.renderNotifications();
    }catch(err){
      console.error(err);
      O.toast('Error al importar el archivo', 'error', 'fa-triangle-exclamation');
    }
    e.target.value = '';
  };
  reader.readAsText(file);
});
})();

/* ============================================================
   13. INICIALIZACIÓN
   ============================================================ */
(function(){
const O = window.ORONTES;

['taskModalBackdrop','personModalBackdrop','confirmBackdrop'].forEach(id=>{
  document.getElementById(id).addEventListener('click', (e)=>{
    if(e.target.id===id) document.getElementById(id).classList.remove('show');
  });
});
document.addEventListener('keydown', (e)=>{
  if(e.key==='Escape'){
    document.querySelectorAll('.modal-backdrop.show').forEach(m=>m.classList.remove('show'));
    O.closeTaskDrawer();
    O.closeDayDrawer();
  }
});

document.getElementById('mobileMenuBtn').addEventListener('click', ()=>{
  document.getElementById('sidebar').classList.toggle('mobile-open');
});
if(window.innerWidth <= 900){ document.getElementById('mobileMenuBtn').style.display='flex'; }

O.renderList();
O.renderNotifications();
O.toast('Bienvenido/a al panel de Orontes', 'info', 'fa-tooth');
})();
