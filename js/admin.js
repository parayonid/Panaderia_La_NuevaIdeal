import { initializeApp } from "https://www.gstatic.com/firebasejs/10.5.0/firebase-app.js";
import { 
    getFirestore, collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot 
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
const interaccionesRef = collection(db, "interacciones");
const usuariosRef = collection(db,"usuarios");

document.addEventListener('DOMContentLoaded', () => {
    
    const trackingContainer = document.getElementById('tracking-container');
    const pedidos = JSON.parse(localStorage.getItem('pedidosHistorial')) || [];

    // ==========================================
    // 1. MÓDULO DE PRODUCTOS CON IMGBB
    // ==========================================
    const stockBody = document.getElementById('stock-body');
    const modalProducto = document.getElementById('modal-producto');
    const btnAbrirModalProd = document.getElementById('btn-abrir-modal-producto');
    const btnCerrarModalProd = document.getElementById('cerrar-modal-producto');
    const btnCancelarModalProd = document.getElementById('btn-cancelar-producto');
    const formProducto = document.getElementById('form-nuevo-producto');
    const idInput = document.getElementById('producto-id');
    const modalTitulo = document.getElementById('modal-titulo');

    let productosLista = [];

    if (stockBody) {
        onSnapshot(productosRef, (snapshot) => {
            productosLista = [];
            stockBody.innerHTML = '';

            const metricProd = document.getElementById('metric-productos');
            if (metricProd) metricProd.textContent = snapshot.size;

            if (snapshot.empty) {
                stockBody.innerHTML = '<tr><td colspan="5" style="text-align:center;">No hay productos en Firebase.</td></tr>';
                return;
            }
        
            snapshot.forEach((docSnap) => {
                const data = docSnap.data();
                const producto = { id: docSnap.id, ...data };
                productosLista.push(producto);
                const estado = producto.cantidad > 50 ? 'Disponible' : producto.cantidad > 0 ? 'Bajo Stock' : 'Agotado';
                const claseTag = producto.cantidad > 50 ? 'status-entregado' : producto.cantidad > 0 ? 'status-bajo' : 'status-agotado';
                
                const imgSrc = (producto.imagen && producto.imagen.startsWith('http')) 
                             ? producto.imagen 
                             : '../' + (producto.imagen || 'images/images/muffin.jpg');

                stockBody.innerHTML += `
                    <tr>
                        <td><img src="${imgSrc}" alt="img" style="width: 45px; height: 45px; object-fit: cover; border-radius: 5px; border: 1px solid #ddd;"></td>
                        <td><strong>${producto.nombre}</strong><br><small style="color:#888;">ID: ${producto.id.slice(0, 5)}</small></td>
                        <td>${producto.cantidad} pcs</td>
                        <td><span class="badge ${claseTag}">${estado}</span></td>
                        <td class="acciones-iconos">
                            <i class="bi bi-pencil-square icon-edit" data-id="${producto.id}" title="Editar"></i>
                            <i class="bi bi-trash icon-delete" data-id="${producto.id}" title="Eliminar"></i>
                        </td>
                    </tr>`;
            });
        });

        stockBody.addEventListener('click', async (e) => {
            const target = e.target;
            if (target.classList.contains('icon-edit')) {
                const id = target.dataset.id;
                const p = productosLista.find(x => x.id === id);
                if (p) {
                    modalProducto.style.display = 'flex';
                    modalTitulo.textContent = 'Editar Producto';
                    idInput.value = p.id;
                    document.getElementById('precio-producto').value = p.precio || 10;
                    document.getElementById('categoria-producto').value = p.categoria || 'Panes';
                    document.getElementById('nombre-producto').value = p.nombre;
                    document.getElementById('cantidad-producto').value = p.cantidad;
                    document.getElementById('imagen-actual').value = p.imagen || '';
                    document.getElementById('imagen-archivo').value = '';
                }
            }
            if (target.classList.contains('icon-delete') && confirm("¿Eliminar este producto permanentemente de Firebase?")) {
                await deleteDoc(doc(db, "productos", target.dataset.id));
            }
        });
    }

    if (btnAbrirModalProd) btnAbrirModalProd.addEventListener('click', () => {
        modalProducto.style.display = 'flex';
        modalTitulo.textContent = 'Nuevo Producto';
        if(formProducto) formProducto.reset();
        idInput.value = '';
        document.getElementById('imagen-actual').value = '';
    });

    const cerrarModalProd = () => { if (modalProducto) modalProducto.style.display = 'none'; };
    if (btnCerrarModalProd) btnCerrarModalProd.addEventListener('click', cerrarModalProd);
    if (btnCancelarModalProd) btnCancelarModalProd.addEventListener('click', cerrarModalProd);

    // LÓGICA DE GUARDAR Y SUBIR A IMGBB
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

            btnGuardar.textContent = "Subiendo imagen a la nube...";
            btnGuardar.disabled = true;

            try {
                let urlImagenFinal = imagenActual; 
                if (archivoImagen) {
                    const formData = new FormData();
                    formData.append("image", archivoImagen);
                    
                    const IMGBB_API_KEY = "07cf6c87bdeebfc1e9e0e150e25a96ec"; 
                    const respuesta = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, {
                        method: "POST", body: formData
                    });
                    const datos = await respuesta.json();
                    if(datos.success) urlImagenFinal = datos.data.url; 
                }

                if (!urlImagenFinal) urlImagenFinal = "https://via.placeholder.com/150?text=Sin+Imagen";

                btnGuardar.textContent = "Guardando en Firebase...";
                const datosProducto = { nombre, cantidad, categoria, precio, imagen: urlImagenFinal };

                if (docId) {
                    await updateDoc(doc(db, "productos", docId), datosProducto);
                } else {
                    await addDoc(productosRef, datosProducto);
                }
                
                cerrarModalProd();
            } catch (error) { 
                console.error("Error:", error);
                alert("Error: " + error.message); 
            } finally {
                btnGuardar.textContent = "Guardar Producto";
                btnGuardar.disabled = false;
            }
        });
    }

   // ==========================================
    // 2. MÓDULO DE INTERACCIONES Y GRÁFICA
    // ==========================================
    const interaccionesBody = document.getElementById('interacciones-body');
    const modalInteraccion = document.getElementById('modal-interaccion');
    const btnAbrirModalInt = document.getElementById('btn-abrir-modal-interaccion');
    const btnCerrarModalInt = document.getElementById('cerrar-modal-interaccion');
    const btnCancelarModalInt = document.getElementById('btn-cancelar-interaccion');
    const formInteraccion = document.getElementById('form-nueva-interaccion');
    
    // Configuración inicial de la gráfica (Dona)
    const ctxChart = document.getElementById('interaccionesChart');
    let interaccionesChart = null;
    
    if (ctxChart) {
        interaccionesChart = new Chart(ctxChart, {
            type: 'doughnut',
            data: {
                labels: ['Llamada', 'Correo', 'WhatsApp', 'Reunión'],
                datasets: [{
                    data: [0, 0, 0, 0],
                    backgroundColor: ['#F35200', '#6c757d', '#25D366', '#4F231C'], // Colores personalizados
                    borderWidth: 0,
                    hoverOffset: 4
                }]
            },
            options: {
                responsive: true,
                plugins: { legend: { position: 'bottom' } }
            }
        });
    }

    if (interaccionesBody) {
        onSnapshot(interaccionesRef, (snapshot) => {
            interaccionesBody.innerHTML = '';
            
            // Variables para alimentar la gráfica
            let cLlamada = 0, cCorreo = 0, cWhatsapp = 0, cReunion = 0;

            if (snapshot.empty) {
                interaccionesBody.innerHTML = '<tr><td colspan="5" style="text-align:center;">No hay interacciones.</td></tr>';
                if (interaccionesChart) {
                    interaccionesChart.data.datasets[0].data = [0, 0, 0, 0];
                    interaccionesChart.update();
                }
                return;
            }
            
            const interacciones = [];
            snapshot.forEach(docSnap => {
                const intData = docSnap.data();
                interacciones.push({ id: docSnap.id, ...intData });
                
                // Contar para la gráfica
                if(intData.tipo === 'Llamada') cLlamada++;
                if(intData.tipo === 'Correo') cCorreo++;
                if(intData.tipo === 'WhatsApp') cWhatsapp++;
                if(intData.tipo === 'Reunión') cReunion++;
            });
            
            interacciones.sort((a, b) => b.timestamp - a.timestamp);

            // Actualizar la gráfica en tiempo real
            if (interaccionesChart) {
                interaccionesChart.data.datasets[0].data = [cLlamada, cCorreo, cWhatsapp, cReunion];
                interaccionesChart.update();
            }

            interacciones.forEach((int) => {
                let icono = 'bi-telephone';
                if(int.tipo === 'Correo') icono = 'bi-envelope';
                if(int.tipo === 'Reunión') icono = 'bi-people';
                if(int.tipo === 'WhatsApp') icono = 'bi-whatsapp';

                interaccionesBody.innerHTML += `
                    <tr>
                        <td>${int.fechaStr}</td>
                        <td><strong>${int.cliente}</strong></td>
                        <td><i class="bi ${icono}" style="margin-right:5px; color:#555;"></i> ${int.tipo}</td>
                        <td><small>${int.descripcion}</small></td>
                        <td>${int.responsable}</td>
                    </tr>`;
            });
        });
    }

    const abrirModalInt = () => { if(modalInteraccion) { modalInteraccion.style.display = 'flex'; formInteraccion.reset(); }};
    const cerrarModalInt = () => { if(modalInteraccion) modalInteraccion.style.display = 'none'; };
    if(btnAbrirModalInt) btnAbrirModalInt.addEventListener('click', abrirModalInt);
    if(btnCerrarModalInt) btnCerrarModalInt.addEventListener('click', cerrarModalInt);
    if(btnCancelarModalInt) btnCancelarModalInt.addEventListener('click', cerrarModalInt);

    if (formInteraccion) {
        formInteraccion.addEventListener('submit', async (e) => {
            e.preventDefault();
            const cliente = document.getElementById('int-cliente').value.trim();
            const tipo = document.getElementById('int-tipo').value;
            const descripcion = document.getElementById('int-desc').value.trim();
            const responsable = document.getElementById('int-resp').value.trim();
            const ahora = new Date();
            const fechaStr = ahora.toLocaleString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute:'2-digit' });

            try {
                await addDoc(interaccionesRef, { cliente, tipo, descripcion, responsable, fechaStr, timestamp: ahora.getTime() });
                cerrarModalInt();
            } catch (error) { alert("Error al registrar interacción."); }
        });
    }

    // ==========================================
    // 3. MÓDULO DE USUARIOS
    // ==========================================
    const usuariosBody = document.getElementById('usuarios-body');
    const modalUsuario = document.getElementById('modal-usuario');
    const formUsuario = document.getElementById('form-editar-usuario');
    const btnCerrarModalUsu = document.getElementById('cerrar-modal-usuario');
    const btnCancelarModalUsu = document.getElementById('btn-cancelar-usuario');

    if (usuariosBody) {
        onSnapshot(usuariosRef, (snapshot) => {
            usuariosBody.innerHTML = '';
            
            const metricUsu = document.getElementById('metric-usuarios');
            if (metricUsu) metricUsu.textContent = snapshot.size;

            if (snapshot.empty) {
                usuariosBody.innerHTML = '<tr><td colspan="5" style="text-align:center;">No hay usuarios registrados.</td></tr>';
                return;
            }

            snapshot.forEach(docSnap => {
                const u = { id: docSnap.id, ...docSnap.data() };
                const rolBadge = u.rol === 'admin' 
                    ? '<span class="badge" style="background:#4F231C; color:white;">Admin</span>' 
                    : '<span class="badge" style="background:#6c757d; color:white;">Cliente</span>';
                
                let fechaRegistro = 'Reciente';
                if (u.fechaRegistro && u.fechaRegistro.toDate) {
                    fechaRegistro = u.fechaRegistro.toDate().toLocaleDateString('es-MX');
                }

                usuariosBody.innerHTML += `
                    <tr>
                        <td><strong>${u.nombre || 'Sin nombre'}</strong><br><small style="color:#888;">${u.correo}</small></td>
                        <td>${rolBadge}</td>
                        <td>${u.telefono || 'N/A'}</td>
                        <td>${fechaRegistro}</td>
                        <td class="acciones-iconos">
                            <i class="bi bi-pencil-square icon-edit-user" data-id="${u.id}" data-correo="${u.correo}" data-rol="${u.rol || 'cliente'}" title="Cambiar Rol"></i>
                        </td>
                    </tr>
                `;
            });
        });

        usuariosBody.addEventListener('click', (e) => {
            if (e.target.classList.contains('icon-edit-user')) {
                document.getElementById('usuario-id').value = e.target.dataset.id;
                document.getElementById('usuario-correo').value = e.target.dataset.correo;
                document.getElementById('usuario-rol').value = e.target.dataset.rol;
                modalUsuario.style.display = 'flex';
            }
        });
    }

    const cerrarModalUsu = () => { if(modalUsuario) modalUsuario.style.display = 'none'; };
    if(btnCerrarModalUsu) btnCerrarModalUsu.addEventListener('click', cerrarModalUsu);
    if(btnCancelarModalUsu) btnCancelarModalUsu.addEventListener('click', cerrarModalUsu);

    if (formUsuario) {
        formUsuario.addEventListener('submit', async (e) => {
            e.preventDefault();
            const id = document.getElementById('usuario-id').value;
            const nuevoRol = document.getElementById('usuario-rol').value;

            try {
                await updateDoc(doc(db, "usuarios", id), { rol: nuevoRol });
                cerrarModalUsu();
            } catch (error) {
                alert("Error al actualizar el usuario.");
            }
        });
    }

    // ==========================================
    // 4. SEGUIMIENTO DE PEDIDOS
    // ==========================================
    const renderizarSeguimientoActivo = () => {
        if (!trackingContainer) return;
        trackingContainer.innerHTML = '';
        
        const metricPed = document.getElementById('metric-pedidos');
        if (metricPed) metricPed.textContent = pedidos.length;

        const pedidosRecientes = pedidos.sort((a, b) => b.id - a.id).slice(0, 3); 
        
        if (pedidosRecientes.length === 0) {
            trackingContainer.innerHTML = '<p style="color: #666; padding: 20px;">No hay pedidos activos.</p>';
            return;
        }

        pedidosRecientes.forEach(pedido => {
            const index = pedido.id % 3;
            const platforms = ['Uber Eats', 'DiDi Food', 'Pendiente'];
            const platformClasses = ['platform-uber', 'platform-didi', 'platform-pending'];
            const drivers = ['Juan Pérez', 'Ana Gómez', 'Luis Castro'];
            const vehicles = ['Moto Italika', 'Auto Versa', 'Moto Honda'];
            const estadoSimulado = index === 0 ? 'En Reparto' : (index === 1 ? 'Preparando' : 'Nuevo');
            
            const card = document.createElement('div');
            card.className = 'tracking-card';
            let detailsHTML = estadoSimulado !== 'Nuevo' 
                ? `<li><strong>Transportista:</strong> ${drivers[index]}</li><li><strong>Vehículo:</strong> ${vehicles[index]}</li>`
                : `<li>Asignando repartidor...</li>`;

            card.innerHTML = `
                <div class="tracking-header">
                    <h4>Pedido #${pedido.id} (${estadoSimulado})</h4>
                    <span class="platform-tag ${platformClasses[index]}">${platforms[index]}</span>
                </div>
                <ul class="tracking-details">${detailsHTML}</ul>
            `;
            trackingContainer.appendChild(card);
        });
    };
    renderizarSeguimientoActivo();

    // ==========================================
    // 5. NAVEGACIÓN DEL MENÚ LATERAL Y BUSCADOR (UNIFICADO)
    // ==========================================
   // ==========================================
    // 5. NAVEGACIÓN DEL MENÚ LATERAL Y BUSCADOR (UNIFICADO)
    // ==========================================
    const menuLinks = document.querySelectorAll('.sidebar-menu li a');
    const menuItems = document.querySelectorAll('.sidebar-menu li'); 
    const secMetricas = document.querySelector('.metrics-section');
    const secGraficas = document.getElementById('seccion-graficas'); // <-- Enlazamos la gráfica
    const secProductos = document.getElementById('seccion-productos');
    const secPedidos = document.getElementById('seccion-pedidos');
    const secInteracciones = document.getElementById('seccion-interacciones');
    const secUsuarios = document.getElementById('seccion-usuarios');
    const searchInput = document.getElementById('global-search');

    const ocultarTodas = () => {
        if (secMetricas) secMetricas.classList.add('seccion-oculta');
        if (secGraficas) secGraficas.classList.add('seccion-oculta'); // <-- La apagamos
        if (secProductos) secProductos.classList.add('seccion-oculta');
        if (secPedidos) secPedidos.classList.add('seccion-oculta');
        if (secInteracciones) secInteracciones.classList.add('seccion-oculta');
        if (secUsuarios) secUsuarios.classList.add('seccion-oculta');
    };

    ocultarTodas();
    if (secMetricas) secMetricas.classList.remove('seccion-oculta');
    if (secGraficas) secGraficas.classList.remove('seccion-oculta'); // La mostramos al inicio

    menuLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            const anchor = e.currentTarget; 
            const textoEnlace = anchor.textContent.trim();
            
            if (textoEnlace.includes('Volver')) return; 
            e.preventDefault();

            menuItems.forEach(li => li.classList.remove('active'));
            anchor.closest('li').classList.add('active');

            ocultarTodas();

            if (searchInput) {
                searchInput.value = '';
                searchInput.dispatchEvent(new Event('input')); 
            }

            if (textoEnlace.includes('Dashboard')) {
                if (secMetricas) secMetricas.classList.remove('seccion-oculta');
                if (secGraficas) secGraficas.classList.remove('seccion-oculta'); // Se enciende SOLO aquí
            } 
            else if (textoEnlace.includes('Productos')) {
                if (secProductos) secProductos.classList.remove('seccion-oculta');
            } 
            else if (textoEnlace.includes('Pedidos')) {
                if (secPedidos) secPedidos.classList.remove('seccion-oculta');
            } 
            else if (textoEnlace.includes('Interacciones')) {
                if (secInteracciones) secInteracciones.classList.remove('seccion-oculta');
            }
            else if (textoEnlace.includes('Usuarios')) {
                if (secUsuarios) secUsuarios.classList.remove('seccion-oculta');
            }
        });
    });

    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            const term = e.target.value.toLowerCase();
            const activeSection = document.querySelector('.crud-section:not(.seccion-oculta), .tracking-section:not(.seccion-oculta)');
            if (!activeSection) return;

            const filas = activeSection.querySelectorAll('tbody tr');
            filas.forEach(fila => {
                const textoFila = fila.textContent.toLowerCase();
                fila.style.display = textoFila.includes(term) ? '' : 'none';
            });

            const tarjetas = activeSection.querySelectorAll('.tracking-card');
            tarjetas.forEach(tarjeta => {
                const textoTarjeta = tarjeta.textContent.toLowerCase();
                tarjeta.style.display = textoTarjeta.includes(term) ? '' : 'none';
            });
        });
    }
});