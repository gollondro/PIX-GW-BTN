// Variable global para la sesión
let session = null;
let currentCurrency = 'CLP';
let debugModeEnabled = false;
let linkTxs = [];

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

// Función para activar/desactivar modo de depuración
function toggleDebugMode() {
  debugModeEnabled = !debugModeEnabled;
  
  const debugConsole = document.getElementById('debugConsole');
  if (!debugConsole) {
    // Si no existe, crear el elemento de consola de depuración
    const newDebugConsole = document.createElement('div');
    newDebugConsole.id = 'debugConsole';
    newDebugConsole.className = 'fixed-bottom bg-dark text-white p-2';
    newDebugConsole.style.maxHeight = '200px';
    newDebugConsole.style.overflowY = 'auto';
    newDebugConsole.style.display = debugModeEnabled ? 'block' : 'none';
    newDebugConsole.innerHTML = '<div id="debugLogs"></div>';
    document.body.appendChild(newDebugConsole);
  } else {
    // Si ya existe, solo cambiar su visibilidad
    debugConsole.style.display = debugModeEnabled ? 'block' : 'none';
  }
  
  // Actualizar aspecto del botón
  const debugBtn = document.getElementById('debugToggleBtn');
  if (debugBtn) {
    debugBtn.classList.toggle('btn-danger', debugModeEnabled);
    debugBtn.classList.toggle('btn-warning', !debugModeEnabled);
  }
  
  // Guardar en localStorage para compartir entre páginas
  localStorage.setItem('debugMode', debugModeEnabled ? 'enabled' : 'disabled');
  
  console.log('Modo depuración ' + (debugModeEnabled ? 'activado' : 'desactivado'));
  debugLog('Modo depuración ' + (debugModeEnabled ? 'activado' : 'desactivado'));
}

// Función para añadir mensajes a la consola de depuración
function debugLog(message, type = 'info') {
  // Siempre enviar al console.log nativo
  if (type === 'error') {
    console.error(message);
  } else {
    console.log(message);
  }
  
  // Si el modo debug está desactivado, no continuamos
  if (!debugModeEnabled) return;
  
  const debugLogs = document.getElementById('debugLogs');
  if (!debugLogs) return;
  
  const entry = document.createElement('div');
  entry.className = type === 'error' ? 'text-danger' : 'text-light';
  const timestamp = new Date().toLocaleTimeString();
  entry.textContent = `[${timestamp}] ${message}`;
  debugLogs.appendChild(entry);
  debugLogs.scrollTop = debugLogs.scrollHeight;
}

// Función para limpiar la consola de depuración
function clearDebugLogs() {
  const debugLogs = document.getElementById('debugLogs');
  if (debugLogs) {
    debugLogs.innerHTML = '';
    debugLog('Consola limpiada');
  }
}

// Función para cambiar el idioma
function setLang(lang) {
  if (!translations[lang]) {
    console.error('Idioma no disponible:', lang);
    debugLog('Idioma no disponible: ' + lang, 'error');
    return;
  }
  
  currentLang = lang;
  console.log('🌐 Cambiando idioma a:', lang);
  debugLog('🌐 Cambiando idioma a: ' + lang);
  
  // Actualizar todos los elementos con clase lang-*
  document.querySelectorAll('[class*="lang-"]').forEach(el => {
    const classes = Array.from(el.classList);
    const langClass = classes.find(c => c.startsWith('lang-'));
    if (langClass) {
      const key = langClass.replace('lang-', '');
      if (translations[lang][key]) {
        el.textContent = translations[lang][key];
      }
    }
  });
  
  // Actualizar etiqueta del campo de monto si estamos en el formulario PIX
  updateAmountLabel();
  
  // Verificar si hay un QR para actualizar su contenido
  const qrResult = document.getElementById('qrResult');
  if (qrResult && qrResult.dataset.qrData) {
    try {
      renderQRContent(JSON.parse(qrResult.dataset.qrData));
    } catch (e) {
      console.error('Error al renderizar QR con nuevo idioma:', e);
      debugLog('Error al renderizar QR con nuevo idioma: ' + e.message, 'error');
    }
  }
}

