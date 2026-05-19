#!/usr/bin/env python
"""Django management entry point."""

import os
import sys


def main() -> None:
    """Run administrative tasks."""
    os.environ.setdefault("DJANGO_SETTINGS_MODULE", "web_api.settings.dev")
    try:
        from django.core.management import execute_from_command_line  # noqa: PLC0415
    except ImportError as exc:
        raise ImportError("Couldn't import Django. Run `uv sync` to install dependencies.") from exc
    execute_from_command_line(sys.argv)


if __name__ == "__main__":
    main()
