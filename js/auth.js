import { initializeApp } from "https://www.gstatic.com/firebasejs/10.5.0/firebase-app.js";
import { 
    getAuth, 
    signInWithEmailAndPassword, 
    createUserWithEmailAndPassword,
    sendPasswordResetEmail
} from "https://www.gstatic.com/firebasejs/10.5.0/firebase-auth.js";
import { 
    getFirestore, 
    collection, 
    onSnapshot, 
    doc, 
    setDoc,
    getDoc
} from "https://www.gstatic.com/firebasejs/10.5.0/firebase-firestore.js";

// --- CONFIGURACIÓN DE FIREBASE ---
const firebaseConfig = {
    apiKey: "AIzaSyBns2UIA_ED5CsjBMEmJxUYLqxp1PRXlGo",
    authDomain: "weblanuevaideal.firebaseapp.com",
    projectId: "weblanuevaideal",
    storageBucket: "weblanuevaideal.firebasestorage.app",
    messagingSenderId: "783648403901",
    appId: "1:783648403901:web:f52f6438c6afcf12cb62d4"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

document.addEventListener('DOMContentLoaded', () => {

    // ==========================================
    // 1. ALTERNANCIA DE PESTAÑAS (LOGIN / REGISTRO)
    // ==========================================
    const tabLogin = document.getElementById('tab-login');
    const tabRegister = document.getElementById('tab-register');
    const formLogin = document.getElementById('login-form');
    const formRegister = document.getElementById('register-form');
    const loginModal = document.getElementById('login-modal');

    if (tabLogin && tabRegister) {
        tabLogin.addEventListener('click', () => {
            tabLogin.classList.add('active');
            tabRegister.classList.remove('active');
            formLogin.style.display = 'block';
            formRegister.style.display = 'none';
            if (formRegister) formRegister.reset();
        });

        tabRegister.addEventListener('click', () => {
            tabRegister.classList.add('active');
            tabLogin.classList.remove('active');
            formRegister.style.display = 'block';
            formLogin.style.display = 'none';
            if(formLogin) formLogin.reset();
        });
    }

    // ==========================================
    // 2. VALIDACIÓN VISUAL DE CONTRASEÑA EN TIEMPO REAL
    // ==========================================
    const regPassword = document.getElementById('reg-password');
    const btnSubmitReg = document.getElementById('btn-submit-reg');
    const rules = {
        length: document.getElementById('rule-length'),
        upper: document.getElementById('rule-upper'),
        number: document.getElementById('rule-number'),
        special: document.getElementById('rule-special')
    };

    const updateRule = (element, isValid) => {
        if (!element) return;
        if (isValid) {
            element.className = 'valid';
            element.innerHTML = '<i class="bi bi-check-circle-fill"></i> ' + element.innerText.replace(/[^a-zA-Z0-9 ÁÉÍÓÚáéíóú@$!%*?&()]/g, '').trim();
        } else {
            element.className = 'invalid';
            element.innerHTML = '<i class="bi bi-x-circle"></i> ' + element.innerText.replace(/[^a-zA-Z0-9 ÁÉÍÓÚáéíóú@$!%*?&()]/g, '').trim();
        }
    };

    if (regPassword) {
        regPassword.addEventListener('input', (e) => {
            const val = e.target.value;
            const validLength = val.length >= 8;
            const validUpper = /[A-Z]/.test(val);
            const validNumber = /[0-9]/.test(val);
            const validSpecial = /[@$!%*?&]/.test(val);

            updateRule(rules.length, validLength);
            updateRule(rules.upper, validUpper);
            updateRule(rules.number, validNumber);
            updateRule(rules.special, validSpecial);

            // Se habilita el botón únicamente cuando todas las reglas se cumplen
            if (btnSubmitReg) {
                btnSubmitReg.disabled = !(validLength && validUpper && validNumber && validSpecial);
            }
        });
    }

    // ==========================================
    // 3. REGISTRO DE CUENTA EN FIREBASE
    // ==========================================
    const errorReg = document.getElementById('reg-error');
    if (formRegister) {
        formRegister.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('reg-email').value.trim();
            const pass = regPassword.value;
            const nombre = document.getElementById('reg-name').value.trim();
            const telefono = document.getElementById('reg-phone').value.trim();

            if (btnSubmitReg) btnSubmitReg.textContent = "Registrando...";
            if (errorReg) errorReg.style.display = "none";

            try {
                // Registro en Firebase Authentication
                const userCredential = await createUserWithEmailAndPassword(auth, email, pass);
                
                // Guardado de metadatos en Cloud Firestore
                await setDoc(doc(db, "usuarios", userCredential.user.uid), {
                    nombre,
                    telefono,
                    correo: email,
                    rol: "cliente",
                    fechaRegistro: new Date()
                });

                localStorage.setItem('isLoggedIn', 'true');
                alert("¡Cuenta registrada con éxito!");
                if (loginModal) loginModal.style.display = 'none';
                window.location.href = 'views/user.html';

            } catch (error) {
                if (errorReg) {
                    errorReg.style.display = "block";
                    if (error.code === 'auth/email-already-in-use') {
                        errorReg.textContent = "Este correo ya está registrado. Inicia sesión.";
                    } else if (error.code === 'auth/invalid-email') {
                        errorReg.textContent = "El formato de correo no es válido.";
                    } else {
                        errorReg.textContent = "Error al crear la cuenta. Intenta de nuevo.";
                    }
                }
            } finally {
                if (btnSubmitReg) btnSubmitReg.textContent = "Registrarme";
            }
        });
    }

    
    // ==========================================
    // 4. INICIO DE SESIÓN EN FIREBASE
    // ==========================================
    const errorLogin = document.getElementById('login-error');
    if (formLogin) {
        formLogin.addEventListener('submit', async (e) => {
            e.preventDefault();
            e.stopImmediatePropagation();

            const email = document.getElementById('login-email').value.trim();
            const pass = document.getElementById('login-password').value;
            const btnSubmit = formLogin.querySelector('button[type="submit"]');

            if (btnSubmit) btnSubmit.textContent = "Verificando...";
            if (errorLogin) errorLogin.style.display = "none";

            try {
                // 1. Validar el correo y contraseña en Firebase Auth
                const userCredential = await signInWithEmailAndPassword(auth, email, pass);
                const user = userCredential.user;
                
                // 2. Buscar el documento de este usuario en Firestore para leer su "rol"
                const userDoc = await getDoc(doc(db, "usuarios", user.uid));
                let userRole = "cliente"; // Rol por defecto si algo falla

                if (userDoc.exists()) {
                    userRole = userDoc.data().rol; // Aquí lee el "admin" que le pusiste en la base de datos
                }

                localStorage.setItem('isLoggedIn', 'true');
                if (loginModal) loginModal.style.display = 'none';
                
                // 3. Redirección condicional según el rol REAL de la base de datos
                if (userRole === 'admin') {
                    window.location.href = 'views/admin.html';
                } else {
                    window.location.href = 'views/user.html';
                }

            } catch (error) {
                if (errorLogin) {
                    errorLogin.style.display = "block";
                    if (
                        error.code === 'auth/user-not-found' || 
                        error.code === 'auth/invalid-credential' ||
                        error.code === 'auth/wrong-password'
                    ) {
                        errorLogin.textContent = "Esta cuenta no existe o las credenciales son incorrectas.";
                    } else {
                        errorLogin.textContent = "No se pudo iniciar sesión. Verifica tu información.";
                    }
                }
            } finally {
                if (btnSubmit) btnSubmit.textContent = "Entrar";
            }
        });
    }

    // ==========================================
    // 5. CARGA DE PRODUCTOS DE FIRESTORE A LA TIENDA
    // ==========================================
    // ==========================================
    // 5. CARGA DE PRODUCTOS DE FIRESTORE A LA TIENDA
    // ==========================================
    const contenedorPanes = document.getElementById('contenedor-panes');
    const contenedorCafes = document.getElementById('contenedor-cafes');

    if (contenedorPanes || contenedorCafes) {
        onSnapshot(collection(db, "productos"), (snapshot) => {
            if(contenedorPanes) contenedorPanes.innerHTML = '';
            if(contenedorCafes) contenedorCafes.innerHTML = '';
            
            if (snapshot.empty) return;

            snapshot.forEach((docSnap) => {
                const p = docSnap.data();
                const img = p.imagen || 'images/images/muffin.jpg';
                const precio = p.precio ? `$${p.precio}` : '$10'; // Usa el precio real
                const categoria = p.categoria || 'Panes';

                // Plantilla HTML del producto
                const htmlProducto = `
                    <div class="product">
                        <img src="${img}" alt="${p.nombre}">
                        <div class="product-txt">
                            <h3>${p.nombre}</h3>
                            <p>Disponible: ${p.cantidad} pz</p>
                            <p class="precio">${precio}</p>
                            <a href="#" class="agregar-carrito btn-2" data-id="${docSnap.id}">agregar al carrito</a>
                        </div>
                    </div>`;

                // Clasificador automático
                if (categoria === 'Cafés' && contenedorCafes) {
                    contenedorCafes.innerHTML += htmlProducto;
                } else if (contenedorPanes) {
                    // Los "Panes" y "Otros" caen en la sección principal
                    contenedorPanes.innerHTML += htmlProducto;
                }
            });
        });
    }
// ==========================================
    // 6. RECUPERACIÓN DE CONTRASEÑA
    // ==========================================
    const authTabsContainer = document.getElementById('auth-tabs-container');
    const forgotPwdForm = document.getElementById('forgot-pwd-form');
    const linkForgotPwd = document.getElementById('link-forgot-pwd');
    const linkBackLogin = document.getElementById('link-back-login');
    const btnSubmitForgot = document.getElementById('btn-submit-forgot');
    const errorForgot = document.getElementById('forgot-error');
    const successForgot = document.getElementById('forgot-success');

    // Cambiar a la vista de "Recuperar Contraseña"
    if (linkForgotPwd) {
        linkForgotPwd.addEventListener('click', (e) => {
            e.preventDefault();
            formLogin.style.display = 'none';
            formRegister.style.display = 'none';
            authTabsContainer.style.display = 'none'; // Ocultar pestañas
            forgotPwdForm.style.display = 'block';
            forgotPwdForm.reset();
            if(errorForgot) errorForgot.style.display = 'none';
            if(successForgot) successForgot.style.display = 'none';
        });
    }

    // Volver a la vista de "Iniciar Sesión"
    if (linkBackLogin) {
        linkBackLogin.addEventListener('click', (e) => {
            e.preventDefault();
            forgotPwdForm.style.display = 'none';
            authTabsContainer.style.display = 'flex'; // Mostrar pestañas
            if(tabLogin) tabLogin.click(); // Simular clic para acomodar todo
        });
    }

    // Enviar el correo de recuperación
    if (forgotPwdForm) {
        forgotPwdForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('forgot-email').value.trim();
            
            btnSubmitForgot.textContent = "Enviando...";
            btnSubmitForgot.disabled = true;
            errorForgot.style.display = "none";
            successForgot.style.display = "none";

            try {
                // Función nativa de Firebase que hace toda la magia
                await sendPasswordResetEmail(auth, email);
                successForgot.style.display = "block";
                forgotPwdForm.reset();
            } catch (error) {
                errorForgot.style.display = "block";
                if (error.code === 'auth/user-not-found') {
                    errorForgot.textContent = "No hay ninguna cuenta registrada con este correo.";
                } else if (error.code === 'auth/invalid-email') {
                    errorForgot.textContent = "El formato de correo no es válido.";
                } else {
                    errorForgot.textContent = "Ocurrió un error. Intenta de nuevo más tarde.";
                }
            } finally {
                btnSubmitForgot.textContent = "Enviar Enlace";
                btnSubmitForgot.disabled = false;
            }
        });
    }


});