// Función para renderizar el contenido del QR con traducción
function renderQRContent(data) {
  const qrResult = document.getElementById('qrResult');
  if (!qrResult) {
    console.error('❌ Elemento qrResult no encontrado');
    debugLog('❌ Elemento qrResult no encontrado', 'error');
    return;
  }
  
  const t = translations[currentLang || 'es'];
  
  // Guardar datos para futura traducción
  qrResult.dataset.qrData = JSON.stringify(data);
  
  // Construir HTML basado en el idioma actual
  let html = `<h5 class="mt-3 mb-3">${t.qrTitle}</h5>`;
  
  // Información de pago
  if (data.currency === 'USD') {
    html += `<p><strong>${t.amountLabel}</strong> $${data.amountUSD} USD</p>`;
  } else {
    html += `<p><strong>${t.amountLabel}</strong> $${data.amountCLP} CLP</p>`;
    html += `<p><strong>${t.exchangeRate}</strong> ${data.rateCLPperUSD}</p>`;
    html += `<p><strong>${t.amountLabel} USD:</strong> $${data.amountUSD} USD</p>`;
  }
  
  html += `<p><strong>${t.brazilianTax}</strong> ${data.vetTax}</p>`;
  html += `<p><strong>${t.clientWillPay}</strong> R$ ${data.amountBRL}</p>`;
  
  // Enlace de pago si existe
  if (data.qrData && data.qrData.pixCopyPast) {
    html += `<p><strong>${t.paymentLink}</strong><br>
      <a href="${data.qrData.pixCopyPast}" target="_blank">${data.qrData.pixCopyPast}</a></p>`;
  }
  
  // Imagen QR si existe
  if (data.qrData && data.qrData.qrCodeBase64) {
    // Asegurarse de que la cadena base64 es completa
    console.log('🖼️ Datos QR Base64 recibidos, longitud:', data.qrData.qrCodeBase64.length);
    debugLog('🖼️ Datos QR Base64 recibidos, longitud: ' + data.qrData.qrCodeBase64.length);
    
    html += `<div class="d-flex justify-content-center">
              <img src="data:image/png;base64,${data.qrData.qrCodeBase64}" 
                  alt="QR PIX" class="img-fluid mt-3" 
                  style="max-width: 250px; border: 1px solid #ddd; padding: 10px; background: white;" />
            </div>`;
  } else {
    html += `<p class="text-warning">QR no disponible</p>`;
  }
  
  // Elemento para countdown
  html += `<p id="countdown" class="text-danger fw-bold mt-3"></p>`;
  
  qrResult.innerHTML = html;
  
  // Verificar si la imagen se cargó correctamente
  setTimeout(() => {
    const qrImage = qrResult.querySelector('img');
    if (qrImage) {
      qrImage.onerror = () => {
        console.error('❌ Error al cargar la imagen QR');
        debugLog('❌ Error al cargar la imagen QR', 'error');
        qrImage.style.display = 'none';
        qrResult.insertAdjacentHTML('beforeend', '<p class="text-danger">Error al mostrar la imagen QR</p>');
      };
    }
  }, 100);
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

// Inicialización cuando el DOM está listo
document.addEventListener('DOMContentLoaded', function() {
  console.log('🚀 Inicializando aplicación...');
  debugLog('🚀 Inicializando aplicación...');
  
  // Verificar si el modo depuración estaba activo
  const savedDebugMode = localStorage.getItem('debugMode');
  if (savedDebugMode === 'enabled') {
    debugModeEnabled = true;
    toggleDebugMode();
  }
  
  // Configurar botón de depuración
  const debugBtn = document.getElementById('debugToggleBtn');
  if (debugBtn) {
    debugBtn.addEventListener('click', toggleDebugMode);
  }
  
  // Configurar botón para limpiar logs
  const clearDebugBtn = document.getElementById('clearDebugBtn');
  if (clearDebugBtn) {
    clearDebugBtn.addEventListener('click', function() {
      const debugLogs = document.getElementById('debugLogs');
      if (debugLogs) {
        debugLogs.innerHTML = '';
        debugLog('Consola limpiada');
      }
    });
  }
  
  // Configurar handlers de idioma
  document.querySelectorAll('.lang-flag').forEach(flag => {
    flag.addEventListener('click', function() {
      const lang = this.getAttribute('data-lang');
      if (lang) {
        setLang(lang);
      }
    });
  });
  
  // Referencias a elementos del DOM
  const loginForm = document.getElementById('loginForm');
  const pixContainer = document.getElementById('pixContainer');
  const pixForm = document.getElementById('pixForm');
  const logoutBtn = document.getElementById('logoutBtn');
  const currencySelector = document.getElementById('currencySelector');
  
  // Comprobar que tenemos los elementos necesarios
  if (!loginForm) {
    console.error('❌ Error: loginForm no encontrado');
    debugLog('❌ Error: loginForm no encontrado', 'error');
    return;
  }
  
  if (!pixContainer) {
    console.error('❌ Error: pixContainer no encontrado');
    debugLog('❌ Error: pixContainer no encontrado', 'error');
    return;
  }
  
  if (!pixForm) {
    console.error('❌ Error: pixForm no encontrado');
    debugLog('❌ Error: pixForm no encontrado', 'error');
    return;
  }
  
  if (!logoutBtn) {
    console.error('❌ Error: logoutBtn no encontrado');
    debugLog('❌ Error: logoutBtn no encontrado', 'error');
    return;
  }
  
  // Listener para el formulario de login
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    console.log('📝 Procesando formulario de login...');
    debugLog('📝 Procesando formulario de login...');
    
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;
    
    if (!email || !password) {
      console.error('❌ Email o password vacíos');
      debugLog('❌ Email o password vacíos', 'error');
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
      debugLog(`🔍 Respuesta del servidor: ${res.status}`);
      
      const data = await res.json();
      console.log('📄 Datos recibidos:', data);
      debugLog('📄 Datos recibidos: ' + JSON.stringify(data));
      
      if (data.success) {
        console.log('✅ Login exitoso');
        debugLog('✅ Login exitoso');
        
        // Guardar sesión
        session = data;
        
        // Configurar selector de moneda según permisos del usuario
        if (currencySelector) {
          try {
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
          } catch (error) {
            console.error('❌ Error al configurar selector de moneda:', error);
            debugLog('❌ Error al configurar selector de moneda: ' + error.message, 'error');
          }
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
        debugLog('❌ Login fallido: ' + (data.error || 'Error desconocido'), 'error');
        alert(data.error || 'Credenciales inválidas');
      }
    } catch (error) {
      console.error('❌ Error en la petición:', error);
      debugLog('❌ Error en la petición: ' + error.message, 'error');
      alert('Error de conexión');
    }
  });
  
  // Listener para el formulario PIX
  pixForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    console.log('📝 Procesando formulario PIX...');
    debugLog('📝 Procesando formulario PIX...');
    
    // Validar que haya sesión activa
    if (!session) {
      console.error('❌ No hay sesión activa');
      debugLog('❌ No hay sesión activa', 'error');
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
      debugLog('❌ Campos incompletos', 'error');
      alert('Por favor complete todos los campos');
      return;
    }
    
    // Validar CPF - Omitir esta validación si estamos en modo debug
    if (!debugModeEnabled && !validarCPF(cpf)) {
      console.error('❌ CPF inválido');
      debugLog('❌ CPF inválido', 'error');
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
    //  const transactionId = uuidv4();
  const formData = {
  currency,
  amount,
  name,
  email,
  phone,
  cpf,
  userEmail: session.email
};
      
      // En el servidor, podría esperar amountCLP o amountUSD en lugar de solo 'amount'
      if (currency === 'CLP') {
        formData.amountCLP = amount;
      } else {
        formData.amountUSD = amount;
      }
      
      // Log detallado para depuración
      console.log('📤 Enviando datos:');
      Object.entries(formData).forEach(([key, value]) => {
        console.log(`- ${key}: ${value}`);
      });
      
      debugLog('📤 Enviando datos detallados:');
      Object.entries(formData).forEach(([key, value]) => {
        debugLog(`- ${key}: ${value}`);
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
      debugLog('📥 Estado de la respuesta: ' + response.status);
      
      // Intentar obtener más detalles del error si la respuesta no es exitosa
      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Error detallado:', errorText);
        debugLog('❌ Error detallado: ' + errorText, 'error');
        
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
      debugLog('📥 Respuesta recibida: ' + JSON.stringify(data));
      
      if (data.success) {
        console.log('✅ QR generado exitosamente');
        debugLog('✅ QR generado exitosamente');
        
        // Renderizar el QR y la información
        renderQRContent(data);
        
        // Iniciar contador de tiempo
        startCountdown(data.expiresAt);

        // INICIAR POLLING PARA DETECTAR EL PAGO
        if (data.transactionId) {
          startPollingPago(data.transactionId);
        }
      } else {
        throw new Error(data.error || 'Error al generar el código QR');
      }
    } catch (error) {
      console.error('❌ Error:', error);
      debugLog('❌ Error: ' + error.message, 'error');
      qrResult.innerHTML = `<div class="alert alert-danger">Error: ${error.message}</div>`;
    }
  });
  
  // Listener para cambio de moneda
  const radioButtons = document.querySelectorAll('input[name="currency"]');
  radioButtons.forEach(radio => {
    radio.addEventListener('change', function() {
      currentCurrency = this.value;
      updateAmountLabel();
      console.log(`Moneda cambiada a: ${currentCurrency}`);
      debugLog(`Moneda cambiada a: ${currentCurrency}`);
    });
  });
  
  // Listener para cerrar sesión
  logoutBtn.addEventListener('click', () => {
    console.log('🚪 Cerrando sesión...');
    debugLog('🚪 Cerrando sesión...');
    
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

  const paymentLinkBtn = document.getElementById('generatePaymentLink');
  if (paymentLinkBtn) {
    paymentLinkBtn.addEventListener('click', function() {
      const amountCLP = parseFloat(document.getElementById('amount').value);
      const name = document.getElementById('name').value;
      const email = document.getElementById('emailCliente').value;
      const phone = document.getElementById('phone').value;
      const cpf = document.getElementById('cpf').value;
      let currency = document.querySelector('input[name="currency"]:checked')?.value || 'CLP';
      let amount = amountCLP;

      // Si la moneda es CLP, convertir a USD y enviar USD
      if (currency === 'CLP') {
        // Usa la tasa de cambio que tengas disponible (ejemplo: 945)
        const rateCLPperUSD = 945; // Puedes obtenerla dinámicamente si lo prefieres
        amount = (amountCLP / rateCLPperUSD).toFixed(2);
        currency = 'USD';
      }

      const qrResult = document.getElementById('qrResult');
      qrResult.innerHTML = `
        <div class="d-flex justify-content-center align-items-center" style="height: 80px;">
          <div class="spinner-border text-primary" role="status">
            <span class="visually-hidden">Generando link de pago...</span>
          </div>
        </div>
      `;

      fetch('/api/payment/payment-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount, name, email, phone, cpf, currency })
      })
      .then(response => response.json())
      .then(data => {
        console.log('🔎 Respuesta del backend (link de pago):', data); // <--- AGREGA ESTA LÍNEA

        if (data.id && data.success) {
          qrResult.innerHTML = `
            <div class="alert alert-success">
              Solicitud realizada con éxito.<br>
              ID de la solicitud: <strong>${data.id}</strong><br>
              El cliente recibirá un correo con las instrucciones de pago en <strong>${email}</strong>.
            </div>
          `;

          // Solo agrega transactionId si existe en la respuesta
          linkTxs.push({
            id: data.id,
            transactionId: data.transactionId || null
          });
        } else {
          qrResult.innerHTML = `
            <div class="alert alert-danger">Error al generar la solicitud de link de pago</div>
          `;
          console.error('❌ Error en respuesta de link de pago:', data); // <--- AGREGA ESTA LÍNEA
        }
      })
      .catch((err) => {
        qrResult.innerHTML = `
          <div class="alert alert-danger">Error al generar la solicitud de link de pago</div>
        `;
        console.error('❌ Error en fetch de link de pago:', err); // <--- AGREGA ESTA LÍNEA
      });
    });
  }
  
  console.log('✅ Inicialización completada');
  debugLog('✅ Inicialización completada');
});

// Supón que tienes una función que se llama cuando el usuario genera una cotización:
function manejarRespuestaCotizacion(respuesta, tipoDePago) {
  const transactionId = respuesta.transactionId;

  if (tipoDePago === 'QR') {
    // Mostrar el QR y empezar el polling
    mostrarQR(respuesta.qrData.qrCodeBase64);
    startPollingPago(transactionId);
  } else if (tipoDePago === 'LINK') {
    // Mostrar mensaje de link de pago enviado
    mostrarMensaje('El cliente recibirá el link de pago por email.');
    // No hacer polling
  }
}

function startPollingPago(transactionId) {
  let pollingInterval = setInterval(() => {
    fetch(`/api/payment/status/${transactionId}`)
      .then(res => res.json())
      .then(result => {
        console.log('Polling result:', result);
        if (result.paid) {
          clearInterval(pollingInterval);

          // Reemplaza el contenido del QR
          document.getElementById('qrResult').innerHTML = `
            <div class="alert alert-success text-center">
              <h4>✅ ¡Pago recibido!</h4>
              <p>El pago fue confirmado correctamente.</p>
              <hr>
              <b>Monto:</b> ${result.data.amount} ${result.data.currency}<br>
              <b>Fecha:</b> ${result.data.paid_at || ''}<br>
              <b>Cliente:</b> ${result.data.name || ''}<br>
              <b>Email:</b> ${result.data.email || ''}<br>
            </div>
          `;

          // Mostrar el modal de pago exitoso (Bootstrap 5)
          const modalBody = document.getElementById('pagoExitosoBody');
          if (modalBody) {
            modalBody.innerHTML = `
              <p class="mb-2">El pago fue confirmado correctamente.</p>
              <b>Monto:</b> ${result.data.amount} ${result.data.currency}<br>
              <b>Fecha:</b> ${result.data.paid_at || ''}<br>
              <b>Cliente:</b> ${result.data.name || ''}<br>
              <b>Email:</b> ${result.data.email || ''}<br>
            `;
            const modal = new bootstrap.Modal(document.getElementById('pagoExitosoModal'));
            modal.show();
          }
        }
      });
  }, 3000);
}

const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString(); // 5 minutos