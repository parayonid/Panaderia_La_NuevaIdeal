// ======================================================
// LA NUEVA IDEAL - ETAPA 4
// CARRITO, CHECKOUT Y PEDIDOS
// ======================================================

import {
  initializeApp, getApps, getApp
} from "https://www.gstatic.com/firebasejs/10.5.0/firebase-app.js";

import {
  getAuth, onAuthStateChanged, signOut
} from "https://www.gstatic.com/firebasejs/10.5.0/firebase-auth.js";
import { getFirestore, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.5.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyBns2UIA_ED5CsjBMEmJxUYLqxp1PRXlGo",
  authDomain: "weblanuevaideal.firebaseapp.com",
  projectId: "weblanuevaideal",
  storageBucket: "weblanuevaideal.firebasestorage.app",
  messagingSenderId: "783648403901",
  appId: "1:783648403901:web:f52f6438c6afcf12cb62d4"
};

const API = "https://panaderia-la-nuevaideal.onrender.com";

const app = getApps().length
  ? getApp()
  : initializeApp(firebaseConfig);

const auth = getAuth(app);
const db = getFirestore(app);

async function consultarRolUsuario(uid) {
  const snap = await getDoc(doc(db, "usuarios", uid));
  return snap.exists() ? String(snap.data().rol || "").toLowerCase().trim() : "";
}

const $ = id => document.getElementById(id);

const dinero = valor =>
  new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN"
  }).format(Number(valor) || 0);

const STORAGE = "laNuevaIdeal_carrito_v4";

const carrito = new Map();
const catalogo = new Map();

let usuarioActual = null;
let idSolicitud = null;
let precioCotizado = null;
let modoDemo = false;
let saldoMonedero = 0;

// ======================================================
// FUNCIONES GENERALES
// ======================================================

function nuevaSolicitud() {
  return crypto.randomUUID().replaceAll("-", "");
}

function mostrarModal(id, visible = true) {
  const elemento = $(id);

  if (elemento) {
    elemento.style.display = visible ? "block" : "none";
  }
}

function mostrarError(texto) {
  const elemento = $("checkout-error");
  if (!elemento) return;

  elemento.textContent = texto || "";
  elemento.hidden = !texto;
}

function aviso(texto) {
  const elemento = $("carrito-aviso");

  if (elemento) {
    elemento.textContent = texto;
    elemento.hidden = !texto;
  } else if (texto) {
    alert(texto);
  }
}

// ======================================================
// FIREBASE AUTHENTICATION
// ======================================================

let authListo = false;

const promesaAuth = new Promise(resolve => {
  onAuthStateChanged(
    auth,
    usuario => {
      usuarioActual = usuario;

      const boton = $("cerrar-sesion-tienda");

      if (boton) {
        boton.hidden = !usuario;
      }

      const estado = $("estado-sesion");

      if (estado) {
        estado.textContent = usuario
          ? `Sesión: ${usuario.email || "Cuenta activa"}`
          : "";

        estado.style.display = usuario
          ? "inline"
          : "none";
      }

      if (!authListo) {
        authListo = true;
        resolve();
      }
    },
    error => {
      console.error(
        "Error verificando autenticación:",
        error
      );

      if (!authListo) {
        authListo = true;
        resolve();
      }
    }
  );
});

async function esperarAutenticacion() {
  await promesaAuth;
  return auth.currentUser;
}

// ======================================================
// PETICIONES AL BACKEND
// ======================================================

async function solicitar(
  ruta,
  opciones = {},
  privado = true
) {
  const headers = {
    ...(opciones.headers || {})
  };

  if (opciones.body) {
    headers["Content-Type"] = "application/json";
  }

  if (privado) {
    const usuario = await esperarAutenticacion();

    if (!usuario) {
      throw new Error(
        "Debes iniciar sesión para continuar."
      );
    }

    const token = await usuario.getIdToken();

    headers.Authorization = `Bearer ${token}`;
  }

  const respuesta = await fetch(
    `${API}${ruta}`,
    {
      ...opciones,
      headers,
      cache: "no-store"
    }
  );

  const datos = await respuesta.json()
    .catch(() => ({}));

  if (!respuesta.ok) {
    const detalle =
      typeof datos.detail === "string"
        ? datos.detail
        : respuesta.statusText || "Error del servidor";

    throw new Error(
      `HTTP ${respuesta.status} (${ruta}): ${detalle}`
    );
  }

  return datos;
}

