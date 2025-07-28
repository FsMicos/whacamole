from flask import Flask, request, jsonify
from flask_cors import CORS
import joblib
import pickle
import numpy as np
import pandas as pd
import logging
from datetime import datetime
import os

# Configurar logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app)

# ========================================
# 🤖 CARGAR MODELOS ENTRENADOS (MEJORADO)
# ========================================

def cargar_modelo_compatible(archivo):
    """Intenta cargar un modelo con diferentes métodos para máxima compatibilidad"""
    try:
        # Método 1: joblib (más compatible)
        modelo = joblib.load(archivo)
        logger.info(f"✅ {archivo} cargado correctamente (joblib)")
        return modelo
    except Exception as e1:
        logger.warning(f"⚠️ joblib falló para {archivo}: {e1}")
        try:
            # Método 2: pickle tradicional
            with open(archivo, 'rb') as f:
                modelo = pickle.load(f)
            logger.info(f"✅ {archivo} cargado correctamente (pickle)")
            return modelo
        except Exception as e2:
            logger.error(f"❌ Todos los métodos fallaron para {archivo}")
            logger.error(f"   joblib: {e1}")
            logger.error(f"   pickle: {e2}")
            return None

# Cargar modelos con el método mejorado
try:
    modelo = cargar_modelo_compatible('modelo_whac_a_mole_ia.pkl')
    encoder_grupo_edad = cargar_modelo_compatible('encoder_grupo_edad.pkl')
    encoder_dificultad = cargar_modelo_compatible('encoder_dificultad.pkl')

    if all([modelo, encoder_grupo_edad, encoder_dificultad]):
        logger.info("🎉 TODOS LOS MODELOS CARGADOS EXITOSAMENTE")
        logger.info(f"📊 Grupos de edad disponibles: {list(encoder_grupo_edad.classes_)}")
        logger.info(f"📊 Dificultades disponibles: {list(encoder_dificultad.classes_)}")
    else:
        logger.error("❌ Algunos modelos no se pudieron cargar")

except Exception as e:
    logger.error(f"❌ Error general cargando modelos: {e}")
    modelo = None
    encoder_grupo_edad = None
    encoder_dificultad = None

# ========================================
# 🎯 CONFIGURACIÓN DE INTERVALOS CORREGIDA Y BALANCEADA
# ========================================

# ✅ INTERVALOS REBALANCEADOS PARA MAYOR RANGO EN DIFICULTAD "ALTA"
INTERVALOS_CONFIG = {
    'niños_4_8': {
        'baja': {'min': 3200, 'max': 3800, 'promedio': 3400},    # MÁS FÁCIL
        'media': {'min': 2800, 'max': 3400, 'promedio': 3200},   # INTERMEDIO
        'alta': {'min': 2000, 'max': 2600, 'promedio': 2200}     # MÁS DIFÍCIL
    },
    'niños_9_12': {
        'baja': {'min': 1900, 'max': 2400, 'promedio': 2100},    # MÁS FÁCIL
        'media': {'min': 1300, 'max': 1800, 'promedio': 1500},   # INTERMEDIO
        'alta': {'min': 800, 'max': 1200, 'promedio': 1000}      # MÁS DIFÍCIL ✅
    },
    'jovenes_13_17': {
        'baja': {'min': 1600, 'max': 2000, 'promedio': 1800},    # MÁS FÁCIL
        'media': {'min': 1100, 'max': 1600, 'promedio': 1300},   # INTERMEDIO
        'alta': {'min': 600, 'max': 1000, 'promedio': 800}       # MÁS DIFÍCIL ✅
    },
    'adultos_18+': {
        'baja': {'min': 1400, 'max': 1800, 'promedio': 1600},    # MÁS FÁCIL
        'media': {'min': 950, 'max': 1400, 'promedio': 1150},    # INTERMEDIO
        'alta': {'min': 500, 'max': 900, 'promedio': 700}        # MÁS DIFÍCIL ✅
    }
}

# ========================================
# 🔄 FUNCIONES DE UTILIDAD MEJORADAS
# ========================================

