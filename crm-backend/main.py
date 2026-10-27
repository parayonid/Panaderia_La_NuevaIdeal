from fastapi import FastAPI, HTTPException, Header, Depends, Security
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
import firebase_admin
import os
import json
from firebase_admin import credentials, firestore, auth
from datetime import datetime

os.environ["GRPC_DNS_RESOLVER"] = "native"

firebase_key_json = os.environ.get("FIREBASE_CREDENTIALS_JSON")
if firebase_key_json:
    cred_dict = json.loads(firebase_key_json)
    cred = credentials.Certificate(cred_dict)
else:
    ruta_llave = "serviceAccountKey.json"
    if not os.path.exists(ruta_llave):
        ruta_llave = "../serviceAccountKey.json"
    cred = credentials.Certificate(ruta_llave)

firebase_admin.initialize_app(cred)
db = firestore.client()

app = FastAPI(title="API CRM y SCM La Nueva Ideal")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://weblanuevaideal.web.app", "http://127.0.0.1:5500", "http://localhost:5500"],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["*"],
)

class Cliente(BaseModel):
    nombre: str; correo: str; telefono: str; empresa: str; estado: str = "activo"
class Interaccion(BaseModel):
    cliente_id: str; tipo: str; descripcion: str; usuario_id: str
class Proveedor(BaseModel):
    nombre: str; contacto: str; correo: str; telefono: str
class Producto(BaseModel):
    nombre: str; descripcion: str = ""; categoria: str; stock_actual: int; stock_minimo: int; proveedor_id: str; costo_unitario: float; estrategia_logistica: str = "PULL"; imagen: Optional[str] = None; precio: Optional[float] = None
class Movimiento(BaseModel):
    producto_id: str; tipo: str; cantidad: int; motivo: str; usuario_id: str
    
class OrdenCompra(BaseModel):
    producto_id: str
    proveedor_id: str
    cantidad: int

security = HTTPBearer()

def permitir_roles(*roles_permitidos):
    async def comprobar(credenciales: HTTPAuthorizationCredentials = Security(security)):
        try:
            usuario_jwt = auth.verify_id_token(credenciales.credentials)
        except Exception:
            raise HTTPException(status_code=401, detail="Token de Firebase inválido o vencido")
        uid = usuario_jwt.get("uid")
        usuario_doc = db.collection("usuarios").document(uid).get()
        if not usuario_doc.exists or usuario_doc.to_dict().get("rol") not in roles_permitidos:
            raise HTTPException(status_code=403, detail="No tienes permisos para esta operación")
        return usuario_jwt
    return comprobar

verificar_token_admin = permitir_roles("admin")
verificar_token_crm = permitir_roles("admin", "ventas")
verificar_token_scm = permitir_roles("admin", "logistica")
verificar_token_erp_escritura = permitir_roles("admin", "ventas")
verificar_token_erp_lectura = permitir_roles("admin", "ventas", "logistica")

@app.get("/")
def raiz(): return {"mensaje": "API de La Nueva Ideal funcionando al 100%"}

@app.post("/clientes", status_code=201, dependencies=[Depends(verificar_token_crm)])
async def crear_cliente(cliente: Cliente):
    nuevo = cliente.model_dump(); nuevo["fecha_registro"] = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    doc_ref = db.collection("clientes").document(); doc_ref.set(nuevo); return {"id": doc_ref.id}
@app.get("/clientes")
def obtener_clientes(): return [{"id": doc.id, **doc.to_dict()} for doc in db.collection("clientes").get()]
@app.get("/clientes/{id}")
async def obtener_cliente(id: str):
    doc_ref = db.collection("clientes").document(id).get()
    if not doc_ref.exists: raise HTTPException(status_code=404)
    return {"id": id, **doc_ref.to_dict()}
@app.put("/clientes/{id}", dependencies=[Depends(verificar_token_crm)])
async def actualizar_cliente(id: str, cliente: Cliente): db.collection("clientes").document(id).update(cliente.model_dump()); return {"mensaje": "Ok"}
@app.delete("/clientes/{id}", dependencies=[Depends(verificar_token_crm)])
async def eliminar_cliente(id: str): db.collection("clientes").document(id).update({"estado": "inactivo"}); return {"mensaje": "Ok"}

