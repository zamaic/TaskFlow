/* ==============================
   TASKFLOW — functions.js
   ============================== */

'use strict';

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

/**
 * Rebuilds the dropdown list whenever projects change.
 * Called after init, after creating/deleting a project.
 */
function refreshProjectDropdown() {
  const dropdown = $('#projectDropdown');

  // Remove all dynamic items (keep the "Todos" item which has id)
  $$('.project-dropdown-item:not(#dropdownAllProjects)', dropdown).forEach(el => el.remove());

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

  // Sync active state
  syncDropdownActive();
}

/** Marks the currently selected item as active inside the dropdown */
function syncDropdownActive() {
  const dropdown = $('#projectDropdown');
  $$('.project-dropdown-item', dropdown).forEach(item => {
    const id = item.dataset.id || '';
    if (id === (STATE.currentProjectFilter || '')) {
      item.classList.add('active');
    } else {
      item.classList.remove('active');
    }
  });
}

/** Applies a project filter (or clears it when id is null/'') */
function selectProjectFilter(id, name) {
  STATE.currentProjectFilter = id || null;
  $('#currentProjectName').textContent = name;
  $('#boardTitle').textContent = id ? name : 'Tablero';

  // close dropdown
  $('#projectSelector').classList.remove('open');

  // make sure board view is active and re-render
  switchView('board');
  renderBoard();
}

/* Toggle dropdown open/close */
$('#projectSelector').addEventListener('click', function (e) {
  // Don't toggle if the click was on a dropdown item (they handle themselves)
  if (e.target.closest('.project-dropdown-item')) return;
  this.classList.toggle('open');
});

/* "Todos los proyectos" item */
$('#dropdownAllProjects').addEventListener('click', (e) => {
  e.stopPropagation();
  selectProjectFilter(null, 'Todos los proyectos');
});

/* Close dropdown when clicking outside */
document.addEventListener('click', (e) => {
  if (!e.target.closest('#projectSelector')) {
    $('#projectSelector').classList.remove('open');
  }
});

/* ==============================
   RENDER — BOARD
   ============================== */
