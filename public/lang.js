const translations = {
  es: {
    email: "Email",
    password: "Contraseña",
    loginBtn: "Entrar",
    amount: "Monto",
    amountCLP: "Monto en CLP",
    amountUSD: "Monto en USD",
    name: "Nombre",
    clientEmail: "Email",
    phone: "Teléfono",
    cpf: "CPF",
    generateBtn: "Generar QR",
    logout: "Cerrar sesión",
    currency: "Moneda",
    qrTitle: "Detalles del pago con PIX",
    amountLabel: "Monto:",
    exchangeRate: "Tasa de cambio:",
    brazilianTax: "Tasa Brasil (vet):",
    clientWillPay: "El cliente pagará en BRL:",
    paymentLink: "Enlace de pago:",
    countdown: "Tiempo restante:",
    qrExpired: "⚠️ El código QR ha expirado.",
    paymentReceived: "✅ Pago recibido",
    amountPaid: "Monto pagado:",
    client: "Cliente:",
    date: "Fecha:"
  },
  en: {
    email: "Email",
    password: "Password",
    loginBtn: "Login",
    amount: "Amount",
    amountCLP: "Amount in CLP",
    amountUSD: "Amount in USD",
    name: "Name",
    clientEmail: "Email",
    phone: "Phone",
    cpf: "CPF",
    generateBtn: "Generate QR",
    logout: "Logout",
    currency: "Currency",
    qrTitle: "PIX Payment Details",
    amountLabel: "Amount:",
    exchangeRate: "Exchange rate:",
    brazilianTax: "Brazil rate (vet):",
    clientWillPay: "Client will pay in BRL:",
    paymentLink: "Payment link:",
    countdown: "Time remaining:",
    qrExpired: "⚠️ QR code has expired.",
    paymentReceived: "✅ Payment received",
    amountPaid: "Amount paid:",
    client: "Client:",
    date: "Date:"
  },
  pt: {
    email: "Email",
    password: "Senha",
    loginBtn: "Entrar",
    amount: "Valor",
    amountCLP: "Valor em CLP",
    amountUSD: "Valor em USD",
    name: "Nome",
    clientEmail: "Email",
    phone: "Telefone",
    cpf: "CPF",
    generateBtn: "Gerar QR",
    logout: "Sair",
    currency: "Moeda",
    qrTitle: "Detalhes do pagamento PIX",
    amountLabel: "Valor:",
    exchangeRate: "Taxa de câmbio:",
    brazilianTax: "Taxa Brasil (vet):",
    clientWillPay: "O cliente pagará em BRL:",
    paymentLink: "Link de pagamento:",
    countdown: "Tempo restante:",
    qrExpired: "⚠️ O código QR expirou.",
    paymentReceived: "✅ Pagamento recebido",
    amountPaid: "Valor pago:",
    client: "Cliente:",
    date: "Data:"
  }
};

// Variable global para el idioma actual
let currentLang = localStorage.getItem('lang') || 'es';

// Función para cambiar el idioma de la aplicación
function setLang(lang) {
  if (!translations[lang]) {
    console.error(`Idioma no soportado: ${lang}`);
    return;
  }
  
  currentLang = lang;
  localStorage.setItem('lang', lang);
  
  // Actualizar todos los elementos con clase lang-*
  Object.keys(translations[lang]).forEach(key => {
    const elements = document.querySelectorAll(`.lang-${key}`);
    elements.forEach(element => {
      if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
        element.placeholder = translations[lang][key];
      } else {
        element.innerText = translations[lang][key];
      }
    });
  });
  
  // Actualizar elementos específicos que podrían necesitar tratamiento especial
  const formTitle = document.getElementById('formTitle');
  if (formTitle) {
    // Si estamos en el formulario de login o de cotización
    if (document.getElementById('loginForm').style.display !== 'none') {
      formTitle.innerText = translations[lang].loginBtn;
    } else {
      formTitle.innerText = translations[lang].qrTitle;
    }
  }
  
  // Actualizar contenido del QR si existe
  updateQRContent();
}

// Función para actualizar el contenido del QR con el idioma actual
function updateQRContent() {
  const qrResult = document.getElementById('qrResult');
  if (!qrResult || qrResult.innerHTML === '' || !qrResult.dataset.qrData) {
    return;
  }
  
  try {
    const qrData = JSON.parse(qrResult.dataset.qrData);
    renderQRContent(qrData);
  } catch (error) {
    console.error('Error al actualizar el contenido del QR:', error);
  }
}

// Función para renderizar el contenido del QR con traducción
function renderQRContent(data) {
  const qrResult = document.getElementById('qrResult');
  const t = translations[currentLang];
  
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
    html += `<p><strong>${t.amountLabel}</strong> $${data.amountUSD} USD</p>`;
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
    html += `<img src="data:image/png;base64,${data.qrData.qrCodeBase64}" 
             alt="QR PIX" class="img-fluid mt-3" />`;
  } else {
    html += `<p class="text-warning">QR no disponible</p>`;
  }
  
  // Elemento para countdown
  html += `<p id="countdown" class="text-danger fw-bold mt-3"></p>`;
  
  qrResult.innerHTML = html;
}

// Manejar eventos de cambio de idioma cuando se hace clic en las banderas
document.addEventListener('DOMContentLoaded', function() {
  const flags = document.querySelectorAll('.lang-flag');
  flags.forEach(flag => {
    flag.addEventListener('click', function() {
      const lang = this.getAttribute('data-lang');
      setLang(lang);
    });
  });
  
  // Aplicar el idioma inicial
  setLang(currentLang);
});

// Exportar funciones para uso externo
window.setLang = setLang;
window.currentLang = () => currentLang;
window.renderQRContent = renderQRContent;