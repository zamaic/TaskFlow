/* ==============================
   TASKFLOW — functions.js
   ============================== */

'use strict';

/* ==============================
   SESIÓN — Protección de ruta
   ============================== */
const STORAGE_SESION = 'tf_sesion';

(function guardSession() {
  const sesion = localStorage.getItem(STORAGE_SESION);
  if (!sesion) {
    window.location.href = 'login.html';
  }
})();

/* Datos del usuario activo */
function getSesion() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_SESION)) || null;
  } catch {
    return null;
  }
}

function cerrarSesion() {
  if (!confirm('¿Seguro que deseas cerrar sesión?')) return;
  localStorage.removeItem(STORAGE_SESION);
  window.location.href = 'login.html';
}

/* ---- STATE ---- */
const STATE = {
  tasks: [],
  projects: [],
  notifications: [],
  currentProjectFilter: null,  // null = all
  draggedTaskId: null,
};

/* ---- STORAGE ---- */
const STORAGE_KEYS = {
  TASKS: 'tf_tasks',
  PROJECTS: 'tf_projects',
  NOTIFICATIONS: 'tf_notifications',
};

function saveState() {
  localStorage.setItem(STORAGE_KEYS.TASKS, JSON.stringify(STATE.tasks));
  localStorage.setItem(STORAGE_KEYS.PROJECTS, JSON.stringify(STATE.projects));
  localStorage.setItem(STORAGE_KEYS.NOTIFICATIONS, JSON.stringify(STATE.notifications));
}

function loadState() {
  try {
    STATE.tasks         = JSON.parse(localStorage.getItem(STORAGE_KEYS.TASKS))         || [];
    STATE.projects      = JSON.parse(localStorage.getItem(STORAGE_KEYS.PROJECTS))      || [];
    STATE.notifications = JSON.parse(localStorage.getItem(STORAGE_KEYS.NOTIFICATIONS)) || [];
  } catch {
    STATE.tasks = []; STATE.projects = []; STATE.notifications = [];
  }
}

/* ---- ID GENERATOR ---- */
function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

/* ---- DOM HELPERS ---- */
const $ = (sel, ctx = document) => ctx.querySelector(sel);
const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));

/* ---- PRIORITY FLAG COLOR ---- */
const PRIORITY_COLORS = {
  alta:  '#F58EA5',
  media: '#FFE285',
  baja:  '#B9DFA4',
};

const STATUS_LABELS = {
  'pendiente': 'Pendiente',
  'en-curso':  'En Curso',
  'listo':     'Listo',
};

const STATUS_DOT_CLASS = {
  'pendiente': 'dot-pending',
  'en-curso':  'dot-inprogress',
  'listo':     'dot-done',
};

/* ==============================
   PROJECT DROPDOWN (TOPBAR)
   ============================== */
function refreshProjectDropdown() {
  const dropdown = $('#projectDropdown');
  $$('.project-dropdown-item', dropdown).forEach(el => el.remove());

  STATE.projects.forEach(p => {
    const item = document.createElement('div');
    item.className = 'project-dropdown-item';
    item.dataset.id = p.id;
    item.innerHTML = `
      <span class="dropdown-dot" style="background:${p.color}"></span>
      ${escapeHtml(p.nombre)}
    `;
    item.addEventListener('click', (e) => {
      e.stopPropagation();
      selectProjectFilter(p.id, p.nombre);
    });
    dropdown.appendChild(item);
  });

  syncDropdownActive();
}

function syncDropdownActive() {
  const dropdown = $('#projectDropdown');
  $$('.project-dropdown-item', dropdown).forEach(item => {
    item.classList.toggle('active', item.dataset.id === (STATE.currentProjectFilter || ''));
  });
}

function selectProjectFilter(id, name) {
  STATE.currentProjectFilter = id || null;
  $('#currentProjectName').textContent = name;
  $('#boardTitle').textContent = id ? name : 'Tablero';
  $('#projectSelector').classList.remove('open');
  switchView('board');
  renderBoard();
}

$('#projectSelector').addEventListener('click', function (e) {
  if (e.target.closest('.project-dropdown-item')) return;
  this.classList.toggle('open');
});

document.addEventListener('click', (e) => {
  if (!e.target.closest('#projectSelector')) {
    $('#projectSelector').classList.remove('open');
  }
});

/* ==============================
   RENDER — BOARD
   ============================== */
function renderBoard() {
  const board = $('#kanbanBoard');
  const project = STATE.currentProjectFilter
    ? STATE.projects.find(p => p.id === STATE.currentProjectFilter)
    : null;

  const useCustomCols = project && Array.isArray(project.columns) && project.columns.length > 0;

  if (useCustomCols) {
    board.innerHTML = '';
    project.columns.forEach(col => {
      const colEl = document.createElement('div');
      colEl.className = 'kanban-column';
      colEl.dataset.colId = col.id;
      colEl.innerHTML = `
        <div class="column-header">
          <div class="column-title-wrap">
            <span class="column-dot" style="background:${col.color}"></span>
            <h2 class="column-title">${escapeHtml(col.name)}</h2>
            <span class="column-count" id="count-col-${col.id}">0</span>
          </div>
        </div>
        <div class="column-body" id="tasks-col-${col.id}">
          <div class="empty-state" id="empty-col-${col.id}">
            <i class="fa-regular fa-file"></i>
            <p>Sin tareas</p>
          </div>
        </div>
      `;
      const body = colEl.querySelector('.column-body');
      body.addEventListener('dragover',  (e) => onDragOver(e));
      body.addEventListener('drop',      (e) => onDropCustom(e, col.id));
      body.addEventListener('dragleave', (e) => onDragLeave(e));
      board.appendChild(colEl);
    });

    project.columns.forEach(col => {
      const container = $(`#tasks-col-${col.id}`);
      const emptyEl   = $(`#empty-col-${col.id}`);
      const countEl   = $(`#count-col-${col.id}`);
      const tasks = STATE.tasks.filter(t => t.proyectoId === project.id && t.columnaId === col.id);
      $$('.task-card', container).forEach(el => el.remove());
      countEl.textContent = tasks.length;
      emptyEl.style.display = tasks.length === 0 ? 'flex' : 'none';
      tasks.forEach(task => container.appendChild(createTaskCard(task)));
    });

  } else {
    board.innerHTML = `
      <div class="kanban-column" data-status="pendiente" id="col-pendiente">
        <div class="column-header">
          <div class="column-title-wrap">
            <span class="column-dot dot-pending"></span>
            <h2 class="column-title">Pendiente</h2>
            <span class="column-count" id="count-pendiente">0</span>
          </div>
        </div>
        <div class="column-body" id="tasks-pendiente">
          <div class="empty-state" id="empty-pendiente">
            <i class="fa-regular fa-file"></i><p>Sin tareas pendientes</p>
          </div>
        </div>
      </div>
      <div class="kanban-column" data-status="en-curso" id="col-en-curso">
        <div class="column-header">
          <div class="column-title-wrap">
            <span class="column-dot dot-inprogress"></span>
            <h2 class="column-title">En Curso</h2>
            <span class="column-count" id="count-en-curso">0</span>
          </div>
        </div>
        <div class="column-body" id="tasks-en-curso">
          <div class="empty-state" id="empty-en-curso">
            <i class="fa-regular fa-file"></i><p>Sin tareas en curso</p>
          </div>
        </div>
      </div>
      <div class="kanban-column" data-status="listo" id="col-listo">
        <div class="column-header">
          <div class="column-title-wrap">
            <span class="column-dot dot-done"></span>
            <h2 class="column-title">Listo</h2>
            <span class="column-count" id="count-listo">0</span>
          </div>
        </div>
        <div class="column-body" id="tasks-listo">
          <div class="empty-state" id="empty-listo">
            <i class="fa-regular fa-file"></i><p>Sin tareas completadas</p>
          </div>
        </div>
      </div>
    `;

    [['tasks-pendiente','pendiente'],['tasks-en-curso','en-curso'],['tasks-listo','listo']].forEach(([id, status]) => {
      const el = $(`#${id}`);
      el.addEventListener('dragover',  (e) => onDragOver(e));
      el.addEventListener('drop',      (e) => onDrop(e, status));
      el.addEventListener('dragleave', (e) => onDragLeave(e));
    });

    ['pendiente', 'en-curso', 'listo'].forEach(status => {
      const container = $(`#tasks-${status}`);
      const emptyEl   = $(`#empty-${status}`);
      const countEl   = $(`#count-${status}`);
      let tasks = STATE.tasks.filter(t => t.estado === status);
      if (STATE.currentProjectFilter) {
        tasks = tasks.filter(t => t.proyectoId === STATE.currentProjectFilter);
      }
      $$('.task-card', container).forEach(el => el.remove());
      countEl.textContent = tasks.length;
      emptyEl.style.display = tasks.length === 0 ? 'flex' : 'none';
      tasks.forEach(task => container.appendChild(createTaskCard(task)));
    });
  }

  updateTaskCount();
}

