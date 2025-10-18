document.addEventListener('DOMContentLoaded', () => {
    const stockBody = document.getElementById('stock-body');
    const form = document.getElementById('form-nuevo-producto');
    const nombreInput = document.getElementById('nombre-producto');
    const cantidadInput = document.getElementById('cantidad-producto');
    const idInput = document.getElementById('producto-id');

    let stock = JSON.parse(localStorage.getItem('stockPanaderia')) || [
        { id: 1, nombre: 'Bolillo', cantidad: 150 },
        { id: 2, nombre: 'Concha', cantidad: 80 },
        { id: 3, nombre: 'Pay de Queso', cantidad: 25 },
        { id: 4, nombre: 'Café Americano (vasos)', cantidad: 200 }
    ];

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

    form.addEventListener('submit', (e) => {
        e.preventDefault();
        const nombre = nombreInput.value.trim();
        const cantidad = parseInt(cantidadInput.value);
        const id = idInput.value;

        if (nombre === '' || isNaN(cantidad) || cantidad < 0) {
            alert('Por favor, ingresa datos válidos.');
            return;
        }

        if (id) { // Editando
            const producto = stock.find(p => p.id == id);
            producto.nombre = nombre;
            producto.cantidad = cantidad;
        } else { // Creando
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

    renderizarTabla();
});