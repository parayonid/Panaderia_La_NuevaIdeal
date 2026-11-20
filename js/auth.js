
import {
  initializeApp,
  getApps,
  getApp
} from "https://www.gstatic.com/firebasejs/10.5.0/firebase-app.js";

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

// ======================================================
// CONFIGURACIÓN FIREBASE
// ======================================================

const firebaseConfig = {
  apiKey: "AIzaSyBns2UIA_ED5CsjBMEmJxUYLqxp1PRXlGo",
  authDomain: "weblanuevaideal.firebaseapp.com",
  projectId: "weblanuevaideal",
  storageBucket: "weblanuevaideal.firebasestorage.app",
  messagingSenderId: "783648403901",
  appId: "1:783648403901:web:f52f6438c6afcf12cb62d4"
};

const app = getApps().length
  ? getApp()
  : initializeApp(firebaseConfig);

const auth = getAuth(app);
const db = getFirestore(app);
const API_URL = "https://panaderia-la-nuevaideal.onrender.com";

const ROLES_PANEL = new Set([
  "admin",
  "ventas",
  "logistica",
  "mantenimiento"
]);

const ROLES_VALIDOS = new Set([
  "admin",
  "ventas",
  "logistica",
  "mantenimiento",
  "cliente"
]);

function normalizarRol(valor) {
  return typeof valor === "string"
    ? valor.trim().toLowerCase()
    : "";
}

function $(id) {
  return document.getElementById(id);
}

function escaparHTML(valor) {
  return String(valor ?? "").replace(
    /[&<>"']/g,
    caracter => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    })[caracter]
  );
}

