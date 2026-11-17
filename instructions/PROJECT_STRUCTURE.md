# Архитектура и структура проекта BunkerMuzz

## Общая схема каталогов

```text
bunkermuzz/
│
├── assets/                     # Статические ресурсы (CSS, JS, изображения, шрифты)
│   ├── css/
│   │   └── style.css
│   ├── js/
│   │   └── main.js
│   └── images/
│
├── instructions/               # Правила, стандарты и инструкции для команды и AI
│   ├── README.md               # Оглавление и навигация
│   ├── PROJECT_STRUCTURE.md    # Описание структуры каталогов
│   ├── CODING_STANDARDS.md     # Стандарты кода (PEP 8, типизация)
│   ├── DJANGO_GUIDELINES.md    # Специфичные правила для Django
│   └── AI_RULES.md             # Инструкции для работы AI-ассистентов
│
├── projects/                   # Исходный код Django
│   ├── manage.py               # Точка входа для CLI команд Django
│   ├── config/                 # Главный конфигурационный пакет проекта
│   │   ├── __init__.py
│   │   ├── settings.py         # Настройки проекта
│   │   ├── urls.py             # Главный роутинг URL
│   │   ├── wsgi.py             # Точка входа WSGI
│   │   └── asgi.py             # Точка входа ASGI
│   └── main/                   # Базовое приложение Django
│       ├── __init__.py
│       ├── admin.py            # Регистрация в админке
│       ├── apps.py             # Конфигурация приложения
│       ├── models.py           # Модели данных
│       ├── views.py            # Представления (views)
│       ├── urls.py             # Локальные URL-маршруты
│       └── tests.py            # Unit-тесты
│
└── templates/                  # Глобальные HTML-шаблоны Django
    ├── base.html               # Основной родительский layout
    ├── index.html              # Главная страница
    ├── includes/               # Переиспользуемые фрагменты (партиалы)
    │   ├── _navbar.html
    │   ├── _footer.html
    │   └── _messages.html
    └── errors/                 # Страницы ошибок (404, 500)
        ├── 404.html
        └── 500.html
```

---

## Назначение директорий

### 1. `projects/`
- Содержит файл `manage.py`, главный пакет настроек `config/`, а также все функциональные приложения Django (`main/`, `users/`, `catalog/` и т.д.).
- **Правило:** Новые приложения создаются внутри каталога `projects/` командой:
  ```bash
  python projects/manage.py startapp <app_name> projects/<app_name>
  ```
- Каждое приложение обязательно регистрируется в `INSTALLED_APPS` в `projects/config/settings.py`.

### 2. `templates/`
- Централизованное хранилище HTML-шаблонов.
- Путь прописан в `TEMPLATES['DIRS']`:
  ```python
  'DIRS': [ROOT_DIR / 'templates', BASE_DIR / 'templates']
  ```
- Шаблоны страниц приложения могут находиться как в корневой папке `templates/`, так и в подпапках по имени приложения (например, `templates/main/detail.html`).

### 3. `assets/`
- Служит источником статических файлов в режиме разработки (`STATICFILES_DIRS = [ROOT_DIR / 'assets']`).
- При выполнении команды `collectstatic` все файлы из `assets/` и приложений копируются в `staticfiles/`.
- Поддиректории:
  - `assets/css/` — таблицы стилей.
  - `assets/js/` — JavaScript-файлы.
  - `assets/img/` или `assets/images/` — графика и иконки интерфейса.

### 4. `instructions/`
- Единственный источник правды касательно соглашений, проектных требований и регламентов разработки.
- Любые архитектурные изменения должны фиксироваться здесь.