function createTaskCard(task) {
  const card = document.createElement('div');
  card.className = 'task-card';
  card.dataset.id = task.id;
  card.draggable = true;

  const project = task.proyectoId ? STATE.projects.find(p => p.id === task.proyectoId) : null;
  const initials = task.asignadoA
    ? task.asignadoA.split(' ').slice(0, 2).map(n => n[0]?.toUpperCase() || '').join('')
    : '?';

  card.innerHTML = `
    <div class="task-card-top">
      <span class="task-card-title">${escapeHtml(task.titulo)}</span>
      <i class="fa-solid fa-flag task-flag" style="color:${PRIORITY_COLORS[task.prioridad] || '#FFE285'}" title="Prioridad ${task.prioridad}"></i>
    </div>
    ${task.descripcion ? `<p class="task-card-desc">${escapeHtml(task.descripcion)}</p>` : ''}
    <div class="task-card-footer">
      <div class="task-assignee">
        <div class="assignee-avatar">${initials}</div>
        <span>${escapeHtml(task.asignadoA || 'Sin asignar')}</span>
      </div>
      <div style="display:flex;align-items:center;gap:6px;">
        ${project ? `<span class="project-tag" style="background:${project.color}">${escapeHtml(project.nombre)}</span>` : ''}
        <span class="priority-badge priority-${task.prioridad}">${task.prioridad.charAt(0).toUpperCase() + task.prioridad.slice(1)}</span>
        <div class="task-card-actions">
          <button class="card-action-btn edit" title="Editar" onclick="openEditModal('${task.id}', event)">
            <i class="fa-solid fa-pen"></i>
          </button>
          <button class="card-action-btn delete" title="Eliminar" onclick="deleteTask('${task.id}', event)">
            <i class="fa-solid fa-circle-xmark"></i>
          </button>
        </div>
      </div>
    </div>
  `;

  card.addEventListener('dragstart', onDragStart);
  card.addEventListener('dragend', onDragEnd);
  card.addEventListener('click', () => openDetailModal(task.id));

  return card;
}

/* ==============================
   RENDER — PROJECTS VIEW
   ============================== */
function renderProjects() {
  const grid = $('#projectsGrid');
  const noMsg = $('#noProjectsMsg');
  $$('.project-card', grid).forEach(el => el.remove());

  if (STATE.projects.length === 0) {
    noMsg.style.display = 'flex';
    return;
  }
  noMsg.style.display = 'none';

  STATE.projects.forEach(project => {
    const taskCount = STATE.tasks.filter(t => t.proyectoId === project.id).length;
    //const doneCount = STATE.tasks.filter(t => t.proyectoId === project.id && t.estado === 'listo').length;

    const card = document.createElement('div');
    card.className = 'project-card';
    card.style.setProperty('--project-color', project.color);
    card.innerHTML = `
      <h3 class="project-card-name">${escapeHtml(project.nombre)}</h3>
      ${project.cliente ? `<p class="project-card-client">${escapeHtml(project.cliente)}</p>` : ''}
      <p class="project-card-desc">${escapeHtml(project.descripcion || 'Sin descripción')}</p>
      <div class="project-card-stats">
        <span class="project-stat"><i class="fa-solid fa-list-check"></i> ${taskCount} tareas</span>
      </div>
      <div class="project-card-footer">
        <button class="btn-secondary project-view-btn" style="padding:6px 12px;font-size:0.76rem;">Ver tablero</button>
        <button class="project-delete-btn" title="Eliminar proyecto">
          <i class="fa-solid fa-circle-xmark"></i>
        </button>
      </div>
    `;

    card.querySelector('.project-view-btn').addEventListener('click', (e) => filterByProject(project.id, project.nombre, e));
    card.querySelector('.project-delete-btn').addEventListener('click', (e) => deleteProject(project.id, e));
    grid.appendChild(card);
  });
}

/* ==============================
   RENDER — TASKS LIST VIEW
   ============================== */
function renderTasksList() {
  const list = $('#allTasksList');
  $$('.task-list-item', list).forEach(el => el.remove());
  $$('.no-tasks-msg', list).forEach(el => el.remove());

  if (STATE.tasks.length === 0) {
    list.innerHTML = `<div class="no-tasks-msg"><i class="fa-solid fa-list-check"></i><p>No hay tareas todavía.</p></div>`;
    return;
  }

  STATE.tasks.forEach(task => {
    const item = document.createElement('div');
    item.className = 'task-list-item';
    item.innerHTML = `
      <span class="task-list-status-dot ${STATUS_DOT_CLASS[task.estado]}"></span>
      <span class="task-list-title">${escapeHtml(task.titulo)}</span>
      <div class="task-list-meta">
        <i class="fa-solid fa-flag" style="color:${PRIORITY_COLORS[task.prioridad]};font-size:0.8rem;"></i>
        <span class="task-list-status-tag">${STATUS_LABELS[task.estado]}</span>
        <span style="font-size:0.78rem;color:#6B6880;font-weight:600;">${escapeHtml(task.asignadoA || '—')}</span>
      </div>
    `;
    item.addEventListener('click', () => openDetailModal(task.id));
    list.appendChild(item);
  });
}

