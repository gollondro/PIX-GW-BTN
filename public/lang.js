const translations = {
  es: { loginTitle: "Iniciar sesión", email: "Email", password: "Contraseña", enter: "Entrar", amountCLP: "Monto en CLP", name: "Nombre", phone: "Teléfono", cpf: "CPF", generateQR: "Generar QR", logout: "Cerrar sesión" },
  en: { loginTitle: "Log in", email: "Email", password: "Password", enter: "Enter", amountCLP: "Amount in CLP", name: "Name", phone: "Phone", cpf: "CPF", generateQR: "Generate QR", logout: "Logout" },
  pt: { loginTitle: "Entrar", email: "Email", password: "Senha", enter: "Entrar", amountCLP: "Valor em CLP", name: "Nome", phone: "Telefone", cpf: "CPF", generateQR: "Gerar QR", logout: "Sair" }
};
function setLang(lang) {
  localStorage.setItem("lang", lang); applyLang(lang);
}
function applyLang(lang) {
  const elements = document.querySelectorAll(".lang");
  elements.forEach(el => {
    const key = el.getAttribute("data-key");
    if (translations[lang][key]) {
      if (el.tagName === "INPUT" || el.tagName === "TEXTAREA") el.placeholder = translations[lang][key];
      else el.innerText = translations[lang][key];
    }
  });
  document.getElementById("formTitle").innerText = translations[lang].loginTitle;
}
document.addEventListener("DOMContentLoaded", () => {
  const lang = localStorage.getItem("lang") || "es";
  applyLang(lang);
});