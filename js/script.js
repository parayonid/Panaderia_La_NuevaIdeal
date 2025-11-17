// --- 1. GESTOR DE CONSENTIMIENTO ---
document.addEventListener('DOMContentLoaded', () => {
    const banner = document.getElementById('cookie-banner');
    const acceptBtn = document.getElementById('cookie-accept');
    
    // Revisar si el usuario ya ha dado su consentimiento
    const consentimiento = localStorage.getItem('cookieConsent');

    if (consentimiento !== 'true') {
        // Si no ha aceptado, mostramos el banner
        banner.style.display = 'flex';
    }

    // Manejador para el botón de ACEPTAR
    acceptBtn.addEventListener('click', () => {
        localStorage.setItem('cookieConsent', 'true');
        banner.style.display = 'none';
    });
});


// --- 2. FUNCIONES PRINCIPALES DEL CARRITO ---
// (Estas funciones se cargan siempre)

const carrito = document.getElementById('carrito');
const elementos1 = document.getElementById('lista-1');
const elementos2 = document.getElementById('lista-2');
const lista = document.querySelector('#lista-carrito tbody');
const vaciarCarritoBtn = document.getElementById('vaciar-carrito');
const total = document.getElementById('total');
const finalizarCompraBtn = document.getElementById('finalizar-compra');

cargarEventListeners(); // Llamamos a las funciones del carrito al cargar la página

function cargarEventListeners() {
    elementos1.addEventListener('click', comprarElemento);
    elementos2.addEventListener('click', comprarElemento);
    carrito.addEventListener('click', eliminarElemento);
    vaciarCarritoBtn.addEventListener('click', vaciarCarrito);
    finalizarCompraBtn.addEventListener('click', finalizarCompra);
}

function comprarElemento(e) {
    e.preventDefault();
    if (e.target.classList.contains('agregar-carrito')) {
        const elemento = e.target.closest('.product');
        leerDatosElemento(elemento);
    }
}

function leerDatosElemento(elemento) {
    const infoElemento = {
        imagen: elemento.querySelector('img').src,
        titulo: elemento.querySelector('h3').textContent,
        precio: elemento.querySelector('.precio').textContent,
        id: elemento.querySelector('a').getAttribute('data-id')
    };
    insertarCarrito(infoElemento);
}

function insertarCarrito(elemento) {
    const row = document.createElement('tr');
    row.innerHTML = `
        <td><img src="${elemento.imagen}" width="100" alt="${elemento.titulo}"></td>
        <td>${elemento.titulo}</td>
        <td>${elemento.precio}</td>
        <td><a href="#" class="borrar" data-id="${elemento.id}">X</a></td>
    `;
    lista.appendChild(row);
    actualizarTotal();
}

function eliminarElemento(e) {
    e.preventDefault();
    if (e.target.classList.contains('borrar')) {
        e.target.closest('tr').remove();
        actualizarTotal();
    }
}

function vaciarCarrito() {
    while (lista.firstChild) {
        lista.removeChild(lista.firstChild);
    }
    actualizarTotal();
}

function actualizarTotal() {
    let totalSuma = 0;
    const precios = lista.querySelectorAll('tr td:nth-child(3)');
    precios.forEach(p => {
        totalSuma += parseFloat(p.textContent.replace('$', '')) || 0;
    });
    total.textContent = totalSuma.toFixed(2);
}

function finalizarCompra(e) {
    e.preventDefault();
    const totalCompra = parseFloat(total.textContent);

    if (totalCompra <= 0) {
        alert('Tu carrito está vacío.');
        return;
    }

    let pedidosHistorial = JSON.parse(localStorage.getItem('pedidosHistorial')) || [];
    const itemsComprados = [];

    lista.querySelectorAll('tr').forEach(fila => {
        const celdas = fila.querySelectorAll('td');
        if (celdas.length === 4) {
            const item = {
                imagen: celdas[0].querySelector('img').src,
                titulo: celdas[1].textContent,
                precio: celdas[2].textContent
            };
            itemsComprados.push(item);
        }
    });
    
    if (itemsComprados.length === 0) {
        alert("Hubo un error al procesar los productos del carrito. Intenta de nuevo.");
        return;
    }

    const nuevoPedido = {
        id: Date.now(),
        fecha: new Date().toLocaleDateString('es-MX', { year: 'numeric', month: '2-digit', day: '2-digit' }),
        total: totalCompra,
        estado: 'Entregado',
        items: itemsComprados
    };

    pedidosHistorial.push(nuevoPedido);
    localStorage.setItem('pedidosHistorial', JSON.stringify(pedidosHistorial));
    alert(`Gracias por tu compra. Total pagado: $${totalCompra.toFixed(2)}`);
    vaciarCarrito();
}