function renderBoard() {
  const statuses = ['pendiente', 'en-curso', 'listo'];

  statuses.forEach(status => {
    const container = $(`#tasks-${status}`);
    const emptyEl   = $(`#empty-${status}`);
    const countEl   = $(`#count-${status}`);

    // filter tasks
    let tasks = STATE.tasks.filter(t => t.estado === status);
    if (STATE.currentProjectFilter) {
      tasks = tasks.filter(t => t.proyectoId === STATE.currentProjectFilter);
    }

    // clear rendered cards (keep empty-state)
    $$('.task-card', container).forEach(el => el.remove());
    $$('.drag-placeholder', container).forEach(el => el.remove());

    countEl.textContent = tasks.length;

    if (tasks.length === 0) {
      emptyEl.style.display = 'flex';
    } else {
      emptyEl.style.display = 'none';
      tasks.forEach(task => {
        container.appendChild(createTaskCard(task));
      });
    }
  });

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

  // drag events
  card.addEventListener('dragstart', onDragStart);
  card.addEventListener('dragend', onDragEnd);
  // click to detail
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
    const doneCount = STATE.tasks.filter(t => t.proyectoId === project.id && t.estado === 'listo').length;

    const card = document.createElement('div');
    card.className = 'project-card';
    card.style.setProperty('--project-color', project.color);
    card.innerHTML = `
      <h3 class="project-card-name">${escapeHtml(project.nombre)}</h3>
      <p class="project-card-desc">${escapeHtml(project.descripcion || 'Sin descripción')}</p>
      <div class="project-card-stats">
        <span class="project-stat"><i class="fa-solid fa-list-check"></i> ${taskCount} tareas</span>
        <span class="project-stat"><i class="fa-solid fa-check"></i> ${doneCount} listas</span>
      </div>
      <div class="project-card-footer">
        <button class="btn-secondary" style="padding:6px 12px;font-size:0.76rem;" onclick="filterByProject('${project.id}', '${escapeHtml(project.nombre)}', event)">Ver tablero</button>
        <button class="project-delete-btn" title="Eliminar proyecto" onclick="deleteProject('${project.id}', event)">
          <i class="fa-solid fa-circle-xmark"></i>
        </button>
      </div>
    `;
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
    { value: total,   label: 'Total Tareas',     color: '#CB6DEE' },
    { value: pending, label: 'Pendientes',        color: '#FFE285' },
    { value: inProg,  label: 'En Curso',          color: '#7AB7E3' },
    { value: done,    label: 'Completadas',       color: '#B9DFA4' },
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

  // Per-project breakdown
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

/* ==============================
   MODAL — TASK
   ============================== */
function openTaskModal(editId = null) {
  const modal = $('#taskModal');
  const form  = $('#taskForm');
  const title = $('#modalTitle');
  const saveBtn = $('#saveTaskBtn');

  form.reset();
  $('#titleError').textContent = '';
  $('#taskTitle').classList.remove('error');
  $('#editingTaskId').value = '';

  populateProjectSelect();

  if (editId) {
    const task = STATE.tasks.find(t => t.id === editId);
    if (!task) return;
    title.textContent = 'Editar Tarea';
    saveBtn.textContent = 'Guardar Cambios';
    $('#taskTitle').value     = task.titulo;
    $('#taskDesc').value      = task.descripcion || '';
    $('#taskAssignee').value  = task.asignadoA || '';
    $('#taskStatus').value    = task.estado;
    $('#taskPriority').value  = task.prioridad;
    $('#taskProject').value   = task.proyectoId || '';
    $('#editingTaskId').value = task.id;
  } else {
    title.textContent = 'Nueva Tarea';
    saveBtn.textContent = 'Guardar Tarea';
    if (STATE.currentProjectFilter) {
      $('#taskProject').value = STATE.currentProjectFilter;
    }
  }

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

  const editId = $('#editingTaskId').value;

  const taskData = {
    titulo:      titleVal,
    descripcion: $('#taskDesc').value.trim(),
    asignadoA:   $('#taskAssignee').value.trim(),
    estado:      $('#taskStatus').value,
    prioridad:   $('#taskPriority').value,
    proyectoId:  $('#taskProject').value || null,
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

/* ---- Edit from card ---- */
function openEditModal(taskId, e) {
  if (e) e.stopPropagation();
  openTaskModal(taskId);
}

/* ---- Delete task ---- */
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
   MODAL — PROJECT
   ============================== */
function openProjectModal() {
  $('#projectForm').reset();
  $('#projectNameError').textContent = '';
  $('#projectColor').value = '#CB6DEE';
  $$('.color-swatch').forEach(s => s.classList.remove('active'));
  $$('.color-swatch')[0]?.classList.add('active');
  showModal('projectModal');
}

$('#projectForm').addEventListener('submit', function(e) {
  e.preventDefault();
  const name = $('#projectName').value.trim();
  if (!name) {
    $('#projectNameError').textContent = 'El nombre es obligatorio.';
    return;
  }
  $('#projectNameError').textContent = '';

  const project = {
    id:          uid(),
    nombre:      name,
    descripcion: $('#projectDesc').value.trim(),
    color:       $('#projectColor').value || '#CB6DEE',
  };

  STATE.projects.push(project);
  saveState();
  populateProjectSelect();
  refreshProjectDropdown();   // ← update topbar dropdown
  renderProjects();
  hideModal('projectModal');
  showToast(`Proyecto "${name}" creado.`, 'success');
  addNotification(`Nuevo proyecto creado: "${name}"`);
});

function deleteProject(projectId, e) {
  if (e) e.stopPropagation();
  const project = STATE.projects.find(p => p.id === projectId);
  if (!project) return;
  if (!confirm(`¿Eliminar el proyecto "${project.nombre}"? Las tareas asociadas quedarán sin proyecto.`)) return;

  STATE.projects = STATE.projects.filter(p => p.id !== projectId);
  STATE.tasks = STATE.tasks.map(t => t.proyectoId === projectId ? { ...t, proyectoId: null } : t);

  if (STATE.currentProjectFilter === projectId) {
    STATE.currentProjectFilter = null;
    $('#currentProjectName').textContent = 'Todos los proyectos';
    $('#boardTitle').textContent = 'Tablero';
  }

  saveState();
  refreshProjectDropdown();   // ← update topbar dropdown
  renderAll();
  showToast(`Proyecto "${project.nombre}" eliminado.`, 'info');
}

function filterByProject(projectId, projectName, e) {
  if (e) e.stopPropagation();
  selectProjectFilter(projectId, projectName);
}

/* ---- Color swatch ---- */
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

  const project = task.proyectoId ? STATE.projects.find(p => p.id === task.proyectoId) : null;

  $('#detailTaskTitle').textContent = task.titulo;
  $('#editTaskBtn').onclick = () => { hideModal('taskDetailModal'); openTaskModal(task.id); };

  $('#taskDetailBody').innerHTML = `
    <div class="detail-section">
      <div class="detail-label">Descripción</div>
      <div class="detail-value">${task.descripcion ? escapeHtml(task.descripcion) : '<span style="color:#9a9aaa;font-style:italic">Sin descripción</span>'}</div>
    </div>
    <div class="detail-section">
      <div class="detail-label">Estado & Prioridad</div>
      <div class="detail-chips">
        <span class="task-list-status-tag">${STATUS_LABELS[task.estado]}</span>
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
      <div style="display:flex;gap:8px;margin-top:8px;flex-wrap:wrap;">
        ${['pendiente','en-curso','listo'].map(s => `
          <button onclick="quickChangeStatus('${task.id}','${s}')"
            style="padding:6px 14px;border-radius:8px;border:1.5px solid #e0e0e0;
            font-family:Raleway,sans-serif;font-size:0.8rem;font-weight:700;cursor:pointer;
            background:${task.estado===s?'linear-gradient(135deg,#CB6DEE,#7A98E3)':'#f5f5f8'};
            color:${task.estado===s?'#fff':'#6B6880'};
            transition:all 0.2s;">
            ${STATUS_LABELS[s]}
          </button>
        `).join('')}
      </div>
    </div>
  `;

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

  // show placeholder
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
  if (oldStatus === newStatus) {
    renderBoard();
    return;
  }

  STATE.tasks[idx].estado = newStatus;
  saveState();
  renderAll();
  showToast(`Tarea movida a "${STATUS_LABELS[newStatus]}".`, 'success');
  addNotification(`Tarea "${STATE.tasks[idx].titulo}" movida a ${STATUS_LABELS[newStatus]}`);
}

/* ==============================
   VIEW SWITCHING
   ============================== */
function switchView(viewName) {
  $$('.view').forEach(v => v.classList.remove('active'));
  $(`#view-${viewName}`)?.classList.add('active');

  $$('.nav-item').forEach(n => n.classList.remove('active'));
  $(`.nav-item[data-view="${viewName}"]`)?.classList.add('active');

  // re-render as needed
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
  // only remove overlay if no other modal is open
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
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/* ==============================
   RENDER ALL
   ============================== */
function renderAll() {
  renderBoard();
  // lazy-render other views only if visible
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

    // close mobile sidebar
    sidebar.classList.remove('mobile-open');

    if (view === 'board') {
      // keep the current filter when navigating back to board
    }

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

// Overlay click closes modals
$('#overlay').addEventListener('click', () => {
  $$('.modal.open').forEach(m => hideModal(m.id));
  sidebar.classList.remove('mobile-open');
  $('#overlay').classList.remove('active');
  document.body.style.overflow = '';
});

// ESC key closes modals
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

  // seed demo data on first run
  if (STATE.projects.length === 0 && STATE.tasks.length === 0) {
    const p1 = { id: uid(), nombre: 'Rediseño Web', descripcion: 'Actualizar la interfaz pública de la plataforma.', color: '#CB6DEE' };
    const p2 = { id: uid(), nombre: 'MVP App', descripcion: 'Primer prototipo funcional de la app móvil.', color: '#7AB7E3' };
    STATE.projects.push(p1, p2);

    const demoTasks = [
      { titulo: 'Diseñar wireframes de inicio',   descripcion: 'Crear bocetos de la pantalla principal para revisión del equipo.', estado: 'pendiente',  prioridad: 'alta',  asignadoA: 'Samara A.',   proyectoId: p1.id },
      { titulo: 'Definir paleta de colores',       descripcion: 'Seleccionar colores base y de acento para el sistema de diseño.', estado: 'en-curso',   prioridad: 'media', asignadoA: 'Mercedes P.', proyectoId: p1.id },
      { titulo: 'Configurar proyecto en Figma',   descripcion: 'Crear el archivo base con las guías tipográficas y componentes.',  estado: 'listo',      prioridad: 'baja',  asignadoA: 'Hilary R.',   proyectoId: p1.id },
      { titulo: 'Definir stack tecnológico',       descripcion: 'Seleccionar las tecnologías para frontend y backend del MVP.',    estado: 'listo',      prioridad: 'alta',  asignadoA: 'Adriana S.',  proyectoId: p2.id },
      { titulo: 'Modelado de base de datos',       descripcion: 'Crear el diagrama ER y las migraciones iniciales.',               estado: 'en-curso',   prioridad: 'alta',  asignadoA: 'Sofía S.',   proyectoId: p2.id },
      { titulo: 'Implementar autenticación',       descripcion: 'Integrar OAuth con Google para registro e inicio de sesión.',     estado: 'pendiente',  prioridad: 'alta',  asignadoA: 'Samara A.',   proyectoId: p2.id },
      { titulo: 'Crear componente Kanban',         descripcion: null,                                                              estado: 'pendiente',  prioridad: 'media', asignadoA: 'Mercedes P.', proyectoId: null  },
      { titulo: 'Escribir documentación inicial',  descripcion: 'README con instrucciones de instalación y guía de uso.',          estado: 'pendiente',  prioridad: 'baja',  asignadoA: null,          proyectoId: null  },
    ];

    demoTasks.forEach(t => STATE.tasks.push({ id: uid(), ...t }));
    saveState();
  }

  renderAll();
  populateProjectSelect();
  refreshProjectDropdown();   // ← populate topbar dropdown on start
  switchView('board');
  $('#currentProjectName').textContent = 'Todos los proyectos';
  $('#boardTitle').textContent = 'Tablero';
}

init();
