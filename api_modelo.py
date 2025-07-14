from flask import Flask, request, jsonify
import joblib
import numpy as np

app = Flask(__name__)

# Cargar modelo
model = joblib.load('modelo_velocidad.pkl')

# Tus columnas en el mismo orden que usaste para entrenar
features = [
    'aciertos', 'fallos', 'tasa_exito', 'tiempo_reaccion_promedio',
    'puntuacion',
    'aciertos_agujero_0', 'aciertos_agujero_4', 'fallos_agujero_5',
    'tiempo_reaccion_agujero_1', 'tiempo_reaccion_agujero_6'
]


@app.route('/predecir', methods=['POST'])
def predecir():
    data = request.get_json()
    valores = [data.get(f, 0) for f in features]
    pred = model.predict([valores])[0]
    return jsonify({'velocidad_clasificada': pred})

if __name__ == '__main__':
    app.run(debug=True)
