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

# 1. Inicializar Firebase Admin
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

# 2. Configurar CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://weblanuevaideal.web.app", "http://127.0.0.1:5500", "http://localhost:5500"],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["*"],
)

# ==========================================
# MODELOS PYDANTIC (CRM + SCM)
# ==========================================
class Cliente(BaseModel):
    nombre: str
    correo: str
    telefono: str
    empresa: str
    estado: str = "activo"

class Interaccion(BaseModel):
    cliente_id: str
    tipo: str
    descripcion: str
    usuario_id: str

class Proveedor(BaseModel):
    nombre: str
    contacto: str
    correo: str
    telefono: str

class Producto(BaseModel):
    nombre: str
    descripcion: str = ""
    categoria: str
    stock_actual: int
    stock_minimo: int
    proveedor_id: str
    costo_unitario: float
    estrategia_logistica: str = "PULL" # PUSH o PULL
    imagen: Optional[str] = None
    precio: Optional[float] = None

class Movimiento(BaseModel):
    producto_id: str
    tipo: str 
    cantidad: int
    motivo: str
    usuario_id: str
    
# ==========================================
# VALIDACIONES: SEGURIDAD
# ==========================================
security = HTTPBearer()

async def verificar_token_admin(credenciales: HTTPAuthorizationCredentials = Security(security)):
    token = credenciales.credentials
    try:
        usuario_jwt = auth.verify_id_token(token)
        uid = usuario_jwt.get("uid")
        
        user_doc = db.collection("usuarios").document(uid).get()
        if not user_doc.exists or user_doc.to_dict().get("rol") != "admin":
            raise HTTPException(status_code=403, detail="Acceso denegado: Privilegios insuficientes")
            
        return usuario_jwt
    except Exception as e:
        raise HTTPException(status_code=401, detail="Token inválido o expirado")

# ==========================================
# ENDPOINTS: CLIENTES Y CRM
# ==========================================
@app.get("/")
def raiz():
    return {"mensaje": "API de La Nueva Ideal funcionando al 100%"}

@app.post("/clientes", status_code=201, dependencies=[Depends(verificar_token_admin)])
async def crear_cliente(cliente: Cliente):
    nuevo_cliente = cliente.model_dump()
    nuevo_cliente["fecha_registro"] = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    doc_ref = db.collection("clientes").document()
    doc_ref.set(nuevo_cliente)
    return {"id": doc_ref.id, "mensaje": "Cliente creado exitosamente"}

@app.get("/clientes")
def obtener_clientes():
    try:
        docs = db.collection("clientes").limit(20).get()
        clientes = []
        for doc in docs:
            datos = doc.to_dict()
            datos["id"] = doc.id
            clientes.append(datos)
        return clientes
    except Exception as e:
        return {"error_firebase": str(e)}

@app.get("/clientes/{id}")
async def obtener_cliente(id: str):
    doc_ref = db.collection("clientes").document(id).get()
    if not doc_ref.exists:
        raise HTTPException(status_code=404, detail="Cliente no encontrado")
    datos = doc_ref.to_dict()
    datos["id"] = id
    return datos

@app.put("/clientes/{id}", dependencies=[Depends(verificar_token_admin)])
async def actualizar_cliente(id: str, cliente: Cliente):
    doc_ref = db.collection("clientes").document(id)
    if not doc_ref.get().exists:
        raise HTTPException(status_code=404, detail="Cliente no encontrado")
    doc_ref.update(cliente.model_dump())
    return {"mensaje": "Cliente actualizado exitosamente"}

@app.delete("/clientes/{id}", dependencies=[Depends(verificar_token_admin)])
async def eliminar_cliente(id: str):
    doc_ref = db.collection("clientes").document(id)
    if not doc_ref.get().exists:
        raise HTTPException(status_code=404, detail="Cliente no encontrado")
    doc_ref.update({"estado": "inactivo"})
    return {"mensaje": "Cliente marcado como inactivo"}

# ==========================================
# ENDPOINTS: INTERACCIONES
# ==========================================
@app.get("/interacciones")
def obtener_interacciones():
    try:
        docs = db.collection("interacciones").limit(20).get()
        interacciones = []
        for doc in docs:
            datos = doc.to_dict()
            datos["id"] = doc.id
            interacciones.append(datos)
        return interacciones
    except Exception as e:
        return {"error_firebase": str(e)}