/* ==============================
   RENDER — PROGRESS VIEW
   ============================== */
function renderProgress() {
  const container = $('#progressView');
  container.innerHTML = '';

  const total   = STATE.tasks.length;
  const pending = STATE.tasks.filter(t => t.estado === 'pendiente').length;
  const inProg  = STATE.tasks.filter(t => t.estado === 'en-curso').length;
  const done    = STATE.tasks.filter(t => t.estado === 'listo').length;
  const pct     = total > 0 ? Math.round((done / total) * 100) : 0;

  const stats = [
    { value: total,   label: 'Total Tareas',  color: '#CB6DEE' },
    { value: pending, label: 'Pendientes',     color: '#FFE285' },
    { value: inProg,  label: 'En Curso',       color: '#7AB7E3' },
    { value: done,    label: 'Completadas',    color: '#B9DFA4' },
    { value: STATE.projects.length, label: 'Proyectos', color: '#72DCC3' },
  ];

  stats.forEach(s => {
    const card = document.createElement('div');
    card.className = 'progress-stat-card';
    card.innerHTML = `
      <div class="progress-stat-value" style="color:${s.color}">${s.value}</div>
      <div class="progress-stat-label">${s.label}</div>
    `;
    container.appendChild(card);
  });

  const barWrap = document.createElement('div');
  barWrap.className = 'progress-bar-wrap';
  barWrap.innerHTML = `
    <div class="progress-bar-label">
      <span>Progreso general</span>
      <span>${pct}%</span>
    </div>
    <div class="progress-bar-track">
      <div class="progress-bar-fill" style="width:${pct}%"></div>
    </div>
  `;
  container.appendChild(barWrap);

  if (STATE.projects.length > 0) {
    STATE.projects.forEach(project => {
      const pTasks = STATE.tasks.filter(t => t.proyectoId === project.id);
      const pDone  = pTasks.filter(t => t.estado === 'listo').length;
      const pPct   = pTasks.length > 0 ? Math.round((pDone / pTasks.length) * 100) : 0;

      const pBar = document.createElement('div');
      pBar.className = 'progress-bar-wrap';
      pBar.innerHTML = `
        <div class="progress-bar-label">
          <span><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${project.color};margin-right:6px;"></span>${escapeHtml(project.nombre)}</span>
          <span>${pDone}/${pTasks.length} (${pPct}%)</span>
        </div>
        <div class="progress-bar-track">
          <div class="progress-bar-fill" style="width:${pPct}%;background:${project.color}"></div>
        </div>
      `;
      container.appendChild(pBar);
    });
  }
}

/* ==============================
   RENDER — NOTIFICATIONS
   ============================== */
function renderNotifications() {
  const list = $('#notificationsList');
  list.innerHTML = '';

  if (STATE.notifications.length === 0) {
    list.innerHTML = `<div class="no-notif-msg"><i class="fa-solid fa-bell-slash"></i><p>Sin notificaciones nuevas.</p></div>`;
    return;
  }

  [...STATE.notifications].reverse().forEach(n => {
    const item = document.createElement('div');
    item.className = 'notif-item';
    item.innerHTML = `
      <div class="notif-dot"></div>
      <span class="notif-text">${escapeHtml(n.text)}</span>
      <span class="notif-time">${formatTime(n.timestamp)}</span>
    `;
    list.appendChild(item);
  });

  const badge = $('#notifBadge');
  badge.textContent = STATE.notifications.length;
  badge.style.display = STATE.notifications.length > 0 ? 'inline' : 'none';
}

function addNotification(text) {
  STATE.notifications.push({ id: uid(), text, timestamp: Date.now() });
  if (STATE.notifications.length > 50) STATE.notifications.shift();
  saveState();

  const badge = $('#notifBadge');
  badge.textContent = STATE.notifications.length;
  badge.style.display = 'inline';
}

function formatTime(ts) {
  const d = new Date(ts);
  return d.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }) +
    ' ' + d.toLocaleDateString('es-MX', { day: '2-digit', month: 'short' });
}

/* ==============================
   TASK COUNT
   ============================== */
function updateTaskCount() {
  const tasks = STATE.currentProjectFilter
    ? STATE.tasks.filter(t => t.proyectoId === STATE.currentProjectFilter)
    : STATE.tasks;
  $('#taskCount').textContent = `${tasks.length} tarea${tasks.length !== 1 ? 's' : ''}`;
}

/* ==============================
   PROJECT SELECT IN MODAL
   ============================== */
function populateProjectSelect() {
  const sel = $('#taskProject');
  sel.innerHTML = '<option value="">Sin proyecto</option>';
  STATE.projects.forEach(p => {
    const opt = document.createElement('option');
    opt.value = p.id;
    opt.textContent = p.nombre;
    sel.appendChild(opt);
  });
}

function populateStatusSelect(proyectoId) {
  const sel = $('#taskStatus');
  sel.innerHTML = '';

  const project = proyectoId ? STATE.projects.find(p => p.id === proyectoId) : null;
  const useCustomCols = project && Array.isArray(project.columns) && project.columns.length > 0;

  if (useCustomCols) {
    project.columns.forEach(col => {
      const opt = document.createElement('option');
      opt.value = col.id;
      opt.textContent = col.name;
      sel.appendChild(opt);
    });
  } else {
    [['pendiente','Pendiente'],['en-curso','En Curso'],['listo','Listo']].forEach(([v, l]) => {
      const opt = document.createElement('option');
      opt.value = v;
      opt.textContent = l;
      sel.appendChild(opt);
    });
  }
}

function populateAssigneeSelect(proyectoId) {
  const input = $('#taskAssignee');
  // Remove any existing datalist
  const old = $('#assigneeDatalist');
  if (old) old.remove();

  const project = proyectoId ? STATE.projects.find(p => p.id === proyectoId) : null;
  const members = project?.miembros || [];

  if (members.length > 0) {
    const dl = document.createElement('datalist');
    dl.id = 'assigneeDatalist';
    members.forEach(m => {
      const opt = document.createElement('option');
      opt.value = m;
      dl.appendChild(opt);
    });
    document.body.appendChild(dl);
    input.setAttribute('list', 'assigneeDatalist');
  } else {
    input.removeAttribute('list');
  }
}

