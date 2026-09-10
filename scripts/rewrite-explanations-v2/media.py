"""Attach question media only when the answer is in the picture and text cannot explain it."""

from __future__ import annotations

import base64
import json
import re
import subprocess
from pathlib import Path

from packs import CountryPack
from util import cache_dir, clean_text, http_get, load_env, localized

GENERIC_SCENE = re.compile(
    r"(?is)^(situace vyplývá|the situation follows|vyobrazená dopravní situace se posuzuje)"
)


def extract_media_assets(question: dict) -> list[dict]:
    content = question.get("content") or {}
    assets: list[dict] = []
    for item in content.get("question_media") or []:
        asset = item.get("asset") or {}
        if asset.get("storagePath") or asset.get("originalFilename"):
            assets.append(
                {
                    "placement": "question",
                    "optionId": None,
                    "mediaType": asset.get("mediaType") or item.get("mediaType"),
                    "bucket": asset.get("storageBucket") or "",
                    "path": asset.get("storagePath") or asset.get("resolvedFilename") or "",
                    "filename": asset.get("originalFilename") or asset.get("resolvedFilename") or "",
                }
            )
    for option in content.get("options") or []:
        for item in option.get("media") or []:
            asset = item.get("asset") or item
            assets.append(
                {
                    "placement": "option",
                    "optionId": option.get("id"),
                    "mediaType": asset.get("mediaType"),
                    "bucket": asset.get("storageBucket") or "",
                    "path": asset.get("storagePath") or "",
                    "filename": asset.get("originalFilename") or asset.get("resolvedFilename") or "",
                }
            )
    context_media = ((question.get("context") or {}).get("context") or {}).get("media") or []
    if not assets and context_media:
        for item in context_media:
            assets.append(
                {
                    "placement": item.get("placement") or "question",
                    "optionId": item.get("option_key"),
                    "mediaType": item.get("media_type"),
                    "bucket": "question-videos" if item.get("media_type") == "video" else "question-images",
                    "path": item.get("filename") or "",
                    "filename": item.get("filename") or "",
                }
            )
    return [asset for asset in assets if asset.get("path") or asset.get("filename")]


def _scene_text(pack: CountryPack, question: dict) -> tuple[str, str, list]:
    ctx = (question.get("context") or {}).get("context") or {}
    visual = ctx.get("visual_analysis") or {}
    scene = clean_text(
        visual.get("scene_cs") or visual.get("scene") or visual.get(f"scene_{pack.locale}") or ""
    )
    return str(visual.get("status") or ""), scene, ctx.get("verified_signs") or []


def has_usable_text_context(pack: CountryPack, question: dict, prompt: str) -> bool:
    """True when the stored scene/signs already replace the picture."""
    status, scene, signs = _scene_text(pack, question)
    if signs:
        return True
    if status == "manually_verified" and len(scene) >= 40 and not GENERIC_SCENE.search(scene):
        return True
    if len(scene) >= 50 and not GENERIC_SCENE.search(scene) and (not prompt or prompt[:50] not in scene):
        return True
    return False


def prompt_is_self_contained(pack: CountryPack, prompt: str) -> bool:
    text = prompt or ""
    if re.search(pack.generic_prompt_re, text):
        return False
    return len(text) >= 70


def needs_picture(pack: CountryPack, question: dict, prompt: str) -> bool:
    """Picture only if the exam item is the scene and text/context cannot describe it."""
    if not extract_media_assets(question):
        return False
    if has_usable_text_context(pack, question, prompt):
        return False
    if prompt_is_self_contained(pack, prompt):
        return False
    return True


def context_is_thin(pack: CountryPack, question: dict, prompt: str) -> bool:
    """Broader than needs_picture. Used only with --media on."""
    if not extract_media_assets(question):
        return False
    if has_usable_text_context(pack, question, prompt):
        return False
    status, scene, signs = _scene_text(pack, question)
    if status in {"official_text_only", "local-textual-description", ""}:
        return True
    if scene and GENERIC_SCENE.search(scene):
        return True
    if prompt and scene and prompt[:80] in scene:
        return True
    if re.search(pack.generic_prompt_re, prompt) and (not scene or len(scene) < 60):
        return True
    if re.search(pack.sign_word, prompt, re.I) and not signs:
        return True
    return len(scene) < 40


def should_attach_media(mode: str, pack: CountryPack, question: dict, prompt: str) -> bool:
    if mode == "off":
        return False
    if mode == "force":
        return bool(extract_media_assets(question))
    if mode == "on":
        return context_is_thin(pack, question, prompt)
    return needs_picture(pack, question, prompt)


def _candidate_paths(pack: CountryPack, asset: dict) -> list[Path]:
    names = [asset.get("path") or "", asset.get("filename") or ""]
    stem = Path(asset.get("filename") or asset.get("path") or "file").stem
    names.extend([f"{stem}.webp", f"{stem}.jpg", f"{stem}.png", f"{stem}.mp4"])
    names = [name for name in names if name]
    paths: list[Path] = []
    for root in pack.media_local_roots:
        for name in names:
            paths.append(root / name)
            if asset.get("bucket"):
                paths.append(root / asset["bucket"] / name)
            paths.append(root / "question-images" / name)
            paths.append(root / "question-videos" / name)
    return paths


