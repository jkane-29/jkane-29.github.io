#!/usr/bin/env python3
import requests
from flask import Flask, Response
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

@app.route('/api/traderjoes-data')
def get_traderjoes_data():
    try:
        response = requests.get('https://data.traderjoesprices.com/dump.csv')
        response.raise_for_status()
        
        return Response(
            response.text,
            mimetype='text/csv',
            headers={
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET',
                'Access-Control-Allow-Headers': 'Content-Type'
            }
        )
    except Exception as e:
        print(f"Error fetching data: {e}")
        return {'error': 'Failed to fetch data'}, 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=3001, debug=True) 