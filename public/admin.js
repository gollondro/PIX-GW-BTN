async function cargarUsuarios() {
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
        <td>${u.ventaTiendaActiva ? '✅' : ''}</td>
        <td>
          <button class="btn btn-sm btn-warning" onclick="editarUsuario(${i})">✏️</button>
          <button class="btn btn-sm btn-danger" onclick="eliminarUsuario(${i})">🗑️</button>
        </td>
      </tr>`;
  });
  localStorage.setItem('usuarios', JSON.stringify(data));
}

// Función para mostrar iconos de moneda
function renderCurrencyIcons(user) {
  let icons = '';
  if (user.allowCLP) icons += '<span class="badge bg-success me-1" title="Permite CLP">CLP</span>';
  if (user.allowUSD) icons += '<span class="badge bg-primary" title="Permite USD">USD</span>';
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
  
  // Establecer moneda por defecto
  document.getElementById('userDefaultCurrency').value = data.defaultCurrency || 'CLP';
  
  new bootstrap.Modal(document.getElementById('modalUsuario')).show();
}

async function eliminarUsuario(i) {
  if (!confirm('¿Eliminar este usuario?')) return;
  const res = await fetch('/api/users/' + i, { method: 'DELETE' });
  if (res.ok) cargarUsuarios();
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
    defaultCurrency: document.getElementById('userDefaultCurrency').value
  };
  
  // Validar que al menos una moneda esté habilitada
  if (!usuario.allowCLP && !usuario.allowUSD) {
    alert('El usuario debe tener al menos una moneda habilitada');
    return;
  }
  
  // Asegurarse que la moneda por defecto esté habilitada
  if (usuario.defaultCurrency === 'CLP' && !usuario.allowCLP) {
    alert('No se puede establecer CLP como moneda por defecto si no está habilitada');
    return;
  }
  
  if (usuario.defaultCurrency === 'USD' && !usuario.allowUSD) {
    alert('No se puede establecer USD como moneda por defecto si no está habilitada');
    return;
  }
  
  const idx = document.getElementById('usuarioIdx').value;
  const method = idx ? 'PUT' : 'POST';
  const url = idx ? '/api/users/' + idx : '/api/users';
  const res = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(usuario)
  });
  if (res.ok) {
    bootstrap.Modal.getInstance(document.getElementById('modalUsuario')).hide();
    cargarUsuarios();
  }
});

function showTab(tab) {
  document.getElementById('usuarios').style.display = tab === 'usuarios' ? 'block' : 'none';
  document.getElementById('transacciones').style.display = tab === 'transacciones' ? 'block' : 'none';
  document.querySelectorAll('#adminTabs .nav-link').forEach(el => el.classList.remove('active'));
  document.querySelector(`#adminTabs .nav-link[href="#"][onclick*="${tab}"]`).classList.add('active');
  if (tab === 'usuarios') cargarUsuarios();
  else cargarTransacciones();
}

async function cargarTransacciones() {
  const [pending, paid] = await Promise.all([
    fetch('/api/pending').then(r => r.json()),
    fetch('/api/paid').then(r => r.json())
  ]);
  const all = [
    ...pending.map(t => ({ ...t, estado: 'PENDIENTE' })), 
    ...paid.map(t => ({ ...t, estado: 'PAGADO' }))
  ];
  localStorage.setItem('transacciones', JSON.stringify(all));
  renderTransacciones(all);
}

function filtrar() {
  const desde = new Date(document.getElementById('filtroDesde').value || '2000-01-01');
  const hasta = new Date(document.getElementById('filtroHasta').value || '2100-12-31');
  const estado = document.getElementById('filtroEstado').value;
  const usuario = document.getElementById('filtroUsuario').value.toLowerCase();
  
  const data = JSON.parse(localStorage.getItem('transacciones')) || [];
  const fil = data.filter(t => {
    const fecha = new Date(t.date || t.paid_at);
    const usuarioMatch = !usuario || 
                         (t.createdBy && t.createdBy.toLowerCase().includes(usuario)) || 
                         (t.userName && t.userName.toLowerCase().includes(usuario));
    
    return fecha >= desde && 
           fecha <= hasta && 
           (!estado || t.estado === estado) &&
           usuarioMatch;
  });
  
  renderTransacciones(fil);
}

function renderTransacciones(data) {
  const tbody = document.getElementById('transaccionesBody');
  tbody.innerHTML = '';
  data.forEach(t => {
    tbody.innerHTML += `
      <tr>
        <td>${new Date(t.date || t.paid_at).toLocaleString()}</td>
        <td>${t.name}</td>
        <td>${t.amountCLP}</td>
        <td>${t.amountUSD}</td>
        <td>${t.amountBRL || '-'}</td>
        <td>${t.estado}</td>
        <td>${renderCurrency(t)}</td>
        <td>${t.userName || t.createdBy || '-'}</td>
      </tr>`;
  });
}

// Función para mostrar la moneda original de la transacción
function renderCurrency(transaction) {
  if (transaction.originalCurrency === 'USD') {
    return '<span class="badge bg-primary">USD</span>';
  } else {
    return '<span class="badge bg-success">CLP</span>';
  }
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
  } catch (error) {
    console.error('Error al cargar usuarios para filtro', error);
  }
}

document.getElementById('logoutBtn').addEventListener('click', () => {
  location.href = '/';
});

window.addEventListener('DOMContentLoaded', () => {
  cargarUsuarios();
  cargarUsuariosParaFiltro();
});