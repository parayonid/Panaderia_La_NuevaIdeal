"""Monederos de clientes para Administrador y Mantenimiento (entorno académico).

La consulta es de solo lectura. Los ajustes exigen ETAPA4_DEMO_MODE=true,
usuario de destino incluido en ETAPA4_DEMO_UIDS, motivo y solicitud idempotente.
No constituye una pasarela ni permite acreditar depósitos reales.
"""
import os
from datetime import datetime, timezone
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from google.cloud import firestore as google_firestore


def _ahora():
    return datetime.now(timezone.utc).isoformat()


def _demo_autorizado(uid):
    activo = os.getenv('ETAPA4_DEMO_MODE', 'false').strip().lower() == 'true'
    permitidos = {x.strip() for x in os.getenv('ETAPA4_DEMO_UIDS', '').split(',') if x.strip()}
    return activo and uid in permitidos


class AjusteMonedero(BaseModel):
    solicitud_id: str = Field(min_length=8, max_length=80, pattern=r'^[a-zA-Z0-9_-]+$')
    operacion: Literal['recarga', 'debito']
    monto_centavos: int = Field(ge=100, le=200000)
    motivo: str = Field(min_length=8, max_length=300)


def construir_router_mantenimiento(db, permitir_roles):
    router = APIRouter(prefix='/admin/monederos', tags=['Mantenimiento - Monederos'])
    personal = permitir_roles('admin', 'mantenimiento')

    @router.get('')
    def listar(usuario=Depends(personal)):
        # Límite explícito para que la pantalla no realice una lectura ilimitada.
        perfiles = list(db.collection('usuarios').where('rol', '==', 'cliente').limit(250).stream())
        referencias = [db.collection('monederos').document(p.id) for p in perfiles]
        saldos = {snap.id: (snap.to_dict() or {}) for snap in db.get_all(referencias)} if referencias else {}
        resultado = []
        for perfil in perfiles:
            info = perfil.to_dict() or {}
            saldo = int(saldos.get(perfil.id, {}).get('saldo_centavos', 0) or 0)
            resultado.append({
                'uid': perfil.id,
                'nombre': str(info.get('nombre') or 'Cliente'),
                'correo': str(info.get('correo') or ''),
                'saldo_centavos': saldo,
                'saldo': round(saldo / 100, 2),
                'ajustes_demo_autorizados': _demo_autorizado(perfil.id),
            })
        resultado.sort(key=lambda p: (p['nombre'].lower(), p['uid']))
        return resultado

    @router.get('/{uid}/movimientos')
    def movimientos(uid: str, usuario=Depends(personal)):
        if not db.collection('usuarios').document(uid).get().exists:
            raise HTTPException(status_code=404, detail='Cliente no encontrado')
        docs = db.collection('monedero_movimientos').where('uid', '==', uid).stream()
        lista = [{'id': d.id, **(d.to_dict() or {})} for d in docs]
        lista.sort(key=lambda m: str(m.get('fecha') or ''), reverse=True)
        return lista[:100]

    @router.post('/{uid}/ajustes')
    def ajustar(uid: str, payload: AjusteMonedero, usuario=Depends(personal)):
        if not _demo_autorizado(uid):
            raise HTTPException(
                status_code=403,
                detail='Ajustes ficticios deshabilitados para esta cuenta. Habilita el modo demo y autoriza su UID en Render.'
            )
        motivo = payload.motivo.strip()
        if len(motivo) < 8:
            raise HTTPException(status_code=422, detail='Describe el motivo (al menos 8 caracteres).')
        ref_usuario = db.collection('usuarios').document(uid)
        ref_saldo = db.collection('monederos').document(uid)
        ref_movimiento = db.collection('monedero_movimientos').document(f'manual_{uid}_{payload.solicitud_id}')
        delta = payload.monto_centavos if payload.operacion == 'recarga' else -payload.monto_centavos

        @google_firestore.transactional
        def aplicar(tx):
            movimiento_existente = ref_movimiento.get(transaction=tx)
            if movimiento_existente.exists:
                previo = movimiento_existente.to_dict() or {}
                if (int(previo.get('monto_centavos', 0)) != delta or
                    previo.get('motivo') != motivo or
                    previo.get('actor_uid') != usuario['uid']):
                    raise HTTPException(status_code=409, detail='Identificador de ajuste ya utilizado con otros datos.')
                saldo_repetido = int(previo.get('saldo_resultante_centavos', 0))
                return {'saldo_centavos': saldo_repetido, 'saldo': round(saldo_repetido / 100, 2), 'reintento': True}
            perfil = ref_usuario.get(transaction=tx)
            saldo_snap = ref_saldo.get(transaction=tx)
            if not perfil.exists or str((perfil.to_dict() or {}).get('rol', '')).lower() != 'cliente':
                raise HTTPException(status_code=404, detail='Cuenta de cliente no encontrada')
            saldo_actual = int((saldo_snap.to_dict() or {}).get('saldo_centavos', 0)) if saldo_snap.exists else 0
            saldo_nuevo = saldo_actual + delta
            if saldo_nuevo < 0:
                raise HTTPException(status_code=409, detail='El saldo no puede quedar negativo.')
            fecha = _ahora()
            tx.set(ref_saldo, {'saldo_centavos': saldo_nuevo, 'actualizado_en': fecha}, merge=True)
            tx.set(ref_movimiento, {
                'uid': uid, 'tipo': 'recarga_manual_demo' if delta > 0 else 'ajuste_negativo_demo',
                'monto_centavos': delta, 'saldo_resultante_centavos': saldo_nuevo,
                'concepto': 'Ajuste académico (sin dinero real)', 'motivo': motivo,
                'actor_uid': usuario['uid'], 'actor_correo': usuario.get('email', ''),
                'fecha': fecha,
            })
            tx.set(db.collection('bitacora_actividad').document(), {
                'actor_uid': usuario['uid'], 'actor_nombre': usuario.get('email', 'Personal'),
                'actor_correo': usuario.get('email', ''), 'actor_rol': usuario.get('rol_verificado', 'mantenimiento'),
                'modulo': 'Monedero', 'accion': 'Ajuste académico de monedero',
                'detalle': f"Cuenta {uid} · {'+' if delta > 0 else '-'}${abs(delta)/100:.2f} · {motivo}"[:400],
                'referencia': ref_movimiento.id, 'fecha': fecha,
            })
            return {'saldo_centavos': saldo_nuevo, 'saldo': round(saldo_nuevo / 100, 2), 'reintento': False}

        return aplicar(db.transaction())

    return router
