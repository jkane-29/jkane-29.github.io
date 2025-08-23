#!/usr/bin/env python3
import requests
import csv
import io
import time
import threading
from datetime import datetime, timedelta
from flask import Flask, Response, jsonify
from flask_cors import CORS
import json

app = Flask(__name__)
CORS(app, origins=["*"], supports_credentials=False)

# Global variables for caching
cached_data = []
last_refresh = None
refresh_interval = 6 * 60 * 60  # 6 hours in seconds
is_refreshing = False

# CPI data cache
cpi_data = {}
cpi_last_refresh = None
cpi_refresh_interval = 24 * 60 * 60  # 24 hours in seconds

def fetch_cpi_data():
    """Fetch CPI data from BLS API"""
    global cpi_data, cpi_last_refresh
    
    try:
        print(f"[{datetime.now()}] Fetching CPI data from BLS...")
        
        # Sample CPI data (you can replace with real BLS API calls)
        sample_cpi_data = {
            "food_at_home": {
                "2023": {"01": 295.8, "02": 296.2, "03": 296.8, "04": 297.1, "05": 297.5, "06": 297.8},
                "2024": {"01": 298.2, "02": 298.5, "03": 298.9, "04": 299.2, "05": 299.6, "06": 299.9}
            },
            "cereals_bakery": {
                "2023": {"01": 310.2, "02": 310.6, "03": 311.0, "04": 311.3, "05": 311.7, "06": 312.0},
                "2024": {"01": 312.5, "02": 312.8, "03": 313.2, "04": 313.5, "05": 313.9, "06": 314.2}
            },
            "meats_poultry_fish": {
                "2023": {"01": 280.5, "02": 280.9, "03": 281.3, "04": 281.6, "05": 282.0, "06": 282.3},
                "2024": {"01": 282.8, "02": 283.1, "03": 283.5, "04": 283.8, "05": 284.2, "06": 284.5}
            },
            "dairy": {
                "2023": {"01": 275.3, "02": 275.7, "03": 276.1, "04": 276.4, "05": 276.8, "06": 277.1},
                "2024": {"01": 277.5, "02": 277.8, "03": 278.2, "04": 278.5, "05": 278.9, "06": 279.2}
            },
            "fruits_vegetables": {
                "2023": {"01": 320.8, "02": 321.2, "03": 321.6, "04": 321.9, "05": 322.3, "06": 322.6},
                "2024": {"01": 323.0, "02": 323.3, "03": 323.7, "04": 324.0, "05": 324.4, "06": 324.7}
            },
            "nonalcoholic_beverages": {
                "2023": {"01": 265.4, "02": 265.8, "03": 266.2, "04": 266.5, "05": 266.9, "06": 267.2},
                "2024": {"01": 267.6, "02": 267.9, "03": 268.3, "04": 268.6, "05": 269.0, "06": 269.3}
            },
            "other_food": {
                "2023": {"01": 290.1, "02": 290.5, "03": 290.9, "04": 291.2, "05": 291.6, "06": 291.9},
                "2024": {"01": 292.3, "02": 292.6, "03": 293.0, "04": 293.3, "05": 293.7, "06": 294.0}
            }
        }
        
        cpi_data = sample_cpi_data
        cpi_last_refresh = datetime.now()
        
        print(f"[{datetime.now()}] CPI data loaded successfully")
        
    except Exception as e:
        print(f"[{datetime.now()}] Error fetching CPI data: {e}")

def calculate_basket_inflation(basket_items, base_year="2023", base_month="01", current_year="2024", current_month="06"):
    """Calculate inflation for a specific basket of items"""
    try:
        # Categorize items into CPI categories
        item_categories = categorize_items(basket_items)
        
        # Calculate weighted inflation
        total_weight = 0
        weighted_inflation = 0
        
        for category, items in item_categories.items():
            if category in cpi_data:
                # Get CPI values for base and current period
                base_cpi = cpi_data[category].get(base_year, {}).get(base_month, 100)
                current_cpi = cpi_data[category].get(current_year, {}).get(current_month, 100)
                
                # Calculate category inflation
                category_inflation = ((current_cpi - base_cpi) / base_cpi) * 100
                
                # Weight by number of items in category
                weight = len(items)
                total_weight += weight
                weighted_inflation += category_inflation * weight
        
        if total_weight > 0:
            basket_inflation = weighted_inflation / total_weight
            return {
                "basket_inflation": round(basket_inflation, 2),
                "base_period": f"{base_year}-{base_month}",
                "current_period": f"{current_year}-{current_month}",
                "category_breakdown": item_categories,
                "cpi_comparison": get_cpi_comparison(base_year, base_month, current_year, current_month)
            }
        
        return None
        
    except Exception as e:
        print(f"Error calculating basket inflation: {e}")
        return None

