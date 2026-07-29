/* ============================================================
   ORONTES · DASHBOARD DE GESTIÓN DE TAREAS Y CALENDARIO
   JavaScript Vanilla — sin backend, persistencia en LocalStorage
   ============================================================
   Índice:
   1. Datos y almacenamiento (Storage)
   2. Utilidades generales
   3. Marca / reloj / tema / sidebar
   4. Gestión de encargados (personas)
   5. Gestión de tareas (CRUD, comentarios, actividad)
   6. Notificaciones
   7. Render: Calendario (mes/semana/día)
   8. Render: Kanban
   9. Render: Lista
   10. Render: Dashboard (Chart.js)
   11. Buscador y filtros
   12. Exportar / Importar
   13. Inicialización
   ============================================================ */

(function(){
"use strict";

/* ============================================================
   1. DATOS Y ALMACENAMIENTO
   ============================================================ */
const STORAGE_KEYS = {
  tasks: 'orontes_tasks',
  people: 'orontes_people',
  notifRead: 'orontes_notif_read',
  theme: 'orontes_theme',
  sidebarCollapsed: 'orontes_sidebar_collapsed',
  activity: 'orontes_activity'
};

const PALETTE = ['#4A4F54','#B5654F','#C08A4E','#BFA246','#6F8F72','#5D7C8A','#8B7FA6','#A9A48F','#7C8B99','#B08968'];

function loadJSON(key, fallback){
  try{
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  }catch(e){ return fallback; }
}
function saveJSON(key, value){
  try{ localStorage.setItem(key, JSON.stringify(value)); }catch(e){ console.error('Error guardando', key, e); }
}

function uid(prefix){ return prefix + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2,7); }

/* ---- Datos semilla (se cargan solo la primera vez) ---- */
function seedPeople(){
  return [
    {id:uid('p'), nombre:'Dra. Camila Rojas', cargo:'Odontóloga General', email:'camila@orontesodontologia.cl', color:PALETTE[0]},
    {id:uid('p'), nombre:'Dr. Matías Fuentes', cargo:'Especialista en Estética', email:'matias@orontesodontologia.cl', color:PALETTE[1]},
    {id:uid('p'), nombre:'Valentina Soto', cargo:'Recepción', email:'valentina@orontesodontologia.cl', color:PALETTE[4]},
    {id:uid('p'), nombre:'Ignacio Pérez', cargo:'Asistente Dental', email:'ignacio@orontesodontologia.cl', color:PALETTE[5]}
  ];
}

function seedTasks(people){
  const today = new Date();
  const fmt = (d)=> d.toISOString().slice(0,10);
  const addDays = (n)=>{ const d = new Date(today); d.setDate(d.getDate()+n); return fmt(d); };
  const p = people;
  return [
    {id:uid('t'), nombre:'Control post-operatorio · Paciente Herrera', descripcion:'Revisión de cicatrización tras extracción de muela del juicio.', fechaInicio:addDays(0), fechaTermino:addDays(0), hora:'10:30', responsable:p[0].id, estado:'pendiente', prioridad:'alta', categoria:'Clínico', etiquetas:['control','cirugía'], color:PALETTE[0], comentarios:[], adjuntos:[]},
    {id:uid('t'), nombre:'Whitening estético · Sesión 2', descripcion:'Segunda sesión de blanqueamiento dental profesional.', fechaInicio:addDays(0), fechaTermino:addDays(0), hora:'16:00', responsable:p[1].id, estado:'progreso', prioridad:'media', categoria:'Estética', etiquetas:['blanqueamiento'], color:PALETTE[1], comentarios:[], adjuntos:[]},
    {id:uid('t'), nombre:'Confirmar hora paciente Muñoz', descripcion:'Llamar para confirmar asistencia de mañana.', fechaInicio:addDays(1), fechaTermino:addDays(1), hora:'09:00', responsable:p[2].id, estado:'pendiente', prioridad:'urgente', categoria:'Administrativo', etiquetas:['agenda'], color:PALETTE[4], comentarios:[], adjuntos:[]},
    {id:uid('t'), nombre:'Pedido de insumos clínicos', descripcion:'Reponer guantes, anestesia y resinas.', fechaInicio:addDays(-1), fechaTermino:addDays(-1), hora:'', responsable:p[3].id, estado:'pendiente', prioridad:'alta', categoria:'Administrativo', etiquetas:['insumos'], color:PALETTE[5], comentarios:[], adjuntos:[]},
    {id:uid('t'), nombre:'Diseño de sonrisa · Consulta inicial', descripcion:'Primera evaluación estética con fotografías.', fechaInicio:addDays(2), fechaTermino:addDays(2), hora:'11:15', responsable:p[1].id, estado:'espera', prioridad:'media', categoria:'Estética', etiquetas:['diseño-sonrisa'], color:PALETTE[1], comentarios:[], adjuntos:[]},
    {id:uid('t'), nombre:'Limpieza dental · Paciente López', descripcion:'Profilaxis semestral.', fechaInicio:addDays(-3), fechaTermino:addDays(-3), hora:'', responsable:p[0].id, estado:'completada', prioridad:'baja', categoria:'Clínico', etiquetas:['profilaxis'], color:PALETTE[0], comentarios:[], adjuntos:[]},
    {id:uid('t'), nombre:'Actualizar ficha clínica digital', descripcion:'Migrar fichas de papel al sistema digital.', fechaInicio:addDays(5), fechaTermino:addDays(7), hora:'', responsable:p[2].id, estado:'pendiente', prioridad:'baja', categoria:'Administrativo', etiquetas:['fichas'], color:PALETTE[4], comentarios:[], adjuntos:[]},
    {id:uid('t'), nombre:'Reunión de equipo semanal', descripcion:'Revisión de agenda e indicadores de la semana.', fechaInicio:addDays(3), fechaTermino:addDays(3), hora:'08:30', responsable:p[3].id, estado:'pendiente', prioridad:'media', categoria:'Interno', etiquetas:['reunión'], color:PALETTE[5], comentarios:[], adjuntos:[]}
  ];
}

let STATE = {
  people: loadJSON(STORAGE_KEYS.people, null),
  tasks: loadJSON(STORAGE_KEYS.tasks, null),
  notifRead: loadJSON(STORAGE_KEYS.notifRead, []),
  activity: loadJSON(STORAGE_KEYS.activity, []),
  calMode: 'month',
  calDate: new Date(),
  filters: { responsable:'', estado:'', prioridad:'', categoria:'', etiqueta:'' },
  search: '',
  editingTaskId: null,
  editingPersonId: null,
  tempTags: [],
  tempFiles: [],
  pendingDeleteAction: null
};

/* Blindaje: si los datos guardados están corruptos o no son arreglos válidos,
   se restauran automáticamente para evitar pantallas en blanco. */
if(!Array.isArray(STATE.people)){ STATE.people = seedPeople(); saveJSON(STORAGE_KEYS.people, STATE.people); }
if(!Array.isArray(STATE.tasks)){ STATE.tasks = seedTasks(STATE.people); saveJSON(STORAGE_KEYS.tasks, STATE.tasks); }
if(!Array.isArray(STATE.notifRead)) STATE.notifRead = [];
if(!Array.isArray(STATE.activity)) STATE.activity = [];

/* Restablecer todos los datos de fábrica (borra localStorage de Orontes y recarga) */
window.resetOrontesData = function(){
  Object.values(STORAGE_KEYS).forEach(k=> localStorage.removeItem(k));
  localStorage.removeItem('orontes_backup');
  location.reload();
};

function persistTasks(){ saveJSON(STORAGE_KEYS.tasks, STATE.tasks); }
function persistPeople(){ saveJSON(STORAGE_KEYS.people, STATE.people); }
function persistActivity(){ saveJSON(STORAGE_KEYS.activity, STATE.activity.slice(0,60)); }

/* Sistema de backup automático: cada 30s serializa todo a una key de respaldo */
setInterval(()=>{
  saveJSON('orontes_backup', {tasks:STATE.tasks, people:STATE.people, ts:Date.now()});
}, 30000);

/* ============================================================
   2. UTILIDADES GENERALES
   ============================================================ */
function pad2(n){ return n.toString().padStart(2,'0'); }
function todayStr(){ return new Date().toISOString().slice(0,10); }
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
  pendiente:{label:'Pendiente', color:'var(--state-waiting)', bg:'var(--state-waiting-bg)', fg:'#8B7FA6'},
  progreso:{label:'En proceso', color:'var(--state-progress)', bg:'var(--state-progress-bg)', fg:'#5D7C8A'},
  espera:{label:'Esperando información', color:'var(--state-tomorrow)', bg:'var(--state-tomorrow-bg)', fg:'#BFA246'},
  completada:{label:'Completada', color:'var(--state-done)', bg:'var(--state-done-bg)', fg:'#6F8F72'},
  cancelada:{label:'Cancelada', color:'var(--state-cancelled)', bg:'var(--state-cancelled-bg)', fg:'#9A9A94'}
};
const PRIORIDADES = {
  baja:{label:'Baja', color:'#8FA5A0'},
  media:{label:'Media', color:'#C9A85F'},
  alta:{label:'Alta', color:'#C0784F'},
  urgente:{label:'Urgente', color:'#B5504A'}
};

