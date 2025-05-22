// Variable global para el estado de depuración
let debugModeEnabled = false;
let sortDirection = 'desc'; // Por defecto, ordenar por fecha descendente (más nuevo primero)

// Función para activar/desactivar modo depuración
function toggleDebugMode() {
  debugModeEnabled = !debugModeEnabled;
  const debugConsole = document.getElementById('debugConsole');
  const debugBtn = document.getElementById('debugBtn');
  
  if (debugModeEnabled) {
    debugConsole.style.display = 'block';
    debugBtn.classList.add('btn-danger');
    debugBtn.classList.remove('btn-warning');
    debugLog('Modo depuración activado');
  } else {
    debugConsole.style.display = 'none';
    debugBtn.classList.add('btn-warning');
    debugBtn.classList.remove('btn-danger');
  }
  
  // Guardar preferencia en localStorage
  localStorage.setItem('debugMode', debugModeEnabled ? 'enabled' : 'disabled');
}

// Función para añadir mensaje a la consola de depuración
function debugLog(message, type = 'info') {
  const debugLogs = document.getElementById('debugLogs');
  if (!debugLogs) return;
  
  const entry = document.createElement('div');
  entry.className = type === 'error' ? 'text-danger' : 'text-light';
  const timestamp = new Date().toLocaleTimeString();
  entry.textContent = `[${timestamp}] ${message}`;
  debugLogs.appendChild(entry);
  debugLogs.scrollTop = debugLogs.scrollHeight;
  
  // También enviar al console.log real
  if (type === 'error') {
    console.error(message);
  } else {
    console.log(message);
  }
}

// Función para limpiar la consola de depuración
function clearDebugLogs() {
  const debugLogs = document.getElementById('debugLogs');
  if (debugLogs) {
    debugLogs.innerHTML = '';
    debugLog('Consola limpiada');
  }
}

async function cargarUsuarios() {
  debugLog('Cargando lista de usuarios...');
  try {
    const res = await fetch('/api/users');
    const data = await res.json();
    const tbody = document.getElementById('usuariosBody');
    tbody.innerHTML = '';
    data.forEach((u, i) => {
      tbody.innerHTML += `
        <tr>
          <td>${u.email}</td>
          <td>${u.name || ''}</td>
          <td>${u.merchant_id}</td>
          <td>${renderCurrencyIcons(u)}</td>
          <td>${renderPaymentMethodIcons(u)}</td>
          <td>${u.ventaTiendaActiva ? '✅' : ''}</td>
          <td>
            <button class="btn btn-sm btn-warning" onclick="editarUsuario(${i})">✏️</button>
            <button class="btn btn-sm btn-danger" onclick="eliminarUsuario(${i})">🗑️</button>
          </td>
        </tr>`;
    });
    debugLog(`${data.length} usuarios cargados correctamente`);
    localStorage.setItem('usuarios', JSON.stringify(data));
  } catch (error) {
    debugLog(`Error al cargar usuarios: ${error.message}`, 'error');
  }
}

// Función para mostrar iconos de moneda
function renderCurrencyIcons(user) {
  let icons = '';
  if (user.allowCLP) icons += '<span class="badge bg-success me-1" title="Permite CLP">CLP</span>';
  if (user.allowUSD) icons += '<span class="badge bg-primary" title="Permite USD">USD</span>';
  return icons;
}

// Función para mostrar iconos de métodos de pago
function renderPaymentMethodIcons(user) {
  let icons = '';
  if (user.allowQR) icons += '<span class="badge bg-info me-1" title="Permite QR">QR</span>';
  if (user.allowLink) icons += '<span class="badge bg-warning" title="Permite Link">LINK</span>';
  return icons;
}

function editarUsuario(i) {
  const data = JSON.parse(localStorage.getItem('usuarios'))[i];
  document.getElementById('usuarioIdx').value = i;
  document.getElementById('userEmail').value = data.email;
  document.getElementById('userName').value = data.name || '';
  document.getElementById('userPass').value = data.password;
  document.getElementById('userMerchant').value = data.merchant_id;
  document.getElementById('userTiendaActiva').checked = data.ventaTiendaActiva;
  
  // Configurar permisos de moneda
  document.getElementById('userAllowCLP').checked = data.allowCLP !== false;
  document.getElementById('userAllowUSD').checked = data.allowUSD === true;
  
  // Configurar permisos de métodos de pago
  document.getElementById('userAllowQR').checked = data.allowQR !== false;
  document.getElementById('userAllowLink').checked = data.allowLink === true;
  
  // Establecer moneda por defecto
  document.getElementById('userDefaultCurrency').value = data.defaultCurrency || 'CLP';
  
  new bootstrap.Modal(document.getElementById('modalUsuario')).show();
  debugLog(`Editando usuario: ${data.email}`);
}

