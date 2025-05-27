// Variable global para el estado de depuración
let debugModeEnabled = false;
let sortDirection = 'desc'; // Por defecto, ordenar por fecha descendente (más nuevo primero)
let sortLinksDirection = 'desc'; // Por defecto descendente
let usuarios = [];

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
    usuarios = data;
    const tbody = document.getElementById('usuariosBody');
    tbody.innerHTML = '';
    data.forEach((u, i) => {
      tbody.innerHTML += `
        <tr>
          <td>${u.email}</td>
          <td>${u.name || ''}</td>
          <td>${u.merchant_id}</td>
          <td>${renderCurrencyIcons(u)}</td>
          <td>${(u.ventaTiendaActiva || u.requiereIdVentaTienda) ? '✅' : ''}</td>
          <td>
            <button class="btn btn-sm btn-outline-info" onclick="editarUsuario(${i})">👁️</button>
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

// NUEVO: Función para mostrar iconos de métodos de pago
function renderPaymentMethodIcons(user) {
  let icons = '';
  if (user.allowQR) icons += '<span class="badge bg-info me-1" title="Permite QR">QR</span>';
  if (user.allowLink) icons += '<span class="badge bg-warning" title="Permite Link">LINK</span>';
  return icons;
}

function editarUsuario(idx) {
  const usuario = usuarios[idx];

  document.getElementById('userEmail').value = usuario.email || '';
  document.getElementById('userName').value = usuario.name || '';
  document.getElementById('userPass').value = usuario.password || '';
  document.getElementById('userMerchant').value = usuario.merchant_id || '';
  document.getElementById('userAllowCLP').checked = !!usuario.allowCLP;
  document.getElementById('userAllowUSD').checked = !!usuario.allowUSD;
  document.getElementById('userDefaultCurrency').value = usuario.defaultCurrency || 'CLP';
  document.getElementById('userAllowQR').checked = !!usuario.allowQR;
  document.getElementById('userAllowLink').checked = !!usuario.allowLink;
  document.getElementById('userTiendaActiva').checked = !!(usuario.ventaTiendaActiva || usuario.requiereIdVentaTienda);
  document.getElementById('userOperationCode').value = usuario.operationCode || 1; // <-- Añadido

  // Abre el modal
  const modal = new bootstrap.Modal(document.getElementById('modalUsuario'));
  modal.show();
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
    requiereIdVentaTienda: document.getElementById('userTiendaActiva').checked,
    allowCLP: document.getElementById('userAllowCLP').checked,
    allowUSD: document.getElementById('userAllowUSD').checked,
    defaultCurrency: document.getElementById('userDefaultCurrency').value,
    allowQR: document.getElementById('userAllowQR').checked,
    allowLink: document.getElementById('userAllowLink').checked,
    operationCode: parseInt(document.getElementById('userOperationCode').value) // <-- Añadido
  };
  
  debugLog(`Guardando usuario: ${usuario.email}`);
  
  // Validar que al menos una moneda esté habilitada
  if (!usuario.allowCLP && !usuario.allowUSD) {
    alert('El usuario debe tener al menos una moneda habilitada');
    debugLog('Error: El usuario debe tener al menos una moneda habilitada', 'error');
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
  
  // NUEVO: Validar que al menos un método de pago esté habilitado
  if (!usuario.allowQR && !usuario.allowLink) {
    alert('El usuario debe tener al menos un método de pago habilitado');
    debugLog('Error: El usuario debe tener al menos un método de pago habilitado', 'error');
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
  const sortedData = sortTransactions(data, sortDirection);
  const tbody = document.getElementById('transaccionesBody');
  tbody.innerHTML = '';
  sortedData.forEach(t => {
    let usuarioInfo = t.userEmail || t.createdBy || t.email || '-';

    // NUEVO: Formatear el ID interno con información adicional si está disponible
    let idInternoDisplay = '-';
    if (t.idVentaTienda) {
      if (t.idVentaTienda === 'NO_ESPECIFICADO') {
        idInternoDisplay = '<span class="text-muted">No especificado</span>';
      } else {
        let tooltip = '';
        if (t.idVentaTienda_fecha) {
          const fecha = new Date(t.idVentaTienda_fecha).toLocaleString();
          tooltip = ` title="Agregado: ${fecha}"`;
        }
        idInternoDisplay = `<span class="badge bg-info"${tooltip}>${t.idVentaTienda}</span>`;
      }
    }

    tbody.innerHTML += `
      <tr>
        <td>${new Date(t.date || t.paid_at).toLocaleString()}</td>
        <td>${t.name}</td>
        <td>${t.amountCLP}</td>
        <td>${t.amountUSD}</td>
        <td>${t.amountBRL || '-'}</td>
        <td>${t.estado}</td>
        <td>${renderCurrency(t)}</td>
        <td>${idInternoDisplay}</td> <!-- NUEVA COLUMNA -->
        <td>${usuarioInfo}</td>
      </tr>`;
  });
  debugLog(`Se han renderizado ${sortedData.length} transacciones`);
}

function renderCurrency(transaction) {
  if (transaction.originalCurrency === 'USD') {
    return '<span class="badge bg-primary">USD</span>';
  } else {
    return '<span class="badge bg-success">CLP</span>';
  }
}

function toggleSortDirection() {
  sortDirection = sortDirection === 'desc' ? 'asc' : 'desc';
  const sortHeader = document.querySelector('th.sortable[data-sort="fecha"]');
  if (sortDirection === 'asc') {
    sortHeader.classList.add('asc');
    sortHeader.classList.remove('desc');
  } else {
    sortHeader.classList.add('desc');
    sortHeader.classList.remove('asc');
  }
  const data = JSON.parse(localStorage.getItem('transacciones')) || [];
  renderTransacciones(data);
  debugLog(`Dirección de ordenamiento cambiada a: ${sortDirection}`);
}

async function cargarUsuariosParaFiltro() {
  try {
    const res = await fetch('/api/users');
    const users = await res.json();
    const select = document.getElementById('filtroUsuario');
    if (!select) return;
    select.innerHTML = '<option value="">Todos</option>';
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
  tableBody.innerHTML = '<tr><td colspan="9">Cargando...</td></tr>';
  try {
    const res = await fetch('/api/payment/links');
    const data = await res.json();
    if (Array.isArray(data) && data.length > 0) {
      // Ordenar por fecha según dirección
      data.sort((a, b) => {
        const dateA = new Date(a.date);
        const dateB = new Date(b.date);
        return sortLinksDirection === 'asc' ? dateA - dateB : dateB - dateA;
      });

      tableBody.innerHTML = '';
      data.forEach(tx => {
        // Mostrar el monto en la columna correcta según la moneda
        const montoCLP = tx.currency === 'CLP' ? tx.amount : (tx.amountCLP || '');
        const montoUSD = tx.currency === 'USD' ? tx.amount : (tx.amountUSD || '');
        const montoBRL = tx.currency === 'BRL' ? tx.amount : (tx.amountBRL || '');

        tableBody.innerHTML += `
          <tr>
            <td>${tx.date ? tx.date.substring(0, 19).replace('T', ' ') : ''}</td>
            <td>${tx.id}</td>
            <td>${tx.name || ''}</td>
            <td>${tx.email || ''}</td>
            <td>${montoCLP}</td>
            <td>${montoUSD}</td>
            <td>${montoBRL}</td>
            <td>${tx.status || ''}</td>
            <td>${tx.userEmail || '-'}</td>
          </tr>
        `;
      });
    } else {
      tableBody.innerHTML = '<tr><td colspan="9">No hay transacciones de link de pago.</td></tr>';
    }
  } catch (e) {
    tableBody.innerHTML = '<tr><td colspan="9">Error al cargar transacciones.</td></tr>';
  }
}

// Inicialización principal
window.addEventListener('DOMContentLoaded', () => {
  debugLog('Inicializando panel de administración');

  // Mostrar usuarios por defecto
  document.getElementById('seccionUsuarios').style.display = '';
  document.getElementById('seccionTransacciones').style.display = 'none';
  document.getElementById('seccionLinks').style.display = 'none';

  // Inicializar datos
  cargarUsuarios();
  cargarUsuariosParaFiltro();

  // Configurar menú
  document.getElementById('menuUsuarios').onclick = function() {
    document.getElementById('seccionUsuarios').style.display = '';
    document.getElementById('seccionTransacciones').style.display = 'none';
    document.getElementById('seccionLinks').style.display = 'none';
  };
  document.getElementById('menuTransacciones').onclick = function() {
    document.getElementById('seccionUsuarios').style.display = 'none';
    document.getElementById('seccionTransacciones').style.display = '';
    document.getElementById('seccionLinks').style.display = 'none';
    cargarTransacciones();
  };
  document.getElementById('menuLinks').onclick = function() {
    document.getElementById('seccionUsuarios').style.display = 'none';
    document.getElementById('seccionTransacciones').style.display = 'none';
    document.getElementById('seccionLinks').style.display = '';
    cargarTransaccionesLinkPago();
  };

  // Botones de debug
  const debugBtn = document.getElementById('debugBtn');
  if (debugBtn) debugBtn.addEventListener('click', toggleDebugMode);

  const clearDebugBtn = document.getElementById('clearDebugBtn');
  if (clearDebugBtn) clearDebugBtn.addEventListener('click', clearDebugLogs);

  // Ordenamiento
  const sortableHeaders = document.querySelectorAll('th.sortable');
  sortableHeaders.forEach(header => {
    header.addEventListener('click', () => {
      if (header.dataset.sort === 'fecha') {
        toggleSortDirection();
      }
    });
  });

  const linkSortableHeader = document.querySelector('#paymentLinksTable th.sortable[data-sort="fecha"]');
  if (linkSortableHeader) {
    linkSortableHeader.addEventListener('click', () => {
      sortLinksDirection = sortLinksDirection === 'desc' ? 'asc' : 'desc';
      cargarTransaccionesLinkPago();
    });
  }

  // Estado debug
  const savedDebugMode = localStorage.getItem('debugMode');
  if (savedDebugMode === 'enabled') toggleDebugMode();

  // Logout
  document.getElementById('logoutBtn').addEventListener('click', () => {
    debugLog('Cerrando sesión');
    location.href = '/';
  });
});