from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import gspread
import firebase_admin
from firebase_admin import credentials, firestore
from pydantic import BaseModel
from datetime import datetime

# 1. Configuración e Inicialización
app = FastAPI(title="HeroCare ONB API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # En producción, cambia esto por la URL de tu frontend
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Inicializar Google Sheets
SHEET_ID = "1obGQuhQx0FcxdoHNYUMzGqOzLFalhA63W8ze1tygHkk"
gc = gspread.service_account(filename='credentials.json')
sh = gc.open_by_key(SHEET_ID)
worksheet = sh.sheet1 # Asume que es la primera hoja

# Inicializar Firebase Admin (Usa el mismo credentials.json de GCP)
cred = credentials.Certificate('credentials.json')
firebase_admin.initialize_app(cred)
db = firestore.client()

# 2. Modelos de Datos
class CasoBase(BaseModel):
    vendor_id: str
    tienda: str
    kam: str
    agente: str
    integracion: str

class PushKAM(BaseModel):
    tipo: str # 'catalogo' o 'pos_api'

# 3. Endpoints
@app.post("/api/casos")
async def crear_caso(caso: CasoBase):
    try:
        # Generar N° Caso OP (Ej: ONB-20260921-XXXX)
        num_caso = f"ONB-{datetime.now().strftime('%Y%m%d%H%M%S')}"
        fecha_actual = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        
        datos = {
            "num_caso": num_caso,
            "vendor_id": caso.vendor_id,
            "tienda": caso.tienda,
            "kam": caso.kam,
            "agente": caso.agente,
            "integracion": caso.integracion,
            "estado": "En progreso",
            "fecha_creacion": fecha_actual,
            "sla_inicio": fecha_actual
        }
        
        # A. Escribir en Firestore
        db.collection('casos').document(num_caso).set(datos)
        
        # B. Escribir en Google Sheets (Ajusta el orden según tus columnas reales)
        # Formato esperado: [N° Caso, ID, Tienda, KAM, Integracion, Agente, Estado, Etapa...]
        fila = [num_caso, caso.vendor_id, caso.tienda, caso.kam, caso.integracion, caso.agente, "En progreso", ""]
        worksheet.append_row(fila)
        
        return {"status": "success", "caso": num_caso}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.put("/api/casos/{num_caso}/push")
async def registrar_push_kam(num_caso: str, push: PushKAM):
    try:
        fecha_actual = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        
        # A. Actualizar Firestore
        doc_ref = db.collection('casos').document(num_caso)
        campo_fecha = "fecha_push_catalogo" if push.tipo == 'catalogo' else "fecha_push_pos_api"
        campo_bool = "push_kam_catalogo" if push.tipo == 'catalogo' else "push_kam_pos_api"
        
        doc_ref.update({
            campo_bool: True,
            campo_fecha: fecha_actual
        })
        
        # B. Actualizar Google Sheets
        # (Lógica simplificada: busca la fila por el N° de Caso y actualiza la celda correspondiente)
        celda_caso = worksheet.find(num_caso)
        if celda_caso:
            fila = celda_caso.row
            # Ajustar índices de columna: Ej. W (23) para POS API, AA (27) para Catálogo
            columna_bool = 27 if push.tipo == 'catalogo' else 23
            columna_fecha = 25 if push.tipo == 'catalogo' else 21
            
            worksheet.update_cell(fila, columna_bool, "VERDADERO")
            worksheet.update_cell(fila, columna_fecha, fecha_actual)
            
        return {"status": "success"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))