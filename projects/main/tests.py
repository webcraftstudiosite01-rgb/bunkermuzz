import json
from django.test import TestCase
from django.urls import reverse
from main.models import Category, MenuItem, Order, TableReservation, Review


class BunkerMuzViewsTest(TestCase):
    def setUp(self):
        self.cat = Category.objects.create(name='Суші', slug='sushi', icon='🍣')
        self.item = MenuItem.objects.create(
            category=self.cat,
            title='Сет Сакура',
            price=980,
            weight='1100 г',
            description='Філадельфія, Каліфорнія, Футо з вугрем',
            is_popular=True
        )

    def test_index_page(self):
        """Перевірка відображення головної сторінки з категоріями та стравами."""
        response = self.client.get(reverse('main:index'))
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'БУНКЕР')
        self.assertContains(response, 'Сет Сакура')
        self.assertContains(response, 'Суші')

    def test_api_order_create_success(self):
        """Перевірка успішного створення замовлення через API."""
        payload = {
            'client_name': 'Тарас Шевченко',
            'client_phone': '+380981112233',
            'delivery_type': 'delivery',
            'delivery_address': 'вул. Руська, 15, кв. 4',
            'payment_method': 'card_courier',
            'comment': 'Подзвонити за 10 хв',
            'cart': [
                {'id': self.item.id, 'title': self.item.title, 'price': 980, 'quantity': 2}
            ]
        }
        response = self.client.post(
            reverse('main:api_order_create'),
            data=json.dumps(payload),
            content_type='application/json'
        )
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertTrue(data['success'])
        self.assertTrue(data['order_number'].startswith('BM-'))
        self.assertEqual(data['total_amount'], 1960.0)

        # Verify DB
        self.assertEqual(Order.objects.count(), 1)
        order = Order.objects.first()
        self.assertEqual(order.client_name, 'Тарас Шевченко')
        self.assertEqual(order.items.count(), 1)
        self.assertEqual(order.items.first().quantity, 2)

    def test_api_order_validation_empty_cart(self):
        """Перевірка помилки при порожньому кошику."""
        payload = {
            'client_name': 'Тест',
            'client_phone': '+380980000000',
            'cart': []
        }
        response = self.client.post(
            reverse('main:api_order_create'),
            data=json.dumps(payload),
            content_type='application/json'
        )
        self.assertEqual(response.status_code, 400)
        self.assertFalse(response.json()['success'])

    def test_api_reservation_create(self):
        """Перевірка онлайн-бронювання столика."""
        payload = {
            'guest_name': 'Оксана',
            'guest_phone': '+380971234567',
            'reservation_date': '2026-11-20',
            'reservation_time': '19:30',
            'guests_count': 4,
            'hall_zone': 'main',
            'special_requests': 'Біля каміна або в центрі склепіння'
        }
        response = self.client.post(
            reverse('main:api_reservation_create'),
            data=json.dumps(payload),
            content_type='application/json'
        )
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertTrue(data['success'])
        self.assertEqual(TableReservation.objects.count(), 1)
        res = TableReservation.objects.first()
        self.assertEqual(res.guest_name, 'Оксана')
        self.assertEqual(res.guests_count, 4)

    def test_api_review_create(self):
        """Перевірка додавання відгуку."""
        payload = {
            'author': 'Андрій',
            'rating': 5,
            'text': 'Атмосфера просто бомба, музика кайф!'
        }
        response = self.client.post(
            reverse('main:api_review_create'),
            data=json.dumps(payload),
            content_type='application/json'
        )
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.json()['success'])
        self.assertEqual(Review.objects.count(), 1)
        rev = Review.objects.first()
        self.assertEqual(rev.author, 'Андрій')
        self.assertEqual(rev.rating, 5)

    def test_api_order_track(self):
        """Перевірка трекінгу замовлення за номером."""
        order = Order.objects.create(
            order_number='BM-TEST01',
            client_name='Іван',
            client_phone='+380991112233',
            total_amount=500
        )
        response = self.client.get(reverse('main:api_order_track', kwargs={'order_number': 'BM-TEST01'}))
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertTrue(data['success'])
        self.assertEqual(data['order_number'], 'BM-TEST01')
        self.assertEqual(data['status'], 'new')


