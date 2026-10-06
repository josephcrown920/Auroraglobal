#!/usr/bin/env python3
"""
Safe Smoke Test & Validation for Viral Video Plan and Generation Pipeline.
Validates datasets, schema, prompt synthesis, and generator logic without external API calls or secrets.
"""
import os
import sys
import json
import csv
import ast
from unittest.mock import MagicMock

# Ensure mock imports if dependencies are not yet installed in bare environments
for mod_name in ['ffmpeg', 'requests']:
    if mod_name not in sys.modules:
        try:
            __import__(mod_name)
        except ImportError:
            sys.modules[mod_name] = MagicMock()

def test_plan_json(json_path):
    print(f"Checking {json_path}...")
    if not os.path.exists(json_path):
        raise FileNotFoundError(f"Missing {json_path}")
    with open(json_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    if not isinstance(data, list):
        raise ValueError("viral_video_plans.json must be a list")
    if len(data) != 40:
        raise ValueError(f"Expected 40 video plans, found {len(data)}")
    
    required_keys = {'id', 'location', 'outfit', 'eatery', 'vibe', 'ending', 'flair'}
    for idx, item in enumerate(data, start=1):
        if item.get('id') != idx:
            raise ValueError(f"Item at index {idx} has invalid id: {item.get('id')}")
        missing = required_keys - set(item.keys())
        if missing:
            raise ValueError(f"Item {idx} missing keys: {missing}")
        for k in required_keys:
            if not isinstance(item[k], (str, int)) or (isinstance(item[k], str) and not item[k].strip()):
                raise ValueError(f"Item {idx} key '{k}' has empty or invalid value")
    print("  ✓ JSON dataset valid (40/40 presets conform to schema).")
    return data

def test_plan_csv(csv_path, expected_count=40):
    print(f"Checking {csv_path}...")
    if not os.path.exists(csv_path):
        raise FileNotFoundError(f"Missing {csv_path}")
    with open(csv_path, 'r', encoding='utf-8') as f:
        reader = list(csv.DictReader(f))
    if len(reader) != expected_count:
        raise ValueError(f"Expected {expected_count} rows in CSV, got {len(reader)}")
    print(f"  ✓ CSV dataset valid ({len(reader)} rows verified).")

def test_prompt_builders(script_path, sample_scene):
    print(f"Testing prompt builder functions in {script_path}...")
    with open(script_path, 'r', encoding='utf-8') as f:
        tree = ast.parse(f.read(), filename=script_path)
    
    print("  ✓ Script syntax parsed successfully.")

    import importlib.util
    spec = importlib.util.spec_from_file_location("generate_videos", script_path)
    mod = importlib.util.module_from_spec(spec)
    
    # Avoid execution of main block
    mod.MODELARK_API_KEY = "SMOKE_TEST_DUMMY_KEY"
    mod.NUM_VIDEOS = 1
    
    spec.loader.exec_module(mod)
    
    walk = mod.build_walk_prompt(sample_scene)
    perf = mod.build_perf_prompt(sample_scene)
    end = mod.build_end_prompt(sample_scene)
    cop_idle = mod.build_cop_idle_prompt(sample_scene)
    cop_run = mod.build_cop_run_prompt(sample_scene)
    
    for name, p in [('walk', walk), ('perf', perf), ('end', end), ('cop_idle', cop_idle), ('cop_run', cop_run)]:
        if not p or len(p.strip()) < 20:
            raise ValueError(f"Prompt builder '{name}' generated empty or too short prompt")
        has_context = (
            sample_scene['location'] in p or
            sample_scene['outfit'] in p or
            sample_scene['ending'] in p or
            sample_scene['vibe'] in p or
            sample_scene['flair'] in p
        )
        if not has_context:
            raise ValueError(f"Prompt '{name}' did not inject scene attributes")
    print("  ✓ All 5 prompt templates generate verified cinematic instructions.")

def main():
    root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
    json_path = os.path.join(root, 'viral_video_plans.json')
    csv_path = os.path.join(root, 'viral_video_plans.csv')
    script_path = os.path.join(root, 'generate_videos.py')
    
    try:
        scenes = test_plan_json(json_path)
        test_plan_csv(csv_path)
        test_prompt_builders(script_path, scenes[0])
        print("\nAll viral video smoke tests passed successfully!")
    except Exception as e:
        print(f"\nSmoke test failed: {e}", file=sys.stderr)
        sys.exit(1)

if __name__ == '__main__':
    main()
