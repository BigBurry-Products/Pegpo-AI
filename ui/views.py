# ui/views.py
import os
import json
import traceback
from django.shortcuts import render
from django.http import StreamingHttpResponse, JsonResponse
from django.views.decorators.csrf import csrf_exempt

try:
    import google.generativeai as genai
    _HAS_GENAI = True
except Exception:
    genai = None
    _HAS_GENAI = False

API_KEY = os.getenv("GEMINI_API_KEY")


def chat_view(request):
    return render(request, "chat_app.html")


def response_demo_view(request):
    """Demo page for the response section"""
    return render(request, "response_demo.html")



def sse_format(data: str) -> str:
    return f"data: {data}\n\n"


@csrf_exempt
def chat_api(request):
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
        return JsonResponse(
            {"error": "google-generativeai package not installed"},
            status=500,
        )

    if not API_KEY:
        return JsonResponse(
            {"error": "GEMINI_API_KEY not found in environment"},
            status=500,
        )

    def event_stream():
        try:
            genai.configure(api_key=API_KEY)
            model = genai.GenerativeModel("gemini-2.5-flash")

            response = model.generate_content(
                user_message,
                stream=True
            )

            for chunk in response:
                text = None

                # ✅ Proper Gemini chunk extraction
                if hasattr(chunk, "text") and chunk.text:
                    text = chunk.text
                else:
                    candidates = getattr(chunk, "candidates", None)
                    if candidates:
                        content = getattr(candidates[0], "content", None)
                        if content and content.parts:
                            text = getattr(content.parts[0], "text", None)

                if text:
                    yield sse_format(text)
                    yield ""  # force flush

        except Exception:
            traceback.print_exc()
            yield sse_format("[ERROR] Gemini request failed")

        yield sse_format("[DONE]")

    return StreamingHttpResponse(
        event_stream(),
        content_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )
