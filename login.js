/* ==============================
   TASKFLOW — login.js
   ============================== */

'use strict';

/* ==============================
   CONSTANTES
   ============================== */
const STORAGE_USUARIOS  = 'tf_usuarios';
const STORAGE_SESION    = 'tf_sesion';
const DASHBOARD_URL     = 'index.html';

/* SVG paths para el ojo (ver/ocultar contraseña) */
const EYE_OPEN = `<path d="M247.31,124.76c-.35-.79-8.82-19.58-27.65-38.41C194.57,61.26,162.88,48,128,48S61.43,61.26,36.34,86.35C17.51,105.18,9,124,8.69,124.76a8,8,0,0,0,0,6.5c.35.79,8.82,19.57,27.65,38.4C61.43,194.74,93.12,208,128,208s66.57-13.26,91.66-38.34c18.83-18.83,27.3-37.61,27.65-38.4A8,8,0,0,0,247.31,124.76ZM128,192c-30.78,0-57.67-11.19-79.93-33.25A133.47,133.47,0,0,1,25,128,133.33,133.33,0,0,1,48.07,97.25C70.33,75.19,97.22,64,128,64s57.67,11.19,79.93,33.25A133.46,133.46,0,0,1,231.05,128C223.84,141.46,192.43,192,128,192Zm0-112a48,48,0,1,0,48,48A48.05,48.05,0,0,0,128,80Zm0,80a32,32,0,1,1,32-32A32,32,0,0,1,128,160Z"/>`;

const EYE_CLOSED = `<path d="M228,175a8,8,0,0,1-10.92-3l-19-33.2A88.17,88.17,0,0,1,128,152a87.53,87.53,0,0,1-42.24-10.72L67.39,175a8,8,0,1,1-13.86-8l18.42-32.13A88.1,88.1,0,0,1,47.36,111.5l-22.82-12.4a8,8,0,0,1,7.92-13.9l25,13.59A88.3,88.3,0,0,1,88,86.92V56a8,8,0,0,1,16,0V80a87.7,87.7,0,0,1,48,0V56a8,8,0,0,1,16,0V86.92a88.3,88.3,0,0,1,30.54,11.87l25-13.59a8,8,0,0,1,7.92,13.9l-22.82,12.4a88.1,88.1,0,0,1-24.19,23.48L203.06,155A8,8,0,0,1,228,175Z"/>`;

/* ==============================
   TABS
   ============================== */
function switchTab(tabName) {
  document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
  document.querySelectorAll('.panel').forEach(panel => panel.classList.remove('active'));

  const activeBtn   = document.querySelector(`.tab-btn[data-tab="${tabName}"]`);
  const activePanel = document.getElementById(`panel-${tabName}`);

  if (!activeBtn || !activePanel) return;

  activeBtn.classList.add('active');
  activePanel.classList.add('active');

  // Mover el indicador deslizante
  const indicator = document.getElementById('tabIndicator');
  const tabsRect  = document.getElementById('tabs').getBoundingClientRect();
  const btnRect   = activeBtn.getBoundingClientRect();
  indicator.style.left  = (btnRect.left - tabsRect.left) + 'px';
  indicator.style.width = btnRect.width + 'px';
}

/* ==============================
   TOGGLE CONTRASEÑA (ojo)
   ============================== */
function initEyeButtons() {
  document.querySelectorAll('.eye-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const inputId = btn.dataset.target;
      const input   = document.getElementById(inputId);
      const svg     = btn.querySelector('svg');

      if (!input || !svg) return;

      if (input.type === 'password') {
        input.type   = 'text';
        svg.innerHTML = EYE_CLOSED;
      } else {
        input.type   = 'password';
        svg.innerHTML = EYE_OPEN;
      }
    });
  });
}

/* ==============================
   FORTALEZA DE CONTRASEÑA
   ============================== */
function checkPasswordStrength(pw) {
  const bars = [
    document.getElementById('bar1'),
    document.getElementById('bar2'),
    document.getElementById('bar3'),
  ].filter(Boolean);

  // Resetear
  bars.forEach(b => { b.className = 'pw-bar'; });

  if (!pw) return;

  let score = 0;
  if (pw.length >= 6)  score++;
  if (pw.length >= 10) score++;
  if (/[A-Z]/.test(pw) && /[0-9!@#$%^&*]/.test(pw)) score++;

  const levelClass = ['weak', 'medium', 'strong'][score - 1] || 'weak';
  for (let i = 0; i < score; i++) {
    bars[i].classList.add(levelClass);
  }
}

/* ==============================
   ROLE PILLS
   ============================== */
function initRolePills() {
  document.querySelectorAll('.role-pill input[type="radio"]').forEach(radio => {
    radio.addEventListener('change', () => {
      document.querySelectorAll('.role-pill').forEach(p => p.classList.remove('selected'));
      radio.closest('.role-pill').classList.add('selected');
    });
  });
}

/* ==============================
   HELPERS DE VALIDACIÓN
   ============================== */
function setError(id, msg) {
  const el = document.getElementById(id);
  if (el) el.textContent = msg;
}

function clearErrors(...ids) {
  ids.forEach(id => setError(id, ''));
}

function markInputError(inputId, hasError) {
  const el = document.getElementById(inputId);
  if (!el) return;
  el.classList.toggle('error', hasError);
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/* ==============================
   TOAST
   ============================== */
function showToast(message, type = 'info') {
  const wrap  = document.getElementById('toastWrap');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;

  const icons = { success: '✅', error: '❌', info: 'ℹ️' };
  toast.innerHTML = `<span>${icons[type] || ''}</span><span>${message}</span>`;
  wrap.appendChild(toast);

  setTimeout(() => {
    toast.style.animation = 'toastOut 0.28s forwards';
    setTimeout(() => toast.remove(), 280);
  }, 3200);
}

/* ==============================
   PERSISTENCIA (LocalStorage)
   ============================== */
function getUsuarios() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_USUARIOS)) || [];
  } catch {
    return [];
  }
}

