#!/usr/bin/env python3
import requests
import csv
import io
import time
import threading
from datetime import datetime, timedelta
from flask import Flask, Response, jsonify
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

# Global variables for caching
cached_data = []
last_refresh = None
refresh_interval = 6 * 60 * 60  # 6 hours in seconds
is_refreshing = False

def fetch_and_cache_data():
    """Fetch data from Trader Joe's API and cache it in memory"""
    global cached_data, last_refresh, is_refreshing
    
    try:
        print(f"[{datetime.now()}] Starting data refresh...")
        is_refreshing = True
        
        response = requests.get('https://data.traderjoesprices.com/dump.csv', timeout=60)
        response.raise_for_status()
        
        # Parse CSV data
        csv_data = response.text
        print(f"[{datetime.now()}] Downloaded {len(csv_data):,} characters")
        
        csv_reader = csv.DictReader(io.StringIO(csv_data))
        
        # Convert to list and cache in memory
        print(f"[{datetime.now()}] Parsing CSV data...")
        cached_data = list(csv_reader)
        last_refresh = datetime.now()
        
        print(f"[{datetime.now()}] Data refresh complete! Loaded {len(cached_data):,} products into memory")
        print(f"[{datetime.now()}] Memory usage: ~{len(csv_data) / 1024 / 1024:.1f} MB")
        
    except Exception as e:
        print(f"[{datetime.now()}] Error refreshing data: {e}")
        if not cached_data:  # Only fail if we have no cached data
            print(f"[{datetime.now()}] No cached data available, server will not start")
            raise
    finally:
        is_refreshing = False

def background_refresh():
    """Background thread to refresh data periodically"""
    while True:
        try:
            time.sleep(refresh_interval)
            fetch_and_cache_data()
        except Exception as e:
            print(f"[{datetime.now()}] Background refresh error: {e}")
            time.sleep(300)  # Wait 5 minutes before retrying

@app.route('/api/traderjoes-data')
def get_traderjoes_data():
    """Serve cached data from memory"""
    if not cached_data:
        return {'error': 'No data available'}, 503
    
    return jsonify({
        'data': cached_data,
        'last_refresh': last_refresh.isoformat() if last_refresh else None,
        'total_products': len(cached_data),
        'cache_status': 'refreshing' if is_refreshing else 'ready'
    })

@app.route('/api/status')
def get_status():
    """Get cache status and info"""
    return jsonify({
        'cache_status': 'refreshing' if is_refreshing else 'ready',
        'last_refresh': last_refresh.isoformat() if last_refresh else None,
        'total_products': len(cached_data),
        'memory_usage_mb': len(str(cached_data)) / 1024 / 1024 if cached_data else 0,
        'uptime': str(datetime.now() - last_refresh) if last_refresh else 'N/A'
    })

@app.route('/api/refresh')
def manual_refresh():
    """Manually trigger a data refresh"""
    if is_refreshing:
        return jsonify({'message': 'Refresh already in progress'}), 409
    
    # Start refresh in background thread
    thread = threading.Thread(target=fetch_and_cache_data)
    thread.daemon = True
    thread.start()
    
    return jsonify({'message': 'Data refresh started'})

if __name__ == '__main__':
    print(f"[{datetime.now()}] Starting Trader Joe's Proxy Server...")
    print(f"[{datetime.now()}] Loading initial data into memory...")
    
    try:
        # Load initial data
        fetch_and_cache_data()
        
        # Start background refresh thread
        refresh_thread = threading.Thread(target=background_refresh, daemon=True)
        refresh_thread.start()
        
        print(f"[{datetime.now()}] Background refresh thread started (refreshes every 6 hours)")
        print(f"[{datetime.now()}] Server ready! Serving {len(cached_data):,} products from memory")
        
        app.run(host='0.0.0.0', port=3001, debug=False)  # Disable debug mode for production-like behavior
        
    except Exception as e:
        print(f"[{datetime.now()}] Failed to start server: {e}")
        exit(1) 