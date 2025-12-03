# ui/consumers.py

import json
from channels.generic.websocket import AsyncWebsocketConsumer
from .model_adapter import GeminiStreamAdapter  # pyright: ignore[reportMissingImports]

class ChatConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        await self.accept()
        self.adapter = GeminiStreamAdapter()

    async def disconnect(self, close_code):
        pass

    async def receive(self, text_data):
        try:
            data = json.loads(text_data)
            user_text = data.get("text", "")

            # STREAMING CHUNKS
            async for chunk in self.adapter.stream(prompt=user_text):
                await self.send(text_data=json.dumps({
                    "type": "partial",
                    "delta": chunk
                }))

            # FINAL MESSAGE
            await self.send(text_data=json.dumps({
                "type": "done",
                "text": ""  # adapter already streamed complete content
            }))

        except Exception as e:
            await self.send(text_data=json.dumps({
                "type": "error",
                "message": str(e)
            }))