function saveUsuarios(usuarios) {
  localStorage.setItem(STORAGE_USUARIOS, JSON.stringify(usuarios));
}

function saveSesion(usuario) {
  /* Guardamos nombre + rol para poder mostrarlo en el dashboard */
  localStorage.setItem(STORAGE_SESION, JSON.stringify({
    nombre: usuario.nombre,
    correo: usuario.correo,
    rol:    usuario.rol,
  }));
}

/* ==============================
   LOGIN
   ============================== */
function handleLogin() {
  const email = document.getElementById('loginEmail').value.trim();
  const pw    = document.getElementById('loginPw').value;

  clearErrors('loginEmailErr', 'loginPwErr');
  markInputError('loginEmail', false);
  markInputError('loginPw',    false);

  let valid = true;

  if (!email || !isValidEmail(email)) {
    setError('loginEmailErr', 'Ingresa un correo electrónico válido.');
    markInputError('loginEmail', true);
    valid = false;
  }

  if (!pw) {
    setError('loginPwErr', 'La contraseña es obligatoria.');
    markInputError('loginPw', true);
    valid = false;
  }

  if (!valid) return;

  const usuarios = getUsuarios();
  const match    = usuarios.find(u => u.correo === email && u.password === pw);

  if (!match) {
    showToast('Correo o contraseña incorrectos.', 'error');
    setError('loginPwErr', 'Credenciales inválidas. Verifica tus datos.');
    markInputError('loginPw', true);
    return;
  }

  saveSesion(match);
  showToast(`Bienvenido de vuelta, ${match.nombre} 👋`, 'success');

  setTimeout(() => {
    window.location.href = DASHBOARD_URL;
  }, 1100);
}

/* ==============================
   SIGNUP
   ============================== */
function handleSignup() {
  const name  = document.getElementById('signupName').value.trim();
  const email = document.getElementById('signupEmail').value.trim();
  const pw    = document.getElementById('signupPw').value;
  const rol   = document.querySelector('input[name="rol"]:checked')?.value || '';

  clearErrors('signupNameErr', 'signupEmailErr', 'signupPwErr', 'signupRolErr');

  let valid = true;

  if (!name) {
    setError('signupNameErr', 'El nombre completo es obligatorio.');
    valid = false;
  }

  if (!email || !isValidEmail(email)) {
    setError('signupEmailErr', 'Ingresa un correo electrónico válido.');
    valid = false;
  }

  if (pw.length < 6) {
    setError('signupPwErr', 'La contraseña debe tener al menos 6 caracteres.');
    valid = false;
  }

  if (!rol) {
    setError('signupRolErr', 'Selecciona un rol para continuar.');
    valid = false;
  }

  if (!valid) return;

  const usuarios = getUsuarios();

  if (usuarios.find(u => u.correo === email)) {
    setError('signupEmailErr', 'Este correo ya está registrado.');
    showToast('El correo ya existe. Inicia sesión.', 'error');
    return;
  }

  const nuevoUsuario = { nombre: name, correo: email, password: pw, rol };
  usuarios.push(nuevoUsuario);
  saveUsuarios(usuarios);
  saveSesion(nuevoUsuario);

  showToast(`¡Cuenta creada! Bienvenido, ${name} 🎉`, 'success');

  setTimeout(() => {
    window.location.href = DASHBOARD_URL;
  }, 1100);
}

/* ==============================
   INICIALIZACIÓN
   ============================== */
document.addEventListener('DOMContentLoaded', () => {

  /* Si ya hay sesión activa, ir directo al dashboard */
  if (localStorage.getItem(STORAGE_SESION)) {
    window.location.href = DASHBOARD_URL;
    return;
  }

  /* Tab por defecto */
  switchTab('login');

  /* Inicializar componentes */
  initEyeButtons();
  initRolePills();

  /* Clicks en los botones de tabs */
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });

  /* Links de "¿Ya tienes cuenta?" / "Regístrate" */
  document.querySelectorAll('.tab-link').forEach(link => {
    link.addEventListener('click', () => switchTab(link.dataset.tab));
  });

  /* Botones de submit */
  document.getElementById('btnLogin')?.addEventListener('click', handleLogin);
  document.getElementById('btnSignup')?.addEventListener('click', handleSignup);

  /* Botón Google (sin implementar) */
  document.getElementById('btnGoogle')?.addEventListener('click', () => {
    showToast('Autenticación con Google no configurada.', 'info');
  });

  /* Enter para enviar el formulario activo */
  document.addEventListener('keydown', e => {
    if (e.key !== 'Enter') return;
    const loginActivo = document.getElementById('panel-login').classList.contains('active');
    if (loginActivo) handleLogin();
    else handleSignup();
  });

  /* Fortaleza de contraseña en tiempo real */
  document.getElementById('signupPw')?.addEventListener('input', function () {
    checkPasswordStrength(this.value);
  });
});