// ======================================================
// GUARDAR Y RECUPERAR CARRITO
// ======================================================

function guardarCarrito() {
  const productos = [...carrito.entries()]
    .map(([id, cantidad]) => ({
      id,
      cantidad
    }));

  localStorage.setItem(
    STORAGE,
    JSON.stringify(productos)
  );
}

function cargarCarritoLocal() {
  try {
    const productos = JSON.parse(
      localStorage.getItem(STORAGE) || "[]"
    );

    if (!Array.isArray(productos)) {
      return;
    }

    for (const producto of productos) {
      if (
        typeof producto.id === "string" &&
        Number.isInteger(producto.cantidad) &&
        producto.cantidad > 0
      ) {
        carrito.set(
          producto.id,
          Math.min(producto.cantidad, 100)
        );
      }
    }
  } catch {
    localStorage.removeItem(STORAGE);
  }
}

// ======================================================
// CATÁLOGO PÚBLICO
// ======================================================

async function cargarCatalogo() {
  try {
    const productos = await solicitar(
      "/catalogo_publico",
      {},
      false
    );

    catalogo.clear();

    for (const producto of productos) {
      catalogo.set(producto.id, producto);
    }

    pintarCarrito();
  } catch (error) {
    aviso(
      "No se pudo consultar el catálogo: " +
      error.message
    );
  }
}

// ======================================================
// AGREGAR PRODUCTOS
// ======================================================

function agregarProducto(id, cantidad = 1) {
  const producto = catalogo.get(id);

  if (!producto) {
    aviso(
      "El catálogo todavía no está disponible."
    );
    return;
  }

  const disponible = Math.max(
    0,
    Number(producto.cantidad || 0)
  );

  const nuevo = (carrito.get(id) || 0) + cantidad;

  if (
    disponible <= 0 ||
    nuevo > disponible ||
    nuevo > 100
  ) {
    aviso(
      `No hay suficientes unidades de ${
        producto.nombre || "este producto"
      }.`
    );

    return;
  }

  carrito.set(id, nuevo);

  idSolicitud = null;
  precioCotizado = null;

  guardarCarrito();
  pintarCarrito();

  aviso("Producto agregado al carrito.");
}

// ======================================================
// CAMBIAR CANTIDADES
// ======================================================

function cambiarCantidad(id, cantidad) {
  const disponible = Number(
    catalogo.get(id)?.cantidad || 0
  );

  const maximo = Math.min(
    100,
    Math.max(0, disponible)
  );

  if (cantidad > maximo) {
    aviso("No hay suficiente inventario.");
    return;
  }

  if (cantidad <= 0) {
    carrito.delete(id);
  } else {
    carrito.set(id, cantidad);
  }

  idSolicitud = null;
  precioCotizado = null;

  guardarCarrito();
  pintarCarrito();
}

function vaciarCarrito() {
  carrito.clear();

  idSolicitud = null;
  precioCotizado = null;

  guardarCarrito();
  pintarCarrito();
}

// ======================================================
// DIBUJAR CARRITO
// ======================================================

