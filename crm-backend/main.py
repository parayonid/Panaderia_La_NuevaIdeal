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

security = HTTPBearer()
async def verificar_token_admin(credenciales: HTTPAuthorizationCredentials = Security(security)):
    token = credenciales.credentials
    try:
        usuario_jwt = auth.verify_id_token(token)
        uid = usuario_jwt.get("uid")
        user_doc = db.collection("usuarios").document(uid).get()
        if not user_doc.exists or user_doc.to_dict().get("rol") != "admin": raise HTTPException(status_code=403)
        return usuario_jwt
    except Exception: raise HTTPException(status_code=401)

@app.get("/")
def raiz(): return {"mensaje": "API de La Nueva Ideal funcionando al 100%"}

@app.post("/clientes", status_code=201, dependencies=[Depends(verificar_token_admin)])
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
@app.put("/clientes/{id}", dependencies=[Depends(verificar_token_admin)])
async def actualizar_cliente(id: str, cliente: Cliente): db.collection("clientes").document(id).update(cliente.model_dump()); return {"mensaje": "Ok"}
@app.delete("/clientes/{id}", dependencies=[Depends(verificar_token_admin)])
async def eliminar_cliente(id: str): db.collection("clientes").document(id).update({"estado": "inactivo"}); return {"mensaje": "Ok"}

@app.get("/interacciones")
def obtener_interacciones(): return [{"id": doc.id, **doc.to_dict()} for doc in db.collection("interacciones").get()]
@app.post("/interacciones", status_code=201, dependencies=[Depends(verificar_token_admin)])
async def crear_interaccion(interaccion: Interaccion):
    nueva = interaccion.model_dump(); nueva["fecha"] = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    db.collection("interacciones").add(nueva); return {"mensaje": "Ok"}
@app.get("/clientes/{cliente_id}/interacciones")
def obtener_interacciones_cliente(cliente_id: str): return [{"id": doc.id, **doc.to_dict()} for doc in db.collection("interacciones").where("cliente_id", "==", cliente_id).get()]

@app.post("/proveedores", status_code=201, dependencies=[Depends(verificar_token_admin)])
async def crear_proveedor(proveedor: Proveedor): doc_ref = db.collection("proveedores").document(); doc_ref.set(proveedor.model_dump()); return {"id": doc_ref.id}
@app.get("/proveedores")
def obtener_proveedores(): return [{"id": doc.id, **doc.to_dict()} for doc in db.collection("proveedores").get()]
@app.put("/proveedores/{id}", dependencies=[Depends(verificar_token_admin)])
async def actualizar_proveedor(id: str, proveedor: Proveedor):
    doc_ref = db.collection("proveedores").document(id)
    if not doc_ref.get().exists:
        raise HTTPException(status_code=404, detail="Proveedor no encontrado")
    doc_ref.update(proveedor.model_dump())
    return {"mensaje": "Proveedor actualizado"}

@app.delete("/proveedores/{id}", dependencies=[Depends(verificar_token_admin)])
async def eliminar_proveedor(id: str):
    db.collection("proveedores").document(id).delete()
    return {"mensaje": "Proveedor eliminado"}

@app.post("/productos", status_code=201, dependencies=[Depends(verificar_token_admin)])
async def crear_producto(producto: Producto): doc_ref = db.collection("productos").document(); doc_ref.set(producto.model_dump()); return {"id": doc_ref.id}
@app.get("/productos")
def obtener_productos(): return [{"id": doc.id, **doc.to_dict()} for doc in db.collection("productos").get()]
@app.put("/productos/{id}", dependencies=[Depends(verificar_token_admin)])
async def actualizar_producto(id: str, producto: Producto): db.collection("productos").document(id).update(producto.model_dump()); return {"mensaje": "Ok"}
@app.delete("/productos/{id}", dependencies=[Depends(verificar_token_admin)])
async def eliminar_producto(id: str): db.collection("productos").document(id).delete(); return {"mensaje": "Ok"}

