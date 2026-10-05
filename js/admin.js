import { initializeApp } from "https://www.gstatic.com/firebasejs/10.5.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.5.0/firebase-auth.js";
import { getFirestore, collection, query, where, getDocs, updateDoc, doc, onSnapshot } from "https://www.gstatic.com/firebasejs/10.5.0/firebase-firestore.js";

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

let globalToken = null; let globalUserEmail = null;
let interaccionesChart = null; let repBarChart = null; let repPieChart = null; let chartSalud = null; let chartMov = null;
let productosGlobal = []; let proveedoresGlobal = [];

document.addEventListener('DOMContentLoaded', () => {
    
    // ==========================================
    // 1. SEGURIDAD Y CARGA INICIAL
    // ==========================================
    onAuthStateChanged(getAuth(), async (user) => {
        if (!user) return window.location.href = "../index.html";
        try {
            const q = query(collection(db, "usuarios"), where("correo", "==", user.email));
            const querySnapshot = await getDocs(q);
            if (querySnapshot.empty) return window.location.href = "../index.html";
            let esAdmin = false; querySnapshot.forEach((docSnap) => { if (docSnap.data().rol === 'admin') esAdmin = true; });
            if (!esAdmin) { alert("Acceso denegado."); window.location.href = "../index.html"; }
            
            globalToken = await user.getIdToken();
            globalUserEmail = user.email;
            
            inicializarGraficasCRM();
            cargarTodoSCM(); 
            recargarDatosCRM();
        } catch (error) { window.location.href = "../index.html"; }
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
            else { await fetch(`${API_URL}/clientes`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${globalToken}` }, body: JSON.stringify(datosCliente) }); }
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
            if (provBody) provBody.innerHTML = proveedoresGlobal.map(p => `<tr><td><strong>${p.nombre}</strong></td><td>${p.contacto}</td><td>${p.correo}<br><small>${p.telefono}</small></td><td><span class="badge" style="background:#16a085; color:white;">Activo</span></td></tr>`).join('');
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

            // ÓRDENES DE COMPRA AUTOMÁTICAS (PUSH)
            const resOrd = await fetch(`${API_URL}/ordenes_compra`); const ordenes = await resOrd.json();
            const oBody = document.getElementById('ordenes-body');
            if (oBody) {
                oBody.innerHTML = ''; if(ordenes.length === 0) oBody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:#888; padding: 20px;">No hay órdenes pendientes. El inventario está sano.</td></tr>`;
                ordenes.forEach(o => {
                    let prod = productosGlobal.find(x => x.id === o.producto_id); let prov = proveedoresGlobal.find(x => x.id === o.proveedor_id);
                    let btnAction = o.estado === "Pendiente" ? `<button class="btn-aprobar-orden" data-id="${o.id}" style="background:#0d6efd; color:white; border:none; padding:5px 10px; border-radius:5px; cursor:pointer; font-weight:bold;">Aprobar Reabastecimiento</button>` : `<span style="color:#888;">Aprobada y en Kardex</span>`;
                    let tagEstado = o.estado === "Pendiente" ? `<span style="background:#fdedec; color:#e74c3c; padding:4px 8px; border-radius:4px; font-weight:bold;">Sugerida (PUSH)</span>` : `<span style="background:#e8f8f5; color:#16a085; padding:4px 8px; border-radius:4px; font-weight:bold;">Completada</span>`;
                    oBody.innerHTML += `<tr><td><small>${o.fecha}</small></td><td>${prov ? prov.nombre : 'Sin proveedor'}</td><td><strong>${prod ? prod.nombre : ''}</strong></td><td><strong style="color:#0d6efd;">${o.cantidad} pcs</strong></td><td>${tagEstado}</td><td>${btnAction}</td></tr>`;
                });
            }
        } catch (e) {}
    }

    // Formularios SCM
    document.getElementById('btn-abrir-modal-proveedor')?.addEventListener('click', () => { document.getElementById('form-nuevo-proveedor').reset(); document.getElementById('modal-proveedor').style.display='flex'; });
    document.getElementById('form-nuevo-proveedor')?.addEventListener('submit', async (e) => {
        e.preventDefault(); const btn = e.target.querySelector('button'); btn.textContent = "..."; btn.disabled = true;
        try { await fetch(`${API_URL}/proveedores`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${globalToken}` }, body: JSON.stringify({ nombre: document.getElementById('prov-nombre').value, contacto: document.getElementById('prov-contacto').value, correo: document.getElementById('prov-correo').value, telefono: document.getElementById('prov-telefono').value }) }); document.getElementById('modal-proveedor').style.display='none'; cargarTodoSCM();
        } catch(e) {} finally { btn.textContent = "Guardar Proveedor"; btn.disabled = false; }
    });

    document.getElementById('btn-abrir-modal-mov')?.addEventListener('click', () => { document.getElementById('form-nuevo-movimiento').reset(); document.getElementById('modal-movimiento').style.display='flex'; });
    document.getElementById('form-nuevo-movimiento')?.addEventListener('submit', async (e) => {
        e.preventDefault(); const btn = e.target.querySelector('button'); btn.textContent = "..."; btn.disabled = true;
        try { await fetch(`${API_URL}/movimientos`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${globalToken}` }, body: JSON.stringify({ producto_id: document.getElementById('mov-producto').value, tipo: document.querySelector('input[name="mov-tipo"]:checked').value, cantidad: parseInt(document.getElementById('mov-cantidad').value), motivo: document.getElementById('mov-motivo').value, usuario_id: globalUserEmail }) }); document.getElementById('modal-movimiento').style.display='none'; cargarTodoSCM();
        } catch(e) {} finally { btn.textContent = "Guardar Movimiento"; btn.disabled = false; }
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

    // ==========================================
    // 4. SISTEMA DE NAVEGACIÓN Y BÚSQUEDA
    // ==========================================
    const menuLinks = document.querySelectorAll('.sidebar-menu li a, .link-navegacion');
    const seccionesMap = { 'Dashboard CRM': ['.metrics-section', '#seccion-graficas'], 'Reportes': ['#seccion-reportes'], 'Clientes': ['#seccion-clientes'], 'Historial de Interacciones': ['#seccion-interacciones'], 'Staff': ['#seccion-usuarios'], 'Catálogo': ['#seccion-productos'], 'Pedidos': ['#seccion-pedidos'], 'Dashboard SCM': ['#seccion-dashboard-scm'], 'Kardex': ['#seccion-movimientos'], 'Órdenes': ['#seccion-ordenes'], 'Proveedores': ['#seccion-proveedores'], 'Ver todos': ['#seccion-proveedores'], 'Revisar inventario': ['#seccion-productos'] };

    menuLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            const txt = e.currentTarget.textContent.trim().replace(' →', '');
            if (txt.includes('Volver') || txt.includes('Salir')) return;
            e.preventDefault();
            if(e.currentTarget.closest('.sidebar-menu li')) { document.querySelectorAll('.sidebar-menu li').forEach(li => li.classList.remove('active')); e.currentTarget.closest('li').classList.add('active'); } 
            else { document.querySelectorAll('.sidebar-menu li').forEach(li => li.classList.remove('active')); if(txt === 'Ver todos') document.querySelector('a[href="#seccion-proveedores"]').closest('li').classList.add('active'); if(txt === 'Revisar inventario') document.querySelector('a[href="#seccion-productos"]').closest('li').classList.add('active'); }
            
            document.querySelectorAll('.crud-section, .tracking-section, .metrics-section, .charts-section').forEach(s => s.classList.add('seccion-oculta'));
            if (document.getElementById('global-search')) document.getElementById('global-search').value = '';
            for (const [k, v] of Object.entries(seccionesMap)) { if (txt.includes(k)) v.forEach(sel => document.querySelector(sel)?.classList.remove('seccion-oculta')); }
        });
    });

    document.getElementById('global-search')?.addEventListener('input', (e) => {
        const term = e.target.value.toLowerCase().trim();
        const activeSection = document.querySelector('section:not(.seccion-oculta)');
        if (!activeSection) return;
        activeSection.querySelectorAll('tbody tr').forEach(fila => { fila.style.display = fila.textContent.toLowerCase().includes(term) ? '' : 'none'; });
    });
});