function pintarCarrito() {
  const tbody = document.querySelector(
    "#lista-carrito tbody"
  );

  if (!tbody) return;

  tbody.replaceChildren();

  let totalEstimado = 0;
  let cantidadTotal = 0;

  for (const [id, cantidad] of carrito) {
    const producto = catalogo.get(id);

    const precio = Number(
      producto?.precio || 0
    );

    totalEstimado += precio * cantidad;
    cantidadTotal += cantidad;

    const fila = document.createElement("tr");

    const tdImagen = document.createElement("td");
    const imagen = document.createElement("img");

    const origen = producto?.imagen || "";

    imagen.src =
      /^https?:\/\//.test(origen) ||
      /^images\//.test(origen)
        ? origen
        : "images/images/muffin.jpg";

    imagen.width = 56;
    imagen.alt = producto?.nombre || "Producto";

    tdImagen.append(imagen);

    const tdNombre = document.createElement("td");

    tdNombre.textContent =
      producto?.nombre || `Producto (${id.slice(0, 6)})`;

    const tdPrecio = document.createElement("td");

    tdPrecio.textContent = dinero(precio);

    const tdCantidad = document.createElement("td");

    const botonMenos = document.createElement("button");

    botonMenos.type = "button";
    botonMenos.textContent = "−";
    botonMenos.className = "carrito-cantidad";

    botonMenos.dataset.accion = "menos";
    botonMenos.dataset.id = id;

    const cantidadTexto = document.createElement("span");
    cantidadTexto.textContent = ` ${cantidad} `;

    const botonMas = document.createElement("button");

    botonMas.type = "button";
    botonMas.textContent = "+";
    botonMas.className = "carrito-cantidad";

    botonMas.dataset.accion = "mas";
    botonMas.dataset.id = id;

    tdCantidad.append(
      botonMenos,
      cantidadTexto,
      botonMas
    );

    const tdAcciones = document.createElement("td");

    const botonBorrar = document.createElement("button");

    botonBorrar.type = "button";
    botonBorrar.textContent = "Quitar";

    botonBorrar.dataset.accion = "borrar";
    botonBorrar.dataset.id = id;

    tdAcciones.append(botonBorrar);

    fila.append(
      tdImagen,
      tdNombre,
      tdPrecio,
      tdCantidad,
      tdAcciones
    );

    tbody.append(fila);
  }

  if ($("total")) {
    $("total").textContent =
      totalEstimado.toFixed(2);
  }

  if ($("carrito-cantidad-total")) {
    $("carrito-cantidad-total").textContent =
      String(cantidadTotal);
  }
}

// ======================================================
// ABRIR CHECKOUT
// ======================================================

async function abrirCheckout() {
  if (!carrito.size) {
    aviso(
      "Primero agrega productos al carrito."
    );

    return;
  }

  const usuario = await esperarAutenticacion();

  if (!usuario) {
    mostrarModal("login-modal");

    aviso(
      "Inicia sesión para finalizar la compra."
    );

    return;
  }

  precioCotizado = null;

  mostrarError("");
  mostrarModal("checkout-modal");

  try {
    const configuracion = await solicitar(
      "/etapa4/config"
    );

    modoDemo = Boolean(configuracion.modo_demo);

    const opcionDemo = document.querySelector(
      '#checkout-metodo option[value="demo"]'
    );

    if (opcionDemo) {
      opcionDemo.hidden = !modoDemo;
      opcionDemo.disabled = !modoDemo;
    }

    if ($("checkout-demo-aviso")) {
      $("checkout-demo-aviso").hidden = !modoDemo;
    }

    const monedero = await solicitar("/monedero");

    saldoMonedero = Number(
      monedero.saldo_centavos || 0
    );

    if ($("wallet-balance")) {
      $("wallet-balance").textContent =
        dinero(saldoMonedero / 100);
    }

    await cotizar();
  } catch (error) {
    mostrarError(error.message);
  }
}

// ======================================================
// ITEMS PARA ENVIAR AL BACKEND
// ======================================================

function obtenerItems() {
  return [...carrito.entries()]
    .map(([producto_id, cantidad]) => ({
      producto_id,
      cantidad
    }));
}

// ======================================================
// COTIZAR PRECIOS, DESCUENTOS E IMPUESTOS
// ======================================================

