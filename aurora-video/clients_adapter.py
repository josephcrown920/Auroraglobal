"""
VideoPilot HTTP adapter (used as the Seedream/Seedance adapter) with resilient response parsing.

Environment variables used:
- VIDEO_PILOT_API_URL (e.g. https://prompt-pilot.cn-beijing.volces.com)
- VIDEO_PILOT_API_KEY
- VIDEO_PILOT_WORKSPACE_ID

This adapter provides:
- generate_video(...) -> returns dict with client, task_id, and raw response
- get_task_result(task_id) -> returns normalized dict with status and any asset URLs
- list_segment_versions(task_id, segment_index)
- regenerate_video_segment_from_feedback(task_id, segment_id, feedback)

Parsing is defensive: it attempts multiple common locations for TaskId, Status, and output URLs.
"""
from __future__ import annotations
import os
import time
from typing import Any, Dict, Optional, List

import requests


def _deep_find_first(mapping: Any, keys: List[str]):
    """Recursively search mapping (dict/list) for the first occurrence of any key in keys (case-insensitive).
    Returns the value or None.
    """
    if mapping is None:
        return None
    if isinstance(mapping, dict):
        for k, v in mapping.items():
            if any(k.lower() == key.lower() for key in keys):
                return v
        for v in mapping.values():
            res = _deep_find_first(v, keys)
            if res is not None:
                return res
    elif isinstance(mapping, list):
        for item in mapping:
            res = _deep_find_first(item, keys)
            if res is not None:
                return res
    return None


def _collect_urls(mapping: Any) -> List[str]:
    """Recursively collect values that look like URLs from the response (strings starting with http or data:)."""
    urls: List[str] = []
    if mapping is None:
        return urls
    if isinstance(mapping, str):
        if mapping.startswith("http") or mapping.startswith("data:"):
            urls.append(mapping)
        return urls
    if isinstance(mapping, dict):
        for v in mapping.values():
            urls.extend(_collect_urls(v))
    elif isinstance(mapping, list):
        for item in mapping:
            urls.extend(_collect_urls(item))
    return urls