function deleteProject(projectId, e) {
  if (e) e.stopPropagation();
  const project = STATE.projects.find(p => p.id === projectId);
  if (!project) return;
  if (!confirm(`¿Eliminar el proyecto "${project.nombre}"? Las tareas asociadas quedarán sin proyecto.`)) return;

  STATE.projects = STATE.projects.filter(p => p.id !== projectId);
  STATE.tasks = STATE.tasks.map(t => t.proyectoId === projectId ? { ...t, proyectoId: null } : t);
  saveState();
  refreshProjectDropdown();

  if (STATE.currentProjectFilter === projectId) {
    if (STATE.projects.length > 0) {
      selectProjectFilter(STATE.projects[0].id, STATE.projects[0].nombre);
    } else {
      STATE.currentProjectFilter = null;
      $('#currentProjectName').textContent = 'Sin proyecto';
      $('#boardTitle').textContent = 'Tablero';
      renderAll();
    }
  } else {
    renderAll();
  }

  showToast(`Proyecto "${project.nombre}" eliminado.`, 'info');
  addNotification(`Proyecto eliminado: "${project.nombre}"`);
}

function filterByProject(projectId, projectName, e) {
  if (e) e.stopPropagation();
  selectProjectFilter(projectId, projectName);
}

/* ==============================
   MODAL — TASK
   ============================== */
function openTaskModal(editId = null) {
  const form    = $('#taskForm');
  const title   = $('#modalTitle');
  const saveBtn = $('#saveTaskBtn');

  form.reset();
  $('#titleError').textContent = '';
  $('#taskTitle').classList.remove('error');
  $('#editingTaskId').value = '';

  populateProjectSelect();

  if (editId) {
    const task = STATE.tasks.find(t => t.id === editId);
    if (!task) return;
    title.textContent    = 'Editar Tarea';
    saveBtn.textContent  = 'Guardar Cambios';
    $('#taskTitle').value    = task.titulo;
    $('#taskDesc').value     = task.descripcion || '';
    $('#taskAssignee').value = task.asignadoA || '';
    $('#taskPriority').value = task.prioridad;
    $('#taskProject').value  = task.proyectoId || '';
    $('#editingTaskId').value = task.id;
    populateStatusSelect(task.proyectoId);
    populateAssigneeSelect(task.proyectoId);
    const project = task.proyectoId ? STATE.projects.find(p => p.id === task.proyectoId) : null;
    const useCustom = project && Array.isArray(project.columns) && project.columns.length > 0;
    $('#taskStatus').value = useCustom ? (task.columnaId || '') : (task.estado || 'pendiente');
  } else {
    title.textContent   = 'Nueva Tarea';
    saveBtn.textContent = 'Guardar Tarea';
    const projId = STATE.currentProjectFilter || '';
    if (projId) $('#taskProject').value = projId;
    populateStatusSelect(projId || null);
    populateAssigneeSelect(projId || null);
  }

  $('#taskProject').onchange = function() {
    populateStatusSelect(this.value || null);
    populateAssigneeSelect(this.value || null);
  };

  showModal('taskModal');
}

function closeTaskModal() { hideModal('taskModal'); }

$('#taskForm').addEventListener('submit', function(e) {
  e.preventDefault();
  const titleVal = $('#taskTitle').value.trim();

  if (!titleVal) {
    $('#taskTitle').classList.add('error');
    $('#titleError').textContent = 'El título es obligatorio.';
    $('#taskTitle').focus();
    return;
  }

  $('#taskTitle').classList.remove('error');
  $('#titleError').textContent = '';

  const editId     = $('#editingTaskId').value;
  const proyectoId = $('#taskProject').value || null;
  const project    = proyectoId ? STATE.projects.find(p => p.id === proyectoId) : null;
  const useCustom  = project && Array.isArray(project.columns) && project.columns.length > 0;
  const statusVal  = $('#taskStatus').value;

  const taskData = {
    titulo:      titleVal,
    descripcion: $('#taskDesc').value.trim(),
    asignadoA:   $('#taskAssignee').value.trim(),
    estado:      useCustom ? 'pendiente' : statusVal,
    columnaId:   useCustom ? statusVal : null,
    prioridad:   $('#taskPriority').value,
    proyectoId,
  };

  if (editId) {
    const idx = STATE.tasks.findIndex(t => t.id === editId);
    if (idx !== -1) {
      STATE.tasks[idx] = { ...STATE.tasks[idx], ...taskData };
      showToast('Tarea actualizada.', 'success');
      addNotification(`Tarea editada: "${taskData.titulo}"`);
    }
  } else {
    const newTask = { id: uid(), ...taskData };
    STATE.tasks.push(newTask);
    showToast('Tarea creada con éxito.', 'success');
    addNotification(`Nueva tarea creada: "${taskData.titulo}"${taskData.asignadoA ? ' → ' + taskData.asignadoA : ''}`);
  }

  saveState();
  renderAll();
  closeTaskModal();
});

function openEditModal(taskId, e) {
  if (e) e.stopPropagation();
  openTaskModal(taskId);
}

function deleteTask(taskId, e) {
  if (e) e.stopPropagation();
  const task = STATE.tasks.find(t => t.id === taskId);
  if (!task) return;
  if (!confirm(`¿Eliminar la tarea "${task.titulo}"?`)) return;
  STATE.tasks = STATE.tasks.filter(t => t.id !== taskId);
  saveState();
  renderAll();
  showToast('Tarea eliminada.', 'info');
  addNotification(`Tarea eliminada: "${task.titulo}"`);
}

/* ==============================
   MODAL — PROJECT WIZARD
   ============================== */
const WIZ = {
  step: 1,
  structure: null,
  manualCols: [],
  members: [],
  pendingColColor: '#F3CCFF',
};

function openProjectModal() {
  WIZ.step = 1; WIZ.structure = null; WIZ.manualCols = []; WIZ.members = [];

  $('#projectName').value      = '';
  $('#projectClient').value    = '';
  $('#projectDesc').value      = '';
  $('#projectStartDate').value = new Date().toISOString().slice(0, 10);
  $('#projectNameError').textContent = '';
  $('#projectColor').value = '#CB6DEE';
  $('#memberInput').value  = '';
  $('#membersChips').innerHTML = '';
  $$('.color-swatch').forEach(s => s.classList.remove('active'));
  $$('.color-swatch')[0]?.classList.add('active');
  $('#modeEquipo').checked = true;
  $('#membersGroup').style.display = '';
  $$('.structure-option').forEach(o => o.classList.remove('selected'));

  wizGoTo(1);
  showModal('projectModal');
}

function wizGoTo(step) {
  WIZ.step = step;
  $$('.wizard-step').forEach(el => {
    const n = parseInt(el.dataset.step);
    el.classList.toggle('active', n === step);
    el.classList.toggle('done', n < step);
  });
  $$('.wizard-panel').forEach(p => p.classList.remove('active'));
  $(`#wizardStep${step}`).classList.add('active');
}

