import { restoreSession } from './session.js';
import { initPixForm } from './pixForm.js';
import { initLinkButton } from './linkForm.js';

document.addEventListener('DOMContentLoaded', () => {
  restoreSession();
  initPixForm();
  initLinkButton();
});