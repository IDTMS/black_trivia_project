import hashlib
import hmac
import os
from urllib.parse import urljoin

import requests
from django.conf import settings


DEFAULT_WALLET = "0x0000000000000000000000000000000000000000"


class HavnAIUnavailable(RuntimeError):
    pass


class HavnAIRequestError(RuntimeError):
    pass


def _config():
    base_url = os.getenv("HAVNAI_API_BASE_URL", "").strip().rstrip("/")
    owner_token = os.getenv("HAVNAI_OWNER_TOKEN", "").strip()
    if not base_url or not owner_token:
        raise HavnAIUnavailable(
            "HavnAI media generation is not configured for Black Card yet."
        )

    return {
        "base_url": base_url,
        "owner_token": owner_token,
        "model": os.getenv(
            "HAVNAI_BLACKCARD_IMAGE_MODEL", "juggernautXL_ragnarokBy"
        ).strip(),
        "wallet": os.getenv("HAVNAI_BLACKCARD_WALLET", DEFAULT_WALLET).strip(),
        "width": int(os.getenv("HAVNAI_BLACKCARD_IMAGE_WIDTH", "768")),
        "height": int(os.getenv("HAVNAI_BLACKCARD_IMAGE_HEIGHT", "1024")),
        "timeout": float(os.getenv("HAVNAI_BLACKCARD_HTTP_TIMEOUT", "20")),
    }


def _headers(config):
    return {
        "Authorization": f"Bearer {config['owner_token']}",
        "Content-Type": "application/json",
        "User-Agent": "BlackCard-HavnAI/1.0",
    }


def _raise_for_response(response):
    try:
        response.raise_for_status()
    except requests.RequestException as exc:
        message = "HavnAI request failed."
        try:
            payload = response.json()
            message = payload.get("message") or payload.get("error") or message
        except ValueError:
            pass
        raise HavnAIRequestError(str(message)) from exc


def submit_rivalry_art(prompt):
    config = _config()
    payload = {
        "type": "image",
        "prompt": prompt,
        "negative_prompt": (
            "words, letters, numbers, captions, typography, logo, watermark, "
            "signature, low quality, blurry, duplicate objects"
        ),
        "model": config["model"],
        "wallet": config["wallet"],
        "width": config["width"],
        "height": config["height"],
    }

    try:
        response = requests.post(
            f"{config['base_url']}/v1/jobs",
            json=payload,
            headers=_headers(config),
            timeout=config["timeout"],
        )
    except requests.RequestException as exc:
        raise HavnAIRequestError("Could not reach the HavnAI coordinator.") from exc

    _raise_for_response(response)
    data = response.json()
    job_id = str(data.get("id") or "").strip()
    if not job_id:
        raise HavnAIRequestError("HavnAI did not return a job id.")

    return normalize_job(data, config["base_url"])


def get_rivalry_art_job(job_id):
    config = _config()
    try:
        response = requests.get(
            f"{config['base_url']}/v1/jobs/{job_id}",
            headers=_headers(config),
            timeout=config["timeout"],
        )
    except requests.RequestException as exc:
        raise HavnAIRequestError("Could not reach the HavnAI coordinator.") from exc

    _raise_for_response(response)
    return normalize_job(response.json(), config["base_url"])


def normalize_job(data, base_url):
    artifacts = []
    for artifact in data.get("artifacts") or []:
        item = dict(artifact)
        url = str(item.get("url") or "").strip()
        if url:
            item["url"] = urljoin(f"{base_url}/", url.lstrip("/"))
        artifacts.append(item)

    image_url = next(
        (
            item.get("url")
            for item in artifacts
            if item.get("kind") == "image" and item.get("url")
        ),
        None,
    )

    return {
        "job_id": str(data.get("id") or ""),
        "status": str(data.get("status") or "queued"),
        "stage": str(data.get("stage") or data.get("status") or "queued"),
        "progress": float(data.get("progress") or 0),
        "model": data.get("model"),
        "image_url": image_url,
        "artifacts": artifacts,
        "error_code": data.get("error_code"),
    }


def sign_media_job(match_id, user_id, job_id):
    message = f"{match_id}:{user_id}:{job_id}".encode("utf-8")
    secret = settings.SECRET_KEY.encode("utf-8")
    return hmac.new(secret, message, hashlib.sha256).hexdigest()


def verify_media_job_signature(match_id, user_id, job_id, signature):
    expected = sign_media_job(match_id, user_id, job_id)
    return hmac.compare_digest(expected, str(signature or ""))