$('#wizardNext1').addEventListener('click', () => {
  const name = $('#projectName').value.trim();
  if (!name) {
    $('#projectNameError').textContent = 'El nombre es obligatorio.';
    $('#projectName').focus();
    return;
  }
  $('#projectNameError').textContent = '';
  wizGoTo(2);
});

$$('.structure-option').forEach(btn => {
  btn.addEventListener('click', function() {
    $$('.structure-option').forEach(o => o.classList.remove('selected'));
    this.classList.add('selected');
    WIZ.structure = this.dataset.structure;
    buildTemplatePreview(WIZ.structure);
    wizGoTo(3);
  });
});

$('#wizardBack2').addEventListener('click', () => wizGoTo(2));
$('#wizardBack1').addEventListener('click', () => wizGoTo(1));

function buildTemplatePreview(structure) {
  const preview = $('#templatePreview');
  const builder = $('#manualBuilder');
  const label   = $('#templatePreviewLabel');

  preview.innerHTML = '';

  if (structure === 'small') {
    preview.style.display = ''; builder.style.display = 'none';
    label.textContent = 'Vista previa de plantilla sugerida para proyecto pequeño';
    [{ name:'Pendiente',bg:'#F9C8D0'},{name:'En curso',bg:'#C0DEFF'},{name:'Hecho',bg:'#C8EFC0'}]
      .forEach(c => preview.appendChild(makePreviewCol(c.name, c.bg, 3)));
  } else if (structure === 'large') {
    preview.style.display = ''; builder.style.display = 'none';
    label.textContent = 'Vista previa de plantilla sugerida para proyecto grande';
    [{name:'Backlog',bg:'#F3CCFF'},{name:'Diseño',bg:'#F9C8D0'},{name:'Desarrollo',bg:'#FFF0B0'},{name:'Revisión',bg:'#C8EFC0'},{name:'Aprobado',bg:'#C0DEFF'}]
      .forEach(c => preview.appendChild(makePreviewCol(c.name, c.bg, 2)));
  } else {
    preview.style.display = 'none'; builder.style.display = '';
    label.textContent = 'Cree sus columnas';
    WIZ.manualCols = [];
    renderManualCols();
  }
}

function makePreviewCol(name, bg, cardCount) {
  const col = document.createElement('div');
  col.className = 'preview-col';
  col.style.background = bg;
  let cards = '';
  for (let i = 0; i < cardCount; i++) cards += '<div class="preview-card"></div>';
  col.innerHTML = `<span class="preview-col-name">${name}</span>${cards}`;
  return col;
}

function renderManualCols() {
  const row = $('#manualColsRow');
  $$('.manual-col-tile', row).forEach(el => el.remove());

  WIZ.manualCols.forEach((col, idx) => {
    const tile = document.createElement('div');
    tile.className = 'manual-col-tile';
    tile.style.background = col.color;
    tile.innerHTML = `
      <span class="manual-col-name">${escapeHtml(col.name)}</span>
      <div class="preview-card"></div>
      <button type="button" class="manual-col-remove" data-idx="${idx}" title="Eliminar">
        <i class="fa-solid fa-circle-xmark"></i>
      </button>
    `;
    row.insertBefore(tile, $('#addColBtn'));
  });

  $$('.manual-col-remove').forEach(btn => {
    btn.onclick = function() {
      WIZ.manualCols.splice(parseInt(this.dataset.idx), 1);
      renderManualCols();
      syncConfirmBtn();
    };
  });

  syncConfirmBtn();
}

function syncConfirmBtn() {
  const btn = $('#wizardConfirm');
  if (WIZ.structure === 'manual') {
    btn.disabled = WIZ.manualCols.length === 0;
    btn.style.opacity = WIZ.manualCols.length === 0 ? '0.45' : '1';
  } else {
    btn.disabled = false;
    btn.style.opacity = '1';
  }
}

$('#addColBtn').addEventListener('click', () => {
  $('#colName').value = '';
  $('#colNameError').textContent = '';
  WIZ.pendingColColor = '#F3CCFF';
  $$('.col-color-opt').forEach(o => o.classList.remove('active'));
  $$('.col-color-opt')[0]?.classList.add('active');
  updateColColorBtn('#F3CCFF', 'Morado');
  showModal('addColumnModal');
});

$('#closeAddColModal').addEventListener('click', () => hideModal('addColumnModal'));
$('#cancelAddCol').addEventListener('click', () => hideModal('addColumnModal'));

$('#acceptAddCol').addEventListener('click', () => {
  const name = $('#colName').value.trim();
  if (!name) { $('#colNameError').textContent = 'El nombre es obligatorio.'; return; }
  WIZ.manualCols.push({ name, color: WIZ.pendingColColor, order: $('#colOrder').value });
  hideModal('addColumnModal');
  renderManualCols();
});

$('#colColorSelect').addEventListener('click', function(e) {
  const opt = e.target.closest('.col-color-opt');
  if (opt) {
    const color = opt.dataset.color;
    const label = opt.textContent.trim();
    WIZ.pendingColColor = color;
    $$('.col-color-opt').forEach(o => o.classList.remove('active'));
    opt.classList.add('active');
    updateColColorBtn(color, label);
    $('#colColorDropdown').style.display = 'none';
    return;
  }
  if (e.target.closest('.col-color-btn')) {
    const dd = $('#colColorDropdown');
    dd.style.display = dd.style.display === 'none' ? 'block' : 'none';
  }
});

function updateColColorBtn(color, label) {
  const btn = $('.col-color-btn', $('#colColorSelect'));
  btn.style.background = color;
  btn.innerHTML = `<span>${label}</span><i class="fa-solid fa-angle-down"></i>`;
}

$('#wizardConfirm').addEventListener('click', () => {
  const name = $('#projectName').value.trim();
  let columns;

  if (WIZ.structure === 'small') {
    columns = [
      { id: uid(), name: 'Pendiente', color: '#F9C8D0', order: 'fecha' },
      { id: uid(), name: 'En curso',  color: '#C0DEFF', order: 'fecha' },
      { id: uid(), name: 'Hecho',     color: '#C8EFC0', order: 'fecha' },
    ];
  } else if (WIZ.structure === 'large') {
    columns = [
      { id: uid(), name: 'Backlog',    color: '#F3CCFF', order: 'fecha' },
      { id: uid(), name: 'Diseño',     color: '#F9C8D0', order: 'fecha' },
      { id: uid(), name: 'Desarrollo', color: '#FFF0B0', order: 'fecha' },
      { id: uid(), name: 'Revisión',   color: '#C8EFC0', order: 'fecha' },
      { id: uid(), name: 'Aprobado',   color: '#C0DEFF', order: 'fecha' },
    ];
  } else {
    columns = WIZ.manualCols.map(c => ({ id: uid(), name: c.name, color: c.color, order: c.order }));
  }

  const project = {
    id:          uid(),
    nombre:      name,
    cliente:     $('#projectClient').value.trim(),
    descripcion: $('#projectDesc').value.trim(),
    fechaInicio: $('#projectStartDate').value,
    modoTrabajo: $('input[name="workMode"]:checked')?.value || 'equipo',
    miembros:    [...WIZ.members],
    color:       $('#projectColor').value || '#CB6DEE',
    columns,
  };

  STATE.projects.push(project);
  saveState();
  populateProjectSelect();
  refreshProjectDropdown();
  hideModal('projectModal');
  showToast(`Proyecto "${name}" creado.`, 'success');
  addNotification(`Nuevo proyecto creado: "${name}"`);
  renderProjects();
  filterByProject(project.id, project.nombre);
});

