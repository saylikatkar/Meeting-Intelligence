from django.urls import path
from .views import (
    ExportPDFView,
    ExportDocxView,
    ExportTxtView,
    ExportSRTView,
    ExportJSONView
)

urlpatterns = [
    path("<str:meeting_id>/export/pdf/", ExportPDFView.as_view(), name="export-pdf"),
    path("<str:meeting_id>/export/docx/", ExportDocxView.as_view(), name="export-docx"),
    path("<str:meeting_id>/export/txt/", ExportTxtView.as_view(), name="export-txt"),
    path("<str:meeting_id>/export/srt/", ExportSRTView.as_view(), name="export-srt"),
    path("<str:meeting_id>/export/json/", ExportJSONView.as_view(), name="export-json"),
]
