/**
 * BunkerMuz CRM — Frontend Operations Logic
 * Live Status Updates, Order Polling, Stop-List Controls & Audio Alerts
 */

let soundAlertsEnabled = true;
let lastKnownOrderId = 0;

document.addEventListener('DOMContentLoaded', () => {
    // Find highest order ID currently on page
    const orderCards = document.querySelectorAll('.crm-order-card');
    orderCards.forEach(c => {
        const idMatch = c.id.match(/\d+/);
        if (idMatch) {
            const id = parseInt(idMatch[0], 10);
            if (id > lastKnownOrderId) lastKnownOrderId = id;
        }
    });

    // Start background live polling every 10 seconds
    setInterval(pollForNewOrders, 10000);
});

/* ==========================================================================
   TABS SWITCHING
   ========================================================================== */
function switchCrmTab(tabName) {
    document.querySelectorAll('.crm-tab-btn').forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('data-tab') === tabName);
    });

    document.querySelectorAll('.crm-tab-panel').forEach(panel => {
        panel.classList.toggle('active', panel.id === `panel-${tabName}`);
    });
}

/* ==========================================================================
   ORDER FILTERING & SEARCH
   ========================================================================== */
function filterCrmOrders(status) {
    document.querySelectorAll('.order-filter-chip').forEach(chip => {
        chip.classList.toggle('active', chip.getAttribute('data-filter') === status);
    });

    const cards = document.querySelectorAll('.crm-order-card');
    cards.forEach(card => {
        if (status === 'all' || card.getAttribute('data-status') === status) {
            card.style.display = 'block';
        } else {
            card.style.display = 'none';
        }
    });
}

function searchCrmOrders() {
    const query = document.getElementById('orderSearchInput').value.trim().toLowerCase();
    const cards = document.querySelectorAll('.crm-order-card');
    cards.forEach(card => {
        const searchData = card.getAttribute('data-search') || '';
        if (query === '' || searchData.includes(query)) {
            card.style.display = 'block';
        } else {
            card.style.display = 'none';
        }
    });
}

/* ==========================================================================
   AJAX: UPDATE ORDER STATUS
   ========================================================================== */
async function updateOrderStatus(orderId, status) {
    try {
        const csrfToken = getCrmCsrfToken();
        const res = await fetch(`/crm/api/orders/${orderId}/status/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': csrfToken
            },
            body: JSON.stringify({ status: status })
        });
        const data = await res.json();

        if (data.success) {
            const card = document.getElementById(`orderRow-${orderId}`);
            const badge = document.getElementById(`statusBadge-${orderId}`);

            if (card) {
                card.className = `crm-order-card status-${status}`;
                card.setAttribute('data-status', status);
            }
            if (badge) {
                badge.className = `status-indicator status-pill-${status}`;
                badge.textContent = data.status_display;
            }

            const orderDisplayNum = data.order_number ? `#${data.order_number}` : (card?.querySelector('.order-code')?.textContent.trim() || `#${orderId}`);
            showCrmToast(`Замовлення ${orderDisplayNum}: статус змінено на "${data.status_display}"`, '✅');
            updateActiveKpiCount();
        } else {
            alert(data.error || 'Помилка зміни статусу');
        }
    } catch (e) {
        console.error('Failed to update order status', e);
    }
}

/* ==========================================================================
   AJAX: UPDATE TABLE RESERVATION STATUS
   ========================================================================== */
async function updateReservationStatus(resId, status) {
    try {
        const csrfToken = getCrmCsrfToken();
        const res = await fetch(`/crm/api/reservations/${resId}/status/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': csrfToken
            },
            body: JSON.stringify({ status: status })
        });
        const data = await res.json();

        if (data.success) {
            const badge = document.getElementById(`resStatusBadge-${resId}`);
            if (badge) {
                badge.className = `status-pill status-pill-${status}`;
                badge.textContent = data.status_display;
            }
            showCrmToast(`Бронь #${resId}: ${data.status_display}`, '🥂');
        }
    } catch (e) {
        console.error('Failed to update reservation', e);
    }
}

