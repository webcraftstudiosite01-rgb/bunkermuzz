from django.urls import path
from . import views
from . import crm_views

app_name = 'main'

urlpatterns = [
    # Публічний сайт ресторану
    path('', views.index, name='index'),
    path('api/orders/create/', views.api_order_create, name='api_order_create'),
    path('api/orders/track/<str:order_number>/', views.api_order_track, name='api_order_track'),
    path('api/reservations/create/', views.api_reservation_create, name='api_reservation_create'),
    path('api/reviews/create/', views.api_review_create, name='api_review_create'),

    # CRM-портал для менеджерів та адміна
    path('crm/', crm_views.crm_dashboard_view, name='crm_dashboard'),
    path('crm/login/', crm_views.crm_login_view, name='crm_login'),
    path('crm/register/', crm_views.crm_register_view, name='crm_register'),
    path('crm/logout/', crm_views.crm_logout_view, name='crm_logout'),

    # CRM AJAX API
    path('crm/api/orders/<int:order_id>/status/', crm_views.crm_api_order_status, name='crm_api_order_status'),
    path('crm/api/reservations/<int:res_id>/status/', crm_views.crm_api_reservation_status, name='crm_api_reservation_status'),
    path('crm/api/menu/<int:item_id>/toggle/', crm_views.crm_api_menu_toggle, name='crm_api_menu_toggle'),
    path('crm/api/menu/create/', crm_views.crm_api_item_create, name='crm_api_item_create'),
    path('crm/api/reviews/<int:review_id>/toggle/', crm_views.crm_api_review_toggle, name='crm_api_review_toggle'),
    path('crm/api/live-feed/', crm_views.crm_api_live_feed, name='crm_api_live_feed'),
]