$$('input[name="workMode"]').forEach(radio => {
  radio.addEventListener('change', function() {
    $('#membersGroup').style.display = this.value === 'cuenta' ? 'none' : '';
  });
});

function addMemberChip(name) {
  if (!name || WIZ.members.includes(name)) return;
  WIZ.members.push(name);
  const chip = document.createElement('span');
  chip.className = 'member-chip';
  chip.innerHTML = `
    <div class="assignee-avatar" style="width:20px;height:20px;font-size:0.6rem;flex-shrink:0;">
      ${name.split(' ').slice(0,2).map(n=>n[0]?.toUpperCase()||'').join('')}
    </div>
    ${escapeHtml(name)}
    <button type="button" data-name="${escapeHtml(name)}"><i class="fa-solid fa-xmark"></i></button>
  `;
  chip.querySelector('button').addEventListener('click', function() {
    WIZ.members = WIZ.members.filter(m => m !== this.dataset.name);
    chip.remove();
  });
  $('#membersChips').appendChild(chip);
}

$('#memberAddBtn').addEventListener('click', () => {
  const val = $('#memberInput').value.trim();
  if (val) { addMemberChip(val); $('#memberInput').value = ''; }
});

$('#memberInput').addEventListener('keydown', e => {
  if (e.key === 'Enter') {
    e.preventDefault();
    const val = $('#memberInput').value.trim();
    if (val) { addMemberChip(val); $('#memberInput').value = ''; }
  }
});

$('#colorPickerRow').addEventListener('click', function(e) {
  const swatch = e.target.closest('.color-swatch');
  if (!swatch) return;
  $$('.color-swatch').forEach(s => s.classList.remove('active'));
  swatch.classList.add('active');
  $('#projectColor').value = swatch.dataset.color;
});

/* ==============================
   MODAL — DETAIL
   ============================== */
function openDetailModal(taskId) {
  const task = STATE.tasks.find(t => t.id === taskId);
  if (!task) return;

  const project    = task.proyectoId ? STATE.projects.find(p => p.id === task.proyectoId) : null;
  const useCustom  = project && Array.isArray(project.columns) && project.columns.length > 0;

  // Build status label for display
  let currentStatusLabel;
  if (useCustom) {
    const col = project.columns.find(c => c.id === task.columnaId);
    currentStatusLabel = col?.name || '—';
  } else {
    currentStatusLabel = STATUS_LABELS[task.estado] || task.estado;
  }

  $('#detailTaskTitle').textContent = task.titulo;
  $('#editTaskBtn').onclick = () => { hideModal('taskDetailModal'); openTaskModal(task.id); };

  // Build quick-change buttons
  let statusButtons;
  if (useCustom) {
    statusButtons = project.columns.map(col => {
      const isActive = task.columnaId === col.id;
      return `<button data-colid="${col.id}"
        style="padding:6px 14px;border-radius:8px;border:1.5px solid #e0e0e0;
        font-family:Raleway,sans-serif;font-size:0.8rem;font-weight:700;cursor:pointer;
        background:${isActive ? 'linear-gradient(135deg,#CB6DEE,#7A98E3)' : '#f5f5f8'};
        color:${isActive ? '#fff' : '#6B6880'};transition:all 0.2s;">
        ${escapeHtml(col.name)}
      </button>`;
    }).join('');
  } else {
    statusButtons = ['pendiente','en-curso','listo'].map(s => {
      const isActive = task.estado === s;
      return `<button data-status="${s}"
        style="padding:6px 14px;border-radius:8px;border:1.5px solid #e0e0e0;
        font-family:Raleway,sans-serif;font-size:0.8rem;font-weight:700;cursor:pointer;
        background:${isActive ? 'linear-gradient(135deg,#CB6DEE,#7A98E3)' : '#f5f5f8'};
        color:${isActive ? '#fff' : '#6B6880'};transition:all 0.2s;">
        ${STATUS_LABELS[s]}
      </button>`;
    }).join('');
  }

  $('#taskDetailBody').innerHTML = `
    <div class="detail-section">
      <div class="detail-label">Descripción</div>
      <div class="detail-value">${task.descripcion ? escapeHtml(task.descripcion) : '<span style="color:#9a9aaa;font-style:italic">Sin descripción</span>'}</div>
    </div>
    <div class="detail-section">
      <div class="detail-label">Estado & Prioridad</div>
      <div class="detail-chips">
        <span class="task-list-status-tag">${escapeHtml(currentStatusLabel)}</span>
        <span class="priority-badge priority-${task.prioridad}">
          <i class="fa-solid fa-flag" style="color:${PRIORITY_COLORS[task.prioridad]}"></i>
          ${task.prioridad.charAt(0).toUpperCase() + task.prioridad.slice(1)}
        </span>
        ${project ? `<span class="project-tag" style="background:${project.color}">${escapeHtml(project.nombre)}</span>` : ''}
      </div>
    </div>
    <div class="detail-section">
      <div class="detail-label">Asignado a</div>
      <div class="detail-value" style="display:flex;align-items:center;gap:8px;">
        <div class="assignee-avatar" style="width:28px;height:28px;font-size:0.72rem;">
          ${task.asignadoA ? task.asignadoA.split(' ').slice(0,2).map(n=>n[0]?.toUpperCase()||'').join('') : '?'}
        </div>
        ${escapeHtml(task.asignadoA || 'Sin asignar')}
      </div>
    </div>
    <div class="detail-section" style="margin-top:20px;padding-top:16px;border-top:1.5px solid #eee;">
      <div class="detail-label">Cambiar estado rápido</div>
      <div id="quickStatusBtns" style="display:flex;gap:8px;margin-top:8px;flex-wrap:wrap;">
        ${statusButtons}
      </div>
    </div>
  `;

  // Attach events to quick-status buttons
  $$('#quickStatusBtns button').forEach(btn => {
    btn.addEventListener('click', () => {
      if (useCustom) {
        quickChangeColumn(task.id, btn.dataset.colid);
      } else {
        quickChangeStatus(task.id, btn.dataset.status);
      }
    });
  });

  showModal('taskDetailModal');
}

