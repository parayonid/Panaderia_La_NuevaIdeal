# La Nueva Ideal — Integración Etapa 4 (17 noviembre 2026)

## Base y alcance

Se trabajó sobre los archivos **reales** de `src_nueva_ideal.zip`, con Git `main` en `424231f` y múltiples cambios sin confirmar en el ZIP. No se ejecutó un `git rebase` sobre tu remoto: **no hay una segunda rama base identificada** y reescribir este historial sería inseguro. Este paquete es una integración de archivos para revisar y confirmar en una rama nueva.

### Cambios realizados

- `index.html`: carrito con cantidades, búsqueda, detalle y checkout de demostración.
- `js/script.js`: conserva carrito local, pero reconoce la sesión Firebase real; cotiza con FastAPI y registra órdenes sin aceptar precios del navegador. El `solicitud_id` evita repetir compras en reintentos.
- `views/user.html` + `js/user.js`: perfil y datos propios, pedidos, seguimiento real, monedero, movimientos y tickets.
- `crm-backend/etapa4.py` (nuevo): endpoints de compra, pedidos, monedero, tickets, promociones e impuestos.
- `crm-backend/main.py`: registra el router anterior; **no reemplaza** las rutas CRM/SCM/ERP ni su bitácora.
- `views/etapa4-gestion.html` + `js/etapa4-gestion.js` (nuevos): gestión de tickets por Admin/Ventas, seguimiento por Admin/Logística y promociones/impuestos solo por Admin.
- `views/admin.html`: incorpora un enlace a «Operación de tienda (Etapa 4)» sin tocar las vistas CRM/SCM/ERP.
- `firebase.json`: excluye `crm-backend/**` y otros archivos sensibles/privados de Firebase Hosting. Hosting sigue publicando la raíz; es preferible separar un directorio web público en un refactor posterior.
- `tests/test_etapa4_unit.py`: tests de validaciones y rutas sin conectarse a Firebase.

## IMPORTANTE — CREDENCIALES

El ZIP original contenía `crm-backend/serviceAccountKey.json` (clave privada de cuenta de servicio). **Este paquete no incluye ese archivo**, ni `.git`, `node_modules`, cachés o secretos. Nunca subas la clave a Git, la web pública, ni a un ZIP compartido. Revisa en Firebase Hosting si una versión anterior pudo exponerla debido a `hosting.public: "."` y, por precaución, **rota/revoca la clave de esa cuenta de servicio** en Google Cloud IAM antes de usarla de nuevo. Render debe leer `FIREBASE_CREDENTIALS_JSON` como variable de entorno.

## Configuración de Render

1. En tu rama de integración añade `crm-backend/etapa4.py` junto a `crm-backend/main.py`. El `main.py` incluido importa `etapa4` al final.
2. Asegura que Render ejecute su comando usual en la carpeta `crm-backend`, por ejemplo `uvicorn main:app --host 0.0.0.0 --port $PORT`.
3. Variables del servicio: `FIREBASE_CREDENTIALS_JSON` (con permisos adecuados), opcional `ETAPA4_DEMO_MODE=false` (por defecto), opcional `ETAPA4_DEMO_UIDS=UID1,UID2` si debes probar recargas/pagos ficticios con cuentas autorizadas.
4. **En producción deja el modo DEMO deshabilitado**. No existe integración de tarjeta real, pasarela bancaria, transferencia verificada ni emisión real de CFDI.
5. Verifica `GET /health`; después con un usuario autorizado comprueba `/etapa4/config`, `/checkout/cotizar`, `/pedidos/mios`.

## Configuración de Hosting

`firebase.json` publica actualmente la raíz y excluye `crm-backend/**`, `.git`, `.agents`, cachés y otras rutas privadas. Antes del despliegue ejecuta `firebase deploy --only hosting` desde la raíz correcta y comprueba que `/crm-backend/serviceAccountKey.json` **no sea accesible**; la respuesta debe ser 404 (o el hosting puede redirigir a una página pública; nunca debe devolver JSON de credenciales).

