"""
Package initializer for config.
Imports Celery app if installed.
"""
try:
    from .celery import app as celery_app
    __all__ = ("celery_app",)
except ImportError:
    pass
