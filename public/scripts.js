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
  const debugConsole = document.getElementById('debugConsole');
  if (debugConsole) {
    debugConsole.style.display = 'block';
  } else {
    const newDebugConsole = document.createElement('div');
    newDebugConsole.id = 'debugConsole';
    newDebugConsole.className = 'fixed-bottom bg-dark text-white p-2';
    newDebugConsole.style.maxHeight = '200px';
    newDebugConsole.style.overflowY = 'auto';
    newDebugConsole.innerHTML = '<div id="debugLogs"></div>';
    document.body.appendChild(newDebugConsole);
  }
  
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

// Función para iniciar el contador regresivo
function startCountdown(expiresAt) {
  if (!expiresAt) return;
  
  const countdownEl = document.getElementById('countdown');
  if (!countdownEl) return;
  
  const expiryTime = new Date(expiresAt).getTime();
  
  // Limpiar cualquier intervalo anterior
  if (window.countdownInterval) {
    clearInterval(window.countdownInterval);
  }
  
  // Actualizar cada segundo
  window.countdownInterval = setInterval(() => {
    const now = new Date().getTime();
    const timeLeft = expiryTime - now;
    
    if (timeLeft <= 0) {
      clearInterval(window.countdownInterval);
      countdownEl.innerHTML = translations[currentLang || 'es'].qrExpired;
      return;
    }
    
    // Calcular minutos y segundos
    const minutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((timeLeft % (1000 * 60)) / 1000);
    
    // Mostrar tiempo restante
    countdownEl.innerHTML = `${translations[currentLang || 'es'].countdown} ${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
  }, 1000);
}

// Inicialización cuando el DOM está listo
document.addEventListener('DOMContentLoaded', function() {
  console.log('🚀 Inicializando aplicación...');
  
  // Referencias a elementos del DOM
  const loginForm = document.getElementById('loginForm');
  const pixContainer = document.getElementById('pixContainer');
  const pixForm = document.getElementById('pixForm');
  const logoutBtn = document.getElementById('logoutBtn');
  const currencySelector = document.getElementById('currencySelector');
  
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
  
  // Activar modo de depuración desde el principio
  enableDebugMode();
  
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
        
        // Configurar selector de moneda según permisos del usuario
        if (currencySelector) {
          const showCurrencySelector = (data.allowCLP && data.allowUSD);
          currencySelector.style.display = showCurrencySelector ? 'block' : 'none';
          
          // Establecer moneda por defecto según el usuario
          currentCurrency = data.defaultCurrency || 'CLP';
          
          // Actualizar radio buttons
          const currencyCLP = document.getElementById('currencyCLP');
          const currencyUSD = document.getElementById('currencyUSD');
          
          if (currencyCLP && currencyUSD) {
            if (currentCurrency === 'USD') {
              currencyUSD.checked = true;
              currencyCLP.checked = false;
            } else {
              currencyCLP.checked = true;
              currencyUSD.checked = false;
            }
            
            // Deshabilitar opciones no permitidas
            currencyCLP.disabled = !data.allowCLP;
            currencyUSD.disabled = !data.allowUSD;
          }
          
          // Actualizar etiqueta del campo de monto
          updateAmountLabel();
        }
        
        // Mostrar formulario de PIX y ocultar login
        loginForm.style.display = 'none';
        pixContainer.style.display = 'block';
        
        // Actualizar título (si existe)
        const formTitle = document.getElementById('formTitle');
        if (formTitle) {
          formTitle.innerText = translations[currentLang || 'es'].qrTitle;
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
  
  // Listener para cambio de moneda
  const radioButtons = document.querySelectorAll('input[name="currency"]');
  radioButtons.forEach(radio => {
    radio.addEventListener('change', function() {
      currentCurrency = this.value;
      updateAmountLabel();
    });
  });
  
  // Función para actualizar la etiqueta del campo de monto
  function updateAmountLabel() {
    const amountLabel = document.getElementById('amountLabel');
    if (amountLabel) {
      if (currentCurrency === 'USD') {
        amountLabel.textContent = translations[currentLang || 'es'].amountUSD;
      } else {
        amountLabel.textContent = translations[currentLang || 'es'].amountCLP;
      }
    }
  }
  
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
      formTitle.innerText = translations[currentLang || 'es'].loginBtn;
    }
  });
  
  // Listener para el formulario PIX
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
    
    // Obtener y validar los valores del formulario
    const amount = document.getElementById('amount').value;
    const name = document.getElementById('name').value;
    const email = document.getElementById('emailCliente').value;
    const phone = document.getElementById('phone').value;
    const cpf = document.getElementById('cpf').value;
    
    if (!amount || !name || !email || !phone || !cpf) {
      console.error('❌ Campos incompletos');
      alert('Por favor complete todos los campos');
      return;
    }
    
    // Validar CPF
    if (!validarCPF(cpf)) {
      console.error('❌ CPF inválido');
      alert('El CPF ingresado no es válido');
      return;
    }
    
    // Mostrar indicador de carga
    const qrResult = document.getElementById('qrResult');
    qrResult.innerHTML = '<div class="spinner-border text-afex" role="status"><span class="visually-hidden">Cargando...</span></div><p class="mt-2">Generando código QR...</p>';
    
    try {
      // Determinar la moneda actual
      const currency = document.querySelector('input[name="currency"]:checked')?.value || currentCurrency || 'CLP';
      
      // Preparar los datos a enviar
      const formData = {
        currency,
        amount,
        name,
        email,
        phone,
        cpf
      };
      
      // En el servidor, podría esperar amountCLP o amountUSD en lugar de solo 'amount'
      if (currency === 'CLP') {
        formData.amountCLP = amount;
      } else {
        formData.amountUSD = amount;
      }
      
      // Log detallado para depuración
      console.log('📤 Enviando datos detallados:');
      Object.entries(formData).forEach(([key, value]) => {
        console.log(`- ${key}: ${value}`);
      });
      
      // Enviar solicitud al servidor con mejor manejo de errores
      const response = await fetch('/api/payment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      });
      
      console.log('📥 Estado de la respuesta:', response.status);
      
      // Intentar obtener más detalles del error si la respuesta no es exitosa
      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Error detallado:', errorText);
        
        let errorMessage;
        try {
          // Intentar parsear como JSON si es posible
          const errorJson = JSON.parse(errorText);
          errorMessage = errorJson.error || errorJson.message || `Error del servidor: ${response.status}`;
        } catch {
          // Si no es JSON, usar el texto directamente
          errorMessage = errorText || `Error del servidor: ${response.status}`;
        }
        
        throw new Error(errorMessage);
      }
      
      const data = await response.json();
      console.log('📥 Respuesta recibida:', data);
      
      if (data.success) {
        console.log('✅ QR generado exitosamente');
        
        // Renderizar el QR y la información
        renderQRContent(data);
        
        // Iniciar contador de tiempo
        startCountdown(data.expiresAt);
      } else {
        throw new Error(data.error || 'Error al generar el código QR');
      }
    } catch (error) {
      console.error('❌ Error:', error);
      qrResult.innerHTML = `<div class="alert alert-danger">Error: ${error.message}</div>`;
    }
  });
  
  console.log('✅ Inicialización completada');
});