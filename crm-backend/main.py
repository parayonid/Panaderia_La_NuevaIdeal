from fastapi import FastAPI, HTTPException, Header, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import firebase_admin
from firebase_admin import credentials, firestore
from datetime import datetime

# 1. Inicializar Firebase Admin con tu llave privada
cred = credentials.Certificate("serviceAccountKey.json")
firebase_admin.initialize_app(cred)
db = firestore.client()

app = FastAPI(title="API CRM La Nueva Ideal")

# 2. Configurar CORS (Permite que el front-end local haga peticiones)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://weblanuevaideal.web.app", "http://127.0.0.1:5500", "http://localhost:5500"],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["*"],
)

# --- MODELOS PYDANTIC (Rúbrica de la Maestra) ---
class Cliente(BaseModel):
    nombre: str
    correo: str
    telefono: str
    empresa: str
    estado: str = "activo" # activo o inactivo

class Interaccion(BaseModel):
    cliente_id: str
    tipo: str # llamada, correo, reunión
    descripcion: str
    usuario_id: str # El ID del Admin (empleado) que la registró
    
    
# ==========================================
# VALIDACIONES: SEGURIDAD
# ==========================================



# Token secreto simulado para el Administrador (en producción iría en variables de entorno)
ADMIN_SECRET_TOKEN = "ideal_admin_token_2026"

async def verificar_token_admin(x_admin_token: str = Header(...)):
    if x_admin_token != ADMIN_SECRET_TOKEN:
        raise HTTPException(status_code=403, detail="Acceso denegado: Token de Administrador inválido o ausente")
    return x_admin_token


# ==========================================
# ENDPOINTS: CLIENTES
# ==========================================




@app.post("/clientes", status_code=201, dependencies=[Depends(verificar_token_admin)])
async def crear_cliente(cliente: Cliente):
    nuevo_cliente = cliente.model_dump()
    nuevo_cliente["fecha_registro"] = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    doc_ref = db.collection("clientes").document()
    doc_ref.set(nuevo_cliente)
    return {"id": doc_ref.id, "mensaje": "Cliente creado exitosamente"}

@app.get("/clientes")
async def obtener_clientes():
    clientes_ref = db.collection("clientes").stream()
    clientes = []
    for doc in clientes_ref:
        datos = doc.to_dict()
        datos["id"] = doc.id
        clientes.append(datos)
    return clientes

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
    
    # Soft Delete: En lugar de borrarlo, lo marcamos como inactivo
    doc_ref.update({"estado": "inactivo"})
    return {"mensaje": "Cliente marcado como inactivo"}

# ==========================================
# ENDPOINTS: INTERACCIONES
# ==========================================

@app.post("/interacciones", status_code=201, dependencies=[Depends(verificar_token_admin)])
async def crear_interaccion(interaccion: Interaccion):
    nueva_int = interaccion.model_dump()
    nueva_int["fecha"] = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    doc_ref = db.collection("interacciones").document()
    doc_ref.set(nueva_int)
    return {"id": doc_ref.id, "mensaje": "Interacción registrada"}

@app.get("/clientes/{id}/interacciones")
async def obtener_interacciones_cliente(id: str):
    # Consulta a Firestore filtrando por el ID del cliente
    interacciones_ref = db.collection("interacciones").where("cliente_id", "==", id).stream()
    interacciones = []
    for doc in interacciones_ref:
        datos = doc.to_dict()
        datos["id"] = doc.id
        interacciones.append(datos)
    return interacciones