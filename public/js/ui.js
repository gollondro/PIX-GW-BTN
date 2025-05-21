export function renderLinkResult(data) {
  const qrResult = document.getElementById('qrResult');
  if (!qrResult) return;

  if (data?.success && data.id) {
    const url = `https://pagamento.rendix.com.br/link/${data.id}`;
    qrResult.innerHTML = `
      <p><strong>ID de la venta:</strong> ${data.id}</p>
      <p><strong>Link de pago:</strong> <a href="${url}" target="_blank">${url}</a></p>
    `;
  } else {
    qrResult.innerHTML = `<div class="alert alert-warning">No se pudo generar el link.</div>`;
  }
}