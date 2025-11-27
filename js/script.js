// --- CONSTANTES GLOBALES ---
const carrito = document.getElementById('carrito');
const elementos1 = document.getElementById('lista-1');
const elementos2 = document.getElementById('lista-2');
const lista = document.querySelector('#lista-carrito tbody');
const vaciarCarritoBtn = document.getElementById('vaciar-carrito');
const total = document.getElementById('total');
const finalizarCompraBtn = document.getElementById('finalizar-compra');

// --- VARIABLES CHECKOUT ---
let saldoMonedero = parseFloat(localStorage.getItem('saldoMonedero')) || 500.00; // Saldo inicial simulado

// --- 1. GESTOR DE CONSENTIMIENTO (MODO SIMULACIÓN) ---
document.addEventListener('DOMContentLoaded', () => {
    // Banner cookies
    const banner = document.getElementById('cookie-banner');
    const acceptBtn = document.getElementById('cookie-accept');
    
    // MODO SIMULACIÓN: Siempre mostrar el banner al cargar
    banner.style.display = 'flex'; 
    
    acceptBtn.addEventListener('click', () => { 
        banner.style.display = 'none'; 
    });

    // Actualizar saldo visual en el modal
    const walletBalanceDisplay = document.getElementById('wallet-balance');
    if(walletBalanceDisplay) walletBalanceDisplay.textContent = saldoMonedero.toFixed(2);

    cargarEventListeners();
});

