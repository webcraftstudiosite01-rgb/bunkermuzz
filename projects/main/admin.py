from django.contrib import admin
from django.utils.html import format_html
from .models import Category, MenuItem, TableReservation, Order, OrderItem, Event, Review


@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    list_display = ('icon', 'name', 'slug', 'sort_order', 'items_count', 'is_active')
    list_editable = ('sort_order', 'is_active')
    prepopulated_fields = {'slug': ('name',)}
    search_fields = ('name',)

    def items_count(self, obj):
        return obj.items.count()
    items_count.short_description = "Кількість страв"


@admin.register(MenuItem)
class MenuItemAdmin(admin.ModelAdmin):
    list_display = ('thumb_preview', 'title', 'category', 'price', 'weight', 'is_popular', 'is_new', 'is_available')
    list_filter = ('category', 'is_popular', 'is_new', 'is_available', 'is_spicy')
    search_fields = ('title', 'description')
    list_editable = ('price', 'is_popular', 'is_new', 'is_available')
    prepopulated_fields = {'slug': ('title',)}

    def thumb_preview(self, obj):
        if obj.image_url:
            return format_html('<img src="{}" style="width: 45px; height: 45px; object-fit: cover; border-radius: 6px;" />', obj.image_url)
        return "—"
    thumb_preview.short_description = "Фото"


class OrderItemInline(admin.TabularInline):
    model = OrderItem
    extra = 0
    readonly_fields = ('item_total',)


@admin.register(Order)
class OrderAdmin(admin.ModelAdmin):
    list_display = ('order_number', 'client_name', 'client_phone', 'delivery_type', 'total_amount', 'status_badge', 'created_at')
    list_filter = ('status', 'delivery_type', 'payment_method', 'created_at')
    search_fields = ('order_number', 'client_name', 'client_phone', 'delivery_address')
    list_editable = ()
    inlines = [OrderItemInline]

    def status_badge(self, obj):
        colors = {
            'new': '#0d6efd',
            'cooking': '#ffc107',
            'delivering': '#0dcaf0',
            'completed': '#198754',
            'cancelled': '#dc3545',
        }
        color = colors.get(obj.status, '#6c757d')
        return format_html(
            '<span style="background-color: {}; color: white; padding: 3px 8px; border-radius: 12px; font-weight: bold; font-size: 11px;">{}</span>',
            color, obj.get_status_display()
        )
    status_badge.short_description = "Статус"


@admin.register(TableReservation)
class TableReservationAdmin(admin.ModelAdmin):
    list_display = ('guest_name', 'guest_phone', 'guests_count', 'reservation_date', 'reservation_time', 'hall_zone', 'status', 'created_at')
    list_filter = ('status', 'hall_zone', 'reservation_date')
    search_fields = ('guest_name', 'guest_phone', 'special_requests')
    list_editable = ('status',)


@admin.register(Event)
class EventAdmin(admin.ModelAdmin):
    list_display = ('title', 'badge', 'date_time', 'ticket_price', 'is_featured')
    list_filter = ('badge', 'is_featured', 'date_time')
    search_fields = ('title', 'description')
    list_editable = ('is_featured',)


@admin.register(Review)
class ReviewAdmin(admin.ModelAdmin):
    list_display = ('author', 'stars_display', 'source', 'is_approved', 'created_at')
    list_filter = ('rating', 'is_approved', 'source')
    search_fields = ('author', 'text')
    list_editable = ('is_approved',)

    def stars_display(self, obj):
        return "⭐" * obj.rating
    stars_display.short_description = "Оцінка"
