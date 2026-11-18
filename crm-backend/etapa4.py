"""Etapa 4 (demostración académica): checkout, monedero, pedidos, tickets y configuración.

Este módulo se importa desde main.py y reutiliza su Firebase Admin SDK inicializado.
NO procesa tarjetas reales ni emite CFDI. ETAPA4_DEMO_MODE=true habilita recargas
simuladas y pagos simulados solo en un entorno escolar aislado.
"""
import os
from datetime import datetime, timezone
from decimal import Decimal, ROUND_HALF_UP, InvalidOperation
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from firebase_admin import firestore
from google.cloud import firestore as google_firestore


def ahora():
    return datetime.now(timezone.utc).isoformat()


def centavos(valor):
    try:
        d = Decimal(str(valor))
        if not d.is_finite() or d < 0:
            raise ValueError("Precio inválido")
        return int((d * 100).quantize(Decimal('1'), rounding=ROUND_HALF_UP))
    except (InvalidOperation, ValueError, TypeError):
        raise HTTPException(status_code=400, detail="Se encontró un importe inválido en el catálogo")


def pesos(cents):
    return round(cents / 100, 2)


def calculo_impuestos(base_centavos, tasa_bps):
    return (base_centavos * tasa_bps + 5000) // 10000


class Linea(BaseModel):
    producto_id: str = Field(min_length=1, max_length=150)
    cantidad: int = Field(ge=1, le=100)


class Compra(BaseModel):
    solicitud_id: str = Field(min_length=8, max_length=80, pattern=r'^[a-zA-Z0-9_-]+$')
    items: list[Linea] = Field(min_length=1, max_length=30)
    metodo_pago: Literal['monedero', 'demo', 'transferencia', 'qr', 'cheque']
    codigo_promocion: str = Field(default='', max_length=36)
    tipo_entrega: Literal['recoger', 'domicilio'] = 'recoger'
    direccion: str = Field(default='', max_length=240)
    requiere_factura: bool = False
    total_aceptado_centavos: int = Field(ge=0)


class Cotizacion(BaseModel):
    items: list[Linea] = Field(min_length=1, max_length=30)
    codigo_promocion: str = Field(default='', max_length=36)


class RecargaDemo(BaseModel):
    solicitud_id: str = Field(min_length=8, max_length=80, pattern=r'^[a-zA-Z0-9_-]+$')
    monto_centavos: int = Field(ge=100, le=200000)


class TicketNuevo(BaseModel):
    asunto: Literal['Pedido', 'Producto', 'Facturación', 'Monedero', 'Otro']
    mensaje: str = Field(min_length=8, max_length=2000)
    pedido_id: str | None = Field(default=None, max_length=150)


class TicketRespuesta(BaseModel):
    estado: Literal['Abierto', 'En proceso', 'Respondido', 'Cerrado']
    respuesta: str = Field(default='', max_length=2000)


class PromoEntrada(BaseModel):
    codigo: str = Field(min_length=3, max_length=36, pattern=r'^[A-Z0-9_-]+$')
    tipo: Literal['porcentaje', 'monto']
    valor: float = Field(gt=0)
    activo: bool = True
    fecha_fin: str = Field(default='', max_length=40)


class ImpuestoEntrada(BaseModel):
    tasa_bps: int = Field(ge=0, le=3000)
    nota: str = Field(default='', max_length=300)


class EstadoPedido(BaseModel):
    estado: Literal['En preparación', 'En reparto', 'Entregado']


