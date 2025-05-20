let session = null;

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

// Manejo del formulario de login
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
        formTitle.innerText = 'Generar cobro con PIX';
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
    formTitle.innerText = 'Iniciar sesión';
  });
  
  // Manejo del formulario PIX
  pixForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    // Validaciones
    const amountCLP = document.getElementById('amountCLP').value;
    const name = document.getElementById('name').value;
    const email = document.getElementById('emailCliente').value;
    const phone = document.getElementById('phone').value;
    const cpf = document.getElementById('cpf').value;
    
    if (!amountCLP || !name || !email || !phone || !cpf) {
      showMessage('Por favor, complete todos los campos');
      return;
    }
    
    if (!validarCPF(cpf)) {
      showMessage("CPF inválido");
      return;
    }
    
    // Verificar sesión activa
    if (!session) {
      showMessage('Su sesión ha expirado. Por favor, inicie sesión nuevamente.');
      pixContainer.style.display = 'none';
      loginForm.style.display = 'block';
      return;
    }
    
    const btn = e.submitter;
    const originalText = btn.innerText;
    btn.disabled = true;
    btn.innerText = 'Procesando...';
    
    try {
      const data = {
        amountCLP,
        customer: { name, email, phone, cpf }
      };
      
      console.log('Enviando solicitud de pago:', data);
      console.log('Headers:', {
        'X-Renpix-Email': session.renpix_email,
        'X-Renpix-Password': '*****',
        'X-Renpix-Merchant': session.merchant_id
      });
      
      const res = await fetch('/api/payment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Renpix-Email': session.renpix_email,
          'X-Renpix-Password': session.renpix_password,
          'X-Renpix-Merchant': session.merchant_id
        },
        body: JSON.stringify(data)
      });
      
      console.log('Respuesta recibida, status:', res.status);
      const result = await res.json();
      console.log('Datos de respuesta:', result);
      
      if (result.success) {
        let countdown = 300;
        const txId = result.transactionId;
        let pagoConfirmado = false;
        
        const qrResult = document.getElementById('qrResult');
        qrResult.innerHTML = `
          <p id="countdown" class="text-danger fw-bold"></p>
          <p><strong>Monto en USD:</strong> $${result.amountUSD}</p>
          <p><strong>Tasa USD → CLP:</strong> ${result.rateCLPperUSD}</p>
          <p><strong>Tasa USD → BRL (vet):</strong> ${result.vetTax}</p>
          <p><strong>Valor que pagará el cliente en BRL:</strong> R$ ${result.amountBRL}</p>
        `;
        
        // Verificar y mostrar enlace PIX si existe
        if (result.qrData && result.qrData.pixCopyPast) {
          qrResult.innerHTML += `
            <p><strong>Enlace de pago:</strong><br>
            <a href="${result.qrData.pixCopyPast}" target="_blank">${result.qrData.pixCopyPast}</a></p>
          `;
        }
        
        // Verificar y mostrar código QR si existe
        if (result.qrData && result.qrData.qrCodeBase64) {
          qrResult.innerHTML += `
            <img src="data:image/png;base64,${result.qrData.qrCodeBase64}" 
                 alt="QR PIX" class="img-fluid mt-3" />
          `;
        } else {
          qrResult.innerHTML += `<p class="text-warning">QR no disponible</p>`;
        }
        
        const countdownEl = document.getElementById('countdown');
        
        const interval = setInterval(() => {
          if (pagoConfirmado) {
            clearInterval(interval);
            return;
          }
          if (countdown <= 0) {
            clearInterval(interval);
            clearInterval(pollInterval);
            qrResult.innerHTML = '<p class="text-warning">⚠️ El código QR ha expirado.</p>';
          } else {
            const minutes = Math.floor(countdown / 60);
            const seconds = countdown % 60;
            countdownEl.innerText = `⏳ Tiempo restante: ${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
            countdown--;
          }
        }, 1000);
        
        const pollInterval = setInterval(async () => {
          try {
            const paid = await fetch('/api/paid').then(r => r.json());
            const match = paid.find(p => p.id === txId);
            if (match) {
              pagoConfirmado = true;
              clearInterval(interval);
              clearInterval(pollInterval);
              qrResult.innerHTML = `
                <div class="alert alert-success"><strong>✅ Pago recibido</strong><br>
                  Monto pagado: USD ${match.amountUSD}<br>
                  Cliente: ${match.name}<br>
                  Fecha: ${new Date(match.paid_at).toLocaleString()}
                </div>
              `;
            }
          } catch (error) {
            console.error("Error al verificar pagos:", error);
          }
        }, 10000);
      } else {
        showMessage(result.error || 'Error desconocido', 'danger');
      }
    } catch (error) {
      console.error("Error en la solicitud:", error);
      showMessage('Error de conexión: ' + error.message, 'danger');
    } finally {
      btn.disabled = false;
      btn.innerText = originalText;
    }
  });
});