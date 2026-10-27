import { initializeApp } from "https://www.gstatic.com/firebasejs/10.5.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.5.0/firebase-auth.js";
import { getFirestore, collection, updateDoc, doc, getDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/10.5.0/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyBns2UIA_ED5CsjBMEmJxUYLqxp1PRXlGo",
    authDomain: "weblanuevaideal.firebaseapp.com",
    projectId: "weblanuevaideal",
    storageBucket: "weblanuevaideal.firebasestorage.app",
    messagingSenderId: "783648403901",
    appId: "1:783648403901:web:f52f6438c6afcf12cb62d4",
    measurementId: "G-XM65Y561VF"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const usuariosRef = collection(db,"usuarios");
const API_URL = "https://panaderia-la-nuevaideal.onrender.com";

let globalToken = null; let globalUserEmail = null; let globalRol = null;
let interaccionesChart = null; let repBarChart = null; let repPieChart = null; let chartSalud = null; let chartMov = null;
let productosGlobal = []; let proveedoresGlobal = [];

// ==========================================
// SISTEMA DE NOTIFICACIONES FLOTANTES
// ==========================================
function mostrarNotificacion(mensaje, tipo = 'error') {
    const contenedor = document.getElementById('toast-container');
    if (!contenedor) return;
    
    const toast = document.createElement('div');
    const colorBg = tipo === 'error' ? '#e74c3c' : '#16a085'; // Rojo para error, verde para éxito
    const icono = tipo === 'error' ? 'bi-exclamation-octagon-fill' : 'bi-check-circle-fill';
    
    toast.style.cssText = `
        background-color: ${colorBg}; color: white; padding: 15px 20px; border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15); display: flex; align-items: center; gap: 12px;
        font-size: 0.95rem; font-weight: bold; opacity: 0; transform: translateX(100%);
        transition: all 0.3s ease; max-width: 350px;
    `;
    
    toast.innerHTML = `<i class="bi ${icono}" style="font-size: 1.3rem;"></i>`;
    const textoMensaje = document.createElement('div');
    textoMensaje.textContent = mensaje;
    toast.appendChild(textoMensaje);
    contenedor.appendChild(toast);
    
    // Animar entrada
    setTimeout(() => { toast.style.opacity = '1'; toast.style.transform = 'translateX(0)'; }, 10);
    
    // Animar salida y eliminar después de 4 segundos
    setTimeout(() => {
        toast.style.opacity = '0'; toast.style.transform = 'translateX(100%)';
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}



document.addEventListener('DOMContentLoaded', () => {
    
    // ==========================================
    // 1. SEGURIDAD Y CARGA INICIAL
    // ==========================================
    onAuthStateChanged(getAuth(), async (user) => {
        if (!user) return window.location.href = "../index.html";
        try {
            // Leer directamente el documento del usuario autenticado.
            // No listar la colección usuarios: las reglas pueden permitir get pero no list.
            const usuarioDoc = await getDoc(doc(db, 'usuarios', user.uid));
            if (!usuarioDoc.exists()) {
                console.error('[Admin] No existe perfil usuarios/{UID}:', user.uid);
                alert('Tu cuenta no tiene perfil en Firestore. Revisa usuarios/{UID}.');
                return window.location.href = '../index.html';
            }
            const usuarioRol = usuarioDoc.data().rol;
            if (!['admin', 'ventas', 'logistica'].includes(usuarioRol)) {
                alert('Acceso denegado: usuario sin rol de gestión.');
                return window.location.href = '../index.html';
            }
            globalRol = usuarioRol;
            globalToken = await user.getIdToken();
            globalUserEmail = user.email;
            document.body.dataset.rol = globalRol;
            document.getElementById('rol-actual').textContent = { admin:'Administrador', ventas:'Ventas', logistica:'Logística' }[globalRol];
            document.querySelectorAll('.sidebar-menu li[data-roles], button[data-roles]').forEach(elemento => {
                if (!elemento.dataset.roles.split(',').includes(globalRol)) elemento.hidden = true;
            });
            document.querySelectorAll('[data-rol-card]').forEach(elemento => elemento.classList.toggle('current', elemento.dataset.rolCard === globalRol));
            if (['admin','ventas'].includes(globalRol)) { inicializarGraficasCRM(); recargarDatosCRM(); }
            if (globalRol === 'admin') iniciarEscuchaUsuarios();
            cargarTodoSCM();
            cargarERP();
            if (globalRol === 'ventas') mostrarSeccion('#seccion-erp-dashboard');
            if (globalRol === 'logistica') mostrarSeccion('#seccion-dashboard-scm');
        } catch (error) {
            console.error('[Admin] Error al comprobar permisos:', error.code, error);
            alert(`No se pudo cargar tu perfil (${error.code || 'error desconocido'}). Revisa la consola.`);
            window.location.href = '../index.html';
        }
    });

    const pedidos = JSON.parse(localStorage.getItem('pedidosHistorial')) || [];

    // ==========================================
    // 2. MÓDULO CRM (Gráficas y Clientes)
    // ==========================================
    function inicializarGraficasCRM() {
        if (document.getElementById('interaccionesChart')) interaccionesChart = new Chart(document.getElementById('interaccionesChart'), { type: 'doughnut', data: { labels: ['Llamada', 'Correo', 'WhatsApp', 'Nota', 'Reunión'], datasets: [{ data: [0, 0, 0, 0, 0], backgroundColor: ['#F35200', '#6c757d', '#25D366', '#4F231C', '#0d6efd'], borderWidth: 0 }] }, options: { responsive: true, plugins: { legend: { position: 'bottom' } } }});
        if (document.getElementById('repBarChart')) repBarChart = new Chart(document.getElementById('repBarChart'), { type: 'bar', data: { labels: ['Llamada', 'Correo', 'WhatsApp', 'Reunión', 'Nota'], datasets: [{ label: 'Cantidad', data: [0, 0, 0, 0, 0], backgroundColor: ['#F35200', '#6c757d', '#25D366', '#0d6efd', '#4F231C'] }] }, options: { responsive: true, plugins: { legend: { display: false } } }});
        if (document.getElementById('repPieChart')) repPieChart = new Chart(document.getElementById('repPieChart'), { type: 'doughnut', data: { labels: ['Prospecto', 'Activo', 'Inactivo'], datasets: [{ data: [0, 0, 0], backgroundColor: ['#0d6efd', '#16a085', '#e74c3c'], borderWidth: 0 }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'right' } } }});
    }

    async function recargarDatosCRM() {
        if (!globalToken) return;
        try {
            const resClientes = await fetch(`${API_URL}/clientes`); const clientes = await resClientes.json();
            const clientesBody = document.getElementById('clientes-body'); const selectClientes = document.getElementById('int-cliente-id');
            if (clientesBody) clientesBody.innerHTML = ''; if (selectClientes) selectClientes.innerHTML = '<option value="">Selecciona un cliente...</option>';
            
            let totalClientes = 0, clientesActivos = 0, interaccionesMes = 0; let etapas = { Prospecto: 0, Activo: 0, Inactivo: 0 }; let mapIntCliente = {}; let todasLasInteracciones = [];
            const mesActual = new Date().getMonth(); const anioActual = new Date().getFullYear();

           for (let cli of clientes) {
                totalClientes++; mapIntCliente[cli.id] = 0; 
                const estado = (cli.estado || 'activo').toLowerCase();
                if (estado.includes('prospecto')) etapas.Prospecto++; else if (estado.includes('inactivo')) etapas.Inactivo++; else { etapas.Activo++; clientesActivos++; }
                let colorBadge = estado.includes('prospecto') ? '#0d6efd' : (estado.includes('inactivo') ? '#e74c3c' : '#16a085');
                
                if (clientesBody) clientesBody.innerHTML += `<tr><td><strong>${cli.nombre}</strong></td><td>${cli.empresa || 'N/A'}</td><td>${cli.correo}<br><small>${cli.telefono}</small></td><td><span class="badge" style="background:${colorBadge}; color:white;">${cli.estado || 'Activo'}</span></td><td class="acciones-iconos"><i class="bi bi-eye icon-ver-detalle" data-id="${cli.id}" style="color:#0d6efd; cursor:pointer; font-size:1.1rem; margin-right:10px;"></i><i class="bi bi-trash icon-delete-cliente" data-id="${cli.id}" style="color:#e74c3c; cursor:pointer; font-size:1.1rem;"></i></td></tr>`;
                if (selectClientes) selectClientes.innerHTML += `<option value="${cli.id}">${cli.nombre}</option>`;

                try {
                    const resInt = await fetch(`${API_URL}/clientes/${cli.id}/interacciones`);
                    if(resInt.ok) {
                        const ints = await resInt.json(); mapIntCliente[cli.id] = ints.length;
                        ints.forEach(int => { int.nombreCliente = cli.nombre; if(new Date(int.fecha).getMonth() === mesActual && new Date(int.fecha).getFullYear() === anioActual) interaccionesMes++; });
                        todasLasInteracciones.push(...ints);
                    }
                } catch(e) {}
            }

            let sinInt = Object.values(mapIntCliente).filter(v => v === 0).length;
            if (document.getElementById('metric-clientes')) document.getElementById('metric-clientes').textContent = clientesActivos; 
            if (document.getElementById('rep-total-cli')) document.getElementById('rep-total-cli').textContent = totalClientes; 
            if (document.getElementById('rep-activos-cli')) document.getElementById('rep-activos-cli').textContent = clientesActivos; 
            if (document.getElementById('rep-activos-pct')) document.getElementById('rep-activos-pct').textContent = totalClientes > 0 ? Math.round((clientesActivos/totalClientes)*100)+"%" : "0%"; 
            if (document.getElementById('rep-int-mes')) document.getElementById('rep-int-mes').textContent = interaccionesMes; 
            if (document.getElementById('rep-sin-int')) document.getElementById('rep-sin-int').textContent = sinInt; 

            const interaccionesBody = document.getElementById('interacciones-body'); if (interaccionesBody) interaccionesBody.innerHTML = '';
            let cLlamada = 0, cCorreo = 0, cWhatsapp = 0, cNota = 0, cReunion = 0;
            todasLasInteracciones.sort((a, b) => new Date(b.fecha) - new Date(a.fecha)).forEach(int => {
                if(int.tipo === 'Llamada') cLlamada++; else if(int.tipo === 'Correo') cCorreo++; else if(int.tipo === 'WhatsApp') cWhatsapp++; else if(int.tipo === 'Reunión') cReunion++; else cNota++;
                let icono = int.tipo === 'Llamada' ? 'bi-telephone' : (int.tipo === 'Correo' ? 'bi-envelope' : (int.tipo === 'WhatsApp' ? 'bi-whatsapp' : 'bi-journal-text'));
                if (interaccionesBody) interaccionesBody.innerHTML += `<tr><td>${int.fecha || 'Reciente'}</td><td><strong>${int.nombreCliente}</strong></td><td><i class="bi ${icono}" style="margin-right:5px; color:#555;"></i> ${int.tipo}</td><td><small>${int.descripcion}</small></td><td>${int.usuario_id}</td></tr>`;
            });

            if (document.getElementById('metric-interacciones')) document.getElementById('metric-interacciones').textContent = todasLasInteracciones.length;
            if (interaccionesChart) { interaccionesChart.data.datasets[0].data = [cLlamada, cCorreo, cWhatsapp, cNota, cReunion]; interaccionesChart.update(); }
            if (repBarChart) { repBarChart.data.datasets[0].data = [cLlamada, cCorreo, cWhatsapp, cReunion, cNota]; repBarChart.update(); }
            if (repPieChart) { repPieChart.data.datasets[0].data = [etapas.Prospecto, etapas.Activo, etapas.Inactivo]; repPieChart.update(); }
        } catch (error) {}
    }

    document.getElementById('clientes-body')?.addEventListener('click', async (e) => {
        if (e.target.classList.contains('icon-delete-cliente') && confirm("¿Dar de baja a este cliente?")) { await fetch(`${API_URL}/clientes/${e.target.dataset.id}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${globalToken}` } }); recargarDatosCRM(); }
        if (e.target.classList.contains('icon-ver-detalle')) abrirDetalleCliente(e.target.dataset.id);
    });

    async function abrirDetalleCliente(id) {
        document.getElementById('seccion-clientes').classList.add('seccion-oculta'); document.getElementById('seccion-detalle-cliente').classList.remove('seccion-oculta');
        try {
            const cliente = await (await fetch(`${API_URL}/clientes/${id}`)).json();
            document.getElementById('detalle-inicial').textContent = cliente.nombre.charAt(0).toUpperCase(); document.getElementById('detalle-nombre').textContent = cliente.nombre; document.getElementById('detalle-correo').textContent = cliente.correo; document.getElementById('detalle-telefono').textContent = cliente.telefono; document.getElementById('detalle-registro').textContent = `ID: ${cliente.id}`; document.getElementById('detalle-etapa').value = cliente.estado; document.getElementById('form-detalle-interaccion').dataset.clienteId = id;
            const interacciones = await (await fetch(`${API_URL}/clientes/${id}/interacciones`)).json();
            const timeline = document.getElementById('detalle-timeline'); timeline.innerHTML = '';
            if (interacciones.length === 0) timeline.innerHTML = '<p style="text-align: center; color: #888;">No hay interacciones registradas.</p>';
            else interacciones.sort((a, b) => new Date(b.fecha) - new Date(a.fecha)).forEach(int => { let icono = int.tipo === 'Llamada' ? 'bi-telephone' : (int.tipo === 'Correo' ? 'bi-envelope' : 'bi-journal-text'); timeline.innerHTML += `<div style="display:flex; gap:15px; border-left:2px solid #eee; padding-left:15px; margin-bottom:10px;"><div style="color:#16a085; font-size:1.1rem;"><i class="${icono}"></i></div><div><div style="font-size:0.8rem; color:#888;">${int.fecha || 'Reciente'} - <strong>${int.tipo}</strong></div><div style="font-size:0.9rem; color:#333;">${int.descripcion}</div></div></div>`; });
        } catch (error) {}
    }
    document.getElementById('btn-volver-clientes')?.addEventListener('click', () => { document.getElementById('seccion-detalle-cliente').classList.add('seccion-oculta'); document.getElementById('seccion-clientes').classList.remove('seccion-oculta'); recargarDatosCRM(); });

    // Formularios CRM
    document.getElementById('btn-abrir-modal-cliente')?.addEventListener('click', () => { document.getElementById('cliente-id').value = ''; document.getElementById('form-nuevo-cliente').reset(); document.getElementById('modal-cliente').style.display = 'flex'; });
    document.getElementById('form-nuevo-cliente')?.addEventListener('submit', async (e) => {
        e.preventDefault(); const idCliente = document.getElementById('cliente-id').value;
        const datosCliente = { nombre: document.getElementById('cli-nombre').value, correo: document.getElementById('cli-correo').value, telefono: document.getElementById('cli-telefono').value, empresa: document.getElementById('cli-empresa').value || 'Desconocida', estado: "activo" };
        const btn = e.target.querySelector('button'); btn.textContent = "..."; btn.disabled = true;
        try {
            if (idCliente) { await fetch(`${API_URL}/clientes/${idCliente}`, { method: 'PUT', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${globalToken}` }, body: JSON.stringify(datosCliente) }); abrirDetalleCliente(idCliente); }
            else {
                const respuesta = await fetch(`${API_URL}/clientes`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${globalToken}` }, body: JSON.stringify(datosCliente) });
                if (!respuesta.ok) throw new Error('No se pudo crear el cliente');
                const creado = await respuesta.json();
                await cargarERP();
                if (creado.id && erpElemento('seccion-erp-nueva') && !erpElemento('seccion-erp-nueva').classList.contains('seccion-oculta')) {
                    erpElemento('erp-buscar-cliente').value = '';
                    erpRenderClientes();
                    erpElemento('erp-select-cliente').value = creado.id;
                    erpMostrarCliente();
                }
            }
            document.getElementById('modal-cliente').style.display = 'none'; e.target.reset(); recargarDatosCRM();
        } catch (e) { alert("Error al guardar."); } finally { btn.textContent = "Guardar Cliente"; btn.disabled = false; }
    });

    document.getElementById('btn-abrir-modal-interaccion')?.addEventListener('click', () => { document.getElementById('form-nueva-interaccion').reset(); document.getElementById('modal-interaccion').style.display = 'flex'; });
    document.getElementById('form-nueva-interaccion')?.addEventListener('submit', async (e) => {
        e.preventDefault(); const btn = e.target.querySelector('button'); btn.textContent = "..."; btn.disabled = true;
        try { await fetch(`${API_URL}/interacciones`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${globalToken}` }, body: JSON.stringify({ cliente_id: document.getElementById('int-cliente-id').value, tipo: document.getElementById('int-tipo').value, descripcion: document.getElementById('int-desc').value, usuario_id: globalUserEmail }) }); document.getElementById('modal-interaccion').style.display = 'none'; e.target.reset(); recargarDatosCRM();
        } catch (e) {} finally { btn.textContent = "Guardar Interacción"; btn.disabled = false; }
    });

    document.getElementById('btn-detalle-actualizar-etapa')?.addEventListener('click', async () => {
        const clienteId = document.getElementById('form-detalle-interaccion').dataset.clienteId;
        const btn = document.getElementById('btn-detalle-actualizar-etapa'); btn.textContent = "...";
        try { await fetch(`${API_URL}/clientes/${clienteId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${globalToken}` }, body: JSON.stringify({ nombre: document.getElementById('detalle-nombre').textContent, correo: document.getElementById('detalle-correo').textContent, telefono: document.getElementById('detalle-telefono').textContent, empresa: "Desconocida", estado: document.getElementById('detalle-etapa').value }) }); alert(`Etapa actualizada`); recargarDatosCRM();
        } catch (e) {} finally { btn.textContent = "Actualizar Etapa"; }
    });
    document.getElementById('form-detalle-interaccion')?.addEventListener('submit', async (e) => {
        e.preventDefault(); const clienteId = e.target.dataset.clienteId; const btn = e.target.querySelector('button'); btn.textContent = "..."; btn.disabled = true;
        try { await fetch(`${API_URL}/interacciones`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${globalToken}` }, body: JSON.stringify({ cliente_id: clienteId, tipo: document.getElementById('detalle-int-tipo').value, descripcion: document.getElementById('detalle-int-desc').value, usuario_id: globalUserEmail }) }); e.target.reset(); abrirDetalleCliente(clienteId);
        } catch (e) {} finally { btn.textContent = "Registrar"; btn.disabled = false; }
    });

    // Firebase (Usuarios/Tracking)
    function iniciarEscuchaUsuarios() {
    if (document.getElementById('usuarios-body')) {
        onSnapshot(usuariosRef, (snapshot) => {
            document.getElementById('usuarios-body').innerHTML = ''; if (document.getElementById('metric-usuarios')) document.getElementById('metric-usuarios').textContent = snapshot.size;
            snapshot.forEach(docSnap => {
                const u = { id: docSnap.id, ...docSnap.data() }; const rolBadge = u.rol === 'admin' ? '<span class="badge" style="background:#4F231C; color:white;">Admin</span>' : '<span class="badge" style="background:#6c757d; color:white;">Cliente</span>';
                document.getElementById('usuarios-body').innerHTML += `<tr><td><strong>${u.nombre || 'Sin nombre'}</strong><br><small style="color:#888;">${u.correo}</small></td><td>${rolBadge}</td><td>${u.telefono || 'N/A'}</td><td>Reciente</td><td class="acciones-iconos"><i class="bi bi-pencil-square icon-edit-user" data-id="${u.id}" data-correo="${u.correo}" data-rol="${u.rol || 'cliente'}" data-nombre="${encodeURIComponent(u.nombre || '')}" data-telefono="${u.telefono || ''}" style="cursor: pointer; color: #16a085;"></i></td></tr>`;
            });
        });
        document.getElementById('usuarios-body').addEventListener('click', (e) => {
            if (e.target.classList.contains('icon-edit-user')) {
                document.getElementById('usuario-id').value = e.target.dataset.id; document.getElementById('usuario-correo').value = e.target.dataset.correo; document.getElementById('usuario-rol').value = e.target.dataset.rol; document.getElementById('usuario-nombre').value = decodeURIComponent(e.target.dataset.nombre); document.getElementById('usuario-telefono').value = e.target.dataset.telefono; document.getElementById('modal-usuario').style.display = 'flex';
            }
        });
    }
    }

    document.getElementById('form-editar-usuario')?.addEventListener('submit', async (e) => {
        e.preventDefault(); const btn = e.target.querySelector('button'); btn.textContent = "..."; btn.disabled = true;
        try { await updateDoc(doc(db, "usuarios", document.getElementById('usuario-id').value), { rol: document.getElementById('usuario-rol').value, nombre: document.getElementById('usuario-nombre').value.trim(), telefono: document.getElementById('usuario-telefono').value.trim() }); document.getElementById('modal-usuario').style.display = 'none';
        } catch (e) {} finally { btn.textContent = "Guardar Cambios"; btn.disabled = false; }
    });

    if (document.getElementById('tracking-container')) {
        document.getElementById('tracking-container').innerHTML = ''; const pedidosRecientes = pedidos.sort((a, b) => b.id - a.id).slice(0, 3);
        if (pedidosRecientes.length === 0) document.getElementById('tracking-container').innerHTML = '<p style="padding:20px; color:#888;">No hay pedidos activos.</p>';
        pedidosRecientes.forEach(p => { const idx = p.id % 3; const platforms = ['Uber Eats', 'DiDi Food', 'Pendiente']; const est = idx===0 ? 'En Reparto' : (idx===1 ? 'Preparando' : 'Nuevo'); const card = document.createElement('div'); card.className = 'tracking-card'; card.innerHTML = `<div class="tracking-header"><h4>Pedido #${p.id} (${est})</h4><span class="platform-tag" style="background:#212529; color:white; padding:3px 8px; border-radius:4px;">${platforms[idx]}</span></div>`; document.getElementById('tracking-container').appendChild(card); });
    }

    // ==========================================
    // 3. MÓDULO SCM (El "Cerebro" Logístico)
    // ==========================================
    async function cargarTodoSCM() {
        if (!globalToken) return;
        try {
            // PROVEEDORES
            const resProv = await fetch(`${API_URL}/proveedores`); proveedoresGlobal = await resProv.json();
            document.getElementById('scm-total-prov').textContent = proveedoresGlobal.length;
            const provBody = document.getElementById('proveedores-body'); const selProv = document.getElementById('proveedor-producto');
          if (provBody) {
                provBody.innerHTML = proveedoresGlobal.map(p => `
                    <tr>
                        <td><strong>${p.nombre}</strong></td>
                        <td>${p.contacto}</td>
                        <td>${p.correo}<br><small>${p.telefono}</small></td>
                        <td><span class="badge" style="background:#16a085; color:white;">Activo</span></td>
                        <td>
                            <i class="bi bi-pencil-square icon-edit-prov" data-id="${p.id}" style="cursor:pointer; margin-right:10px; color:#16a085;"></i>
                            <i class="bi bi-trash icon-delete-prov" data-id="${p.id}" style="cursor:pointer; color:#e74c3c;"></i>
                        </td>
                    </tr>`).join('');
            }
            if (selProv) selProv.innerHTML = '<option value="">Selecciona proveedor...</option>' + proveedoresGlobal.map(p => `<option value="${p.id}">${p.nombre}</option>`).join('');

            // ALMACÉN (PRODUCTOS)
            const resProd = await fetch(`${API_URL}/productos`); productosGlobal = await resProd.json();
            let stockCritico = 0, stockNormal = 0, valorInventario = 0;
            const stockBody = document.getElementById('stock-body'); const movProdSel = document.getElementById('mov-producto');
            if (stockBody) stockBody.innerHTML = ''; if (movProdSel) movProdSel.innerHTML = '<option value="">Selecciona un producto</option>';

            productosGlobal.forEach(p => {
                const stockReal = p.stock_actual !== undefined ? p.stock_actual : (p.cantidad || 0);
                const costoReal = p.costo_unitario !== undefined ? p.costo_unitario : (p.precio || 0);
                const min = p.stock_minimo || 0;
                const imgSrc = (p.imagen && p.imagen.startsWith('http')) ? p.imagen : (p.imagen ? '../' + p.imagen : 'https://via.placeholder.com/45?text=Pan');
                
                valorInventario += (stockReal * costoReal);
                if (stockReal <= min) stockCritico++; else stockNormal++;
                
                let tagColor = stockReal <= min ? 'background:#fdedec; color:#e74c3c;' : 'background:#e8f8f5; color:#16a085;';
                if (stockBody) stockBody.innerHTML += `<tr><td><img src="${imgSrc}" style="width: 45px; height: 45px; object-fit: cover; border-radius: 5px; border: 1px solid #ddd;"></td><td><strong>${p.nombre}</strong><br><small style="color:#888;">Logística: <b>${p.estrategia_logistica || 'PULL'}</b></small></td><td><span style="font-weight:bold; color:${stockReal <= min ? '#e74c3c' : '#16a085'}">${stockReal} pcs</span></td><td>${min}</td><td><span style="${tagColor} padding:3px 8px; border-radius:4px; font-size:0.8rem; font-weight:bold;">${stockReal <= min ? 'Stock Bajo' : 'Normal'}</span></td><td><i class="bi bi-pencil-square icon-edit" data-id="${p.id}" style="cursor:pointer; margin-right:10px; color:#16a085;"></i><i class="bi bi-trash icon-delete" data-id="${p.id}" style="cursor:pointer; color:#e74c3c;"></i></td></tr>`;
                if (movProdSel) movProdSel.innerHTML += `<option value="${p.id}">${p.nombre}</option>`;
            });

            document.getElementById('scm-stock-critico').textContent = stockCritico; document.getElementById('scm-valor-inv').textContent = `$${valorInventario.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
            if (document.getElementById('saludInventarioChart')) { if(chartSalud) chartSalud.destroy(); chartSalud = new Chart(document.getElementById('saludInventarioChart'), { type: 'doughnut', data: { labels: ['Normal', 'Crítico'], datasets: [{ data: [stockNormal, stockCritico], backgroundColor: ['#16a085', '#e74c3c'], borderWidth:0 }] }, options: { plugins: { legend: { position: 'bottom' } } } }); }

            // KARDEX (MOVIMIENTOS)
            const resMov = await fetch(`${API_URL}/movimientos`); const movs = await resMov.json();
            let entradas = 0, salidas = 0; const mBody = document.getElementById('movimientos-body'); if (mBody) mBody.innerHTML = '';
            movs.forEach(m => {
                if(m.tipo === 'Entrada') entradas++; else salidas++;
                let prod = productosGlobal.find(x => x.id === m.producto_id); let tagColor = m.tipo === 'Entrada' ? 'color:#16a085; background:#e8f8f5;' : 'color:#e74c3c; background:#fdedec;';
                if (mBody) mBody.innerHTML += `<tr><td><small>${m.fecha}</small></td><td><strong>${prod ? prod.nombre : 'ID: '+m.producto_id}</strong></td><td><span style="${tagColor} padding:3px 8px; border-radius:4px; font-size:0.8rem; font-weight:bold;">${m.tipo}</span></td><td><strong>${m.tipo==='Entrada'?'+':'-'}${m.cantidad}</strong></td><td>${m.motivo}</td></tr>`;
            });
            if (document.getElementById('movimientosChart')) { if(chartMov) chartMov.destroy(); chartMov = new Chart(document.getElementById('movimientosChart'), { type: 'doughnut', data: { labels: ['Entradas', 'Salidas'], datasets: [{ data: [entradas, salidas], backgroundColor: ['#0d6efd', '#f39c12'], borderWidth:0 }] }, options: { plugins: { legend: { position: 'bottom' } } } }); }

           // ÓRDENES DE COMPRA (PUSH Y PULL)
            const resOrd = await fetch(`${API_URL}/ordenes_compra`); const ordenes = await resOrd.json();
            const oBody = document.getElementById('ordenes-body');
            if (oBody) {
                oBody.innerHTML = ''; if(ordenes.length === 0) oBody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:#888; padding: 20px;">No hay órdenes pendientes. El inventario está sano.</td></tr>`;
                ordenes.forEach(o => {
                    let prod = productosGlobal.find(x => x.id === o.producto_id); let prov = proveedoresGlobal.find(x => x.id === o.proveedor_id);
                    let btnAction = o.estado === "Pendiente" ? `<button class="btn-aprobar-orden" data-id="${o.id}" style="background:#0d6efd; color:white; border:none; padding:5px 10px; border-radius:5px; cursor:pointer; font-weight:bold;">Aprobar Reabastecimiento</button>` : `<span style="color:#888;">Aprobada y en Kardex</span>`;
                    
                    // EL CAMBIO: Leemos el tipo desde FastAPI para saber si es PULL o PUSH
                    let textoTipo = o.tipo || "Automática (PUSH)";
                    let colorFondo = textoTipo.includes("PULL") ? "#e6f0ff" : "#fdedec";
                    let colorTexto = textoTipo.includes("PULL") ? "#0d6efd" : "#e74c3c";
                    
                    let tagEstado = o.estado === "Pendiente" ? `<span style="background:${colorFondo}; color:${colorTexto}; padding:4px 8px; border-radius:4px; font-weight:bold;">${textoTipo}</span>` : `<span style="background:#e8f8f5; color:#16a085; padding:4px 8px; border-radius:4px; font-weight:bold;">Completada</span>`;
                    
                    oBody.innerHTML += `<tr><td><small>${o.fecha}</small></td><td>${prov ? prov.nombre : 'Sin proveedor'}</td><td><strong>${prod ? prod.nombre : ''}</strong></td><td><strong style="color:#0d6efd;">${o.cantidad} pcs</strong></td><td>${tagEstado}</td><td>${btnAction}</td></tr>`;
                });
            }
           
            // 5. LLENAR PESTAÑA DE LOGÍSTICA Y ESTRATEGIAS
            let countPush = 0; let countPull = 0;
            const logBody = document.getElementById('log-table-body');
            const logSelect = document.getElementById('log-producto');
            if(logBody) logBody.innerHTML = '';
            if(logSelect) logSelect.innerHTML = '<option value="">Selecciona un producto...</option>';

            productosGlobal.forEach(p => {
                const est = p.estrategia_logistica || 'PULL';
                if(est === 'PUSH') countPush++; else countPull++;
                const stockReal = p.stock_actual !== undefined ? p.stock_actual : (p.cantidad || 0);
                const badgeColor = est === 'PUSH' ? 'background:#e8f8f5; color:#16a085;' : 'background:#e6f0ff; color:#0d6efd;';

                if(logBody) {
                    logBody.innerHTML += `<tr>
                        <td><strong>${p.nombre}</strong></td>
                        <td><small style="color:#888;">${p.categoria}</small></td>
                        <td>${stockReal}</td>
                        <td>${p.stock_minimo || 0}</td>
                        <td><span style="${badgeColor} padding:5px 10px; border-radius:6px; font-weight:bold; font-size:0.8rem; cursor:pointer; display:inline-block;" class="badge-toggle-est" data-id="${p.id}" data-est="${est}" title="Clic para cambiar rápidamente">${est} ⇄</span></td>
                    </tr>`;
                }
                if(logSelect) logSelect.innerHTML += `<option value="${p.id}">${p.nombre}</option>`;
            });

            if(document.getElementById('log-kpi-push')) document.getElementById('log-kpi-push').textContent = countPush;
            if(document.getElementById('log-kpi-pull')) document.getElementById('log-kpi-pull').textContent = countPull;
        } catch (e) {}
    }

    // Formularios SCM
   // Formularios SCM - Proveedores
    document.getElementById('btn-abrir-modal-proveedor')?.addEventListener('click', () => { 
        document.getElementById('form-nuevo-proveedor').reset(); 
        document.getElementById('proveedor-id').value = ''; // Limpiamos el ID oculto
        document.getElementById('modal-proveedor').style.display='flex'; 
    });

    // EDITAR O ELIMINAR PROVEEDOR DESDE LA TABLA
    document.getElementById('proveedores-body')?.addEventListener('click', async (e) => {
        if (e.target.classList.contains('icon-edit-prov')) {
            const p = proveedoresGlobal.find(x => x.id === e.target.dataset.id);
            if (p) {
                document.getElementById('proveedor-id').value = p.id;
                document.getElementById('prov-nombre').value = p.nombre;
                document.getElementById('prov-contacto').value = p.contacto;
                document.getElementById('prov-correo').value = p.correo;
                document.getElementById('prov-telefono').value = p.telefono;
                document.getElementById('modal-proveedor').style.display = 'flex';
            }
        }
        if (e.target.classList.contains('icon-delete-prov') && confirm("¿Eliminar este proveedor de forma permanente?")) {
            await fetch(`${API_URL}/proveedores/${e.target.dataset.id}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${globalToken}` } });
            cargarTodoSCM();
        }
    });

    // GUARDAR (POST) O ACTUALIZAR (PUT) PROVEEDOR
    document.getElementById('form-nuevo-proveedor')?.addEventListener('submit', async (e) => {
        e.preventDefault(); const btn = e.target.querySelector('button'); btn.textContent = "Guardando..."; btn.disabled = true;
        try { 
            const docId = document.getElementById('proveedor-id').value;
            const datosProv = { 
                nombre: document.getElementById('prov-nombre').value.trim(), 
                contacto: document.getElementById('prov-contacto').value.trim(), 
                correo: document.getElementById('prov-correo').value.trim(), 
                telefono: document.getElementById('prov-telefono').value.trim() 
            };
            
            if (docId) {
                await fetch(`${API_URL}/proveedores/${docId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${globalToken}` }, body: JSON.stringify(datosProv) });
            } else {
                await fetch(`${API_URL}/proveedores`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${globalToken}` }, body: JSON.stringify(datosProv) });
            }
            
            document.getElementById('modal-proveedor').style.display='none'; 
            cargarTodoSCM();
        } catch(e) { 
            alert("Error al guardar proveedor"); 
        } finally { 
            btn.textContent = "Guardar Proveedor"; 
            btn.disabled = false; 
        }
    });

    document.getElementById('btn-abrir-modal-mov')?.addEventListener('click', () => { 
        document.getElementById('form-nuevo-movimiento').reset(); 
        document.getElementById('modal-movimiento').style.display='flex'; 
    });

    document.getElementById('form-nuevo-movimiento')?.addEventListener('submit', async (e) => {
        e.preventDefault(); 
        const btn = e.target.querySelector('button'); 
        btn.textContent = "Guardando..."; 
        btn.disabled = true;
        try { 
            const res = await fetch(`${API_URL}/movimientos`, { 
                method: 'POST', 
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${globalToken}` }, 
                body: JSON.stringify({ 
                    producto_id: document.getElementById('mov-producto').value, 
                    tipo: document.querySelector('input[name="mov-tipo"]:checked').value, 
                    cantidad: parseInt(document.getElementById('mov-cantidad').value), 
                    motivo: document.getElementById('mov-motivo').value, 
                    usuario_id: globalUserEmail 
                }) 
            }); 
            
            // 🛑 AQUÍ DETECTA EL CANDADO DE INVENTARIO Y MUESTRA LA NOTIFICACIÓN ROJA
            if (!res.ok) {
                const errorData = await res.json();
                mostrarNotificacion(errorData.detail, 'error'); 
                btn.textContent = "Guardar Movimiento"; 
                btn.disabled = false;
                return;
            }
            
            // ✅ SI TODO SALE BIEN, CIERRA EL MODAL Y MUESTRA NOTIFICACIÓN VERDE
            document.getElementById('modal-movimiento').style.display='none'; 
            mostrarNotificacion("Movimiento registrado con éxito", "exito");
            cargarTodoSCM();
            
        } catch(e) { 
            mostrarNotificacion("Error de conexión al registrar movimiento.", "error"); 
        } finally { 
            btn.textContent = "Guardar Movimiento"; 
            btn.disabled = false; 
        }
    });

    document.getElementById('ordenes-body')?.addEventListener('click', async (e) => {
        if (e.target.classList.contains('btn-aprobar-orden')) {
            if(confirm("¿Aprobar orden? El inventario se actualizará automáticamente y se registrará la entrada en el Kardex.")){
                e.target.textContent = "...";
                await fetch(`${API_URL}/ordenes_compra/${e.target.dataset.id}/estado`, { method: 'PUT', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${globalToken}` }, body: JSON.stringify({estado: "Aprobada"})});
                cargarTodoSCM();
            }
        }
    });

    // PRODUCTOS Y FOTOS IMGBB
    document.getElementById('btn-abrir-modal-producto')?.addEventListener('click', () => { document.getElementById('form-nuevo-producto').reset(); document.getElementById('producto-id').value = ''; if (document.getElementById('imagen-actual')) document.getElementById('imagen-actual').value = ''; document.getElementById('modal-producto').style.display = 'flex'; });
    document.getElementById('stock-body')?.addEventListener('click', async (e) => {
        if (e.target.classList.contains('icon-edit')) {
            const p = productosGlobal.find(x => x.id === e.target.dataset.id);
            if (p) {
                document.getElementById('producto-id').value = p.id; document.getElementById('nombre-producto').value = p.nombre; document.getElementById('categoria-producto').value = p.categoria || 'Panes'; document.getElementById('proveedor-producto').value = p.proveedor_id || ''; document.getElementById('cantidad-producto').value = p.stock_actual !== undefined ? p.stock_actual : (p.cantidad || 0); document.getElementById('minimo-producto').value = p.stock_minimo || 0; document.getElementById('costo-producto').value = p.costo_unitario !== undefined ? p.costo_unitario : (p.precio || 0); document.getElementById('precio-producto').value = p.precio || 0; document.getElementById('estrategia-producto').value = p.estrategia_logistica || 'PULL'; if (document.getElementById('imagen-actual')) document.getElementById('imagen-actual').value = p.imagen || ''; document.getElementById('modal-producto').style.display = 'flex';
            }
        }
        if (e.target.classList.contains('icon-delete') && confirm("¿Eliminar producto permanentemente?")) { await fetch(`${API_URL}/productos/${e.target.dataset.id}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${globalToken}` } }); cargarTodoSCM(); }
    });
    
    document.getElementById('form-nuevo-producto')?.addEventListener('submit', async (e) => {
        e.preventDefault(); const btn = document.getElementById('btn-guardar-producto'); btn.textContent = "Subiendo y guardando..."; btn.disabled = true;
        try {
            let urlImagenFinal = document.getElementById('imagen-actual')?.value || ""; const archivoImagenInput = document.getElementById('imagen-archivo');
            if (archivoImagenInput && archivoImagenInput.files.length > 0) {
                const formData = new FormData(); formData.append("image", archivoImagenInput.files[0]);
                const respuestaImgBB = await fetch(`https://api.imgbb.com/1/upload?key=07cf6c87bdeebfc1e9e0e150e25a96ec`, { method: "POST", body: formData });
                const datosImgBB = await respuestaImgBB.json(); if (datosImgBB.success) urlImagenFinal = datosImgBB.data.url; else alert("Error subiendo imagen.");
            }
            const datosProducto = { nombre: document.getElementById('nombre-producto').value.trim(), categoria: document.getElementById('categoria-producto').value, proveedor_id: document.getElementById('proveedor-producto').value, stock_actual: parseInt(document.getElementById('cantidad-producto').value, 10), stock_minimo: parseInt(document.getElementById('minimo-producto').value, 10), costo_unitario: parseFloat(document.getElementById('costo-producto').value), precio: parseFloat(document.getElementById('precio-producto').value), estrategia_logistica: document.getElementById('estrategia-producto').value, imagen: urlImagenFinal || "https://via.placeholder.com/150?text=Sin+Imagen" };
            const docId = document.getElementById('producto-id').value;
            if (docId) await fetch(`${API_URL}/productos/${docId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${globalToken}` }, body: JSON.stringify(datosProducto) });
            else await fetch(`${API_URL}/productos`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${globalToken}` }, body: JSON.stringify(datosProducto) });
            document.getElementById('modal-producto').style.display = 'none'; cargarTodoSCM();
        } catch (error) {} finally { btn.textContent = "Guardar Producto"; btn.disabled = false; }
    });
// GUARDAR ESTRATEGIA DESDE EL FORMULARIO
    document.getElementById('form-estrategia')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = e.target.querySelector('button'); btn.textContent = "Guardando..."; btn.disabled = true;
        try {
            const prodId = document.getElementById('log-producto').value;
            const nuevaEst = document.querySelector('input[name="log-est"]:checked').value;
            const prod = productosGlobal.find(x => x.id === prodId);
            
            if(prod) {
                // Limpiamos los datos para que FastAPI no rechace productos viejos
                const prodSeguro = {
                    nombre: prod.nombre,
                    categoria: prod.categoria || 'Panes',
                    proveedor_id: prod.proveedor_id || '',
                    stock_actual: prod.stock_actual !== undefined ? prod.stock_actual : (prod.cantidad || 0),
                    stock_minimo: prod.stock_minimo || 0,
                    costo_unitario: prod.costo_unitario !== undefined ? prod.costo_unitario : (prod.precio || 0),
                    precio: prod.precio || 0,
                    estrategia_logistica: nuevaEst,
                    imagen: prod.imagen || ''
                };

                await fetch(`${API_URL}/productos/${prodId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${globalToken}` }, body: JSON.stringify(prodSeguro) });
                cargarTodoSCM();
            }
        } catch(err) { alert('Error al actualizar estrategia'); }
        finally { btn.textContent = "Guardar estrategia"; btn.disabled = false; e.target.reset(); }
    });

    // CAMBIAR ESTRATEGIA CON UN CLIC EN LA TABLA (MODO RÁPIDO)
    document.getElementById('log-table-body')?.addEventListener('click', async (e) => {
        if(e.target.classList.contains('badge-toggle-est')) {
            const prodId = e.target.dataset.id;
            const nuevaEst = e.target.dataset.est === 'PUSH' ? 'PULL' : 'PUSH';
            const prod = productosGlobal.find(x => x.id === prodId);
            
            if(prod) {
                e.target.textContent = "...";
                // Limpiamos los datos para que FastAPI no rechace productos viejos
                const prodSeguro = {
                    nombre: prod.nombre,
                    categoria: prod.categoria || 'Panes',
                    proveedor_id: prod.proveedor_id || '',
                    stock_actual: prod.stock_actual !== undefined ? prod.stock_actual : (prod.cantidad || 0),
                    stock_minimo: prod.stock_minimo || 0,
                    costo_unitario: prod.costo_unitario !== undefined ? prod.costo_unitario : (prod.precio || 0),
                    precio: prod.precio || 0,
                    estrategia_logistica: nuevaEst,
                    imagen: prod.imagen || ''
                };

                await fetch(`${API_URL}/productos/${prodId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${globalToken}` }, body: JSON.stringify(prodSeguro) });
                cargarTodoSCM();
            }
        }
    });

    // ==========================================
    // 4. MÓDULO ERP · ÓRDENES DE CLIENTES
    // ==========================================
    const erpDatos = { clientes: [], productos: [], ordenes: [], movimientos: [], cargado: false };
    const erpCarrito = new Map();
    const erpGraficas = {};
    let erpSolicitudId = null;
    let erpOrdenCreada = null;
    let erpEnviando = false;

    const erpEsc = (valor) => String(valor ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    const erpMXN = (numero) => new Intl.NumberFormat('es-MX', { style:'currency', currency:'MXN' }).format(Number(numero) || 0);
    const erpFecha = (fecha) => { const valor = new Date(fecha); return Number.isNaN(valor.getTime()) ? '—' : valor.toLocaleString('es-MX'); };
    const erpIdNuevo = () => (globalThis.crypto?.randomUUID?.() || `${Date.now()}_${Math.random().toString(36).slice(2)}`).replace(/[^A-Za-z0-9_-]/g, '');
    const erpStock = p => Number(p?.stock_actual ?? p?.cantidad ?? 0);
    const erpElemento = id => document.getElementById(id);
    const erpTexto = (id, contenido) => { const elem = erpElemento(id); if (elem) elem.textContent = contenido; };

    async function erpApi(ruta, options = {}) {
        const usuario = getAuth().currentUser;
        if (!usuario) throw new Error('La sesión ha caducado. Vuelve a iniciar sesión.');
        const tokenActual = await usuario.getIdToken();
        const respuesta = await fetch(`${API_URL}${ruta}`, {
            ...options,
            headers: { Authorization: `Bearer ${tokenActual}`, ...(options.body ? {'Content-Type': 'application/json'} : {}), ...(options.headers || {}) }
        });
        const respuestaTexto = await respuesta.text();
        let dato;
        try { dato = respuestaTexto ? JSON.parse(respuestaTexto) : null; }
        catch { dato = null; }
        if (!respuesta.ok) {
            const mensaje = typeof dato?.detail === 'string' ? dato.detail : `Error HTTP ${respuesta.status}`;
            throw new Error(mensaje);
        }
        return dato;
    }

    async function cargarERP() {
        if (!globalToken) return;
        erpDatos.cargado = false;
        try {
            const [clientes, productos, ordenes, movimientos] = await Promise.all([
                erpApi('/clientes'), erpApi('/productos'), erpApi('/ordenes_clientes'), erpApi('/movimientos')
            ]);
            if (![clientes, productos, ordenes, movimientos].every(Array.isArray)) throw new Error('Los datos ERP recibidos no son válidos');
            Object.assign(erpDatos, { clientes, productos, ordenes, movimientos, cargado: true });
            renderizarERP();
        } catch (error) {
            console.error('Error al cargar ERP:', error);
            mostrarNotificacion(`No se pudo cargar ERP: ${error.message}`);
        }
    }

    function erpOrdenesValidas() {
        return erpDatos.ordenes.filter(o => ['Procesada', 'Completada'].includes(o.estado));
    }

    function erpEstadisticas() {
        const ordenes = erpOrdenesValidas();
        const vendidos = new Map();
        let unidades = 0;
        const meses = [];
        const hoy = new Date();
        for (let desplazamiento = 5; desplazamiento >= 0; desplazamiento--) {
            const fecha = new Date(hoy.getFullYear(), hoy.getMonth() - desplazamiento, 1);
            meses.push({ key: `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}`, label: fecha.toLocaleDateString('es-MX', {month:'short', year:'2-digit'}), valor: 0 });
        }
        ordenes.forEach(orden => {
            const fecha = new Date(orden.fecha);
            if (!Number.isNaN(fecha.getTime())) {
                const key = `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}`;
                const mes = meses.find(m => m.key === key);
                if (mes) mes.valor += Number(orden.total) || 0;
            }
            (orden.items || []).forEach(item => {
                const cantidad = Number(item.cantidad) || 0;
                unidades += cantidad;
                const key = item.producto_id || item.nombre;
                const previo = vendidos.get(key) || { nombre: item.nombre || 'Producto', cantidad: 0 };
                previo.cantidad += cantidad;
                vendidos.set(key, previo);
            });
        });
        return {
            ordenes,
            ventas: ordenes.reduce((s, o) => s + (Number(o.total) || 0), 0),
            unidades, meses,
            top: [...vendidos.values()].sort((a, b) => b.cantidad - a.cantidad).slice(0, 5),
            activos: erpDatos.clientes.filter(c => !String(c.estado || 'activo').toLowerCase().includes('inactivo') && !String(c.estado || '').toLowerCase().includes('prospecto')).length,
            disponibles: erpDatos.productos.filter(p => erpStock(p) > 0).length
        };
    }

    function erpDibujarGrafica(id, tipo, etiquetas, valores, colores, horizontal = false) {
        const canvas = erpElemento(id);
        if (!canvas || typeof Chart === 'undefined') return;
        if (erpGraficas[id]) erpGraficas[id].destroy();
        erpGraficas[id] = new Chart(canvas, {
            type: tipo,
            data: { labels: etiquetas, datasets: [{ label: tipo === 'bar' ? 'Cantidad / ventas' : 'Productos', data: valores, backgroundColor: colores, borderWidth: 0, borderRadius: tipo === 'bar' ? 5 : 0 }] },
            options: { responsive:true, maintainAspectRatio:false, indexAxis: horizontal ? 'y' : 'x',
                plugins: { legend: { display:tipo === 'doughnut', position:'bottom' } },
                scales: tipo === 'bar' ? { x:{ beginAtZero:true }, y:{ beginAtZero:true } } : undefined }
        });
    }

    function erpFilaOrden(orden) {
        const folio = erpEsc(orden.folio || orden.id);
        return `<tr><td><strong>${folio}</strong></td><td>${erpEsc(erpFecha(orden.fecha))}</td><td>${erpEsc(orden.cliente_nombre || 'Cliente')}</td><td>${erpMXN(orden.total)}</td><td><span class="erp-status">${erpEsc(orden.estado || 'Procesada')}</span></td><td><button class="erp-btn secondary erp-ver-orden" type="button" data-id="${erpEsc(orden.id)}"><i class="bi bi-eye"></i> Ver</button></td></tr>`;
    }

    function renderizarERP() {
        const e = erpEstadisticas();
        erpTexto('erp-kpi-clientes', e.activos);
        erpTexto('erp-kpi-ordenes', e.ordenes.length);
        erpTexto('erp-kpi-ventas', erpMXN(e.ventas));
        erpTexto('erp-kpi-unidades', e.unidades);
        erpTexto('erp-reporte-ventas', erpMXN(e.ventas));
        erpTexto('erp-reporte-ordenes', e.ordenes.length);
        erpTexto('erp-reporte-unidades', e.unidades);
        erpTexto('erp-reporte-disponibles', `${e.disponibles} / ${erpDatos.productos.length}`);
        const ultimas = erpDatos.ordenes.slice(0, 5);
        erpElemento('erp-ultimas-body').innerHTML = ultimas.length ? ultimas.map(erpFilaOrden).join('') : '<tr><td colspan="6" class="erp-empty">Aún no hay órdenes de clientes.</td></tr>';
        erpListaOrdenes();
        erpDibujarGrafica('erp-chart-ventas', 'bar', e.meses.map(m => m.label), e.meses.map(m => m.valor), '#3180f7');
        erpDibujarGrafica('erp-chart-ventas-reporte', 'bar', e.meses.map(m => m.label), e.meses.map(m => m.valor), '#3180f7');
        const top = e.top.length ? e.top : [{nombre:'Sin ventas', cantidad:0}];
        erpDibujarGrafica('erp-chart-top', 'bar', top.map(t => t.nombre), top.map(t => t.cantidad), '#0cb08a', true);
        erpDibujarGrafica('erp-chart-top-reporte', 'bar', top.map(t => t.nombre), top.map(t => t.cantidad), '#0cb08a', true);
        erpDibujarGrafica('erp-chart-inventario', 'doughnut', ['Con existencias', 'Sin existencias'], [e.disponibles, erpDatos.productos.length - e.disponibles], ['#07916f', '#f0a128']);
        erpNivelImplementacion();
        erpRenderClientes();
        erpRenderProductos();
        erpRenderCarrito();
    }

    function erpListaOrdenes() {
        const filtro = (erpElemento('erp-buscar-orden')?.value || '').toLowerCase().trim();
        const visibles = erpDatos.ordenes.filter(o => `${o.folio || ''} ${o.cliente_nombre || ''} ${o.estado || ''}`.toLowerCase().includes(filtro));
        erpTexto('erp-count-ordenes', `${visibles.length} órdenes`);
        erpElemento('erp-ordenes-body').innerHTML = visibles.length ? visibles.map(erpFilaOrden).join('') : '<tr><td colspan="6" class="erp-empty">No hay órdenes que coincidan.</td></tr>';
    }

    function erpNivelImplementacion() {
        const valido = erpDatos.cargado;
        const hayVentas = erpDatos.ordenes.length > 0;
        const movimientosERP = erpDatos.movimientos.some(m => !!m.orden_cliente_id);
        const checks = [
            { ok: valido, descripcion: 'Clientes enlazados al CRM (consulta operativa)' },
            { ok: valido, descripcion: 'Productos e inventario enlazados al SCM (consulta operativa)' },
            { ok: valido, descripcion: 'Módulo de órdenes ERP disponible' },
            { ok: hayVentas, descripcion: 'Al menos una orden real procesada' },
            { ok: movimientosERP, descripcion: 'Movimientos automáticos ERP verificados en Kardex' },
            { ok: false, descripcion: 'Optimización avanzada con indicadores y procesos auditados (pendiente)' }
        ];
        const nivel = !valido ? 0 : movimientosERP ? 2 : 1;
        erpTexto('erp-nivel-titulo', `Nivel actual: ${['Básico', 'Integrado', 'Automatizado', 'Optimizado'][nivel]}`);
        [...erpElemento('erp-madurez').children].forEach((n, i) => n.classList.toggle('active', i <= nivel));
        erpElemento('erp-checklist').innerHTML = checks.map(c => `<div class="${c.ok ? 'ok' : 'pending'}"><i class="bi bi-${c.ok ? 'check-square-fill' : 'square'}"></i> ${erpEsc(c.descripcion)}</div>`).join('');
    }

    function erpRenderClientes() {
        const select = erpElemento('erp-select-cliente');
        if (!select) return;
        const filtro = (erpElemento('erp-buscar-cliente')?.value || '').toLowerCase();
        const anterior = select.value;
        const activos = erpDatos.clientes.filter(c => !String(c.estado || '').toLowerCase().includes('inactivo'));
        const filtrados = activos.filter(c => `${c.nombre || ''} ${c.empresa || ''} ${c.correo || ''}`.toLowerCase().includes(filtro));
        select.innerHTML = '<option value="">Selecciona un cliente...</option>' + filtrados.map(c => `<option value="${erpEsc(c.id)}">${erpEsc(c.nombre)} · ${erpEsc(c.empresa || c.correo || 'Sin empresa')}</option>`).join('');
        if (filtrados.some(c => c.id === anterior)) select.value = anterior;
        erpMostrarCliente();
    }

    function erpMostrarCliente() {
        const id = erpElemento('erp-select-cliente')?.value;
        const c = erpDatos.clientes.find(cl => cl.id === id);
        const tarjeta = erpElemento('erp-cliente-seleccionado');
        tarjeta.style.display = c ? 'block' : 'none';
        if (c) tarjeta.innerHTML = `<strong>${erpEsc(c.nombre)}</strong><div>${erpEsc(c.empresa || '')}</div><small>${erpEsc(c.correo || '')} · ${erpEsc(c.telefono || '')}</small>`;
    }

    function erpRenderProductos() {
        const cuerpo = erpElemento('erp-productos-body');
        if (!cuerpo) return;
        const filtro = (erpElemento('erp-buscar-producto')?.value || '').toLowerCase();
        const disponibles = erpDatos.productos.filter(p => `${p.nombre || ''} ${p.categoria || ''}`.toLowerCase().includes(filtro));
        cuerpo.innerHTML = disponibles.length ? disponibles.map(p => {
            const stock = erpStock(p);
            const precio = Number(p.precio);
            const valido = p.precio !== undefined && p.precio !== null && p.precio !== '' && Number.isFinite(precio) && precio >= 0;
            return `<tr><td><span class="erp-item-name">${erpEsc(p.nombre)}</span><br><small>${erpEsc(p.categoria || '')}</small></td><td>${stock}</td><td>${valido ? erpMXN(precio) : 'Precio no disponible'}</td><td><input class="erp-input erp-cantidad" type="number" min="1" max="${Math.max(0,stock)}" value="1" data-id="${erpEsc(p.id)}" style="max-width:85px;"></td><td><button type="button" class="erp-btn erp-agregar" data-id="${erpEsc(p.id)}" ${stock <= 0 || !valido ? 'disabled' : ''}><i class="bi bi-plus-lg"></i> Agregar</button></td></tr>`;
        }).join('') : '<tr><td colspan="5" class="erp-empty">No hay productos que coincidan.</td></tr>';
    }

    function erpRenderCarrito() {
        const cuerpo = erpElemento('erp-carrito-body');
        if (!cuerpo) return;
        let html = '', total = 0;
        for (const [id, cantidad] of erpCarrito) {
            const prod = erpDatos.productos.find(p => p.id === id);
            if (!prod) continue;
            const subtotal = (Number(prod.precio) || 0) * cantidad;
            total += subtotal;
            html += `<tr><td>${erpEsc(prod.nombre)}</td><td>${cantidad}</td><td>${erpMXN(subtotal)}</td><td><button type="button" class="erp-btn secondary erp-quitar" data-id="${erpEsc(id)}">Quitar</button></td></tr>`;
        }
        cuerpo.innerHTML = html || '<tr><td colspan="4" class="erp-empty">Agrega al menos un producto.</td></tr>';
        erpTexto('erp-resumen-subtotal', erpMXN(total));
        erpTexto('erp-resumen-total', erpMXN(total));
    }

    function erpResumen() {
        const c = erpDatos.clientes.find(x => x.id === erpElemento('erp-select-cliente').value);
        erpElemento('erp-resumen-cliente').innerHTML = c ? `<strong>Cliente:</strong> ${erpEsc(c.nombre)} <small>(${erpEsc(c.correo || '')})</small>` : '';
        const filas = [...erpCarrito].map(([id, cantidad]) => {
            const p = erpDatos.productos.find(x => x.id === id);
            if (!p) return '';
            return `<tr><td>${erpEsc(p.nombre)}</td><td>${cantidad}</td><td>${erpMXN(p.precio)}</td><td>${erpMXN(Number(p.precio) * cantidad)}</td></tr>`;
        });
        erpElemento('erp-resumen-body').innerHTML = filas.join('');
        erpRenderCarrito();
    }

    function erpPaso(paso) {
        for (let i=1; i<=3; i++) {
            erpElemento(`erp-paso-${i}`).hidden = i !== paso;
            erpElemento(`erp-indicador-${i}`).className = `erp-step ${i < paso ? 'done' : i === paso ? 'active' : ''}`;
        }
        erpElemento('erp-procesando').hidden = true;
        if (paso === 3) erpResumen();
    }

    async function erpIniciar() {
        if (!['admin','ventas'].includes(globalRol)) return;
        await cargarERP();
        if (!erpDatos.cargado) return;
        erpCarrito.clear();
        erpSolicitudId = erpIdNuevo();
        erpElemento('erp-buscar-cliente').value = '';
        erpElemento('erp-buscar-producto').value = '';
        erpRenderClientes();
        erpElemento('erp-select-cliente').value = '';
        erpMostrarCliente();
        erpRenderProductos();
        erpRenderCarrito();
        erpPaso(1);
        mostrarSeccion('#seccion-erp-nueva');
    }

    function erpVerDetalle(id) {
        const orden = erpDatos.ordenes.find(o => o.id === id) || (erpOrdenCreada?.id === id ? erpOrdenCreada : null);
        if (!orden) { mostrarNotificacion('No se encontró la orden.'); return; }
        erpTexto('erp-detalle-folio', orden.folio || orden.id);
        erpTexto('erp-detalle-metadatos', `${orden.cliente_nombre || 'Cliente'} · ${erpFecha(orden.fecha)} · ${orden.estado || ''}`);
        erpElemento('erp-detalle-body').innerHTML = (orden.items || []).map(i => `<tr><td>${erpEsc(i.nombre)}</td><td>${Number(i.cantidad) || 0}</td><td>${erpMXN(i.precio_unitario)}</td><td>${erpMXN(i.subtotal)}</td></tr>`).join('');
        erpTexto('erp-detalle-total', erpMXN(orden.total));
        mostrarSeccion('#seccion-erp-detalle');
    }

    async function erpConfirmarOrden() {
        if (erpEnviando || !erpCarrito.size) return;
        const clienteId = erpElemento('erp-select-cliente').value;
        const items = [...erpCarrito].map(([producto_id, cantidad]) => ({producto_id, cantidad}));
        erpEnviando = true;
        erpElemento('erp-confirmar').disabled = true;
        [1,2,3].forEach(i => { erpElemento(`erp-paso-${i}`).hidden = true; });
        erpElemento('erp-procesando').hidden = false;
        try {
            const orden = await erpApi('/ordenes_clientes', {
                method: 'POST', body: JSON.stringify({cliente_id: clienteId, items, solicitud_id: erpSolicitudId})
            });
            erpOrdenCreada = orden;
            erpTexto('erp-exito-folio', orden.folio || orden.id);
            erpTexto('erp-exito-cliente', orden.cliente_nombre);
            erpTexto('erp-exito-total', erpMXN(orden.total));
            erpTexto('erp-exito-fecha', erpFecha(orden.fecha));
            mostrarSeccion('#seccion-erp-exito');
            mostrarNotificacion('Orden registrada e inventario actualizado.', 'exito');
            // La operación ya fue confirmada. Fallas de refresco no revierten la venta.
            cargarERP();
            cargarTodoSCM();
        } catch (error) {
            mostrarNotificacion(`No se pudo confirmar la operación: ${error.message}. Si fue un fallo de red, puedes reintentar sin duplicar el pedido.`, 'error');
            erpPaso(3);
        } finally {
            erpEnviando = false;
            erpElemento('erp-confirmar').disabled = false;
        }
    }

    erpElemento('erp-nueva-dashboard')?.addEventListener('click', erpIniciar);
    erpElemento('erp-nueva-listado')?.addEventListener('click', erpIniciar);
    erpElemento('erp-buscar-orden')?.addEventListener('input', erpListaOrdenes);
    erpElemento('erp-buscar-cliente')?.addEventListener('input', erpRenderClientes);
    erpElemento('erp-select-cliente')?.addEventListener('change', erpMostrarCliente);
    erpElemento('erp-buscar-producto')?.addEventListener('input', erpRenderProductos);
    erpElemento('erp-cancelar-orden')?.addEventListener('click', () => mostrarSeccion('#seccion-erp-ordenes'));
    erpElemento('erp-abrir-nuevo-cliente')?.addEventListener('click', () => erpElemento('btn-abrir-modal-cliente').click());
    erpElemento('erp-cliente-siguiente')?.addEventListener('click', () => {
        if (!erpElemento('erp-select-cliente').value) return mostrarNotificacion('Selecciona un cliente para continuar.');
        erpPaso(2);
    });
    erpElemento('erp-productos-atras')?.addEventListener('click', () => erpPaso(1));
    erpElemento('erp-productos-siguiente')?.addEventListener('click', () => {
        if (!erpCarrito.size) return mostrarNotificacion('Agrega al menos un producto.');
        for (const [id, cantidad] of erpCarrito) {
            const producto = erpDatos.productos.find(p => p.id === id);
            if (!producto || cantidad > erpStock(producto)) return mostrarNotificacion('Hay productos sin stock suficiente.');
        }
        erpPaso(3);
    });
    erpElemento('erp-resumen-atras')?.addEventListener('click', () => erpPaso(2));
    erpElemento('erp-confirmar')?.addEventListener('click', erpConfirmarOrden);
    erpElemento('erp-exito-ver')?.addEventListener('click', () => erpVerDetalle(erpOrdenCreada?.id));
    erpElemento('erp-exito-volver')?.addEventListener('click', () => mostrarSeccion('#seccion-erp-ordenes'));
    erpElemento('erp-detalle-volver')?.addEventListener('click', () => mostrarSeccion('#seccion-erp-ordenes'));
    erpElemento('erp-productos-body')?.addEventListener('click', e => {
        const btn = e.target.closest('.erp-agregar');
        if (!btn || btn.disabled) return;
        const id = btn.dataset.id;
        const producto = erpDatos.productos.find(p => p.id === id);
        const cantidad = Number(e.currentTarget.querySelector(`.erp-cantidad[data-id="${CSS.escape(id)}"]`)?.value);
        if (!producto || !Number.isInteger(cantidad) || cantidad < 1) return mostrarNotificacion('Indica una cantidad válida.');
        const nueva = cantidad + (erpCarrito.get(id) || 0);
        if (nueva > erpStock(producto)) return mostrarNotificacion('Cantidad superior a las existencias disponibles.');
        erpCarrito.set(id, nueva);
        erpRenderCarrito();
    });
    erpElemento('erp-carrito-body')?.addEventListener('click', e => {
        const btn = e.target.closest('.erp-quitar');
        if (btn) { erpCarrito.delete(btn.dataset.id); erpRenderCarrito(); }
    });
    ['erp-ordenes-body','erp-ultimas-body'].forEach(id => erpElemento(id)?.addEventListener('click', e => {
        const btn = e.target.closest('.erp-ver-orden');
        if (btn) erpVerDetalle(btn.dataset.id);
    }));

    // ==========================================
    // 4. SISTEMA DE NAVEGACIÓN Y BÚSQUEDA
    // ==========================================

    // ==========================================
    // ÓRDENES MANUALES PULL
    // ==========================================
    const btnAbrirOrden = document.getElementById('btn-abrir-modal-orden');
    const modalOrd = document.getElementById('modal-orden');

    if (btnAbrirOrden) {
        btnAbrirOrden.addEventListener('click', () => { 
            const selectProd = document.getElementById('ord-producto');
            if (selectProd) {
                selectProd.innerHTML = '<option value="">Selecciona qué producto pedir...</option>' + 
                productosGlobal.map(p => `<option value="${p.id}">${p.nombre} (Stock: ${p.stock_actual !== undefined ? p.stock_actual : (p.cantidad || 0)})</option>`).join('');
            }
            document.getElementById('form-nueva-orden').reset(); 
            if (modalOrd) modalOrd.style.display = 'flex'; 
        });
    }

    document.getElementById('form-nueva-orden')?.addEventListener('submit', async (e) => {
        e.preventDefault(); 
        const btn = e.target.querySelector('button'); 
        btn.textContent = "Generando..."; 
        btn.disabled = true;
        try { 
            const prodId = document.getElementById('ord-producto').value;
            const prod = productosGlobal.find(x => x.id === prodId);
            const cantidad = parseInt(document.getElementById('ord-cantidad').value);
            
            const res = await fetch(`${API_URL}/ordenes_compra`, { 
                method: 'POST', 
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${globalToken}` }, 
                body: JSON.stringify({ producto_id: prodId, proveedor_id: prod.proveedor_id || "", cantidad: cantidad }) 
            }); 
            
            if (!res.ok) {
                const err = await res.json();
                alert("❌ " + err.detail);
                return;
            }
            
            if (modalOrd) modalOrd.style.display = 'none'; 
            cargarTodoSCM();
        } catch(e) { 
            alert("Error al generar orden manual"); 
        } finally { 
            btn.textContent = "Generar Orden de Compra"; 
            btn.disabled = false; 
        }
    });
    const seccionesMap = {
        '#dashboard-crm': ['.metrics-section', '#seccion-graficas'],
        '#seccion-reportes': ['#seccion-reportes'],
        '#seccion-clientes': ['#seccion-clientes'],
        '#seccion-interacciones': ['#seccion-interacciones'],
        '#seccion-usuarios': ['#seccion-usuarios'],
        '#seccion-productos': ['#seccion-productos'],
        '#seccion-pedidos': ['#seccion-pedidos'],
        '#seccion-dashboard-scm': ['#seccion-dashboard-scm'],
        '#seccion-movimientos': ['#seccion-movimientos'],
        '#seccion-ordenes': ['#seccion-ordenes'],
        '#seccion-logistica': ['#seccion-logistica'],
        '#seccion-proveedores': ['#seccion-proveedores'],
        '#seccion-erp-dashboard': ['#seccion-erp-dashboard'],
        '#seccion-erp-ordenes': ['#seccion-erp-ordenes'],
        '#seccion-erp-nueva': ['#seccion-erp-nueva'],
        '#seccion-erp-detalle': ['#seccion-erp-detalle'],
        '#seccion-erp-exito': ['#seccion-erp-exito'],
        '#seccion-erp-reportes': ['#seccion-erp-reportes'],
        '#seccion-erp-nivel': ['#seccion-erp-nivel'],
        '#seccion-erp-roles': ['#seccion-erp-roles']
    };

    function mostrarSeccion(destino) {
        const partes = seccionesMap[destino];
        if (!partes) return;
        const seccion = destino !== '#dashboard-crm' ? document.querySelector(destino) : null;
        if (seccion?.dataset.roles && !seccion.dataset.roles.split(',').includes(globalRol)) return;
        document.querySelectorAll('.crud-section, .tracking-section, .metrics-section, .charts-section').forEach(seccion => seccion.classList.add('seccion-oculta'));
        partes.forEach(selector => document.querySelector(selector)?.classList.remove('seccion-oculta'));
        document.querySelectorAll('.sidebar-menu li').forEach(li => li.classList.remove('active'));
        document.querySelector(`.sidebar-menu a[href="${destino}"]`)?.closest('li')?.classList.add('active');
        if (document.getElementById('global-search')) document.getElementById('global-search').value = '';
        if (destino.startsWith('#seccion-erp')) {
            // Chart.js debe reajustarse después de mostrar contenedores que estaban ocultos.
            requestAnimationFrame(() => Object.values(erpGraficas).forEach(grafica => grafica.resize()));
        }
    }

    document.querySelectorAll('.sidebar-menu li a, .link-navegacion').forEach(link => {
        link.addEventListener('click', e => {
            const destino = link.getAttribute('href');
            if (!destino?.startsWith('#')) return;
            e.preventDefault();
            mostrarSeccion(destino);
        });
    });

    document.getElementById('global-search')?.addEventListener('input', (e) => {
        const term = e.target.value.toLowerCase().trim();
        const activeSection = document.querySelector('section:not(.seccion-oculta)');
        if (!activeSection) return;
        activeSection.querySelectorAll('tbody tr').forEach(fila => { fila.style.display = fila.textContent.toLowerCase().includes(term) ? '' : 'none'; });
    });
});