function quickChangeStatus(taskId, newStatus) {
  const idx = STATE.tasks.findIndex(t => t.id === taskId);
  if (idx === -1) return;
  const oldStatus = STATE.tasks[idx].estado;
  if (oldStatus === newStatus) return;
  STATE.tasks[idx].estado = newStatus;
  saveState();
  renderAll();
  hideModal('taskDetailModal');
  showToast(`Tarea movida a "${STATUS_LABELS[newStatus]}".`, 'success');
  addNotification(`Tarea "${STATE.tasks[idx].titulo}" → ${STATUS_LABELS[newStatus]}`);
}

function quickChangeColumn(taskId, colId) {
  const idx = STATE.tasks.findIndex(t => t.id === taskId);
  if (idx === -1) return;
  if (STATE.tasks[idx].columnaId === colId) return;

  const project = STATE.projects.find(p => p.id === STATE.tasks[idx].proyectoId);
  const col     = project?.columns?.find(c => c.id === colId);
  const colName = col?.name || 'nueva columna';

  STATE.tasks[idx].columnaId = colId;
  saveState();
  renderAll();
  hideModal('taskDetailModal');
  showToast(`Tarea movida a "${colName}".`, 'success');
  addNotification(`Tarea "${STATE.tasks[idx].titulo}" → ${colName}`);
}

/* ==============================
   DRAG & DROP
   ============================== */
function onDragStart(e) {
  const card = e.currentTarget;
  STATE.draggedTaskId = card.dataset.id;
  card.classList.add('dragging');
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/plain', STATE.draggedTaskId);
}

function onDragEnd(e) {
  e.currentTarget.classList.remove('dragging');
  STATE.draggedTaskId = null;
  $$('.kanban-column').forEach(c => c.classList.remove('drag-over'));
  $$('.column-body').forEach(c => c.classList.remove('drag-over-inner'));
  $$('.drag-placeholder').forEach(p => p.remove());
}

function onDragOver(e) {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
  const col = e.currentTarget.closest('.kanban-column');
  if (col) col.classList.add('drag-over');
  e.currentTarget.classList.add('drag-over-inner');
  $$('.drag-placeholder').forEach(p => p.remove());
  const placeholder = document.createElement('div');
  placeholder.className = 'drag-placeholder';
  e.currentTarget.appendChild(placeholder);
}

function onDragLeave(e) {
  const col = e.currentTarget.closest('.kanban-column');
  if (col) col.classList.remove('drag-over');
  e.currentTarget.classList.remove('drag-over-inner');
  $$('.drag-placeholder', e.currentTarget).forEach(p => p.remove());
}

function onDrop(e, newStatus) {
  e.preventDefault();
  const taskId = STATE.draggedTaskId || e.dataTransfer.getData('text/plain');
  if (!taskId) return;
  const idx = STATE.tasks.findIndex(t => t.id === taskId);
  if (idx === -1) return;
  const oldStatus = STATE.tasks[idx].estado;
  if (oldStatus === newStatus) { renderBoard(); return; }
  STATE.tasks[idx].estado = newStatus;
  saveState();
  renderAll();
  showToast(`Tarea movida a "${STATUS_LABELS[newStatus]}".`, 'success');
  addNotification(`Tarea "${STATE.tasks[idx].titulo}" movida a ${STATUS_LABELS[newStatus]}`);
}

function onDropCustom(e, colId) {
  e.preventDefault();
  const taskId = STATE.draggedTaskId || e.dataTransfer.getData('text/plain');
  if (!taskId) return;
  const idx = STATE.tasks.findIndex(t => t.id === taskId);
  if (idx === -1) return;
  if (STATE.tasks[idx].columnaId === colId) { renderBoard(); return; }

  const project = STATE.projects.find(p => p.id === STATE.tasks[idx].proyectoId);
  const col     = project?.columns?.find(c => c.id === colId);
  const colName = col?.name || 'nueva columna';

  STATE.tasks[idx].columnaId = colId;
  saveState();
  renderAll();
  showToast(`Tarea movida a "${colName}".`, 'success');
  addNotification(`Tarea "${STATE.tasks[idx].titulo}" movida a ${colName}`);
}

/* ==============================
   VIEW SWITCHING
   ============================== */
function switchView(viewName) {
  $$('.view').forEach(v => v.classList.remove('active'));
  $(`#view-${viewName}`)?.classList.add('active');
  $$('.nav-item').forEach(n => n.classList.remove('active'));
  $(`.nav-item[data-view="${viewName}"]`)?.classList.add('active');

  if (viewName === 'projects')      renderProjects();
  if (viewName === 'tasks')         renderTasksList();
  if (viewName === 'progress')      renderProgress();
  if (viewName === 'notifications') renderNotifications();
}

/* ==============================
   MODAL HELPERS
   ============================== */
function showModal(id) {
  $(`#${id}`).classList.add('open');
  $('#overlay').classList.add('active');
  document.body.style.overflow = 'hidden';
}

function hideModal(id) {
  $(`#${id}`).classList.remove('open');
  if (!$$('.modal.open').length) {
    $('#overlay').classList.remove('active');
    document.body.style.overflow = '';
  }
}

/* ==============================
   TOAST
   ============================== */
function showToast(message, type = 'info') {
  const container = $('#toastContainer');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  const icons = { success: 'fa-check-circle', error: 'fa-circle-xmark', info: 'fa-circle-info' };
  toast.innerHTML = `<i class="fa-solid ${icons[type] || 'fa-circle-info'}"></i>${escapeHtml(message)}`;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.animation = 'toastOut 0.3s forwards';
    setTimeout(() => toast.remove(), 300);
  }, 3200);
}

/* ==============================
   ESCAPE HTML
   ============================== */
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

/* ==============================
   RENDER ALL
   ============================== */
function renderAll() {
  renderBoard();
  const activeView = $('.view.active')?.id;
  if (activeView === 'view-projects')      renderProjects();
  if (activeView === 'view-tasks')         renderTasksList();
  if (activeView === 'view-progress')      renderProgress();
  if (activeView === 'view-notifications') renderNotifications();
}

/* ==============================
   SIDEBAR TOGGLE
   ============================== */
const sidebar     = $('#sidebar');
const mainWrapper = $('#mainWrapper');

$('#sidebarToggle').addEventListener('click', () => {
  sidebar.classList.toggle('collapsed');
  mainWrapper.classList.toggle('sidebar-collapsed');
});

$('#mobileMenuBtn').addEventListener('click', () => {
  sidebar.classList.toggle('mobile-open');
  $('#overlay').classList.toggle('active');
});

/* ==============================
   NAV EVENTS
   ============================== */