@app.get("/interacciones")
def obtener_interacciones(): return [{"id": doc.id, **doc.to_dict()} for doc in db.collection("interacciones").get()]
@app.post("/interacciones", status_code=201, dependencies=[Depends(verificar_token_crm)])
async def crear_interaccion(interaccion: Interaccion):
    nueva = interaccion.model_dump(); nueva["fecha"] = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    db.collection("interacciones").add(nueva); return {"mensaje": "Ok"}
@app.get("/clientes/{cliente_id}/interacciones")
def obtener_interacciones_cliente(cliente_id: str): return [{"id": doc.id, **doc.to_dict()} for doc in db.collection("interacciones").where("cliente_id", "==", cliente_id).get()]

@app.post("/proveedores", status_code=201, dependencies=[Depends(verificar_token_scm)])
async def crear_proveedor(proveedor: Proveedor): doc_ref = db.collection("proveedores").document(); doc_ref.set(proveedor.model_dump()); return {"id": doc_ref.id}
@app.get("/proveedores")
def obtener_proveedores(): return [{"id": doc.id, **doc.to_dict()} for doc in db.collection("proveedores").get()]
@app.put("/proveedores/{id}", dependencies=[Depends(verificar_token_scm)])
async def actualizar_proveedor(id: str, proveedor: Proveedor):
    doc_ref = db.collection("proveedores").document(id)
    if not doc_ref.get().exists:
        raise HTTPException(status_code=404, detail="Proveedor no encontrado")
    doc_ref.update(proveedor.model_dump())
    return {"mensaje": "Proveedor actualizado"}

@app.delete("/proveedores/{id}", dependencies=[Depends(verificar_token_scm)])
async def eliminar_proveedor(id: str):
    db.collection("proveedores").document(id).delete()
    return {"mensaje": "Proveedor eliminado"}

@app.post("/productos", status_code=201, dependencies=[Depends(verificar_token_scm)])
async def crear_producto(producto: Producto): doc_ref = db.collection("productos").document(); doc_ref.set(producto.model_dump()); return {"id": doc_ref.id}
@app.get("/productos")
def obtener_productos(): return [{"id": doc.id, **doc.to_dict()} for doc in db.collection("productos").get()]
@app.put("/productos/{id}", dependencies=[Depends(verificar_token_scm)])
async def actualizar_producto(id: str, producto: Producto): db.collection("productos").document(id).update(producto.model_dump()); return {"mensaje": "Ok"}
@app.delete("/productos/{id}", dependencies=[Depends(verificar_token_scm)])
async def eliminar_producto(id: str): db.collection("productos").document(id).delete(); return {"mensaje": "Ok"}

@app.get("/movimientos")
def obtener_movimientos():
    return [{"id": doc.id, **doc.to_dict()} for doc in db.collection("movimientos").order_by("fecha", direction=firestore.Query.DESCENDING).limit(50).get()]

