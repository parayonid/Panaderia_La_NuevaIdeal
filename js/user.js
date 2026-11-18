// La Nueva Ideal · Cuenta del cliente / Etapa 4
import { initializeApp, getApps, getApp } from 'https://www.gstatic.com/firebasejs/10.5.0/firebase-app.js';
import { getAuth, onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/10.5.0/firebase-auth.js';
import { getFirestore, doc, getDoc, updateDoc } from 'https://www.gstatic.com/firebasejs/10.5.0/firebase-firestore.js';

const config={
  apiKey:'AIzaSyBns2UIA_ED5CsjBMEmJxUYLqxp1PRXlGo', authDomain:'weblanuevaideal.firebaseapp.com',
  projectId:'weblanuevaideal', storageBucket:'weblanuevaideal.firebasestorage.app',
  messagingSenderId:'783648403901', appId:'1:783648403901:web:f52f6438c6afcf12cb62d4'
};
const API='https://panaderia-la-nuevaideal.onrender.com';
const app=getApps().length?getApp():initializeApp(config);
const auth=getAuth(app), db=getFirestore(app);
const $=id=>document.getElementById(id);
const dinero=n=>new Intl.NumberFormat('es-MX',{style:'currency',currency:'MXN'}).format(Number(n)||0);
const fecha=s=>s?new Date(s).toLocaleString('es-MX'):'Sin fecha';
let actual=null;
let demo=false;
let pedidos=[];
const token=async()=>{if(!actual)throw new Error('Debes iniciar sesión');return actual.getIdToken();};
async function api(ruta,opciones={}){
  const headers={'Authorization':`Bearer ${await token()}`,...(opciones.headers||{})};
  if(opciones.body)headers['Content-Type']='application/json';
  const res=await fetch(`${API}${ruta}`,{...opciones,headers,cache:'no-store'});
  const datos=await res.json().catch(()=>({}));
  if(!res.ok)throw new Error(datos.detail||`HTTP ${res.status}`);
  return datos;
}
function mensaje(texto,error=false){const m=$('perfil-mensaje');if(m){m.textContent=texto;m.style.color=error?'#ba2b20':'#007b61';}}
function celda(tr,texto){const td=document.createElement('td');td.textContent=String(texto??'');tr.append(td);return td;}
async function cargarPerfil(){
  const snap=await getDoc(doc(db,'usuarios',actual.uid));
  if(!snap.exists())throw new Error('Falta tu perfil en Firestore (usuarios/{UID})');
  const p=snap.data();
  $('perfil-nombre').value=p.nombre||'';
  $('perfil-correo').textContent=actual.email||'';
  $('perfil-telefono').value=p.telefono||'';
  $('perfil-rol').textContent=p.rol||'cliente';
}
async function guardarPerfil(e){
  e.preventDefault();
  try{
    await updateDoc(doc(db,'usuarios',actual.uid),{
      nombre:$('perfil-nombre').value.trim(), telefono:$('perfil-telefono').value.trim()
    });
    mensaje('Datos del perfil actualizados.');
  }catch(e){mensaje(e.message,true);}
}
async function cargarPedidos(){
  pedidos=await api('/pedidos/mios');
  const body=$('historial-body');body.replaceChildren();
  if(!pedidos.length){const r=document.createElement('tr');const td=celda(r,'Aún no tienes pedidos.');td.colSpan=5;body.append(r);return;}
  for(const p of pedidos){
    const tr=document.createElement('tr');
    celda(tr,p.folio||p.id);celda(tr,fecha(p.fecha));celda(tr,dinero(p.total));
    celda(tr,p.estado_entrega||p.estado);
    const td=celda(tr,'');
    for(const [accion,label] of [['detalle','Ver detalle'],['seguimiento','Seguimiento']]){
      const b=document.createElement('button');b.type='button';b.className='btn-perfil';b.textContent=label;
      b.dataset.pedido=p.id;b.dataset.accion=accion;td.append(b);
    }
    body.append(tr);
  }
}
function modal(id,visible){const el=$(id);if(el)el.style.display=visible?'block':'none';}
function mostrarPedido(id,accion){
  const p=pedidos.find(x=>x.id===id);if(!p)return;
  if(accion==='detalle'){
    $('detalle-titulo').textContent=`Pedido ${p.folio||id}`;
    const body=$('detalle-pedido-tabla').querySelector('tbody');body.replaceChildren();
    for(const it of p.items||[]){const tr=document.createElement('tr');celda(tr,it.nombre);celda(tr,it.cantidad);celda(tr,dinero(it.precio_unitario));celda(tr,dinero(it.subtotal));body.append(tr);}
    $('detalle-total').textContent=dinero(p.total);
    $('detalle-pago').textContent=`${p.metodo_pago||'No indicado'} · ${p.estado_pago||p.estado}`;
    modal('detalle-modal',true);
  }else{
    $('seguimiento-titulo').textContent=`Seguimiento ${p.folio||id}`;
    const ul=$('seguimiento-pasos');ul.replaceChildren();
    for(const ev of p.historial_estados||[]){const li=document.createElement('li');li.className='step-completed';
      const strong=document.createElement('strong');strong.textContent=ev.estado;
      const small=document.createElement('div');small.textContent=fecha(ev.fecha);small.className='step-time';
      li.append(strong,small);ul.append(li);
    }
    if(!(p.historial_estados||[]).length){const li=document.createElement('li');li.textContent='Aún no hay seguimiento registrado.';ul.append(li);}
    modal('seguimiento-modal',true);
  }
}
async function cargarMonedero(){
  const [saldo,movs]=await Promise.all([api('/monedero'),api('/monedero/movimientos')]);
  $('monedero-saldo').textContent=dinero(saldo.saldo);
  const body=$('monedero-movimientos-body');body.replaceChildren();
  if(!movs.length){const tr=document.createElement('tr');const td=celda(tr,'Sin movimientos');td.colSpan=4;body.append(tr);}
  for(const m of movs){const tr=document.createElement('tr');celda(tr,fecha(m.fecha));celda(tr,m.concepto||m.tipo);
    celda(tr,dinero((m.monto_centavos||0)/100));celda(tr,dinero((m.saldo_resultante_centavos||0)/100));body.append(tr);}
}
async function cargarTickets(){
  const tickets=await api('/tickets');const body=$('tickets-body');body.replaceChildren();
  if(!tickets.length){const tr=document.createElement('tr');const td=celda(tr,'No tienes tickets');td.colSpan=4;body.append(tr);}
  for(const t of tickets){const tr=document.createElement('tr');celda(tr,fecha(t.fecha));celda(tr,t.asunto);celda(tr,t.estado);celda(tr,t.respuesta||'Pendiente');body.append(tr);}
}
async function crearTicket(e){e.preventDefault();const boton=$('ticket-enviar');boton.disabled=true;
  try{await api('/tickets',{method:'POST',body:JSON.stringify({
    asunto:$('ticket-asunto').value,mensaje:$('ticket-mensaje').value.trim(),
    pedido_id:$('ticket-pedido').value||null
  })});$('ticket-mensaje').value='';mensaje('Ticket registrado correctamente.');await cargarTickets();}
  catch(e){mensaje(e.message,true);}finally{boton.disabled=false;}
}
async function recargarDemo(){
  if(!demo)return;
  const monto=Number($('recarga-monto').value);
  if(!Number.isFinite(monto)||monto<1||monto>2000){mensaje('Recarga simulada entre $1 y $2,000.',true);return;}
  const boton=$('recargar-demo');boton.disabled=true;
  try{
    const solicitud_id=crypto.randomUUID().replaceAll('-','');
    await api('/monedero/recarga-simulada',{method:'POST',body:JSON.stringify({solicitud_id,monto_centavos:Math.round(monto*100)})});
    mensaje('Recarga ficticia registrada. No se movió dinero real.');await cargarMonedero();
  }catch(e){mensaje(e.message,true);}finally{boton.disabled=false;}
}
async function cargarTodo(){
  const resultados=await Promise.allSettled([cargarPerfil(),cargarPedidos(),cargarMonedero(),cargarTickets()]);
  for(const r of resultados)if(r.status==='rejected')mensaje(r.reason.message,true);
  const selector=$('ticket-pedido');selector.replaceChildren();const empty=document.createElement('option');empty.value='';empty.textContent='Sin pedido asociado';selector.append(empty);
  for(const p of pedidos){const o=document.createElement('option');o.value=p.id;o.textContent=p.folio||p.id;selector.append(o);}
}
function manejarEventos(){
  $('perfil-form')?.addEventListener('submit',guardarPerfil);
  $('ticket-form')?.addEventListener('submit',crearTicket);
  $('recargar-demo')?.addEventListener('click',recargarDemo);
  $('cerrar-sesion')?.addEventListener('click',async()=>{await signOut(auth);location.replace('../index.html');});
  $('historial-body')?.addEventListener('click',e=>{const b=e.target.closest('[data-accion]');if(b)mostrarPedido(b.dataset.pedido,b.dataset.accion);});
  document.querySelectorAll('[data-cerrar-modal]').forEach(el=>el.addEventListener('click',()=>modal(el.dataset.cerrarModal,false)));
  window.addEventListener('click',e=>{if(e.target?.classList.contains('modal'))modal(e.target.id,false);});
  document.querySelectorAll('[data-pestana]').forEach(button=>button.addEventListener('click',()=>{
    const activa=button.dataset.pestana;
    document.querySelectorAll('[data-pestana]').forEach(b=>b.classList.toggle('activa',b.dataset.pestana===activa));
    document.querySelectorAll('[data-vista]').forEach(v=>v.hidden=v.dataset.vista!==activa);
  }));
}
manejarEventos();
onAuthStateChanged(auth,async usuario=>{
  if(!usuario){location.replace('../index.html');return;}
  actual=usuario;
  try{const c=await api('/etapa4/config');demo=Boolean(c.modo_demo);
    $('contenedor-recarga-demo').hidden=!demo;
  }catch{ $('contenedor-recarga-demo').hidden=true; }
  await cargarTodo();
});