def construir_router_etapa4(db, permitir_roles):
    router = APIRouter(tags=['Etapa 4 - Ecommerce'])
    sesion = permitir_roles('cliente', 'ventas', 'logistica', 'admin')
    admin = permitir_roles('admin')
    personal = permitir_roles('admin', 'ventas')
    logistica = permitir_roles('admin', 'logistica')

    def modo_demo():
        return os.getenv('ETAPA4_DEMO_MODE', 'false').strip().lower() == 'true'

    def demo_autorizado(uid):
        # No habilitar moneda ficticia a todos los clientes del Hosting público.
        autorizados = {v.strip() for v in os.getenv('ETAPA4_DEMO_UIDS', '').split(',') if v.strip()}
        return modo_demo() and uid in autorizados

    def stock_de(p):
        return int(p.get('stock_actual', p.get('cantidad', 0)) or 0)

    def totales(items, codigo='', transaction=None):
        """Lee precios y descuentos del servidor, nunca del navegador.
        Cuando transaction existe, todas las lecturas se hacen antes de escribir.
        """
        agregados = {}
        for linea in items:
            agregados[linea.producto_id] = agregados.get(linea.producto_id, 0) + linea.cantidad
        if any(q > 100 for q in agregados.values()):
            raise HTTPException(400, 'Máximo 100 piezas por producto')
        lista = []
        refs = {}
        subtotal = 0
        for pid, cantidad in sorted(agregados.items()):
            ref = db.collection('productos').document(pid)
            snap = ref.get(transaction=transaction) if transaction else ref.get()
            if not snap.exists:
                raise HTTPException(404, f'Producto {pid} no encontrado')
            data = snap.to_dict() or {}
            precio_c = centavos(data.get('precio'))
            existencia = stock_de(data)
            if existencia < cantidad:
                raise HTTPException(409, f"Stock insuficiente: {data.get('nombre', pid)} (disponible: {existencia})")
            refs[pid] = (ref, data, existencia)
            subtotal += precio_c * cantidad
            lista.append(dict(producto_id=pid, nombre=str(data.get('nombre', 'Producto')),
                              cantidad=cantidad, precio_unitario=pesos(precio_c),
                              subtotal=pesos(precio_c * cantidad)))
        impuesto_ref = db.collection('impuestos_config').document('general')
        imp_snap = impuesto_ref.get(transaction=transaction) if transaction else impuesto_ref.get()
        tasa = int((imp_snap.to_dict() or {}).get('tasa_bps', 0)) if imp_snap.exists else 0
        if not 0 <= tasa <= 3000:
            raise HTTPException(500, 'Impuesto configurado fuera del rango permitido')
        codigo_normalizado = codigo.strip().upper()
        descuento = 0
        if codigo_normalizado:
            promo_ref = db.collection('promociones').document(codigo_normalizado)
            promo_snap = promo_ref.get(transaction=transaction) if transaction else promo_ref.get()
            if not promo_snap.exists:
                raise HTTPException(400, 'Cupón no encontrado')
            promo = promo_snap.to_dict() or {}
            if not promo.get('activo') or (promo.get('fecha_fin') and str(promo['fecha_fin']) < ahora()):
                raise HTTPException(400, 'Cupón inactivo o vencido')
            valor = Decimal(str(promo.get('valor', 0)))
            if not valor.is_finite() or valor <= 0:
                raise HTTPException(400, 'Cupón inválido')
            if promo.get('tipo') == 'porcentaje':
                if valor > 100:
                    raise HTTPException(400, 'Porcentaje de cupón inválido')
                descuento = int((Decimal(subtotal) * valor / 100).quantize(Decimal('1'), rounding=ROUND_HALF_UP))
            elif promo.get('tipo') == 'monto':
                descuento = centavos(valor)
            else:
                raise HTTPException(400, 'Tipo de promoción inválido')
            descuento = min(subtotal, descuento)
        impuestos = calculo_impuestos(subtotal - descuento, tasa)
        return {
            'items': lista, 'subtotal_centavos': subtotal,
            'descuento_centavos': descuento, 'impuestos_centavos': impuestos,
            'total_centavos': subtotal - descuento + impuestos,
            'tasa_bps': tasa, 'codigo_promocion': codigo_normalizado,
        }, refs

    def representar(orden):
        # Se conservan los campos históricos que lee el ERP.
        return {k: v for k, v in orden.items() if not k.startswith('_')}

    def evento(transaction, usuario, accion, detalle, referencia=''):
        ref = db.collection('bitacora_actividad').document()
        transaction.set(ref, {
            'actor_uid': usuario['uid'], 'actor_nombre': usuario.get('email', 'Cliente'),
            'actor_correo': usuario.get('email', ''), 'actor_rol': usuario.get('rol_verificado', 'cliente'),
            'modulo': 'Tienda', 'accion': accion, 'detalle': detalle[:400],
            'referencia': referencia, 'fecha': ahora(),
        })

    @router.get('/etapa4/config')
    def configuracion(usuario=Depends(sesion)):
        return {'modo_demo': demo_autorizado(usuario['uid']), 'pagos_reales': False, 'cfdi_real': False}

    @router.post('/checkout/cotizar')
    def cotizar(payload: Cotizacion, usuario=Depends(sesion)):
        datos, _ = totales(payload.items, payload.codigo_promocion)
        return {**datos, 'subtotal': pesos(datos['subtotal_centavos']),
                'descuento': pesos(datos['descuento_centavos']),
                'impuestos': pesos(datos['impuestos_centavos']),
                'total': pesos(datos['total_centavos'])}

    @router.post('/checkout/confirmar', status_code=201)
    def confirmar(payload: Compra, usuario=Depends(sesion)):
        if payload.metodo_pago == 'demo' and not demo_autorizado(usuario['uid']):
            raise HTTPException(403, 'Los pagos simulados están deshabilitados')
        if payload.tipo_entrega == 'domicilio' and not payload.direccion.strip():
            raise HTTPException(400, 'Indica una dirección de entrega')
        uid = usuario['uid']
        orden_ref = db.collection('ordenes_clientes').document('web_' + payload.solicitud_id)
        perfil_ref = db.collection('usuarios').document(uid)
        # Reutilizar un registro CRM existente (mismo correo) si lo hay.
        # Si no, crear un identificador estable por UID; no crear clientes duplicados por compra.
        encontrados = list(db.collection('clientes').where('correo', '==', usuario.get('email', '')).limit(1).stream())
        cliente_ref = encontrados[0].reference if encontrados else db.collection('clientes').document('web_' + uid)
        saldo_ref = db.collection('monederos').document(uid)
        contador_ref = db.collection('config_erp').document('contador_ordenes_clientes')

        @google_firestore.transactional
        def ejecutar(tx):
            anterior = orden_ref.get(transaction=tx)
            if anterior.exists:
                prev = anterior.to_dict() or {}
                if prev.get('cliente_uid') != uid:
                    raise HTTPException(409, 'Identificador de solicitud ya utilizado')
                return {'pedido': {'id': anterior.id, **representar(prev)}, 'reintento': True}
            perfil_snap = perfil_ref.get(transaction=tx)
            perfil = perfil_snap.to_dict() if perfil_snap.exists else {}
            cliente_snap = cliente_ref.get(transaction=tx)
            tot, refs = totales(payload.items, payload.codigo_promocion, transaction=tx)
            if tot['total_centavos'] != payload.total_aceptado_centavos:
                raise HTTPException(409, 'El total cambió desde la cotización. Revisa el importe y vuelve a confirmar.')
            saldo_snap = saldo_ref.get(transaction=tx)
            saldo = int((saldo_snap.to_dict() or {}).get('saldo_centavos', 0)) if saldo_snap.exists else 0
            contador_snap = contador_ref.get(transaction=tx)
            consecutivo = int((contador_snap.to_dict() or {}).get('consecutivo', 0)) + 1 if contador_snap.exists else 1
            pago_completo = payload.metodo_pago in ('monedero', 'demo')
            if payload.metodo_pago == 'monedero' and saldo < tot['total_centavos']:
                raise HTTPException(409, f"Saldo insuficiente: ${pesos(saldo):.2f}")
            fecha = ahora()
            folio = f'OV-{consecutivo:06d}'
            estado = 'Procesada' if pago_completo else 'Pendiente de pago'
            orden = {
                'folio': folio, 'fecha': fecha, 'estado': estado, 'canal': 'tienda',
                'cliente_uid': uid, 'cliente_id': cliente_ref.id,
                'cliente_nombre': str((perfil or {}).get('nombre') or usuario.get('email') or 'Cliente'),
                'cliente_correo': usuario.get('email', ''),
                'usuario_id': uid, 'items': tot['items'],
                'subtotal': pesos(tot['subtotal_centavos']),
                'descuento': pesos(tot['descuento_centavos']),
                'impuestos': pesos(tot['impuestos_centavos']), 'total': pesos(tot['total_centavos']),
                'tasa_bps': tot['tasa_bps'], 'codigo_promocion': tot['codigo_promocion'],
                'metodo_pago': payload.metodo_pago,
                'estado_pago': 'simulado' if payload.metodo_pago == 'demo' else ('aprobado' if pago_completo else 'pendiente'),
                'tipo_entrega': payload.tipo_entrega,
                'direccion': payload.direccion.strip() if payload.tipo_entrega == 'domicilio' else '',
                'requiere_factura': payload.requiere_factura,
                'simulacion_academica': payload.metodo_pago == 'demo',
                'historial_estados': [{'estado': 'Pedido recibido', 'fecha': fecha}]
            }
            if pago_completo:
                for item in tot['items']:
                    ref, product, stock = refs[item['producto_id']]
                    nuevo = stock - item['cantidad']
                    tx.update(ref, {'stock_actual': nuevo})
                    tx.set(db.collection('movimientos').document(), {
                        'producto_id': item['producto_id'], 'tipo': 'Salida', 'cantidad': item['cantidad'],
                        'motivo': f'Compra tienda {folio}', 'usuario_id': uid,
                        'orden_cliente_id': orden_ref.id, 'fecha': fecha, 'stock_resultante': nuevo
                    })
                orden['historial_estados'].append({'estado': 'Pago confirmado', 'fecha': fecha})
                if payload.metodo_pago == 'monedero':
                    nuevo_saldo = saldo - tot['total_centavos']
                    tx.set(saldo_ref, {'saldo_centavos': nuevo_saldo, 'actualizado_en': fecha}, merge=True)
                    tx.set(db.collection('monedero_movimientos').document(), {
                        'uid': uid, 'tipo': 'compra', 'monto_centavos': -tot['total_centavos'],
                        'saldo_resultante_centavos': nuevo_saldo, 'pedido_id': orden_ref.id,
                        'fecha': fecha, 'concepto': f'Compra {folio}'
                    })
            if not cliente_snap.exists:
                tx.set(cliente_ref, {
                    'nombre': str((perfil or {}).get('nombre') or usuario.get('email') or 'Cliente'),
                    'correo': usuario.get('email', ''), 'telefono': str((perfil or {}).get('telefono') or ''),
                    'empresa': '', 'estado': 'activo', 'firebase_uid': uid,
                    'fecha_registro': fecha
                })
            tx.set(orden_ref, orden)
            tx.set(contador_ref, {'consecutivo': consecutivo}, merge=True)
            evento(tx, usuario, 'Creó pedido de tienda', f'{folio} · {estado}', orden_ref.id)
            return {'pedido': {'id': orden_ref.id, **orden}, 'reintento': False}
        return ejecutar(db.transaction())

    @router.get('/pedidos/mios')
    def mis_pedidos(usuario=Depends(sesion)):
        # Evita el índice compuesto: filtro por UID, ordenación local. Paginación después.
        docs = db.collection('ordenes_clientes').where('cliente_uid', '==', usuario['uid']).stream()
        ordenes = [{'id': doc.id, **(doc.to_dict() or {})} for doc in docs]
        ordenes.sort(key=lambda o: str(o.get('fecha', '')), reverse=True)
        return ordenes[:100]

    @router.get('/pedidos/{pedido_id}')
    def pedido_detalle(pedido_id: str, usuario=Depends(sesion)):
        snap = db.collection('ordenes_clientes').document(pedido_id).get()
        if not snap.exists:
            raise HTTPException(404, 'Pedido no encontrado')
        orden = snap.to_dict() or {}
        if orden.get('cliente_uid') != usuario['uid']:
            raise HTTPException(403, 'Este pedido no pertenece a la cuenta')
        return {'id': snap.id, **orden}

    @router.put('/pedidos/{pedido_id}/estado')
    def actualizar_estado(pedido_id: str, payload: EstadoPedido, usuario=Depends(logistica)):
        ref = db.collection('ordenes_clientes').document(pedido_id)
        @google_firestore.transactional
        def cambiar(tx):
            snap = ref.get(transaction=tx)
            if not snap.exists: raise HTTPException(404, 'Pedido no encontrado')
            datos = snap.to_dict() or {}
            if datos.get('estado_pago') not in ('aprobado', 'simulado'):
                raise HTTPException(409, 'No se puede despachar un pedido sin pago confirmado')
            estados = ['En preparación', 'En reparto', 'Entregado']
            actual = datos.get('estado_entrega')
            if actual in estados and estados.index(payload.estado) < estados.index(actual):
                raise HTTPException(409, 'No puedes retroceder el seguimiento')
            if actual == payload.estado:
                return {'estado_entrega': actual}
            eventos = list(datos.get('historial_estados') or [])
            eventos.append({'estado': payload.estado, 'fecha': ahora()})
            tx.update(ref, {'estado_entrega': payload.estado, 'historial_estados': eventos})
            return {'estado_entrega': payload.estado}
        return cambiar(db.transaction())

    @router.post('/admin/pedidos/{pedido_id}/confirmar-pago')
    def confirmar_pago_manual_demo(pedido_id: str, usuario=Depends(admin)):
        """Solo demo académica autorizada; NO reemplaza webhook bancario verificado."""
        if not demo_autorizado(usuario['uid']):
            raise HTTPException(403, 'Confirmación manual simulada no habilitada para esta cuenta')
        orden_ref = db.collection('ordenes_clientes').document(pedido_id)

        @google_firestore.transactional
        def ejecutar(tx):
            snap = orden_ref.get(transaction=tx)
            if not snap.exists: raise HTTPException(404, 'Pedido no encontrado')
            orden = snap.to_dict() or {}
            if orden.get('canal') != 'tienda': raise HTTPException(409, 'Este endpoint solo acepta pedidos de tienda')
            if orden.get('estado_pago') != 'pendiente':
                return {'mensaje':'El pedido ya fue procesado', 'reintento': True}
            referencias = []
            for it in orden.get('items') or []:
                ref = db.collection('productos').document(it['producto_id'])
                prod = ref.get(transaction=tx)
                if not prod.exists: raise HTTPException(409, 'Producto eliminado del catálogo')
                stock = stock_de(prod.to_dict() or {})
                if stock < int(it['cantidad']): raise HTTPException(409, 'Stock insuficiente para confirmar el pago')
                referencias.append((ref, stock, it))
            fecha = ahora()
            for ref, stock, it in referencias:
                nuevo = stock - int(it['cantidad'])
                tx.update(ref, {'stock_actual': nuevo})
                tx.set(db.collection('movimientos').document(), {
                    'producto_id': it['producto_id'], 'tipo': 'Salida',
                    'cantidad': int(it['cantidad']), 'motivo': f'Pago manual demo {orden.get("folio", pedido_id)}',
                    'usuario_id': usuario['uid'], 'orden_cliente_id': pedido_id,
                    'fecha': fecha, 'stock_resultante': nuevo
                })
            estados = list(orden.get('historial_estados') or [])
            estados.append({'estado':'Pago confirmado (DEMO)', 'fecha':fecha})
            tx.update(orden_ref, {'estado':'Procesada','estado_pago':'simulado',
                                  'simulacion_academica':True,'historial_estados':estados})
            evento(tx, usuario, 'Confirmó pago ficticio', f'Pedido {orden.get("folio", pedido_id)}', pedido_id)
            return {'mensaje':'Pago simulado y stock descontado', 'reintento':False}
        return ejecutar(db.transaction())

    @router.get('/monedero')
    def leer_monedero(usuario=Depends(sesion)):
        snap = db.collection('monederos').document(usuario['uid']).get()
        saldo = int((snap.to_dict() or {}).get('saldo_centavos', 0)) if snap.exists else 0
        return {'saldo_centavos': saldo, 'saldo': pesos(saldo), 'simulado': demo_autorizado(usuario['uid'])}

    @router.get('/monedero/movimientos')
    def leer_movimientos(usuario=Depends(sesion)):
        docs = db.collection('monedero_movimientos').where('uid', '==', usuario['uid']).stream()
        datos = [{'id': d.id, **(d.to_dict() or {})} for d in docs]
        datos.sort(key=lambda m: str(m.get('fecha', '')), reverse=True)
        return datos[:100]

    @router.post('/monedero/recarga-simulada')
    def recarga_demo(payload: RecargaDemo, usuario=Depends(sesion)):
        if not demo_autorizado(usuario['uid']):
            raise HTTPException(403, 'Recarga ficticia deshabilitada para esta cuenta')
        uid = usuario['uid']
        saldo_ref = db.collection('monederos').document(uid)
        op_ref = db.collection('monedero_movimientos').document('recarga_' + uid + '_' + payload.solicitud_id)
        @google_firestore.transactional
        def recargar(tx):
            operacion = op_ref.get(transaction=tx)
            if operacion.exists:
                datos = operacion.to_dict() or {}
                return {'saldo_centavos': int(datos.get('saldo_resultante_centavos', 0)), 'reintento': True}
            actual = saldo_ref.get(transaction=tx)
            saldo = int((actual.to_dict() or {}).get('saldo_centavos', 0)) if actual.exists else 0
            nuevo = saldo + payload.monto_centavos
            fecha = ahora()
            tx.set(saldo_ref, {'saldo_centavos': nuevo, 'actualizado_en': fecha}, merge=True)
            tx.set(op_ref, {'uid': uid, 'tipo': 'recarga_demo', 'monto_centavos': payload.monto_centavos,
                            'saldo_resultante_centavos': nuevo, 'concepto': 'Recarga académica (sin dinero real)',
                            'fecha': fecha})
            evento(tx, usuario, 'Recarga ficticia', f'${pesos(payload.monto_centavos):.2f}', op_ref.id)
            return {'saldo_centavos': nuevo, 'saldo': pesos(nuevo), 'reintento': False}
        return recargar(db.transaction())

    @router.get('/tickets')
    def mis_tickets(usuario=Depends(sesion)):
        docs = db.collection('tickets').where('cliente_uid', '==', usuario['uid']).stream()
        registros = [{'id': d.id, **(d.to_dict() or {})} for d in docs]
        registros.sort(key=lambda d: str(d.get('fecha', '')), reverse=True)
        return registros[:100]

    @router.post('/tickets', status_code=201)
    def crear_ticket(payload: TicketNuevo, usuario=Depends(sesion)):
        if payload.pedido_id:
            snap = db.collection('ordenes_clientes').document(payload.pedido_id).get()
            if not snap.exists or (snap.to_dict() or {}).get('cliente_uid') != usuario['uid']:
                raise HTTPException(403, 'Solo puedes asociar pedidos propios')
        ref = db.collection('tickets').document()
        fecha = ahora()
        ref.set({'cliente_uid': usuario['uid'], 'cliente_correo': usuario.get('email', ''),
                 'asunto': payload.asunto, 'mensaje': payload.mensaje, 'pedido_id': payload.pedido_id,
                 'estado': 'Abierto', 'respuesta': '', 'fecha': fecha, 'actualizado_en': fecha})
        return {'id': ref.id, 'estado': 'Abierto'}

    @router.get('/admin/tickets')
    def tickets_staff(usuario=Depends(personal)):
        docs = db.collection('tickets').order_by('fecha', direction=firestore.Query.DESCENDING).limit(100).stream()
        return [{'id': d.id, **(d.to_dict() or {})} for d in docs]

    @router.patch('/admin/tickets/{ticket_id}')
    def responder_ticket(ticket_id: str, payload: TicketRespuesta, usuario=Depends(personal)):
        ref = db.collection('tickets').document(ticket_id)
        if not ref.get().exists: raise HTTPException(404, 'Ticket no encontrado')
        ref.update({'estado': payload.estado, 'respuesta': payload.respuesta,
                    'respondido_por': usuario['uid'], 'actualizado_en': ahora()})
        return {'mensaje': 'Ticket actualizado'}

    @router.get('/admin/promociones')
    def listar_promos(usuario=Depends(admin)):
        return [{'id': d.id, **(d.to_dict() or {})} for d in db.collection('promociones').stream()]

    @router.put('/admin/promociones/{codigo}')
    def guardar_promocion(codigo: str, payload: PromoEntrada, usuario=Depends(admin)):
        if codigo != payload.codigo: raise HTTPException(400, 'El código no coincide')
        if payload.tipo == 'porcentaje' and payload.valor > 100:
            raise HTTPException(400, 'Un porcentaje no puede exceder 100')
        db.collection('promociones').document(codigo).set(payload.model_dump())
        return {'mensaje': 'Promoción guardada'}

    @router.get('/admin/impuestos')
    def leer_impuestos(usuario=Depends(admin)):
        snap = db.collection('impuestos_config').document('general').get()
        return snap.to_dict() if snap.exists else {'tasa_bps': 0, 'nota': 'Sin tasa configurada'}

    @router.put('/admin/impuestos')
    def guardar_impuestos(payload: ImpuestoEntrada, usuario=Depends(admin)):
        db.collection('impuestos_config').document('general').set(payload.model_dump())
        return {'mensaje': 'Configuración guardada'}

    return router