@app.post("/movimientos", status_code=201, dependencies=[Depends(verificar_token_scm)])
async def registrar_movimiento(mov: Movimiento):
    if mov.tipo not in ('Entrada', 'Salida') or mov.cantidad <= 0:
        raise HTTPException(status_code=400, detail='El movimiento debe ser Entrada o Salida con cantidad positiva.')
    prod_ref = db.collection('productos').document(mov.producto_id)
    transaccion = db.transaction()

    @google_firestore.transactional
    def aplicar(transaction):
        snap = transaction.get(prod_ref)
        if not snap.exists:
            raise HTTPException(status_code=404, detail='Producto no encontrado')
        data = snap.to_dict()
        stock = int(data.get('stock_actual', data.get('cantidad', 0)))
        if mov.tipo == 'Salida' and mov.cantidad > stock:
            raise HTTPException(status_code=409, detail=f'Stock insuficiente. Solo tienes {stock} piezas.')
        nuevo_stock = stock + mov.cantidad if mov.tipo == 'Entrada' else stock - mov.cantidad
        es_push = (mov.tipo == 'Salida' and nuevo_stock <= int(data.get('stock_minimo', 0))
                   and data.get('estrategia_logistica', 'PULL') == 'PUSH')
        tiene_pendiente = False
        if es_push:
            consulta = (db.collection('ordenes_compra').where('producto_id', '==', mov.producto_id)
                        .where('estado', '==', 'Pendiente').limit(1))
            tiene_pendiente = bool(list(transaction.get(consulta)))
        momento = datetime.now(timezone.utc).isoformat()
        transaction.update(prod_ref, {'stock_actual': nuevo_stock})
        transaction.set(db.collection('movimientos').document(), {
            **mov.model_dump(), 'fecha': momento, 'stock_resultante': nuevo_stock
        })
        if es_push and not tiene_pendiente:
            transaction.set(db.collection('ordenes_compra').document(), {
                'producto_id': mov.producto_id, 'proveedor_id': data.get('proveedor_id', ''),
                'cantidad': max(int(data.get('stock_minimo', 0)) * 2, 10),
                'estado': 'Pendiente', 'fecha': momento, 'tipo': 'Automática (PUSH)'
            })
        return {'mensaje': 'Movimiento registrado.', 'stock_resultante': nuevo_stock}

    return aplicar(transaccion)


@app.post("/ordenes_compra", status_code=201, dependencies=[Depends(verificar_token_scm)])
async def crear_orden_manual(orden: OrdenCompra):
    if orden.cantidad <= 0:
        raise HTTPException(status_code=400, detail='La cantidad debe ser mayor que cero')
    transaction = db.transaction()

    @google_firestore.transactional
    def registrar(transaction):
        producto = transaction.get(db.collection('productos').document(orden.producto_id))
        if not producto.exists:
            raise HTTPException(status_code=404, detail='Producto no encontrado')
        consulta = (db.collection('ordenes_compra').where('producto_id', '==', orden.producto_id)
                    .where('estado', '==', 'Pendiente').limit(1))
        if list(transaction.get(consulta)):
            raise HTTPException(status_code=409, detail='Ya existe una orden pendiente para este producto.')
        transaction.set(db.collection('ordenes_compra').document(), {
            **orden.model_dump(), 'estado':'Pendiente',
            'fecha': datetime.now(timezone.utc).isoformat(), 'tipo': 'Manual (PULL)'
        })
        return {'mensaje': 'Orden manual generada'}

    return registrar(transaction)


@app.get("/ordenes_compra")
def obtener_ordenes_compra():
    return [{"id": d.id, **d.to_dict()} for d in db.collection('ordenes_compra')
            .order_by('fecha', direction=firestore.Query.DESCENDING).stream()]


@app.put("/ordenes_compra/{id}/estado", dependencies=[Depends(verificar_token_scm)])
async def actualizar_orden_compra(id: str, data: dict):
    if data.get('estado') != 'Aprobada':
        raise HTTPException(status_code=400, detail='Esta acción solo permite aprobar órdenes de compra.')
    orden_ref = db.collection('ordenes_compra').document(id)
    transaccion = db.transaction()

    @google_firestore.transactional
    def aprobar(transaction):
        orden_snap = transaction.get(orden_ref)
        if not orden_snap.exists:
            raise HTTPException(status_code=404, detail='Orden no encontrada')
        orden = orden_snap.to_dict()
        if orden.get('estado') != 'Pendiente':
            return {'mensaje': 'La orden ya fue procesada.', 'estado': orden.get('estado')}
        prod_ref = db.collection('productos').document(orden['producto_id'])
        prod_snap = transaction.get(prod_ref)
        if not prod_snap.exists:
            raise HTTPException(status_code=404, detail='No existe el producto de la orden')
        producto = prod_snap.to_dict()
        cantidad = int(orden.get('cantidad', 0))
        if cantidad <= 0:
            raise HTTPException(status_code=400, detail='La orden no contiene una cantidad válida')
        nuevo_stock = int(producto.get('stock_actual', producto.get('cantidad', 0))) + cantidad
        momento = datetime.now(timezone.utc).isoformat()
        transaction.update(prod_ref, {'stock_actual': nuevo_stock})
        transaction.set(db.collection('movimientos').document(), {
            'producto_id': orden['producto_id'], 'tipo': 'Entrada', 'cantidad': cantidad,
            'motivo': f'Reabastecimiento SCM ({orden.get("tipo", "Compra")})',
            'usuario_id': 'Sistema SCM', 'fecha': momento, 'stock_resultante': nuevo_stock
        })
        transaction.update(orden_ref, {'estado':'Completada'})
        return {'mensaje':'Orden aprobada e inventario actualizado', 'estado':'Completada'}

    return aprobar(transaccion)