async function cotizar() {
  if (!carrito.size) return;

  precioCotizado = null;

  const desglose = $("checkout-desglose");

  if (desglose) {
    desglose.textContent =
      "Calculando importes desde el servidor...";
  }

  try {
    const datos = await solicitar(
      "/checkout/cotizar",
      {
        method: "POST",
        body: JSON.stringify({
          items: obtenerItems(),
          codigo_promocion:
            $("checkout-cupon")?.value.trim() || ""
        })
      }
    );

    precioCotizado = datos;

    if (desglose) {
      desglose.replaceChildren();
    }

    const conceptos = [
      ["Subtotal", datos.subtotal],
      ["Descuento", -datos.descuento],
      ["Impuestos", datos.impuestos],
      ["Total", datos.total]
    ];

    for (const [etiqueta, valor] of conceptos) {
      const fila = document.createElement("p");
      const titulo = document.createElement("strong");

      titulo.textContent = etiqueta + ": ";

      fila.append(
        titulo,
        document.createTextNode(dinero(valor))
      );

      desglose?.append(fila);
    }

    if ($("checkout-subtotal")) {
      $("checkout-subtotal").textContent =
        Number(datos.subtotal).toFixed(2);
    }

    if ($("checkout-total")) {
      $("checkout-total").textContent =
        Number(datos.total).toFixed(2);
    }

    mostrarError("");
  } catch (error) {
    mostrarError(error.message);

    if (desglose) {
      desglose.textContent =
        "No se pudo calcular el total de compra.";
    }
  }
}

// ======================================================
// CONFIRMAR PEDIDO
// ======================================================

async function confirmarCompra() {
  const boton = $("btn-pay-now");

  if (!precioCotizado) {
    mostrarError(
      "Primero obtén una cotización válida."
    );

    return;
  }

  const metodo = $("checkout-metodo")?.value || "monedero";
  const entrega = $("checkout-entrega")?.value || "recoger";
  const direccion = $("checkout-direccion")?.value.trim() || "";

  if (!modoDemo && metodo === "demo") {
    mostrarError(
      "Los pagos simulados no están habilitados."
    );
    return;
  }

  if (entrega === "domicilio" && !direccion) {
    mostrarError(
      "Introduce una dirección de entrega."
    );

    return;
  }

  if (!idSolicitud) {
    idSolicitud = nuevaSolicitud();
  }

  if (boton) {
    boton.disabled = true;
    boton.textContent = "Registrando pedido...";
  }

  try {
    const resultado = await solicitar(
      "/checkout/confirmar",
      {
        method: "POST",
        body: JSON.stringify({
          solicitud_id: idSolicitud,
          items: obtenerItems(),
          codigo_promocion:
            $("checkout-cupon")?.value.trim() || "",
          metodo_pago: metodo,
          tipo_entrega: entrega,
          direccion,
          requiere_factura:
            Boolean($("invoice-check")?.checked),
          total_aceptado_centavos:
            precioCotizado.total_centavos
        })
      }
    );

    const pedido = resultado.pedido;

    mostrarModal("checkout-modal", false);

    if ($("receipt-id")) {
      $("receipt-id").textContent =
        pedido.folio || pedido.id;
    }

    if ($("receipt-date")) {
      $("receipt-date").textContent =
        new Date(pedido.fecha).toLocaleString("es-MX");
    }

    if ($("receipt-total")) {
      $("receipt-total").textContent =
        Number(pedido.total).toFixed(2);
    }

    if ($("receipt-estado")) {
      $("receipt-estado").textContent =
        pedido.estado;
    }

    if ($("receipt-aviso")) {
      if (pedido.simulacion_academica) {
        $("receipt-aviso").textContent =
          "Pago simulado. Comprobante académico.";
      } else if (pedido.estado_pago === "pendiente") {
        $("receipt-aviso").textContent =
          "Pago pendiente de verificación. " +
          "El inventario todavía no se descuenta.";
      } else {
        $("receipt-aviso").textContent =
          "Compra registrada correctamente.";
      }
    }

    mostrarModal("receipt-modal");

    vaciarCarrito();

  } catch (error) {
    // El ID permanece para que reintentar no duplique el pedido.
    mostrarError(error.message);
  } finally {
    if (boton) {
      boton.disabled = false;
      boton.textContent = "Confirmar pedido";
    }
  }
}

// ======================================================
// DETALLE DEL PRODUCTO
// ======================================================