async function eliminarUsuario(i) {
  if (!confirm('¿Eliminar este usuario?')) return;
  
  const usuarios = JSON.parse(localStorage.getItem('usuarios'));
  const usuario = usuarios[i];
  debugLog(`Eliminando usuario: ${usuario.email}`);
  
  try {
    const res = await fetch('/api/users/' + i, { method: 'DELETE' });
    if (res.ok) {
      debugLog(`Usuario ${usuario.email} eliminado correctamente`);
      cargarUsuarios();
    } else {
      const errorData = await res.json();
      debugLog(`Error al eliminar usuario: ${errorData.error || 'Error desconocido'}`, 'error');
    }
  } catch (error) {
    debugLog(`Error en la petición: ${error.message}`, 'error');
  }
}

document.getElementById('formUsuario').addEventListener('submit', async e => {
  e.preventDefault();
  const usuario = {
    email: document.getElementById('userEmail').value,
    name: document.getElementById('userName').value,
    password: document.getElementById('userPass').value,
    merchant_id: document.getElementById('userMerchant').value,
    ventaTiendaActiva: document.getElementById('userTiendaActiva').checked,
    // Campos de moneda
    allowCLP: document.getElementById('userAllowCLP').checked,
    allowUSD: document.getElementById('userAllowUSD').checked,
    defaultCurrency: document.getElementById('userDefaultCurrency').value,
    // Campos de métodos de pago
    allowQR: document.getElementById('userAllowQR').checked,
    allowLink: document.getElementById('userAllowLink').checked
  };
  
  debugLog(`Guardando usuario: ${usuario.email}`);
  
  // Validar que al menos una moneda esté habilitada
  if (!usuario.allowCLP && !usuario.allowUSD) {
    alert('El usuario debe tener al menos una moneda habilitada');
    debugLog('Error: El usuario debe tener al menos una moneda habilitada', 'error');
    return;
  }

  // Validar que al menos un método de pago esté habilitado
  if (!usuario.allowQR && !usuario.allowLink) {
    alert('El usuario debe tener al menos un método de pago habilitado');
    debugLog('Error: El usuario debe tener al menos un método de pago habilitado', 'error');
    return;
  }
  
  // Asegurarse que la moneda por defecto esté habilitada
  if (usuario.defaultCurrency === 'CLP' && !usuario.allowCLP) {
    alert('No se puede establecer CLP como moneda por defecto si no está habilitada');
    debugLog('Error: CLP no está habilitada como moneda por defecto', 'error');
    return;
  }
  
  if (usuario.defaultCurrency === 'USD' && !usuario.allowUSD) {
    alert('No se puede establecer USD como moneda por defecto si no está habilitada');
    debugLog('Error: USD no está habilitada como moneda por defecto', 'error');
    return;
  }
  
  const idx = document.getElementById('usuarioIdx').value;
  const method = idx ? 'PUT' : 'POST';
  const url = idx ? '/api/users/' + idx : '/api/users';
  
  try {
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(usuario)
    });
    
    if (res.ok) {
      debugLog(`Usuario ${usuario.email} ${idx ? 'actualizado' : 'creado'} correctamente`);
      bootstrap.Modal.getInstance(document.getElementById('modalUsuario')).hide();
      cargarUsuarios();
    } else {
      const errorData = await res.json();
      debugLog(`Error al guardar usuario: ${errorData.error || 'Error desconocido'}`, 'error');
      alert(errorData.error || 'Error al guardar usuario');
    }
  } catch (error) {
    debugLog(`Error en la petición: ${error.message}`, 'error');
    alert(`Error: ${error.message}`);
  }
});

function showTab(tab) {
  document.getElementById('usuarios').style.display = tab === 'usuarios' ? 'block' : 'none';
  document.getElementById('transacciones').style.display = tab === 'transacciones' ? 'block' : 'none';
  document.querySelectorAll('#adminTabs .nav-link').forEach(el => el.classList.remove('active'));
  document.querySelector(`#adminTabs .nav-link[href="#"][onclick*="${tab}"]`).classList.add('active');
  
  debugLog(`Cambiando a pestaña: ${tab}`);
  
  if (tab === 'usuarios') cargarUsuarios();
  else cargarTransacciones();
}

