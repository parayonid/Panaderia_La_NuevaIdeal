from fastapi import FastAPI, HTTPException, Header, Depends, Security
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import firebase_admin
import os
from firebase_admin import credentials, firestore, auth
from datetime import datetime

# 1. Inicializar Firebase Admin con tu llave privada
ruta_llave = "serviceAccountKey.json"
if not os.path.exists(ruta_llave):
    ruta_llave = "../serviceAccountKey.json"
cred = credentials.Certificate(ruta_llave)
firebase_admin.initialize_app(cred)
db = firestore.client()

app = FastAPI(title="API CRM La Nueva Ideal")

# 2. Configurar CORS (Permite que el front-end local y de producción hagan peticiones)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://weblanuevaideal.web.app", "http://127.0.0.1:5500", "http://localhost:5500"],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["*"],
)

# --- MODELOS PYDANTIC ---
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
    usuario_id: str # El ID del Admin que la registró
    
# ==========================================
# VALIDACIONES: SEGURIDAD
# ==========================================

security = HTTPBearer()

async def verificar_token_admin(credenciales: HTTPAuthorizationCredentials = Security(security)):
    token = credenciales.credentials
    try:
        # 1. Firebase verifica que el JWT sea legítimo y no esté expirado
        usuario_jwt = auth.verify_id_token(token)
        uid = usuario_jwt.get("uid")
        
        # 2. Consultamos Firestore para garantizar que tenga el rol de admin
        user_doc = db.collection("usuarios").document(uid).get()
        if not user_doc.exists or user_doc.to_dict().get("rol") != "admin":
            raise HTTPException(status_code=403, detail="Acceso denegado: Privilegios insuficientes")
            
        return usuario_jwt
    except Exception as e:
        raise HTTPException(status_code=401, detail="Token inválido o expirado")

# ==========================================
# ENDPOINTS: CLIENTES
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
        clientes_ref = db.collection("clientes").stream()
        clientes = []
        for doc in clientes_ref:
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

@app.post("/interacciones", status_code=201, dependencies=[Depends(verificar_token_admin)])
async def crear_interaccion(interaccion: Interaccion):
    nueva_int = interaccion.model_dump()
    nueva_int["fecha"] = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    doc_ref = db.collection("interacciones").document()
    doc_ref.set(nueva_int)
    return {"id": doc_ref.id, "mensaje": "Interacción registrada"}

@app.get("/clientes")
def obtener_clientes():
    print("ALGUIEN ENTRO A /CLIENTES")
    return [{"id": "test_1", "nombre": "Cliente de Prueba", "correo": "test@ideal.com", "telefono": "4491234567", "empresa": "Prueba", "estado": "activo"}]