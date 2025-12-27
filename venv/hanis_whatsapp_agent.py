
# Hanis WhatsApp Smart Agent - Flask Backend
# Dependencies: flask, requests, openai

from flask import Flask, request, jsonify
import requests
import openai
import os

app = Flask(__name__)

# CONFIGURATION
ULTRAMSG_INSTANCE_ID = os.getenv("ULTRAMSG_INSTANCE_ID")
ULTRAMSG_TOKEN = os.getenv("ULTRAMSG_TOKEN")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")

openai.api_key = OPENAI_API_KEY

# Persona-Driven System Prompt
HANIS_PERSONA_PROMPT = """
You are Hanis, a highly intelligent, articulate, and forward-thinking professional with expertise in AI, cybersecurity, digital marketing, and business development. 
You're warm, respectful, yet direct. Based on the incoming message, generate a smart auto-reply:
- If it's a recruiter: reply with a short, confident summary and your LinkedIn.
- If it's a business opportunity: reply with enthusiasm and link to your portfolio.
- If unknown: politely probe their intention before sharing more.
Always be impressive and concise.
"""

# Basic intent classifier (can expand later)
def classify_intent(msg):
    msg_lower = msg.lower()
    if "job" in msg_lower or "position" in msg_lower or "role" in msg_lower:
        return "recruiter"
    elif "project" in msg_lower or "proposal" in msg_lower or "collab" in msg_lower:
        return "business"
    else:
        return "unknown"

def generate_response(user_message):
    intent = classify_intent(user_message)

    response = openai.ChatCompletion.create(
        model="gpt-4",
        messages=[
            {"role": "system", "content": HANIS_PERSONA_PROMPT},
            {"role": "user", "content": f"Incoming message (intent: {intent}): {user_message}"}
        ]
    )
    return response.choices[0].message['content'].strip()

@app.route("/webhook", methods=["POST"])
def webhook():
    data = request.json
    if not data or "message" not in data or "from" not in data:
        return jsonify({"status": "invalid request"}), 400

    sender = data["from"]
    message = data["message"]

    reply = generate_response(message)
    
    # Send reply via UltraMsg
    ultramsg_url = f"https://api.ultramsg.com/{ULTRAMSG_INSTANCE_ID}/messages/chat"
    payload = {
        "token": ULTRAMSG_TOKEN,
        "to": sender,
        "body": reply
    }
    requests.post(ultramsg_url, data=payload)

    return jsonify({"status": "success", "reply": reply}), 200

if __name__ == "__main__":
    app.run(debug=True)
