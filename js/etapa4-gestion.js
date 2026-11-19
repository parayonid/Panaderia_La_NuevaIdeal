import { initializeApp, getApps, getApp } from 'https://www.gstatic.com/firebasejs/10.5.0/firebase-app.js';
import { getAuth, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.5.0/firebase-auth.js';
import { getFirestore, doc, getDoc } from 'https://www.gstatic.com/firebasejs/10.5.0/firebase-firestore.js';
const cfg={apiKey:'AIzaSyBns2UIA_ED5CsjBMEmJxUYLqxp1PRXlGo',authDomain:'weblanuevaideal.firebaseapp.com',projectId:'weblanuevaideal',storageBucket:'weblanuevaideal.firebasestorage.app',messagingSenderId:'783648403901',appId:'1:783648403901:web:f52f6438c6afcf12cb62d4'};
const app=getApps().length?getApp():initializeApp(cfg), auth=getAuth(app), db=getFirestore(app);
const API='https://panaderia-la-nuevaideal.onrender.com';
const $=id=>document.getElementById(id);
let rol='';
let clienteSeleccionado=null;
let monederos=[];
function nodo(tag,txt){const e=document.createElement(tag);e.textContent=String(txt??'');return e;}
function mensaje(texto){$('estado').textContent=texto;}
async function peticion(ruta,options={}){
 const user=auth.currentUser;if(!user)throw new Error('Sesión no iniciada');
 const token=await user.getIdToken();const res=await fetch(API+ruta,{...options,headers:{Authorization:'Bearer '+token,...(options.body?{'Content-Type':'application/json'}:{}),...(options.headers||{})},cache:'no-store'});
 const json=await res.json().catch(()=>({}));if(!res.ok)throw new Error(typeof json.detail==='string'?json.detail:`HTTP ${res.status}`);return json;
}
function fila(table,...cells){const tr=document.createElement('tr');for(const c of cells){const td=document.createElement('td');if(c instanceof Node)td.append(c);else td.textContent=String(c??'');tr.append(td);}table.append(tr);return tr;}
function estadoError(e){mensaje('Error: '+e.message);}
async function cargarTickets(){try{const datos=await peticion('/admin/tickets');const body=$('tickets-body');body.replaceChildren();for(const t of datos){const detalles=nodo('div',t.asunto+' · '+(t.mensaje||''));const estado=document.createElement('div');const select=document.createElement('select');for(const val of ['Abierto','En proceso','Respondido','Cerrado']){const op=new Option(val,val);select.add(op);}select.value=t.estado||'Abierto';const respuesta=document.createElement('textarea');respuesta.rows=2;respuesta.value=t.respuesta||'';estado.append(select,respuesta);const boton=nodo('button','Guardar');boton.type='button';boton.addEventListener('click',async()=>{boton.disabled=true;try{await peticion('/admin/tickets/'+encodeURIComponent(t.id),{method:'PATCH',body:JSON.stringify({estado:select.value,respuesta:respuesta.value})});mensaje('Ticket actualizado correctamente.');}catch(e){estadoError(e);}finally{boton.disabled=false;}});fila(body,t.cliente_correo||'Cliente',detalles,estado,boton);}if(!datos.length)fila(body,'Sin tickets registrados','','','');}catch(e){estadoError(e);}}
async function cargarPedidos(){try{const todos=await peticion('/ordenes_clientes');const body=$('pedidos-body');body.replaceChildren();for(const o of todos.filter(p=>p.canal==='tienda')){const s=document.createElement('select');for(const v of ['En preparación','En reparto','Entregado'])s.add(new Option(v,v));s.value=['En preparación','En reparto','Entregado'].includes(o.estado_entrega)?o.estado_entrega:'En preparación';const b=nodo('button','Actualizar');b.type='button';b.disabled=!['aprobado','simulado'].includes(o.estado_pago);b.addEventListener('click',async()=>{b.disabled=true;try{await peticion('/pedidos/'+encodeURIComponent(o.id)+'/estado',{method:'PUT',body:JSON.stringify({estado:s.value})});mensaje('Seguimiento actualizado.');await cargarPedidos();}catch(e){estadoError(e);}finally{b.disabled=false;}});const cont=document.createElement('div');cont.append(s,b);fila(body,o.folio||o.id,o.cliente_nombre||'Cliente',o.estado_pago||'pendiente',o.estado_entrega||'Pedido recibido',cont);}if(!body.children.length)fila(body,'Sin pedidos de tienda','','','','');}catch(e){estadoError(e);}}
async function cargarPromociones(){try{const data=await peticion('/admin/promociones');const body=$('promociones-body');body.replaceChildren();for(const p of data)fila(body,p.codigo||p.id,p.tipo,p.valor,p.activo?'Activa':'Inactiva');if(!data.length)fila(body,'Sin promociones','','','');}catch(e){estadoError(e);}}
async function cargarImpuestos(){try{const data=await peticion('/admin/impuestos');$('tasa').value=Number(data.tasa_bps||0)/100;$('nota').value=data.nota||'';}catch(e){estadoError(e);}}
const mxn = centavos => new Intl.NumberFormat('es-MX',{style:'currency',currency:'MXN'}).format((Number(centavos)||0)/100);
async function cargarMonederos(){
 try{
  monederos=await peticion('/admin/monederos');
  $('monederos-resumen').textContent=`${monederos.length} clientes mostrados (máximo 250) · Saldos visibles: ${mxn(monederos.reduce((sum,c)=>sum+Number(c.saldo_centavos||0),0))}`;
  const body=$('monederos-body');body.replaceChildren();
  for(const c of monederos){
   const b=nodo('button','Ver movimientos');b.type='button';
   b.addEventListener('click',()=>seleccionarMonedero(c.uid));
   const nombre=nodo('div',c.nombre);const uid=nodo('small','UID: '+c.uid);nombre.append(document.createElement('br'),uid);
   fila(body,nombre,c.correo,mxn(c.saldo_centavos),b);
  }
  if(!monederos.length)fila(body,'Sin cuentas de cliente registradas','','','');
  if(clienteSeleccionado){
   const encontrado=monederos.find(c=>c.uid===clienteSeleccionado);
   if(encontrado)await seleccionarMonedero(encontrado.uid);
   else $('monederos-detalle').hidden=true;
  }
 }catch(e){estadoError(e);}
}
async function seleccionarMonedero(uid){
 const c=monederos.find(item=>item.uid===uid);if(!c)return;
 clienteSeleccionado=uid;
 $('monederos-detalle').hidden=false;
 $('monederos-titulo').textContent='Movimientos de '+c.nombre;
 $('monederos-saldo').textContent='Saldo actual: '+mxn(c.saldo_centavos)+(c.ajustes_demo_autorizados?' · Ajustes académicos habilitados':' · Ajustes deshabilitados: habilita este UID en Render para pruebas');
 $('monederos-ajuste-form').hidden=!c.ajustes_demo_autorizados;
 const body=$('monederos-movimientos');body.replaceChildren();
 try{
  const movimientos=await peticion('/admin/monederos/'+encodeURIComponent(uid)+'/movimientos');
  for(const m of movimientos)fila(body,m.fecha||'—',m.motivo?m.concepto+' · '+m.motivo:(m.concepto||m.tipo),mxn(m.monto_centavos),mxn(m.saldo_resultante_centavos));
  if(!movimientos.length)fila(body,'Sin movimientos','','','');
 }catch(e){estadoError(e);}
}
$('monederos-actualizar').addEventListener('click',cargarMonederos);
$('monederos-ajuste-form').addEventListener('submit',async e=>{
 e.preventDefault();if(!clienteSeleccionado)return;
 const operacion=$('ajuste-operacion').value;
 const montoCentavos=Math.round(Number($('ajuste-monto').value)*100);
 const motivo=$('ajuste-motivo').value.trim();
 if(!Number.isSafeInteger(montoCentavos)||montoCentavos<100||montoCentavos>200000||motivo.length<8){
  mensaje('Monto inválido o motivo demasiado corto.');return;
 }
 const usuario=monederos.find(c=>c.uid===clienteSeleccionado);
 if(!confirm(`${operacion==='recarga'?'Agregar':'Descontar'} ${mxn(montoCentavos)} en el monedero de ${usuario?.nombre||'este cliente'} (solo DEMO)?`))return;
 const boton=$('ajuste-confirmar');boton.disabled=true;
 const solicitud_id=crypto.randomUUID().replaceAll('-','');
 try{
  const resultado=await peticion('/admin/monederos/'+encodeURIComponent(clienteSeleccionado)+'/ajustes',{method:'POST',body:JSON.stringify({solicitud_id,operacion,monto_centavos:montoCentavos,motivo})});
  mensaje('Ajuste académico registrado. Nuevo saldo: '+mxn(resultado.saldo_centavos));
  e.currentTarget.reset();await cargarMonederos();
 }catch(error){estadoError(error);}finally{boton.disabled=false;}
});
onAuthStateChanged(auth,async user=>{
 if(!user){location.replace('../index.html');return;}
 try{const perfil=await getDoc(doc(db,'usuarios',user.uid));rol=String(perfil.data()?.rol||'').trim().toLowerCase();if(!['admin','ventas','logistica','mantenimiento'].includes(rol)){mensaje('Acceso restringido a personal autorizado.');return;}
  mensaje('Sesión verificada · '+({admin:'Administrador',ventas:'Ventas',logistica:'Logística',mantenimiento:'Mantenimiento'}[rol]));
  if(['admin','ventas','mantenimiento'].includes(rol)){$('tickets-seccion').hidden=false;await cargarTickets();}
  if(['admin','logistica'].includes(rol)){$('pedidos-seccion').hidden=false;await cargarPedidos();}
  if(['admin','mantenimiento'].includes(rol)){
    $('monederos-seccion').hidden=false;
    $('promociones-seccion').hidden=false;$('impuestos-seccion').hidden=false;
    await Promise.all([cargarMonederos(),cargarPromociones(),cargarImpuestos()]);
  }
  if(rol==='mantenimiento')$('volver-admin').hidden=true;
 }catch(e){estadoError(e);}
});
$('tickets-actualizar').addEventListener('click',cargarTickets);
$('pedidos-actualizar').addEventListener('click',cargarPedidos);
$('promocion-form').addEventListener('submit',async e=>{e.preventDefault();const codigo=$('codigo').value.trim().toUpperCase();const data={codigo,tipo:$('tipo').value,valor:Number($('valor').value),activo:$('activo').checked,fecha_fin:$('fecha_fin').value?new Date($('fecha_fin').value).toISOString():''};try{await peticion('/admin/promociones/'+encodeURIComponent(codigo),{method:'PUT',body:JSON.stringify(data)});mensaje('Promoción guardada.');await cargarPromociones();}catch(err){estadoError(err);}});
$('impuestos-form').addEventListener('submit',async e=>{e.preventDefault();try{await peticion('/admin/impuestos',{method:'PUT',body:JSON.stringify({tasa_bps:Math.round(Number($('tasa').value)*100),nota:$('nota').value})});mensaje('Configuración de impuesto guardada.');}catch(err){estadoError(err);}});
