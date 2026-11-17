import json
import uuid
from decimal import Decimal
from django.db import transaction
from django.http import JsonResponse
from django.shortcuts import render, get_object_or_404
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_POST
from .models import Category, MenuItem, TableReservation, Order, OrderItem, Event, Review


def index(request):
    """Головна сторінка Бункермуз: розкішний лендінг, меню, події, бронювання та відгуки."""
    categories = Category.objects.filter(is_active=True).prefetch_related('items')
    popular_items = MenuItem.objects.filter(is_popular=True, is_available=True)[:8]
    events = Event.objects.filter(is_featured=True).order_by('date_time')[:6]
    reviews = Review.objects.filter(is_approved=True).order_by('-created_at')[:6]

    context = {
        'page_title': 'Бункермуз — Ресторан • Арт-клуб • Лаундж-бар • Караоке в Тернополі',
        'project_name': 'Бункермуз',
        'categories': categories,
        'popular_items': popular_items,
        'events': events,
        'reviews': reviews,
        'restaurant_info': {
            'name': 'Бункермуз',
            'city': 'Тернопіль',
            'address': 'бульвар Тараса Шевченка, 1',
            'phone': '+38 (098) 000-03-32',
            'phone_clean': '+380980000332',
            'working_hours': 'Чт–Нд 16:00 – 23:00 (Пн–Ср: вихідні)',
            'kitchen_hours': 'Кухня та бар до 22:30',
            'instagram': 'https://www.instagram.com/bunkermuz?igsh=MXA0eTdkamQ2dnU5cw==',
            'delivery_min': 400,
            'free_delivery_from': 800,
        }
    }
    return render(request, 'index.html', context)


@require_POST
def api_order_create(request):
    """API створення замовлення на доставку / самовивіз / до столика."""
    try:
        data = json.loads(request.body)
        client_name = data.get('client_name', '').strip()
        client_phone = data.get('client_phone', '').strip()
        delivery_type = data.get('delivery_type', 'delivery')
        delivery_address = data.get('delivery_address', '').strip()
        table_number = data.get('table_number', '').strip()
        payment_method = data.get('payment_method', 'card_courier')
        comment = data.get('comment', '').strip()
        cart_items = data.get('cart', [])

        if not client_name or not client_phone:
            return JsonResponse({'success': False, 'error': 'Вкажіть імʼя та номер телефону'}, status=400)

        if not cart_items:
            return JsonResponse({'success': False, 'error': 'Кошик порожній'}, status=400)

        if delivery_type == 'delivery' and not delivery_address:
            return JsonResponse({'success': False, 'error': 'Вкажіть адресу доставки'}, status=400)

        if delivery_type == 'table' and not table_number:
            return JsonResponse({'success': False, 'error': 'Вкажіть номер вашого столика в залі'}, status=400)

        with transaction.atomic():
            order_number = f"BM-{uuid.uuid4().hex[:6].upper()}"
            total_sum = Decimal('0.00')

            order = Order.objects.create(
                order_number=order_number,
                client_name=client_name,
                client_phone=client_phone,
                delivery_type=delivery_type,
                delivery_address=delivery_address,
                table_number=table_number,
                payment_method=payment_method,
                comment=comment,
                total_amount=0,
            )

            for item_data in cart_items:
                item_id = item_data.get('id')
                try:
                    qty = max(1, min(99, int(item_data.get('quantity', 1))))
                except (ValueError, TypeError):
                    qty = 1
                menu_item = MenuItem.objects.filter(id=item_id).first()
                if menu_item:
                    price = menu_item.price
                    title = menu_item.title
                else:
                    price = Decimal(str(item_data.get('price', 0)))
                    title = item_data.get('title', 'Страва')

                item_total = price * qty
                total_sum += item_total

                OrderItem.objects.create(
                    order=order,
                    menu_item=menu_item,
                    title=title,
                    price=price,
                    quantity=qty,
                    item_total=item_total
                )

            # Discount 10% on takeaway
            if delivery_type == 'takeaway':
                total_sum = total_sum * Decimal('0.90')

            order.total_amount = total_sum
            order.save(update_fields=['total_amount'])

            return JsonResponse({
                'success': True,
                'order_number': order_number,
                'total_amount': float(total_sum),
                'message': f'Дякуємо! Ваше замовлення #{order_number} прийнято.'
            })

    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)}, status=500)