def determinar_grupo_edad(edad):
    """Determina el grupo de edad basado en la edad del jugador"""
    if 4 <= edad <= 8:
        return 'niños_4_8'
    elif 9 <= edad <= 12:
        return 'niños_9_12'
    elif 13 <= edad <= 17:
        return 'jovenes_13_17'
    else:
        return 'adultos_18+'

def calcular_intervalo_progresivo(grupo_edad, dificultad_actual, dificultad_objetivo, paso_transicion=0.4):
    """
    Calcula un intervalo progresivo entre la dificultad actual y objetivo
    ✅ MEJORADO: Validación y logging más detallado
    """
    config = INTERVALOS_CONFIG.get(grupo_edad, INTERVALOS_CONFIG['adultos_18+'])

    if dificultad_actual not in config or dificultad_objetivo not in config:
        logger.warning(f"Dificultad no válida: {dificultad_actual} -> {dificultad_objetivo}")
        return config['media']['promedio']

    intervalo_actual = config[dificultad_actual]['promedio']
    intervalo_objetivo = config[dificultad_objetivo]['promedio']

    # Transición gradual
    diferencia = intervalo_objetivo - intervalo_actual
    nuevo_intervalo = intervalo_actual + (diferencia * paso_transicion)

    # ✅ VALIDACIÓN DE RANGO
    min_intervalo = min(config[d]['min'] for d in config.keys())
    max_intervalo = max(config[d]['max'] for d in config.keys())
    nuevo_intervalo = max(min_intervalo, min(max_intervalo, nuevo_intervalo))

    logger.info(f"📈 Intervalo calculado para {grupo_edad}:")
    logger.info(f"   {dificultad_actual} ({intervalo_actual}ms) -> {dificultad_objetivo} ({intervalo_objetivo}ms)")
    logger.info(f"   Resultado: {int(nuevo_intervalo)}ms (transición {paso_transicion*100:.0f}%)")

    return int(nuevo_intervalo)

# ✅ NUEVA FUNCIÓN PARA ANÁLISIS DETALLADO DEL RENDIMIENTO
def analizar_rendimiento_jugador(aciertos, fallos, tiempo_reaccion, tasa_exito, grupo_edad):
    """
    Analiza el rendimiento del jugador y devuelve métricas detalladas
    para mejorar la precisión de la clasificación
    """
    total_intentos = aciertos + fallos

    # Definir umbrales específicos por grupo de edad
    umbrales = {
        'niños_4_8': {
            'exito_bajo': 40,     # % éxito
            'exito_alto': 75,
            'tiempo_rapido': 1200,  # ms
            'tiempo_lento': 2000
        },
        'niños_9_12': {
            'exito_bajo': 50,
            'exito_alto': 80,
            'tiempo_rapido': 900,
            'tiempo_lento': 1500
        },
        'jovenes_13_17': {
            'exito_bajo': 60,
            'exito_alto': 85,
            'tiempo_rapido': 700,
            'tiempo_lento': 1200
        },
        'adultos_18+': {
            'exito_bajo': 65,
            'exito_alto': 90,
            'tiempo_rapido': 600,
            'tiempo_lento': 1000
        }
    }

    umbral = umbrales.get(grupo_edad, umbrales['adultos_18+'])

    # Calcular puntuaciones
    puntuacion_exito = 0
    if tasa_exito >= umbral['exito_alto']:
        puntuacion_exito = 2  # Alto rendimiento
    elif tasa_exito >= umbral['exito_bajo']:
        puntuacion_exito = 1  # Rendimiento medio
    else:
        puntuacion_exito = 0  # Rendimiento bajo

    puntuacion_tiempo = 0
    if tiempo_reaccion <= umbral['tiempo_rapido']:
        puntuacion_tiempo = 2  # Muy rápido
    elif tiempo_reaccion <= umbral['tiempo_lento']:
        puntuacion_tiempo = 1  # Tiempo normal
    else:
        puntuacion_tiempo = 0  # Lento

    # Puntuación combinada (0-4)
    puntuacion_total = puntuacion_exito + puntuacion_tiempo

    # Sugerencia de dificultad basada en puntuación
    if puntuacion_total >= 3:
        dificultad_sugerida = 'alta'
        confianza_bonus = 0.1
    elif puntuacion_total >= 2:
        dificultad_sugerida = 'media'
        confianza_bonus = 0.05
    else:
        dificultad_sugerida = 'baja'
        confianza_bonus = 0.0

    return {
        'puntuacion_exito': puntuacion_exito,
        'puntuacion_tiempo': puntuacion_tiempo,
        'puntuacion_total': puntuacion_total,
        'dificultad_sugerida': dificultad_sugerida,
        'confianza_bonus': confianza_bonus,
        'umbrales_usados': umbral
    }