$$('.nav-item').forEach(item => {
  item.addEventListener('click', function(e) {
    e.preventDefault();
    const view = this.dataset.view;
    if (!view) return;
    sidebar.classList.remove('mobile-open');
    switchView(view);
  });
});

/* ==============================
   BUTTON WIRING
   ============================== */
$('#openModalBtn').addEventListener('click', () => openTaskModal());
$('#openModalBtnTasks').addEventListener('click', () => openTaskModal());
$('#closeModalBtn').addEventListener('click', closeTaskModal);
$('#cancelModalBtn').addEventListener('click', closeTaskModal);

$('#openProjectModalBtn').addEventListener('click', openProjectModal);
$('#closeProjectModalBtn').addEventListener('click', () => hideModal('projectModal'));
$('#cancelProjectModalBtn').addEventListener('click', () => hideModal('projectModal'));

$('#closeDetailModalBtn').addEventListener('click', () => hideModal('taskDetailModal'));

$('#clearNotifBtn').addEventListener('click', () => {
  STATE.notifications = [];
  saveState();
  renderNotifications();
  $('#notifBadge').style.display = 'none';
  showToast('Notificaciones limpiadas.', 'info');
});


$('#overlay').addEventListener('click', () => {
  $$('.modal.open').forEach(m => hideModal(m.id));
  sidebar.classList.remove('mobile-open');
  $('#overlay').classList.remove('active');
  document.body.style.overflow = '';
});

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    $$('.modal.open').forEach(m => hideModal(m.id));
    $('#projectSelector').classList.remove('open');
  }
});

/* ==============================
   INIT
   ============================== */
function init() {
  loadState();

  /* ---- User menu ---- */
const sesion = getSesion();
const btnLogin   = $('#btnIrLogin');
const btnMenu    = $('#btnUserMenu');
const userDropdown = $('#userDropdown');

if (!sesion) {
  // Sin sesión activa (no debería llegar aquí por guardSession, pero por si acaso)
  btnLogin.style.display = 'flex';
  btnMenu.style.display  = 'none';
  btnLogin.addEventListener('click', () => { window.location.href = 'login.html'; });
} else {
  // Con sesión: mostrar avatar con iniciales
  btnLogin.style.display = 'none';
  btnMenu.style.display  = 'flex';

  const initials = sesion.nombre
    ? sesion.nombre.split(' ').slice(0, 2).map(n => n[0]?.toUpperCase() || '').join('')
    : 'U';

  $('#userInitials').textContent  = initials;
  $('#userShortName').textContent = sesion.nombre?.split(' ')[0] || 'Usuario';

  // Llenar dropdown
  $('#ddAvatar').textContent = initials;
  $('#ddName').textContent   = sesion.nombre  || 'Usuario';
  $('#ddEmail').textContent  = sesion.correo  || '';
  $('#ddRol').textContent    = sesion.rol      || 'Sin rol';

  // Toggle dropdown al hacer clic en el botón
  btnMenu.addEventListener('click', (e) => {
    e.stopPropagation();
    const abierto = userDropdown.style.display === 'block';
    userDropdown.style.display = abierto ? 'none' : 'block';
    $('#userMenuArrow').style.transform = abierto ? 'rotate(0deg)' : 'rotate(180deg)';
  });

  // Cerrar al hacer clic fuera
  document.addEventListener('click', (e) => {
    if (!e.target.closest('#userMenuWrap')) {
      userDropdown.style.display = 'none';
      $('#userMenuArrow').style.transform = 'rotate(0deg)';
    }
  });

  // Botón cerrar sesión dentro del dropdown
  $('#btnCerrarSesion').addEventListener('click', cerrarSesion);

  // Hover en el botón logout
  const logoutBtn = $('#btnCerrarSesion');
  logoutBtn.addEventListener('mouseenter', () => logoutBtn.style.background = 'rgba(245,142,165,0.12)');
  logoutBtn.addEventListener('mouseleave', () => logoutBtn.style.background = 'none');
}

  // Seed demo data on first run
  if (STATE.projects.length === 0 && STATE.tasks.length === 0) {
    const p1 = { id: uid(), nombre: 'Rediseño Web', descripcion: 'Actualizar la interfaz pública de la plataforma.', color: '#CB6DEE' };
    const p2 = { id: uid(), nombre: 'MVP App', descripcion: 'Primer prototipo funcional de la app móvil.', color: '#7AB7E3' };
    STATE.projects.push(p1, p2);

    const demoTasks = [
      { titulo: 'Diseñar wireframes de inicio',   descripcion: 'Crear bocetos de la pantalla principal para revisión del equipo.', estado: 'pendiente', prioridad: 'alta',  asignadoA: 'Samara A.',   proyectoId: p1.id },
      { titulo: 'Definir paleta de colores',       descripcion: 'Seleccionar colores base y de acento para el sistema de diseño.', estado: 'en-curso',  prioridad: 'media', asignadoA: 'Mercedes P.', proyectoId: p1.id },
      { titulo: 'Configurar proyecto en Figma',   descripcion: 'Crear el archivo base con guías tipográficas y componentes.',      estado: 'listo',     prioridad: 'baja',  asignadoA: 'Hilary R.',   proyectoId: p1.id },
      { titulo: 'Definir stack tecnológico',       descripcion: 'Seleccionar las tecnologías para frontend y backend del MVP.',    estado: 'listo',     prioridad: 'alta',  asignadoA: 'Adriana S.',  proyectoId: p2.id },
      { titulo: 'Modelado de base de datos',       descripcion: 'Crear el diagrama ER y las migraciones iniciales.',               estado: 'en-curso',  prioridad: 'alta',  asignadoA: 'Sofía S.',    proyectoId: p2.id },
      { titulo: 'Implementar autenticación',       descripcion: 'Integrar OAuth con Google para registro e inicio de sesión.',     estado: 'pendiente', prioridad: 'alta',  asignadoA: 'Samara A.',   proyectoId: p2.id },
      { titulo: 'Crear componente Kanban',         descripcion: null,                                                              estado: 'pendiente', prioridad: 'media', asignadoA: 'Mercedes P.', proyectoId: null  },
      { titulo: 'Escribir documentación inicial',  descripcion: 'README con instrucciones de instalación y guía de uso.',          estado: 'pendiente', prioridad: 'baja',  asignadoA: null,          proyectoId: null  },
    ];

    demoTasks.forEach(t => STATE.tasks.push({ id: uid(), ...t }));
    saveState();
  }

  renderAll();
  populateProjectSelect();
  refreshProjectDropdown();
  switchView('board');

  if (STATE.projects.length > 0) {
    selectProjectFilter(STATE.projects[0].id, STATE.projects[0].nombre);
  } else {
    $('#currentProjectName').textContent = 'Sin proyecto';
    $('#boardTitle').textContent = 'Tablero';
  }
}

init();