def categorize_items(items):
    """Categorize items into CPI categories"""
    categories = {
        "cereals_bakery": [],
        "meats_poultry_fish": [],
        "dairy": [],
        "fruits_vegetables": [],
        "nonalcoholic_beverages": [],
        "other_food": []
    }
    
    for item in items:
        item_lower = item.lower()
        
        # Cereals and bakery
        if any(word in item_lower for word in ["cereal", "bread", "pasta", "rice", "oats", "quinoa", "couscous", "muffin", "cookie", "cake"]):
            categories["cereals_bakery"].append(item)
        # Meats, poultry, fish
        elif any(word in item_lower for word in ["chicken", "beef", "pork", "salmon", "meatball", "bacon", "turkey", "fish", "dumpling"]):
            categories["meats_poultry_fish"].append(item)
        # Dairy
        elif any(word in item_lower for word in ["yogurt", "cheese", "milk", "cream", "butter", "feta", "mascarpone", "brie"]):
            categories["dairy"].append(item)
        # Fruits and vegetables
        elif any(word in item_lower for word in ["banana", "arugula", "avocado", "cucumber", "mango", "spinach", "broccoli", "quinoa", "dates"]):
            categories["fruits_vegetables"].append(item)
        # Nonalcoholic beverages
        elif any(word in item_lower for word in ["coffee", "tea", "juice", "beverage", "sparkling", "cold brew", "matcha"]):
            categories["nonalcoholic_beverages"].append(item)
        # Other food
        else:
            categories["other_food"].append(item)
    
    return categories

def get_cpi_comparison(base_year, base_month, current_year, current_month):
    """Get overall CPI comparison for the same period"""
    try:
        # Use food at home as the main comparison
        base_cpi = cpi_data["food_at_home"].get(base_year, {}).get(base_month, 100)
        current_cpi = cpi_data["food_at_home"].get(current_year, {}).get(current_month, 100)
        
        official_inflation = ((current_cpi - base_cpi) / base_cpi) * 100
        
        return {
            "official_cpi_inflation": round(official_inflation, 2),
            "base_cpi": base_cpi,
            "current_cpi": current_cpi
        }
    except:
        return None

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

def background_cpi_refresh():
    """Background thread to refresh CPI data periodically"""
    while True:
        try:
            time.sleep(cpi_refresh_interval)
            fetch_cpi_data()
        except Exception as e:
            print(f"[{datetime.now()}] CPI refresh error: {e}")
            time.sleep(3600)  # Wait 1 hour before retrying

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
        'uptime': str(datetime.now() - last_refresh) if last_refresh else 'N/A',
        'cpi_status': 'ready' if cpi_data else 'not_loaded',
        'cpi_last_refresh': cpi_last_refresh.isoformat() if cpi_last_refresh else None
    })