def interpretar_prediccion_ia(prediccion_encoded, probabilidades, datos_rendimiento=None):
    """
    ✅ MEJORADO: Interpreta la predicción del modelo con análisis híbrido
    """
    # Decodificar la predicción
    dificultad_predicha = encoder_dificultad.inverse_transform([prediccion_encoded])[0]

    # Obtener la confianza máxima
    confianza_maxima = np.max(probabilidades)

    # ✅ APLICAR ANÁLISIS HÍBRIDO SI ESTÁ DISPONIBLE
    if datos_rendimiento and datos_rendimiento.get('confianza_bonus', 0) > 0:
        # Si el análisis manual sugiere una dificultad diferente y tiene alta confianza
        if (datos_rendimiento['puntuacion_total'] >= 3 and
                dificultad_predicha != 'alta' and
                confianza_maxima < 0.8):

            logger.info(f"🔧 Análisis híbrido: Cambiando {dificultad_predicha} -> alta")
            logger.info(f"   Razón: Puntuación total {datos_rendimiento['puntuacion_total']}/4")
            dificultad_predicha = 'alta'
            confianza_maxima = min(0.85, confianza_maxima + datos_rendimiento['confianza_bonus'])

        elif (datos_rendimiento['puntuacion_total'] <= 1 and
              dificultad_predicha != 'baja' and
              confianza_maxima < 0.8):

            logger.info(f"🔧 Análisis híbrido: Cambiando {dificultad_predicha} -> baja")
            logger.info(f"   Razón: Puntuación total {datos_rendimiento['puntuacion_total']}/4")
            dificultad_predicha = 'baja'
            confianza_maxima = min(0.85, confianza_maxima + datos_rendimiento['confianza_bonus'])

    # Mapear dificultades a acciones numéricas
    mapeo_acciones = {
        'baja': 0,      # Facilitar
        'media': 1,     # Mantener
        'alta': 2       # Dificultar
    }

    accion = mapeo_acciones.get(dificultad_predicha, 1)

    # Crear probabilidades por acción
    prob_dict = {}
    for i, clase in enumerate(encoder_dificultad.classes_):
        prob_dict[clase] = float(probabilidades[i])

    return {
        'dificultad_predicha': dificultad_predicha,
        'accion': accion,
        'confianza': float(confianza_maxima),
        'probabilidades': prob_dict,
        'accion_nombre': {0: 'facilitar', 1: 'mantener', 2: 'dificultar'}[accion],
        'analisis_aplicado': datos_rendimiento is not None
    }

# ========================================
# 🔍 ENDPOINT DE SALUD
# ========================================

@app.route('/health', methods=['GET'])
def health_check():
    """Endpoint para verificar que el servicio está funcionando"""
    estado_modelos = {
        'modelo_principal': modelo is not None,
        'encoder_grupo_edad': encoder_grupo_edad is not None,
        'encoder_dificultad': encoder_dificultad is not None
    }

    return jsonify({
        'status': 'healthy' if all(estado_modelos.values()) else 'partial',
        'timestamp': datetime.now().isoformat(),
        'modelos': estado_modelos,
        'version': '2.0.0',
        'grupos_edad': list(encoder_grupo_edad.classes_) if encoder_grupo_edad else [],
        'dificultades': list(encoder_dificultad.classes_) if encoder_dificultad else []
    })