/* ==========================================================================
   AJAX: STOP-LIST TOGGLE (MENU DISH AVAILABILITY)
   ========================================================================== */
async function toggleStopList(itemId) {
    try {
        const csrfToken = getCrmCsrfToken();
        const res = await fetch(`/crm/api/menu/${itemId}/toggle/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': csrfToken
            }
        });
        const data = await res.json();

        if (data.success) {
            const card = document.getElementById(`menuCard-${itemId}`);
            const btn = document.getElementById(`stopBtn-${itemId}`);

            if (data.is_available) {
                card.classList.remove('is-stopped');
                btn.className = 'btn-stoplist-toggle active';
                btn.textContent = '✅ В наявності';
                showCrmToast('Страву повернено в меню на сайті', '🍽️');
            } else {
                card.classList.add('is-stopped');
                btn.className = 'btn-stoplist-toggle';
                btn.textContent = '⛔ Стоп-лист';
                showCrmToast('Страву додано в Стоп-лист (приховано на сайті)', '⚠️');
            }

            // Update KPI stop counter
            const stoppedCount = document.querySelectorAll('.crm-menu-card.is-stopped').length;
            const kpiStop = document.getElementById('kpiStopCount');
            if (kpiStop) kpiStop.textContent = stoppedCount;
        }
    } catch (e) {
        console.error('Stop-list toggle error', e);
    }
}

/* ==========================================================================
   AJAX: NEW DISH CREATION MODAL
   ========================================================================== */
function openNewDishModal() {
    const modal = document.getElementById('newDishModal');
    const backdrop = document.getElementById('newDishModalBackdrop');
    if (modal && backdrop) {
        modal.classList.add('active');
        backdrop.classList.add('active');
    }
}

function closeNewDishModal() {
    const modal = document.getElementById('newDishModal');
    const backdrop = document.getElementById('newDishModalBackdrop');
    if (modal && backdrop) {
        modal.classList.remove('active');
        backdrop.classList.remove('active');
    }
}

async function submitNewDish(e) {
    e.preventDefault();

    const catId = document.getElementById('dishCat').value;
    const title = document.getElementById('dishTitle').value.trim();
    const price = document.getElementById('dishPrice').value;
    const weight = document.getElementById('dishWeight').value.trim();
    const desc = document.getElementById('dishDesc').value.trim();
    const image = document.getElementById('dishImage').value.trim();
    const isPopular = document.getElementById('dishIsPopular').checked;

    const btn = document.getElementById('btnSubmitNewDish');
    if (btn) btn.disabled = true;

    try {
        const csrfToken = getCrmCsrfToken();
        const res = await fetch('/crm/api/menu/create/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': csrfToken
            },
            body: JSON.stringify({
                category_id: catId,
                title: title,
                price: price,
                weight: weight,
                description: desc,
                image_url: image,
                is_popular: isPopular
            })
        });
        const data = await res.json();

        if (data.success) {
            closeNewDishModal();
            showCrmToast(`Страву "${data.title}" успішно додано в меню!`, '🎉');
            setTimeout(() => window.location.reload(), 1200);
        } else {
            alert(data.error || 'Помилка створення');
        }
    } catch (err) {
        console.error('Failed to create dish', err);
    } finally {
        if (btn) btn.disabled = false;
    }
}

/* ==========================================================================
   REVIEWS MODERATION
   ========================================================================== */
async function toggleReview(reviewId, action) {
    try {
        const csrfToken = getCrmCsrfToken();
        const res = await fetch(`/crm/api/reviews/${reviewId}/toggle/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': csrfToken
            },
            body: JSON.stringify({ action: action })
        });
        const data = await res.json();

        if (data.success) {
            const row = document.getElementById(`revRow-${reviewId}`);
            if (action === 'delete') {
                if (row) row.remove();
                showCrmToast('Відгук видалено', '🗑️');
            } else {
                showCrmToast(data.is_approved ? 'Відгук опубліковано' : 'Відгук приховано', '⭐');
            }
        }
    } catch (e) {
        console.error('Review toggle error', e);
    }
}

