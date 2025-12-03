# ui/views.py
import os
import json
import traceback
from django.shortcuts import render
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt

# Lazy import for the Gemini SDK
try:
    import google.generativeai as genai
    _HAS_GENAI = True
except Exception:
    genai = None
    _HAS_GENAI = False

API_KEY = os.getenv("GEMINI_API_KEY")

def chat_view(request):
    """
    Renders the chat UI template. Make sure templates/chat_app.html exists.
    """
    return render(request, "chat_app.html")


@csrf_exempt
def chat_api(request):
    """
    API endpoint used by frontend JavaScript to get responses.
    Expects JSON body: { "message": "..." }
    """
    if request.method != "POST":
        return JsonResponse({"error": "POST required"}, status=400)

    try:
        body = json.loads(request.body or b"{}")
    except Exception:
        return JsonResponse({"error": "Invalid JSON body"}, status=400)

    user_message = (body.get("message") or "").strip()
    if not user_message:
        return JsonResponse({"error": "Message is empty"}, status=400)

    if not _HAS_GENAI:
        return JsonResponse({"error": "google-generativeai package not installed (pip install google-generativeai)"}, status=500)

    if not API_KEY:
        return JsonResponse({"error": "GEMINI_API_KEY not found in environment (.env not loaded or variable missing)."}, status=500)

    try:
        genai.configure(api_key=API_KEY)
        model = genai.GenerativeModel("gemini-2.5-flash")
        resp = model.generate_content(user_message)

        # Try to extract text from SDK response
        reply = None
        if hasattr(resp, "text") and resp.text:
            reply = resp.text
        else:
            candidate = getattr(resp, "candidates", None)
            if candidate and len(candidate) > 0 and getattr(candidate[0], "content", None):
                parts = getattr(candidate[0].content, "parts", None)
                if parts and len(parts) > 0:
                    reply = getattr(parts[0], "text", None)

        if reply is None:
            reply = ""

        return JsonResponse({"response": reply})

    except Exception as e:
        traceback.print_exc()
        return JsonResponse({"error": "Gemini request failed", "detail": str(e)}, status=500)