function abrirDetalle(id) {
  const producto = catalogo.get(id);
  if (!producto) return;

  if ($("detalle-producto-nombre")) {
    $("detalle-producto-nombre").textContent =
      producto.nombre || "Producto";
  }

  if ($("detalle-producto-descripcion")) {
    $("detalle-producto-descripcion").textContent =
      producto.descripcion || "Producto artesanal";
  }

  if ($("detalle-producto-precio")) {
    $("detalle-producto-precio").textContent =
      dinero(producto.precio);
  }

  if ($("detalle-producto-stock")) {
    $("detalle-producto-stock").textContent =
      `Disponible: ${producto.cantidad || 0} piezas`;
  }

  if ($("detalle-producto-img")) {
    const origen = producto.imagen || "";

    $("detalle-producto-img").src =
      /^https?:\/\//.test(origen) ||
      /^images\//.test(origen)
        ? origen
        : "images/images/muffin.jpg";
  }

  const boton = $("detalle-producto-agregar");

  if (boton) {
    boton.dataset.id = id;
  }

  mostrarModal("detalle-producto-modal");
}

// ======================================================
// BÚSQUEDA Y ORDENAMIENTO
// ======================================================

function filtrarProductos() {
  const busqueda = (
    $("buscador-productos")?.value || ""
  ).toLocaleLowerCase("es-MX").trim();

  const orden = $("ordenar-productos")?.value || "normal";

  document.querySelectorAll(".products-content")
    .forEach(contenedor => {
      const tarjetas = [
        ...contenedor.querySelectorAll(".product")
      ];

      tarjetas.forEach(tarjeta => {
        const nombre =
          tarjeta.querySelector("h3")
            ?.textContent
            ?.toLocaleLowerCase("es-MX") || "";

        tarjeta.hidden = !nombre.includes(busqueda);
      });

      if (orden !== "normal") {
        tarjetas.sort((a, b) => {
          const productoA = catalogo.get(
            a.querySelector("[data-id]")?.dataset.id
          );

          const productoB = catalogo.get(
            b.querySelector("[data-id]")?.dataset.id
          );

          const precioA = Number(
            productoA?.precio || 0
          );

          const precioB = Number(
            productoB?.precio || 0
          );

          return orden === "menor"
            ? precioA - precioB
            : precioB - precioA;
        });

        tarjetas.forEach(tarjeta => {
          contenedor.append(tarjeta);
        });
      }
    });
}

// ======================================================
// EVENTOS DE LA TIENDA
// ======================================================

