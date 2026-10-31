from django.urls import path
from .views import ActionItemListCreateView, ActionItemDetailView

urlpatterns = [
    path("", ActionItemListCreateView.as_view(), name="action-list-create"),
    path("<str:action_id>/", ActionItemDetailView.as_view(), name="action-detail"),
]
