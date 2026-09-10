// user.js (Versión Definitiva con Seguimiento)

document.addEventListener('DOMContentLoaded', () => {
    const historialBody = document.getElementById('historial-body');
    const pedidos = JSON.parse(localStorage.getItem('pedidosHistorial')) || [];

    // Modal de Detalles (Tu código original)
    const modal = document.getElementById('detalle-modal');
    const closeModalButton = modal.querySelector('.close-button'); // MODIFICADO: Más específico
    const detalleTablaBody = document.querySelector('#detalle-pedido-tabla tbody');

    // --- NUEVO: Elementos del Modal de Seguimiento ---
    const seguimientoModal = document.getElementById('seguimiento-modal');
    const closeSeguimientoButton = seguimientoModal.querySelector('.close-button');
    const seguimientoTitulo = document.getElementById('seguimiento-titulo');
    // --- FIN NUEVO ---


    // Función para mostrar la ventana con los detalles de un pedido
    const mostrarDetallesPedido = (pedidoId) => {
        const pedido = pedidos.find(p => p.id === pedidoId);
        
        if (!pedido || !pedido.items) {
            alert('Error: No se encontraron los productos para este pedido.');
            return;
        }
        detalleTablaBody.innerHTML = ''; 
        pedido.items.forEach(item => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><img src="${item.imagen}" width="60" alt="${item.titulo}"></td>
                <td>${item.titulo}</td>
                <td>${item.precio}</td>
            `;
            detalleTablaBody.appendChild(tr);
        });
        modal.style.display = 'block';
    };

    // Función para cerrar la ventana modal de detalles
    const cerrarModal = () => {
        modal.style.display = 'none';
    };

    // --- NUEVO: Funciones para el Modal de Seguimiento ---
    
    // Función para mostrar la ventana con el seguimiento
    const mostrarSeguimiento = (pedidoId) => {
        const pedido = pedidos.find(p => p.id === pedidoId);
        // Actualizamos el título del modal con el ID del pedido
        seguimientoTitulo.textContent = `Seguimiento del Pedido #${pedido.id}`;
        
        // (Simulación) Aquí podrías cambiar dinámicamente qué pasos están completados
        // Por ahora, solo muestra el modal estático.
        seguimientoModal.style.display = 'block';
    };

    // Función para cerrar la ventana modal de seguimiento
    const cerrarSeguimientoModal = () => {
        seguimientoModal.style.display = 'none';
    };
    // --- FIN NUEVO ---


    // Llenar la tabla principal con el historial de pedidos
    historialBody.innerHTML = '';
    if (pedidos.length === 0) {
        historialBody.innerHTML = `<tr><td colspan="5" style="text-align: center;">Aún no has realizado ningún pedido.</td></tr>`;
    } else {
        pedidos.sort((a, b) => b.id - a.id); 
        pedidos.forEach(pedido => {
            const tr = document.createElement('tr');
            // MODIFICADO: Se añadió el botón "Seguimiento"
            tr.innerHTML = `
                <td>#${pedido.id}</td>
                <td>${pedido.fecha}</td>
                <td>$${pedido.total.toFixed(2)}</td>
                <td class="status-entregado">${pedido.estado}</td>
                <td>
                    <button class="btn-accion btn-ver-detalles" data-id="${pedido.id}">Ver Detalles</button>
                    <button class="btn-accion btn-ver-seguimiento" data-id="${pedido.id}">Seguimiento</button>
                </td>
            `;
            historialBody.appendChild(tr);
        });
    }

    // --- Manejadores de Eventos ---
    historialBody.addEventListener('click', (e) => {
        if (e.target.classList.contains('btn-ver-detalles')) {
            const pedidoId = parseInt(e.target.dataset.id, 10); 
            mostrarDetallesPedido(pedidoId);
        }
        // NUEVO: Manejador para el botón de seguimiento
        else if (e.target.classList.contains('btn-ver-seguimiento')) {
            const pedidoId = parseInt(e.target.dataset.id, 10);
            mostrarSeguimiento(pedidoId);
        }
    });

    // Clicks para cerrar los modales
    closeModalButton.addEventListener('click', cerrarModal);
    closeSeguimientoButton.addEventListener('click', cerrarSeguimientoModal); // NUEVO

    window.addEventListener('click', (e) => {
        if (e.target == modal) {
            cerrarModal();
        }
        // NUEVO: Clic fuera del modal de seguimiento
        if (e.target == seguimientoModal) {
            cerrarSeguimientoModal();
        }
    });
});