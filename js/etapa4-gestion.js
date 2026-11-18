import { initializeApp, getApps, getApp } from 'https://www.gstatic.com/firebasejs/10.5.0/firebase-app.js';
import { getAuth, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.5.0/firebase-auth.js';
import { getFirestore, doc, getDoc } from 'https://www.gstatic.com/firebasejs/10.5.0/firebase-firestore.js';
const cfg={apiKey:'AIzaSyBns2UIA_ED5CsjBMEmJxUYLqxp1PRXlGo',authDomain:'weblanuevaideal.firebaseapp.com',projectId:'weblanuevaideal',storageBucket:'weblanuevaideal.firebasestorage.app',messagingSenderId:'783648403901',appId:'1:783648403901:web:f52f6438c6afcf12cb62d4'};
const app=getApps().length?getApp():initializeApp(cfg), auth=getAuth(app), db=getFirestore(app);
const API='https://panaderia-la-nuevaideal.onrender.com';
const $=id=>document.getElementById(id);
let rol='';
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
onAuthStateChanged(auth,async user=>{
 if(!user){location.replace('../index.html');return;}
 try{const perfil=await getDoc(doc(db,'usuarios',user.uid));rol=String(perfil.data()?.rol||'').trim().toLowerCase();if(!['admin','ventas','logistica'].includes(rol)){mensaje('Acceso restringido a personal autorizado.');return;}
  mensaje('Sesión verificada · '+({admin:'Administrador',ventas:'Ventas',logistica:'Logística'}[rol]));
  if(['admin','ventas'].includes(rol)){$('tickets-seccion').hidden=false;await cargarTickets();}
  if(['admin','logistica'].includes(rol)){$('pedidos-seccion').hidden=false;await cargarPedidos();}
  if(rol==='admin'){$('promociones-seccion').hidden=false;$('impuestos-seccion').hidden=false;await Promise.all([cargarPromociones(),cargarImpuestos()]);}
 }catch(e){estadoError(e);}
});
$('tickets-actualizar').addEventListener('click',cargarTickets);
$('pedidos-actualizar').addEventListener('click',cargarPedidos);
$('promocion-form').addEventListener('submit',async e=>{e.preventDefault();const codigo=$('codigo').value.trim().toUpperCase();const data={codigo,tipo:$('tipo').value,valor:Number($('valor').value),activo:$('activo').checked,fecha_fin:$('fecha_fin').value?new Date($('fecha_fin').value).toISOString():''};try{await peticion('/admin/promociones/'+encodeURIComponent(codigo),{method:'PUT',body:JSON.stringify(data)});mensaje('Promoción guardada.');await cargarPromociones();}catch(err){estadoError(err);}});
$('impuestos-form').addEventListener('submit',async e=>{e.preventDefault();try{await peticion('/admin/impuestos',{method:'PUT',body:JSON.stringify({tasa_bps:Math.round(Number($('tasa').value)*100),nota:$('nota').value})});mensaje('Configuración de impuesto guardada.');}catch(err){estadoError(err);}});
