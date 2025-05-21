// Script de arreglo para PIX Gateway
console.log('🛠️ Script de arreglo cargado');

// Ejecutar cuando el DOM esté completamente cargado
document.addEventListener('DOMContentLoaded', function() {
  console.log('DOM cargado, aplicando arreglos');
  
  // Arreglo para el botón de debug
  fixDebugButton();
  
  // Arreglo para el formulario de login
  fixLoginForm();
});

// Arreglo para el botón de debug
function fixDebugButton() {
  const debugBtn = document.getElementById('debugToggleBtn');
  if (!debugBtn) {
    console.error('Botón de debug no encontrado');
    return;
  }
  
  console.log('Asignando evento al botón de debug');
  debugBtn.addEventListener('click', function() {
    console.log('Botón debug clickeado');
    let debugConsole = document.getElementById('debugConsole');
    if (debugConsole) {
      debugConsole.style.display = debugConsole.style.display === 'none' ? 'block' : 'none';
    }
  });
}

// Arreglo para el formulario de login
function fixLoginForm() {
  const loginForm = document.getElementById('loginForm');
  if (!loginForm) {
    console.error('Formulario de login no encontrado');
    return;
  }
  
  console.log('Asignando evento al formulario de login');
  loginForm.addEventListener('submit', async function(e) {
    e.preventDefault();
    console.log('Formulario de login enviado');
    
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;
    
    if (!email || !password) {
      alert('Por favor, complete todos los campos');
      return;
    }
    
    try {
      console.log('Enviando petición de login');
      const response = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      
      console.log('Respuesta recibida:', response.status);
      const data = await response.json();
      console.log('Datos:', data);
      
      if (data.success) {
        console.log('Login exitoso, mostrando interfaz PIX');
        
        // Guardar sesión (variable global)
        window.session = data;
        
        // Mostrar formulario PIX y ocultar login
        loginForm.style.display = 'none';
        const pixContainer = document.getElementById('pixContainer');
        if (pixContainer) {
          pixContainer.style.display = 'block';
        } else {
          console.error('Container PIX no encontrado');
        }
        
        // Actualizar título si existe
        const formTitle = document.getElementById('formTitle');
        if (formTitle) {
          formTitle.innerText = 'Pago con PIX';
        }
      } else {
        alert('Error: ' + (data.error || 'Credenciales inválidas'));
      }
    } catch (error) {
      console.error('Error en fetch:', error);
      alert('Error de conexión: ' + error.message);
    }
  });
}