@require_POST
def api_reservation_create(request):
    """API онлайн-бронювання столика."""
    try:
        data = json.loads(request.body)
        name = data.get('guest_name', '').strip()
        phone = data.get('guest_phone', '').strip()
        date = data.get('reservation_date', '').strip()
        time = data.get('reservation_time', '').strip()
        try:
            guests = max(1, min(100, int(data.get('guests_count', 2))))
        except (ValueError, TypeError):
            guests = 2
        zone = data.get('hall_zone', 'main')
        requests = data.get('special_requests', '').strip()

        if not name or not phone or not date or not time:
            return JsonResponse({'success': False, 'error': 'Заповніть усі обовʼязкові поля'}, status=400)

        reservation = TableReservation.objects.create(
            guest_name=name,
            guest_phone=phone,
            reservation_date=date,
            reservation_time=time,
            guests_count=guests,
            hall_zone=zone,
            special_requests=requests,
        )

        zone_label = dict(TableReservation.ZONE_CHOICES).get(zone, 'Головний зал')

        return JsonResponse({
            'success': True,
            'id': reservation.id,
            'message': f'Столик у зоні "{zone_label}" на {date} о {time} успішно заброньовано! Ми зателефонуємо вам для підтвердження.'
        })
    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)}, status=500)


@require_POST
def api_review_create(request):
    """API надсилання відгуку гостя."""
    try:
        data = json.loads(request.body)
        author = data.get('author', '').strip()
        try:
            rating = max(1, min(5, int(data.get('rating', 5))))
        except (ValueError, TypeError):
            rating = 5
        text = data.get('text', '').strip()

        if not author or not text:
            return JsonResponse({'success': False, 'error': 'Вкажіть ваше імʼя та текст відгуку'}, status=400)

        Review.objects.create(
            author=author,
            rating=max(1, min(5, rating)),
            text=text,
            source="Сайт Бункермуз",
            is_approved=True
        )

        return JsonResponse({
            'success': True,
            'message': 'Дякуємо за ваш відгук! Він опублікований.'
        })
    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)}, status=500)


def api_order_track(request, order_number):
    """API відстеження статусу замовлення за його номером."""
    clean_num = order_number.strip().upper()
    if not clean_num.startswith('BM-') and not clean_num.startswith('#BM-'):
        clean_num = f"BM-{clean_num}"
    clean_num = clean_num.lstrip('#')

    order = Order.objects.filter(order_number__iexact=clean_num).first()
    if not order:
        return JsonResponse({'success': False, 'error': f'Замовлення #{clean_num} не знайдено'}, status=404)

    items = [{
        'title': item.title,
        'quantity': item.quantity,
        'price': float(item.price),
        'item_total': float(item.item_total),
    } for item in order.items.all()]

    status_steps = [
        {'id': 'new', 'label': 'Прийнято', 'completed': True},
        {'id': 'cooking', 'label': 'Готується шефом', 'completed': order.status in ['cooking', 'delivering', 'completed']},
        {'id': 'delivering', 'label': 'Курʼєр у дорозі', 'completed': order.status in ['delivering', 'completed']},
        {'id': 'completed', 'label': 'Доставлено', 'completed': order.status == 'completed'},
    ]

    return JsonResponse({
        'success': True,
        'order_number': order.order_number,
        'status': order.status,
        'status_display': order.get_status_display(),
        'client_name': order.client_name,
        'total_amount': float(order.total_amount),
        'delivery_type': order.get_delivery_type_display(),
        'created_at': order.created_at.strftime('%d.%m.%Y %H:%M'),
        'items': items,
        'steps': status_steps,
    })
