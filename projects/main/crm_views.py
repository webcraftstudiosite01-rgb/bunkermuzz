import json
from decimal import Decimal
from django.contrib.auth import authenticate, login, logout
from django.contrib.auth.decorators import login_required
from django.contrib.auth.models import User
from django.db.models import Sum, Avg, Count
from django.http import JsonResponse
from django.shortcuts import render, redirect, get_object_or_404
from django.utils import timezone
from django.views.decorators.http import require_POST, require_GET
from .models import Category, MenuItem, TableReservation, Order, OrderItem, Event, Review


def crm_login_view(request):
    """Сторінка входу в CRM Бункермуз."""
    if request.user.is_authenticated:
        return redirect('main:crm_dashboard')

    error_message = None
    if request.method == 'POST':
        username = request.POST.get('username', '').strip()
        password = request.POST.get('password', '').strip()

        user = authenticate(request, username=username, password=password)
        if user is not None:
            login(request, user)
            return redirect('main:crm_dashboard')
        else:
            error_message = "Невірний логін або пароль. Спробуйте ще раз."

    return render(request, 'crm/login.html', {'error_message': error_message})


def crm_register_view(request):
    """Реєстрація нового адміністратора або менеджера закладу."""
    if request.user.is_authenticated:
        return redirect('main:crm_dashboard')

    error_message = None
    if request.method == 'POST':
        username = request.POST.get('username', '').strip()
        email = request.POST.get('email', '').strip()
        full_name = request.POST.get('full_name', '').strip()
        password = request.POST.get('password', '').strip()
        password_confirm = request.POST.get('password_confirm', '').strip()
        secret_code = request.POST.get('secret_code', '').strip().upper()

        # Secret invite code check
        ALLOWED_CODES = ['BUNKER', 'BUNKERMUZ', 'ADMIN2026', 'CHEF']
        if secret_code not in ALLOWED_CODES and User.objects.count() > 0:
            error_message = "Невірний код запрошення для персоналу. Зверніться до керуючого."
        elif not username or len(username) < 3:
            error_message = "Логін має містити щонайменше 3 символи."
        elif password != password_confirm:
            error_message = "Паролі не співпадають."
        elif len(password) < 6:
            error_message = "Пароль має містити щонайменше 6 символів."
        elif User.objects.filter(username=username).exists():
            error_message = f"Користувач із логіном '{username}' вже існує."
        else:
            user = User.objects.create_user(
                username=username,
                email=email,
                password=password,
                is_staff=True,
                is_superuser=True
            )
            if full_name:
                parts = full_name.split(None, 1)
                user.first_name = parts[0]
                if len(parts) > 1:
                    user.last_name = parts[1]
                user.save(update_fields=['first_name', 'last_name'])

            login(request, user)
            return redirect('main:crm_dashboard')

    return render(request, 'crm/register.html', {'error_message': error_message})


def crm_logout_view(request):
    """Вихід із системи CRM."""
    logout(request)
    return redirect('main:crm_login')


@login_required(login_url='main:crm_login')
def crm_dashboard_view(request):
    """Головна панель керування CRM Бункермуз."""
    today = timezone.now().date()

    # Дані списків
    orders = Order.objects.prefetch_related('items__menu_item').order_by('-created_at')
    reservations = TableReservation.objects.order_by('-reservation_date', '-reservation_time')
    menu_items = MenuItem.objects.select_related('category').order_by('category__sort_order', 'title')
    categories = Category.objects.all().order_by('sort_order')
    reviews = Review.objects.all().order_by('-created_at')
    events = Event.objects.all().order_by('date_time')

    # Аналітика та KPI
    total_revenue = orders.exclude(status='cancelled').aggregate(s=Sum('total_amount'))['s'] or Decimal('0.00')
    today_orders = orders.filter(created_at__date=today)
    today_revenue = today_orders.exclude(status='cancelled').aggregate(s=Sum('total_amount'))['s'] or Decimal('0.00')
    active_orders_count = orders.filter(status__in=['new', 'cooking', 'delivering']).count()
    today_reservations_count = reservations.filter(reservation_date=today).count()
    total_reviews_count = reviews.count()
    avg_rating = reviews.aggregate(a=Avg('rating'))['a'] or 5.0

    context = {
        'page_title': 'BunkerMuz CRM — Панель керування закладом',
        'orders': orders,
        'reservations': reservations,
        'menu_items': menu_items,
        'categories': categories,
        'reviews': reviews,
        'events': events,
        'kpi': {
            'total_revenue': float(total_revenue),
            'today_revenue': float(today_revenue),
            'orders_count': orders.count(),
            'active_orders_count': active_orders_count,
            'today_reservations_count': today_reservations_count,
            'total_reservations_count': reservations.count(),
            'total_menu_count': menu_items.count(),
            'stop_list_count': menu_items.filter(is_available=False).count(),
            'reviews_count': total_reviews_count,
            'avg_rating': round(avg_rating, 1),
        },
        'user': request.user,
    }
    return render(request, 'crm/dashboard.html', context)