# =============================================================
# ERP: ÓRDENES DE CLIENTES Y SINCRONIZACIÓN CRM + SCM
# =============================================================
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP
from datetime import timezone
from pydantic import Field
from google.cloud import firestore as google_firestore

class ItemOrdenCliente(BaseModel):
    producto_id: str = Field(min_length=1, max_length=150)
    cantidad: int = Field(ge=1, le=10000)

class OrdenClienteNueva(BaseModel):
    cliente_id: str = Field(min_length=1, max_length=150)
    items: list[ItemOrdenCliente] = Field(min_length=1, max_length=40)
    # Permite reintentar la misma petición sin descontar inventario dos veces.
    solicitud_id: Optional[str] = Field(default=None, min_length=8, max_length=80, pattern=r"^[A-Za-z0-9_-]+$")


def dinero_erp(valor):
    """Obtiene importes positivos desde el catálogo, no desde el navegador."""
    try:
        numero = Decimal(str(valor))
        if not numero.is_finite() or numero < 0:
            raise ValueError()
        return numero.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
    except (ValueError, TypeError, InvalidOperation):
        raise HTTPException(status_code=400, detail='Un producto tiene un precio de venta inválido.')


@app.get('/ordenes_clientes', dependencies=[Depends(verificar_token_erp_lectura)])
def listar_ordenes_clientes():
    documentos = db.collection('ordenes_clientes').order_by(
        'fecha', direction=firestore.Query.DESCENDING
    ).stream()
    return [{'id': d.id, **d.to_dict()} for d in documentos]


@app.get('/ordenes_clientes/{orden_id}', dependencies=[Depends(verificar_token_erp_lectura)])
def detalle_orden_cliente(orden_id: str):
    documento = db.collection('ordenes_clientes').document(orden_id).get()
    if not documento.exists:
        raise HTTPException(status_code=404, detail='Orden de cliente no encontrada')
    return {'id': documento.id, **documento.to_dict()}