def _public_url(pack: CountryPack, asset: dict) -> str | None:
    env = load_env()
    base = (env.get(pack.media_env_key) or "").rstrip("/")
    if not base:
        return None
    filename = asset.get("path") or asset.get("filename")
    if not filename:
        return None
    bucket = asset.get("bucket") or (
        "question-videos" if asset.get("mediaType") == "video" else "question-images"
    )
    return f"{base}/{bucket}/{filename}"


def _download_to_cache(pack: CountryPack, url: str, filename: str) -> Path:
    dest = cache_dir(pack.code) / "media" / filename.replace("/", "_")
    dest.parent.mkdir(parents=True, exist_ok=True)
    if dest.exists() and dest.stat().st_size > 0:
        return dest
    dest.write_bytes(http_get(url, timeout=120))
    return dest


def _ffmpeg_one_frame(pack: CountryPack, video_path: Path) -> Path | None:
    frame = cache_dir(pack.code) / "frames" / video_path.stem / "01.jpg"
    frame.parent.mkdir(parents=True, exist_ok=True)
    if frame.exists() and frame.stat().st_size > 0:
        return frame
    cmd = [
        "ffmpeg",
        "-y",
        "-v",
        "error",
        "-ss",
        "1",
        "-i",
        str(video_path),
        "-frames:v",
        "1",
        "-vf",
        "scale=min(512\\,iw):-2",
        str(frame),
    ]
    try:
        subprocess.run(cmd, check=True, capture_output=True)
    except (FileNotFoundError, subprocess.CalledProcessError) as exc:
        print(json.dumps({"ffmpegFailed": str(video_path), "error": str(exc)[:200]}), flush=True)
        return frame if frame.exists() and frame.stat().st_size > 0 else None
    return frame if frame.exists() and frame.stat().st_size > 0 else None


def _file_to_data_url(path: Path) -> str:
    suffix = path.suffix.lower()
    mime = {".png": "image/png", ".webp": "image/webp", ".gif": "image/gif"}.get(suffix, "image/jpeg")
    encoded = base64.b64encode(path.read_bytes()).decode("ascii")
    return f"data:{mime};base64,{encoded}"


def _image_block(url: str, detail: str = "low") -> dict:
    return {"type": "image_url", "image_url": {"url": url, "detail": detail}}


def _pick_assets(question: dict) -> list[dict]:
    """One still for a scene, or one still per pictured option (A/B/C)."""
    assets = extract_media_assets(question)
    option_assets = [asset for asset in assets if asset.get("placement") == "option"]
    if option_assets:
        picked: list[dict] = []
        seen: set[str] = set()
        for asset in option_assets:
            option_id = str(asset.get("optionId") or "")
            if option_id in seen:
                continue
            seen.add(option_id)
            picked.append(asset)
            if len(picked) >= 3:
                break
        return picked
    return assets[:1]


def resolve_media_blocks(
    pack: CountryPack,
    question: dict,
    *,
    detail: str = "low",
) -> tuple[list[dict], bool]:
    """Stills for the model. Caller decides whether to invoke this."""
    assets = _pick_assets(question)
    if not assets:
        return [], False
    blocks: list[dict] = []
    for asset in assets:
        label = f"Attachment: {asset['placement']}"
        if asset.get("optionId"):
            label += f" option {asset['optionId']}"
        label += f", {asset.get('filename') or asset.get('path')}"
        local = next((path for path in _candidate_paths(pack, asset) if path.exists()), None)
        public = _public_url(pack, asset)
        is_video = (asset.get("mediaType") == "video") or str(asset.get("path") or "").endswith(".mp4")
        if is_video:
            video_path = local
            if video_path is None and public:
                try:
                    video_path = _download_to_cache(pack, public, Path(asset.get("path") or "clip.mp4").name)
                except Exception as exc:  # noqa: BLE001
                    print(json.dumps({"mediaDownloadFailed": public, "error": str(exc)[:200]}), flush=True)
            if video_path is None:
                continue
            frame = _ffmpeg_one_frame(pack, video_path)
            if frame is None:
                continue
            blocks.append({"type": "text", "text": label})
            blocks.append(_image_block(_file_to_data_url(frame), detail))
            continue
        blocks.append({"type": "text", "text": label})
        if public:
            blocks.append(_image_block(public, detail))
        elif local is not None:
            blocks.append(_image_block(_file_to_data_url(local), detail))
    return blocks, bool(blocks)


def prompt_locale(pack: CountryPack, question: dict) -> str:
    content = question.get("content") or {}
    ctx = (question.get("context") or {}).get("context") or {}
    return localized(content.get("prompt"), pack.locale, *pack.write_locales) or clean_text(
        ctx.get(f"prompt_{pack.locale}") or ctx.get("prompt_cs") or ""
    )