document.addEventListener("DOMContentLoaded", () => {
  const tabLogin = $("tab-login");
  const tabRegister = $("tab-register");

  const formLogin = $("login-form");
  const formRegister = $("register-form");
  const loginModal = $("login-modal");
  const welcomeScreen = $("welcome-screen");
  const welcomeContinue = $("welcome-continue");

  const regPassword = $("reg-password");
  const btnSubmitReg = $("btn-submit-reg");

  const errorReg = $("reg-error");
  const errorLogin = $("login-error");

  const enlaceAdmin = $("nav-admin");

  // ======================================================
  // VISIBILIDAD DEL PANEL POR ROL
  // ======================================================

  onAuthStateChanged(auth, async usuario => {
    if (enlaceAdmin) {
      enlaceAdmin.hidden = true;
    }

    if (!usuario) {
      localStorage.removeItem("usuarioActual");
      localStorage.removeItem("isLoggedIn");
      return;
    }

    try {
      const perfil = await getDoc(
        doc(db, "usuarios", usuario.uid)
      );

      if (auth.currentUser?.uid !== usuario.uid) {
        return;
      }

      const rol = perfil.exists()
        ? normalizarRol(perfil.data().rol)
        : "";

      if (!ROLES_VALIDOS.has(rol)) {
        return;
      }

      if (enlaceAdmin) {
        enlaceAdmin.hidden = !ROLES_PANEL.has(rol);
        enlaceAdmin.href = rol === "mantenimiento"
          ? "views/etapa4-gestion.html"
          : "views/admin.html";
      }
    } catch (error) {
      console.error(
        "[Navegación] No se pudo consultar el rol:",
        error.code || error
      );

      if (enlaceAdmin) {
        enlaceAdmin.hidden = true;
      }
    }
  });

  // ======================================================
  // PESTAÑAS DE LOGIN Y REGISTRO
  // ======================================================

  if (tabLogin && tabRegister) {
    tabLogin.addEventListener("click", () => {
      tabLogin.classList.add("active");
      tabRegister.classList.remove("active");

      if (formLogin) {
        formLogin.style.display = "block";
      }

      if (formRegister) {
        formRegister.style.display = "none";
        formRegister.reset();
      }
    });

    tabRegister.addEventListener("click", () => {
      tabRegister.classList.add("active");
      tabLogin.classList.remove("active");

      if (formRegister) {
        formRegister.style.display = "block";
      }

      if (formLogin) {
        formLogin.style.display = "none";
        formLogin.reset();
      }
    });
  }

  const searchParams = new URLSearchParams(window.location.search);
  const mostrarBienvenida =
    searchParams.get("welcome") === "1" ||
    searchParams.get("login") === "1";

  function abrirInicioSesion() {
    if (welcomeScreen) {
      welcomeScreen.hidden = true;
    }

    tabLogin?.click();
    if (loginModal) {
      loginModal.style.display = "block";
    }

    const url = new URL(window.location.href);
    url.searchParams.delete("welcome");
    url.searchParams.delete("login");
    window.history.replaceState(
      null,
      "",
      `${url.pathname}${url.search}${url.hash}`
    );
  }

  if (mostrarBienvenida && welcomeScreen) {
    welcomeScreen.hidden = false;
    const tiempoBienvenida = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches ? 500 : 3000;
    const temporizadorBienvenida = window.setTimeout(
      abrirInicioSesion,
      tiempoBienvenida
    );

    welcomeContinue?.addEventListener("click", () => {
      window.clearTimeout(temporizadorBienvenida);
      abrirInicioSesion();
    });
  } else if (mostrarBienvenida) {
    abrirInicioSesion();
  }

  // ======================================================
  // VALIDACIÓN DE CONTRASEÑAS
  // ======================================================

  const reglas = {
    length: $("rule-length"),
    upper: $("rule-upper"),
    number: $("rule-number"),
    special: $("rule-special")
  };

  function actualizarRegla(elemento, valida) {
    if (!elemento) return;

    elemento.className = valida ? "valid" : "invalid";

    const icono = document.createElement("i");

    icono.className = valida
      ? "bi bi-check-circle-fill"
      : "bi bi-x-circle";

    // Conservar la etiqueta original de la regla.
    const texto = elemento.dataset.texto ||
      elemento.textContent.trim();

    elemento.dataset.texto = texto;
    elemento.replaceChildren(
      icono,
      document.createTextNode(` ${texto}`)
    );
  }

  function validarContrasena(password) {
    const longitud = password.length >= 8;
    const mayuscula = /[A-Z]/.test(password);
    const numero = /[0-9]/.test(password);
    const especial = /[@$!%*?&]/.test(password);

    actualizarRegla(reglas.length, longitud);
    actualizarRegla(reglas.upper, mayuscula);
    actualizarRegla(reglas.number, numero);
    actualizarRegla(reglas.special, especial);

    return (
      longitud &&
      mayuscula &&
      numero &&
      especial
    );
  }

  if (regPassword) {
    regPassword.addEventListener("input", evento => {
      const valida = validarContrasena(
        evento.target.value
      );

      if (btnSubmitReg) {
        btnSubmitReg.disabled = !valida;
      }
    });
  }

  // ======================================================
  // REGISTRO DE NUEVOS CLIENTES
  // ======================================================

  if (formRegister) {
    formRegister.addEventListener(
      "submit",
      async evento => {
        evento.preventDefault();

        const email = $("reg-email")
          .value.trim().toLowerCase();

        const password = regPassword.value;
        const nombre = $("reg-name").value.trim();
        const telefono = $("reg-phone").value.trim();

        if (!nombre || !validarContrasena(password)) {
          if (errorReg) {
            errorReg.textContent =
              "Revisa tu nombre y contraseña.";
            errorReg.style.display = "block";
          }
          return;
        }

        if (btnSubmitReg) {
          btnSubmitReg.disabled = true;
          btnSubmitReg.textContent = "Registrando...";
        }

        if (errorReg) {
          errorReg.style.display = "none";
        }

        let credencial;

        // PASO 1: CREAR LA CUENTA EN AUTHENTICATION

        try {
          credencial = await createUserWithEmailAndPassword(
            auth,
            email,
            password
          );
        } catch (error) {
          console.error(
            "[Registro/Authentication]",
            error.code,
            error
          );

          if (errorReg) {
            errorReg.style.display = "block";

            if (error.code === "auth/email-already-in-use") {
              errorReg.textContent =
                "Este correo ya tiene una cuenta. " +
                "Inicia sesión en lugar de registrarte nuevamente.";
            } else if (error.code === "auth/invalid-email") {
              errorReg.textContent =
                "El formato del correo no es válido.";
            } else {
              errorReg.textContent =
                "No se pudo crear la cuenta: " +
                (error.code || error.message);
            }
          }

          if (btnSubmitReg) {
            btnSubmitReg.disabled = false;
            btnSubmitReg.textContent = "Registrarme";
          }

          return;
        }

        // PASO 2: CREAR EL DOCUMENTO EN FIRESTORE
        // IMPORTANTE: usar credencial.user, no userCredential.user.

        try {
          await setDoc(
            doc(db, "usuarios", credencial.user.uid),
            {
              nombre,
              telefono,
              correo: credencial.user.email,
              rol: "cliente",
              fechaRegistro: new Date()
            }
          );

          let correoBienvenidaEnviado = false;
          try {
            const token = await credencial.user.getIdToken();
            const respuesta = await fetch(
              `${API_URL}/correo/bienvenida`,
              {
                method: "POST",
                headers: {
                  Authorization: `Bearer ${token}`
                }
              }
            );
            const resultado = await respuesta.json().catch(() => ({}));

            if (!respuesta.ok) {
              throw new Error(
                resultado.detail ||
                `HTTP ${respuesta.status}`
              );
            }

            correoBienvenidaEnviado = true;
          } catch (error) {
            console.error(
              "[Registro/CorreoBienvenida]",
              error
            );
          }

          window.alert(
            correoBienvenidaEnviado
              ? "Hemos enviado un correo de bienvenida. Revisa tu bandeja de entrada."
              : "Tu cuenta se creó, pero no se pudo enviar el correo de bienvenida. Inténtalo más tarde."
          );

          localStorage.setItem("isLoggedIn", "true");

          if (loginModal) {
            loginModal.style.display = "none";
          }

          window.location.href = "views/user.html";
        } catch (error) {
          console.error(
            "[Registro/Firestore]",
            error.code,
            error
          );

          if (errorReg) {
            errorReg.style.display = "block";
            errorReg.textContent =
              "La cuenta se creó en Authentication, " +
              "pero no se pudo guardar el perfil en Firestore " +
              `(${error.code || error.name || "error desconocido"}). ` +
              "No vuelvas a registrarla con el mismo correo.";
          }
        } finally {
          if (btnSubmitReg) {
            btnSubmitReg.disabled = false;
            btnSubmitReg.textContent = "Registrarme";
          }
        }
      }
    );
  }

  // ======================================================
  // INICIO DE SESIÓN
  // ======================================================

  if (formLogin) {
    formLogin.addEventListener(
      "submit",
      async evento => {
        evento.preventDefault();

        const email = $("login-email").value.trim();
        const password = $("login-password").value;

        const boton = formLogin.querySelector(
          'button[type="submit"]'
        );

        if (boton) {
          boton.disabled = true;
          boton.textContent = "Verificando...";
        }

        if (errorLogin) {
          errorLogin.style.display = "none";
        }

        function mostrarErrorLogin(texto) {
          if (!errorLogin) return;

          errorLogin.textContent = texto;
          errorLogin.style.display = "block";
        }

        try {
          let usuario;

          try {
            const resultado = await signInWithEmailAndPassword(
              auth,
              email,
              password
            );

            usuario = resultado.user;
          } catch (error) {
            console.error(
              "[Login/Authentication]",
              error.code,
              error
            );

            const mensajes = {
              "auth/invalid-credential":
                "Correo o contraseña incorrectos.",
              "auth/wrong-password":
                "Correo o contraseña incorrectos.",
              "auth/user-not-found":
                "Esta cuenta no existe.",
              "auth/invalid-email":
                "El correo no es válido.",
              "auth/user-disabled":
                "Esta cuenta está deshabilitada.",
              "auth/network-request-failed":
                "No se pudo conectar con Firebase.",
              "auth/too-many-requests":
                "Demasiados intentos. Intenta más tarde.",
              "auth/unauthorized-domain":
                "Este dominio no está autorizado en Firebase."
            };

            mostrarErrorLogin(
              mensajes[error.code] ||
              `Error: ${error.code || "desconocido"}`
            );

            return;
          }

          // OBTENER ROL DESDE FIRESTORE

          let perfil;

          try {
            perfil = await getDoc(
              doc(db, "usuarios", usuario.uid)
            );
          } catch (error) {
            console.error(
              "[Login/Firestore]",
              error.code,
              error
            );

            mostrarErrorLogin(
              "La contraseña es correcta, pero no " +
              "se pudo consultar el perfil: " +
              (error.code || "error desconocido")
            );

            return;
          }

          if (!perfil.exists()) {
            mostrarErrorLogin(
              "Tu cuenta existe en Authentication, " +
              "pero no tiene un perfil en Firestore."
            );

            return;
          }

          const rol = normalizarRol(
            perfil.data().rol
          );

          if (!ROLES_VALIDOS.has(rol)) {
            mostrarErrorLogin(
              "El rol de tu usuario no es válido. " +
              "Consulta al administrador."
            );

            return;
          }

          // GUARDAR DATOS PARA COMPATIBILIDAD VISUAL.
          // LOS PERMISOS REALES LOS VERIFICA FASTAPI.

          localStorage.setItem("isLoggedIn", "true");

          localStorage.setItem(
            "usuarioActual",
            JSON.stringify({
              correo: usuario.email,
              rol
            })
          );

          if (loginModal) {
            loginModal.style.display = "none";
          }

          window.location.href = rol === "mantenimiento"
            ? "views/etapa4-gestion.html"
            : ROLES_PANEL.has(rol)
              ? "views/admin.html"
              : "views/user.html";

        } finally {
          if (boton) {
            boton.disabled = false;
            boton.textContent = "Entrar";
          }
        }
      }
    );
  }

  // ======================================================
  // CARGAR PRODUCTOS DESDE FIRESTORE
  // ======================================================

  const contenedorPanes = $("contenedor-panes");
  const contenedorCafes = $("contenedor-cafes");

  if (contenedorPanes || contenedorCafes) {
    onSnapshot(
      collection(db, "productos"),
      snapshot => {
        if (contenedorPanes) {
          contenedorPanes.replaceChildren();
        }

        if (contenedorCafes) {
          contenedorCafes.replaceChildren();
        }

        snapshot.forEach(documento => {
          const producto = documento.data();

          const categoria = producto.categoria || "Panes";

          const imagen = producto.imagen ||
            "images/images/muffin.jpg";

          const imagenSegura =
            /^https?:\/\//i.test(imagen) ||
            /^images\//.test(imagen)
              ? imagen
              : "images/images/muffin.jpg";

          const precioValido =
            producto.precio !== undefined &&
            producto.precio !== null &&
            Number.isFinite(Number(producto.precio));

          const precio = precioValido
            ? new Intl.NumberFormat("es-MX", {
                style: "currency",
                currency: "MXN"
              }).format(Number(producto.precio))
            : "Precio no disponible";

          const tarjeta = document.createElement("div");
          tarjeta.className = "product";

          tarjeta.innerHTML = `
            <img
              src="${escaparHTML(imagenSegura)}"
              alt="${escaparHTML(producto.nombre)}"
            >
            <div class="product-txt">
              <h3>${escaparHTML(producto.nombre)}</h3>
              <p>
                Disponible:
                ${Number(producto.stock_actual ?? producto.cantidad ?? 0)}
                pz
              </p>
              <p class="precio">${escaparHTML(precio)}</p>
              <a
                href="#"
                class="agregar-carrito btn-2"
                data-id="${escaparHTML(documento.id)}"
              >
                agregar al carrito
              </a>
            </div>
          `;

          if (categoria === "Cafés" && contenedorCafes) {
            contenedorCafes.append(tarjeta);
          } else if (contenedorPanes) {
            contenedorPanes.append(tarjeta);
          }
        });
      },
      error => {
        console.error(
          "[Catálogo Firestore]",
          error.code,
          error
        );

        const texto =
          "No se pudo cargar el catálogo. " +
          "Revisa los permisos de Firestore.";

        if (contenedorPanes) {
          contenedorPanes.textContent = texto;
        }

        if (contenedorCafes) {
          contenedorCafes.textContent = texto;
        }
      }
    );
  }

  // ======================================================
  // RECUPERAR CONTRASEÑA
  // ======================================================

  const authTabsContainer = $("auth-tabs-container");

  const forgotPwdForm = $("forgot-pwd-form");
  const linkForgotPwd = $("link-forgot-pwd");
  const linkBackLogin = $("link-back-login");

  const btnSubmitForgot = $("btn-submit-forgot");
  const errorForgot = $("forgot-error");
  const successForgot = $("forgot-success");

  if (linkForgotPwd) {
    linkForgotPwd.addEventListener(
      "click",
      evento => {
        evento.preventDefault();

        if (formLogin) {
          formLogin.style.display = "none";
        }

        if (formRegister) {
          formRegister.style.display = "none";
        }

        if (authTabsContainer) {
          authTabsContainer.style.display = "none";
        }

        if (forgotPwdForm) {
          forgotPwdForm.style.display = "block";
          forgotPwdForm.reset();
        }

        if (errorForgot) {
          errorForgot.style.display = "none";
        }

        if (successForgot) {
          successForgot.style.display = "none";
        }
      }
    );
  }

  if (linkBackLogin) {
    linkBackLogin.addEventListener(
      "click",
      evento => {
        evento.preventDefault();

        if (forgotPwdForm) {
          forgotPwdForm.style.display = "none";
        }

        if (authTabsContainer) {
          authTabsContainer.style.display = "flex";
        }

        tabLogin?.click();
      }
    );
  }

  if (forgotPwdForm) {
    forgotPwdForm.addEventListener(
      "submit",
      async evento => {
        evento.preventDefault();

        const email = $("forgot-email").value.trim();

        if (btnSubmitForgot) {
          btnSubmitForgot.textContent = "Enviando...";
          btnSubmitForgot.disabled = true;
        }

        if (errorForgot) {
          errorForgot.style.display = "none";
        }

        if (successForgot) {
          successForgot.style.display = "none";
        }

        try {
          await sendPasswordResetEmail(auth, email);

          if (successForgot) {
            successForgot.style.display = "block";
          }

          forgotPwdForm.reset();
        } catch (error) {
          if (errorForgot) {
            errorForgot.style.display = "block";

            if (error.code === "auth/invalid-email") {
              errorForgot.textContent =
                "El correo no es válido.";
            } else {
              errorForgot.textContent =
                "No fue posible enviar el correo. Intenta de nuevo.";
            }
          }
        } finally {
          if (btnSubmitForgot) {
            btnSubmitForgot.textContent = "Enviar Enlace";
            btnSubmitForgot.disabled = false;
          }
        }
      }
    );
  }
});
