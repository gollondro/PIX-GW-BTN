async function cargarUsuarios() {
  const res = await fetch('/api/users');
  const data = await res.json();
  const tbody = document.getElementById('usuariosBody');
  tbody.innerHTML = '';
  data.forEach((u, i) => {
    tbody.innerHTML += `
      <tr>
        <td>${u.email}</td>
        <td>${u.merchant_id}</td>
        <td>${u.ventaTiendaActiva ? '✅' : ''}</td>
        <td>
          <button class="btn btn-sm btn-warning" onclick="editarUsuario(${i})">✏️</button>
          <button class="btn btn-sm btn-danger" onclick="eliminarUsuario(${i})">🗑️</button>
        </td>
      </tr>`;
  });
  localStorage.setItem('usuarios', JSON.stringify(data));
}

function editarUsuario(i) {
  const data = JSON.parse(localStorage.getItem('usuarios'))[i];
  document.getElementById('usuarioIdx').value = i;
  document.getElementById('userEmail').value = data.email;
  document.getElementById('userPass').value = data.password;
  document.getElementById('userMerchant').value = data.merchant_id;
  document.getElementById('userTiendaActiva').checked = data.ventaTiendaActiva;
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
    password: document.getElementById('userPass').value,
    merchant_id: document.getElementById('userMerchant').value,
    ventaTiendaActiva: document.getElementById('userTiendaActiva').checked
  };
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
  const all = [...pending.map(t => ({ ...t, estado: 'PENDIENTE' })), ...paid.map(t => ({ ...t, estado: 'PAGADO' }))];
  localStorage.setItem('transacciones', JSON.stringify(all));
  renderTransacciones(all);
}

function filtrar() {
  const desde = new Date(document.getElementById('filtroDesde').value || '2000-01-01');
  const hasta = new Date(document.getElementById('filtroHasta').value || '2100-12-31');
  const estado = document.getElementById('filtroEstado').value;
  const data = JSON.parse(localStorage.getItem('transacciones')) || [];
  const fil = data.filter(t => {
    const fecha = new Date(t.date || t.paid_at);
    return fecha >= desde && fecha <= hasta && (!estado || t.estado === estado);
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
      </tr>`;
  });
}

document.getElementById('logoutBtn').addEventListener('click', () => {
  location.href = '/';
});

window.addEventListener('DOMContentLoaded', () => {
  cargarUsuarios();
});