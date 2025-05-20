// Variable global para la sesión
let session = null;
let currentCurrency = 'CLP';

// Función de validación de CPF brasileño
function validarCPF(cpf) {
  cpf = cpf.replace(/[^\d]+/g,'');
  if (cpf.length !== 11 || /^(\d)\1+$/.test(cpf)) return false;
  let sum = 0, rest;
  for (let i = 1; i <= 9; i++) sum += parseInt(cpf.substring(i-1, i)) * (11 - i);
  rest = (sum * 10) % 11;
  if ((rest === 10) || (rest === 11)) rest = 0;
  if (rest !== parseInt(cpf.substring(9, 10))) return false;
  sum = 0;
  for (let i = 1; i <= 10; i++) sum += parseInt(cpf.substring(i-1, i)) * (12 - i);
  rest = (sum * 10) % 11;
  if ((rest === 10) || (rest === 11)) rest = 0;
  return rest === parseInt(cpf.substring(10, 11));
}

// Función para activar modo de depuración
function enableDebugMode() {
  const debugConsole = document.createElement('div');
  debugConsole.id = 'debugConsole';
  debugConsole.className = 'fixed-bottom bg-dark text-white p-2';
  debugConsole.style.maxHeight = '200px';
  debugConsole.style.overflowY = 'auto';
  debugConsole.innerHTML = '<div id="debugLogs"></div>';
  document.body.appendChild(debugConsole);
  
  const originalConsoleLog = console.log;
  const originalConsoleError = console.error;
  
  console.log = function() {
    const args = Array.from(arguments);
    originalConsoleLog.apply(console, args);
    appendToDebugConsole('LOG', args);
  };
  
  console.error = function() {
    const args = Array.from(arguments);
    originalConsoleError.apply(console, args);
    appendToDebugConsole('ERROR', args);
  };
  
  function appendToDebugConsole(type, args) {
    const debugLogs = document.getElementById('debugLogs');
    if (!debugLogs) return;
    
    const entry = document.createElement('div');
    entry.className = type === 'ERROR' ? 'text-danger' : 'text-light';
    entry.textContent = `[${type}] ${args.map(a => typeof a === 'object' ? JSON.stringify(a) : a).join(' ')}`;
    debugLogs.appendChild(entry);
    debugLogs.scrollTop = debugLogs.scrollHeight;
  }
  
  console.log('🐞 Modo de depuración activado');
}

// Activar modo de depuración inmediatamente
enableDebugMode();

// Inicialización cuando el DOM está listo
document.addEventListener('DOMContentLoaded', function() {
  console.log('🚀 Inicializando aplicación...');
  
  // Referencias a elementos del DOM
  const loginForm = document.getElementById('loginForm');
  const pixContainer = document.getElementById('pixContainer');
  const pixForm = document.getElementById('pixForm');
  const logoutBtn = document.getElementById('logoutBtn');
  
  // Comprobar que tenemos los elementos necesarios
  if (!loginForm) {
    console.error('❌ Error: loginForm no encontrado');
    return;
  }
  
  if (!pixContainer) {
    console.error('❌ Error: pixContainer no encontrado');
    return;
  }
  
  if (!pixForm) {
    console.error('❌ Error: pixForm no encontrado');
    return;
  }
  
  if (!logoutBtn) {
    console.error('❌ Error: logoutBtn no encontrado');
    return;
  }
  
  // Listener para el formulario de login
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    console.log('📝 Procesando formulario de login...');
    
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;
    
    if (!email || !password) {
      console.error('❌ Email o password vacíos');
      alert('Por favor, complete todos los campos');
      return;
    }
    
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      
      console.log(`🔍 Respuesta del servidor: ${res.status}`);
      
      const data = await res.json();
      console.log('📄 Datos recibidos:', data);
      
      if (data.success) {
        console.log('✅ Login exitoso');
        
        // Guardar sesión
        session = data;
        
        // Mostrar formulario de PIX y ocultar login
        loginForm.style.display = 'none';
        pixContainer.style.display = 'block';
        
        // Actualizar título (si existe)
        const formTitle = document.getElementById('formTitle');
        if (formTitle) {
          formTitle.innerText = 'Generar cobro con PIX';
        }
      } else {
        console.error('❌ Login fallido:', data.error);
        alert(data.error || 'Credenciales inválidas');
      }
    } catch (error) {
      console.error('❌ Error en la petición:', error);
      alert('Error de conexión');
    }
  });
  
  // Listener para cerrar sesión
  logoutBtn.addEventListener('click', () => {
    console.log('🚪 Cerrando sesión...');
    
    session = null;
    
    // Restablecer formularios
    pixForm.reset();
    loginForm.reset();
    
    // Mostrar login y ocultar PIX
    pixContainer.style.display = 'none';
    loginForm.style.display = 'block';
    
    // Limpiar resultados
    const qrResult = document.getElementById('qrResult');
    if (qrResult) {
      qrResult.innerHTML = '';
    }
    
    // Actualizar título (si existe)
    const formTitle = document.getElementById('formTitle');
    if (formTitle) {
      formTitle.innerText = 'Iniciar sesión';
    }
  });
  
  // Listener para el formulario PIX (simplificado)
  pixForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    console.log('📝 Procesando formulario PIX...');
    
    // Validar que haya sesión activa
    if (!session) {
      console.error('❌ No hay sesión activa');
      alert('Su sesión ha expirado. Por favor, inicie sesión nuevamente.');
      pixContainer.style.display = 'none';
      loginForm.style.display = 'block';
      return;
    }
    
    // Validar los campos del formulario
    const amountField = document.getElementById('amount') || document.getElementById('amountCLP');
    if (!amountField) {
      console.error('❌ Campo de monto no encontrado');
      alert('Error en el formulario');
      return;
    }
    
    const nameField = document.getElementById('name');
    const emailField = document.getElementById('emailCliente');
    const phoneField = document.getElementById('phone');
    const cpfField = document.getElementById('cpf');
    
    if (!nameField || !emailField || !phoneField || !cpfField) {
      console.error('❌ Campos del formulario no encontrados');
      alert('Error en el formulario');
      return;
    }
    
    // Esta vez, solo mostramos un mensaje en lugar de procesar el pago
    // para aislar la funcionalidad de login
    alert('Formulario enviado correctamente. La funcionalidad de pago se ha desactivado temporalmente para solucionar el problema de login.');
  });
  
  console.log('✅ Inicialización completada');
});