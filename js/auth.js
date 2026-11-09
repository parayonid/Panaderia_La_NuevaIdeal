import { initializeApp } from "https://www.gstatic.com/firebasejs/10.5.0/firebase-app.js";
import { 
    getAuth, 
    signInWithEmailAndPassword, 
    createUserWithEmailAndPassword,
    sendPasswordResetEmail,
    onAuthStateChanged
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

// Tres perfiles del panel; los compradores siguen siendo "cliente".
const ROLES_PANEL = new Set(["admin", "ventas", "logistica"]);
const ROLES_VALIDOS = new Set([...ROLES_PANEL, "cliente"]);

function normalizarRol(valor) {
    return typeof valor === "string" ? valor.trim().toLowerCase() : "";
}


document.addEventListener('DOMContentLoaded', () => {

    // ==========================================
    // 1. ALTERNANCIA DE PESTAÑAS (LOGIN / REGISTRO)
    // ==========================================
    const tabLogin = document.getElementById('tab-login');
    const tabRegister = document.getElementById('tab-register');
    const formLogin = document.getElementById('login-form');
    const formRegister = document.getElementById('register-form');
    const loginModal = document.getElementById('login-modal');

    // El enlace al panel se oculta por defecto en index.html.
    // Esta visibilidad es UX; la autorización real depende de Firestore/API.
    const enlaceAdmin = document.getElementById('nav-admin');
    onAuthStateChanged(auth, async (usuario) => {
        if (enlaceAdmin) enlaceAdmin.hidden = true;
        if (!usuario) {
            localStorage.removeItem('usuarioActual');
            localStorage.removeItem('isLoggedIn');
            return;
        }
        try {
            const perfil = await getDoc(doc(db, 'usuarios', usuario.uid));
            // Evitar actualizar el menú con el resultado de una sesión antigua.
            if (auth.currentUser?.uid !== usuario.uid) return;
            const rol = perfil.exists() ? normalizarRol(perfil.data().rol) : '';
            if (!ROLES_VALIDOS.has(rol)) return;
            if (enlaceAdmin) enlaceAdmin.hidden = !ROLES_PANEL.has(rol);
        } catch (error) {
            console.error('[Navegación] No se pudo consultar el rol:', error.code || error);
            if (enlaceAdmin) enlaceAdmin.hidden = true;
        }
    });

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

            let credencial;
            try {
                credencial = await createUserWithEmailAndPassword(auth, email, pass);
            } catch (error) {
                console.error('[Registro/Auth]',error.code,error);
                if (errorReg) {
                    errorReg.style.display='block';
                    errorReg.textContent = error.code==='auth/email-already-in-use'
                        ? 'Este correo ya existe en Authentication. Inicia sesión; no crees otra cuenta.'
                        : error.code==='auth/invalid-email' ? 'Correo no válido.'
                        : `No se pudo crear la cuenta en Authentication (${error.code || 'error de conexión'}).`;
                }
                if (btnSubmitReg) btnSubmitReg.textContent='Registrarme';
                return;
            }
            try {
                await setDoc(doc(db,'usuarios',credencial.user.uid),{
                    nombre,telefono,correo:email,rol:'cliente',fechaRegistro:new Date()
                });
                localStorage.setItem('isLoggedIn','true');
                if (loginModal) loginModal.style.display='none';
                window.location.href='views/user.html';
            } catch(error) {
                console.error('[Registro/Firestore]',error.code,error);
                // Authentication ya creó la cuenta. No se elimina ni se vuelve a crear.
                if(errorReg) {
                    errorReg.style.display='block';
                    errorReg.textContent=`Cuenta creada en Authentication, pero no se pudo guardar el perfil en Firestore (${error.code || 'error desconocido'}). No vuelvas a registrarla; revisa Rules / usuarios y entra con el mismo correo.`;
                }
            } finally {
                if (btnSubmitReg) btnSubmitReg.textContent='Registrarme';
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
            if (btnSubmit) {
                btnSubmit.textContent = 'Verificando...';
                btnSubmit.disabled = true;
            }
            if (errorLogin) errorLogin.style.display = 'none';

            const mostrarErrorLogin = (mensaje) => {
                if (errorLogin) {
                    errorLogin.textContent = mensaje;
                    errorLogin.style.display = 'block';
                }
            };

            try {
                // Paso 1: Auth (correo y contraseña).
                // Paso 2: Perfil Firestore. No confundir errores de un paso con el otro.
                let user;
                try {
                    const resultado = await signInWithEmailAndPassword(auth, email, pass);
                    user = resultado.user;
                    console.info('[Login] Firebase Authentication correcto.');
                } catch (error) {
                    console.error('[Login] Falló Firebase Authentication:', error.code, error);
                    const mensajesAuth = {
                        'auth/invalid-credential': 'Correo o contraseña incorrectos.',
                        'auth/wrong-password': 'Correo o contraseña incorrectos.',
                        'auth/user-not-found': 'La cuenta no existe en Firebase Authentication.',
                        'auth/invalid-email': 'El formato del correo no es válido.',
                        'auth/user-disabled': 'Esta cuenta está deshabilitada.',
                        'auth/network-request-failed': 'No se pudo conectar con Firebase. Comprueba tu conexión.',
                        'auth/too-many-requests': 'Demasiados intentos. Inténtalo más tarde.',
                        'auth/operation-not-allowed': 'El inicio de sesión por correo no está habilitado en Firebase.',
                        'auth/unauthorized-domain': 'Este dominio no está autorizado en Firebase Authentication.'
                    };
                    mostrarErrorLogin(mensajesAuth[error.code] || `Error de autenticación: ${error.code || 'desconocido'}`);
                    return;
                }

                let userDoc;
                try {
                    userDoc = await getDoc(doc(db, 'usuarios', user.uid));
                    console.info('[Login] Lectura del perfil de Firestore correcta.');
                } catch (error) {
                    console.error('[Login] Falló la consulta del perfil en Firestore:', error.code, error);
                    if (error.code === 'permission-denied') {
                        mostrarErrorLogin('Inicio de sesión correcto, pero Firestore denegó la lectura de tu perfil (permission-denied). Revisa las reglas de usuarios.');
                    } else if (error.code === 'unavailable') {
                        mostrarErrorLogin('Inicio de sesión correcto, pero Firestore no está disponible. Comprueba tu conexión.');
                    } else {
                        mostrarErrorLogin(`Inicio de sesión correcto, pero falló Firestore: ${error.code || 'desconocido'}`);
                    }
                    return;
                }

                if (!userDoc.exists()) {
                    console.warn('[Login] Falta el documento usuarios/{UID}. UID:', user.uid);
                    mostrarErrorLogin('La contraseña fue aceptada, pero no existe tu perfil en la colección usuarios de Firestore.');
                    return;
                }

                const userRole = normalizarRol(userDoc.data().rol);
                if (!ROLES_VALIDOS.has(userRole)) {
                    console.warn('[Login] Rol inválido:', userRole);
                    mostrarErrorLogin('Tu cuenta inició sesión, pero tiene un rol sin configurar correctamente en Firestore.');
                    return;
                }

                localStorage.setItem('isLoggedIn', 'true');
                localStorage.setItem('usuarioActual', JSON.stringify({
                    correo: user.email,
                    rol: userRole
                }));
                if (loginModal) loginModal.style.display = 'none';
                window.location.href = ROLES_PANEL.has(userRole)
                    ? 'views/admin.html'
                    : 'views/user.html';
            } finally {
                if (btnSubmit) {
                    btnSubmit.textContent = 'Entrar';
                    btnSubmit.disabled = false;
                }
            }
        });
    }

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
                const escapar = valor => String(valor ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
                const img = p.imagen || 'images/images/muffin.jpg';
                const imgSeguro = /^https?:\/\//i.test(img) || /^images\//.test(img) ? img : 'images/images/muffin.jpg';
                const precio = p.precio !== undefined && p.precio !== null && Number.isFinite(Number(p.precio)) ? new Intl.NumberFormat('es-MX',{style:'currency',currency:'MXN'}).format(Number(p.precio)) : 'Precio no disponible';
                const categoria = p.categoria || 'Panes';

                // Plantilla HTML del producto
                const htmlProducto = `
                    <div class="product">
                        <img src="${escapar(imgSeguro)}" alt="${escapar(p.nombre)}">
                        <div class="product-txt">
                            <h3>${escapar(p.nombre)}</h3>
                            <p>Disponible: ${p.stock_actual ?? p.cantidad ?? 0} pz</p>
                            <p class="precio">${precio}</p>
                            <a href="#" class="agregar-carrito btn-2" data-id="${escapar(docSnap.id)}">agregar al carrito</a>
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
        }, (error) => {
            console.error('[Catálogo Firestore]', error.code, error);
            const mensaje = 'No se pudo cargar el catálogo. Revisa los permisos de lectura de productos en Firestore.';
            if (contenedorPanes) contenedorPanes.textContent = mensaje;
            if (contenedorCafes) contenedorCafes.textContent = mensaje;
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