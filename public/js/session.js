export function restoreSession() {
  const storedSession = localStorage.getItem('session');
  if (storedSession) {
    try {
      window.session = JSON.parse(storedSession);
      console.log('🔐 Sesión restaurada desde localStorage');
    } catch (e) {
      console.error('❌ Error al restaurar sesión:', e);
    }
  }
}