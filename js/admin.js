document.addEventListener('DOMContentLoaded', () => {
    // --- Selectores del DOM ---
    const stockBody = document.getElementById('stock-body');
    const form = document.getElementById('form-nuevo-producto');
    const nombreInput = document.getElementById('nombre-producto');
    const cantidadInput = document.getElementById('cantidad-producto');
    const idInput = document.getElementById('producto-id');
    const trackingContainer = document.getElementById('tracking-container'); // <-- NUEVO

    // --- Datos de LocalStorage ---
    let stock = JSON.parse(localStorage.getItem('stockPanaderia')) || [
        { id: 1, nombre: 'Bolillo', cantidad: 150 },
        { id: 2, nombre: 'Concha', cantidad: 80 },
        { id: 3, nombre: 'Pay de Queso', cantidad: 25 },
        { id: 4, nombre: 'Café Americano (vasos)', cantidad: 200 }
    ];
    const pedidos = JSON.parse(localStorage.getItem('pedidosHistorial')) || []; // <-- NUEVO

    // --- Funciones para Stock de Productos ---
    const guardarStock = () => localStorage.setItem('stockPanaderia', JSON.stringify(stock));

    const renderizarTabla = () => {
        stockBody.innerHTML = '';
        if (stock.length === 0) {
            stockBody.innerHTML = '<tr><td colspan="4">No hay productos en el inventario.</td></tr>';
            return;
        }
        stock.forEach(p => {
            const estado = p.cantidad > 50 ? 'Disponible' : p.cantidad > 0 ? 'Bajo Stock' : 'Agotado';
            const clase = p.cantidad > 50 ? 'status-disponible' : p.cantidad > 0 ? 'status-bajo' : 'status-agotado';
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${p.nombre}</td>
                <td>${p.cantidad}</td>
                <td><span class="${clase}">${estado}</span></td>
                <td>
                    <button class="btn-accion btn-editar" data-id="${p.id}">Editar</button>
                    <button class="btn-accion btn-eliminar" data-id="${p.id}">Eliminar</button>
                </td>
            `;
            stockBody.appendChild(tr);
        });
    };

    // --- Event Listeners para Stock ---
    form.addEventListener('submit', (e) => {
        e.preventDefault();
        const nombre = nombreInput.value.trim();
        const cantidad = parseInt(cantidadInput.value);
        const id = idInput.value;

        if (nombre === '' || isNaN(cantidad) || cantidad < 0) {
            alert('Por favor, ingresa datos válidos.');
            return;
        }

        if (id) { 
            const producto = stock.find(p => p.id == id);
            producto.nombre = nombre;
            producto.cantidad = cantidad;
        } else { 
            stock.push({ id: Date.now(), nombre, cantidad });
        }
        
        guardarStock();
        renderizarTabla();
        form.reset();
        idInput.value = '';
    });

    stockBody.addEventListener('click', (e) => {
        if (e.target.classList.contains('btn-editar')) {
            const id = e.target.dataset.id;
            const producto = stock.find(p => p.id == id);
            idInput.value = producto.id;
            nombreInput.value = producto.nombre;
            cantidadInput.value = producto.cantidad;
        }

        if (e.target.classList.contains('btn-eliminar')) {
            const id = e.target.dataset.id;
            if (confirm("¿Estás seguro de que deseas eliminar este producto?")) {
                stock = stock.filter(p => p.id != id);
                guardarStock();
                renderizarTabla();
            }
        }
    });

    // --- NUEVAS FUNCIONES PARA SEGUIMIENTO DE PEDIDOS (ADMIN) ---

    // Función para "simular" datos de repartidor basados en el ID del pedido
    const getSimulatedCarrierData = (pedidoId) => {
        const platforms = [
            { name: 'Uber Eats', class: 'platform-uber' },
            { name: 'DiDi Food', class: 'platform-didi' },
            { name: 'Pendiente', class: 'platform-pending' }
        ];
        const drivers = ['Juan Pérez', 'Ana Gómez', 'Luis Castro'];
        const vehicles = ['Motocicleta Italika', 'Auto Nissan Versa', 'Motocicleta Honda'];
        const plates = ['ABC-123', 'XYZ-789', 'DEF-456'];
        
        // Usamos el ID para generar un índice consistente
        const index = pedidoId % 3; 

        return {
            platform: platforms[index].name,
            platformClass: platforms[index].class,
            driver: drivers[index],
            vehicle: vehicles[index],
            plates: plates[index]
        };
    };

    // Función para renderizar las tarjetas de seguimiento
    const renderizarSeguimientoActivo = () => {
        trackingContainer.innerHTML = '';
        
        // Tomamos los 3 pedidos más recientes para simular que están "activos"
        const pedidosRecientes = pedidos.sort((a, b) => b.id - a.id).slice(0, 3); 

        if (pedidosRecientes.length === 0) {
            trackingContainer.innerHTML = '<p style="color: #333;">No hay pedidos activos para mostrar.</p>';
            return;
        }

        pedidosRecientes.forEach(pedido => {
            const carrierData = getSimulatedCarrierData(pedido.id);
            
            // Simula un estado (ya que en tu script.js todos se guardan como "Entregado")
            const estadoSimulado = pedido.id % 3 === 0 ? 'En Reparto' : (pedido.id % 3 === 1 ? 'Preparando' : 'Nuevo');
            
            const card = document.createElement('div');
            card.className = 'tracking-card';
            
            let detailsHTML = `<li>Asignando repartidor...</li>`;
            if (estadoSimulado !== 'Nuevo') {
                detailsHTML = `
                    <li><strong>Transportista:</strong> <strong>${carrierData.driver}</strong></li>
                    <li><strong>Vehículo:</strong> ${carrierData.vehicle}</li>
                    <li><strong>Placas:</strong> ${carrierData.plates}</li>
                `;
            }

            card.innerHTML = `
                <div class="tracking-header">
                    <h4>Pedido #${pedido.id} (${estadoSimulado})</h4>
                    <span class="platform-tag ${carrierData.platformClass}">${carrierData.platform}</span>
                </div>
                <ul class="tracking-details">
                    ${detailsHTML}
                </ul>
            `;
            trackingContainer.appendChild(card);
        });
    };
    
    // --- Inicialización ---
    renderizarTabla();
    renderizarSeguimientoActivo(); // <-- NUEVO
});