import uuid
from django.db import models
from django.utils.text import slugify


class Category(models.Model):
    """Категорія меню ресторану."""
    name = models.CharField(max_length=100, verbose_name="Назва категорії")
    slug = models.SlugField(max_length=100, unique=True, verbose_name="URL-слаг")
    icon = models.CharField(max_length=20, default="🍽️", verbose_name="Іконка (емодзі)")
    sort_order = models.PositiveIntegerField(default=0, verbose_name="Порядок сортування")
    is_active = models.BooleanField(default=True, verbose_name="Активна")

    class Meta:
        verbose_name = "Категорія меню"
        verbose_name_plural = "Категорії меню"
        ordering = ['sort_order', 'name']

    def __str__(self):
        return f"{self.icon} {self.name}"


class MenuItem(models.Model):
    """Страва або напій у меню."""
    category = models.ForeignKey(
        Category,
        on_delete=models.CASCADE,
        related_name='items',
        verbose_name="Категорія"
    )
    title = models.CharField(max_length=200, verbose_name="Назва страви")
    slug = models.SlugField(max_length=220, blank=True, verbose_name="Слаг")
    description = models.TextField(blank=True, verbose_name="Склад та опис")
    price = models.DecimalField(max_digits=10, decimal_places=2, verbose_name="Ціна (грн)")
    old_price = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        null=True,
        blank=True,
        verbose_name="Стара ціна (грн)"
    )
    weight = models.CharField(max_length=60, blank=True, verbose_name="Вага / об'єм")
    image_url = models.URLField(max_length=500, blank=True, verbose_name="Посилання на фото")
    is_available = models.BooleanField(default=True, verbose_name="В наявності")
    is_popular = models.BooleanField(default=False, verbose_name="Хіт продажу")
    is_new = models.BooleanField(default=False, verbose_name="Новинка")
    is_spicy = models.BooleanField(default=False, verbose_name="Гостре")
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="Дата додавання")

    class Meta:
        verbose_name = "Страва / Позиція меню"
        verbose_name_plural = "Страви та напої"
        ordering = ['-is_popular', 'price', 'title']

    def __str__(self):
        return f"{self.title} — {self.price} грн"

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = slugify(self.title, allow_unicode=True) or f"item-{uuid.uuid4().hex[:8]}"
        super().save(*args, **kwargs)


class TableReservation(models.Model):
    """Бронювання столика в ресторані."""
    ZONE_CHOICES = [
        ('main', '🏛️ Головний зал (Підвал-склепіння)'),
        ('lounge', '🛋️ VIP Lounge & Кальяни'),
        ('karaoke', '🎤 Караоке-зал'),
        ('art', '🎨 Арт-галерея'),
        ('bar', '🍸 Барна стійка'),
    ]

    STATUS_CHOICES = [
        ('new', 'Нова заявка'),
        ('confirmed', 'Підтверджено'),
        ('cancelled', 'Скасовано'),
        ('completed', 'Завершено'),
    ]

    guest_name = models.CharField(max_length=120, verbose_name="Ім'я гостя")
    guest_phone = models.CharField(max_length=30, verbose_name="Номер телефону")
    guests_count = models.PositiveIntegerField(default=2, verbose_name="Кількість гостей")
    reservation_date = models.DateField(verbose_name="Дата візиту")
    reservation_time = models.TimeField(verbose_name="Час візиту")
    hall_zone = models.CharField(
        max_length=50,
        choices=ZONE_CHOICES,
        default='main',
        verbose_name="Зона закладу"
    )
    special_requests = models.TextField(blank=True, verbose_name="Побажання / привід")
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='new',
        verbose_name="Статус"
    )
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="Створено")

    class Meta:
        verbose_name = "Бронювання столика"
        verbose_name_plural = "Бронювання столиків"
        ordering = ['-reservation_date', '-reservation_time']

    def __str__(self):
        return f"{self.guest_name} ({self.guest_phone}) — {self.reservation_date} {self.reservation_time}"