async function cargarTransacciones() {
  debugLog('Cargando transacciones...');
  
  try {
    const [pending, paid] = await Promise.all([
      fetch('/api/pending').then(r => r.json()),
      fetch('/api/paid').then(r => r.json())
    ]);
    
    debugLog(`Transacciones cargadas: ${pending.length} pendientes, ${paid.length} pagadas`);
    
    // Transformar los datos y añadir información adicional
    const all = [
      ...pending.map(t => ({ 
        ...t, 
        estado: 'PENDIENTE',
        // Guardar la fecha como objeto Date para facilitar ordenamiento
        dateObj: new Date(t.date)
      })), 
      ...paid.map(t => ({ 
        ...t, 
        estado: 'PAGADO',
        // Usar paid_at si está disponible, o date como respaldo
        dateObj: new Date(t.paid_at || t.date)
      }))
    ];
    
    localStorage.setItem('transacciones', JSON.stringify(all));
    renderTransacciones(all);
  } catch (error) {
    debugLog(`Error al cargar transacciones: ${error.message}`, 'error');
  }
}

function filtrar() {
  debugLog('Aplicando filtros a transacciones');
  
  const desde = new Date(document.getElementById('filtroDesde').value || '2000-01-01');
  const hasta = new Date(document.getElementById('filtroHasta').value || '2100-12-31');
  const estado = document.getElementById('filtroEstado').value;
  const usuario = document.getElementById('filtroUsuario').value.toLowerCase();
  
  const data = JSON.parse(localStorage.getItem('transacciones')) || [];
  const fil = data.filter(t => {
    const fecha = new Date(t.date || t.paid_at);
    
    // Buscar en múltiples campos de usuario
    const usuarioMatch = !usuario || 
                         (t.createdBy && t.createdBy.toLowerCase().includes(usuario)) || 
                         (t.email && t.email.toLowerCase().includes(usuario)) ||
                         (t.userName && t.userName.toLowerCase().includes(usuario));
    
    return fecha >= desde && 
           fecha <= hasta && 
           (!estado || t.estado === estado) &&
           usuarioMatch;
  });
  
  debugLog(`Filtro aplicado: ${fil.length} transacciones coinciden`);
  renderTransacciones(fil);
}

// Función para ordenar transacciones
function sortTransactions(data, direction = 'desc') {
  debugLog(`Ordenando transacciones por fecha: ${direction}`);
  
  return data.sort((a, b) => {
    const dateA = new Date(a.date || a.paid_at);
    const dateB = new Date(b.date || b.paid_at);
    
    if (direction === 'asc') {
      return dateA - dateB;
    } else {
      return dateB - dateA;
    }
  });
}

function renderTransacciones(data) {
  // Ordenar los datos antes de renderizar
  const sortedData = sortTransactions(data, sortDirection);
  
  const tbody = document.getElementById('transaccionesBody');
  tbody.innerHTML = '';
  
  sortedData.forEach(t => {
    // Determinar el usuario que creó la transacción (quien realizó la cotización)
    // Priorizar el campo userEmail que ahora guardamos específicamente para esto
    let usuarioInfo = t.userEmail || t.createdBy || t.email || '-';
    
    tbody.innerHTML += `
      <tr>
        <td>${new Date(t.date || t.paid_at).toLocaleString()}</td>
        <td>${t.name}</td>
        <td>${t.amountCLP}</td>
        <td>${t.amountUSD}</td>
        <td>${t.amountBRL || '-'}</td>
        <td>${t.estado}</td>
        <td>${renderCurrency(t)}</td>
        <td>${usuarioInfo}</td>
      </tr>`;
  });
  
  debugLog(`Se han renderizado ${sortedData.length} transacciones`);
}

// Función para mostrar la moneda original de la transacción
function renderCurrency(transaction) {
  if (transaction.originalCurrency === 'USD') {
    return '<span class="badge bg-primary">USD</span>';
  } else {
    return '<span class="badge bg-success">CLP</span>';
  }
}

// Función para cambiar la dirección de ordenamiento
function toggleSortDirection() {
  sortDirection = sortDirection === 'desc' ? 'asc' : 'desc';
  
  // Actualizar la clase del encabezado de columna
  const sortHeader = document.querySelector('th.sortable[data-sort="fecha"]');
  if (sortDirection === 'asc') {
    sortHeader.classList.add('asc');
    sortHeader.classList.remove('desc');
  } else {
    sortHeader.classList.add('desc');
    sortHeader.classList.remove('asc');
  }
  
  // Re-renderizar las transacciones con el nuevo orden
  const data = JSON.parse(localStorage.getItem('transacciones')) || [];
  renderTransacciones(data);
  
  debugLog(`Dirección de ordenamiento cambiada a: ${sortDirection}`);
}