/* ==========================================================================
   LIVE ORDER POLLING & AUDIO CHIME NOTIFICATIONS
   ========================================================================== */
async function pollForNewOrders() {
    try {
        const res = await fetch(`/crm/api/live-feed/?last_id=${lastKnownOrderId}`);
        const data = await res.json();

        if (data.success && data.has_new && data.new_order) {
            lastKnownOrderId = data.latest_id;
            playOrderChime();
            showCrmToast(`⚡ НОВЕ ЗАМОВЛЕННЯ #${data.new_order.number} від ${data.new_order.client} на ${data.new_order.total} ₴`, '🔔');

            // Play visual pulse on KPI counter
            const kpiEl = document.getElementById('kpiActiveOrders');
            if (kpiEl) {
                kpiEl.textContent = data.active_count;
                kpiEl.style.color = '#f43f5e';
                setTimeout(() => kpiEl.style.color = '', 3000);
            }
        }
    } catch (e) {
        // silent polling catch
    }
}

function updateActiveKpiCount() {
    const active = document.querySelectorAll('.crm-order-card.status-new, .crm-order-card.status-cooking, .crm-order-card.status-delivering').length;
    const kpiEl = document.getElementById('kpiActiveOrders');
    if (kpiEl) kpiEl.textContent = active;
}

/* ==========================================================================
   WEB AUDIO API SOUND CHIME (ZERO EXTERNAL FILES)
   ========================================================================== */
function playOrderChime() {
    if (!soundAlertsEnabled) return;

    try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) return;
        const ctx = new AudioContext();

        // Pleasant speakeasy bell double chime: E5 (659.25Hz) -> G#5 (830.61Hz)
        function playTone(freq, startTime, duration) {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();

            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, startTime);

            gain.gain.setValueAtTime(0, startTime);
            gain.gain.linearRampToValueAtTime(0.3, startTime + 0.05);
            gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

            osc.connect(gain);
            gain.connect(ctx.destination);

            osc.start(startTime);
            osc.stop(startTime + duration);
        }

        const now = ctx.currentTime;
        playTone(659.25, now, 0.4);
        playTone(830.61, now + 0.15, 0.6);
    } catch (e) {
        console.error('Audio chime error', e);
    }
}

function toggleAudioAlerts() {
    soundAlertsEnabled = !soundAlertsEnabled;
    const icon = document.getElementById('soundIcon');
    const label = document.getElementById('soundLabel');
    if (soundAlertsEnabled) {
        if (icon) icon.textContent = '🔔';
        if (label) label.textContent = 'Звук: On';
        showCrmToast('Звукові сповіщення замовлень увімкнено', '🔔');
        playOrderChime();
    } else {
        if (icon) icon.textContent = '🔕';
        if (label) label.textContent = 'Звук: Off';
        showCrmToast('Звукові сповіщення вимкнено', '🔕');
    }
}

/* ==========================================================================
   CRM TOAST ENGINE
   ========================================================================== */
function showCrmToast(text, icon = '⚡') {
    const container = document.getElementById('crmToastContainer');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = 'crm-toast-item';
    toast.innerHTML = `<span>${icon}</span> <span>${text}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
        toast.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(30px)';
        setTimeout(() => toast.remove(), 350);
    }, 3500);
}

function getCrmCsrfToken() {
    const input = document.querySelector('[name=csrfmiddlewaretoken]');
    if (input) return input.value;
    const cookieMatch = document.cookie.match(/csrftoken=([^;]+)/);
    return cookieMatch ? cookieMatch[1] : '';
}
