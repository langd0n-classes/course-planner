#!/usr/bin/env python3
"""Extract Blackboard Ultra content from module overview files and generate DOCX."""

import re
import sys
import subprocess
from pathlib import Path

# Check for pypandoc at import time
try:
    import pypandoc
except ImportError:
    print("ERROR: pypandoc is required. Install with: pip install pypandoc")
    print("Note: Also requires pandoc to be installed on your system")
    sys.exit(1)

# Base directory (relative to script location)

# SCRIPT_DIR = Path(__file__).parent
# BASE_DIR = SCRIPT_DIR.parent.parent / 'lms'

SCRIPT_DIR = Path(__file__).resolve().parent
repo_root = subprocess.check_output(
    ["git", "rev-parse", "--show-toplevel"],
    cwd=SCRIPT_DIR,
    text=True,
).strip()

BASE_DIR = Path(repo_root) / "lms"

def discover_modules():
    """Dynamically discover modules by scanning the lms directory."""
    modules = {}

    if not BASE_DIR.exists():
        print(f"ERROR: LMS directory not found: {BASE_DIR}")
        return modules

    for module_dir in sorted(BASE_DIR.iterdir()):
        if module_dir.is_dir() and module_dir.name.startswith('lm-'):
            # Extract module number from directory name (e.g., "lm-07-probability" -> 7)
            match = re.match(r'lm-(\d+)-(.+)', module_dir.name)
            if match:
                module_num = int(match.group(1))
                modules[module_num] = module_dir.name

    return modules


# Discover modules dynamically
MODULES = discover_modules()


def extract_blackboard_content(overview_file):
    """Extract content between Blackboard markers from overview file."""
    with open(overview_file, 'r', encoding='utf-8') as f:
        content = f.read()

    # Pattern for HTML comment markers (current standard)
    pattern = r'<!-- BLACKBOARD ULTRA CONTENT - COPY FROM HERE -->\n(.*?)\n<!-- END BLACKBOARD CONTENT -->'
    match = re.search(pattern, content, re.DOTALL)

    if match:
        return match.group(1).strip()

    # Fallback: Try markdown header pattern (older format)
    pattern2 = r'## BLACKBOARD ULTRA CONTENT\n\n<!-- Copy from here down for student-facing content -->\n\n(.*?)(?=\n---\n\n\*Note:|\Z)'
    match = re.search(pattern2, content, re.DOTALL)

    if match:
        return match.group(1).strip()

    return None


def convert_to_docx(markdown_content, output_path):
    """Convert markdown content to DOCX using pypandoc."""
    try:
        pypandoc.convert_text(
            markdown_content,
            'docx',
            format='md',
            outputfile=str(output_path),
            extra_args=[
                '--wrap=none',  # Don't wrap lines
                '--standalone'  # Create standalone document
            ]
        )
        return True
    except Exception as e:
        print(f"  ✗ Error converting to DOCX: {e}")
        return False


def process_module(module_num):
    """Process a single module."""
    if module_num not in MODULES:
        print(f"ERROR: Module {module_num} not found")
        return False

    module_name = MODULES[module_num]
    module_dir = BASE_DIR / module_name
    overview_file = module_dir / f'lm-{module_num:02d}-overview.md'

    if not overview_file.exists():
        print(f"ERROR: {overview_file} not found")
        return False

    # Extract content
    print(f"Processing Module {module_num:02d}: {module_name}")
    content = extract_blackboard_content(overview_file)

    if not content:
        print(f"  ⚠️  WARNING: No Blackboard content found in {overview_file.name}")
        return False

    # Save intermediate markdown (for debugging/review)
    md_output = module_dir / f'lm-{module_num:02d}-overview-bb.md'
    with open(md_output, 'w', encoding='utf-8') as f:
        f.write(content)
    print(f"  ✓ Created: {md_output.name}")

    # Convert to DOCX
    docx_output = module_dir / f'lm-{module_num:02d}-overview-bb.docx'
    if convert_to_docx(content, docx_output):
        print(f"  ✓ Created: {docx_output.name}")
        return True
    else:
        return False


def detect_current_module():
    """Detect module number from current working directory."""
    cwd = Path.cwd().resolve()
    base_dir_resolved = BASE_DIR.resolve()

    # Check if we're in a module directory
    if cwd.parent == base_dir_resolved:
        match = re.search(r'lm-(\d+)-', cwd.name)
        if match:
            return int(match.group(1))

    # Check if we're somewhere inside a module
    for parent in cwd.parents:
        if parent.parent == base_dir_resolved:
            match = re.search(r'lm-(\d+)-', parent.name)
            if match:
                return int(match.group(1))

    return None


def confirm_modules(modules_to_process):
    """Ask user to confirm which modules will be processed."""
    print("\nYou've requested to process the following module(s):")
    print("-" * 60)
    for module_num in sorted(modules_to_process):
        if module_num in MODULES:
            print(f"  Module {module_num:02d}: {MODULES[module_num]}")
        else:
            print(f"  Module {module_num:02d}: [NOT FOUND]")
    print("-" * 60)

    response = input("\nProceed? [y/N]: ").strip().lower()
    return response in ['y', 'yes']


def show_help():
    """Display help message."""
    help_text = """
Extract Blackboard Ultra content from module overview files.

Usage:
    python extract_blackboard.py              # Process all modules
    python extract_blackboard.py 1 3 5        # Process specific modules (with confirmation)
    python extract_blackboard.py --current    # Process current directory's module
    python extract_blackboard.py --help       # Show this help

Requirements:
    pip install pypandoc
    System pandoc must also be installed (brew/dnf/etc)

Output:
    Creates lm-##-overview-bb.md and lm-##-overview-bb.docx in each module directory
"""
    print(help_text.strip())


def main():
    """Main entry point."""
    # Check for help flag
    if '--help' in sys.argv or '-h' in sys.argv:
        show_help()
        sys.exit(0)

    # Parse command line arguments
    if len(sys.argv) == 1:
        # No arguments: process all modules
        modules_to_process = list(MODULES.keys())
        skip_confirmation = True  # Don't confirm for "all"
    elif '--current' in sys.argv:
        # Detect current module
        current = detect_current_module()
        if current is None:
            print("ERROR: Could not detect module from current directory")
            print(f"Current directory: {Path.cwd()}")
            sys.exit(1)
        modules_to_process = [current]
        skip_confirmation = True  # Don't confirm for "current"
    else:
        # Specific modules requested
        try:
            modules_to_process = [int(arg) for arg in sys.argv[1:] if arg != '--current']
        except ValueError:
            print("ERROR: Module numbers must be integers")
            show_help()
            sys.exit(1)
        skip_confirmation = False  # DO confirm for specific modules

    # Confirm before processing (unless all or current)
    if not skip_confirmation:
        if not confirm_modules(modules_to_process):
            print("\nCancelled by user.")
            sys.exit(0)

    # Process modules
    print(f"\n{'='*60}")
    print(f"Extracting Blackboard content for {len(modules_to_process)} module(s)")
    print(f"{'='*60}\n")

    success_count = 0
    for module_num in sorted(modules_to_process):
        if process_module(module_num):
            success_count += 1
        print()  # Blank line between modules

    # Summary
    print(f"{'='*60}")
    print(f"Complete! Processed {success_count}/{len(modules_to_process)} modules successfully")
    print(f"{'='*60}")


if __name__ == '__main__':
    main()