## Secuencia recomendada de Git (en tu equipo)

```bash
git status
git switch -c feat/etapa4-integracion
# Haz una copia de los archivos locales antes de reemplazarlos.
# Copia los archivos de este paquete conservando rutas.
git diff --check
git add index.html js/script.js js/user.js js/etapa4-gestion.js views/user.html views/admin.html views/etapa4-gestion.html crm-backend/main.py crm-backend/etapa4.py firebase.json tests/test_etapa4_unit.py docs/ETAPA4_INTEGRACION.md
git commit -m "feat: integrar etapa 4 de tienda con CRM SCM ERP"
# Si quieres rebase posterior: git fetch origin && git rebase origin/main
# Resuelve conflictos antes de subir. NUNCA fuerces push a main sin revisión.
git push -u origin feat/etapa4-integracion
```

Como el ZIP traía modificaciones sin confirmar, revisa `git diff --cached` antes de `git commit`. Si trabajas con una rama compartida, mejor abre Pull Request.

## Métodos de pago y lógica

- `monedero`: requiere saldo suficiente, registra pedido pagado, movimiento de monedero, salida de stock y Kardex en una transacción Firestore.
- `demo`: únicamente si `ETAPA4_DEMO_MODE=true` **y** el UID está en `ETAPA4_DEMO_UIDS`; registra compra ficticia y descuenta stock de la base usada en el demo. **Usa proyecto de Firebase de pruebas**.
- `transferencia`, `qr`, `cheque`: pedido pendiente de pago; **no se descuentan existencias** hasta verificación por un mecanismo externo. No hay verificación bancaria real implementada.
- `total_aceptado_centavos`: el servidor compara el total cotizado que vio el cliente con el total recalculado en la transacción. Si cambió, devuelve HTTP 409.
- Las órdenes de la tienda se escriben en `ordenes_clientes` con `canal: tienda`, `cliente_uid`, pago y seguimiento; se vinculan a `clientes` CRM sin sobrescribir la información existente.

## Pruebas mínimas para la entrega

1. Registro/inicio de sesión y campo `usuarios/{uid}.rol = cliente` (exacto).
2. Catálogo público e inventario correcto, agregar 2 unidades, reducir y eliminar, recargar página.
3. Intentar checkout sin sesión: solicita iniciar sesión.
4. Cotización y pago con saldo insuficiente: HTTP 409, sin descuento de stock.
5. Si hay entorno DEMO aislado: recargar saldo ficticio, comprar, validar monedero, una orden, un movimiento de Kardex y bitácora.
6. Doble envío con mismo `solicitud_id`: solo una orden y un descuento.
7. Transferencia: pedido pendiente y sin movimiento de inventario.
8. Cliente A no puede consultar pedidos/tickets de cliente B.
9. Admin ve promociones, impuestos y tickets; Ventas ve tickets, Logística ve seguimiento.
10. Asegurar que `/crm-backend/serviceAccountKey.json` no es público.

## Validación ejecutada sin servicios reales

- `python -m py_compile crm-backend/main.py crm-backend/etapa4.py`.
- `node --check` para los scripts JS cambiados.
- Validación de HTML sin IDs repetidos y comprobación de controles del checkout.
- `python -m unittest discover -s tests -v`: pruebas aisladas de centavos, contratos y permisos declarados.

**No se han ejecutado operaciones sobre tu Firestore real ni se ha desplegado en Render/Hosting.** No interpretar esas pruebas como validación de pagos bancarios, reglas Firestore ni concurrencia real.

## Limitaciones conocidas

- El checkout usa impuestos configurados globalmente para demostración. Para uso fiscal real hace falta cálculo por producto y CFDI auténtico.
- Las transferencias no reservan inventario; el stock puede cambiar mientras están pendientes.
- El catálogo actual también se lee desde Firestore mediante `js/auth.js`: con `allow read: if true` el cliente puede recuperar los campos privados de productos. Mover esos campos a colección privada antes de producción.
- No se probó una pasarela bancaria ni webhook; no se deben solicitar números reales de tarjeta/CVV.