class BunkerMuzCRMTests(TestCase):
    def setUp(self):
        from django.contrib.auth.models import User
        self.admin_user = User.objects.create_superuser(
            username='admin_test',
            email='admin@bunker.com',
            password='testpassword123'
        )
        self.cat = Category.objects.create(name='Коктейлі', slug='cocktails', icon='🍸')
        self.item = MenuItem.objects.create(
            category=self.cat,
            title='Negroni Smoky',
            price=220,
            is_available=True
        )
        self.order = Order.objects.create(
            order_number='BM-999999',
            client_name='VIP Гість',
            client_phone='+380501234567',
            status='new',
            total_amount=440
        )
        self.res = TableReservation.objects.create(
            guest_name='Олег',
            guest_phone='+380671112233',
            reservation_date='2026-11-25',
            reservation_time='20:00',
            guests_count=2,
            status='pending'
        )

    def test_crm_login_page_renders(self):
        """Перевірка відкриття сторінки входу в CRM."""
        response = self.client.get(reverse('main:crm_login'))
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'BUNKERMUZ CRM')

    def test_crm_dashboard_redirects_unauthenticated(self):
        """Неавторизований користувач перенаправляється на вхід."""
        response = self.client.get(reverse('main:crm_dashboard'))
        self.assertEqual(response.status_code, 302)
        self.assertIn(reverse('main:crm_login'), response.url)

    def test_crm_dashboard_authenticated(self):
        """Авторизований адмін має повний доступ до дашборду CRM."""
        self.client.login(username='admin_test', password='testpassword123')
        response = self.client.get(reverse('main:crm_dashboard'))
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'BunkerMuz CRM')
        self.assertContains(response, 'BM-999999')
        self.assertContains(response, 'Negroni Smoky')

    def test_crm_registration_with_code(self):
        """Реєстрація нового менеджера з правильним секретним кодом."""
        payload = {
            'username': 'newmanager',
            'full_name': 'Сергій Менеджер',
            'email': 'serhii@bunker.com',
            'password': 'mypassword123',
            'password_confirm': 'mypassword123',
            'secret_code': 'BUNKER'
        }
        response = self.client.post(reverse('main:crm_register'), data=payload)
        self.assertEqual(response.status_code, 302)
        self.assertEqual(response.url, reverse('main:crm_dashboard'))

    def test_crm_registration_rejects_wrong_code(self):
        """Реєстрація відхиляється, якщо код запрошення хибний."""
        payload = {
            'username': 'fakeuser',
            'password': 'mypassword123',
            'password_confirm': 'mypassword123',
            'secret_code': 'WRONGCODE'
        }
        response = self.client.post(reverse('main:crm_register'), data=payload)
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'Невірний код запрошення')

    def test_crm_api_order_status_update(self):
        """Зміна статусу замовлення через AJAX."""
        self.client.login(username='admin_test', password='testpassword123')
        response = self.client.post(
            reverse('main:crm_api_order_status', kwargs={'order_id': self.order.id}),
            data=json.dumps({'status': 'cooking'}),
            content_type='application/json'
        )
        self.assertEqual(response.status_code, 200)
        self.order.refresh_from_db()
        self.assertEqual(self.order.status, 'cooking')

    def test_crm_api_menu_toggle(self):
        """Увімкнення та вимкнення страви зі стоп-листа."""
        self.client.login(username='admin_test', password='testpassword123')
        # Initially True -> becomes False
        response = self.client.post(
            reverse('main:crm_api_menu_toggle', kwargs={'item_id': self.item.id}),
            content_type='application/json'
        )
        self.assertEqual(response.status_code, 200)
        self.item.refresh_from_db()
        self.assertFalse(self.item.is_available)