@app.get("/movimientos")
def obtener_movimientos():
    return [{"id": doc.id, **doc.to_dict()} for doc in db.collection("movimientos").order_by("fecha", direction=firestore.Query.DESCENDING).limit(50).get()]

@app.post("/movimientos", status_code=201, dependencies=[Depends(verificar_token_admin)])
async def registrar_movimiento(mov: Movimiento):
    prod_ref = db.collection("productos").document(mov.producto_id)
    prod_doc = prod_ref.get()
    if not prod_doc.exists: raise HTTPException(status_code=404, detail="Producto no encontrado")
    
    prod_data = prod_doc.to_dict()
    stock_actual = prod_data.get("stock_actual", prod_data.get("cantidad", 0))
    stock_minimo = prod_data.get("stock_minimo", 0)
    estrategia = prod_data.get("estrategia_logistica", "PULL")
    
    nuevo_stock = stock_actual + mov.cantidad if mov.tipo == "Entrada" else stock_actual - mov.cantidad
    if nuevo_stock < 0: nuevo_stock = 0
    prod_ref.update({"stock_actual": nuevo_stock})
    
    nuevo_mov = mov.model_dump()
    nuevo_mov["fecha"] = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    nuevo_mov["stock_resultante"] = nuevo_stock
    db.collection("movimientos").add(nuevo_mov)

    # LÓGICA PUSH AUTOMÁTICA
    if mov.tipo == "Salida" and nuevo_stock <= stock_minimo and estrategia == "PUSH":
        pendientes = db.collection("ordenes_compra").where("producto_id", "==", mov.producto_id).where("estado", "==", "Pendiente").get()
        if not pendientes:
            cant_sugerida = max(stock_minimo * 2, 10) 
            db.collection("ordenes_compra").add({
                "producto_id": mov.producto_id, "proveedor_id": prod_data.get("proveedor_id", ""),
                "cantidad": cant_sugerida, "estado": "Pendiente", "fecha": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            })
            
    return {"mensaje": "Movimiento registrado."}

@app.get("/ordenes_compra")
def obtener_ordenes_compra():
    return [{"id": doc.id, **doc.to_dict()} for doc in db.collection("ordenes_compra").order_by("fecha", direction=firestore.Query.DESCENDING).get()]

@app.put("/ordenes_compra/{id}/estado", dependencies=[Depends(verificar_token_admin)])
async def actualizar_orden_compra(id: str, data: dict):
    nuevo_estado = data.get("estado")
    orden_ref = db.collection("ordenes_compra").document(id)
    orden_doc = orden_ref.get()
    if not orden_doc.exists: raise HTTPException(status_code=404)
    
    orden_data = orden_doc.to_dict()
    if nuevo_estado == "Aprobada" and orden_data.get("estado") == "Pendiente":
        prod_ref = db.collection("productos").document(orden_data["producto_id"])
        if prod_ref.get().exists:
            p_data = prod_ref.get().to_dict()
            nuevo_stock = p_data.get("stock_actual", p_data.get("cantidad", 0)) + orden_data["cantidad"]
            prod_ref.update({"stock_actual": nuevo_stock})
            db.collection("movimientos").add({
                "producto_id": orden_data["producto_id"], "tipo": "Entrada", "cantidad": orden_data["cantidad"],
                "motivo": "Reabastecimiento Automático (PUSH)", "usuario_id": "Sistema SCM Automático",
                "fecha": datetime.now().strftime("%Y-%m-%d %H:%M:%S"), "stock_resultante": nuevo_stock
            })
        orden_ref.update({"estado": "Completada"})
        return {"mensaje": "Orden aprobada e inventario actualizado"}
        
    orden_ref.update({"estado": nuevo_estado})
    return {"mensaje": f"Orden actualizada a {nuevo_estado}"}