/* Determina el "color de vencimiento" visual de una tarea según reglas del negocio */
function getUrgencyState(task){
  if(task.estado === 'completada') return {key:'done', label:'Completada', fg:'#6F8F72', bg:'var(--state-done-bg)'};
  if(task.estado === 'cancelada') return {key:'cancelled', label:'Cancelada', fg:'#9A9A94', bg:'var(--state-cancelled-bg)'};
  if(!task.fechaTermino && !task.fechaInicio) return {key:'progress', label:'En proceso', fg:'#5D7C8A', bg:'var(--state-progress-bg)'};
  const due = parseDate(task.fechaTermino || task.fechaInicio);
  const now = parseDate(todayStr());
  const diff = daysBetween(due, now);
  if(diff > 0) return {key:'overdue', label:'Vencida', fg:'#B5654F', bg:'var(--state-overdue-bg)'};
  if(diff === 0) return {key:'today', label:'Vence hoy', fg:'#C08A4E', bg:'var(--state-today-bg)'};
  if(diff === -1) return {key:'tomorrow', label:'Vence mañana', fg:'#BFA246', bg:'var(--state-tomorrow-bg)'};
  if(task.estado === 'progreso') return {key:'progress', label:'En proceso', fg:'#5D7C8A', bg:'var(--state-progress-bg)'};
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
function brandMarkSVG(size, color){
  // Recreación del isotipo Orontes: anillo roto en tres arcos, estilo geométrico.
  return `<svg width="${size}" height="${size}" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M50 8 A42 42 0 0 1 88 45" stroke="${color}" stroke-width="11" stroke-linecap="round"/>
    <path d="M14 58 A42 42 0 0 1 33 15" stroke="${color}" stroke-width="11" stroke-linecap="round"/>
    <path d="M62 90 A42 42 0 0 1 20 68" stroke="${color}" stroke-width="11" stroke-linecap="round"/>
  </svg>`;
}
document.getElementById('brandMarkSidebar').innerHTML = brandMarkSVG(26, '#C9C5B6');

/* Reloj en tiempo real */
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

/* Tema claro/oscuro */
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
    window.ORONTES.renderCharts(); // re-render charts para adaptarse a colores
  }
});

/* Sidebar colapsable */
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

/* Navegación entre vistas */
const views = ['calendar','kanban','list','dashboard','people'];
function safeRender(fn, containerEl){
  try{
    fn();
  }catch(err){
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
  views.forEach(v=>{
    document.getElementById('view-'+v).classList.toggle('active', v===view);
  });
  document.querySelectorAll('.nav-item').forEach(btn=>{
    btn.classList.toggle('active', btn.dataset.view===view);
  });
  if(view==='calendar') safeRender(()=>window.ORONTES.renderCalendar(), document.getElementById('calContainer'));
  if(view==='kanban') safeRender(()=>window.ORONTES.renderKanban(), document.getElementById('kanbanBoard'));
  if(view==='list') safeRender(()=>window.ORONTES.renderList(), document.getElementById('listTableBody'));
  if(view==='dashboard') safeRender(()=>window.ORONTES.renderDashboard(), document.getElementById('statGrid'));
  if(view==='people') safeRender(()=>window.ORONTES.renderPeople(), document.getElementById('peopleGrid'));
}
document.querySelectorAll('.nav-item').forEach(btn=>{
  btn.addEventListener('click', ()=> switchView(btn.dataset.view));
});

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

window.ORONTES = { STATE, STORAGE_KEYS, PALETTE, saveJSON, loadJSON, uid, todayStr, parseDate, fmtDateHuman,
  daysBetween, getPerson, getPersonName, getPersonColor, initials, ESTADOS, PRIORIDADES, getUrgencyState,
  escapeHtml, persistTasks, persistPeople, persistActivity, toast, askConfirm, switchView, brandMarkSVG };

})();

/* ============================================================
   4. ACTIVIDAD (historial automático)
   ============================================================ */
(function(){
const { STATE, persistActivity } = window.ORONTES;
window.ORONTES.logActivity = function(text, icon){
  STATE.activity.unshift({id:'a_'+Date.now(), text, icon: icon||'fa-circle-info', ts: Date.now()});
  STATE.activity = STATE.activity.slice(0,80);
  persistActivity();
};
window.ORONTES.timeAgo = function(ts){
  const diff = Math.floor((Date.now()-ts)/1000);
  if(diff<60) return 'hace instantes';
  if(diff<3600) return `hace ${Math.floor(diff/60)} min`;
  if(diff<86400) return `hace ${Math.floor(diff/3600)} h`;
  return `hace ${Math.floor(diff/86400)} d`;
};
})();

/* ============================================================
   5. GESTIÓN DE ENCARGADOS (PERSONAS)
   ============================================================ */
(function(){
const O = window.ORONTES;
const { STATE, PALETTE, persistPeople, uid, initials, toast, askConfirm, logActivity } = O;

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
  STATE.editingPersonId = personId || null;
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
    const p = O.getPerson(id);
    Object.assign(p, data);
    logActivity(`<b>${nombre}</b> fue actualizado en Encargados`, 'fa-user-pen');
    toast('Encargado actualizado', 'success', 'fa-circle-check');
  } else {
    STATE.people.push({id: uid('p'), ...data});
    logActivity(`<b>${nombre}</b> fue agregado como nuevo encargado`, 'fa-user-plus');
    toast('Encargado creado', 'success', 'fa-circle-check');
  }
  persistPeople();
  closePersonModal();
  renderPeople();
  window.ORONTES.refreshAllSelects && window.ORONTES.refreshAllSelects();
});