# ========================================
# 🤖 ENDPOINT PRINCIPAL DE PREDICCIÓN MEJORADO
# ========================================

@app.route('/predict-difficulty', methods=['POST'])
def predict_difficulty():
    """
    ✅ ENDPOINT PRINCIPAL MEJORADO para predecir dificultad
    """
    try:
        # Verificar que los modelos estén cargados
        if not all([modelo, encoder_grupo_edad, encoder_dificultad]):
            logger.error("🚨 Modelos no disponibles para predicción")
            return jsonify({
                'success': False,
                'error': 'Modelos no disponibles - verificar logs de inicio',
                'data': None
            }), 500

        # Obtener datos del request
        data = request.get_json()
        if not data:
            return jsonify({
                'success': False,
                'error': 'No se recibieron datos JSON',
                'data': None
            }), 400

        # Log de datos recibidos
        logger.info(f"🔍 === NUEVA PREDICCIÓN ===")
        logger.info(f"📊 Datos recibidos: {data}")

        # Validar campos requeridos
        campos_requeridos = ['age', 'hits_in_window', 'misses_in_window',
                             'avg_reaction_window', 'success_rate_window']

        for campo in campos_requeridos:
            if campo not in data:
                logger.error(f"❌ Campo faltante: {campo}")
                return jsonify({
                    'success': False,
                    'error': f'Campo requerido faltante: {campo}',
                    'data': None
                }), 400

        # Extraer y procesar datos
        edad = int(data['age'])
        aciertos = int(data['hits_in_window'])
        fallos = int(data['misses_in_window'])
        tiempo_reaccion = float(data['avg_reaction_window'])
        tasa_exito = float(data['success_rate_window'])
        duracion_ventana = data.get('window_duration', 10)
        dificultad_actual = data.get('current_difficulty', 'media')

        # Calcular métricas adicionales
        total_intentos = aciertos + fallos
        if total_intentos == 0:
            return jsonify({
                'success': False,
                'error': 'No hay suficientes datos para evaluar',
                'data': None
            }), 400

        # Calcular puntaje estimado
        puntaje_total = aciertos * 100

        # Determinar grupo de edad
        grupo_edad = determinar_grupo_edad(edad)

        # ✅ REALIZAR ANÁLISIS DETALLADO DEL RENDIMIENTO
        analisis_rendimiento = analizar_rendimiento_jugador(
            aciertos, fallos, tiempo_reaccion, tasa_exito, grupo_edad
        )

        logger.info(f"📈 Análisis de rendimiento:")
        logger.info(f"   Puntuación éxito: {analisis_rendimiento['puntuacion_exito']}/2")
        logger.info(f"   Puntuación tiempo: {analisis_rendimiento['puntuacion_tiempo']}/2")
        logger.info(f"   Puntuación total: {analisis_rendimiento['puntuacion_total']}/4")
        logger.info(f"   Sugerencia: {analisis_rendimiento['dificultad_sugerida']}")

        # Preparar características para el modelo
        try:
            grupo_edad_encoded = encoder_grupo_edad.transform([grupo_edad])[0]
        except ValueError as e:
            logger.warning(f"Grupo de edad desconocido: {grupo_edad}, usando 'adultos_18+'")
            grupo_edad_encoded = encoder_grupo_edad.transform(['adultos_18+'])[0]

        # Crear array de características (mismo orden que en entrenamiento)
        caracteristicas = np.array([[
            aciertos,           # aciertos
            fallos,            # fallos
            tasa_exito,        # tasa_exito
            tiempo_reaccion,   # tiempo_reaccion
            puntaje_total,     # puntaje_total
            grupo_edad_encoded # grupo_edad (encoded)
        ]])

        logger.info(f"🧠 Características para modelo: {caracteristicas[0]}")

        # Realizar predicción
        prediccion = modelo.predict(caracteristicas)[0]
        probabilidades = modelo.predict_proba(caracteristicas)[0]

        logger.info(f"🤖 Predicción cruda del modelo:")
        logger.info(f"   Clase predicha: {prediccion}")
        logger.info(f"   Probabilidades: {probabilidades}")

        # ✅ Interpretar resultado con análisis híbrido
        resultado = interpretar_prediccion_ia(prediccion, probabilidades, analisis_rendimiento)

        # Calcular intervalo sugerido (progresivo)
        intervalo_sugerido = calcular_intervalo_progresivo(
            grupo_edad,
            dificultad_actual,
            resultado['dificultad_predicha'],
            paso_transicion=0.4
        )

        # ✅ VALIDACIÓN DEL INTERVALO SUGERIDO
        config_grupo = INTERVALOS_CONFIG[grupo_edad]
        intervalo_minimo = min(config_grupo[d]['min'] for d in config_grupo.keys())
        intervalo_maximo = max(config_grupo[d]['max'] for d in config_grupo.keys())

        if not (intervalo_minimo <= intervalo_sugerido <= intervalo_maximo):
            logger.warning(f"⚠️ Intervalo fuera de rango: {intervalo_sugerido}ms")
            intervalo_sugerido = max(intervalo_minimo, min(intervalo_maximo, intervalo_sugerido))
            logger.info(f"🔧 Intervalo corregido: {intervalo_sugerido}ms")

        # Log final de la predicción
        logger.info(f"🎯 === RESULTADO FINAL ===")
        logger.info(f"   👤 Jugador: {edad} años ({grupo_edad})")
        logger.info(f"   📊 Rendimiento: {aciertos}/{total_intentos} ({tasa_exito:.1f}%), {tiempo_reaccion:.0f}ms")
        logger.info(f"   🤖 Predicción: {resultado['dificultad_predicha']} (confianza: {resultado['confianza']:.2f})")
        logger.info(f"   ⚡ Intervalo: {dificultad_actual} ({INTERVALOS_CONFIG[grupo_edad][dificultad_actual]['promedio']}ms) -> {resultado['dificultad_predicha']} ({intervalo_sugerido}ms)")
        logger.info(f"   🔧 Análisis híbrido: {'Aplicado' if resultado['analisis_aplicado'] else 'No aplicado'}")

        # ✅ RESPUESTA ESTRUCTURADA Y COMPLETA
        response_data = {
            'dificultad_predicha': resultado['dificultad_predicha'],
            'confianza': resultado['confianza'],
            'probabilidades': resultado['probabilidades'],
            'accion': resultado['accion'],
            'accion_nombre': resultado['accion_nombre'],
            'grupo_edad': grupo_edad,
            'intervalo_sugerido': intervalo_sugerido,
            'dificultad_actual': dificultad_actual,
            'analisis_rendimiento': {
                'puntuacion_exito': analisis_rendimiento['puntuacion_exito'],
                'puntuacion_tiempo': analisis_rendimiento['puntuacion_tiempo'],
                'puntuacion_total': analisis_rendimiento['puntuacion_total'],
                'dificultad_sugerida_manual': analisis_rendimiento['dificultad_sugerida'],
                'umbrales': analisis_rendimiento['umbrales_usados']
            },
            'metricas_evaluadas': {
                'aciertos': aciertos,
                'fallos': fallos,
                'total_intentos': total_intentos,
                'tasa_exito': tasa_exito,
                'tiempo_reaccion': tiempo_reaccion,
                'puntaje_total': puntaje_total,
                'duracion_ventana': duracion_ventana
            },
            'intervalos_disponibles': INTERVALOS_CONFIG[grupo_edad],
            'modelo_info': {
                'prediccion_original': int(prediccion),
                'analisis_hibrido_aplicado': resultado['analisis_aplicado']
            },
            'timestamp': datetime.now().isoformat()
        }

        return jsonify({
            'success': True,
            'error': None,
            'data': response_data
        })

    except Exception as e:
        logger.error(f"❌ Error en predict_difficulty: {str(e)}", exc_info=True)
        return jsonify({
            'success': False,
            'error': f'Error interno del servidor: {str(e)}',
            'data': None
        }), 500

