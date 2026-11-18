"""Pruebas aisladas de lógica; no consultan Firebase real."""
import importlib.util
import pathlib
import sys
import types
import unittest
from fastapi import FastAPI
from fastapi.routing import APIRoute
from pydantic import ValidationError

# La suite puede ejecutarse sin credenciales ni firebase_admin instalado.
fake_firebase = types.ModuleType('firebase_admin')
fake_firebase.firestore = types.SimpleNamespace(Query=types.SimpleNamespace(DESCENDING='DESCENDING'))
sys.modules.setdefault('firebase_admin', fake_firebase)
fake_cloud_firestore = types.ModuleType('google.cloud.firestore')
fake_cloud_firestore.transactional = lambda fn: fn
sys.modules['google.cloud.firestore'] = fake_cloud_firestore
path = pathlib.Path(__file__).resolve().parents[1] / 'crm-backend' / 'etapa4.py'
spec = importlib.util.spec_from_file_location('etapa4_prueba', path)
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)

class PruebaEtapa4(unittest.TestCase):
    def test_dinero_centavos(self):
        self.assertEqual(mod.centavos('19.995'), 2000)
        self.assertEqual(mod.centavos('0.01'), 1)
        self.assertEqual(mod.calculo_impuestos(10000, 1600), 1600)

    def test_compra_requiere_total_confirmado(self):
        obj=dict(solicitud_id='solicitud_123', items=[{'producto_id':'p1','cantidad':1}],metodo_pago='monedero')
        with self.assertRaises(ValidationError):mod.Compra(**obj)
        x=mod.Compra(**obj,total_aceptado_centavos=1234)
        self.assertEqual(x.total_aceptado_centavos, 1234)

    def test_rol_y_rutas_protegidas(self):
        roles=[]
        def permitir_roles(*permisos):
            roles.append(permisos)
            def comprobar(): return dict(uid='prueba',rol_verificado=permisos[0],email='test@example.com')
            return comprobar
        router=mod.construir_router_etapa4(None,permitir_roles)
        paths={r.path for r in router.routes if isinstance(r,APIRoute)}
        for ruta in ['/checkout/cotizar','/checkout/confirmar','/pedidos/mios','/monedero','/tickets','/admin/promociones','/admin/impuestos']:
            self.assertIn(ruta,paths)
        self.assertIn(('admin',),roles)
        self.assertIn(('admin','logistica'),roles)

if __name__=='__main__':unittest.main()
