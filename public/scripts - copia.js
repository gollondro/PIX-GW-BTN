let session = null;

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

document.getElementById('loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = document.getElementById('loginEmail').value;
  const password = document.getElementById('loginPassword').value;

  const res = await fetch('/api/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });

  const data = await res.json();
  if (data.success) {
    session = data;
    document.getElementById('loginForm').style.display = 'none';
    document.getElementById('pixContainer').style.display = 'block';
    document.getElementById('formTitle').innerText = 'Generar cobro con PIX';
  } else {
    alert('Credenciales inválidas');
  }
});

document.getElementById('logoutBtn').addEventListener('click', () => {
  session = null;
  document.getElementById('pixForm').reset();
  document.getElementById('loginForm').reset();
  document.getElementById('pixContainer').style.display = 'none';
  document.getElementById('loginForm').style.display = 'block';
  document.getElementById('qrResult').innerHTML = '';
  document.getElementById('formTitle').innerText = 'Iniciar sesión';
});

document.getElementById('pixForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const cpf = document.getElementById('cpf').value;
  if (!validarCPF(cpf)) {
    alert("CPF inválido");
    return;
  }

  const btn = e.submitter;
  btn.disabled = true;
  btn.innerText = 'Procesando...';

  const data = {
    amountCLP: document.getElementById('amountCLP').value,
    customer: {
      name: document.getElementById('name').value,
      email: document.getElementById('emailCliente').value,
      phone: document.getElementById('phone').value,
      cpf: cpf
    }
  };

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

/*  const result = await res.json();
  if (result.success) {
    let countdown = 300;
    const txId = result.transactionId;
    let pagoConfirmado = false;

    const interval = setInterval(() => {
      if (countdown <= 0) {
        clearInterval(interval);
        clearInterval(pollInterval);
        document.getElementById('qrResult').innerHTML = '<p class="text-warning">⚠️ El código QR ha expirado.</p>';
      } else {
        const minutes = Math.floor(countdown / 60);
        const seconds = countdown % 60;
        document.getElementById('countdown').innerText = 
          `Tiempo restante: ${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        countdown--;
      }
    }, 1000);*/
	
	//nuevo codigo 
	
if (result.success) {
  let countdown = 300;
  const txId = result.transactionId;
  let pagoConfirmado = false;

  document.getElementById('qrResult').innerHTML = `
    <p id="countdown" class="text-danger fw-bold"></p>
    <p><strong>Monto en USD:</strong> $${result.amountUSD}</p>
    <p><strong>Tasa USD → CLP:</strong> ${result.rateCLPperUSD}</p>
    <p><strong>Tasa USD → BRL (vet):</strong> ${result.vetTax}</p>
    <p><strong>Valor que pagará el cliente en BRL:</strong> R$ ${result.amountBRL}</p>
    ${result.qrData.pixCopyPast ? `<p><strong>Enlace de pago:</strong><br><a href="${result.qrData.pixCopyPast}" target="_blank">${result.qrData.pixCopyPast}</a></p>` : ''}
    <img src="data:image/png;base64,${result.qrData.qrCodeBase64}" alt="QR PIX" class="img-fluid mt-3" />
  `;

  const countdownEl = document.getElementById('countdown');

  const interval = setInterval(() => {
    if (countdown <= 0) {
      clearInterval(interval);
      clearInterval(pollInterval);
      document.getElementById('qrResult').innerHTML = '<p class="text-warning">⚠️ El código QR ha expirado.</p>';
    } else {
      const minutes = Math.floor(countdown / 60);
      const seconds = countdown % 60;
      countdownEl.innerText = `⏳ Tiempo restante: ${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
      countdown--;
    }
  }, 1000);

  const pollInterval = setInterval(async () => {
    const paid = await fetch('/api/paid').then(r => r.json());
    const match = paid.find(p => p.id === txId);
    if (match) {
      pagoConfirmado = true;
      clearInterval(interval);
      clearInterval(pollInterval);
      document.getElementById('qrResult').innerHTML = `
        <div class="alert alert-success"><strong>✅ Pago recibido</strong><br>
          Monto pagado: USD ${match.amountUSD}<br>
          Cliente: ${match.name}<br>
          Fecha: ${new Date(match.paid_at).toLocaleString()}
        </div>
      `;
    }
  }, 10000);
}

//fin nuevo codigo

 /*   const pollInterval = setInterval(async () => {
      const paid = await fetch('/api/paid').then(r => r.json());
      const match = paid.find(p => p.id === txId);
      if (match) {
        pagoConfirmado = true;
        clearInterval(interval);
        clearInterval(pollInterval);
        document.getElementById('qrResult').innerHTML = `
          <div class="alert alert-success"><strong>✅ Pago recibido</strong><br>
            Monto pagado: USD ${match.amountUSD}<br>
            Cliente: ${match.name}<br>
            Fecha: ${new Date(match.paid_at).toLocaleString()}
          </div>
        `;
      }
    }, 10000);

    document.getElementById('qrResult').innerHTML = `
      <p id="countdown" class="text-danger fw-bold"></p>
      <p><strong>Monto en USD:</strong> $${result.amountUSD}</p>
      <p><strong>Tasa USD → CLP:</strong> ${result.rateCLPperUSD}</p>
      <p><strong>Tasa USD → BRL (vet):</strong> ${result.vetTax}</p>
      <p><strong>Valor que pagará el cliente en BRL:</strong> R$ ${result.amountBRL}</p>
      <p><strong>Enlace de pago:</strong><br><code>${result.qrData.pixCopyPast}</code></p>
      <img src="data:image/png;base64,${result.qrData.qrCodeBase64}" alt="QR PIX" class="img-fluid mt-3" />
    `;
  } else {
    alert('Error: ' + (result.error || 'Error desconocido.'));
  }

  btn.disabled = false;
  btn.innerText = 'Generar QR';*/
});