"""
VideoPilot HTTP adapter (used as the Seedream/Seedance adapter).
Implements the endpoint calls shown in your curl examples.

Environment variables used:
- VIDEO_PILOT_API_URL (e.g. https://prompt-pilot.cn-beijing.volces.com)
- VIDEO_PILOT_API_KEY
- VIDEO_PILOT_WORKSPACE_ID

This adapter provides:
- generate_video(...) -> returns dict with client and task_id (or response)
- get_task_result(task_id) -> returns the task result JSON
- list_segment_versions(task_id, segment_index)
- regenerate_video_segment_from_feedback(task_id, segment_id, feedback)

The implementation uses requests and is defensive: times out, raises on HTTP error.
"""
from __future__ import annotations
import os
import time
from typing import Any, Dict, Optional

import requests


class VideoPilotAdapter:
    def __init__(self, api_url: Optional[str] = None, api_key: Optional[str] = None, workspace_id: Optional[str] = None, timeout: int = 30):
        self.api_url = api_url or os.environ.get("VIDEO_PILOT_API_URL")
        self.api_key = api_key or os.environ.get("VIDEO_PILOT_API_KEY")
        self.workspace_id = workspace_id or os.environ.get("VIDEO_PILOT_WORKSPACE_ID")
        self.timeout = timeout
        if not self.api_url or not self.api_key or not self.workspace_id:
            raise RuntimeError("VIDEO_PILOT_API_URL, VIDEO_PILOT_API_KEY and VIDEO_PILOT_WORKSPACE_ID must be set")

    def _post(self, params: Dict[str, str], payload: Dict[str, Any]) -> Dict[str, Any]:
        url = f"{self.api_url}/video-pilot"
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }
        # Append query params to URL
        q = "?" + "&".join([f"{k}={v}" for k, v in params.items()])
        resp = requests.post(url + q, json=payload, headers=headers, timeout=self.timeout)
        resp.raise_for_status()
        return resp.json()

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
        task_id = data.get("TaskId") or data.get("TaskId") if isinstance(data, dict) else None
        return {"client": "videopilot", "task_id": task_id, "response": data}

    def get_task_result(self, task_id: str) -> Dict[str, Any]:
        params = {"Version": "1.0", "Action": "GetTaskResult"}
        body = {"RequestId": str(int(time.time() * 1000)), "WorkspaceId": self.workspace_id, "TaskId": task_id}
        data = self._post(params, body)
        return {"client": "videopilot", "task_id": task_id, "response": data}

    def list_segment_versions(self, task_id: str, segment_index: int = 0) -> Dict[str, Any]:
        params = {"Version": "1.0", "Action": "ListSegmentVersions"}
        body = {"RequestId": str(int(time.time() * 1000)), "WorkspaceId": self.workspace_id, "TaskId": task_id, "SegmentIndex": segment_index}
        data = self._post(params, body)
        return {"client": "videopilot", "task_id": task_id, "segment_index": segment_index, "response": data}

    def regenerate_video_segment_from_feedback(self, task_id: str, segment_id: str, feedback_message: str) -> Dict[str, Any]:
        params = {"Version": "1.0", "Action": "RegenerateVideoSegmentFromFeedback"}
        body = {"RequestId": str(int(time.time() * 1000)), "WorkspaceId": self.workspace_id, "TaskId": task_id, "SegmentId": segment_id, "FeedbackMessage": feedback_message}
        data = self._post(params, body)
        return {"client": "videopilot", "task_id": task_id, "segment_id": segment_id, "response": data}
