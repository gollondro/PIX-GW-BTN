const translations = {
  es: {
    email: "Email",
    password: "Contraseña",
    loginBtn: "Entrar",
    amount: "Monto en CLP",
    name: "Nombre",
    clientEmail: "Email",
    phone: "Teléfono",
    cpf: "CPF",
    generateBtn: "Generar QR"
  },
  en: {
    email: "Email",
    password: "Password",
    loginBtn: "Login",
    amount: "Amount in CLP",
    name: "Name",
    clientEmail: "Email",
    phone: "Phone",
    cpf: "CPF",
    generateBtn: "Generate QR"
  },
  pt: {
    email: "Email",
    password: "Senha",
    loginBtn: "Entrar",
    amount: "Valor em CLP",
    name: "Nome",
    clientEmail: "Email",
    phone: "Telefone",
    cpf: "CPF",
    generateBtn: "Gerar QR"
  }
};

function setLang(lang) {
  localStorage.setItem('lang', lang);
  document.querySelector('.lang-email').innerText = translations[lang].email;
  document.querySelector('.lang-password').innerText = translations[lang].password;
  document.querySelector('.lang-login-btn').innerText = translations[lang].loginBtn;
  document.querySelector('.lang-amount').innerText = translations[lang].amount;
  document.querySelector('.lang-name').innerText = translations[lang].name;
  document.querySelector('.lang-client-email').innerText = translations[lang].clientEmail;
  document.querySelector('.lang-phone').innerText = translations[lang].phone;
  document.querySelector('.lang-cpf').innerText = translations[lang].cpf;
  document.querySelector('.lang-generate-btn').innerText = translations[lang].generateBtn;
}

const savedLang = localStorage.getItem('lang') || 'es';
setLang(savedLang);