// =========================================================
// ¡ESTA LÍNEA ES LA SOLUCIÓN! 
// Fuerza al navegador a "olvidar" la sesión para que te deje ver el modal
localStorage.removeItem('isLoggedIn');
// =========================================================

// --- CONSTANTES GLOBALES ---
const carrito = document.getElementById('carrito');
const elementos1 = document.getElementById('lista-1');
const elementos2 = document.getElementById('lista-2');
const lista = document.querySelector('#lista-carrito tbody');
const vaciarCarritoBtn = document.getElementById('vaciar-carrito');
const total = document.getElementById('total');
const finalizarCompraBtn = document.getElementById('finalizar-compra');

let saldoMonedero = parseFloat(localStorage.getItem('saldoMonedero')) || 500.00; 

document.addEventListener('DOMContentLoaded', () => {
    const banner = document.getElementById('cookie-banner');
    const acceptBtn = document.getElementById('cookie-accept');
    if (banner && acceptBtn) {
        banner.style.display = 'flex'; 
        acceptBtn.addEventListener('click', () => { banner.style.display = 'none'; });
    }

    const walletBalanceDisplay = document.getElementById('wallet-balance');
    if (walletBalanceDisplay) walletBalanceDisplay.textContent = saldoMonedero.toFixed(2);

    cargarEventListeners();
    setupLoginProtection();
});

// --- FUNCIONES DE LOGIN Y PROTECCIÓN ---
const loginModal = document.getElementById('login-modal');
const closeLogin = document.getElementById('close-login');
let pendingAction = null; 

function setupLoginProtection() {
    const navProfile = document.getElementById('nav-profile');
    const navAdmin = document.getElementById('nav-admin');

    // Función unificada para manejar los clics en los íconos
    const manejarClicIcono = (e, destinoUrl) => {
        e.preventDefault();
        const isLoggedIn = localStorage.getItem('isLoggedIn') === 'true';
        
        if (isLoggedIn) {
            // Si ya inició sesión, lo manda a la página
            window.location.href = destinoUrl;
        } else {
            // Si no ha iniciado sesión, abre la ventana (modal)
            if (loginModal) loginModal.style.display = 'block';
        }
    };

    // Al hacer clic en la personita
    if (navProfile) {
        navProfile.addEventListener('click', (e) => manejarClicIcono(e, navProfile.getAttribute('href')));
    }

    // Al hacer clic en la tuerca
    if (navAdmin) {
        navAdmin.addEventListener('click', (e) => manejarClicIcono(e, navAdmin.getAttribute('href')));
    }

    // Cerrar modal con la 'X'
    if (closeLogin) {
        closeLogin.addEventListener('click', () => {
            if (loginModal) loginModal.style.display = 'none';
            document.getElementById('login-form')?.reset();    // Borrar caché
            document.getElementById('register-form')?.reset(); // Borrar caché
        });
    }

    // Cerrar modal al hacer clic en el fondo oscuro
    window.addEventListener('click', (e) => {
        if (e.target === loginModal) {
            loginModal.style.display = 'none';
            document.getElementById('login-form')?.reset();    // Borrar caché
            document.getElementById('register-form')?.reset(); // Borrar caché
        }
    });
}

function checkLogin(callback) {
    const isLoggedIn = localStorage.getItem('isLoggedIn') === 'true';
    if (isLoggedIn) {
        callback();
    } else {
        pendingAction = callback;
        if (loginModal) loginModal.style.display = 'block';
    }
}

// --- FUNCIONES DEL CARRITO ---
function cargarEventListeners() {
    if (elementos1) elementos1.addEventListener('click', comprarElemento);
    if (elementos2) elementos2.addEventListener('click', comprarElemento);
    if (carrito) carrito.addEventListener('click', eliminarElemento);
    if (vaciarCarritoBtn) vaciarCarritoBtn.addEventListener('click', vaciarCarrito);
    
    if (finalizarCompraBtn) {
        finalizarCompraBtn.addEventListener('click', (e) => {
            e.preventDefault();
            checkLogin(() => {
                abrirCheckout(e);
            });
        });
    }
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
    if (!lista) return;
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
    if (!lista) return;
    while (lista.firstChild) {
        lista.removeChild(lista.firstChild);
    }
    actualizarTotal();
}

function actualizarTotal() {
    if (!total || !lista) return;
    let totalSuma = 0;
    const precios = lista.querySelectorAll('tr td:nth-child(3)');
    precios.forEach(p => {
        totalSuma += parseFloat(p.textContent.replace('$', '')) || 0;
    });
    total.textContent = totalSuma.toFixed(2);
}

// --- CHECKOUT ---
const checkoutModal = document.getElementById('checkout-modal');
const closeCheckout = document.getElementById('close-checkout');
const btnPayNow = document.getElementById('btn-pay-now');
const invoiceCheck = document.getElementById('invoice-check');
const fiscalForm = document.getElementById('fiscal-form');
const checkoutSubtotal = document.getElementById('checkout-subtotal');
const checkoutTotal = document.getElementById('checkout-total');

function abrirCheckout(e) {
    const subtotal = parseFloat(total ? total.textContent : 0);
    if (subtotal <= 0) {
        alert('Tu carrito está vacío.');
        return;
    }
    if (checkoutSubtotal) checkoutSubtotal.textContent = subtotal.toFixed(2);
    if (checkoutTotal) checkoutTotal.textContent = subtotal.toFixed(2);
    if (checkoutModal) checkoutModal.style.display = 'block';
}

if (closeCheckout) closeCheckout.addEventListener('click', () => { checkoutModal.style.display = 'none'; });
if (invoiceCheck) {
    invoiceCheck.addEventListener('change', (e) => {
        if (fiscalForm) fiscalForm.style.display = e.target.checked ? 'block' : 'none';
    });
}

// Modales secundarios
const receiptModal = document.getElementById('receipt-modal');
const closeReceipt = document.getElementById('close-receipt');
const btnCloseReceiptAction = document.getElementById('btn-close-receipt-action');

if (closeReceipt) closeReceipt.addEventListener('click', () => receiptModal.style.display = 'none');
if (btnCloseReceiptAction) btnCloseReceiptAction.addEventListener('click', () => receiptModal.style.display = 'none');

if (btnPayNow) {
    btnPayNow.addEventListener('click', () => {
        btnPayNow.textContent = "Procesando...";
        btnPayNow.disabled = true;

        setTimeout(() => {
            if (checkoutModal) checkoutModal.style.display = 'none';
            vaciarCarrito();
            if (receiptModal) {
                const rTotal = document.getElementById('receipt-total');
                if (rTotal) rTotal.textContent = checkoutTotal.textContent;
                receiptModal.style.display = 'block';
            }
            btnPayNow.textContent = "Pagar Ahora";
            btnPayNow.disabled = false;
        }, 1200);
    });
}