// --- 2. FUNCIONES DEL CARRITO (CORE) ---
function cargarEventListeners() {
    elementos1.addEventListener('click', comprarElemento);
    elementos2.addEventListener('click', comprarElemento);
    carrito.addEventListener('click', eliminarElemento);
    vaciarCarritoBtn.addEventListener('click', vaciarCarrito);
    // Cambiamos la función del botón finalizar
    finalizarCompraBtn.addEventListener('click', abrirCheckout); 
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

// --- 3. LÓGICA DEL NUEVO CHECKOUT (DONACIONES, FISCAL, PAGO) ---

const checkoutModal = document.getElementById('checkout-modal');
const closeCheckout = document.getElementById('close-checkout');
const btnPayNow = document.getElementById('btn-pay-now');

// Inputs Checkout
const donateCheck = document.getElementById('donate-check');
const donationInputContainer = document.getElementById('donation-input-container');
const donationAmountInput = document.getElementById('donation-amount');
const invoiceCheck = document.getElementById('invoice-check');
const fiscalForm = document.getElementById('fiscal-form');
const paymentRadios = document.getElementsByName('payment-method');

// Totales Checkout
const checkoutSubtotal = document.getElementById('checkout-subtotal');
const checkoutDonation = document.getElementById('checkout-donation');
const checkoutTotal = document.getElementById('checkout-total');

function abrirCheckout(e) {
    e.preventDefault();
    const subtotal = parseFloat(total.textContent);
    
    if (subtotal <= 0) {
        alert('Tu carrito está vacío.');
        return;
    }

    checkoutSubtotal.textContent = subtotal.toFixed(2);
    actualizarTotalCheckout();
    checkoutModal.style.display = 'block';
}

closeCheckout.addEventListener('click', () => { checkoutModal.style.display = 'none'; });

// --- Lógica de Donaciones ---
donateCheck.addEventListener('change', (e) => {
    donationInputContainer.style.display = e.target.checked ? 'block' : 'none';
    actualizarTotalCheckout();
});

donationAmountInput.addEventListener('input', actualizarTotalCheckout);

// --- Lógica de Datos Fiscales ---
invoiceCheck.addEventListener('change', (e) => {
    fiscalForm.style.display = e.target.checked ? 'block' : 'none';
});

// --- Lógica de Métodos de Pago (Mostrar QR/Info) ---
paymentRadios.forEach(radio => {
    radio.addEventListener('change', (e) => {
        // Ocultar todos primero
        document.getElementById('qr-info').style.display = 'none';
        document.getElementById('deposit-info').style.display = 'none';

        if (e.target.value === 'qr') {
            document.getElementById('qr-info').style.display = 'block';
        } else if (e.target.value === 'deposit') {
            document.getElementById('deposit-info').style.display = 'block';
        }
    });
});

function actualizarTotalCheckout() {
    const subtotal = parseFloat(checkoutSubtotal.textContent);
    let donation = 0;

    if (donateCheck.checked) {
        donation = parseFloat(donationAmountInput.value) || 0;
    }

    checkoutDonation.textContent = donation.toFixed(2);
    checkoutTotal.textContent = (subtotal + donation).toFixed(2);
}

// --- 4. PROCESAMIENTO DEL PAGO (CON EXCEPCIONES Y MODALES) ---

const notifModal = document.getElementById('notification-modal');
const notifTitle = document.getElementById('notif-title');
const notifMessage = document.getElementById('notif-message');
const invoiceButtons = document.getElementById('invoice-buttons');
const closeNotif = document.getElementById('close-notification');

btnPayNow.addEventListener('click', () => {
    const metodoPago = document.querySelector('input[name="payment-method"]:checked').value;
    const totalPagar = parseFloat(checkoutTotal.textContent);

    // Validación Monedero
    if (metodoPago === 'wallet') {
        if (saldoMonedero < totalPagar) {
            mostrarNotificacion("Error de Pago", "Saldo insuficiente en monedero.", false, false);
            return;
        }
    }

    // Validación Datos Fiscales
    if (invoiceCheck.checked) {
        const rfc = document.getElementById('fiscal-rfc').value;
        if (rfc.trim() === '') {
            alert("Por favor ingresa tu RFC para la factura.");
            return;
        }
    }

    // SIMULACIÓN DE PROCESO (Loading)
    btnPayNow.textContent = "Procesando...";
    btnPayNow.disabled = true;

    setTimeout(() => {
        // --- SIMULACIÓN DE EXCEPCIÓN (20% de probabilidad de fallo) ---
        const exito = Math.random() > 0.2; 

        if (exito) {
            // ÉXITO
            if (metodoPago === 'wallet') {
                saldoMonedero -= totalPagar;
                localStorage.setItem('saldoMonedero', saldoMonedero);
                document.getElementById('wallet-balance').textContent = saldoMonedero.toFixed(2);
            }
            
            guardarPedido(totalPagar);
            
            // Mostrar modal de éxito con botones de factura si aplica
            const msg = invoiceCheck.checked 
                ? "¡Pago exitoso! Tu factura está lista." 
                : "¡Pago exitoso! Gracias por tu compra.";
                
            mostrarNotificacion("Pago Aprobado", msg, true, invoiceCheck.checked);
            
            checkoutModal.style.display = 'none';
            vaciarCarrito();

        } else {
            // FALLO (Simulación)
            mostrarNotificacion("Error", "El pago no se procesó. Intente con otro método.", false, false);
        }

        btnPayNow.textContent = "Pagar Ahora";
        btnPayNow.disabled = false;

    }, 2000); // 2 segundos de espera simulada
});

function mostrarNotificacion(titulo, mensaje, esExito, mostrarFactura) {
    notifTitle.textContent = titulo;
    notifMessage.textContent = mensaje;
    
    notifTitle.style.color = esExito ? "green" : "red";
    invoiceButtons.style.display = mostrarFactura ? "flex" : "none";
    
    notifModal.style.display = 'block';
}

closeNotif.addEventListener('click', () => {
    notifModal.style.display = 'none';
});

function guardarPedido(total) {
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

    const nuevoPedido = {
        id: Date.now(),
        fecha: new Date().toLocaleDateString('es-MX'),
        total: total,
        estado: 'Entregado', // En un sistema real sería "Pagado/Pendiente"
        items: itemsComprados
    };

    pedidosHistorial.push(nuevoPedido);
    localStorage.setItem('pedidosHistorial', JSON.stringify(pedidosHistorial));
}