class Order(models.Model):
    """Замовлення доставки або самовивозу."""
    DELIVERY_CHOICES = [
        ('delivery', '🛵 Доставка курʼєром по Тернополю'),
        ('takeaway', '🛍️ Самовивіз з Бункермуз (-10%)'),
        ('table', '🛎️ До столика в залі'),
    ]

    PAYMENT_CHOICES = [
        ('card_online', '💳 Карткою онлайн (LiqPay / Apple Pay)'),
        ('card_courier', '💳 Терміналом курʼєру'),
        ('cash', '💵 Готівкою при отриманні'),
    ]

    STATUS_CHOICES = [
        ('new', 'Нове замовлення'),
        ('cooking', 'Готується на кухні'),
        ('delivering', 'Курʼєр у дорозі'),
        ('completed', 'Виконано'),
        ('cancelled', 'Скасовано'),
    ]

    order_number = models.CharField(max_length=32, unique=True, verbose_name="Номер замовлення")
    client_name = models.CharField(max_length=120, verbose_name="Клієнт")
    client_phone = models.CharField(max_length=30, verbose_name="Телефон")
    delivery_type = models.CharField(
        max_length=20,
        choices=DELIVERY_CHOICES,
        default='delivery',
        verbose_name="Тип доставки"
    )
    delivery_address = models.CharField(max_length=255, blank=True, verbose_name="Адреса доставки")
    table_number = models.CharField(max_length=20, blank=True, verbose_name="Номер столика")
    payment_method = models.CharField(
        max_length=30,
        choices=PAYMENT_CHOICES,
        default='card_courier',
        verbose_name="Спосіб оплати"
    )
    comment = models.TextField(blank=True, verbose_name="Коментар до замовлення")
    total_amount = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=0,
        verbose_name="Загальна сума"
    )
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='new',
        verbose_name="Статус"
    )
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="Дата та час")

    class Meta:
        verbose_name = "Замовлення"
        verbose_name_plural = "Замовлення клієнтів"
        ordering = ['-created_at']

    def __str__(self):
        return f"Замовлення #{self.order_number} ({self.client_name}) — {self.total_amount} грн"


class OrderItem(models.Model):
    """Елемент замовлення."""
    order = models.ForeignKey(
        Order,
        on_delete=models.CASCADE,
        related_name='items',
        verbose_name="Замовлення"
    )
    menu_item = models.ForeignKey(
        MenuItem,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        verbose_name="Страва"
    )
    title = models.CharField(max_length=200, verbose_name="Назва страви")
    price = models.DecimalField(max_digits=10, decimal_places=2, verbose_name="Ціна за од.")
    quantity = models.PositiveIntegerField(default=1, verbose_name="Кількість")
    item_total = models.DecimalField(max_digits=10, decimal_places=2, verbose_name="Сума")

    class Meta:
        verbose_name = "Позиція замовлення"
        verbose_name_plural = "Позиції замовлення"

    def __str__(self):
        return f"{self.title} x {self.quantity}"


class Event(models.Model):
    """Подія / афіша арт-клубу Бункермуз."""
    title = models.CharField(max_length=200, verbose_name="Назва події")
    badge = models.CharField(max_length=50, default="LIVE MUSIC", verbose_name="Бейдж / Жанр")
    date_time = models.DateTimeField(verbose_name="Дата та час")
    ticket_price = models.CharField(max_length=100, default="Вхід вільний", verbose_name="Вартість квитка")
    description = models.TextField(verbose_name="Опис події")
    image_url = models.URLField(max_length=500, blank=True, verbose_name="Афіша (URL)")
    is_featured = models.BooleanField(default=True, verbose_name="Відображати на головній")

    class Meta:
        verbose_name = "Подія / Афіша"
        verbose_name_plural = "Афіша подій"
        ordering = ['date_time']

    def __str__(self):
        return f"{self.title} ({self.date_time.strftime('%d.%m %H:%M')})"


class Review(models.Model):
    """Відгук гостя."""
    author = models.CharField(max_length=100, verbose_name="Автор відгуку")
    rating = models.PositiveSmallIntegerField(default=5, verbose_name="Оцінка (1-5)")
    text = models.TextField(verbose_name="Текст відгуку")
    source = models.CharField(max_length=50, default="Google Maps", verbose_name="Джерело")
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="Дата")
    is_approved = models.BooleanField(default=True, verbose_name="Опубліковано")

    class Meta:
        verbose_name = "Відгук"
        verbose_name_plural = "Відгуки гостей"
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.author} ({self.rating}★)"