function deletePerson(id){
  const p = O.getPerson(id);
  askConfirm('¿Eliminar encargado?', `Se eliminará a "${p.nombre}". Las tareas asignadas quedarán sin responsable.`, ()=>{
    STATE.people = STATE.people.filter(x=>x.id!==id);
    STATE.tasks.forEach(t=>{ if(t.responsable===id) t.responsable=''; });
    persistPeople(); O.persistTasks();
    logActivity(`<b>${p.nombre}</b> fue eliminado de Encargados`, 'fa-user-xmark');
    toast('Encargado eliminado', 'success', 'fa-trash');
    renderPeople();
    O.refreshAllSelects && O.refreshAllSelects();
    O.refreshCurrentView && O.refreshCurrentView();
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
   6. GESTIÓN DE TAREAS (CRUD, comentarios, adjuntos)
   ============================================================ */
(function(){
const O = window.ORONTES;
const { STATE, PALETTE, persistTasks, uid, toast, askConfirm, logActivity, todayStr } = O;

/* --- Poblar selects de responsable en toda la app --- */
function refreshAllSelects(){
  const opts = '<option value="">Sin asignar</option>' + STATE.people.map(p=>`<option value="${p.id}">${O.escapeHtml(p.nombre)}</option>`).join('');
  const sel = document.getElementById('f-responsable');
  const cur = sel.value;
  sel.innerHTML = opts;
  sel.value = cur;
}
refreshAllSelects();
O.refreshAllSelects = refreshAllSelects;

/* --- Swatches de color en el formulario de tarea --- */
function renderTaskColorSwatches(selected){
  const wrap = document.getElementById('colorSwatches');
  wrap.innerHTML = PALETTE.map(c=>`<span class="color-swatch" data-color="${c}" style="background:${c};"></span>`).join('');
  wrap.querySelectorAll('.color-swatch').forEach(el=>{
    if(el.dataset.color===selected) el.classList.add('selected');
    el.addEventListener('click', ()=>{
      wrap.querySelectorAll('.color-swatch').forEach(s=>s.classList.remove('selected'));
      el.classList.add('selected');
    });
  });
}
function getSelectedTaskColor(){
  const sel = document.querySelector('#colorSwatches .selected');
  return sel ? sel.dataset.color : PALETTE[0];
}

/* --- Tags editables en el formulario --- */
function renderTagInputs(){
  const wrap = document.getElementById('tagInputWrap');
  const input = document.getElementById('f-tagInput');
  wrap.querySelectorAll('.tag-editable').forEach(el=>el.remove());
  STATE.tempTags.forEach((tag,i)=>{
    const chip = document.createElement('span');
    chip.className = 'tag-editable';
    chip.innerHTML = `${O.escapeHtml(tag)} <i class="fa-solid fa-xmark" data-i="${i}"></i>`;
    wrap.insertBefore(chip, input);
  });
  wrap.querySelectorAll('.tag-editable i').forEach(icon=>{
    icon.addEventListener('click', ()=>{
      STATE.tempTags.splice(Number(icon.dataset.i),1);
      renderTagInputs();
    });
  });
}
document.getElementById('f-tagInput').addEventListener('keydown', (e)=>{
  if(e.key==='Enter'){
    e.preventDefault();
    const v = e.target.value.trim();
    if(v && !STATE.tempTags.includes(v)){ STATE.tempTags.push(v); renderTagInputs(); }
    e.target.value='';
  }
});

/* --- Adjuntos (solo metadatos: nombre/tamaño, no se sube contenido real) --- */
document.getElementById('fileDrop').addEventListener('click', ()=> document.getElementById('f-files').click());
document.getElementById('fileDrop').addEventListener('dragover', e=>{ e.preventDefault(); });
document.getElementById('fileDrop').addEventListener('drop', e=>{
  e.preventDefault();
  addFiles(e.dataTransfer.files);
});
document.getElementById('f-files').addEventListener('change', e=> addFiles(e.target.files));
function addFiles(fileList){
  Array.from(fileList).forEach(f=> STATE.tempFiles.push({name:f.name, size:f.size}));
  renderFileList();
}
function renderFileList(){
  const wrap = document.getElementById('fileList');
  wrap.innerHTML = STATE.tempFiles.map((f,i)=>`<span class="file-chip"><i class="fa-solid fa-file"></i> ${O.escapeHtml(f.name)} <i class="fa-solid fa-xmark" style="cursor:pointer;" data-i="${i}"></i></span>`).join('');
  wrap.querySelectorAll('i.fa-xmark').forEach(icon=>{
    icon.addEventListener('click', ()=>{ STATE.tempFiles.splice(Number(icon.dataset.i),1); renderFileList(); });
  });
}

/* --- Abrir / cerrar modal de tarea --- */
function openTaskModal(taskId, presetDate){
  STATE.editingTaskId = taskId || null;
  const t = taskId ? STATE.tasks.find(x=>x.id===taskId) : null;
  document.getElementById('taskModalTitle').textContent = t ? 'Editar tarea' : 'Nueva tarea';
  document.getElementById('f-id').value = t ? t.id : '';
  document.getElementById('f-nombre').value = t ? t.nombre : '';
  document.getElementById('f-descripcion').value = t ? t.descripcion : '';
  refreshAllSelects();
  document.getElementById('f-responsable').value = t ? (t.responsable||'') : '';
  document.getElementById('f-categoria').value = t ? (t.categoria||'') : '';
  document.getElementById('f-fechaInicio').value = t ? t.fechaInicio : (presetDate || todayStr());
  document.getElementById('f-fechaTermino').value = t ? (t.fechaTermino||'') : (presetDate || todayStr());
  document.getElementById('f-hora').value = t ? (t.hora||'') : '';
  document.getElementById('f-prioridad').value = t ? t.prioridad : 'media';
  document.getElementById('f-estado').value = t ? t.estado : 'pendiente';
  renderTaskColorSwatches(t ? t.color : PALETTE[0]);
  STATE.tempTags = t ? [...t.etiquetas] : [];
  STATE.tempFiles = t ? [...(t.adjuntos||[])] : [];
  renderTagInputs();
  renderFileList();
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
    categoria: document.getElementById('f-categoria').value.trim(),
    fechaInicio,
    fechaTermino: document.getElementById('f-fechaTermino').value || fechaInicio,
    hora: document.getElementById('f-hora').value,
    prioridad: document.getElementById('f-prioridad').value,
    estado: document.getElementById('f-estado').value,
    color: getSelectedTaskColor(),
    etiquetas: [...STATE.tempTags],
    adjuntos: [...STATE.tempFiles]
  };

  const id = document.getElementById('f-id').value;
  if(id){
    const t = STATE.tasks.find(x=>x.id===id);
    Object.assign(t, data);
    logActivity(`<b>${O.escapeHtml(nombre)}</b> fue actualizada`, 'fa-pen');
    toast('Tarea actualizada correctamente', 'success', 'fa-circle-check');
  } else {
    const t = {id: uid('t'), comentarios:[], ...data};
    STATE.tasks.push(t);
    logActivity(`<b>${O.escapeHtml(nombre)}</b> fue creada`, 'fa-plus');
    toast('Tarea creada correctamente', 'success', 'fa-circle-check');
  }
  persistTasks();
  closeTaskModal();
  O.refreshCurrentView();
  O.renderNotifications && O.renderNotifications();
});

function deleteTask(id){
  const t = STATE.tasks.find(x=>x.id===id);
  askConfirm('¿Eliminar tarea?', `Se eliminará "${t.nombre}" de forma permanente.`, ()=>{
    STATE.tasks = STATE.tasks.filter(x=>x.id!==id);
    persistTasks();
    logActivity(`<b>${O.escapeHtml(t.nombre)}</b> fue eliminada`, 'fa-trash');
    toast('Tarea eliminada', 'success', 'fa-trash');
    O.closeTaskDrawer && O.closeTaskDrawer();
    O.refreshCurrentView();
    O.renderNotifications && O.renderNotifications();
  });
}
function duplicateTask(id){
  const t = STATE.tasks.find(x=>x.id===id);
  const copy = {...t, id: uid('t'), nombre: t.nombre + ' (copia)', comentarios:[]};
  STATE.tasks.push(copy);
  persistTasks();
  logActivity(`<b>${O.escapeHtml(t.nombre)}</b> fue duplicada`, 'fa-copy');
  toast('Tarea duplicada', 'success', 'fa-copy');
  O.refreshCurrentView();
}
function changeTaskStatus(id, estado){
  const t = STATE.tasks.find(x=>x.id===id);
  const prevLabel = O.ESTADOS[t.estado].label;
  t.estado = estado;
  persistTasks();
  logActivity(`<b>${O.escapeHtml(t.nombre)}</b> cambió de "${prevLabel}" a "${O.ESTADOS[estado].label}"`, 'fa-shuffle');
  toast('Estado actualizado', 'success', 'fa-circle-check');
  O.refreshCurrentView();
  O.renderNotifications && O.renderNotifications();
}
function changeTaskResponsable(id, respId){
  const t = STATE.tasks.find(x=>x.id===id);
  t.responsable = respId;
  persistTasks();
  logActivity(`<b>${O.escapeHtml(t.nombre)}</b> cambió de responsable a ${O.getPersonName(respId)}`, 'fa-user-check');
  toast('Responsable actualizado', 'success', 'fa-circle-check');
  O.refreshCurrentView();
}
function moveTaskDate(id, newDate){
  const t = STATE.tasks.find(x=>x.id===id);
  const oldDur = O.daysBetween(O.parseDate(t.fechaTermino||t.fechaInicio), O.parseDate(t.fechaInicio));
  t.fechaInicio = newDate;
  const d = O.parseDate(newDate); d.setDate(d.getDate()+oldDur);
  t.fechaTermino = d.toISOString().slice(0,10);
  persistTasks();
  logActivity(`<b>${O.escapeHtml(t.nombre)}</b> se movió al ${O.fmtDateHuman(newDate)}`, 'fa-calendar-day');
  toast('Fecha actualizada', 'success', 'fa-circle-check');
  O.refreshCurrentView();
  O.renderNotifications && O.renderNotifications();
}
function addComment(taskId, text){
  const t = STATE.tasks.find(x=>x.id===taskId);
  const now = new Date();
  t.comentarios.push({id:uid('c'), autor:'Yo', texto:text, fecha:now.toISOString().slice(0,10), hora:`${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`});
  persistTasks();
  logActivity(`Nuevo comentario en <b>${O.escapeHtml(t.nombre)}</b>`, 'fa-comment');
  O.renderNotifications && O.renderNotifications();
}

O.deleteTask = deleteTask;
O.duplicateTask = duplicateTask;
O.changeTaskStatus = changeTaskStatus;
O.changeTaskResponsable = changeTaskResponsable;
O.moveTaskDate = moveTaskDate;
O.addComment = addComment;
})();

/* ============================================================
   TASK DETAIL DRAWER (panel lateral de tarea)
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
    <div class="task-detail-desc">${O.escapeHtml(t.descripcion || 'Sin descripción.')}</div>

    <div class="detail-meta-grid">
      <div class="detail-meta-item">
        <label>Responsable</label>
        <select id="dd-responsable">${respOpts}</select>
      </div>
      <div class="detail-meta-item">
        <label>Estado</label>
        <select id="dd-estado">${estadoOpts}</select>
      </div>
      <div class="detail-meta-item">
        <label>Fecha</label>
        <input type="date" id="dd-fecha" value="${t.fechaInicio}">
      </div>
      <div class="detail-meta-item">
        <label>Prioridad</label>
        <span class="chip" style="background:${O.PRIORIDADES[t.prioridad].color}22;color:${O.PRIORIDADES[t.prioridad].color};"><span class="dot" style="background:${O.PRIORIDADES[t.prioridad].color};"></span> ${O.PRIORIDADES[t.prioridad].label}</span>
      </div>
    </div>

    ${t.etiquetas && t.etiquetas.length ? `<div class="tag-list">${t.etiquetas.map(tag=>`<span class="tag">#${O.escapeHtml(tag)}</span>`).join('')}</div>` : ''}

    ${t.adjuntos && t.adjuntos.length ? `<div class="detail-section-title">Adjuntos</div><div class="file-list">${t.adjuntos.map(f=>`<span class="file-chip"><i class="fa-solid fa-paperclip"></i> ${O.escapeHtml(f.name)}</span>`).join('')}</div>` : ''}

    <div class="detail-section-title">Acciones</div>
    <div class="detail-actions-row">
      <button class="btn btn-secondary btn-sm" id="dd-edit"><i class="fa-solid fa-pen"></i> Editar</button>
      <button class="btn btn-secondary btn-sm" id="dd-duplicate"><i class="fa-solid fa-copy"></i> Duplicar</button>
      <button class="btn btn-danger btn-sm" id="dd-delete"><i class="fa-solid fa-trash"></i> Eliminar</button>
    </div>

    <div class="detail-section-title">Comentarios <span style="color:var(--text-3);font-weight:500;">${t.comentarios.length}</span></div>
    <div id="dd-comments">
      ${t.comentarios.length ? t.comentarios.map(c=>`
        <div class="comment-item">
          <span class="avatar" style="background:var(--brand-800);">${O.initials(c.autor)}</span>
          <div class="comment-body">
            <div class="comment-head"><span class="comment-author">${O.escapeHtml(c.autor)}</span><span class="comment-time">${c.fecha} · ${c.hora}</span></div>
            <div class="comment-text">${O.escapeHtml(c.texto)}</div>
          </div>
        </div>`).join('') : '<p style="font-size:12px;color:var(--text-3);">Aún no hay comentarios.</p>'}
    </div>
    <div class="comment-input-row">
      <input type="text" id="dd-comment-input" placeholder="Escribe un comentario...">
      <button id="dd-comment-send"><i class="fa-solid fa-paper-plane"></i></button>
    </div>

    <div class="detail-section-title">Actividad reciente</div>
    <div id="dd-activity">
      ${STATE.activity.filter(a=>a.text.includes(O.escapeHtml(t.nombre))).slice(0,6).map(a=>`
        <div class="activity-item"><i class="fa-solid ${a.icon}"></i><div><span>${a.text}</span><span class="act-time">${O.timeAgo(a.ts)}</span></div></div>`).join('') || '<p style="font-size:12px;color:var(--text-3);">Sin actividad registrada.</p>'}
    </div>
  `;

  document.getElementById('dd-responsable').addEventListener('change', e=> O.changeTaskResponsable(t.id, e.target.value));
  document.getElementById('dd-estado').addEventListener('change', e=> O.changeTaskStatus(t.id, e.target.value));
  document.getElementById('dd-fecha').addEventListener('change', e=> O.moveTaskDate(t.id, e.target.value));
  document.getElementById('dd-edit').addEventListener('click', ()=>{ closeTaskDrawer(); O.openTaskModal(t.id); });
  document.getElementById('dd-duplicate').addEventListener('click', ()=> O.duplicateTask(t.id));
  document.getElementById('dd-delete').addEventListener('click', ()=> O.deleteTask(t.id));
  document.getElementById('dd-comment-send').addEventListener('click', ()=>{
    const input = document.getElementById('dd-comment-input');
    if(input.value.trim()){ O.addComment(t.id, input.value.trim()); input.value=''; openTaskDrawer(t.id); }
  });
  document.getElementById('dd-comment-input').addEventListener('keydown', e=>{
    if(e.key==='Enter'){ document.getElementById('dd-comment-send').click(); }
  });

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
   DAY DETAIL DRAWER (panel lateral del día)
   ============================================================ */
(function(){
const O = window.ORONTES;
const { STATE } = O;
let currentDay = null;

function tasksForDate(dateStr){
  return STATE.tasks.filter(t=>{
    const start = t.fechaInicio, end = t.fechaTermino || t.fechaInicio;
    return dateStr >= start && dateStr <= end;
  });
}
O.tasksForDate = tasksForDate;

function openDayDrawer(dateStr){
  currentDay = dateStr;
  document.getElementById('dayDrawerTitle').textContent = O.fmtDateHuman(dateStr);
  const tasks = tasksForDate(dateStr);
  const body = document.getElementById('dayDrawerBody');
  if(!tasks.length){
    body.innerHTML = `<div class="empty-state"><span class="brand-mark">${O.brandMarkSVG(48,'#B5B0A0')}</span><p>No hay tareas programadas para este día.</p></div>`;
  } else {
    body.innerHTML = tasks.map(t=>{
      const urgency = O.getUrgencyState(t);
      return `<div class="day-drawer-item" style="border-left-color:${urgency.fg};" data-id="${t.id}">
        <h4>${O.escapeHtml(t.nombre)}</h4>
        <div class="ddi-meta">
          <span class="chip" style="background:${urgency.bg};color:${urgency.fg};padding:2px 8px;"><span class="dot" style="background:${urgency.fg};"></span>${urgency.label}</span>
          ${t.hora ? `<span><i class="fa-regular fa-clock"></i> ${t.hora}</span>` : ''}
          <span><i class="fa-regular fa-user"></i> ${O.escapeHtml(O.getPersonName(t.responsable))}</span>
        </div>
      </div>`;
    }).join('');
    body.querySelectorAll('.day-drawer-item').forEach(el=>{
      el.addEventListener('click', ()=> O.openTaskDrawer(el.dataset.id));
    });
  }
  document.getElementById('dayDrawer').classList.add('show');
  document.getElementById('overlay').classList.add('show');
}
function closeDayDrawer(){
  document.getElementById('dayDrawer').classList.remove('show');
  if(!document.getElementById('taskDrawer').classList.contains('show')) document.getElementById('overlay').classList.remove('show');
}
document.getElementById('dayDrawerClose').addEventListener('click', closeDayDrawer);
document.getElementById('dayDrawerAddBtn').addEventListener('click', ()=>{
  closeDayDrawer();
  O.openTaskModal(null, currentDay);
});
document.getElementById('overlay').addEventListener('click', ()=>{ closeDayDrawer(); O.closeTaskDrawer(); });
O.openDayDrawer = openDayDrawer;
O.closeDayDrawer = closeDayDrawer;
})();

/* ============================================================
   NOTIFICACIONES
   ============================================================ */
(function(){
const O = window.ORONTES;
const { STATE, saveJSON, STORAGE_KEYS } = O;

function computeNotifications(){
  const notifs = [];
  STATE.tasks.forEach(t=>{
    if(t.estado==='completada' || t.estado==='cancelada') return;
    const u = O.getUrgencyState(t);
    if(u.key==='overdue') notifs.push({id:t.id+'_overdue', taskId:t.id, icon:'fa-triangle-exclamation', fg:u.fg, bg:u.bg, text:`<b>${O.escapeHtml(t.nombre)}</b> está atrasada`, ts: O.parseDate(t.fechaTermino||t.fechaInicio).getTime()});
    if(u.key==='today') notifs.push({id:t.id+'_today', taskId:t.id, icon:'fa-clock', fg:u.fg, bg:u.bg, text:`<b>${O.escapeHtml(t.nombre)}</b> vence hoy`, ts: Date.now()});
    if(u.key==='tomorrow') notifs.push({id:t.id+'_tomorrow', taskId:t.id, icon:'fa-hourglass-half', fg:u.fg, bg:u.bg, text:`<b>${O.escapeHtml(t.nombre)}</b> vence mañana`, ts: Date.now()});
    // Sin actualización hace muchos días
    const lastTouch = t.comentarios.length ? Math.max(...t.comentarios.map(c=>O.parseDate(c.fecha).getTime())) : O.parseDate(t.fechaInicio).getTime();
    const daysSince = Math.floor((Date.now()-lastTouch)/86400000);
    if(daysSince >= 7) notifs.push({id:t.id+'_stale', taskId:t.id, icon:'fa-clock-rotate-left', fg:'#8B7FA6', bg:'var(--state-waiting-bg)', text:`<b>${O.escapeHtml(t.nombre)}</b> lleva ${daysSince} días sin actualizarse`, ts: lastTouch});
  });
  STATE.tasks.filter(t=>t.estado==='completada').slice(-5).forEach(t=>{
    notifs.push({id:t.id+'_done', taskId:t.id, icon:'fa-circle-check', fg:'#6F8F72', bg:'var(--state-done-bg)', text:`<b>${O.escapeHtml(t.nombre)}</b> fue completada`, ts: Date.now()-1});
  });
  return notifs.sort((a,b)=>b.ts-a.ts);
}

function renderNotifications(){
  const notifs = computeNotifications();
  const unread = notifs.filter(n=>!STATE.notifRead.includes(n.id));
  const badge = document.getElementById('notifBadge');
  if(unread.length){ badge.style.display='flex'; badge.textContent = unread.length>9?'9+':unread.length; }
  else { badge.style.display='none'; }

  const list = document.getElementById('notifList');
  if(!notifs.length){
    list.innerHTML = `<div class="notif-empty"><i class="fa-regular fa-bell-slash" style="font-size:20px;display:block;margin-bottom:8px;"></i>Sin notificaciones por ahora.</div>`;
    return;
  }
  list.innerHTML = notifs.map(n=>`
    <div class="notif-item" data-task="${n.taskId}" data-id="${n.id}">
      <span class="ni-icon" style="background:${n.bg};color:${n.fg};"><i class="fa-solid ${n.icon}"></i></span>
      <div class="ni-text"><div>${n.text}</div><div class="ni-time">${STATE.notifRead.includes(n.id)?'Leída':'Nueva'}</div></div>
    </div>`).join('');
  list.querySelectorAll('.notif-item').forEach(el=>{
    el.addEventListener('click', ()=>{
      const id = el.dataset.id;
      if(!STATE.notifRead.includes(id)){ STATE.notifRead.push(id); saveJSON(STORAGE_KEYS.notifRead, STATE.notifRead); }
      document.getElementById('notifDropdown').classList.remove('show');
      O.openTaskDrawer(el.dataset.task);
      renderNotifications();
    });
  });
}
O.renderNotifications = renderNotifications;

document.getElementById('notifBtn').addEventListener('click', (e)=>{
  e.stopPropagation();
  document.getElementById('notifDropdown').classList.toggle('show');
});
document.getElementById('clearNotifRead').addEventListener('click', ()=>{
  const ids = computeNotifications().map(n=>n.id);
  STATE.notifRead = [...new Set([...STATE.notifRead, ...ids])];
  saveJSON(STORAGE_KEYS.notifRead, STATE.notifRead);
  renderNotifications();
  O.toast('Notificaciones marcadas como leídas', 'success', 'fa-check-double');
});
document.addEventListener('click', (e)=>{
  const dd = document.getElementById('notifDropdown');
  if(dd.classList.contains('show') && !dd.contains(e.target) && e.target.id!=='notifBtn') dd.classList.remove('show');
});

/* Revisar notificaciones cada minuto para mantenerlas al día */
setInterval(renderNotifications, 60000);
})();

/* ============================================================
   7. RENDER: CALENDARIO (mes / semana / día) + Drag & Drop
   ============================================================ */
(function(){
const O = window.ORONTES;
const { STATE } = O;
const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
const DIAS_SEMANA = ['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'];

function fmtISO(d){ return d.toISOString().slice(0,10); }

function applyFilters(list){
  const f = STATE.filters;
  const s = STATE.search.toLowerCase().trim();
  return list.filter(t=>{
    if(f.responsable && t.responsable!==f.responsable) return false;
    if(f.estado && t.estado!==f.estado) return false;
    if(f.prioridad && t.prioridad!==f.prioridad) return false;
    if(f.categoria && t.categoria!==f.categoria) return false;
    if(f.etiqueta && !(t.etiquetas||[]).includes(f.etiqueta)) return false;
    if(s){
      const hay = [t.nombre, O.getPersonName(t.responsable), t.estado, t.categoria, ...(t.etiquetas||[]), ...(t.comentarios||[]).map(c=>c.texto)]
        .join(' ').toLowerCase();
      if(!hay.includes(s)) return false;
    }
    return true;
  });
}
O.applyFilters = applyFilters;

function buildFilterBar(containerId){
  const container = document.getElementById(containerId);
  const categorias = [...new Set(STATE.tasks.map(t=>t.categoria).filter(Boolean))];
  const etiquetas = [...new Set(STATE.tasks.flatMap(t=>t.etiquetas||[]))];
  container.innerHTML = `
    <select id="${containerId}-responsable"><option value="">Todos los responsables</option>${STATE.people.map(p=>`<option value="${p.id}">${O.escapeHtml(p.nombre)}</option>`).join('')}</select>
    <select id="${containerId}-estado"><option value="">Todos los estados</option>${Object.entries(O.ESTADOS).map(([k,v])=>`<option value="${k}">${v.label}</option>`).join('')}</select>
    <select id="${containerId}-prioridad"><option value="">Toda prioridad</option>${Object.entries(O.PRIORIDADES).map(([k,v])=>`<option value="${k}">${v.label}</option>`).join('')}</select>
    <select id="${containerId}-categoria"><option value="">Toda categoría</option>${categorias.map(c=>`<option value="${c}">${O.escapeHtml(c)}</option>`).join('')}</select>
    <select id="${containerId}-etiqueta"><option value="">Toda etiqueta</option>${etiquetas.map(e=>`<option value="${e}">#${O.escapeHtml(e)}</option>`).join('')}</select>
    <span class="filter-clear" id="${containerId}-clear">Limpiar filtros</span>
  `;
  ['responsable','estado','prioridad','categoria','etiqueta'].forEach(key=>{
    const el = document.getElementById(`${containerId}-${key}`);
    el.value = STATE.filters[key];
    el.addEventListener('change', ()=>{ STATE.filters[key]=el.value; O.refreshCurrentView(); });
  });
  document.getElementById(`${containerId}-clear`).addEventListener('click', ()=>{
    STATE.filters = {responsable:'',estado:'',prioridad:'',categoria:'',etiqueta:''};
    O.refreshCurrentView();
  });
}

function dayPillHtml(t){
  const urgency = O.getUrgencyState(t);
  const pcolor = O.getPersonColor(t.responsable);
  return `<div class="day-pill" draggable="true" data-id="${t.id}" style="background:${urgency.bg};color:${urgency.fg};border-left-color:${pcolor};" title="${O.escapeHtml(t.nombre)}">
    <span class="dot" style="background:${pcolor};"></span>${O.escapeHtml(t.nombre)}
  </div>`;
}

function attachPillEvents(root){
  root.querySelectorAll('.day-pill').forEach(pill=>{
    pill.addEventListener('click', (e)=>{ e.stopPropagation(); O.openTaskDrawer(pill.dataset.id); });
    pill.addEventListener('dragstart', (e)=>{
      e.dataTransfer.setData('text/plain', pill.dataset.id);
      pill.classList.add('dragging');
    });
    pill.addEventListener('dragend', ()=> pill.classList.remove('dragging'));
  });
}

/* ---------- Vista MES ---------- */
function renderMonth(){
  const d = STATE.calDate;
  const year = d.getFullYear(), month = d.getMonth();
  document.getElementById('calPeriodLabel').textContent = `${MESES[month]} ${year}`;
  document.getElementById('calSubtitle').textContent = 'Vista mensual de tareas';

  const firstOfMonth = new Date(year, month, 1);
  let startDay = firstOfMonth.getDay(); // 0=domingo
  startDay = (startDay === 0) ? 6 : startDay - 1; // lunes-first
  const gridStart = new Date(year, month, 1 - startDay);

  const tasks = applyFilters(STATE.tasks);
  const todayISO = O.todayStr();

  let html = `<div class="calendar-grid"><div class="cal-weekdays">${DIAS_SEMANA.map(x=>`<div>${x}</div>`).join('')}</div><div class="cal-days">`;
  for(let i=0;i<42;i++){
    const cellDate = new Date(gridStart); cellDate.setDate(gridStart.getDate()+i);
    const iso = fmtISO(cellDate);
    const otherMonth = cellDate.getMonth() !== month;
    const dayTasks = tasks.filter(t=> iso >= t.fechaInicio && iso <= (t.fechaTermino||t.fechaInicio));
    const shown = dayTasks.slice(0,3);
    const extra = dayTasks.length - shown.length;
    html += `<div class="cal-day ${otherMonth?'other-month':''} ${iso===todayISO?'is-today':''}" data-date="${iso}">
      <span class="day-num">${cellDate.getDate()}</span>
      <div class="day-tasks">${shown.map(dayPillHtml).join('')}</div>
      ${extra>0 ? `<span class="day-more">+${extra} más</span>` : ''}
    </div>`;
  }
  html += `</div></div>`;
  document.getElementById('calContainer').innerHTML = html;

  document.querySelectorAll('.cal-day').forEach(cell=>{
    cell.addEventListener('click', ()=> O.openDayDrawer(cell.dataset.date));
    cell.addEventListener('dragover', e=>{ e.preventDefault(); cell.classList.add('drag-over'); });
    cell.addEventListener('dragleave', ()=> cell.classList.remove('drag-over'));
    cell.addEventListener('drop', e=>{
      e.preventDefault(); cell.classList.remove('drag-over');
      const taskId = e.dataTransfer.getData('text/plain');
      if(taskId) O.moveTaskDate(taskId, cell.dataset.date);
    });
  });
  attachPillEvents(document.getElementById('calContainer'));
}

/* ---------- Vista SEMANA ---------- */
function getWeekStart(date){
  const d = new Date(date);
  let day = d.getDay(); day = (day===0)?6:day-1;
  d.setDate(d.getDate()-day);
  return d;
}
function renderWeek(){
  const start = getWeekStart(STATE.calDate);
  const days = Array.from({length:7}, (_,i)=>{ const dd=new Date(start); dd.setDate(start.getDate()+i); return dd; });
  document.getElementById('calPeriodLabel').textContent = `${days[0].getDate()} - ${days[6].getDate()} ${MESES[days[6].getMonth()]} ${days[6].getFullYear()}`;
  document.getElementById('calSubtitle').textContent = 'Vista semanal de tareas';
  const tasks = applyFilters(STATE.tasks);
  const todayISO = O.todayStr();

  let html = `<div class="week-grid"><div style="border-bottom:1px solid var(--border);background:var(--surface-2);"></div>`;
  days.forEach(dd=>{
    const iso = fmtISO(dd);
    html += `<div class="week-head-cell ${iso===todayISO?'is-today':''}" data-date="${iso}"><div class="wd">${DIAS_SEMANA[(dd.getDay()+6)%7]}</div><div class="wn">${dd.getDate()}</div></div>`;
  });
  html += `<div class="week-hour-label">Tareas</div>`;
  days.forEach(dd=>{
    const iso = fmtISO(dd);
    const dayTasks = tasks.filter(t=> iso >= t.fechaInicio && iso <= (t.fechaTermino||t.fechaInicio));
    html += `<div class="week-cell" data-date="${iso}">${dayTasks.map(dayPillHtml).join('')}</div>`;
  });
  html += `</div>`;
  document.getElementById('calContainer').innerHTML = html;

  document.querySelectorAll('.week-head-cell, .week-cell').forEach(cell=>{
    cell.addEventListener('click', (e)=>{ if(e.target.closest('.day-pill')) return; O.openDayDrawer(cell.dataset.date); });
    cell.addEventListener('dragover', e=> e.preventDefault());
    cell.addEventListener('drop', e=>{
      e.preventDefault();
      const taskId = e.dataTransfer.getData('text/plain');
      if(taskId) O.moveTaskDate(taskId, cell.dataset.date);
    });
  });
  attachPillEvents(document.getElementById('calContainer'));
}

/* ---------- Vista DÍA ---------- */
function renderDay(){
  const iso = fmtISO(STATE.calDate);
  document.getElementById('calPeriodLabel').textContent = O.fmtDateHuman(iso);
  document.getElementById('calSubtitle').textContent = 'Vista diaria de tareas';
  const tasks = applyFilters(O.tasksForDate(iso)).sort((a,b)=> (a.hora||'99:99').localeCompare(b.hora||'99:99'));

  let html = `<div class="calendar-grid" style="padding:18px;">`;
  if(!tasks.length){
    html += `<div class="empty-state"><span class="brand-mark">${O.brandMarkSVG(52,'#C9C5B6')}</span><p>No hay tareas para este día. Crea una nueva con el botón "+ Nueva tarea".</p></div>`;
  } else {
    tasks.forEach(t=>{
      const urgency = O.getUrgencyState(t);
      const pcolor = O.getPersonColor(t.responsable);
      html += `<div class="day-drawer-item" style="border-left-color:${pcolor};margin-bottom:10px;" data-id="${t.id}">
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <h4 style="font-size:14px;">${t.hora? `<span style="color:var(--text-3);font-weight:500;">${t.hora}</span> · `:''}${O.escapeHtml(t.nombre)}</h4>
          <span class="chip" style="background:${urgency.bg};color:${urgency.fg};"><span class="dot" style="background:${urgency.fg};"></span>${urgency.label}</span>
        </div>
        <div class="ddi-meta" style="margin-top:6px;"><span><i class="fa-regular fa-user"></i> ${O.escapeHtml(O.getPersonName(t.responsable))}</span></div>
      </div>`;
    });
  }
  html += `</div>`;
  document.getElementById('calContainer').innerHTML = html;
  document.querySelectorAll('#calContainer .day-drawer-item').forEach(el=> el.addEventListener('click', ()=> O.openTaskDrawer(el.dataset.id)));
}

function renderCalendar(){
  buildFilterBar('calFilters');
  if(STATE.calMode==='month') renderMonth();
  else if(STATE.calMode==='week') renderWeek();
  else renderDay();
}
O.renderCalendar = renderCalendar;

/* --- Toolbar events --- */
document.getElementById('calModeSwitch').addEventListener('click', (e)=>{
  const btn = e.target.closest('button'); if(!btn) return;
  STATE.calMode = btn.dataset.mode;
  document.querySelectorAll('#calModeSwitch button').forEach(b=>b.classList.toggle('active', b===btn));
  renderCalendar();
});
document.getElementById('calPrev').addEventListener('click', ()=>{
  const d = STATE.calDate;
  if(STATE.calMode==='month') d.setMonth(d.getMonth()-1);
  else if(STATE.calMode==='week') d.setDate(d.getDate()-7);
  else d.setDate(d.getDate()-1);
  renderCalendar();
});
document.getElementById('calNext').addEventListener('click', ()=>{
  const d = STATE.calDate;
  if(STATE.calMode==='month') d.setMonth(d.getMonth()+1);
  else if(STATE.calMode==='week') d.setDate(d.getDate()+7);
  else d.setDate(d.getDate()+1);
  renderCalendar();
});
document.getElementById('calTodayBtn').addEventListener('click', ()=>{ STATE.calDate = new Date(); renderCalendar(); });
})();

/* ============================================================
   8. RENDER: KANBAN
   ============================================================ */
(function(){
const O = window.ORONTES;
const { STATE } = O;
const COLUMNS = [
  {key:'pendiente', label:'Pendiente', icon:'fa-circle-dot'},
  {key:'progreso', label:'En proceso', icon:'fa-spinner'},
  {key:'espera', label:'Esperando', icon:'fa-hourglass-half'},
  {key:'completada', label:'Completada', icon:'fa-circle-check'}
];

function kanbanCardHtml(t){
  const urgency = O.getUrgencyState(t);
  const p = O.getPerson(t.responsable);
  return `<div class="kanban-card" draggable="true" data-id="${t.id}" style="border-left-color:${t.color||'var(--brand-accent)'};">
    <div class="kc-title-row">
      <h4>${O.escapeHtml(t.nombre)}</h4>
      <span class="chip" style="background:${O.PRIORIDADES[t.prioridad].color}22;color:${O.PRIORIDADES[t.prioridad].color};padding:2px 7px;">${O.PRIORIDADES[t.prioridad].label}</span>
    </div>
    <div class="kc-desc">${O.escapeHtml(t.descripcion||'Sin descripción')}</div>
    <div class="kc-meta">
      <span class="chip" style="background:${urgency.bg};color:${urgency.fg};padding:2px 8px;"><span class="dot" style="background:${urgency.fg};"></span>${urgency.label}</span>
      ${p ? `<span class="avatar" style="background:${p.color};width:22px;height:22px;font-size:9px;" title="${O.escapeHtml(p.nombre)}">${O.initials(p.nombre)}</span>` : ''}
    </div>
  </div>`;
}

function renderKanban(){
  O.buildFilterBar('kanbanFilters');
  const tasks = O.applyFilters(STATE.tasks.filter(t=>t.estado!=='cancelada'));
  const board = document.getElementById('kanbanBoard');
  board.innerHTML = COLUMNS.map(col=>{
    const colTasks = tasks.filter(t=>t.estado===col.key);
    return `<div class="kanban-col" data-status="${col.key}">
      <div class="kanban-col-head">
        <span class="kc-title"><i class="fa-solid ${col.icon}"></i> ${col.label}</span>
        <span class="kc-count">${colTasks.length}</span>
      </div>
      <div class="kanban-cards">${colTasks.map(kanbanCardHtml).join('') || `<div class="empty-state" style="padding:24px 10px;"><p>Sin tareas aquí</p></div>`}</div>
    </div>`;
  }).join('');

  board.querySelectorAll('.kanban-card').forEach(card=>{
    card.addEventListener('click', ()=> O.openTaskDrawer(card.dataset.id));
    card.addEventListener('dragstart', e=>{ e.dataTransfer.setData('text/plain', card.dataset.id); card.classList.add('dragging'); });
    card.addEventListener('dragend', ()=> card.classList.remove('dragging'));
  });
  board.querySelectorAll('.kanban-col').forEach(col=>{
    col.addEventListener('dragover', e=>{ e.preventDefault(); col.classList.add('drag-over'); });
    col.addEventListener('dragleave', ()=> col.classList.remove('drag-over'));
    col.addEventListener('drop', e=>{
      e.preventDefault(); col.classList.remove('drag-over');
      const taskId = e.dataTransfer.getData('text/plain');
      if(taskId) O.changeTaskStatus(taskId, col.dataset.status);
    });
  });
}
O.renderKanban = renderKanban;
})();

/* ============================================================
   9. RENDER: LISTA
   ============================================================ */
(function(){
const O = window.ORONTES;
const { STATE } = O;

function renderList(){
  O.buildFilterBar('listFilters');
  const tasks = O.applyFilters(STATE.tasks).sort((a,b)=> a.fechaInicio.localeCompare(b.fechaInicio));
  document.getElementById('listSubtitle').textContent = `${tasks.length} tarea(s)`;
  const tbody = document.getElementById('listTableBody');
  if(!tasks.length){
    tbody.innerHTML = `<tr><td colspan="6"><div class="empty-state"><span class="brand-mark">${O.brandMarkSVG(44,'#C9C5B6')}</span><p>No se encontraron tareas con los filtros aplicados.</p></div></td></tr>`;
    return;
  }
  tbody.innerHTML = tasks.map(t=>{
    const urgency = O.getUrgencyState(t);
    const p = O.getPerson(t.responsable);
    return `<tr data-id="${t.id}">
      <td><b>${O.escapeHtml(t.nombre)}</b><div style="font-size:11px;color:var(--text-3);margin-top:2px;">${O.escapeHtml(t.categoria||'')}</div></td>
      <td>${p ? `<div class="person-cell"><span class="avatar" style="background:${p.color};width:24px;height:24px;font-size:9.5px;">${O.initials(p.nombre)}</span>${O.escapeHtml(p.nombre)}</div>` : '<span style="color:var(--text-3);">Sin asignar</span>'}</td>
      <td>${O.fmtDateHuman(t.fechaInicio)}${t.hora?` · ${t.hora}`:''}</td>
      <td><span class="chip" style="background:${O.PRIORIDADES[t.prioridad].color}22;color:${O.PRIORIDADES[t.prioridad].color};"><span class="dot" style="background:${O.PRIORIDADES[t.prioridad].color};"></span>${O.PRIORIDADES[t.prioridad].label}</span></td>
      <td><span class="chip" style="background:${urgency.bg};color:${urgency.fg};"><span class="dot" style="background:${urgency.fg};"></span>${urgency.label}</span></td>
      <td>${(t.etiquetas||[]).map(tag=>`<span class="tag" style="margin-right:4px;">#${O.escapeHtml(tag)}</span>`).join('')}</td>
    </tr>`;
  }).join('');
  tbody.querySelectorAll('tr[data-id]').forEach(tr=> tr.addEventListener('click', ()=> O.openTaskDrawer(tr.dataset.id)));
}
O.renderList = renderList;
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
  const pendientes = tasks.filter(t=>t.estado==='pendiente').length;
  const progreso = tasks.filter(t=>t.estado==='progreso').length;
  const completadas = tasks.filter(t=>t.estado==='completada').length;
  const atrasadas = tasks.filter(t=> O.getUrgencyState(t).key==='overdue').length;
  const urgentes = tasks.filter(t=>t.prioridad==='urgente' && t.estado!=='completada').length;

  const cards = [
    {label:'Total de tareas', value: total, icon:'fa-list-check', fg:'#4A4F54', bg:'#E7E4DA'},
    {label:'Pendientes', value: pendientes, icon:'fa-circle-dot', fg:'#8B7FA6', bg:'var(--state-waiting-bg)'},
    {label:'En proceso', value: progreso, icon:'fa-spinner', fg:'#5D7C8A', bg:'var(--state-progress-bg)'},
    {label:'Completadas', value: completadas, icon:'fa-circle-check', fg:'#6F8F72', bg:'var(--state-done-bg)'},
    {label:'Atrasadas', value: atrasadas, icon:'fa-triangle-exclamation', fg:'#B5654F', bg:'var(--state-overdue-bg)'},
    {label:'Urgentes', value: urgentes, icon:'fa-bolt', fg:'#B5504A', bg:'var(--state-overdue-bg)'}
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

  // --- Por estado ---
  destroyChart('estado');
  const estadoLabels = Object.values(O.ESTADOS).map(e=>e.label);
  const estadoData = Object.keys(O.ESTADOS).map(k=> tasks.filter(t=>t.estado===k).length);
  const estadoColors = Object.values(O.ESTADOS).map(e=>e.fg);
  charts.estado = new Chart(document.getElementById('chartEstado'), {
    type:'doughnut',
    data:{ labels:estadoLabels, datasets:[{data:estadoData, backgroundColor:estadoColors, borderWidth:0}] },
    options:{ plugins:{legend:{position:'bottom', labels:{boxWidth:10,padding:12}}}, cutout:'62%' }
  });

  // --- Por prioridad ---
  destroyChart('prioridad');
  const prLabels = Object.values(O.PRIORIDADES).map(p=>p.label);
  const prData = Object.keys(O.PRIORIDADES).map(k=> tasks.filter(t=>t.prioridad===k).length);
  const prColors = Object.values(O.PRIORIDADES).map(p=>p.color);
  charts.prioridad = new Chart(document.getElementById('chartPrioridad'), {
    type:'bar',
    data:{ labels:prLabels, datasets:[{data:prData, backgroundColor:prColors, borderRadius:6, maxBarThickness:44}] },
    options:{ plugins:{legend:{display:false}}, scales:{ x:{grid:{display:false}}, y:{grid:{color:tc.grid}, beginAtZero:true, ticks:{precision:0}} } }
  });

  // --- Por responsable ---
  destroyChart('responsable');
  const respLabels = STATE.people.map(p=>p.nombre.split(' ')[0]);
  const respData = STATE.people.map(p=> tasks.filter(t=>t.responsable===p.id).length);
  const respColors = STATE.people.map(p=>p.color);
  charts.responsable = new Chart(document.getElementById('chartResponsable'), {
    type:'bar',
    data:{ labels:respLabels, datasets:[{data:respData, backgroundColor:respColors, borderRadius:6, maxBarThickness:36}] },
    options:{ indexAxis:'y', plugins:{legend:{display:false}}, scales:{ x:{grid:{color:tc.grid}, beginAtZero:true, ticks:{precision:0}}, y:{grid:{display:false}} } }
  });

  // --- Avance semanal (últimos 7 días: completadas por día) ---
  destroyChart('avanceSemanal');
  const days7 = Array.from({length:7},(_,i)=>{ const d=new Date(); d.setDate(d.getDate()-(6-i)); return d; });
  const wLabels = days7.map(d=> ['dom','lun','mar','mié','jue','vie','sáb'][d.getDay()]);
  const wData = days7.map(d=>{
    const iso = d.toISOString().slice(0,10);
    return tasks.filter(t=> t.estado==='completada' && (t.fechaTermino||t.fechaInicio)===iso).length;
  });
  charts.avanceSemanal = new Chart(document.getElementById('chartAvanceSemanal'), {
    type:'line',
    data:{ labels:wLabels, datasets:[{data:wData, borderColor:'#5D7C8A', backgroundColor:'rgba(93,124,138,0.15)', fill:true, tension:.35, pointRadius:3}] },
    options:{ plugins:{legend:{display:false}}, scales:{ x:{grid:{display:false}}, y:{grid:{color:tc.grid}, beginAtZero:true, ticks:{precision:0}} } }
  });

  // --- Avance mensual (últimas 6 semanas) ---
  destroyChart('avanceMensual');
  const weeks6 = Array.from({length:6},(_,i)=>{ const d=new Date(); d.setDate(d.getDate()-(5-i)*7); return d; });
  const mLabels = weeks6.map(d=> `S${Math.ceil(d.getDate()/7)} ${['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'][d.getMonth()]}`);
  const mData = weeks6.map((d,i)=>{
    const start = new Date(d); start.setDate(start.getDate()-6);
    return tasks.filter(t=>{
      const dt = O.parseDate(t.fechaTermino||t.fechaInicio);
      return t.estado==='completada' && dt>=start && dt<=d;
    }).length;
  });
  charts.avanceMensual = new Chart(document.getElementById('chartAvanceMensual'), {
    type:'bar',
    data:{ labels:mLabels, datasets:[{data:mData, backgroundColor:'#C9C5B6', borderRadius:6, maxBarThickness:36}] },
    options:{ plugins:{legend:{display:false}}, scales:{ x:{grid:{display:false}}, y:{grid:{color:tc.grid}, beginAtZero:true, ticks:{precision:0}} } }
  });

  // --- Productividad por persona (% completadas de sus tareas) ---
  destroyChart('productividad');
  const prodLabels = STATE.people.map(p=>p.nombre.split(' ')[0]);
  const prodData = STATE.people.map(p=>{
    const own = tasks.filter(t=>t.responsable===p.id);
    if(!own.length) return 0;
    return Math.round(100*own.filter(t=>t.estado==='completada').length/own.length);
  });
  charts.productividad = new Chart(document.getElementById('chartProductividad'), {
    type:'radar',
    data:{ labels:prodLabels, datasets:[{label:'% Completado', data:prodData, backgroundColor:'rgba(74,79,84,0.18)', borderColor:'#4A4F54', pointBackgroundColor:'#4A4F54'}] },
    options:{ plugins:{legend:{display:false}}, scales:{ r:{ grid:{color:tc.grid}, angleLines:{color:tc.grid}, suggestedMin:0, suggestedMax:100, ticks:{showLabelBackdrop:false, stepSize:25} } } }
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
  debounceTimer = setTimeout(()=>{
    O.STATE.search = e.target.value;
    O.refreshCurrentView();
  }, 220);
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
  const headers = ['Nombre','Descripcion','Responsable','FechaInicio','FechaTermino','Hora','Prioridad','Estado','Categoria','Etiquetas'];
  const rows = STATE.tasks.map(t=> [
    t.nombre, t.descripcion, O.getPersonName(t.responsable), t.fechaInicio, t.fechaTermino||'', t.hora||'',
    O.PRIORIDADES[t.prioridad].label, O.ESTADOS[t.estado].label, t.categoria||'', (t.etiquetas||[]).join('|')
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
    <html><head><title>Orontes . Tareas</title>
    <style>
      body{font-family:Arial, sans-serif; padding:30px; color:#2E3134;}
      h1{font-family:Arial; letter-spacing:2px; color:#4A4F54; font-size:20px;}
      table{width:100%; border-collapse:collapse; margin-top:16px;}
      th,td{border:1px solid #ddd; padding:8px 10px; font-size:12px; text-align:left;}
      th{background:#EFEDE6;}
    </style></head><body>
    <h1>ORONTES - Listado de tareas</h1>
    <p style="color:#8B8F92;font-size:12px;">Generado el ${new Date().toLocaleString('es-CL')}</p>
    <table><thead><tr><th>Tarea</th><th>Responsable</th><th>Fecha</th><th>Prioridad</th><th>Estado</th></tr></thead><tbody>
    ${tasks.map(t=>`<tr><td>${O.escapeHtml(t.nombre)}</td><td>${O.escapeHtml(O.getPersonName(t.responsable))}</td><td>${t.fechaInicio}</td><td>${O.PRIORIDADES[t.prioridad].label}</td><td>${O.ESTADOS[t.estado].label}</td></tr>`).join('')}
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
        if(data.tasks){
          data.tasks.forEach(t=> STATE.tasks.push({...t, id: O.uid('t')}));
          O.persistTasks();
        }
        if(data.people){
          data.people.forEach(p=> STATE.people.push({...p, id:O.uid('p')}));
          O.persistPeople();
        }
      } else {
        const lines = ev.target.result.split(/\r?\n/).filter(Boolean);
        const headers = lines[0].split(',').map(h=>h.replace(/"/g,'').trim().toLowerCase());
        lines.slice(1).forEach(line=>{
          const cols = line.match(/(".*?"|[^,]+)(?=,|$)/g).map(c=>c.replace(/^"|"$/g,'').replace(/""/g,'"'));
          const get = (name)=>{ const i = headers.indexOf(name); return i>=0 ? cols[i] : ''; };
          STATE.tasks.push({
            id:O.uid('t'), nombre:get('nombre')||'Tarea importada', descripcion:get('descripcion')||'',
            responsable:'', fechaInicio:get('fechainicio')||O.todayStr(), fechaTermino:get('fechatermino')||get('fechainicio')||O.todayStr(),
            hora:get('hora')||'', prioridad:'media', estado:'pendiente', categoria:get('categoria')||'',
            etiquetas:(get('etiquetas')||'').split('|').filter(Boolean), color:O.PALETTE[0], comentarios:[], adjuntos:[]
          });
        });
        O.persistTasks();
      }
      O.toast('Importacion completada', 'success', 'fa-file-import');
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
   13. NAVEGACION / INICIALIZACION
   ============================================================ */
(function(){
const O = window.ORONTES;

function refreshCurrentView(){
  const activeView = document.querySelector('.view.active').id.replace('view-','');
  O.switchView(activeView);
}
O.refreshCurrentView = refreshCurrentView;

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

document.getElementById('resetDataBtn').addEventListener('click', ()=>{
  if(confirm('Esto borrará todas las tareas y encargados guardados en este navegador, y volverá a los datos de ejemplo. ¿Continuar?')){
    resetOrontesData();
  }
});

/* Menu movil */
document.getElementById('mobileMenuBtn').addEventListener('click', ()=>{
  document.getElementById('sidebar').classList.toggle('mobile-open');
});
if(window.innerWidth <= 900){ document.getElementById('mobileMenuBtn').style.display='flex'; }

O.renderCalendar();
O.renderNotifications();
O.toast('Bienvenido/a al panel de Orontes', 'info', 'fa-tooth');

})();
