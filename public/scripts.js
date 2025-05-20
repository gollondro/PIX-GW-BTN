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

// Función para mostrar mensajes de error/éxito
function showMessage(message, type = 'danger') {
  // Crear div para mensaje si no existe
  let msgContainer = document.getElementById('messageContainer');
  if (!msgContainer) {
    msgContainer = document.createElement('div');
    msgContainer.id = 'messageContainer';
    msgContainer.className = 'mt-3';
    document.querySelector('.card-body').prepend(msgContainer);
  }
  
  const alert = document.createElement('div');
  alert.className = `alert alert-${type} alert-dismissible fade show`;
  alert.innerHTML = `
    ${message}
    <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
  `;
  
  msgContainer.innerHTML = '';
  msgContainer.appendChild(alert);
  
  // Auto-ocultar después de 5 segundos
  setTimeout(() => {
    alert.classList.remove('show');
    setTimeout(() => alert.remove(), 150);
  }, 5000);
}

// Actualizar etiqueta de monto según moneda seleccionada
function updateAmountLabel() {
  const amountLabel = document.getElementById('amountLabel');
  if (amountLabel) {
    const lang = window.currentLang ? window.currentLang() : 'es';
    const translations = {
      'es': { 'CLP': 'Monto en CLP', 'USD': 'Monto en USD' },
      'en': { 'CLP': 'Amount in CLP', 'USD': 'Amount in USD' },
      'pt': { 'CLP': 'Valor em CLP', 'USD': 'Valor em USD' }
    };
    amountLabel.innerText = translations[lang][currentCurrency] || `Monto en ${currentCurrency}`;
  }
}

// Función para inicializar el selector de moneda según los permisos del usuario
function initCurrencySelector() {
  const currencySelector = document.getElementById('currencySelector');
  if (!currencySelector) return;
  
  if (!session) {
    currencySelector.style.display = 'none';
    return;
  }
  
  // Mostrar u ocultar el selector según las preferencias del usuario
  if (session.allowCLP && session.allowUSD) {
    currencySelector.style.display = 'block';
  } else if (session.allowCLP) {
    currencySelector.style.display = 'none';
    currentCurrency = 'CLP';
  } else if (session.allowUSD) {
    currencySelector.style.display = 'none';
    currentCurrency = 'USD';
  } else {
    currencySelector.style.display = 'none';
    currentCurrency = 'CLP'; // Valor por defecto
  }
  
  // Actualizar la etiqueta del monto
  updateAmountLabel();
  
  // Establecer el valor inicial de los botones de radio
  const radioCLP = document.getElementById('currencyCLP');
  const radioUSD = document.getElementById('currencyUSD');
  
  if (radioCLP && radioUSD) {
    if (currentCurrency === 'CLP') {
      radioCLP.checked = true;
      radioUSD.checked = false;
    } else {
      radioCLP.checked = false;
      radioUSD.checked = true;
    }
    
    // Añadir event listeners para actualizar la etiqueta
    radioCLP.addEventListener('change', function() {
      if (this.checked) {
        currentCurrency = 'CLP';
        updateAmountLabel();
      }
    });
    
    radioUSD.addEventListener('change', function() {
      if (this.checked) {
        currentCurrency = 'USD';
        updateAmountLabel();
      }
    });
  }
}

// Inicializar la aplicación cuando el DOM esté cargado
document.addEventListener('DOMContentLoaded', function() {
  // Verificar que existan los elementos necesarios
  const loginForm = document.getElementById('loginForm');
  const pixContainer = document.getElementById('pixContainer');
  const pixForm = document.getElementById('pixForm');
  const logoutBtn = document.getElementById('logoutBtn');
  const formTitle = document.getElementById('formTitle');
  
  if (!loginForm || !pixContainer || !pixForm || !logoutBtn || !formTitle) {
    console.error('Error: Elementos HTML requeridos no encontrados.');
    return;
  }
  
  // Manejo del formulario de login
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;
    
    // Validación básica
    if (!email || !password) {
      showMessage('Por favor, complete todos los campos');
      return;
    }
    
    // Deshabilitar el botón durante la petición
    const submitBtn = loginForm.querySelector('button[type="submit"]');
    const originalText = submitBtn.innerText;
    submitBtn.disabled = true;
    submitBtn.innerText = 'Procesando...';
    
    try {
      console.log('Enviando solicitud de login...');
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      
      console.log('Respuesta recibida, status:', res.status);
      const data = await res.json();
      console.log('Datos de respuesta:', data);
      
      if (data.success) {
        console.log('Login exitoso');
        session = data;
        loginForm.style.display = 'none';
        pixContainer.style.display = 'block';
        
        const lang = window.currentLang ? window.currentLang() : 'es';
        const translations = {
          'es': 'Generar cobro con PIX',
          'en': 'Generate PIX payment',
          'pt': 'Gerar cobrança PIX'
        };
        formTitle.innerText = translations[lang] || 'Generar cobro con PIX';
        
        // Inicializar el selector de moneda
        initCurrencySelector();
      } else {
        console.log('Login fallido');
        showMessage(data.error || 'Credenciales inválidas');
      }
    } catch (error) {
      console.error("Error en login:", error);
      showMessage('Error de conexión al intentar iniciar sesión');
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerText = originalText;
    }
  });
  
  // Manejo del logout
  logoutBtn.addEventListener('click', () => {
    session = null;
    pixForm.reset();
    loginForm.reset();
    pixContainer.style.display = 'none';
    loginForm.style.display = 'block';
    document.getElementById('qrResult').innerHTML = '';
    
    const lang = window.currentLang ? window.currentLang() : 'es';
    const translations = {
      'es': 'Iniciar sesión',
      'en': 'Login',
      'pt': 'Entrar'
    };
    formTitle.innerText = translations[lang] || 'Iniciar sesión';
  });
  
  // Manejo del formulario PIX
  pixForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    // Validaciones
    const amount = document.getElementById('amount').value;
    const name = document.getElementById('name').value;
    const email = document.getElementById('emailCliente').value;