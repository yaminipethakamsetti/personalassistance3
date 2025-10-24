from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
import os
import json
import requests
from datetime import datetime
import gtts
from tempfile import NamedTemporaryFile

app = Flask(__name__)
CORS(app)

# Load environment variables (in production, use python-dotenv)
WEATHER_API_KEY = os.getenv('WEATHER_API_KEY', 'your-api-key')
NEWS_API_KEY = os.getenv('NEWS_API_KEY', 'your-api-key')

# Simple JSON file-based storage
REMINDERS_FILE = 'reminders.json'

def load_reminders():
    try:
        with open(REMINDERS_FILE, 'r') as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        return []

def save_reminders(reminders):
    with open(REMINDERS_FILE, 'w') as f:
        json.dump(reminders, f)

@app.route('/api/reminders', methods=['GET'])
def get_reminders():
    return jsonify(load_reminders())

@app.route('/api/reminders', methods=['POST'])
def add_reminder():
    reminder = request.json
    reminders = load_reminders()
    reminder['id'] = len(reminders) + 1
    reminder['time'] = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    reminders.append(reminder)
    save_reminders(reminders)
    return jsonify(reminder)

@app.route('/api/weather')
def get_weather():
    city = request.args.get('city', 'London')
    try:
        r = requests.get(
            f'https://api.openweathermap.org/data/2.5/weather?q={city}&appid={WEATHER_API_KEY}&units=metric'
        )
        data = r.json()
        return jsonify({
            'city': data['name'],
            'temp': f"{data['main']['temp']}°C",
            'desc': data['weather'][0]['description'],
            'humidity': f"{data['main']['humidity']}%"
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/news')
def get_news():
    try:
        r = requests.get(
            f'https://newsapi.org/v2/top-headlines?country=us&apiKey={NEWS_API_KEY}'
        )
        articles = r.json()['articles'][:5]  # Get top 5 articles
        return jsonify([{
            'title': a['title'],
            'url': a['url'],
            'source': a['source']['name']
        } for a in articles])
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/tts', methods=['POST'])
def text_to_speech():
    text = request.json.get('text')
    if not text:
        return 'No text provided', 400
    
    try:
        # Use gTTS to convert text to speech
        tts = gtts.gTTS(text=text, lang='en')
        
        # Save to temporary file
        with NamedTemporaryFile(suffix='.mp3', delete=False) as f:
            tts.save(f.name)
            return send_file(f.name, mimetype='audio/mp3')
    except Exception as e:
        return str(e), 500

if __name__ == '__main__':
    app.run(debug=True)