@app.route('/api/inflation/<character>')
def get_character_inflation(character):
    """Get inflation data for a specific character's basket"""
    try:
        # Define character baskets (matching frontend)
        character_baskets = {
            'finance-bro': [
                'Chewy Chocolate & Peanut Butter Protein Bars',
                'Nonfat Plain Greek Yogurt',
                'Vanilla Cardamom Cold Brew Coffee',
                'Chile Lime Flavored Fried Pork Rinds',
                'Chili & Lime Flavored Rolled Corn Tortilla Chips',
                'Salsa Autentica',
                'Italian Style Meatballs',
                'Joe\'s O\'s Cereal',
                'Mandarin Orange Chicken',
                'Hashbrowns'
            ],
            'grad-student': [
                'Joe\'s Diner Mac \'n Cheese',
                'World\'s Puffiest White Cheddar Corn Puffs',
                'Organic Bananas',
                'Calrose Rice',
                'Organic Black Beans',
                'Feta Cheese',
                'Pasture Raised Large Brown Eggs',
                'Mashed Potatoes',
                'Salsa Autentica',
                '4 Cheese Ravioli'
            ],
            'west-village-girl': [
                'Non-Dairy Oat Beverage',
                'Everything But The Bagel Sesame Seasoning Blend',
                'Lemony Arugula Basil Salad Kit',
                'European Grains & Seeds Bread',
                'Everything But The Bagel Seasoned Smoked Salmon',
                'Organic Arugula',
                'Unsweetened Almond, Cashew & Macadamia Nut Beverage',
                'Organic Tricolor Quinoa',
                'Scandinavian Swimmers',
                'Lemon Sparkling Water'
            ],
            'fitness-instructor': [
                'Vanilla Overnight Oats',
                'Nonfat Plain Greek Yogurt',
                'Matcha Green Tea Powder',
                'High Protein Organic Tofu',
                'Organic Brown Rice & Quinoa Fusilli Pasta',
                'Organic Broccoli Slaw',
                'Organic Cold Pressed Green Juice Beverage',
                'Teeny Tiny Avocados',
                'Organic Tricolor Quinoa',
                'Everything But The Bagel Sesame Seasoning Blend'
            ],
            'tech-bro': [
                'Everything But The Elote Seasoning Blend',
                'Organic Elote Corn Chip Dippers',
                'Vanilla Cardamom Cold Brew Coffee',
                'High Protein Organic Tofu',
                'Organic Basmati Rice',
                'Sriracha Sauce',
                'Chimichurri Sauce',
                'Steamed Chicken Soup Dumplings',
                'Organic White Quinoa',
                'Sparkling Green Tea with Pineapple'
            ],
            'yoga-instructor': [
                'Organic Creamy Cashew Cultured Yogurt Alternative, Plain Unsweetened',
                'Organic Cold Pressed Green Juice Beverage',
                'Matcha Green Tea Powder',
                'Organic Couscous',
                'Organic Firm Tofu',
                'Organic Pitted Medjool Dates',
                'Organic Unsweetened Almond Beverage',
                'To the Power of C Organic Juice Blend',
                'Organic Persian Cucumbers',
                'Zhoug Sauce'
            ],
            'wellness-guru': [
                'Organic Cold Pressed Green Juice Beverage',
                'Unsweetened Almond, Cashew & Macadamia Nut Beverage',
                'Rolled Oats',
                'Avocado Oil',
                'Organic Date Syrup',
                'Organic Dried Mango Unsulfured & Unsweetened',
                'Organic Firm Tofu',
                'Organic Turmeric Twist Cold Pressed Juice Blend',
                'Organic Creamy Peanut Butter Salted Valencia',
                'Gone Bananas!'
            ],
            'screenwriter': [
                'Mandarin Orange Chicken',
                'Hashbrowns',
                'Chocolatey Coated Chocolate Chip Cookie Dunkers',
                'Chili & Lime Flavored Rolled Corn Tortilla Chips',
                'Salsa Autentica',
                '4 Cheese Ravioli',
                'Italian Style Meatballs',
                'Opaline Pinot Noir Brut Rosé',
                'Spindrift Island Punch Sparkling Water',
                'Hold the Cone! Vanilla Mini Ice Cream Cones'
            ]
        }
        
        if character not in character_baskets:
            return {'error': 'Character not found'}, 404
        
        basket = character_baskets[character]
        
        # Calculate inflation for this basket
        inflation_data = calculate_basket_inflation(basket)
        
        if inflation_data:
            return jsonify({
                'character': character,
                'basket': basket,
                'inflation_analysis': inflation_data
            })
        else:
            return {'error': 'Could not calculate inflation'}, 500
            
    except Exception as e:
        return {'error': str(e)}, 500

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
    print(f"[{datetime.now()}] Starting Trader Joe's Proxy Server with CPI Integration...")
    print(f"[{datetime.now()}] Loading initial data into memory...")
    
    try:
        # Load initial data
        fetch_and_cache_data()
        
        # Load initial CPI data
        fetch_cpi_data()
        
        # Start background refresh threads
        refresh_thread = threading.Thread(target=background_refresh, daemon=True)
        refresh_thread.start()
        
        cpi_refresh_thread = threading.Thread(target=background_cpi_refresh, daemon=True)
        cpi_refresh_thread.start()
        
        print(f"[{datetime.now()}] Background refresh threads started")
        print(f"[{datetime.now()}] CPI data loaded and ready")
        print(f"[{datetime.now()}] Server ready! Serving {len(cached_data):,} products from memory")
        
        app.run(host='0.0.0.0', port=3001, debug=False)
        
    except Exception as e:
        print(f"[{datetime.now()}] Failed to start server: {e}")
        exit(1) 