class VideoPilotAdapter:
    def __init__(self, api_url: Optional[str] = None, api_key: Optional[str] = None, workspace_id: Optional[str] = None, timeout: int = 30):
        self.api_url = api_url or os.environ.get("VIDEO_PILOT_API_URL")
        self.api_key = api_key or os.environ.get("VIDEO_PILOT_API_KEY")
        self.workspace_id = workspace_id or os.environ.get("VIDEO_PILOT_WORKSPACE_ID")
        self.timeout = timeout
        if not self.api_url or not self.api_key or not self.workspace_id:
            raise RuntimeError("VIDEO_PILOT_API_URL, VIDEO_PILOT_API_KEY and VIDEO_PILOT_WORKSPACE_ID must be set")

    def _post(self, params: Dict[str, str], payload: Dict[str, Any]) -> Dict[str, Any]:
        url = f"{self.api_url.rstrip('/')}/video-pilot"
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }
        # Append query params to URL
        q = "?" + "&".join([f"{k}={v}" for k, v in params.items()])
        resp = requests.post(url + q, json=payload, headers=headers, timeout=self.timeout)
        resp.raise_for_status()
        try:
            return resp.json()
        except ValueError:
            # Not JSON? return raw text
            return {"raw_text": resp.text}

    def _extract_task_id(self, resp: Any) -> Optional[str]:
        # common names
        candidates = ["TaskId", "taskId", "task_id", "TaskID", "TaskId"]
        tid = _deep_find_first(resp, candidates)
        if isinstance(tid, str) and tid:
            return tid
        # sometimes TaskId may be nested under Data or Response
        # fallback: search for a field that looks like ta-... or begins with 'ta-'
        if isinstance(resp, (dict, list)):
            urls = _collect_urls(resp)
            if urls:
                # no task id but we found urls — return None and let caller use response
                return None
        return None

    def _extract_status(self, resp: Any) -> Optional[str]:
        candidates = ["Status", "status", "State", "state", "Result", "result"]
        st = _deep_find_first(resp, candidates)
        if isinstance(st, str):
            return st
        # sometimes status is an object with 'code' or 'name'
        if isinstance(st, dict):
            for k in ("status", "state", "code", "name"):
                if k in st:
                    return st[k]
        return None

    def _extract_result_urls(self, resp: Any) -> List[str]:
        # Look for fields named Output, Outputs, Result, Results, Data
        urls = []
        for candidate in ("Output", "Outputs", "Result", "Results", "Data"):
            v = _deep_find_first(resp, [candidate])
            if v is not None:
                urls.extend(_collect_urls(v))
        # fallback: collect any urls in the entire response
        if not urls:
            urls = _collect_urls(resp)
        # dedupe
        seen = set()
        out = []
        for u in urls:
            if u not in seen:
                seen.add(u)
                out.append(u)
        return out

    def generate_video(self, ref_video_url: Optional[str] = None, user_message: str = "", ref_images: Optional[list] = None, model: str = "seedance-1-0-pro-250528", time_budget: int = 2, video_ratio: str = "16:9", video_resolution: str = "1080p", **kwargs) -> Dict[str, Any]:
        """Submit a video generation job (ImitateAndGenerateVideo).

        Returns a dict containing at least 'client' and possibly 'task_id' or the raw response.
        """
        params = {"Version": "1.0", "Action": "ImitateAndGenerateVideo"}
        body = {
            "RequestId": kwargs.pop("request_id", str(int(time.time() * 1000))),
            "WorkspaceId": self.workspace_id,
            "RefVideoUrl": ref_video_url or "",
            "UserMessage": user_message,
            "RefImages": ref_images or [],
            "Model": model,
            "TimeBudget": time_budget,
            "VideoRatio": video_ratio,
            "VideoResolution": video_resolution,
        }
        body.update(kwargs)
        data = self._post(params, body)
        # try to extract TaskId if present
        task_id = self._extract_task_id(data)
        return {"client": "videopilot", "task_id": task_id, "response": data}

    def get_task_result(self, task_id: str) -> Dict[str, Any]:
        params = {"Version": "1.0", "Action": "GetTaskResult"}
        body = {"RequestId": str(int(time.time() * 1000)), "WorkspaceId": self.workspace_id, "TaskId": task_id}
        data = self._post(params, body)
        status = self._extract_status(data)
        urls = self._extract_result_urls(data)
        return {"client": "videopilot", "task_id": task_id, "status": status, "result_urls": urls, "response": data}

    def list_segment_versions(self, task_id: str, segment_index: int = 0) -> Dict[str, Any]:
        params = {"Version": "1.0", "Action": "ListSegmentVersions"}
        body = {"RequestId": str(int(time.time() * 1000)), "WorkspaceId": self.workspace_id, "TaskId": task_id, "SegmentIndex": segment_index}
        data = self._post(params, body)
        urls = self._extract_result_urls(data)
        return {"client": "videopilot", "task_id": task_id, "segment_index": segment_index, "result_urls": urls, "response": data}

    def regenerate_video_segment_from_feedback(self, task_id: str, segment_id: str, feedback_message: str) -> Dict[str, Any]:
        params = {"Version": "1.0", "Action": "RegenerateVideoSegmentFromFeedback"}
        body = {"RequestId": str(int(time.time() * 1000)), "WorkspaceId": self.workspace_id, "TaskId": task_id, "SegmentId": segment_id, "FeedbackMessage": feedback_message}
        data = self._post(params, body)
        task_id_new = self._extract_task_id(data) or task_id
        urls = self._extract_result_urls(data)
        return {"client": "videopilot", "task_id": task_id_new, "segment_id": segment_id, "result_urls": urls, "response": data}
