import { renderLinkResult } from './ui.js';
import { post } from './api.js';

export function initLinkButton() {
  const btn = document.getElementById('btnGenerateLink');
  if (!btn) return;

  btn.addEventListener('click', async () => {
    const payload = {
      amount: document.getElementById('amount').value,
      name: document.getElementById('name').value,
      email: document.getElementById('emailCliente').value,
      phone: document.getElementById('phone').value,
      cpf: document.getElementById('cpf').value,
      description: `Link de pago para ${document.getElementById('name').value}`,
      currency: window.currentCurrency,
      userEmail: window.session?.email
    };

    const result = await post('/api/payment-link', payload);
    renderLinkResult(result);
  });
}