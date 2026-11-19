
import {
  initializeApp, getApps, getApp
} from "https://www.gstatic.com/firebasejs/10.5.0/firebase-app.js";

import {
  getAuth, onAuthStateChanged, signOut
} from "https://www.gstatic.com/firebasejs/10.5.0/firebase-auth.js";

import {
  getFirestore, doc, getDoc, updateDoc
} from "https://www.gstatic.com/firebasejs/10.5.0/firebase-firestore.js";

// CONFIGURACIÓN FIREBASE
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

const $ = id => document.getElementById(id);

const dinero = valor =>
  new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN"
  }).format(Number(valor) || 0);

const fecha = valor =>
  valor ? new Date(valor).toLocaleString("es-MX") : "Sin fecha";

let usuarioActual = null;
let modoDemo = false;
let pedidos = [];

// ======================================================
// API AUTENTICADA
// ======================================================

async function api(ruta, opciones = {}) {
  if (!usuarioActual) {
    throw new Error("Debes iniciar sesión.");
  }

  const token = await usuarioActual.getIdToken();

  const headers = {
    ...(opciones.headers || {}),
    Authorization: `Bearer ${token}`
  };

  if (opciones.body) {
    headers["Content-Type"] = "application/json";
  }

  const respuesta = await fetch(`${API}${ruta}`, {
    ...opciones,
    headers,
    cache: "no-store"
  });

  const datos = await respuesta.json().catch(() => ({}));

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

function mensaje(texto, error = false) {
  const elemento = $("perfil-mensaje");
  if (!elemento) return;

  elemento.textContent = texto;
  elemento.style.color = error ? "#ba2b20" : "#007b61";
}

function celda(fila, texto) {
  const td = document.createElement("td");
  td.textContent = String(texto ?? "");
  fila.append(td);
  return td;
}

function modal(id, visible) {
  const elemento = $(id);

  if (elemento) {
    elemento.style.display = visible ? "block" : "none";
  }
}

// ======================================================
// MI PERFIL
// ======================================================

async function cargarPerfil() {
  const referencia = doc(
    db,
    "usuarios",
    usuarioActual.uid
  );

  const snapshot = await getDoc(referencia);

  if (!snapshot.exists()) {
    throw new Error(
      "Falta tu perfil en Firestore (usuarios/{UID})."
    );
  }

  const perfil = snapshot.data();

  $("perfil-nombre").value = perfil.nombre || "";
  $("perfil-telefono").value = perfil.telefono || "";
  $("perfil-correo").textContent = usuarioActual.email || "";
  $("perfil-rol").textContent = perfil.rol || "cliente";
}

async function guardarPerfil(evento) {
  evento.preventDefault();

  const nombre = $("perfil-nombre").value.trim();
  const telefono = $("perfil-telefono").value.trim();

  if (!nombre) {
    mensaje("Introduce tu nombre.", true);
    return;
  }

  try {
    await updateDoc(
      doc(db, "usuarios", usuarioActual.uid),
      {
        nombre,
        telefono
      }
    );

    mensaje("Datos del perfil actualizados.");
  } catch (error) {
    mensaje(error.message, true);
  }
}

// ======================================================
// MIS PEDIDOS
// ======================================================

async function cargarPedidos() {
  pedidos = await api("/pedidos/mios");

  const tbody = $("historial-body");
  tbody.replaceChildren();

  if (!pedidos.length) {
    const fila = document.createElement("tr");
    const td = celda(fila, "Aún no tienes pedidos.");
    td.colSpan = 5;
    tbody.append(fila);
    return;
  }

  for (const pedido of pedidos) {
    const fila = document.createElement("tr");

    celda(fila, pedido.folio || pedido.id);
    celda(fila, fecha(pedido.fecha));
    celda(fila, dinero(pedido.total));

    celda(
      fila,
      pedido.estado_entrega || pedido.estado
    );

    const acciones = celda(fila, "");

    for (const [accion, etiqueta] of [
      ["detalle", "Ver detalle"],
      ["seguimiento", "Seguimiento"]
    ]) {
      const boton = document.createElement("button");

      boton.type = "button";
      boton.className = "btn-perfil";
      boton.textContent = etiqueta;

      boton.dataset.pedido = pedido.id;
      boton.dataset.accion = accion;

      acciones.append(boton);
    }

    tbody.append(fila);
  }
}

// ======================================================
// DETALLES Y SEGUIMIENTO
// ======================================================

function mostrarPedido(id, accion) {
  const pedido = pedidos.find(p => p.id === id);
  if (!pedido) return;

  if (accion === "detalle") {
    $("detalle-titulo").textContent =
      `Pedido ${pedido.folio || id}`;

    const tbody = document.querySelector(
      "#detalle-pedido-tabla tbody"
    );

    tbody.replaceChildren();

    for (const item of pedido.items || []) {
      const fila = document.createElement("tr");

      celda(fila, item.nombre);
      celda(fila, item.cantidad);
      celda(fila, dinero(item.precio_unitario));
      celda(fila, dinero(item.subtotal));

      tbody.append(fila);
    }

    $("detalle-total").textContent =
      dinero(pedido.total);

    $("detalle-pago").textContent =
      `${pedido.metodo_pago || "No indicado"} · ${
        pedido.estado_pago || pedido.estado
      }`;

    modal("detalle-modal", true);
    return;
  }

  if (accion === "seguimiento") {
    $("seguimiento-titulo").textContent =
      `Seguimiento ${pedido.folio || id}`;

    const lista = $("seguimiento-pasos");
    lista.replaceChildren();

    const historial = pedido.historial_estados || [];

    if (!historial.length) {
      const li = document.createElement("li");
      li.textContent = "Aún no hay seguimiento registrado.";
      lista.append(li);
    }

    for (const evento of historial) {
      const li = document.createElement("li");
      li.className = "step-completed";

      const titulo = document.createElement("strong");
      titulo.textContent = evento.estado;

      const fechaPaso = document.createElement("div");
      fechaPaso.className = "step-time";
      fechaPaso.textContent = fecha(evento.fecha);

      li.append(titulo, fechaPaso);
      lista.append(li);
    }

    modal("seguimiento-modal", true);
  }
}

// ======================================================
// MONEDERO ELECTRÓNICO
// ======================================================

async function cargarMonedero() {
  const [saldo, movimientos] = await Promise.all([
    api("/monedero"),
    api("/monedero/movimientos")
  ]);

  $("monedero-saldo").textContent =
    dinero(saldo.saldo);

  const tbody = $("monedero-movimientos-body");
  tbody.replaceChildren();

  if (!movimientos.length) {
    const fila = document.createElement("tr");
    const td = celda(fila, "Sin movimientos");
    td.colSpan = 4;
    tbody.append(fila);
  }

  for (const movimiento of movimientos) {
    const fila = document.createElement("tr");

    celda(fila, fecha(movimiento.fecha));

    celda(
      fila,
      movimiento.concepto || movimiento.tipo
    );

    celda(
      fila,
      dinero((movimiento.monto_centavos || 0) / 100)
    );

    celda(
      fila,
      dinero(
        (movimiento.saldo_resultante_centavos || 0) / 100
      )
    );

    tbody.append(fila);
  }
}

async function recargarDemo() {
  if (!modoDemo) return;

  const monto = Number($("recarga-monto").value);

  if (
    !Number.isFinite(monto) ||
    monto < 1 ||
    monto > 2000
  ) {
    mensaje(
      "La recarga simulada debe estar entre $1 y $2,000.",
      true
    );
    return;
  }

  const boton = $("recargar-demo");
  boton.disabled = true;

  try {
    const solicitud_id =
      crypto.randomUUID().replaceAll("-", "");

    await api("/monedero/recarga-simulada", {
      method: "POST",
      body: JSON.stringify({
        solicitud_id,
        monto_centavos: Math.round(monto * 100)
      })
    });

    mensaje(
      "Recarga ficticia registrada. No se movió dinero real."
    );

    await cargarMonedero();
  } catch (error) {
    mensaje(error.message, true);
  } finally {
    boton.disabled = false;
  }
}

// ======================================================
// TICKETS DE ATENCIÓN
// ======================================================

async function cargarTickets() {
  const tickets = await api("/tickets");

  const tbody = $("tickets-body");
  tbody.replaceChildren();

  if (!tickets.length) {
    const fila = document.createElement("tr");
    const td = celda(fila, "No tienes tickets");
    td.colSpan = 4;
    tbody.append(fila);
  }

  for (const ticket of tickets) {
    const fila = document.createElement("tr");

    celda(fila, fecha(ticket.fecha));
    celda(fila, ticket.asunto);
    celda(fila, ticket.estado);
    celda(fila, ticket.respuesta || "Pendiente");

    tbody.append(fila);
  }
}

async function crearTicket(evento) {
  evento.preventDefault();

  const boton = $("ticket-enviar");
  boton.disabled = true;

  try {
    await api("/tickets", {
      method: "POST",
      body: JSON.stringify({
        asunto: $("ticket-asunto").value,
        mensaje: $("ticket-mensaje").value.trim(),
        pedido_id: $("ticket-pedido").value || null
      })
    });

    $("ticket-mensaje").value = "";

    mensaje("Ticket registrado correctamente.");
    await cargarTickets();
  } catch (error) {
    mensaje(error.message, true);
  } finally {
    boton.disabled = false;
  }
}

// ======================================================
// INICIALIZACIÓN DE LA CUENTA
// ======================================================

async function cargarTodo() {
  const resultados = await Promise.allSettled([
    cargarPerfil(),
    cargarPedidos(),
    cargarMonedero(),
    cargarTickets()
  ]);

  for (const resultado of resultados) {
    if (resultado.status === "rejected") {
      mensaje(resultado.reason.message, true);
    }
  }

  const selector = $("ticket-pedido");
  selector.replaceChildren();

  const vacio = document.createElement("option");
  vacio.value = "";
  vacio.textContent = "Sin pedido asociado";
  selector.append(vacio);

  for (const pedido of pedidos) {
    const opcion = document.createElement("option");

    opcion.value = pedido.id;
    opcion.textContent = pedido.folio || pedido.id;

    selector.append(opcion);
  }
}

function manejarEventos() {
  $("perfil-form")?.addEventListener(
    "submit",
    guardarPerfil
  );

  $("ticket-form")?.addEventListener(
    "submit",
    crearTicket
  );

  $("recargar-demo")?.addEventListener(
    "click",
    recargarDemo
  );

  $("cerrar-sesion")?.addEventListener(
    "click",
    async () => {
      await signOut(auth);

      localStorage.removeItem("isLoggedIn");
      localStorage.removeItem("usuarioActual");

      window.location.replace("../index.html");
    }
  );

  $("historial-body")?.addEventListener(
    "click",
    evento => {
      const boton = evento.target.closest("[data-accion]");
      if (!boton) return;

      mostrarPedido(
        boton.dataset.pedido,
        boton.dataset.accion
      );
    }
  );

  document.querySelectorAll("[data-cerrar-modal]")
    .forEach(boton => {
      boton.addEventListener("click", () => {
        modal(boton.dataset.cerrarModal, false);
      });
    });

  window.addEventListener("click", evento => {
    if (evento.target?.classList.contains("modal")) {
      modal(evento.target.id, false);
    }
  });

  document.querySelectorAll("[data-pestana]")
    .forEach(boton => {
      boton.addEventListener("click", () => {
        const activa = boton.dataset.pestana;

        document.querySelectorAll("[data-pestana]")
          .forEach(b => {
            b.classList.toggle(
              "activa",
              b.dataset.pestana === activa
            );
          });

        document.querySelectorAll("[data-vista]")
          .forEach(vista => {
            vista.hidden =
              vista.dataset.vista !== activa;
          });
      });
    });
}

manejarEventos();

onAuthStateChanged(auth, async usuario => {
  if (!usuario) {
    window.location.replace("../index.html");
    return;
  }

  usuarioActual = usuario;

  try {
    const configuracion = await api("/etapa4/config");
    modoDemo = Boolean(configuracion.modo_demo);

    $("contenedor-recarga-demo").hidden = !modoDemo;
  } catch (error) {
    $("contenedor-recarga-demo").hidden = true;
    console.warn(
      "No se pudo cargar la configuración de Etapa 4:",
      error.message
    );
  }

  await cargarTodo();
});
