// Función para renderizar el contenido del QR con traducción
function renderQRContent(data) {
  const qrResult = document.getElementById('qrResult');
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
        qrImage.style.display = 'none';
        qrResult.insertAdjacentHTML('beforeend', '<p class="text-danger">Error al mostrar la imagen QR</p>');
      };
    }
  }, 100);
}