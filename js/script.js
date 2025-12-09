// --- CONSTANTES GLOBALES ---
const carrito = document.getElementById('carrito');
const elementos1 = document.getElementById('lista-1');
const elementos2 = document.getElementById('lista-2');
const lista = document.querySelector('#lista-carrito tbody');
const vaciarCarritoBtn = document.getElementById('vaciar-carrito');
const total = document.getElementById('total');
const finalizarCompraBtn = document.getElementById('finalizar-compra');

// --- VARIABLES CHECKOUT ---
let saldoMonedero = parseFloat(localStorage.getItem('saldoMonedero')) || 500.00; 

// --- 1. GESTOR DE CONSENTIMIENTO (MODO SIMULACIÓN) ---
document.addEventListener('DOMContentLoaded', () => {
    // Banner cookies
    const banner = document.getElementById('cookie-banner');
    const acceptBtn = document.getElementById('cookie-accept');
    banner.style.display = 'flex'; 
    acceptBtn.addEventListener('click', () => { banner.style.display = 'none'; });

    // Actualizar saldo visual
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

// --- 3. LÓGICA DEL CHECKOUT ---

const checkoutModal = document.getElementById('checkout-modal');
const closeCheckout = document.getElementById('close-checkout');
const btnPayNow = document.getElementById('btn-pay-now');

// Inputs
const invoiceCheck = document.getElementById('invoice-check');
const fiscalForm = document.getElementById('fiscal-form');
const paymentRadios = document.getElementsByName('payment-method');

// Donación (Footer)
const donateCheck = document.getElementById('donate-check');
const donationInputContainer = document.getElementById('donation-input-container');
const donationAmountInput = document.getElementById('donation-amount');

// Totales
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

// Donaciones
donateCheck.addEventListener('change', (e) => {
    donationInputContainer.style.display = e.target.checked ? 'block' : 'none';
    if(checkoutModal.style.display === 'block') actualizarTotalCheckout();
});
donationAmountInput.addEventListener('input', () => {
    if(checkoutModal.style.display === 'block') actualizarTotalCheckout();
});

// Fiscal
invoiceCheck.addEventListener('change', (e) => {
    fiscalForm.style.display = e.target.checked ? 'block' : 'none';
});

// Métodos Pago
const cardFormContainer = document.getElementById('card-form-container');

paymentRadios.forEach(radio => {
    radio.addEventListener('change', (e) => {
        document.getElementById('qr-info').style.display = 'none';
        document.getElementById('deposit-info').style.display = 'none';
        cardFormContainer.style.display = 'none';

        if (e.target.value === 'qr') document.getElementById('qr-info').style.display = 'block';
        else if (e.target.value === 'deposit') document.getElementById('deposit-info').style.display = 'block';
        else if (e.target.value === 'card') cardFormContainer.style.display = 'block';
    });
});

function actualizarTotalCheckout() {
    const subtotal = parseFloat(checkoutSubtotal.textContent);
    let donation = 0;
    if (donateCheck.checked) donation = parseFloat(donationAmountInput.value) || 0;
    checkoutDonation.textContent = donation.toFixed(2);
    checkoutTotal.textContent = (subtotal + donation).toFixed(2);
}

// --- 4. PROCESAMIENTO, MODALES Y ERRORES ---

const cfdiModal = document.getElementById('cfdi-modal');
const receiptModal = document.getElementById('receipt-modal');
const errorModal = document.getElementById('error-modal'); // Nuevo selector
const errorMessage = document.getElementById('error-message'); // Nuevo selector
const closeCfdi = document.getElementById('close-cfdi');
const closeReceipt = document.getElementById('close-receipt');
const closeError = document.getElementById('close-error');
const btnRetry = document.getElementById('btn-retry');
const btnCloseReceiptAction = document.getElementById('btn-close-receipt-action');

// Función para mostrar el modal de error
function mostrarError(mensaje) {
    errorMessage.textContent = mensaje;
    errorModal.style.display = 'block';
}

// Botones Acciones
document.getElementById('btn-email-cfdi').addEventListener('click', () => { alert('XML y PDF enviados al correo.'); cfdiModal.style.display='none'; });
document.getElementById('btn-download-cfdi').addEventListener('click', () => { alert('Descargando archivos...'); cfdiModal.style.display='none'; });
document.getElementById('btn-email-receipt').addEventListener('click', () => { alert('Recibo enviado al correo.'); receiptModal.style.display='none'; });

// Cerrar modales
closeCfdi.addEventListener('click', () => cfdiModal.style.display = 'none');
closeReceipt.addEventListener('click', () => receiptModal.style.display = 'none');
btnCloseReceiptAction.addEventListener('click', () => receiptModal.style.display = 'none');
closeError.addEventListener('click', () => errorModal.style.display = 'none');
btnRetry.addEventListener('click', () => errorModal.style.display = 'none');

btnPayNow.addEventListener('click', () => {
    const metodoPago = document.querySelector('input[name="payment-method"]:checked').value;
    const totalPagar = parseFloat(checkoutTotal.textContent);

    // Validación Monedero
    if (metodoPago === 'wallet' && saldoMonedero < totalPagar) {
        mostrarError("Saldo insuficiente en monedero.");
        return;
    }
    
    // Validación Tarjeta
    if (metodoPago === 'card') {
        const cardNum = document.getElementById('card-number').value;
        const cardName = document.getElementById('card-name').value;
        const cardCvv = document.getElementById('card-cvv').value;
        
        if(cardNum.length < 16 || cardName === '' || cardCvv.length < 3) {
            mostrarError("Datos de tarjeta incompletos o inválidos.");
            return;
        }
    }

    // Validación Factura
    if (invoiceCheck.checked && document.getElementById('fiscal-rfc').value.trim() === '') {
        mostrarError("El RFC es obligatorio para facturar.");
        return;
    }

    btnPayNow.textContent = "Procesando...";
    btnPayNow.disabled = true;

    setTimeout(() => {
        const exito = Math.random() > 0.2; 

        if (exito) {
            if (metodoPago === 'wallet') {
                saldoMonedero -= totalPagar;
                localStorage.setItem('saldoMonedero', saldoMonedero);
                document.getElementById('wallet-balance').textContent = saldoMonedero.toFixed(2);
            }
            const nuevoId = Date.now();
            guardarPedido(totalPagar, nuevoId);
            checkoutModal.style.display = 'none';
            vaciarCarrito();

            if (invoiceCheck.checked) {
                // Llenar datos de la FACTURA
                document.getElementById('cfdi-client-name').textContent = document.getElementById('fiscal-name').value || "PUBLICO EN GENERAL";
                document.getElementById('cfdi-client-rfc').textContent = document.getElementById('fiscal-rfc').value || "XAXX010101000";
                
                const cfdiItems = document.getElementById('cfdi-items');
                cfdiItems.innerHTML = '';
                const row = document.createElement('tr');
                const sub = (totalPagar / 1.16).toFixed(2);
                const iva = (totalPagar - sub).toFixed(2);
                row.innerHTML = `<td>1</td><td>Consumo de Alimentos y Bebidas (Folio ${nuevoId})</td><td>$${sub}</td><td>$${sub}</td>`;
                cfdiItems.appendChild(row);
                
                document.getElementById('cfdi-subtotal').textContent = sub;
                document.getElementById('cfdi-tax').textContent = iva;
                document.getElementById('cfdi-total').textContent = totalPagar.toFixed(2);

                cfdiModal.style.display = 'block';
            } else {
                // Llenar RECIBO
                document.getElementById('receipt-date').textContent = new Date().toLocaleDateString('es-MX');
                document.getElementById('receipt-id').textContent = nuevoId;
                document.getElementById('receipt-total').textContent = totalPagar.toFixed(2);
                receiptModal.style.display = 'block';
            }

        } else {
            mostrarError("El banco rechazó la transacción. Intente con otro método.");
        }

        btnPayNow.textContent = "Pagar Ahora";
        btnPayNow.disabled = false;

    }, 2000); 
});

function guardarPedido(total, idGenerado) {
    let pedidosHistorial = JSON.parse(localStorage.getItem('pedidosHistorial')) || [];
    const itemsComprados = [];
    lista.querySelectorAll('tr').forEach(fila => {
        const celdas = fila.querySelectorAll('td');
        if (celdas.length === 4) {
            itemsComprados.push({
                imagen: celdas[0].querySelector('img').src,
                titulo: celdas[1].textContent,
                precio: celdas[2].textContent
            });
        }
    });
    const nuevoPedido = { id: idGenerado, fecha: new Date().toLocaleDateString('es-MX'), total: total, estado: 'Entregado', items: itemsComprados };
    pedidosHistorial.push(nuevoPedido);
    localStorage.setItem('pedidosHistorial', JSON.stringify(pedidosHistorial));
}