@app.post('/ordenes_clientes', status_code=201)
def crear_orden_cliente(
    payload: OrdenClienteNueva,
    usuario=Depends(verificar_token_erp_escritura)
):
    cantidades = {}
    for renglon in payload.items:
        cantidades[renglon.producto_id] = cantidades.get(renglon.producto_id, 0) + renglon.cantidad
        if cantidades[renglon.producto_id] > 10000:
            raise HTTPException(status_code=400, detail='Cantidad máxima por producto: 10000')

    orden_ref = db.collection('ordenes_clientes').document(payload.solicitud_id) if payload.solicitud_id else db.collection('ordenes_clientes').document()
    cliente_ref = db.collection('clientes').document(payload.cliente_id)
    producto_refs = [(prod_id, db.collection('productos').document(prod_id)) for prod_id in sorted(cantidades)]
    contador_ref = db.collection('config_erp').document('contador_ordenes_clientes')
    tx = db.transaction()

    @google_firestore.transactional
    def registrar(transaction):
        # Importante: todas las lecturas ocurren ANTES de cualquier escritura.
        anterior = transaction.get(orden_ref)
        if anterior.exists:
            return {'id': anterior.id, **anterior.to_dict()}

        cliente_snap = transaction.get(cliente_ref)
        if not cliente_snap.exists:
            raise HTTPException(status_code=404, detail='El cliente seleccionado no existe.')
        cliente = cliente_snap.to_dict()
        if str(cliente.get('estado', 'activo')).lower() == 'inactivo':
            raise HTTPException(status_code=400, detail='No puedes crear órdenes para un cliente inactivo.')

        productos = []
        for prod_id, referencia in producto_refs:
            snap = transaction.get(referencia)
            if not snap.exists:
                raise HTTPException(status_code=404, detail=f'Producto {prod_id} no encontrado.')
            producto = snap.to_dict()
            cantidad = cantidades[prod_id]
            stock = int(producto.get('stock_actual', producto.get('cantidad', 0)))
            if cantidad > stock:
                raise HTTPException(
                    status_code=409,
                    detail=f'Stock insuficiente para {producto.get("nombre", prod_id)}: quedan {stock} piezas.'
                )
            precio = dinero_erp(producto.get('precio'))
            productos.append((prod_id, referencia, producto, cantidad, stock, precio))

        contador = transaction.get(contador_ref)
        siguiente = int(contador.to_dict().get('consecutivo', 0)) + 1 if contador.exists else 1

        # Consultar órdenes PUSH pendientes dentro de la misma transacción.
        pendientes = {}
        for prod_id, _, producto, cantidad, stock, _ in productos:
            stock_nuevo = stock - cantidad
            if stock_nuevo <= int(producto.get('stock_minimo', 0)) and producto.get('estrategia_logistica') == 'PUSH':
                consulta = (db.collection('ordenes_compra')
                            .where('producto_id', '==', prod_id)
                            .where('estado', '==', 'Pendiente').limit(1))
                pendientes[prod_id] = bool(list(transaction.get(consulta)))

        momento = datetime.now(timezone.utc).isoformat()
        folio = f'OV-{siguiente:06d}'
        items_detalle = []
        total = Decimal('0.00')
        for prod_id, referencia, producto, cantidad, stock, precio in productos:
            subtotal = precio * cantidad
            total += subtotal
            stock_nuevo = stock - cantidad
            items_detalle.append({
                'producto_id': prod_id, 'nombre': producto.get('nombre', 'Producto'),
                'cantidad': cantidad, 'precio_unitario': float(precio), 'subtotal': float(subtotal)
            })
            transaction.update(referencia, {'stock_actual': stock_nuevo})
            movimiento_ref = db.collection('movimientos').document()
            transaction.set(movimiento_ref, {
                'producto_id': prod_id, 'tipo': 'Salida', 'cantidad': cantidad,
                'motivo': f'Venta ERP {folio}', 'usuario_id': usuario.get('email', usuario.get('uid', 'ERP')),
                'orden_cliente_id': orden_ref.id, 'fecha': momento, 'stock_resultante': stock_nuevo
            })
            if prod_id in pendientes and not pendientes[prod_id]:
                compra_ref = db.collection('ordenes_compra').document()
                transaction.set(compra_ref, {
                    'producto_id': prod_id, 'proveedor_id': producto.get('proveedor_id', ''),
                    'cantidad': max(int(producto.get('stock_minimo', 0)) * 2, 10),
                    'estado': 'Pendiente', 'fecha': momento, 'tipo': 'Automática (PUSH)'
                })

        orden = {
            'folio': folio, 'fecha': momento, 'estado': 'Procesada',
            'cliente_id': payload.cliente_id, 'cliente_nombre': cliente.get('nombre', 'Cliente'),
            'cliente_correo': cliente.get('correo', ''), 'items': items_detalle,
            'subtotal': float(total), 'total': float(total),
            'usuario_id': usuario.get('email', usuario.get('uid', 'ERP'))
        }
        transaction.set(orden_ref, orden)
        transaction.set(contador_ref, {'consecutivo': siguiente})
        return {'id': orden_ref.id, **orden}

    return registrar(tx)
