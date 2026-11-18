// La Nueva Ideal · Etapa 4 — Carrito y checkout.
// Requiere que index.html cargue este archivo como type="module".
// Los precios, el stock y el monedero definitivos siempre se calculan en FastAPI.
import { initializeApp, getApps, getApp } from 'https://www.gstatic.com/firebasejs/10.5.0/firebase-app.js';
import { getAuth, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.5.0/firebase-auth.js';

const FIREBASE_CONFIG = {
  apiKey: 'AIzaSyBns2UIA_ED5CsjBMEmJxUYLqxp1PRXlGo',
  authDomain: 'weblanuevaideal.firebaseapp.com',
  projectId: 'weblanuevaideal',
  storageBucket: 'weblanuevaideal.firebasestorage.app',
  messagingSenderId: '783648403901',
  appId: '1:783648403901:web:f52f6438c6afcf12cb62d4'
};
const API = 'https://panaderia-la-nuevaideal.onrender.com';
const app = getApps().length ? getApp() : initializeApp(FIREBASE_CONFIG);
const auth = getAuth(app);
const $ = id => document.getElementById(id);
const dinero = n => new Intl.NumberFormat('es-MX', { style:'currency', currency:'MXN' }).format(Number(n) || 0);
const STORAGE = 'laNuevaIdeal_carrito_v4';
const carrito = new Map();
const catalogo = new Map();
let usuarioActual = null;
let idSolicitud = null;
let precioCotizado = null;
let modoDemo = false;
let saldoMonedero = 0;

function idNuevo() {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID().replaceAll('-', '')
    : `compra_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

function mostrarError(texto) {
  const elemento = $('checkout-error');
  if (elemento) { elemento.textContent = texto || ''; elemento.hidden = !texto; }
}
function aviso(texto) {
  const div = $('carrito-aviso');
  if (div) { div.textContent = texto; div.hidden = !texto; }
  else if (texto) alert(texto);
}

async function esperarAutenticacion() {
  if (usuarioActual) return usuarioActual;
  return new Promise(resolve => {
    const detener = onAuthStateChanged(auth, u => { detener(); resolve(u); }, () => resolve(null));
  });
}
async function solicitar(ruta, opciones = {}, privado = true) {
  const headers = { ...(opciones.headers || {}) };
  if (opciones.body) headers['Content-Type'] = 'application/json';
  if (privado) {
    const usuario = await esperarAutenticacion();
    if (!usuario) throw new Error('Inicia sesión para continuar.');
    headers.Authorization = `Bearer ${await usuario.getIdToken()}`;
  }
  const response = await fetch(`${API}${ruta}`, { ...opciones, headers, cache:'no-store' });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.detail || `HTTP ${response.status}`);
  return data;
}

function guardarCarrito() {
  localStorage.setItem(STORAGE, JSON.stringify([...carrito.entries()].map(([id, cantidad]) => ({id, cantidad}))));
}
function cargarCarritoLocal() {
  try {
    const arr = JSON.parse(localStorage.getItem(STORAGE) || '[]');
    if (!Array.isArray(arr)) return;
    for (const item of arr) {
      if (typeof item.id === 'string' && Number.isInteger(item.cantidad) && item.cantidad > 0)
        carrito.set(item.id, Math.min(item.cantidad, 100));
    }
  } catch { localStorage.removeItem(STORAGE); }
}
async function cargarCatalogo() {
  try {
    const lista = await solicitar('/catalogo_publico', {}, false);
    catalogo.clear();
    for (const p of lista) catalogo.set(p.id, p);
    pintarCarrito();
  } catch (e) { aviso(`No se pudo consultar el catálogo: ${e.message}`); }
}
function agregarProducto(id, cantidad = 1) {
  const producto = catalogo.get(id);
  if (!producto) { aviso('El catálogo todavía no está disponible.'); return; }
  const disponible = Math.max(0, Number(producto.cantidad || 0));
  const nuevo = (carrito.get(id) || 0) + cantidad;
  if (disponible <= 0 || nuevo > disponible || nuevo > 100) {
    aviso(`No hay suficientes unidades de ${producto.nombre || 'este producto'}.`); return;
  }
  carrito.set(id, nuevo); idSolicitud = null; precioCotizado = null; guardarCarrito(); pintarCarrito(); aviso('Producto agregado.');
}
function cambiarCantidad(id, cantidad) {
  const maximo = Math.min(100, Math.max(0, Number(catalogo.get(id)?.cantidad || 0)));
  if (cantidad > maximo) { aviso('No hay suficiente inventario.'); return; }
  if (cantidad <= 0) carrito.delete(id); else carrito.set(id, cantidad);
  idSolicitud = null; precioCotizado = null; guardarCarrito(); pintarCarrito();
}
function vaciarCarrito() { carrito.clear(); guardarCarrito(); idSolicitud = null; precioCotizado = null; pintarCarrito(); }
function pintarCarrito() {
  const tbody = document.querySelector('#lista-carrito tbody');
  if (!tbody) return;
  tbody.replaceChildren();
  let total = 0;
  for (const [id, cantidad] of carrito) {
    const p = catalogo.get(id);
    const precio = Number(p?.precio || 0);
    total += precio * cantidad;
    const tr = document.createElement('tr');
    const tdImg = document.createElement('td');
    const img = document.createElement('img');
    img.src = p?.imagen && (/^https?:\/\//.test(p.imagen) || /^images\//.test(p.imagen)) ? p.imagen : 'images/images/muffin.jpg';
    img.width = 56; img.alt = p?.nombre || 'Producto'; tdImg.append(img);
    const tdNombre = document.createElement('td'); tdNombre.textContent = p?.nombre || `Producto (${id.slice(0, 6)}…)`;
    const tdPrecio = document.createElement('td'); tdPrecio.textContent = dinero(precio);
    const tdCantidad = document.createElement('td');
    const menos = document.createElement('button'); menos.type = 'button'; menos.textContent = '−'; menos.className = 'carrito-cantidad'; menos.dataset.accion='menos'; menos.dataset.id=id;
    const cuenta = document.createElement('span'); cuenta.textContent = ` ${cantidad} `;
    const mas = document.createElement('button'); mas.type = 'button'; mas.textContent='+'; mas.className='carrito-cantidad'; mas.dataset.accion='mas'; mas.dataset.id=id;
    tdCantidad.append(menos,cuenta,mas);
    const tdBorrar = document.createElement('td');
    const borrar = document.createElement('button'); borrar.type='button'; borrar.textContent='Quitar'; borrar.dataset.accion='borrar'; borrar.dataset.id=id;
    tdBorrar.append(borrar);
    tr.append(tdImg,tdNombre,tdPrecio,tdCantidad,tdBorrar); tbody.append(tr);
  }
  if ($('total')) $('total').textContent = total.toFixed(2);
  if ($('carrito-cantidad-total')) $('carrito-cantidad-total').textContent = String([...carrito.values()].reduce((a,b)=>a+b,0));
}

function mostrarModal(id, mostrar=true) { const nodo=$(id); if (nodo) nodo.style.display=mostrar?'block':'none'; }
async function abrirCheckout() {
  if (!carrito.size) { aviso('Primero agrega productos al carrito.'); return; }
  if (!await esperarAutenticacion()) { mostrarModal('login-modal'); aviso('Inicia sesión y regresa al carrito para finalizar la compra.'); return; }
  mostrarError('');
  mostrarModal('checkout-modal');
  try {
    const config = await solicitar('/etapa4/config');
    modoDemo = Boolean(config.modo_demo);
    const demo = document.querySelector('option[value="demo"]');
    if (demo) demo.hidden = !modoDemo;
    if ($('checkout-demo-aviso')) $('checkout-demo-aviso').hidden = !modoDemo;
    const saldo = await solicitar('/monedero');
    saldoMonedero = saldo.saldo_centavos || 0;
    if ($('wallet-balance')) $('wallet-balance').textContent = dinero(saldoMonedero / 100);
    await cotizar();
  } catch(e) { mostrarError(e.message); }
}
function obtenerItems() { return [...carrito].map(([producto_id,cantidad])=>({producto_id,cantidad})); }
async function cotizar() {
  if (!carrito.size) return;
  precioCotizado = null;
  const contenedor = $('checkout-desglose');
  if (contenedor) contenedor.textContent = 'Calculando importes desde el servidor…';
  try {
    const datos = await solicitar('/checkout/cotizar', {method:'POST',body:JSON.stringify({
      items:obtenerItems(), codigo_promocion:$('checkout-cupon')?.value?.trim() || ''
    })});
    precioCotizado = datos;
    if (contenedor) contenedor.replaceChildren();
    for (const [etiqueta, valor] of [['Subtotal',datos.subtotal],['Descuento',-datos.descuento],['Impuestos',datos.impuestos],['Total',datos.total]]) {
      const linea=document.createElement('p');
      const strong=document.createElement('strong'); strong.textContent=etiqueta+': ';
      linea.append(strong,document.createTextNode(dinero(valor)));
      contenedor?.append(linea);
    }
    if ($('checkout-subtotal')) $('checkout-subtotal').textContent=Number(datos.subtotal).toFixed(2);
    if ($('checkout-total')) $('checkout-total').textContent=Number(datos.total).toFixed(2);
    mostrarError('');
  } catch(e) { mostrarError(e.message); if(contenedor) contenedor.textContent='No se pudo calcular la compra.'; }
}
async function confirmarCompra() {
  const boton = $('btn-pay-now');
  if (!precioCotizado) { mostrarError('Primero obtén una cotización válida.'); return; }
  if (!idSolicitud) idSolicitud=idNuevo();
  const metodo = $('checkout-metodo')?.value || 'monedero';
  const entrega = $('checkout-entrega')?.value || 'recoger';
  const direccion = $('checkout-direccion')?.value?.trim() || '';
  if (entrega==='domicilio' && !direccion) { mostrarError('Escribe una dirección de entrega.'); return; }
  if (boton) { boton.disabled=true; boton.textContent='Registrando pedido…'; }
  try {
    const resultado=await solicitar('/checkout/confirmar', {method:'POST',body:JSON.stringify({
      solicitud_id:idSolicitud, items:obtenerItems(), codigo_promocion:$('checkout-cupon')?.value?.trim() || '',
      metodo_pago:metodo, tipo_entrega:entrega, direccion,
      requiere_factura:Boolean($('invoice-check')?.checked),
      total_aceptado_centavos:precioCotizado.total_centavos
    })});
    const pedido=resultado.pedido;
    mostrarModal('checkout-modal',false);
    if ($('receipt-id')) $('receipt-id').textContent=pedido.folio || pedido.id;
    if ($('receipt-date')) $('receipt-date').textContent=new Date(pedido.fecha).toLocaleString('es-MX');
    if ($('receipt-total')) $('receipt-total').textContent=Number(pedido.total).toFixed(2);
    if ($('receipt-estado')) $('receipt-estado').textContent=pedido.estado;
    if ($('receipt-aviso')) $('receipt-aviso').textContent=pedido.simulacion_academica ? 'Pago simulado. Comprobante académico, NO fiscal.' : pedido.estado_pago==='pendiente' ? 'Pago pendiente de verificar: el inventario aún no se descuenta.' : 'Compra registrada y pagada.';
    mostrarModal('receipt-modal');
    vaciarCarrito();
  } catch(e) { mostrarError(e.message); /* Conservar idSolicitud: reintento idempotente */ }
  finally { if(boton){boton.disabled=false;boton.textContent='Confirmar pedido';} }
}
function abrirDetalle(id) {
  const p=catalogo.get(id); if (!p) return;
  if ($('detalle-producto-nombre')) $('detalle-producto-nombre').textContent=p.nombre || 'Producto';
  if ($('detalle-producto-descripcion')) $('detalle-producto-descripcion').textContent=p.descripcion || 'Producto artesanal';
  if ($('detalle-producto-precio')) $('detalle-producto-precio').textContent=dinero(p.precio);
  if ($('detalle-producto-stock')) $('detalle-producto-stock').textContent=`Disponible: ${p.cantidad || 0} piezas`;
  if ($('detalle-producto-img')) $('detalle-producto-img').src=(p.imagen && (/^https?:\/\//.test(p.imagen) || /^images\//.test(p.imagen)))?p.imagen:'images/images/muffin.jpg';
  const boton=$('detalle-producto-agregar'); if(boton) boton.dataset.id=id;
  mostrarModal('detalle-producto-modal');
}

function configurarEventos() {
  document.querySelectorAll('.products-content').forEach(contenedor => contenedor.addEventListener('click', e=>{
    const producto=e.target.closest('.product'); if(!producto) return;
    const id=producto.querySelector('.agregar-carrito')?.dataset.id;
    if(!id) return;
    if(e.target.closest('.agregar-carrito')) {e.preventDefault(); agregarProducto(id);}
    else if(e.target.closest('img, h3')) {e.preventDefault(); abrirDetalle(id);}
  }));
  $('detalle-producto-agregar')?.addEventListener('click', e=>{agregarProducto(e.currentTarget.dataset.id);mostrarModal('detalle-producto-modal',false);});
  $('cerrar-detalle-producto')?.addEventListener('click',()=>mostrarModal('detalle-producto-modal',false));
  document.querySelector('#lista-carrito tbody')?.addEventListener('click', e=>{
    const b=e.target.closest('[data-accion]');if(!b)return;
    const actual=carrito.get(b.dataset.id)||0;
    if(b.dataset.accion==='mas') cambiarCantidad(b.dataset.id,actual+1);
    if(b.dataset.accion==='menos') cambiarCantidad(b.dataset.id,actual-1);
    if(b.dataset.accion==='borrar') cambiarCantidad(b.dataset.id,0);
  });
  $('vaciar-carrito')?.addEventListener('click',e=>{e.preventDefault();vaciarCarrito();});
  $('finalizar-compra')?.addEventListener('click',e=>{e.preventDefault();abrirCheckout();});
  $('btn-pay-now')?.addEventListener('click', confirmarCompra);
  $('close-checkout')?.addEventListener('click',()=>mostrarModal('checkout-modal',false));
  $('close-receipt')?.addEventListener('click',()=>mostrarModal('receipt-modal',false));
  $('btn-close-receipt-action')?.addEventListener('click',()=>mostrarModal('receipt-modal',false));
  $('checkout-aplicar-cupon')?.addEventListener('click',cotizar);
  $('checkout-cupon')?.addEventListener('input',()=>{precioCotizado=null;mostrarError('El cupón cambió. Pulsa Aplicar para actualizar el total.');});
  $('checkout-entrega')?.addEventListener('change',e=>{if($('checkout-direccion-contenedor'))$('checkout-direccion-contenedor').hidden=e.target.value!=='domicilio';});
  $('buscador-productos')?.addEventListener('input',filtrarProductos);
  $('ordenar-productos')?.addEventListener('change',filtrarProductos);
  $('cookie-accept')?.addEventListener('click',()=>{localStorage.setItem('cookiesAceptadas','si');if($('cookie-banner'))$('cookie-banner').style.display='none';});
  if ($('cookie-banner')) $('cookie-banner').style.display=localStorage.getItem('cookiesAceptadas')==='si'?'none':'flex';
  // No confiar en localStorage.isLoggedIn: Firebase Authentication es la fuente de sesión.
  $('nav-profile')?.addEventListener('click',async e=>{if(!await esperarAutenticacion()){e.preventDefault();mostrarModal('login-modal');}});
  $('close-login')?.addEventListener('click',()=>mostrarModal('login-modal',false));
  window.addEventListener('click',e=>{for(const id of ['login-modal','checkout-modal','receipt-modal','detalle-producto-modal'])if(e.target===$(id))mostrarModal(id,false);});
}
function filtrarProductos(){
  const q=($('buscador-productos')?.value||'').toLocaleLowerCase('es-MX').trim();
  const orden=$('ordenar-productos')?.value || 'normal';
  document.querySelectorAll('.products-content').forEach(contenedor=>{
    const nodos=[...contenedor.querySelectorAll('.product')];
    nodos.forEach(n=>{const texto=n.querySelector('h3')?.textContent.toLocaleLowerCase('es-MX')||'';n.hidden=!texto.includes(q);});
    if(orden!=='normal'){
      nodos.sort((a,b)=>{
        const aP=catalogo.get(a.querySelector('[data-id]')?.dataset.id);
        const bP=catalogo.get(b.querySelector('[data-id]')?.dataset.id);
        return orden==='menor' ? Number(aP?.precio||0)-Number(bP?.precio||0) : Number(bP?.precio||0)-Number(aP?.precio||0);
      }).forEach(n=>contenedor.append(n));
    }
  });
}
onAuthStateChanged(auth,u=>{usuarioActual=u;});
cargarCarritoLocal();
configurarEventos();
cargarCatalogo();
