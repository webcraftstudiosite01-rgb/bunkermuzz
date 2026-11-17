#!/usr/bin/env python
"""Django's command-line utility for administrative tasks."""
import os
import sys
from pathlib import Path


def main():
    """Run administrative tasks."""
    os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')

    # Ensure projects directory is on sys.path
    projects_dir = Path(__file__).resolve().parent
    if str(projects_dir) not in sys.path:
        sys.path.insert(0, str(projects_dir))

    # Default runserver to port 5000
    if len(sys.argv) > 1 and sys.argv[1] == 'runserver':
        args_without_options = [arg for arg in sys.argv[2:] if not arg.startswith('-')]
        if not args_without_options:
            sys.argv.append('5000')

    try:
        from django.core.management import execute_from_command_line
    except ImportError as exc:
        raise ImportError(
            "Couldn't import Django. Are you sure it's installed and "
            "available on your PYTHONPATH environment variable? Did you "
            "forget to activate a virtual environment?"
        ) from exc
    execute_from_command_line(sys.argv)


if __name__ == '__main__':
    main()
