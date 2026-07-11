#!/usr/bin/env python3
"""
Split TanStack Router route files into route.tsx (config) + route.lazy.tsx (component).
Enables per-route code-splitting: only the JS for the visited route is downloaded.

Run:  python3 scripts/split-lazy-routes.py
      python3 scripts/split-lazy-routes.py canvas orchestrate   # specific routes
"""
import re, sys, os

ROUTES_DIR = "src/routes"

# Routes to split — order is cosmetic only
ROUTES = [
    "canvas", "orchestrate", "lipsync", "ugc", "music-video", "motion",
    "avatar", "spin", "colors", "photo-edit", "studio", "agent", "growth",
    "admin", "content-machine", "edit", "kids", "comfy", "creator.dashboard",
    "speech", "templates", "gallery", "dashboard", "billing", "affiliate",
    "roadmap", "marketplace", "clips", "tiktok", "connect", "contact",
    "workflows", "nexusarb", "split-reality", "reshoot", "heygen-templates",
    "gifts", "editor",
]

# Extra lines to prepend to the .tsx stub for routes whose head()/validateSearch
# reference something that isn't just string literals.
# These are small, never-changing values — safe to duplicate in the stub.
EXTRA_STUB_PREFIX = {
    # spin: head() interpolates SPIN_COUNT — import the constant
    "spin": (
        'import { SPIN_COUNT } from "@/lib/spin-engine";\n'
    ),
    # edit: validateSearch return type uses EditSearch
    "edit": (
        'type EditSearch = { job?: string };\n'
    ),
    # templates: validateSearch return type uses TemplateSearch
    "templates": (
        'type TemplateSearch = { open?: string; category?: string };\n'
    ),
}


def find_route_config_start(lines):
    for i, line in enumerate(lines):
        if re.match(r'^export const Route = createFileRoute\(', line):
            return i
    return None


def extract_component_name(lines, start):
    for i in range(start, min(start + 20, len(lines))):
        m = re.match(r'^\s+component:\s+(\w+),?\s*$', lines[i])
        if m:
            return m.group(1), i
    return None, None


def extract_route_path(lines, start):
    line = lines[start]
    m = re.search(r'createFileRoute\("([^"]+)"\)', line)
    if not m:
        m = re.search(r"createFileRoute\('([^']+)'\)", line)
    return m.group(1) if m else None


def find_route_block_end(lines, start):
    """Return index of the closing '});' of the Route config block."""
    depth = 0
    for i in range(start, len(lines)):
        depth += lines[i].count('{') - lines[i].count('}')
        if depth <= 0 and i > start:
            return i
    return len(lines) - 1


def process_route(name):
    path = os.path.join(ROUTES_DIR, f"{name}.tsx")
    lazy_path = os.path.join(ROUTES_DIR, f"{name}.lazy.tsx")

    if not os.path.exists(path):
        print(f"  SKIP  {name} — file not found")
        return False

    if os.path.exists(lazy_path):
        print(f"  SKIP  {name} — lazy file already exists")
        return False

    with open(path) as f:
        content = f.read()
    lines = content.splitlines(keepends=True)

    start = find_route_config_start(lines)
    if start is None:
        print(f"  SKIP  {name} — no createFileRoute found")
        return False

    route_path = extract_route_path(lines, start)
    component_name, comp_line = extract_component_name(lines, start)
    if not component_name:
        print(f"  SKIP  {name} — no component: found in route config")
        return False

    end = find_route_block_end(lines, start)

    # ── .lazy.tsx : full content, only Route export is replaced ──────────────
    lazy_lines = list(lines)

    # Patch the @tanstack/react-router import to use createLazyFileRoute
    for i, ln in enumerate(lazy_lines):
        if '@tanstack/react-router' in ln and 'import' in ln:
            m = re.search(r'import\s*\{([^}]+)\}', ln)
            if m:
                imports = [x.strip() for x in m.group(1).split(',') if x.strip()]
                imports = [x for x in imports if x != 'createFileRoute']
                if 'createLazyFileRoute' not in imports:
                    imports = ['createLazyFileRoute'] + imports
                lazy_lines[i] = f'import {{ {", ".join(imports)} }} from "@tanstack/react-router";\n'
            break

    # Replace the whole Route block with a single-line lazy export
    lazy_route = (
        f'export const Route = createLazyFileRoute("{route_path}")'
        f'({{ component: {component_name} }});\n'
    )
    lazy_lines[start : end + 1] = [lazy_route]

    with open(lazy_path, 'w') as f:
        f.write(''.join(lazy_lines))
    print(f"  LAZY  {name}.lazy.tsx  (component: {component_name})")

    # ── .tsx stub : createFileRoute + route config only, no component ─────────
    route_config_lines = list(lines[start : end + 1])
    # Drop the component: line
    route_config_lines = [
        ln for ln in route_config_lines
        if not re.match(r'^\s+component:\s+\w+,?\s*$', ln)
    ]

    extra = EXTRA_STUB_PREFIX.get(name, "")
    tsx_content = (
        f'import {{ createFileRoute }} from "@tanstack/react-router";\n'
        + (f'{extra}' if extra else '')
        + '\n'
        + ''.join(route_config_lines)
        + '\n'
    )

    with open(path, 'w') as f:
        f.write(tsx_content)
    print(f"  STUB  {name}.tsx")
    return True


def main():
    targets = sys.argv[1:] if len(sys.argv) > 1 else ROUTES
    created = sum(1 for name in targets if process_route(name))
    print(f"\nDone — {created} routes split.")


if __name__ == '__main__':
    main()
