import json
from decimal import Decimal
from datetime import datetime, timedelta
from pathlib import Path
from django.core.management.base import BaseCommand
from django.utils import timezone
from main.models import Category, MenuItem, Event, Review


class Command(BaseCommand):
    help = "Наповнює базу даних автентичними стравами Бункермуз, подіями, коктейлями та відгуками"

    def handle(self, *args, **options):
        self.stdout.write("Очищення попередніх записів...")
        MenuItem.objects.all().delete()
        Category.objects.all().delete()
        Event.objects.all().delete()
        Review.objects.all().delete()

        # Базові категорії з іконками та пріоритетом
        categories_data = [
            {'name': 'Сет-меню Суші', 'slug': 'sushi-sets', 'icon': '🍱', 'sort_order': 1},
            {'name': 'Роли та Суші', 'slug': 'rolls', 'icon': '🍣', 'sort_order': 2},
            {'name': 'Бургери', 'slug': 'burgers', 'icon': '🍔', 'sort_order': 3},
            {'name': 'Паста', 'slug': 'pasta', 'icon': '🍝', 'sort_order': 4},
            {'name': 'Основні страви', 'slug': 'mains', 'icon': '🥩', 'sort_order': 5},
            {'name': 'Салати', 'slug': 'salads', 'icon': '🥗', 'sort_order': 6},
            {'name': 'Холодні закуски', 'slug': 'cold-appetizers', 'icon': '🧀', 'sort_order': 7},
            {'name': 'Гарячі закуски', 'slug': 'hot-appetizers', 'icon': '🍟', 'sort_order': 8},
            {'name': 'Коктейлі & Бар', 'slug': 'bar-cocktails', 'icon': '🍸', 'sort_order': 9},
            {'name': 'Кальяни', 'slug': 'hookah', 'icon': '💨', 'sort_order': 10},
            {'name': 'Десерти', 'slug': 'desserts', 'icon': '🍰', 'sort_order': 11},
        ]

        cat_map = {}
        for cdata in categories_data:
            cat, _ = Category.objects.get_or_create(
                slug=cdata['slug'],
                defaults={
                    'name': cdata['name'],
                    'icon': cdata['icon'],
                    'sort_order': cdata['sort_order'],
                    'is_active': True,
                }
            )
            cat_map[cdata['slug']] = cat

        # Читаємо спарсені страви з ChoiceQR
        main_dir = Path(__file__).resolve().parent.parent.parent
        fixtures_path = main_dir / 'fixtures' / 'bunkermuz_menu.json'
        json_path = fixtures_path

        items_count = 0
        if json_path.exists():
            with open(json_path, 'r', encoding='utf-8') as f:
                scraped_items = json.load(f)

            for item in scraped_items:
                slug = item['category_slug']
                category = cat_map.get(slug, cat_map['rolls'])

                # Якщо це сет
                if 'сет' in item['title'].lower():
                    category = cat_map['sushi-sets']

                MenuItem.objects.create(
                    category=category,
                    title=item['title'],
                    price=Decimal(str(item['price'])),
                    old_price=Decimal(str(round(item['price'] * 1.15, 2))) if item.get('is_popular') else None,
                    weight=item.get('weight', '300 г'),
                    description=item.get('description', 'Фірмова подача від шефа Бункермуз.'),
                    image_url=item.get('image_url', ''),
                    is_new=item.get('is_new', False),
                    is_popular=item.get('is_popular', False),
                    is_spicy=item.get('is_spicy', False),
                    is_available=True,
                )
                items_count += 1

        self.stdout.write(f"Завантажено {items_count} страв із ChoiceQR.")

        # Додаємо фірмовий бар Бункермуз
        bar_cat = cat_map['bar-cocktails']
        cocktails = [
            {
                'title': 'Bunker Smoked Negroni',
                'price': 280,
                'weight': '120 мл',
                'description': 'Джин на розмарині, Campari, червоний солодкий вермут, копчення дубовою тріскою в клоші.',
                'image_url': 'https://images.unsplash.com/photo-1551024709-8f23befc6f87?auto=format&fit=crop&w=600&q=80',
                'is_popular': True
            },
            {
                'title': 'Pornstar Passion Martini',
                'price': 270,
                'weight': '160 мл + 40 мл Prosecco',
                'description': 'Горілка ванільна, пюре маракуї, лікер Passoa, лаймовий фреш, шот ігристого Prosecco.',
                'image_url': 'https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?auto=format&fit=crop&w=600&q=80',
                'is_popular': True
            },
            {
                'title': 'Whiskey Sour Oak Barrel',
                'price': 250,
                'weight': '150 мл',
                'description': 'Бурбон Bulleit, лимонний фреш, цукровий сироп, яєчний білок, біттер Angostura.',
                'image_url': 'https://images.unsplash.com/photo-1527661591475-527312dd65f5?auto=format&fit=crop&w=600&q=80',
                'is_popular': False
            },
            {
                'title': 'Aperol Spritz Grande',
                'price': 240,
                'weight': '250 мл',
                'description': 'Aperol, італійське Prosecco DOC, газована содова, апельсин, лід.',
                'image_url': 'https://images.unsplash.com/photo-1560512823-829485b8bf24?auto=format&fit=crop&w=600&q=80',
                'is_popular': True
            },
            {
                'title': 'Bunker Craft IPA Draft',
                'price': 130,
                'weight': '500 мл',
                'description': 'Локальне крафтове нефільтроване світле пиво з цитрусово-хмельовими нотами.',
                'image_url': 'https://images.unsplash.com/photo-1608270586620-248524c67de9?auto=format&fit=crop&w=600&q=80',
                'is_popular': False
            }
        ]
        for c in cocktails:
            MenuItem.objects.create(
                category=bar_cat,
                title=c['title'],
                price=Decimal(str(c['price'])),
                weight=c['weight'],
                description=c['description'],
                image_url=c['image_url'],
                is_popular=c['is_popular'],
                is_available=True,
            )

        # Додаємо кальяни
        hookah_cat = cat_map['hookah']
        hookahs = [
            {
                'title': 'Кальян Classic Smoke',
                'price': 390,
                'weight': 'Чаша глиняна',
                'description': 'Легкий тютюн на вибір: Serbetli, Adalya, Buta. Освіжаючі мікси та ягоди.',
                'image_url': 'https://images.unsplash.com/photo-1527661591475-527312dd65f5?auto=format&fit=crop&w=600&q=80',
                'is_popular': False
            },
            {
                'title': 'Кальян Premium Medium',
                'price': 460,
                'weight': 'Чаша Phunnel / Classic',
                'description': 'Середня міцність: Darkside, Daily Hookah, Musthave, Element. Фірмові поєднання від кальянного шефа.',
                'image_url': 'https://images.unsplash.com/photo-1517256064527-09c73fc73e38?auto=format&fit=crop&w=600&q=80',
                'is_popular': True
            },
            {
                'title': 'Кальян Dark Strong Elite',
                'price': 540,
                'weight': 'Чаша глазурована',
                'description': 'Максимальна міцність: Tangiers, WTO, Bonche. Глибокий насичений смак для справжніх поціновувачів.',
                'image_url': 'https://images.unsplash.com/photo-1544717305-2782549b5136?auto=format&fit=crop&w=600&q=80',
                'is_popular': True
            }
        ]
        for h in hookahs:
            MenuItem.objects.create(
                category=hookah_cat,
                title=h['title'],
                price=Decimal(str(h['price'])),
                weight=h['weight'],
                description=h['description'],
                image_url=h['image_url'],
                is_popular=h['is_popular'],
                is_available=True,
            )

        # Додаємо афішу подій (Event)
        now = timezone.now()
        events_data = [
            {
                'title': 'Underground Techno & House Night: DJ Alex Neo',
                'badge': 'DJ SET / PARTY',
                'date_time': now + timedelta(days=2, hours=4),
                'ticket_price': '200 грн (депозит)',
                'description': 'Атмосферний сет електронної музики під історичними цегляними склепіннями Бункермуз. Потужний звук, світлове шоу та фірмові коктейлі.',
                'image_url': 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?auto=format&fit=crop&w=800&q=80',
            },
            {
                'title': 'Вечір Живого Джазу: Midnight Quartet',
                'badge': 'LIVE JAZZ',
                'date_time': now + timedelta(days=5, hours=3),
                'ticket_price': 'Вхід вільний',
                'description': 'Саксофон, контрабас, рояль та оксамитовий вокал. Ідеальний вечір для побачень, смачної вечері та келиха вина.',
                'image_url': 'https://images.unsplash.com/photo-1511192336575-5a79af67a629?auto=format&fit=crop&w=800&q=80',
            },
            {
                'title': 'Великий Стендап: Підпільний Гумор',
                'badge': 'STAND-UP COMEDY',
                'date_time': now + timedelta(days=9, hours=2),
                'ticket_price': '300 грн',
                'description': 'Гострий, чесний та сміливий український гумор від найкращих коміків заходу України. Кількість місць обмежена!',
                'image_url': 'https://images.unsplash.com/photo-1585699324551-f6c309eedeca?auto=format&fit=crop&w=800&q=80',
            },
            {
                'title': 'Караоке Батл: Голос Бункера',
                'badge': 'KARAOKE CHAMPIONSHIP',
                'date_time': now + timedelta(days=12, hours=5),
                'ticket_price': 'Вхід вільний (депозит столу)',
                'description': 'Професійна акустика Evolution Pro 2, бек-вокал, звукорежисер та призовий фонд для найкращого виконавця вечора.',
                'image_url': 'https://images.unsplash.com/photo-1516280440614-37939bbacd81?auto=format&fit=crop&w=800&q=80',
            },
        ]
        for ed in events_data:
            Event.objects.create(
                title=ed['title'],
                badge=ed['badge'],
                date_time=ed['date_time'],
                ticket_price=ed['ticket_price'],
                description=ed['description'],
                image_url=ed['image_url'],
                is_featured=True,
            )

        # Додаємо реалістичні відгуки
        reviews_data = [
            {
                'author': 'Олександр Ковальчук',
                'rating': 5,
                'source': 'Google Reviews',
                'text': 'Найатмосферніше місце в Тернополі без перебільшення! Неймовірний інтерʼєр у старовинному підвалі, дуже смачні суші (сет Роял просто космос) і професійні бармени. Окремий респект за музику.'
            },
            {
                'author': 'Марія Мельник',
                'rating': 5,
                'source': 'Instagram',
                'text': 'Святкували день народження у VIP-залі. Обслуговування на висоті, їжа неймовірна, кальяни мʼякі та димні. Дуже зручно, що тепер можна замовити і стіл забронювати прямо з сайту!'
            },
            {
                'author': 'Дмитро Васильченко',
                'rating': 5,
                'source': 'TripAdvisor',
                'text': 'Приїжджав до Тернополя у справах, друзі порадили Бункермуз на Шевченка, 1. Стейк та лосось у сирній ванні — це гастрономічний шок! Обовʼязково завітайте, якщо цінуєте якість.'
            },
            {
                'author': 'Ірина Гончарук',
                'rating': 5,
                'source': 'Google Reviews',
                'text': 'Доставка приїхала за 35 хвилин, все гаряче, упаковано з турботою. Бургери соковиті, картопля хрустка, соуси натуральні. Дякую за сервіс європейського рівня!'
            },
        ]
        for rd in reviews_data:
            Review.objects.create(
                author=rd['author'],
                rating=rd['rating'],
                source=rd['source'],
                text=rd['text'],
                is_approved=True
            )

        self.stdout.write(self.style.SUCCESS("Успішно! База даних Бункермуз наповнена на 100%."))
