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
    estrategia_logistica: str = "PULL"
    imagen: Optional[str] = None
    precio: Optional[float] = None

class Movimiento(BaseModel):
    producto_id: str
    tipo: str 
    cantidad: int
    motivo: str
    usuario_id: str

security = HTTPBearer()

async def verificar_token_admin(credenciales: HTTPAuthorizationCredentials = Security(security)):
    token = credenciales.credentials
    try:
        usuario_jwt = auth.verify_id_token(token)
        uid = usuario_jwt.get("uid")
        user_doc = db.collection("usuarios").document(uid).get()
        if not user_doc.exists or user_doc.to_dict().get("rol") != "admin":
            raise HTTPException(status_code=403, detail="Privilegios insuficientes")
        return usuario_jwt
    except Exception:
        raise HTTPException(status_code=401, detail="Token inválido")

@app.get("/")
def raiz(): return {"mensaje": "API de La Nueva Ideal funcionando al 100%"}

# --- CLIENTES Y CRM ---
@app.post("/clientes", status_code=201, dependencies=[Depends(verificar_token_admin)])
async def crear_cliente(cliente: Cliente):
    nuevo = cliente.model_dump()
    nuevo["fecha_registro"] = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    doc_ref = db.collection("clientes").document()
    doc_ref.set(nuevo)
    return {"id": doc_ref.id}

@app.get("/clientes")
def obtener_clientes():
    return [{"id": doc.id, **doc.to_dict()} for doc in db.collection("clientes").get()]

@app.get("/clientes/{id}")
async def obtener_cliente(id: str):
    doc_ref = db.collection("clientes").document(id).get()
    if not doc_ref.exists: raise HTTPException(status_code=404)
    return {"id": id, **doc_ref.to_dict()}

@app.put("/clientes/{id}", dependencies=[Depends(verificar_token_admin)])
async def actualizar_cliente(id: str, cliente: Cliente):
    db.collection("clientes").document(id).update(cliente.model_dump())
    return {"mensaje": "Actualizado"}

@app.delete("/clientes/{id}", dependencies=[Depends(verificar_token_admin)])
async def eliminar_cliente(id: str):
    db.collection("clientes").document(id).update({"estado": "inactivo"})
    return {"mensaje": "Eliminado"}

@app.get("/interacciones")
def obtener_interacciones():
    return [{"id": doc.id, **doc.to_dict()} for doc in db.collection("interacciones").get()]

@app.post("/interacciones", status_code=201, dependencies=[Depends(verificar_token_admin)])
async def crear_interaccion(interaccion: Interaccion):
    nueva = interaccion.model_dump()
    nueva["fecha"] = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    db.collection("interacciones").add(nueva)
    return {"mensaje": "Registrada"}

@app.get("/clientes/{cliente_id}/interacciones")
def obtener_interacciones_cliente(cliente_id: str):
    docs = db.collection("interacciones").where("cliente_id", "==", cliente_id).get()
    return [{"id": doc.id, **doc.to_dict()} for doc in docs]

# --- SCM: PROVEEDORES ---
@app.post("/proveedores", status_code=201, dependencies=[Depends(verificar_token_admin)])
async def crear_proveedor(proveedor: Proveedor):
    doc_ref = db.collection("proveedores").document()
    doc_ref.set(proveedor.model_dump())
    return {"id": doc_ref.id}

@app.get("/proveedores")
def obtener_proveedores():
    return [{"id": doc.id, **doc.to_dict()} for doc in db.collection("proveedores").get()]

# --- SCM: PRODUCTOS ---
@app.post("/productos", status_code=201, dependencies=[Depends(verificar_token_admin)])
async def crear_producto(producto: Producto):
    doc_ref = db.collection("productos").document()
    doc_ref.set(producto.model_dump())
    return {"id": doc_ref.id}

@app.get("/productos")
def obtener_productos():
    return [{"id": doc.id, **doc.to_dict()} for doc in db.collection("productos").get()]

@app.put("/productos/{id}", dependencies=[Depends(verificar_token_admin)])
async def actualizar_producto(id: str, producto: Producto):
    db.collection("productos").document(id).update(producto.model_dump())
    return {"mensaje": "Actualizado"}

@app.delete("/productos/{id}", dependencies=[Depends(verificar_token_admin)])
async def eliminar_producto(id: str):
    db.collection("productos").document(id).delete()
    return {"mensaje": "Eliminado"}

# --- SCM: KARDEX (MOVIMIENTOS) ---
@app.get("/movimientos")
def obtener_movimientos():
    docs = db.collection("movimientos").order_by("fecha", direction=firestore.Query.DESCENDING).limit(50).get()
    return [{"id": doc.id, **doc.to_dict()} for doc in docs]

@app.post("/movimientos", status_code=201, dependencies=[Depends(verificar_token_admin)])
async def registrar_movimiento(mov: Movimiento):
    prod_ref = db.collection("productos").document(mov.producto_id)
    prod_doc = prod_ref.get()
    if not prod_doc.exists:
        raise HTTPException(status_code=404, detail="Producto no encontrado")
    
    prod_data = prod_doc.to_dict()
    stock_actual = prod_data.get("stock_actual", 0)
    
    nuevo_stock = stock_actual + mov.cantidad if mov.tipo == "Entrada" else stock_actual - mov.cantidad
    if nuevo_stock < 0: nuevo_stock = 0
        
    prod_ref.update({"stock_actual": nuevo_stock})
    
    nuevo_mov = mov.model_dump()
    nuevo_mov["fecha"] = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    nuevo_mov["stock_resultante"] = nuevo_stock
    db.collection("movimientos").add(nuevo_mov)
    
    return {"mensaje": "Movimiento registrado y stock actualizado"}