// Cargar usuarios para el filtro
async function cargarUsuariosParaFiltro() {
  try {
    const res = await fetch('/api/users');
    const users = await res.json();
    
    const select = document.getElementById('filtroUsuario');
    if (!select) return;
    
    // Opción vacía para "todos"
    select.innerHTML = '<option value="">Todos</option>';
    
    // Añadir cada usuario como opción
    users.forEach(user => {
      const option = document.createElement('option');
      option.value = user.email;
      option.textContent = user.name || user.email;
      select.appendChild(option);
    });
    
    debugLog('Usuarios cargados para filtro de transacciones');
  } catch (error) {
    debugLog(`Error al cargar usuarios para filtro: ${error.message}`, 'error');
  }
}

async function cargarTransaccionesLinkPago() {
  const tableBody = document.querySelector('#paymentLinksTable tbody');
  tableBody.innerHTML = '<tr><td colspan="7">Cargando...</td></tr>';

  try {
    const res = await fetch('/api/payment/links');
    const data = await res.json();

    if (Array.isArray(data) && data.length > 0) {
      tableBody.innerHTML = '';
      data.forEach(tx => {
        tableBody.innerHTML += `
          <tr>
            <td>${tx.id}</td>
            <td>${tx.name}</td>
            <td>${tx.email}</td>
            <td>${tx.amount}</td>
            <td>${tx.currency}</td>
            <td>${tx.date ? tx.date.substring(0, 19).replace('T', ' ') : ''}</td>
            <td>${tx.status || ''}</td>
          </tr>
        `;
      });
    } else {
      tableBody.innerHTML = '<tr><td colspan="7">No hay transacciones de link de pago.</td></tr>';
    }
  } catch (e) {
    tableBody.innerHTML = '<tr><td colspan="7">Error al cargar transacciones.</td></tr>';
  }
}

// Llama a la función al cargar la página
document.addEventListener('DOMContentLoaded', cargarTransaccionesLinkPago);

document.getElementById('menuUsuarios')?.onclick = function() {
  document.getElementById('seccionUsuarios').style.display = '';
  document.getElementById('seccionTransacciones').style.display = 'none';
  document.getElementById('seccionLinks').style.display = 'none';
};

document.getElementById('menuTransacciones')?.onclick = function() {
  document.getElementById('seccionUsuarios').style.display = 'none';
  document.getElementById('seccionTransacciones').style.display = '';
  document.getElementById('seccionLinks').style.display = 'none';
};

document.getElementById('menuLinks')?.onclick = function() {
  document.getElementById('seccionUsuarios').style.display = 'none';
  document.getElementById('seccionTransacciones').style.display = 'none';
  document.getElementById('seccionLinks').style.display = '';
  cargarTransaccionesLinkPago(); // Llama a la función para cargar los links
};

// Inicialización
window.addEventListener('DOMContentLoaded', () => {
  debugLog('Inicializando panel de administración');
  
  // Configurar botón de depuración
  const debugBtn = document.getElementById('debugBtn');
  if (debugBtn) {
    debugBtn.addEventListener('click', toggleDebugMode);
  }
  
  // Configurar botón para limpiar logs
  const clearDebugBtn = document.getElementById('clearDebugBtn');
  if (clearDebugBtn) {
    clearDebugBtn.addEventListener('click', clearDebugLogs);
  }
  
  // Configurar ordenamiento al hacer clic en el encabezado
  const sortableHeaders = document.querySelectorAll('th.sortable');
  sortableHeaders.forEach(header => {
    header.addEventListener('click', () => {
      if (header.dataset.sort === 'fecha') {
        toggleSortDirection();
      }
    });
  });
  
  // Recuperar estado de depuración del localStorage
  const savedDebugMode = localStorage.getItem('debugMode');
  if (savedDebugMode === 'enabled') {
    toggleDebugMode();
  }
  
  // Inicializar primera pestaña
  cargarUsuarios();
  cargarUsuariosParaFiltro();
  
  document.getElementById('logoutBtn').addEventListener('click', () => {
    debugLog('Cerrando sesión');
    location.href = '/';
  });
});