# =========================================================================
# AJAX CRM ACTIONS
# =========================================================================

@require_POST
@login_required(login_url='main:crm_login')
def crm_api_order_status(request, order_id):
    """Зміна статусу замовлення адміністратором."""
    order = get_object_or_404(Order, id=order_id)
    try:
        data = json.loads(request.body)
        new_status = data.get('status')
        if new_status in dict(Order.STATUS_CHOICES):
            order.status = new_status
            order.save(update_fields=['status'])
            return JsonResponse({
                'success': True,
                'status': new_status,
                'status_display': order.get_status_display(),
                'order_number': order.order_number,
            })
        return JsonResponse({'success': False, 'error': 'Недійсний статус'}, status=400)
    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)}, status=500)


@require_POST
@login_required(login_url='main:crm_login')
def crm_api_reservation_status(request, res_id):
    """Зміна статусу бронювання столика."""
    res = get_object_or_404(TableReservation, id=res_id)
    try:
        data = json.loads(request.body)
        new_status = data.get('status')
        if new_status in dict(TableReservation.STATUS_CHOICES):
            res.status = new_status
            res.save(update_fields=['status'])
            return JsonResponse({
                'success': True,
                'status': new_status,
                'status_display': res.get_status_display()
            })
        return JsonResponse({'success': False, 'error': 'Недійсний статус'}, status=400)
    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)}, status=500)


@require_POST
@login_required(login_url='main:crm_login')
def crm_api_menu_toggle(request, item_id):
    """Швидке увімкнення / вимкнення страви (Стоп-лист)."""
    item = get_object_or_404(MenuItem, id=item_id)
    item.is_available = not item.is_available
    item.save(update_fields=['is_available'])
    return JsonResponse({
        'success': True,
        'item_id': item.id,
        'is_available': item.is_available,
        'label': 'В наявності' if item.is_available else 'В стоп-листі'
    })


@require_POST
@login_required(login_url='main:crm_login')
def crm_api_item_create(request):
    """Створення нової страви прямо з CRM."""
    try:
        data = json.loads(request.body)
        cat_id = data.get('category_id')
        category = get_object_or_404(Category, id=cat_id)
        title = data.get('title', '').strip()
        price = Decimal(str(data.get('price', 0)))
        weight = data.get('weight', '').strip()
        desc = data.get('description', '').strip()
        image = data.get('image_url', '').strip()

        if not title or price <= 0:
            return JsonResponse({'success': False, 'error': 'Вкажіть коректну назву та ціну'}, status=400)

        item = MenuItem.objects.create(
            category=category,
            title=title,
            price=price,
            weight=weight,
            description=desc,
            image_url=image,
            is_available=True,
            is_popular=bool(data.get('is_popular', False)),
            is_new=True
        )

        return JsonResponse({
            'success': True,
            'id': item.id,
            'title': item.title,
            'price': float(item.price),
            'category_name': category.name
        })
    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)}, status=500)


@require_POST
@login_required(login_url='main:crm_login')
def crm_api_review_toggle(request, review_id):
    """Модерація відгуку (схвалити / видалити)."""
    review = get_object_or_404(Review, id=review_id)
    try:
        data = json.loads(request.body)
        action = data.get('action')
        if action == 'delete':
            review.delete()
            return JsonResponse({'success': True, 'action': 'deleted'})
        elif action == 'toggle':
            review.is_approved = not review.is_approved
            review.save(update_fields=['is_approved'])
            return JsonResponse({'success': True, 'is_approved': review.is_approved})
        return JsonResponse({'success': False, 'error': 'Невідома дія'}, status=400)
    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)}, status=500)


@require_GET
@login_required(login_url='main:crm_login')
def crm_api_live_feed(request):
    """Живий пульс CRM: повертає найсвіжіше замовлення для звукового сповіщення."""
    last_known_id = int(request.GET.get('last_id', 0))
    latest_order = Order.objects.order_by('-id').first()
    has_new = False
    new_order_data = None

    if latest_order and latest_order.id > last_known_id and last_known_id > 0:
        has_new = True
        new_order_data = {
            'id': latest_order.id,
            'number': latest_order.order_number,
            'client': latest_order.client_name,
            'phone': latest_order.client_phone,
            'total': float(latest_order.total_amount),
            'type': latest_order.get_delivery_type_display(),
        }

    return JsonResponse({
        'success': True,
        'has_new': has_new,
        'latest_id': latest_order.id if latest_order else 0,
        'new_order': new_order_data,
        'active_count': Order.objects.filter(status__in=['new', 'cooking', 'delivering']).count(),
    })
