import json
import logging
from typing import Optional, AsyncGenerator
import httpx
from app.config import get_settings

logger = logging.getLogger(__name__)


class LLMService:
    """Interacts with Ollama chat API."""

    def __init__(self):
        self.settings = get_settings()
        self.provider = "ollama"
        self.base_url = self.settings.ollama_base_url
        self.model = self.settings.ollama_model

    async def _generate_with_ollama(
        self,
        prompt: str,
        system_prompt: Optional[str],
        temperature: float,
        max_tokens: int,
    ) -> str:
        messages = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": prompt})

        async with httpx.AsyncClient(timeout=600.0) as client:
            response = await client.post(
                f"{self.base_url}/api/chat",
                json={
                    "model": self.model,
                    "messages": messages,
                    "stream": False,
                    "think": False,
                    "options": {
                        "temperature": temperature,
                        "num_predict": -1,
                    },
                },
            )
            response.raise_for_status()
            data = response.json()
            return data["message"]["content"]

    async def generate(
        self,
        prompt: str,
        system_prompt: Optional[str] = None,
        temperature: float = 0.1,
        max_tokens: int = 2048,
    ) -> str:
        return await self._generate_with_ollama(prompt, system_prompt, temperature, max_tokens)

    async def _generate_stream_with_ollama(
        self,
        prompt: str,
        system_prompt: Optional[str],
        temperature: float,
        max_tokens: int,
    ) -> AsyncGenerator[str, None]:
        messages = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": prompt})

        async with httpx.AsyncClient(timeout=600.0) as client:
            async with client.stream(
                "POST",
                f"{self.base_url}/api/chat",
                json={
                    "model": self.model,
                    "messages": messages,
                    "stream": True,
                    "think": False,
                    "options": {
                        "temperature": temperature,
                        "num_predict": -1,
                    },
                },
            ) as response:
                response.raise_for_status()
                async for line in response.aiter_lines():
                    if line:
                        data = json.loads(line)
                        # qwen3.5 is a thinking model — skip empty content tokens
                        # (produced during the internal thinking/reasoning phase)
                        content = data.get("message", {}).get("content", "")
                        if content:
                            yield content

    async def generate_stream(
        self,
        prompt: str,
        system_prompt: Optional[str] = None,
        temperature: float = 0.1,
        max_tokens: int = 2048,
    ) -> AsyncGenerator[str, None]:
        async for token in self._generate_stream_with_ollama(prompt, system_prompt, temperature, max_tokens):
            yield token

    async def is_available(self) -> bool:
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                response = await client.get(f"{self.base_url}/api/tags")
                return response.status_code == 200
        except (httpx.HTTPError, Exception) as err:
            logger.warning("LLM availability check failed for provider %s: %s", self.provider, err)
            return False
