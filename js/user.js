// user.js (Versión Definitiva)

document.addEventListener('DOMContentLoaded', () => {
    const historialBody = document.getElementById('historial-body');
    const pedidos = JSON.parse(localStorage.getItem('pedidosHistorial')) || [];

    const modal = document.getElementById('detalle-modal');
    const closeModalButton = document.querySelector('.close-button');
    const detalleTablaBody = document.querySelector('#detalle-pedido-tabla tbody');

    // Función para mostrar la ventana con los detalles de un pedido
    const mostrarDetallesPedido = (pedidoId) => {
        // Buscamos el pedido específico en nuestro array de pedidos
        const pedido = pedidos.find(p => p.id === pedidoId);
        
        if (!pedido || !pedido.items) {
            alert('Error: No se encontraron los productos para este pedido.');
            return;
        }

        // Limpiamos la tabla de la ventana por si tenía datos de un pedido anterior
        detalleTablaBody.innerHTML = ''; 

        // Por cada producto ('item') en el pedido, creamos una fila en la tabla
        pedido.items.forEach(item => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><img src="${item.imagen}" width="60" alt="${item.titulo}"></td>
                <td>${item.titulo}</td>
                <td>${item.precio}</td>
            `;
            detalleTablaBody.appendChild(tr);
        });
        
        // Hacemos visible la ventana modal
        modal.style.display = 'block';
    };

    // Función para cerrar la ventana modal
    const cerrarModal = () => {
        modal.style.display = 'none';
    };

    // Llenar la tabla principal con el historial de pedidos
    historialBody.innerHTML = '';
    if (pedidos.length === 0) {
        historialBody.innerHTML = `<tr><td colspan="5" style="text-align: center;">Aún no has realizado ningún pedido.</td></tr>`;
    } else {
        pedidos.sort((a, b) => b.id - a.id); // Ordenar para mostrar el más reciente primero
        pedidos.forEach(pedido => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>#${pedido.id}</td>
                <td>${pedido.fecha}</td>
                <td>$${pedido.total.toFixed(2)}</td>
                <td class="status-entregado">${pedido.estado}</td>
                <td><button class="btn-ver-detalles" data-id="${pedido.id}">Ver Detalles</button></td>
            `;
            historialBody.appendChild(tr);
        });
    }

    // --- Manejadores de Eventos ---
    historialBody.addEventListener('click', (e) => {
        if (e.target.classList.contains('btn-ver-detalles')) {
            const pedidoId = parseInt(e.target.dataset.id, 10); // Convertimos el ID a número
            mostrarDetallesPedido(pedidoId);
        }
    });

    closeModalButton.addEventListener('click', cerrarModal);
    window.addEventListener('click', (e) => {
        if (e.target == modal) {
            cerrarModal();
        }
    });
});