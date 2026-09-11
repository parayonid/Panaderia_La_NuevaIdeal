import { initializeApp } from "https://www.gstatic.com/firebasejs/10.5.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.5.0/firebase-auth.js";
import { 
    getFirestore, collection, query, where, getDocs, 
    addDoc, updateDoc, deleteDoc, doc, onSnapshot 
} from "https://www.gstatic.com/firebasejs/10.5.0/firebase-firestore.js";

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
const productosRef = collection(db, "productos");
const usuariosRef = collection(db,"usuarios");

const API_URL = "http://127.0.0.1:8000";

document.addEventListener('DOMContentLoaded', () => {
    
    // Validación de seguridad por rol en frontend
    // Validación estricta y en tiempo real con Firebase
    
    
    // Validación estricta y segura con Firebase Auth
    const authInstance = getAuth();
    onAuthStateChanged(authInstance, async (user) => {
        if (!user) {
            window.location.href = "../index.html";
            return;
        }

        try {
            // Buscar en la colección "usuarios" el documento que coincida con el correo del usuario logueado
            const q = query(collection(db, "usuarios"), where("correo", "==", user.email));
            const querySnapshot = await getDocs(q);

            if (querySnapshot.empty) {
                alert("Acceso no autorizado: Usuario no registrado en la base de datos.");
                window.location.href = "../index.html";
                return;
            }

            let esAdmin = false;
            querySnapshot.forEach((docSnap) => {
                if (docSnap.data().rol === 'admin') {
                    esAdmin = true;
                }
            });

            if (!esAdmin) {
                alert("Acceso no autorizado. Tu cuenta no tiene permisos de administrador.");
                window.location.href = "../index.html";
            }
        } catch (error) {
            window.location.href = "../index.html";
        }
    });
    const trackingContainer = document.getElementById('tracking-container');
    const pedidos = JSON.parse(localStorage.getItem('pedidosHistorial')) || [];

    // ==========================================
    // 1. MÓDULO DE PRODUCTOS (FIREBASE)
    // ==========================================
    const stockBody = document.getElementById('stock-body');
    const modalProducto = document.getElementById('modal-producto');
    const btnAbrirModalProd = document.getElementById('btn-abrir-modal-producto');
    const formProducto = document.getElementById('form-nuevo-producto');
    const idInput = document.getElementById('producto-id');
    let productosLista = [];

    if (stockBody) {
        onSnapshot(productosRef, (snapshot) => {
            productosLista = [];
            stockBody.innerHTML = '';
            if (document.getElementById('metric-productos')) document.getElementById('metric-productos').textContent = snapshot.size;

            if (snapshot.empty) {
                stockBody.innerHTML = '<tr><td colspan="5" style="text-align:center;">No hay productos.</td></tr>';
                return;
            }
        
            snapshot.forEach((docSnap) => {
                const data = docSnap.data();
                const p = { id: docSnap.id, ...data };
                productosLista.push(p);
                const estado = p.cantidad > 50 ? 'Disponible' : p.cantidad > 0 ? 'Bajo Stock' : 'Agotado';
                const claseTag = p.cantidad > 50 ? 'status-entregado' : p.cantidad > 0 ? 'status-bajo' : 'status-agotado';
                const imgSrc = (p.imagen && p.imagen.startsWith('http')) ? p.imagen : '../' + (p.imagen || 'images/images/muffin.jpg');

                stockBody.innerHTML += `
                    <tr>
                        <td><img src="${imgSrc}" style="width: 45px; height: 45px; object-fit: cover; border-radius: 5px; border: 1px solid #ddd;"></td>
                        <td><strong>${p.nombre}</strong><br><small style="color:#888;">ID: ${p.id.slice(0, 5)}</small></td>
                        <td>${p.cantidad} pcs</td>
                        <td><span class="badge ${claseTag}">${estado}</span></td>
                        <td class="acciones-iconos">
                            <i class="bi bi-pencil-square icon-edit" data-id="${p.id}" title="Editar"></i>
                            <i class="bi bi-trash icon-delete" data-id="${p.id}" title="Eliminar"></i>
                        </td>
                    </tr>`;
            });
        });

        stockBody.addEventListener('click', async (e) => {
            if (e.target.classList.contains('icon-edit')) {
                const p = productosLista.find(x => x.id === e.target.dataset.id);
                if (p) {
                    modalProducto.style.display = 'flex';
                    document.getElementById('modal-titulo').textContent = 'Editar Producto';
                    idInput.value = p.id;
                    document.getElementById('precio-producto').value = p.precio || 10;
                    document.getElementById('categoria-producto').value = p.categoria || 'Panes';
                    document.getElementById('nombre-producto').value = p.nombre;
                    document.getElementById('cantidad-producto').value = p.cantidad;
                    document.getElementById('imagen-actual').value = p.imagen || '';
                    document.getElementById('imagen-archivo').value = '';
                }
            }
            if (e.target.classList.contains('icon-delete') && confirm("¿Eliminar este producto permanentemente?")) {
                await deleteDoc(doc(db, "productos", e.target.dataset.id));
            }
        });
    }

    if (btnAbrirModalProd) btnAbrirModalProd.addEventListener('click', () => {
        modalProducto.style.display = 'flex';
        document.getElementById('modal-titulo').textContent = 'Nuevo Producto';
        if(formProducto) formProducto.reset();
        idInput.value = '';
        document.getElementById('imagen-actual').value = '';
    });

    const cerrarModalProd = () => { if (modalProducto) modalProducto.style.display = 'none'; };
    document.getElementById('cerrar-modal-producto')?.addEventListener('click', cerrarModalProd);
    document.getElementById('btn-cancelar-producto')?.addEventListener('click', cerrarModalProd);

    if (formProducto) {
        formProducto.addEventListener('submit', async (e) => {
            e.preventDefault();
            const nombre = document.getElementById('nombre-producto').value.trim();
            const cantidad = parseInt(document.getElementById('cantidad-producto').value, 10);
            const categoria = document.getElementById('categoria-producto').value;
            const precio = parseFloat(document.getElementById('precio-producto').value);
            const docId = idInput.value;
            const imagenActual = document.getElementById('imagen-actual').value;
            const archivoImagen = document.getElementById('imagen-archivo').files[0];
            const btnGuardar = document.getElementById('btn-guardar-producto');

            if (!nombre || isNaN(cantidad) || isNaN(precio)) return;

            btnGuardar.textContent = "Guardando...";
            btnGuardar.disabled = true;

            try {
                let urlImagenFinal = imagenActual; 
                if (archivoImagen) {
                    const formData = new FormData();
                    formData.append("image", archivoImagen);
                    const respuesta = await fetch(`https://api.imgbb.com/1/upload?key=07cf6c87bdeebfc1e9e0e150e25a96ec`, { method: "POST", body: formData });
                    const datos = await respuesta.json();
                    if(datos.success) urlImagenFinal = datos.data.url; 
                }
                if (!urlImagenFinal) urlImagenFinal = "https://via.placeholder.com/150?text=Sin+Imagen";

                const datosProducto = { nombre, cantidad, categoria, precio, imagen: urlImagenFinal };

                if (docId) await updateDoc(doc(db, "productos", docId), datosProducto);
                else await addDoc(productosRef, datosProducto);
                
                cerrarModalProd();
            } catch (error) { alert("Error: " + error.message); } 
            finally { btnGuardar.textContent = "Guardar Producto"; btnGuardar.disabled = false; }
        });
    }

    // ==========================================
    // 2. MÓDULO CRM Y REPORTES (FASTAPI)
    // ==========================================
    const clientesBody = document.getElementById('clientes-body');
    const interaccionesBody = document.getElementById('interacciones-body');
    const selectClientes = document.getElementById('int-cliente-id');
    const secClientes = document.getElementById('seccion-clientes');
    const secDetalleCliente = document.getElementById('seccion-detalle-cliente');
    
    // Gráficas
    const ctxChart = document.getElementById('interaccionesChart');
    let interaccionesChart = null;
    if (ctxChart) {
        interaccionesChart = new Chart(ctxChart, {
            type: 'doughnut',
            data: {
                labels: ['Llamada', 'Correo', 'WhatsApp', 'Nota', 'Reunión'],
                datasets: [{
                    data: [0, 0, 0, 0, 0],
                    backgroundColor: ['#F35200', '#6c757d', '#25D366', '#4F231C', '#0d6efd'],
                    borderWidth: 0, hoverOffset: 4
                }]
            },
            options: { responsive: true, plugins: { legend: { position: 'bottom' } } }
        });
    }

    const ctxRepBar = document.getElementById('repBarChart');
    let repBarChart = null;
    if (ctxRepBar) {
        repBarChart = new Chart(ctxRepBar, {
            type: 'bar',
            data: {
                labels: ['Llamada', 'Correo', 'WhatsApp', 'Reunión', 'Nota'],
                datasets: [{ label: 'Cantidad', data: [0, 0, 0, 0, 0], backgroundColor: ['#F35200', '#6c757d', '#25D366', '#0d6efd', '#4F231C'] }]
            },
            options: { responsive: true, plugins: { legend: { display: false } } }
        });
    }

    const ctxRepPie = document.getElementById('repPieChart');
    let repPieChart = null;
    if (ctxRepPie) {
        repPieChart = new Chart(ctxRepPie, {
            type: 'doughnut',
            data: {
                labels: ['Prospecto', 'Activo', 'Inactivo'],
                datasets: [{ data: [0, 0, 0], backgroundColor: ['#0d6efd', '#16a085', '#e74c3c'], borderWidth: 0 }]
            },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'right' } } }
        });
    }

    async function recargarDatosCRM() {
        try {
            const resClientes = await fetch(`${API_URL}/clientes`);
            if(!resClientes.ok) return;
            const clientes = await resClientes.json();
            
            if (clientesBody) clientesBody.innerHTML = '';
            if (selectClientes) selectClientes.innerHTML = '<option value="">Selecciona un cliente...</option>';
            
            let totalClientes = 0, clientesActivos = 0, interaccionesMes = 0;
            let etapas = { Prospecto: 0, Activo: 0, Inactivo: 0 };
            let mapIntCliente = {}; 
            let todasLasInteracciones = [];
            const mesActual = new Date().getMonth();
            const anioActual = new Date().getFullYear();

           for (let cli of clientes) {
                totalClientes++;
                mapIntCliente[cli.id] = 0; 
                
                const estadoActual = (cli.estado || 'activo').toLowerCase();
                if (estadoActual.includes('prospecto')) etapas.Prospecto++;
                else if (estadoActual.includes('inactivo')) etapas.Inactivo++;
                else { etapas.Activo++; clientesActivos++; }

                // Definir color y texto dinámico del badge según el estado real del cliente
                let colorBadge = '#16a085'; // Verde para activo por defecto
                let textoEstado = cli.estado || 'Activo';
                if (estadoActual.includes('prospecto')) {
                    colorBadge = '#0d6efd'; // Azul para prospecto
                } else if (estadoActual.includes('inactivo')) {
                    colorBadge = '#e74c3c'; // Rojo para inactivo
                }

                // Quitamos el filtro restrictivo para que TODOS aparezcan en la tabla
                if (clientesBody) {
                    clientesBody.innerHTML += `
                        <tr>
                            <td><strong>${cli.nombre}</strong></td>
                            <td>${cli.empresa || 'N/A'}</td>
                            <td>${cli.correo}<br><small>${cli.telefono}</small></td>
                            <td><span class="badge" style="background:${colorBadge}; color:white;">${textoEstado}</span></td>
                            <td class="acciones-iconos">
                                <i class="bi bi-eye icon-ver-detalle" data-id="${cli.id}" title="Ver Detalles" style="color:#0d6efd; cursor:pointer; font-size: 1.1rem; margin-right:10px;"></i>
                                <i class="bi bi-trash icon-delete-cliente" data-id="${cli.id}" title="Dar de baja" style="color:#e74c3c; cursor:pointer; font-size: 1.1rem;"></i>
                            </td>
                        </tr>`;
                }
                if (selectClientes) selectClientes.innerHTML += `<option value="${cli.id}">${cli.nombre} (${cli.empresa || 'Sin empresa'})</option>`;

                try {
                    const resInt = await fetch(`${API_URL}/clientes/${cli.id}/interacciones`);
                    if(resInt.ok) {
                        const ints = await resInt.json();
                        mapIntCliente[cli.id] = ints.length;
                        ints.forEach(int => {
                            int.nombreCliente = cli.nombre;
                            if(int.fecha) {
                                const fechaInt = new Date(int.fecha);
                                if(fechaInt.getMonth() === mesActual && fechaInt.getFullYear() === anioActual) interaccionesMes++;
                            }
                        });
                        todasLasInteracciones.push(...ints);
                    }
                } catch(e) {}
            }
            

            let clientesSinInteraccion = Object.values(mapIntCliente).filter(v => v === 0).length;

            if (document.getElementById('metric-clientes')) document.getElementById('metric-clientes').textContent = clientesActivos;
            if (document.getElementById('rep-total-cli')) document.getElementById('rep-total-cli').textContent = totalClientes;
            if (document.getElementById('rep-activos-cli')) document.getElementById('rep-activos-cli').textContent = clientesActivos;
            if (document.getElementById('rep-activos-pct')) document.getElementById('rep-activos-pct').textContent = totalClientes > 0 ? Math.round((clientesActivos / totalClientes) * 100) + "% del total" : "0%";
            if (document.getElementById('rep-int-mes')) document.getElementById('rep-int-mes').textContent = interaccionesMes;
            if (document.getElementById('rep-sin-int')) document.getElementById('rep-sin-int').textContent = clientesSinInteraccion;
            if (document.getElementById('rep-sin-int-pct')) document.getElementById('rep-sin-int-pct').textContent = totalClientes > 0 ? Math.round((clientesSinInteraccion / totalClientes) * 100) + "% del total" : "0%";

            if (interaccionesBody) interaccionesBody.innerHTML = '';
            let cLlamada = 0, cCorreo = 0, cWhatsapp = 0, cNota = 0, cReunion = 0;

            if (todasLasInteracciones.length === 0 && interaccionesBody) {
                interaccionesBody.innerHTML = '<tr><td colspan="5" style="text-align:center;">No hay interacciones.</td></tr>';
            } else {
                todasLasInteracciones.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
                todasLasInteracciones.forEach(int => {
                    if(int.tipo === 'Llamada') cLlamada++;
                    else if(int.tipo === 'Correo') cCorreo++;
                    else if(int.tipo === 'WhatsApp') cWhatsapp++;
                    else if(int.tipo === 'Reunión') cReunion++;
                    else cNota++;

                    let icono = 'bi-journal-text';
                    if(int.tipo === 'Llamada') icono = 'bi-telephone';
                    if(int.tipo === 'Correo') icono = 'bi-envelope';
                    if(int.tipo === 'WhatsApp') icono = 'bi-whatsapp';
                    if(int.tipo === 'Reunión') icono = 'bi-people'; 

                    if (interaccionesBody) {
                        interaccionesBody.innerHTML += `
                            <tr>
                                <td>${int.fecha || 'Reciente'}</td>
                                <td><strong>${int.nombreCliente}</strong></td>
                                <td><i class="bi ${icono}" style="margin-right:5px; color:#555;"></i> ${int.tipo}</td>
                                <td><small>${int.descripcion}</small></td>
                                <td>${int.usuario_id}</td>
                            </tr>`;
                    }
                });
            }

            if (document.getElementById('metric-interacciones')) document.getElementById('metric-interacciones').textContent = todasLasInteracciones.length;

            if (interaccionesChart) { interaccionesChart.data.datasets[0].data = [cLlamada, cCorreo, cWhatsapp, cNota, cReunion]; interaccionesChart.update(); }
            if (repBarChart) { repBarChart.data.datasets[0].data = [cLlamada, cCorreo, cWhatsapp, cReunion, cNota]; repBarChart.update(); }
            if (repPieChart) { repPieChart.data.datasets[0].data = [etapas.Prospecto, etapas.Activo, etapas.Inactivo]; repPieChart.update(); }

        } catch (error) {}
    }

    recargarDatosCRM();

    if (clientesBody) {
        clientesBody.addEventListener('click', async (e) => {
            if (e.target.classList.contains('icon-delete-cliente') && confirm("¿Dar de baja a este cliente?")) {
                await fetch(`${API_URL}/clientes/${e.target.dataset.id}`, { 
                    method: 'DELETE',
                    headers: { 'x-admin-token': 'ideal_admin_token_2026' }
                });
                recargarDatosCRM();
            }
            if (e.target.classList.contains('icon-ver-detalle')) abrirDetalleCliente(e.target.dataset.id);
        });
    }

    async function abrirDetalleCliente(id) {
        if (!secClientes || !secDetalleCliente) return;
        secClientes.classList.add('seccion-oculta');
        secDetalleCliente.classList.remove('seccion-oculta');
        document.getElementById('detalle-nombre').textContent = "Cargando...";

        try {
            const resCli = await fetch(`${API_URL}/clientes/${id}`);
            const cliente = await resCli.json();

            document.getElementById('detalle-inicial').textContent = cliente.nombre.charAt(0).toUpperCase();
            document.getElementById('detalle-nombre').textContent = cliente.nombre;
            document.getElementById('detalle-correo').textContent = cliente.correo;
            document.getElementById('detalle-telefono').textContent = cliente.telefono;
            document.getElementById('detalle-registro').textContent = `ID: ${cliente.id}`;
            if(document.getElementById('detalle-etapa')) document.getElementById('detalle-etapa').value = cliente.estado;
            document.getElementById('form-detalle-interaccion').dataset.clienteId = id;

            const resInt = await fetch(`${API_URL}/clientes/${id}/interacciones`);
            const interacciones = await resInt.json();
            const timeline = document.getElementById('detalle-timeline');
            timeline.innerHTML = '';
            
            if (interacciones.length === 0) timeline.innerHTML = '<p style="text-align: center; color: #888;">No hay interacciones registradas.</p>';
            else {
                interacciones.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
                interacciones.forEach(int => {
                    let icono = 'bi-journal-text';
                    if(int.tipo === 'Llamada') icono = 'bi-telephone';
                    else if(int.tipo === 'Correo') icono = 'bi-envelope';
                    else if(int.tipo === 'WhatsApp') icono = 'bi-whatsapp';
                    else if(int.tipo === 'Reunión') icono = 'bi-people';

                    timeline.innerHTML += `
                        <div style="display: flex; gap: 15px; border-left: 2px solid #eee; padding-left: 15px; margin-bottom: 10px;">
                            <div style="margin-top: 2px; color: #16a085; font-size: 1.1rem;"><i class="${icono}"></i></div>
                            <div>
                                <div style="font-size: 0.8rem; color: #888; margin-bottom: 3px;">${int.fecha || 'Reciente'} - <strong>${int.tipo}</strong></div>
                                <div style="font-size: 0.9rem; color: #333;">${int.descripcion}</div>
                            </div>
                        </div>`;
                });
            }
        } catch (error) {}
    }

    document.getElementById('btn-volver-clientes')?.addEventListener('click', () => {
        secDetalleCliente.classList.add('seccion-oculta');
        secClientes.classList.remove('seccion-oculta');
        recargarDatosCRM(); 
    });

    document.getElementById('btn-detalle-correo')?.addEventListener('click', () => {
        const email = document.getElementById('detalle-correo').textContent;
        if (email && email !== "...") window.location.href = `mailto:${email}`;
    });

    document.getElementById('btn-detalle-editar')?.addEventListener('click', () => {
        document.getElementById('cliente-id').value = document.getElementById('form-detalle-interaccion').dataset.clienteId;
        document.getElementById('cli-nombre').value = document.getElementById('detalle-nombre').textContent;
        document.getElementById('cli-correo').value = document.getElementById('detalle-correo').textContent;
        document.getElementById('cli-telefono').value = document.getElementById('detalle-telefono').textContent;
        document.getElementById('cli-empresa').value = ""; 
        document.querySelector('#modal-cliente h3').textContent = "Editar Cliente";
        document.getElementById('modal-cliente').style.display = 'flex';
    });

    document.getElementById('btn-detalle-actualizar-etapa')?.addEventListener('click', async () => {
        const btnActEtapa = document.getElementById('btn-detalle-actualizar-etapa');
        const clienteId = document.getElementById('form-detalle-interaccion').dataset.clienteId;
        const nuevaEtapa = document.getElementById('detalle-etapa').value;
        if (!clienteId) return;
        
        btnActEtapa.textContent = "...";
        try {
            await fetch(`${API_URL}/clientes/${clienteId}`, {
                method: 'PUT', 
                headers: { 
                    'Content-Type': 'application/json',
                    'x-admin-token': 'ideal_admin_token_2026'
                },
                body: JSON.stringify({ 
                    nombre: document.getElementById('detalle-nombre').textContent,
                    correo: document.getElementById('detalle-correo').textContent,
                    telefono: document.getElementById('detalle-telefono').textContent,
                    empresa: "Desconocida", estado: nuevaEtapa 
                })
            });
            alert(`Etapa actualizada a: ${nuevaEtapa}`);
            recargarDatosCRM();
        } catch (error) { alert("Error al actualizar etapa."); } 
        finally { btnActEtapa.textContent = "Actualizar Etapa"; }
    });

    const formDetalleInt = document.getElementById('form-detalle-interaccion');
    if (formDetalleInt) {
        formDetalleInt.addEventListener('submit', async (e) => {
            e.preventDefault();
            const clienteId = formDetalleInt.dataset.clienteId;
            if (!clienteId) return;
            const btnSub = formDetalleInt.querySelector('button');
            btnSub.textContent = "..."; btnSub.disabled = true;

            try {
                await fetch(`${API_URL}/interacciones`, {
                    method: 'POST', 
                    headers: { 
                        'Content-Type': 'application/json', 
                        'x-admin-token': 'ideal_admin_token_2026' 
                    },
                    body: JSON.stringify({
                        cliente_id: clienteId,
                        tipo: document.getElementById('detalle-int-tipo').value,
                        descripcion: document.getElementById('detalle-int-desc').value,
                        usuario_id: "Admin" 
                    })
                });
                formDetalleInt.reset();
                abrirDetalleCliente(clienteId); 
            } catch (error) { } 
            finally { btnSub.textContent = "Registrar"; btnSub.disabled = false; }
        });
    }

    // Modal Cliente Global
    const modalCliente = document.getElementById('modal-cliente');
    const formCliente = document.getElementById('form-nuevo-cliente');
    document.getElementById('btn-abrir-modal-cliente')?.addEventListener('click', () => {
        document.getElementById('cliente-id').value = ''; 
        document.querySelector('#modal-cliente h3').textContent = "Registrar Nuevo Cliente";
        if(formCliente) formCliente.reset();
        if(modalCliente) modalCliente.style.display = 'flex';
    });
    document.getElementById('cerrar-modal-cliente')?.addEventListener('click', () => modalCliente.style.display = 'none');
    document.getElementById('btn-cancelar-cliente')?.addEventListener('click', () => modalCliente.style.display = 'none');

    if (formCliente) {
        formCliente.addEventListener('submit', async (e) => {
            e.preventDefault();
            const idCliente = document.getElementById('cliente-id').value; 
            const datosCliente = {
                nombre: document.getElementById('cli-nombre').value,
                correo: document.getElementById('cli-correo').value,
                telefono: document.getElementById('cli-telefono').value,
                empresa: document.getElementById('cli-empresa').value,
                estado: idCliente ? (document.getElementById('detalle-etapa') ? document.getElementById('detalle-etapa').value : "activo") : "activo"
            };

            const btnSub = formCliente.querySelector('.btn-guardar');
            btnSub.textContent = "Guardando..."; btnSub.disabled = true;

            try {
                if (idCliente) {
                    await fetch(`${API_URL}/clientes/${idCliente}`, { 
                        method: 'PUT', 
                        headers: { 
                            'Content-Type': 'application/json',
                            'x-admin-token': 'ideal_admin_token_2026'
                        }, 
                        body: JSON.stringify(datosCliente) 
                    });
                    abrirDetalleCliente(idCliente); 
                } else {
                    await fetch(`${API_URL}/clientes`, { 
                        method: 'POST', 
                        headers: { 
                            'Content-Type': 'application/json',
                            'x-admin-token': 'ideal_admin_token_2026'
                        }, 
                        body: JSON.stringify(datosCliente) 
                    });
                }
                modalCliente.style.display = 'none';
                formCliente.reset();
                recargarDatosCRM(); 
            } catch (error) { alert("Error al guardar."); } 
            finally { btnSub.textContent = "Guardar"; btnSub.disabled = false; }
        });
    }

    // Modal Interaccion Global
    const modalInteraccion = document.getElementById('modal-interaccion');
    const formInteraccion = document.getElementById('form-nueva-interaccion');
    document.getElementById('btn-abrir-modal-interaccion')?.addEventListener('click', () => {
        if(modalInteraccion) modalInteraccion.style.display = 'flex';
        if(formInteraccion) formInteraccion.reset();
    });
    document.getElementById('cerrar-modal-interaccion')?.addEventListener('click', () => modalInteraccion.style.display = 'none');
    document.getElementById('btn-cancelar-interaccion')?.addEventListener('click', () => modalInteraccion.style.display = 'none');

    if (formInteraccion) {
        formInteraccion.addEventListener('submit', async (e) => {
            e.preventDefault();
            const clienteSeleccionado = document.getElementById('int-cliente-id').value;
            if (!clienteSeleccionado) return alert("Selecciona un cliente.");
            
            const btnSub = formInteraccion.querySelector('.btn-guardar');
            btnSub.textContent = "Guardando..."; btnSub.disabled = true;
            try {
                await fetch(`${API_URL}/interacciones`, {
                    method: 'POST', 
                    headers: { 
                        'Content-Type': 'application/json',
                        'x-admin-token': 'ideal_admin_token_2026'
                    },
                    body: JSON.stringify({
                        cliente_id: clienteSeleccionado,
                        tipo: document.getElementById('int-tipo').value,
                        descripcion: document.getElementById('int-desc').value,
                        usuario_id: "Admin" 
                    })
                });
                modalInteraccion.style.display = 'none';
                formInteraccion.reset();
                recargarDatosCRM(); 
            } catch (error) { alert("Error conexión FastAPI."); } 
            finally { btnSub.textContent = "Guardar Interacción"; btnSub.disabled = false; }
        });
    }

    // ==========================================
    // 3. MÓDULO DE USUARIOS (STAFF) FIREBASE
    // ==========================================
    const usuariosBody = document.getElementById('usuarios-body');
    const modalUsuario = document.getElementById('modal-usuario');
    const formUsuario = document.getElementById('form-editar-usuario');

    if (usuariosBody) {
        onSnapshot(usuariosRef, (snapshot) => {
            usuariosBody.innerHTML = '';
            if (document.getElementById('metric-usuarios')) document.getElementById('metric-usuarios').textContent = snapshot.size;

            if (snapshot.empty) {
                usuariosBody.innerHTML = '<tr><td colspan="5" style="text-align:center;">No hay usuarios.</td></tr>'; return;
            }

            snapshot.forEach(docSnap => {
                const u = { id: docSnap.id, ...docSnap.data() };
                const rolBadge = u.rol === 'admin' ? '<span class="badge" style="background:#4F231C; color:white;">Admin</span>' : '<span class="badge" style="background:#6c757d; color:white;">Cliente</span>';
                let fechaRegistro = u.fechaRegistro && u.fechaRegistro.toDate ? u.fechaRegistro.toDate().toLocaleDateString('es-MX') : 'Reciente';

                usuariosBody.innerHTML += `
                    <tr>
                        <td><strong>${u.nombre || 'Sin nombre'}</strong><br><small style="color:#888;">${u.correo}</small></td>
                        <td>${rolBadge}</td>
                        <td>${u.telefono || 'N/A'}</td>
                        <td>${fechaRegistro}</td>
                        <td class="acciones-iconos"><i class="bi bi-pencil-square icon-edit-user" data-id="${u.id}" data-correo="${u.correo}" data-rol="${u.rol || 'cliente'}" data-nombre="${encodeURIComponent(u.nombre || '')}" data-telefono="${u.telefono || ''}" title="Editar" style="cursor: pointer; color: #16a085; font-size: 1.1rem;"></i></td>
                    </tr>`;
            });
        });

        usuariosBody.addEventListener('click', (e) => {
            if (e.target.classList.contains('icon-edit-user')) {
                document.getElementById('usuario-id').value = e.target.dataset.id;
                document.getElementById('usuario-correo').value = e.target.dataset.correo;
                document.getElementById('usuario-rol').value = e.target.dataset.rol;
                document.getElementById('usuario-nombre').value = decodeURIComponent(e.target.dataset.nombre);
                document.getElementById('usuario-telefono').value = e.target.dataset.telefono;
                if(modalUsuario) modalUsuario.style.display = 'flex';
            }
        });
    }

    const cerrarModalUsu = () => { if(modalUsuario) modalUsuario.style.display = 'none'; };
    document.getElementById('cerrar-modal-usuario')?.addEventListener('click', cerrarModalUsu);
    document.getElementById('btn-cancelar-usuario')?.addEventListener('click', cerrarModalUsu);

    if (formUsuario) {
        formUsuario.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btnSubUsu = formUsuario.querySelector('.btn-guardar');
            btnSubUsu.textContent = "Guardando..."; btnSubUsu.disabled = true;

            try {
                await updateDoc(doc(db, "usuarios", document.getElementById('usuario-id').value), { 
                    rol: document.getElementById('usuario-rol').value,
                    nombre: document.getElementById('usuario-nombre').value.trim(),
                    telefono: document.getElementById('usuario-telefono').value.trim()
                });
                cerrarModalUsu();
            } catch (error) { alert("Error al actualizar usuario."); } 
            finally { btnSubUsu.textContent = "Guardar Cambios"; btnSubUsu.disabled = false; }
        });
    }

    // ==========================================
    // 4. SEGUIMIENTO DE PEDIDOS
    // ==========================================
    const renderizarSeguimientoActivo = () => {
        const trackingContainer = document.getElementById('tracking-container');
        if (!trackingContainer) return;
        trackingContainer.innerHTML = '';
        if (document.getElementById('metric-pedidos')) document.getElementById('metric-pedidos').textContent = pedidos.length;

        const pedidosRecientes = pedidos.sort((a, b) => b.id - a.id).slice(0, 3); 
        if (pedidosRecientes.length === 0) { trackingContainer.innerHTML = '<p style="color: #666; padding: 20px;">No hay pedidos activos.</p>'; return; }

        pedidosRecientes.forEach(pedido => {
            const index = pedido.id % 3;
            const platforms = ['Uber Eats', 'DiDi Food', 'Pendiente'];
            const platformClasses = ['platform-uber', 'platform-didi', 'platform-pending'];
            const estadoSimulado = index === 0 ? 'En Reparto' : (index === 1 ? 'Preparando' : 'Nuevo');
            const card = document.createElement('div');
            card.className = 'tracking-card';
            card.innerHTML = `<div class="tracking-header"><h4>Pedido #${pedido.id} (${estadoSimulado})</h4><span class="platform-tag ${platformClasses[index]}">${platforms[index]}</span></div>`;
            trackingContainer.appendChild(card);
        });
    };
    renderizarSeguimientoActivo();

    // ==========================================
    // 5. NAVEGACIÓN DEL MENÚ (CORREGIDA Y ROBUSTA)
    // ==========================================
    const menuLinks = document.querySelectorAll('.sidebar-menu li a');
    const menuItems = document.querySelectorAll('.sidebar-menu li'); 
    
    const seccionesMap = {
        'Dashboard': ['.metrics-section', '#seccion-graficas'],
        'Reportes': ['#seccion-reportes'],
        'Clientes': ['#seccion-clientes'],
        'Interacciones': ['#seccion-interacciones'],
        'Usuarios': ['#seccion-usuarios'],
        'Staff': ['#seccion-usuarios'],
        'Productos': ['#seccion-productos'],
        'Catálogo': ['#seccion-productos'],
        'Pedidos': ['#seccion-pedidos']
    };

    const ocultarTodasLasSecciones = () => {
        document.querySelector('.metrics-section')?.classList.add('seccion-oculta');
        document.getElementById('seccion-graficas')?.classList.add('seccion-oculta');
        document.querySelectorAll('.crud-section, .tracking-section').forEach(sec => sec.classList.add('seccion-oculta'));
    };

    ocultarTodasLasSecciones();
    document.querySelector('.metrics-section')?.classList.remove('seccion-oculta');
    document.getElementById('seccion-graficas')?.classList.remove('seccion-oculta');

    menuLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            const anchor = e.currentTarget; 
            const textoEnlace = anchor.textContent.trim();
            if (textoEnlace.includes('Volver')) return; 
            e.preventDefault();

            menuItems.forEach(li => li.classList.remove('active'));
            anchor.closest('li').classList.add('active');

            ocultarTodasLasSecciones();
            
            if (searchInput) { 
                searchInput.value = ''; 
                searchInput.dispatchEvent(new Event('input')); 
            }

            for (const [key, selectors] of Object.entries(seccionesMap)) {
                if (textoEnlace.includes(key)) {
                    selectors.forEach(sel => {
                        const el = document.querySelector(sel);
                        if (el) el.classList.remove('seccion-oculta');
                    });
                    break;
                }
            }
        });
    });

    // ==========================================
    // BUSCADOR UNIVERSAL INTELIGENTE (POR SECCIÓN)
    // ==========================================
    const searchInput = document.getElementById('global-search');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            const term = e.target.value.toLowerCase().trim();
            
            const activeSection = document.querySelector('.crud-section:not(.seccion-oculta), .tracking-section:not(.seccion-oculta), .metrics-section:not(.seccion-oculta), .charts-section:not(.seccion-oculta)');
            if (!activeSection) return;

            const filas = activeSection.querySelectorAll('tbody tr');
            filas.forEach(fila => {
                const textoFila = fila.textContent.toLowerCase();
                fila.style.display = textoFila.includes(term) ? '' : 'none';
            });

            const tarjetas = activeSection.querySelectorAll('.tracking-card, .detalle-card, .card-metric, .chart-card');
            tarjetas.forEach(tarjeta => {
                const textoTarjeta = tarjeta.textContent.toLowerCase();
                tarjeta.style.display = textoTarjeta.includes(term) ? '' : 'none';
            });
        });
    }
});