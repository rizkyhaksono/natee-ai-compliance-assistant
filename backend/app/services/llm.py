import json
import logging
import asyncio
import threading
from typing import Optional, AsyncGenerator
import httpx
import boto3
from botocore.exceptions import BotoCoreError, ClientError
from app.config import get_settings

logger = logging.getLogger(__name__)


class LLMService:
    """Interacts with configured LLM provider (Ollama or AWS Bedrock Nova)."""

    def __init__(self):
        self.settings = get_settings()
        self.provider = self.settings.llm_provider.lower()
        self.base_url = self.settings.ollama_base_url
        self.model = self.settings.ollama_model
        self.aws_region = self.settings.aws_region
        self.aws_model_id = self.settings.aws_bedrock_model_id
        self._bedrock_runtime = None
        self._sts_client = None

        if self.provider not in {"ollama", "bedrock_nova"}:
            raise ValueError(f"Unsupported LLM provider: {self.provider}")

    def _get_bedrock_runtime(self):
        if self._bedrock_runtime is None:
            self._bedrock_runtime = boto3.client("bedrock-runtime", region_name=self.aws_region)
        return self._bedrock_runtime

    def _get_sts_client(self):
        if self._sts_client is None:
            self._sts_client = boto3.client("sts", region_name=self.aws_region)
        return self._sts_client

    def _build_bedrock_payload(self, prompt: str, system_prompt: Optional[str], temperature: float, max_tokens: int):
        payload = {
            "modelId": self.aws_model_id,
            "messages": [{"role": "user", "content": [{"text": prompt}]}],
            "inferenceConfig": {
                "temperature": temperature,
                "maxTokens": max_tokens,
            },
        }
        if system_prompt:
            payload["system"] = [{"text": system_prompt}]
        return payload

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

        async with httpx.AsyncClient(timeout=120.0) as client:
            response = await client.post(
                f"{self.base_url}/api/chat",
                json={
                    "model": self.model,
                    "messages": messages,
                    "stream": False,
                    "options": {
                        "temperature": temperature,
                        "num_predict": max_tokens,
                    },
                },
            )
            response.raise_for_status()
            data = response.json()
            return data["message"]["content"]

    async def _generate_with_bedrock(
        self,
        prompt: str,
        system_prompt: Optional[str],
        temperature: float,
        max_tokens: int,
    ) -> str:
        runtime = self._get_bedrock_runtime()
        payload = self._build_bedrock_payload(prompt, system_prompt, temperature, max_tokens)

        def _invoke():
            return runtime.converse(**payload)

        response = await asyncio.to_thread(_invoke)
        content = response.get("output", {}).get("message", {}).get("content", [])
        text_parts = [item.get("text", "") for item in content if isinstance(item, dict) and "text" in item]
        return "".join(text_parts)

    async def generate(
        self,
        prompt: str,
        system_prompt: Optional[str] = None,
        temperature: float = 0.1,
        max_tokens: int = 2048,
    ) -> str:
        if self.provider == "bedrock_nova":
            return await self._generate_with_bedrock(prompt, system_prompt, temperature, max_tokens)
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

        async with httpx.AsyncClient(timeout=120.0) as client:
            async with client.stream(
                "POST",
                f"{self.base_url}/api/chat",
                json={
                    "model": self.model,
                    "messages": messages,
                    "stream": True,
                    "options": {
                        "temperature": temperature,
                        "num_predict": max_tokens,
                    },
                },
            ) as response:
                response.raise_for_status()
                async for line in response.aiter_lines():
                    if line:
                        data = json.loads(line)
                        if "message" in data and "content" in data["message"]:
                            yield data["message"]["content"]

    async def _generate_stream_with_bedrock(
        self,
        prompt: str,
        system_prompt: Optional[str],
        temperature: float,
        max_tokens: int,
    ) -> AsyncGenerator[str, None]:
        runtime = self._get_bedrock_runtime()
        payload = self._build_bedrock_payload(prompt, system_prompt, temperature, max_tokens)

        loop = asyncio.get_running_loop()
        queue: asyncio.Queue = asyncio.Queue()
        sentinel = object()

        def _worker():
            try:
                response = runtime.converse_stream(**payload)
                for event in response.get("stream", []):
                    delta = event.get("contentBlockDelta", {}).get("delta", {})
                    text = delta.get("text")
                    if text:
                        loop.call_soon_threadsafe(queue.put_nowait, text)
            except Exception as exc:
                loop.call_soon_threadsafe(queue.put_nowait, exc)
            finally:
                loop.call_soon_threadsafe(queue.put_nowait, sentinel)

        threading.Thread(target=_worker, daemon=True).start()

        while True:
            item = await queue.get()
            if item is sentinel:
                break
            if isinstance(item, Exception):
                raise item
            yield item

    async def generate_stream(
        self,
        prompt: str,
        system_prompt: Optional[str] = None,
        temperature: float = 0.1,
        max_tokens: int = 2048,
    ) -> AsyncGenerator[str, None]:
        if self.provider == "bedrock_nova":
            async for token in self._generate_stream_with_bedrock(prompt, system_prompt, temperature, max_tokens):
                yield token
            return
        async for token in self._generate_stream_with_ollama(prompt, system_prompt, temperature, max_tokens):
            yield token

    async def is_available(self) -> bool:
        try:
            if self.provider == "bedrock_nova":
                sts_client = self._get_sts_client()

                def _check_sts():
                    sts_client.get_caller_identity()

                await asyncio.to_thread(_check_sts)
                return True

            async with httpx.AsyncClient(timeout=5.0) as client:
                response = await client.get(f"{self.base_url}/api/tags")
                return response.status_code == 200
        except (BotoCoreError, ClientError, httpx.HTTPError, Exception) as err:
            logger.warning("LLM availability check failed for provider %s: %s", self.provider, err)
            return False
