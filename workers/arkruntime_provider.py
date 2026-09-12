"""Official Ark Runtime SDK bridge for Aurora Python workers.

The TypeScript Aurora app remains the canonical API surface. This module gives
Python GPU workers a validated place to use the official arkruntime package for
new Ark capabilities without mixing legacy SDK request/response types.
"""
from __future__ import annotations

import os
from typing import Any

from arkruntime import Ark


ARK_BASE_URL = os.getenv("ARK_BASE_URL", "https://ark.ap-southeast.bytepluses.com/api/v3")


def client() -> Ark:
    api_key = os.environ.get("ARK_API_KEY") or os.environ.get("BYTEPLUS_API_KEY")
    if not api_key:
        raise RuntimeError("ARK_API_KEY or BYTEPLUS_API_KEY is required")
    return Ark(api_key=api_key, base_url=ARK_BASE_URL)


def generate_image(*, model: str, prompt: str, background: str | None = None, image: str | list[str] | None = None, **kwargs: Any) -> Any:
    payload: dict[str, Any] = {"model": model, "prompt": prompt, **kwargs}
    if background is not None:
        payload["background"] = background
    if image is not None:
        payload["image"] = image
    return client().images.generate(**payload)


def responses_create(*, model: str, input: Any, **kwargs: Any) -> Any:
    return client().responses.create(model=model, input=input, **kwargs)


def chat_create(*, model: str, messages: list[dict[str, Any]], **kwargs: Any) -> Any:
    return client().chat.completions.create(model=model, messages=messages, **kwargs)


def create_content_generation_task(**kwargs: Any) -> Any:
    """Create an Ark content-generation task.

    Keep this call isolated because content-generation payload shapes vary by
    model. Callers must pass IDs/inputs owned by the current account.
    """
    return client().content_generation.tasks.create(**kwargs)