# ========================================
# 🎮 ENDPOINT DE CONFIGURACIÓN DE INTERVALOS
# ========================================

@app.route('/get-intervals/<grupo_edad>', methods=['GET'])
def get_intervals(grupo_edad):
    """Obtiene los intervalos de dificultad para un grupo de edad específico"""
    try:
        if grupo_edad not in INTERVALOS_CONFIG:
            return jsonify({
                'success': False,
                'error': f'Grupo de edad no reconocido: {grupo_edad}',
                'available_groups': list(INTERVALOS_CONFIG.keys())
            }), 400

        return jsonify({
            'success': True,
            'grupo_edad': grupo_edad,
            'intervalos': INTERVALOS_CONFIG[grupo_edad]
        })

    except Exception as e:
        logger.error(f"Error en get_intervals: {str(e)}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

# ========================================
# 📊 ENDPOINT DE INFORMACIÓN DEL MODELO
# ========================================

@app.route('/model-info', methods=['GET'])
def model_info():
    """Proporciona información sobre el modelo cargado"""
    try:
        if not modelo:
            return jsonify({
                'success': False,
                'error': 'Modelo no cargado'
            }), 500

        info = {
            'success': True,
            'model_type': str(type(modelo).__name__),
            'grupos_edad_disponibles': list(encoder_grupo_edad.classes_) if encoder_grupo_edad else [],
            'dificultades_disponibles': list(encoder_dificultad.classes_) if encoder_dificultad else [],
            'intervalos_configurados': list(INTERVALOS_CONFIG.keys()),
            'caracteristicas_esperadas': [
                'aciertos', 'fallos', 'tasa_exito',
                'tiempo_reaccion', 'puntaje_total', 'grupo_edad'
            ],
            'intervalos_por_grupo': INTERVALOS_CONFIG,
            'version': '2.0.0'
        }

        return jsonify(info)

    except Exception as e:
        logger.error(f"Error en model_info: {str(e)}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

# ========================================
# 🧪 ENDPOINT DE PRUEBA MEJORADO
# ========================================

@app.route('/test-prediction', methods=['GET'])
def test_prediction():
    """Endpoint para probar el modelo con diferentes casos de prueba"""
    try:
        # ✅ CASOS DE PRUEBA VARIADOS
        casos_prueba = [
            {
                'nombre': 'Rendimiento ALTO - Debería sugerir ALTA',
                'data': {
                    'age': 15,
                    'hits_in_window': 9,
                    'misses_in_window': 1,
                    'avg_reaction_window': 450.0,
                    'success_rate_window': 90.0,
                    'current_difficulty': 'media'
                }
            },
            {
                'nombre': 'Rendimiento BAJO - Debería sugerir BAJA',
                'data': {
                    'age': 15,
                    'hits_in_window': 3,
                    'misses_in_window': 7,
                    'avg_reaction_window': 1200.0,
                    'success_rate_window': 30.0,
                    'current_difficulty': 'media'
                }
            },
            {
                'nombre': 'Rendimiento MEDIO - Debería sugerir MEDIA',
                'data': {
                    'age': 15,
                    'hits_in_window': 6,
                    'misses_in_window': 4,
                    'avg_reaction_window': 800.0,
                    'success_rate_window': 60.0,
                    'current_difficulty': 'media'
                }
            }
        ]

        resultados = []

        for caso in casos_prueba:
            logger.info(f"🧪 Probando: {caso['nombre']}")

            # Simular request interno
            with app.test_request_context('/predict-difficulty',
                                          method='POST',
                                          json=caso['data']):
                response = predict_difficulty()

                if hasattr(response, 'get_json'):
                    resultado = response.get_json()
                else:
                    resultado = response

                resultados.append({
                    'caso': caso['nombre'],
                    'datos_entrada': caso['data'],
                    'resultado': resultado,
                    'exito': resultado.get('success', False)
                })

        return jsonify({
            'success': True,
            'total_casos': len(casos_prueba),
            'casos_exitosos': sum(1 for r in resultados if r['exito']),
            'resultados': resultados,
            'timestamp': datetime.now().isoformat()
        })

    except Exception as e:
        logger.error(f"Error en test_prediction: {str(e)}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

# ========================================
# 🔧 ENDPOINT DE DEBUG Y DIAGNÓSTICO
# ========================================

@app.route('/debug-model', methods=['POST'])
def debug_model():
    """Endpoint para diagnóstico detallado del modelo"""
    try:
        data = request.get_json()
        if not data:
            return jsonify({'error': 'No data provided'}), 400

        # Información detallada del modelo
        debug_info = {
            'modelo_cargado': modelo is not None,
            'tipo_modelo': str(type(modelo).__name__) if modelo else None,
            'encoders_disponibles': {
                'grupo_edad': encoder_grupo_edad is not None,
                'dificultad': encoder_dificultad is not None
            }
        }

        if encoder_grupo_edad:
            debug_info['clases_grupo_edad'] = list(encoder_grupo_edad.classes_)

        if encoder_dificultad:
            debug_info['clases_dificultad'] = list(encoder_dificultad.classes_)

        # Si se proporcionan datos, hacer predicción con detalles
        if 'age' in data:
            edad = data['age']
            grupo_edad = determinar_grupo_edad(edad)

            debug_info['grupo_determinado'] = grupo_edad
            debug_info['intervalos_grupo'] = INTERVALOS_CONFIG.get(grupo_edad)

            # Análisis de rendimiento si hay datos suficientes
            if all(k in data for k in ['hits_in_window', 'misses_in_window', 'avg_reaction_window', 'success_rate_window']):
                analisis = analizar_rendimiento_jugador(
                    data['hits_in_window'],
                    data['misses_in_window'],
                    data['avg_reaction_window'],
                    data['success_rate_window'],
                    grupo_edad
                )
                debug_info['analisis_manual'] = analisis

        return jsonify({
            'success': True,
            'debug_info': debug_info,
            'timestamp': datetime.now().isoformat()
        })

    except Exception as e:
        logger.error(f"Error en debug_model: {str(e)}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

# ========================================
# 🚀 CONFIGURACIÓN Y EJECUCIÓN
# ========================================

if __name__ == '__main__':
    # Verificar que los archivos de modelo existen
    archivos_requeridos = [
        'modelo_whac_a_mole_ia.pkl',
        'encoder_grupo_edad.pkl',
        'encoder_dificultad.pkl'
    ]

    archivos_faltantes = [archivo for archivo in archivos_requeridos if not os.path.exists(archivo)]

    if archivos_faltantes:
        logger.error(f"❌ Archivos de modelo faltantes: {archivos_faltantes}")
        logger.error("Asegúrate de que los archivos .pkl estén en el mismo directorio que este script")
    else:
        logger.info("✅ Todos los archivos de modelo encontrados")

    logger.info("🚀 === SERVIDOR ML WHAC-A-MOLE v2.0 ===")
    logger.info("📡 Endpoints disponibles:")
    logger.info("   GET  /health - Verificar estado del servicio")
    logger.info("   POST /predict-difficulty - Predicción de dificultad (PRINCIPAL)")
    logger.info("   GET  /get-intervals/<grupo> - Obtener intervalos por grupo")
    logger.info("   GET  /model-info - Información del modelo")
    logger.info("   GET  /test-prediction - Prueba con casos variados")
    logger.info("   POST /debug-model - Diagnóstico detallado")

    if all([modelo, encoder_grupo_edad, encoder_dificultad]):
        logger.info("🎉 === SISTEMA LISTO ===")
        logger.info(f"   🤖 Modelo: {type(modelo).__name__}")
        logger.info(f"   📊 Grupos: {list(encoder_grupo_edad.classes_)}")
        logger.info(f"   🎯 Dificultades: {list(encoder_dificultad.classes_)}")
        logger.info("   🔧 Análisis híbrido: ACTIVADO")
        logger.info("   ⚡ Intervalos rebalanceados: ACTIVADO")
    else:
        logger.warning("⚠️ Sistema con modelos parciales - funcionalidad limitada")

    # Ejecutar servidor
    app.run(
        host='0.0.0.0',
        port=5000,
        debug=True,
        threaded=True
    )