@app.post("/interacciones", status_code=201, dependencies=[Depends(verificar_token_admin)])
async def crear_interaccion(interaccion: Interaccion):
    nueva_int = interaccion.model_dump()
    nueva_int["fecha"] = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    doc_ref = db.collection("interacciones").document()
    doc_ref.set(nueva_int)
    return {"id": doc_ref.id, "mensaje": "Interacción registrada"}

@app.get("/clientes/{cliente_id}/interacciones")
def obtener_interacciones_por_cliente(cliente_id: str):
    try:
        docs = db.collection("interacciones").where("cliente_id", "==", cliente_id).get()
        interacciones = []
        for doc in docs:
            datos = doc.to_dict()
            datos["id"] = doc.id
            interacciones.append(datos)
        return interacciones
    except Exception as e:
        return {"error_firebase": str(e)}

# ==========================================
# ENDPOINTS: SCM - PROVEEDORES
# ==========================================
@app.post("/proveedores", status_code=201, dependencies=[Depends(verificar_token_admin)])
async def crear_proveedor(proveedor: Proveedor):
    nuevo_proveedor = proveedor.model_dump()
    doc_ref = db.collection("proveedores").document()
    doc_ref.set(nuevo_proveedor)
    return {"id": doc_ref.id, "mensaje": "Proveedor registrado exitosamente"}

@app.get("/proveedores")
def obtener_proveedores():
    try:
        docs = db.collection("proveedores").get()
        return [{"id": doc.id, **doc.to_dict()} for doc in docs]
    except Exception as e:
        return {"error_firebase": str(e)}

# ==========================================
# ENDPOINTS: SCM - PRODUCTOS (Almacén)
# ==========================================
@app.post("/productos", status_code=201, dependencies=[Depends(verificar_token_admin)])
async def crear_producto(producto: Producto):
    nuevo_producto = producto.model_dump()
    doc_ref = db.collection("productos").document()
    doc_ref.set(nuevo_producto)
    return {"id": doc_ref.id, "mensaje": "Producto registrado en el almacén"}

@app.get("/productos")
def obtener_productos():
    try:
        docs = db.collection("productos").get()
        return [{"id": doc.id, **doc.to_dict()} for doc in docs]
    except Exception as e:
        return {"error_firebase": str(e)}

@app.put("/productos/{id}", dependencies=[Depends(verificar_token_admin)])
async def actualizar_producto(id: str, producto: Producto):
    doc_ref = db.collection("productos").document(id)
    if not doc_ref.get().exists:
        raise HTTPException(status_code=404, detail="Producto no encontrado en almacén")
    doc_ref.update(producto.model_dump())
    return {"mensaje": "Ficha de producto actualizada"}

@app.delete("/productos/{id}", dependencies=[Depends(verificar_token_admin)])
async def eliminar_producto(id: str):
    doc_ref = db.collection("productos").document(id)
    if not doc_ref.get().exists:
        raise HTTPException(status_code=404, detail="Producto no encontrado")
    doc_ref.delete()
    return {"mensaje": "Producto eliminado del sistema SCM"}

# ==========================================
# ENDPOINTS: SCM - KARDEX (MOVIMIENTOS)
# ==========================================
@app.get("/movimientos")
def obtener_movimientos():
    try:
        docs = db.collection("movimientos").order_by("fecha", direction=firestore.Query.DESCENDING).limit(50).get()
        return [{"id": doc.id, **doc.to_dict()} for doc in docs]
    except Exception as e:
        return {"error_firebase": str(e)}

@app.post("/movimientos", status_code=201, dependencies=[Depends(verificar_token_admin)])
async def registrar_movimiento(mov: Movimiento):
    prod_ref = db.collection("productos").document(mov.producto_id)
    prod_doc = prod_ref.get()
    
    if not prod_doc.exists:
        raise HTTPException(status_code=404, detail="Producto no encontrado")
    
    prod_data = prod_doc.to_dict()
    # Compatibilidad con datos viejos
    stock_actual = prod_data.get("stock_actual", prod_data.get("cantidad", 0))
    
    if mov.tipo == "Entrada":
        nuevo_stock = stock_actual + mov.cantidad
    else:
        nuevo_stock = stock_actual - mov.cantidad
        
    if nuevo_stock < 0: 
        nuevo_stock = 0
        
    prod_ref.update({"stock_actual": nuevo_stock})
    
    nuevo_mov = mov.model_dump()
    nuevo_mov["fecha"] = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    nuevo_mov["stock_resultante"] = nuevo_stock
    db.collection("movimientos").add(nuevo_mov)
    
    return {"mensaje": "Movimiento registrado y stock actualizado"}