function configurarEventos() {
  // PRODUCTOS
  document.querySelectorAll(".products-content")
    .forEach(contenedor => {
      contenedor.addEventListener(
        "click",
        evento => {
          const tarjeta = evento.target.closest(".product");
          if (!tarjeta) return;

          const id = tarjeta.querySelector(
            ".agregar-carrito"
          )?.dataset.id;

          if (!id) return;

          if (evento.target.closest(".agregar-carrito")) {
            evento.preventDefault();
            agregarProducto(id);
          } else if (evento.target.closest("img, h3")) {
            evento.preventDefault();
            abrirDetalle(id);
          }
        }
      );
    });

  // DETALLE
  $("detalle-producto-agregar")?.addEventListener(
    "click",
    evento => {
      agregarProducto(evento.currentTarget.dataset.id);

      mostrarModal("detalle-producto-modal", false);
    }
  );

  $("cerrar-detalle-producto")?.addEventListener(
    "click",
    () => mostrarModal("detalle-producto-modal", false)
  );

  // CANTIDADES
  document.querySelector("#lista-carrito tbody")
    ?.addEventListener(
      "click",
      evento => {
        const boton = evento.target.closest(
          "[data-accion]"
        );

        if (!boton) return;

        const id = boton.dataset.id;
        const cantidad = carrito.get(id) || 0;

        if (boton.dataset.accion === "mas") {
          cambiarCantidad(id, cantidad + 1);
        }

        if (boton.dataset.accion === "menos") {
          cambiarCantidad(id, cantidad - 1);
        }

        if (boton.dataset.accion === "borrar") {
          cambiarCantidad(id, 0);
        }
      }
    );

  $("vaciar-carrito")?.addEventListener(
    "click",
    evento => {
      evento.preventDefault();
      vaciarCarrito();
    }
  );

  $("finalizar-compra")?.addEventListener(
    "click",
    evento => {
      evento.preventDefault();
      abrirCheckout();
    }
  );

  // CHECKOUT
  $("btn-pay-now")?.addEventListener(
    "click",
    confirmarCompra
  );

  $("checkout-aplicar-cupon")?.addEventListener(
    "click",
    cotizar
  );

  $("checkout-cupon")?.addEventListener(
    "input",
    () => {
      precioCotizado = null;

      mostrarError(
        "El cupón cambió. Pulsa Aplicar para actualizar el total."
      );
    }
  );

  $("checkout-entrega")?.addEventListener(
    "change",
    evento => {
      if ($("checkout-direccion-contenedor")) {
        $("checkout-direccion-contenedor").hidden =
          evento.target.value !== "domicilio";
      }
    }
  );

  // CERRAR MODALES
  const modales = [
    ["close-checkout", "checkout-modal"],
    ["close-receipt", "receipt-modal"],
    ["btn-close-receipt-action", "receipt-modal"],
    ["cerrar-detalle-producto", "detalle-producto-modal"]
  ];

  for (const [botonId, modalId] of modales) {
    $(botonId)?.addEventListener(
      "click",
      () => mostrarModal(modalId, false)
    );
  }

  // PERFIL
  $("nav-profile")?.addEventListener(
    "click",
    async evento => {
      evento.preventDefault();

      const usuario = await esperarAutenticacion();

      if (usuario) {
        window.location.href = "views/user.html";
      } else {
        mostrarModal("login-modal");
      }
    }
  );

  // PANEL DE ADMINISTRACIÓN / MANTENIMIENTO
  $("nav-admin")?.addEventListener(
    "click",
    async evento => {
      evento.preventDefault();
      const usuario = await esperarAutenticacion();
      if (!usuario) {
        mostrarModal("login-modal");
        return;
      }
      try {
        // El perfil lo valida el servidor al acceder a recursos.
        const perfil = await consultarRolUsuario(usuario.uid);
        if (perfil === "mantenimiento") {
          window.location.href = "views/etapa4-gestion.html";
        } else if (["admin", "ventas", "logistica"].includes(perfil)) {
          window.location.href = "views/admin.html";
        } else {
          aviso("El panel está reservado al personal autorizado.");
        }
      } catch (error) {
        aviso("No fue posible verificar los permisos: " + error.message);
      }
    }
  );

  // CERRAR SESIÓN
  $("cerrar-sesion-tienda")?.addEventListener(
    "click",
    async () => {
      try {
        await signOut(auth);

        localStorage.removeItem("isLoggedIn");
        localStorage.removeItem("usuarioActual");

        mostrarModal("login-modal", false);

        aviso(
          "Sesión cerrada. Puedes iniciar con otra cuenta."
        );
      } catch (error) {
        aviso(
          "No se pudo cerrar sesión: " + error.message
        );
      }
    }
  );

  $("close-login")?.addEventListener(
    "click",
    () => mostrarModal("login-modal", false)
  );

  // BÚSQUEDA
  $("buscador-productos")?.addEventListener(
    "input",
    filtrarProductos
  );

  $("ordenar-productos")?.addEventListener(
    "change",
    filtrarProductos
  );

  // COOKIES
  $("cookie-accept")?.addEventListener(
    "click",
    () => {
      localStorage.setItem(
        "cookiesAceptadas",
        "si"
      );

      if ($("cookie-banner")) {
        $("cookie-banner").style.display = "none";
      }
    }
  );

  if ($("cookie-banner")) {
    $("cookie-banner").style.display =
      localStorage.getItem("cookiesAceptadas") === "si"
        ? "none"
        : "flex";
  }

  // CERRAR MODALES HACIENDO CLIC FUERA
  window.addEventListener(
    "click",
    evento => {
      for (const id of [
        "login-modal",
        "checkout-modal",
        "receipt-modal",
        "detalle-producto-modal"
      ]) {
        if (evento.target === $(id)) {
          mostrarModal(id, false);
        }
      }
    }
  );
}

// ======================================================
// INICIAR LA TIENDA
// ======================================================

cargarCarritoLocal();
configurarEventos();
cargarCatalogo();
