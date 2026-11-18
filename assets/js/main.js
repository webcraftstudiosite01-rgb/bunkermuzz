/**
 * BunkerMuz — Frontend Application Core
 * Luxury E-Commerce, Reservations & Interactive Menu Logic
 */

// Global State
const STATE = {
    cart: [],
    promoCode: null,
    discountPercent: 0,
    freeDeliveryThreshold: 800,
    standardDeliveryFee: 60,
    currentQvItem: null,
    quickFilter: 'all',
    deliveryType: 'delivery',
};

// Storage Key
const CART_STORAGE_KEY = 'bunkermuz_cart_v1';

// Initialize on DOM Ready
document.addEventListener('DOMContentLoaded', () => {
    loadCartFromStorage();
    initDatePickers();
    initStarRating();
    initScrollSpy();
    initScrollProgressBar();
    initAmbientEmbersCanvas();
    initCardTilt();
    updateCartUI();
});

/* ==========================================================================
   CART SYSTEM (LOCAL STORAGE & STATE)
   ========================================================================== */

function loadCartFromStorage() {
    try {
        const saved = localStorage.getItem(CART_STORAGE_KEY);
        if (saved) {
            STATE.cart = JSON.parse(saved);
        }
    } catch (e) {
        console.error('Failed to load cart from localStorage', e);
        STATE.cart = [];
    }
}

function saveCartToStorage() {
    try {
        localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(STATE.cart));
    } catch (e) {
        console.error('Failed to save cart', e);
    }
}

function addToCart(id, title, price, image, weight, qty = 1) {
    id = parseInt(id, 10);
    price = parseFloat(String(price).replace(',', '.')) || 0;

    // Safety check against weight string passed as qty
    if (typeof qty === 'string' && (qty.includes('г') || qty.includes('мл') || qty.includes('-') || isNaN(Number(qty)))) {
        qty = 1;
    } else {
        qty = parseInt(qty, 10) || 1;
    }
    if (qty <= 0) qty = 1;

    const existing = STATE.cart.find(item => item.id === id);
    if (existing) {
        existing.quantity += qty;
    } else {
        STATE.cart.push({
            id: id,
            title: title,
            price: price,
            image: image,
            weight: weight || '',
            quantity: qty
        });
    }

    saveCartToStorage();
    updateCartUI();
    showToast(`Додано до кошика: ${title}`, '🍱');
    bounceCartBadges();
    openCartDrawer();

    // Trigger Fly to Cart animation
    if (window.event) {
        triggerFlyToCart(window.event);
    }
}

function updateCartQuantity(id, delta) {
    id = parseInt(id, 10);
    const item = STATE.cart.find(i => i.id === id);
    if (!item) return;

    item.quantity += delta;
    if (item.quantity <= 0) {
        removeFromCart(id);
        return;
    }

    saveCartToStorage();
    updateCartUI();
}

function removeFromCart(id) {
    id = parseInt(id, 10);
    STATE.cart = STATE.cart.filter(item => item.id !== id);
    saveCartToStorage();
    updateCartUI();
    showToast('Страву видалено з кошика', '🗑️');
}

function clearCart() {
    STATE.cart = [];
    STATE.promoCode = null;
    STATE.discountPercent = 0;
    saveCartToStorage();
    updateCartUI();
}

function calculateTotals(deliveryType = null) {
    if (!deliveryType) {
        deliveryType = STATE.deliveryType || (document.getElementById('orderDeliveryType') ? document.getElementById('orderDeliveryType').value : 'delivery');
    }
    const subtotal = STATE.cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    let discount = 0;

    // Promo code discount
    if (STATE.discountPercent > 0) {
        discount += subtotal * (STATE.discountPercent / 100);
    }

    // Takeaway discount 10%
    if (deliveryType === 'takeaway') {
        discount += (subtotal - discount) * 0.10;
    }

    // Delivery calculation
    let delivery = 0;
    if (deliveryType === 'delivery') {
        delivery = subtotal >= STATE.freeDeliveryThreshold || subtotal === 0 ? 0 : STATE.standardDeliveryFee;
    }

    const finalTotal = Math.max(0, subtotal - discount + delivery);

    return {
        subtotal: Math.round(subtotal),
        discount: Math.round(discount),
        delivery: Math.round(delivery),
        finalTotal: Math.round(finalTotal),
        totalItems: STATE.cart.reduce((count, item) => count + item.quantity, 0)
    };
}

function updateCartUI() {
    const deliveryType = STATE.deliveryType || (document.getElementById('orderDeliveryType') ? document.getElementById('orderDeliveryType').value : 'delivery');
    const totals = calculateTotals(deliveryType);

    // Update Header and Mobile Badges
    document.querySelectorAll('.badge-count').forEach(badge => {
        badge.textContent = totals.totalItems;
    });

    const headerTotal = document.getElementById('headerCartTotal');
    if (headerTotal) {
        headerTotal.textContent = `${totals.finalTotal} ₴`;
    }

    const drawerCount = document.getElementById('cartDrawerCount');
    if (drawerCount) {
        drawerCount.textContent = `${totals.totalItems} шт.`;
    }

    // Update Delivery Progress
    const progressFill = document.getElementById('deliveryProgressFill');
    const progressText = document.getElementById('deliveryProgressText');
    const progressPercent = document.getElementById('deliveryProgressPercent');

    if (progressFill && progressText && progressPercent) {
        if (totals.subtotal >= STATE.freeDeliveryThreshold) {
            progressFill.style.width = '100%';
            progressPercent.textContent = '100%';
            progressText.textContent = '🎉 У вас безкоштовна доставка!';
        } else {
            const pct = Math.min(100, Math.round((totals.subtotal / STATE.freeDeliveryThreshold) * 100));
            const diff = STATE.freeDeliveryThreshold - totals.subtotal;
            progressFill.style.width = `${pct}%`;
            progressPercent.textContent = `${pct}%`;
            progressText.textContent = `Додайте ще ${diff} ₴ до безкоштовної доставки`;
        }
    }

    // Render Items in Drawer
    const itemsList = document.getElementById('cartItemsList');
    if (itemsList) {
        if (STATE.cart.length === 0) {
            itemsList.innerHTML = `
                <div class="cart-empty-state">
                    <span class="empty-cart-icon">🛍️</span>
                    <h4>Ваш кошик порожній</h4>
                    <p>Оберіть улюблені суші, бургери чи коктейлі з меню вище</p>
                </div>
            `;
            const checkoutBtn = document.getElementById('btnGoToCheckout');
            if (checkoutBtn) checkoutBtn.disabled = true;
        } else {
            itemsList.innerHTML = STATE.cart.map(item => `
                <div class="cart-item" data-id="${item.id}">
                    <img src="${item.image || 'https://via.placeholder.com/80?text=Food'}" alt="${item.title}" class="cart-item-thumb">
                    <div class="cart-item-details">
                        <div class="cart-item-title">${item.title}</div>
                        <div class="cart-item-bottom">
                            <span class="cart-item-price">${Math.round(item.price * item.quantity)} ₴</span>
                            <div class="stepper-wrap">
                                <button type="button" class="btn-step" onclick="updateCartQuantity(${item.id}, -1)">−</button>
                                <span class="step-value">${item.quantity}</span>
                                <button type="button" class="btn-step" onclick="updateCartQuantity(${item.id}, 1)">+</button>
                            </div>
                        </div>
                    </div>
                    <button type="button" class="btn-remove-item" onclick="removeFromCart(${item.id})" title="Видалити">&times;</button>
                </div>
            `).join('');

            const checkoutBtn = document.getElementById('btnGoToCheckout');
            if (checkoutBtn) checkoutBtn.disabled = false;
        }
    }

    // Update Totals in Drawer
    const subtotalEl = document.getElementById('cartSubtotal');
    if (subtotalEl) subtotalEl.textContent = `${totals.subtotal} ₴`;

    const discountLine = document.getElementById('discountLine');
    const discountEl = document.getElementById('cartDiscount');
    if (discountLine && discountEl) {
        if (totals.discount > 0) {
            discountLine.style.display = 'flex';
            discountEl.textContent = `-${totals.discount} ₴`;
        } else {
            discountLine.style.display = 'none';
        }
    }

    const deliveryCostEl = document.getElementById('cartDeliveryCost');
    if (deliveryCostEl) {
        if (deliveryType === 'takeaway' || deliveryType === 'table') {
            deliveryCostEl.textContent = '0 ₴ (в закладі)';
        } else {
            deliveryCostEl.textContent = totals.delivery === 0 ? 'Безкоштовно' : `${totals.delivery} ₴`;
        }
    }

    const finalTotalEl = document.getElementById('cartFinalTotal');
    if (finalTotalEl) finalTotalEl.textContent = `${totals.finalTotal} ₴`;

    // Also update checkout modal review numbers if open
    const modalSummary = document.getElementById('modalItemsSummary');
    if (modalSummary) modalSummary.textContent = `${totals.totalItems} шт.`;

    const modalTotal = document.getElementById('modalFinalTotal');
    if (modalTotal) modalTotal.textContent = `${totals.finalTotal} ₴`;
}

function bounceCartBadges() {
    document.querySelectorAll('.badge-count').forEach(b => {
        b.style.transform = 'scale(1.4)';
        setTimeout(() => b.style.transform = 'scale(1)', 200);
    });
}

/* ==========================================================================
   PROMO CODE HANDLER
   ========================================================================== */
function applyPromoCode() {
    const input = document.getElementById('promoInput');
    const msg = document.getElementById('promoMessage');
    if (!input || !msg) return;

    const code = input.value.trim().toUpperCase();
    if (!code) {
        msg.textContent = 'Введіть промокод';
        msg.style.color = '#ef4444';
        return;
    }

    if (code === 'BUNKER10' || code === 'BUNKERMUZ') {
        STATE.promoCode = code;
        STATE.discountPercent = 10;
        msg.textContent = '✅ Промокод активовано! Знижка 10%';
        msg.style.color = '#10b981';
        updateCartUI();
        showToast('Промокод на 10% успішно застосовано!', '🏷️');
    } else {
        msg.textContent = 'Недійсний промокод. Спробуйте BUNKER10';
        msg.style.color = '#ef4444';
    }
}

/* ==========================================================================
   CART DRAWER CONTROLS
   ========================================================================== */
function toggleCartDrawer() {
    const drawer = document.getElementById('cartDrawer');
    const backdrop = document.getElementById('cartBackdrop');
    if (!drawer) return;

    const isOpen = drawer.classList.contains('active');
    if (isOpen) {
        closeCartDrawer();
    } else {
        openCartDrawer();
    }
}

function openCartDrawer() {
    const drawer = document.getElementById('cartDrawer');
    const backdrop = document.getElementById('cartBackdrop');
    if (drawer && backdrop) {
        drawer.classList.add('active');
        backdrop.classList.add('active');
        document.body.style.overflow = 'hidden';
    }
}

function closeCartDrawer() {
    const drawer = document.getElementById('cartDrawer');
    const backdrop = document.getElementById('cartBackdrop');
    if (drawer && backdrop) {
        drawer.classList.remove('active');
        backdrop.classList.remove('active');
        document.body.style.overflow = '';
    }
}

/* ==========================================================================
   CHECKOUT MODAL & ORDER SUBMISSION
   ========================================================================== */
function openCheckoutModal() {
    if (STATE.cart.length === 0) {
        showToast('Спочатку додайте страви до кошика!', '⚠️');
        return;
    }
    closeCartDrawer();

    const modal = document.getElementById('checkoutModal');
    const backdrop = document.getElementById('checkoutModalBackdrop');
    const formScreen = document.getElementById('checkoutFormScreen');
    const successScreen = document.getElementById('checkoutSuccessScreen');

    if (modal && backdrop) {
        formScreen.style.display = 'block';
        successScreen.style.display = 'none';
        modal.classList.add('active');
        backdrop.classList.add('active');
        document.body.style.overflow = 'hidden';
        updateCartUI();
    }
}

function closeCheckoutModal() {
    const modal = document.getElementById('checkoutModal');
    const backdrop = document.getElementById('checkoutModalBackdrop');
    if (modal && backdrop) {
        modal.classList.remove('active');
        backdrop.classList.remove('active');
        document.body.style.overflow = '';
    }
}

function selectCartDeliveryType(type) {
    setDeliveryType(type);
}

function setDeliveryType(type) {
    STATE.deliveryType = type;
    const typeInput = document.getElementById('orderDeliveryType');
    if (typeInput) typeInput.value = type;

    // Highlight tabs in checkout modal
    document.querySelectorAll('.delivery-tabs .tab-btn').forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('data-type') === type);
    });

    // Highlight tabs in cart drawer
    document.querySelectorAll('.btn-dt-tab').forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('data-type') === type);
    });

    // Toggle fields
    const addrGroup = document.getElementById('fieldAddressGroup');
    const tableGroup = document.getElementById('fieldTableGroup');
    const takeawayBanner = document.getElementById('fieldTakeawayNote');
    const addrInput = document.getElementById('orderAddress');
    const tableInput = document.getElementById('orderTableNumber');

    if (type === 'delivery') {
        if (addrGroup) addrGroup.style.display = 'block';
        if (tableGroup) tableGroup.style.display = 'none';
        if (takeawayBanner) takeawayBanner.style.display = 'none';
        if (addrInput) addrInput.required = true;
        if (tableInput) tableInput.required = false;
    } else if (type === 'takeaway') {
        if (addrGroup) addrGroup.style.display = 'none';
        if (tableGroup) tableGroup.style.display = 'none';
        if (takeawayBanner) takeawayBanner.style.display = 'block';
        if (addrInput) addrInput.required = false;
        if (tableInput) tableInput.required = false;
    } else if (type === 'table') {
        if (addrGroup) addrGroup.style.display = 'none';
        if (tableGroup) tableGroup.style.display = 'block';
        if (takeawayBanner) takeawayBanner.style.display = 'none';
        if (addrInput) addrInput.required = false;
        if (tableInput) tableInput.required = true;
    }

    updateCartUI();
}

async function submitOrder(e) {
    e.preventDefault();

    if (STATE.cart.length === 0) {
        showToast('Кошик порожній!', '⚠️');
        return;
    }

    const name = document.getElementById('orderName').value.trim();
    const phone = document.getElementById('orderPhone').value.trim();
    const deliveryType = document.getElementById('orderDeliveryType').value;
    const address = document.getElementById('orderAddress') ? document.getElementById('orderAddress').value.trim() : '';
    const tableNumber = document.getElementById('orderTableNumber') ? document.getElementById('orderTableNumber').value.trim() : '';
    const comment = document.getElementById('orderComment') ? document.getElementById('orderComment').value.trim() : '';
    const paymentRadio = document.querySelector('input[name="payment_method"]:checked');
    const paymentMethod = paymentRadio ? paymentRadio.value : 'card_courier';

    const errBox = document.getElementById('checkoutError');
    const btn = document.getElementById('btnSubmitOrder');

    if (!name || !phone) {
        if (errBox) {
            errBox.textContent = 'Будь ласка, заповніть ваше імʼя та номер телефону';
            errBox.style.display = 'block';
        }
        return;
    }

    if (btn) btn.disabled = true;

    try {
        const csrfToken = getCsrfToken();
        const payload = {
            client_name: name,
            client_phone: phone,
            delivery_type: deliveryType,
            delivery_address: address,
            table_number: tableNumber,
            payment_method: paymentMethod,
            comment: comment,
            cart: STATE.cart.map(item => ({
                id: item.id,
                title: item.title,
                price: item.price,
                quantity: item.quantity
            }))
        };

        const response = await fetch('/api/orders/create/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': csrfToken
            },
            body: JSON.stringify(payload)
        });

        const result = await response.json();

        if (result.success) {
            // Show Success Screen
            document.getElementById('checkoutFormScreen').style.display = 'none';
            const successScreen = document.getElementById('checkoutSuccessScreen');
            document.getElementById('confirmedOrderNumber').textContent = `#${result.order_number}`;
            successScreen.style.display = 'block';

            clearCart();
            showToast(`Замовлення #${result.order_number} прийнято!`, '🎉');
        } else {
            if (errBox) {
                errBox.textContent = result.error || 'Помилка при створенні замовлення';
                errBox.style.display = 'block';
            }
        }
    } catch (err) {
        console.warn('Backend unavailable, switching to static demo mode:', err);
        const mockOrderNumber = 'BM-' + Math.floor(100000 + Math.random() * 900000);
        document.getElementById('checkoutFormScreen').style.display = 'none';
        const successScreen = document.getElementById('checkoutSuccessScreen');
        document.getElementById('confirmedOrderNumber').textContent = `#${mockOrderNumber}`;
        successScreen.style.display = 'block';

        // Save order to localStorage for live tracking
        try {
            const savedOrders = JSON.parse(localStorage.getItem('bunkermuz_orders') || '{}');
            savedOrders[mockOrderNumber] = {
                order_number: mockOrderNumber,
                client_name: name,
                client_phone: phone,
                delivery_type_display: deliveryType === 'takeaway' ? 'Самовивіз (-10%)' : (deliveryType === 'table' ? 'У закладі' : 'Доставка курʼєром'),
                status: 'cooking',
                status_display: 'Готується на кухні',
                total_amount: document.getElementById('modalFinalTotal')?.textContent || '450 ₴',
                created_at: new Date().toLocaleDateString('uk-UA') + ' ' + new Date().toLocaleTimeString('uk-UA', {hour: '2-digit', minute:'2-digit'}),
                items: STATE.cart.map(i => ({ title: i.title, quantity: i.quantity, item_total: i.price * i.quantity }))
            };
            localStorage.setItem('bunkermuz_orders', JSON.stringify(savedOrders));
        } catch(e) {}

        clearCart();
        showToast(`Замовлення #${mockOrderNumber} прийнято!`, '🎉');
    } finally {
        if (btn) btn.disabled = false;
    }
}

/* ==========================================================================
   TABLE RESERVATION MODAL
   ========================================================================== */
function openReservationModal(defaultRequest = '') {
    const modal = document.getElementById('reservationModal');
    const backdrop = document.getElementById('reservationModalBackdrop');
    const formScreen = document.getElementById('reservationFormScreen');
    const successScreen = document.getElementById('reservationSuccessScreen');

    if (modal && backdrop) {
        formScreen.style.display = 'block';
        successScreen.style.display = 'none';

        if (defaultRequest) {
            const reqField = document.getElementById('resRequests');
            if (reqField) reqField.value = defaultRequest;
        }

        modal.classList.add('active');
        backdrop.classList.add('active');
        document.body.style.overflow = 'hidden';
    }
}

function closeReservationModal() {
    const modal = document.getElementById('reservationModal');
    const backdrop = document.getElementById('reservationModalBackdrop');
    if (modal && backdrop) {
        modal.classList.remove('active');
        backdrop.classList.remove('active');
        document.body.style.overflow = '';
    }
}

function initDatePickers() {
    const dateInput = document.getElementById('resDate');
    if (dateInput) {
        const today = new Date().toISOString().split('T')[0];
        dateInput.min = today;
        dateInput.value = today;
    }
}

async function submitReservation(e) {
    e.preventDefault();

    const name = document.getElementById('resName').value.trim();
    const phone = document.getElementById('resPhone').value.trim();
    const date = document.getElementById('resDate').value;
    const time = document.getElementById('resTime').value;
    const guests = document.getElementById('resGuests').value;
    const zone = document.getElementById('resZone').value;
    const requests = document.getElementById('resRequests').value.trim();

    const errBox = document.getElementById('reservationError');
    const btn = document.getElementById('btnSubmitReservation');

    if (!name || !phone || !date || !time) {
        if (errBox) {
            errBox.textContent = 'Будь ласка, заповніть усі обовʼязкові поля';
            errBox.style.display = 'block';
        }
        return;
    }

    if (btn) btn.disabled = true;

    try {
        const selectedTable = document.getElementById('resSelectedTable')?.value || '';
        let finalRequests = requests;
        if (selectedTable) {
            finalRequests = requests ? `[Обрано на схемі: ${selectedTable}] — ${requests}` : `[Обрано на схемі: ${selectedTable}]`;
        }

        const csrfToken = getCsrfToken();
        const payload = {
            guest_name: name,
            guest_phone: phone,
            reservation_date: date,
            reservation_time: time,
            guests_count: guests,
            hall_zone: zone,
            special_requests: finalRequests
        };

        const res = await fetch('/api/reservations/create/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': csrfToken
            },
            body: JSON.stringify(payload)
        });

        const data = await res.json();
        if (data.success) {
            document.getElementById('reservationFormScreen').style.display = 'none';
            const successScreen = document.getElementById('reservationSuccessScreen');
            document.getElementById('reservationSuccessMessage').textContent = data.message;
            successScreen.style.display = 'block';
            showToast('Столик успішно заброньовано!', '🥂');
        } else {
            if (errBox) {
                errBox.textContent = data.error || 'Помилка бронювання';
                errBox.style.display = 'block';
            }
        }
    } catch (err) {
        console.warn('Backend unavailable, showing reservation confirmation in static demo mode:', err);
        document.getElementById('reservationFormScreen').style.display = 'none';
        const successScreen = document.getElementById('reservationSuccessScreen');
        document.getElementById('reservationSuccessMessage').textContent = `Дякуємо, ${name}! Стіл у залі "${zone}" на ${date} (${time}) попередньо заброньовано. Ми зв'яжемося з вами за номером ${phone}.`;
        successScreen.style.display = 'block';
        showToast('Столик успішно заброньовано!', '🥂');
    } finally {
        if (btn) btn.disabled = false;
    }
}

/* ==========================================================================
   QUICK VIEW MODAL FOR DISHES
   ========================================================================== */
function openQuickView(dishId) {
    const card = document.getElementById(`dishCard-${dishId}`) || document.querySelector(`.dish-card[data-id="${dishId}"]`);
    if (!card) return;

    const imgEl = card.querySelector('.dish-img');
    const imgSrc = imgEl ? imgEl.src : '';
    const title = card.querySelector('.dish-title').textContent.trim();
    const desc = card.querySelector('.dish-desc').textContent.trim();
    const priceText = card.querySelector('.price-val').textContent.trim();
    const price = parseFloat(card.getAttribute('data-price') || priceText.replace(/[^\d\.]/g, ''));
    const oldPriceEl = card.querySelector('.old-price');
    const catName = card.querySelector('.dish-cat-name') ? card.querySelector('.dish-cat-name').textContent.trim() : '';
    const weight = card.querySelector('.dish-weight') ? card.querySelector('.dish-weight').textContent.trim() : '';
    const isHit = card.getAttribute('data-is-hit') === 'true';
    const isNew = card.getAttribute('data-is-new') === 'true';
    const isSpicy = card.getAttribute('data-is-spicy') === 'true';

    STATE.currentQvItem = {
        id: dishId,
        title: title,
        price: price,
        image: imgSrc,
        weight: weight,
        quantity: 1
    };

    // Populate modal
    document.getElementById('qvImage').src = imgSrc;
    document.getElementById('qvTitle').textContent = title;
    document.getElementById('qvCategory').textContent = catName;
    document.getElementById('qvWeight').textContent = weight || '300 г';
    document.getElementById('qvDescription').textContent = desc;
    document.getElementById('qvPrice').textContent = `${Math.round(price)} ₴`;
    document.getElementById('qvQuantity').textContent = '1';

    const oldPriceBadge = document.getElementById('qvOldPrice');
    if (oldPriceEl && oldPriceBadge) {
        oldPriceBadge.textContent = oldPriceEl.textContent;
        oldPriceBadge.style.display = 'inline-block';
    } else if (oldPriceBadge) {
        oldPriceBadge.style.display = 'none';
    }

    const badgesContainer = document.getElementById('qvBadges');
    if (badgesContainer) {
        let badgesHtml = '';
        if (isHit) badgesHtml += '<span class="badge-hit">🔥 ХІТ</span>';
        if (isNew) badgesHtml += '<span class="badge-new">NEW</span>';
        if (isSpicy) badgesHtml += '<span class="badge-spicy">🌶️</span>';
        badgesContainer.innerHTML = badgesHtml;
    }

    const modal = document.getElementById('quickViewModal');
    const backdrop = document.getElementById('quickViewBackdrop');
    if (modal && backdrop) {
        modal.classList.add('active');
        backdrop.classList.add('active');
        document.body.style.overflow = 'hidden';
    }
}

function closeQuickViewModal() {
    const modal = document.getElementById('quickViewModal');
    const backdrop = document.getElementById('quickViewBackdrop');
    if (modal && backdrop) {
        modal.classList.remove('active');
        backdrop.classList.remove('active');
        document.body.style.overflow = '';
    }
}

function changeQvQuantity(delta) {
    if (!STATE.currentQvItem) return;
    STATE.currentQvItem.quantity = Math.max(1, STATE.currentQvItem.quantity + delta);
    document.getElementById('qvQuantity').textContent = STATE.currentQvItem.quantity;
}

function addQvToCart() {
    if (!STATE.currentQvItem) return;
    addToCart(
        STATE.currentQvItem.id,
        STATE.currentQvItem.title,
        STATE.currentQvItem.price,
        STATE.currentQvItem.image,
        STATE.currentQvItem.weight,
        STATE.currentQvItem.quantity
    );
    closeQuickViewModal();
}

/* ==========================================================================
   REVIEW MODAL & STAR PICKER
   ========================================================================== */
function openReviewModal() {
    const modal = document.getElementById('reviewModal');
    const backdrop = document.getElementById('reviewModalBackdrop');
    if (modal && backdrop) {
        document.getElementById('reviewFormScreen').style.display = 'block';
        document.getElementById('reviewSuccessScreen').style.display = 'none';
        modal.classList.add('active');
        backdrop.classList.add('active');
        document.body.style.overflow = 'hidden';
    }
}

function closeReviewModal() {
    const modal = document.getElementById('reviewModal');
    const backdrop = document.getElementById('reviewModalBackdrop');
    if (modal && backdrop) {
        modal.classList.remove('active');
        backdrop.classList.remove('active');
        document.body.style.overflow = '';
    }
}

function initStarRating() {
    const picker = document.getElementById('starRatingPicker');
    if (!picker) return;

    const stars = picker.querySelectorAll('.star-item');
    stars.forEach(star => {
        star.addEventListener('click', () => {
            const val = parseInt(star.getAttribute('data-val'), 10);
            document.getElementById('revRating').value = val;
            stars.forEach(s => {
                const sVal = parseInt(s.getAttribute('data-val'), 10);
                s.classList.toggle('active', sVal <= val);
            });
        });
    });
}

async function submitReview(e) {
    e.preventDefault();
    const author = document.getElementById('revAuthor').value.trim();
    const rating = document.getElementById('revRating').value;
    const text = document.getElementById('revText').value.trim();
    const errBox = document.getElementById('reviewError');

    if (!author || !text) {
        if (errBox) {
            errBox.textContent = 'Заповніть усі поля';
            errBox.style.display = 'block';
        }
        return;
    }

    try {
        const csrfToken = getCsrfToken();
        const res = await fetch('/api/reviews/create/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': csrfToken
            },
            body: JSON.stringify({ author, rating, text })
        });
        const data = await res.json();
        if (data.success) {
            document.getElementById('reviewFormScreen').style.display = 'none';
            document.getElementById('reviewSuccessScreen').style.display = 'block';
            showToast('Дякуємо за ваш відгук!', '⭐');
        } else {
            if (errBox) {
                errBox.textContent = data.error || 'Помилка збереження';
                errBox.style.display = 'block';
            }
        }
    } catch (err) {
        console.warn('Backend unavailable, showing review confirmation in static demo mode:', err);
        document.getElementById('reviewFormScreen').style.display = 'none';
        document.getElementById('reviewSuccessScreen').style.display = 'block';
        showToast('Дякуємо за ваш відгук!', '⭐');
    }
}

/* ==========================================================================
   MENU SEARCH & FILTERING SYSTEM
   ========================================================================== */
function filterMenuItems() {
    const input = document.getElementById('menuSearchInput');
    const clearBtn = document.getElementById('clearSearchBtn');
    if (!input) return;

    const query = input.value.trim().toLowerCase();
    if (clearBtn) clearBtn.style.display = query.length > 0 ? 'block' : 'none';

    const cards = document.querySelectorAll('#menuCatalog .dish-card');
    const categories = document.querySelectorAll('#menuCatalog .category-block');
    let visibleCount = 0;

    cards.forEach(card => {
        const title = card.getAttribute('data-title') || '';
        const desc = card.getAttribute('data-desc') || '';
        const isHit = card.getAttribute('data-is-hit') === 'true';
        const isNew = card.getAttribute('data-is-new') === 'true';
        const isSpicy = card.getAttribute('data-is-spicy') === 'true';

        // Check search match
        const matchesQuery = query === '' || title.includes(query) || desc.includes(query);

        // Check filter match
        let matchesFilter = true;
        if (STATE.quickFilter === 'hit' && !isHit) matchesFilter = false;
        if (STATE.quickFilter === 'new' && !isNew) matchesFilter = false;
        if (STATE.quickFilter === 'spicy' && !isSpicy) matchesFilter = false;

        if (matchesQuery && matchesFilter) {
            card.style.display = 'flex';
            visibleCount++;
        } else {
            card.style.display = 'none';
        }
    });

    // Hide empty category blocks
    categories.forEach(cat => {
        const hasVisible = Array.from(cat.querySelectorAll('.dish-card')).some(c => c.style.display !== 'none');
        cat.style.display = hasVisible ? 'block' : 'none';
    });

    // No results banner
    const noResults = document.getElementById('noResultsBlock');
    if (noResults) {
        noResults.style.display = visibleCount === 0 ? 'block' : 'none';
    }
}

function clearSearch() {
    const input = document.getElementById('menuSearchInput');
    if (input) {
        input.value = '';
        STATE.quickFilter = 'all';
        document.querySelectorAll('.chip-btn').forEach(btn => {
            btn.classList.toggle('active', btn.getAttribute('data-filter') === 'all');
        });
        filterMenuItems();
    }
}

function setQuickFilter(filter) {
    STATE.quickFilter = filter;
    document.querySelectorAll('.chip-btn').forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('data-filter') === filter);
    });
    filterMenuItems();
}

function scrollToCategory(slug) {
    const target = document.getElementById(`cat-${slug}`);
    if (target) {
        const navHeight = 140;
        const targetPos = target.getBoundingClientRect().top + window.pageYOffset - navHeight;
        window.scrollTo({ top: targetPos, behavior: 'smooth' });

        document.querySelectorAll('.cat-nav-btn').forEach(btn => {
            btn.classList.toggle('active', btn.getAttribute('data-target') === slug);
        });
    }
}

function initScrollSpy() {
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const slug = entry.target.getAttribute('data-cat-slug');
                if (slug) {
                    document.querySelectorAll('.cat-nav-btn').forEach(btn => {
                        btn.classList.toggle('active', btn.getAttribute('data-target') === slug);
                    });
                }
            }
        });
    }, { rootMargin: '-20% 0px -70% 0px' });

    document.querySelectorAll('.category-block').forEach(b => observer.observe(b));
}

/* ==========================================================================
   MOBILE NAVIGATION
   ========================================================================== */
function toggleMobileNav() {
    const panel = document.getElementById('mobileNavPanel');
    if (panel) {
        const isShown = panel.style.display === 'block';
        panel.style.display = isShown ? 'none' : 'block';
    }
}

function closeMobileNav() {
    const panel = document.getElementById('mobileNavPanel');
    if (panel) panel.style.display = 'none';
}

/* ==========================================================================
   TOAST NOTIFICATION ENGINE
   ========================================================================== */
function showToast(text, icon = '⚡') {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = 'toast-msg';
    toast.innerHTML = `<span>${icon}</span> <span>${text}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
        toast.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(10px)';
        setTimeout(() => toast.remove(), 300);
    }, 2800);
}

/* ==========================================================================
   CSRF TOKEN UTILITY
   ========================================================================== */
function getCsrfToken() {
    const metaToken = document.querySelector('input[name="csrfmiddlewaretoken"]');
    if (metaToken) return metaToken.value;

    const cookieMatch = document.cookie.match(/csrftoken=([^;]+)/);
    return cookieMatch ? cookieMatch[1] : '';
}

/* ==========================================================================
   MENU COLLAPSE / EXPAND TOGGLE & SMOOTH SCROLL
   ========================================================================== */
function toggleFullMenu(forceState = null) {
    const menuSection = document.getElementById('menuSection');
    const btn = document.getElementById('btnToggleMenu');
    const btnText = document.getElementById('btnToggleMenuText');
    if (!menuSection || !btn) return;

    const isCurrentlyCollapsed = menuSection.classList.contains('menu-collapsed');
    const shouldOpen = forceState !== null ? forceState : isCurrentlyCollapsed;

    if (shouldOpen) {
        menuSection.classList.remove('menu-collapsed');
        menuSection.classList.add('menu-expanded');
        btn.classList.add('is-open');
        if (btnText) btnText.textContent = 'Згорнути каталог меню ↑';
        
        // Re-trigger scroll spy & layout
        setTimeout(() => {
            if (typeof initScrollSpy === 'function') initScrollSpy();
        }, 300);
    } else {
        menuSection.classList.add('menu-collapsed');
        menuSection.classList.remove('menu-expanded');
        btn.classList.remove('is-open');
        if (btnText) btnText.textContent = 'Відкрити повне меню (66 страв) ↓';

        // Scroll back to teaser card smoothly
        const teaser = document.querySelector('.menu-teaser-section');
        if (teaser) {
            teaser.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    }
}

function openAndScrollToMenu(e) {
    if (e) e.preventDefault();
    toggleFullMenu(true);
    const menu = document.getElementById('menuSection');
    if (menu) {
        setTimeout(() => {
            const navHeight = 90;
            const topPos = menu.getBoundingClientRect().top + window.pageYOffset - navHeight;
            window.scrollTo({ top: topPos, behavior: 'smooth' });
        }, 100);
    }
}

/* ==========================================================================
   ANIMATIONS: TOP SCROLL PROGRESS BAR
   ========================================================================== */
function initScrollProgressBar() {
    const bar = document.getElementById('scrollProgressBar');
    if (!bar) return;

    window.addEventListener('scroll', () => {
        const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
        const scrollHeight = document.documentElement.scrollHeight - document.documentElement.clientHeight;
        const progress = scrollHeight > 0 ? (scrollTop / scrollHeight) * 100 : 0;
        bar.style.width = `${progress}%`;
    }, { passive: true });
}

/* ==========================================================================
   ANIMATIONS: HERO AMBIENT EMBERS (SPEAKEASY VAULT PARTICLES)
   ========================================================================== */
function initAmbientEmbersCanvas() {
    const canvas = document.getElementById('ambientEmbersCanvas');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    let width = canvas.width = canvas.offsetWidth || window.innerWidth;
    let height = canvas.height = canvas.offsetHeight || (canvas.parentElement ? canvas.parentElement.offsetHeight : 600);

    window.addEventListener('resize', () => {
        if (canvas) {
            width = canvas.width = canvas.offsetWidth || window.innerWidth;
            height = canvas.height = canvas.offsetHeight || (canvas.parentElement ? canvas.parentElement.offsetHeight : 600);
        }
    });

    const particles = [];
    const count = 35; // optimal for 60fps

    for (let i = 0; i < count; i++) {
        particles.push({
            x: Math.random() * width,
            y: Math.random() * height,
            radius: Math.random() * 2 + 0.8,
            speedY: Math.random() * 0.4 + 0.15,
            speedX: (Math.random() - 0.5) * 0.3,
            alpha: Math.random() * 0.7 + 0.2,
            pulse: Math.random() * 0.02 + 0.005,
            pulseDir: 1
        });
    }

    function animate() {
        ctx.clearRect(0, 0, width, height);

        for (let i = 0; i < count; i++) {
            const p = particles[i];
            p.y -= p.speedY;
            p.x += p.speedX;

            p.alpha += p.pulse * p.pulseDir;
            if (p.alpha > 0.85) p.pulseDir = -1;
            if (p.alpha < 0.2) p.pulseDir = 1;

            if (p.y < -10) {
                p.y = height + 10;
                p.x = Math.random() * width;
            }
            if (p.x < -10) p.x = width + 10;
            if (p.x > width + 10) p.x = -10;

            ctx.beginPath();
            ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(223, 202, 167, ${p.alpha})`;
            ctx.shadowBlur = 8;
            ctx.shadowColor = 'rgba(197, 168, 128, 0.6)';
            ctx.fill();
        }

        requestAnimationFrame(animate);
    }

    animate();
}

/* ==========================================================================
   ANIMATIONS: FLY-TO-CART PARABOLIC SPARK
   ========================================================================== */
function triggerFlyToCart(e) {
    const btn = e.target.closest('button') || e.target;
    if (!btn) return;

    const cartBtn = document.querySelector('.btn-cart-header') || document.querySelector('.cart-trigger');
    if (!cartBtn) return;

    const startRect = btn.getBoundingClientRect();
    const endRect = cartBtn.getBoundingClientRect();

    const dot = document.createElement('div');
    dot.className = 'flying-cart-dot';
    dot.style.left = `${startRect.left + startRect.width / 2 - 10}px`;
    dot.style.top = `${startRect.top + startRect.height / 2 - 10}px`;
    document.body.appendChild(dot);

    // Force layout reflow
    void dot.offsetWidth;

    // Animate target position with parabolic curve
    dot.style.transform = `scale(0.4)`;
    dot.style.left = `${endRect.left + endRect.width / 2 - 10}px`;
    dot.style.top = `${endRect.top + endRect.height / 2 - 10}px`;
    dot.style.opacity = '0';

    setTimeout(() => {
        dot.remove();
        bounceCartBadges();
    }, 750);
}

/* ==========================================================================
   ANIMATIONS: 3D CARD TILT & MOUSE SPOTLIGHT
   ========================================================================== */
function initCardTilt() {
    const cards = document.querySelectorAll('.dish-card, .event-card, .menu-teaser-card');
    cards.forEach(card => {
        card.addEventListener('mousemove', (e) => {
            const rect = card.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            const centerX = rect.width / 2;
            const centerY = rect.height / 2;

            const rotateX = ((y - centerY) / centerY) * -4;
            const rotateY = ((x - centerX) / centerX) * 4;

            card.style.transform = `perspective(800px) rotateX(${rotateX.toFixed(2)}deg) rotateY(${rotateY.toFixed(2)}deg) translateY(-4px)`;
        });

        card.addEventListener('mouseleave', () => {
            card.style.transform = '';
        });
    });
}

// Global escape key listener
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        closeCartDrawer();
        closeCheckoutModal();
        closeReservationModal();
        closeQuickViewModal();
        closeReviewModal();
        closeOrderTrackModal();
    }
});

/* ==========================================================================
   INTERACTIVE ZONES & SPACES EXPLORER
   ========================================================================== */
const ZONES_DATA = {
    main_vault: {
        title: "Головний зал склепінь XVII століття",
        tag: "АВТЕНТИЧНА ІСТОРІЯ",
        capacity: "👥 До 85 гостей &middot; Банкетний формат",
        desc: "Серце закладу під багатовіковими цегляними арками. Унікальна природна акустика, тепле приглушене світло ламп Edison та жива музика створюють атмосферу, якої немає більше ніде в західній Україні.",
        img: "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1200&q=80",
        resZone: "main",
        features: [
            "Автентична цегла 1600-х",
            "Сцена для живих виступів",
            "Винна колекція Sommelier",
            "Комфортні м'які дивани"
        ]
    },
    speakeasy_bar: {
        title: "Контактний Speakeasy Бар",
        tag: "АВТОРСЬКА МІКСОЛОГІЯ",
        capacity: "🍸 30 барних місць + високі столи",
        desc: "Найдовша контактна барна стійка Тернополя з масиву мореного дуба. Понад 120 преміальних позицій віскі, джину та мескалю. Смоук-подача та шоу авторських коктейлів від наших топових бартендерів.",
        img: "https://images.unsplash.com/photo-1551024709-8f23befc6f87?auto=format&fit=crop&w=1200&q=80",
        resZone: "bar",
        features: [
            "120+ видів рідкісного алкоголю",
            "Шоу-подача зі сухим льодом",
            "Фірмові настоянки Бункермуз",
            "Пряме спілкування з бартендером"
        ]
    },
    vip_lounge: {
        title: "VIP Lounge & Cigar Room",
        tag: "ПРИВАТНІСТЬ & СТАТУС",
        capacity: "🛋️ До 16 гостей &middot; Повна ізоляція",
        desc: "Абсолютна конфіденційність для особливих вечорів, ділових переговорів або святкування у вузькому колі. Глибокі шкіряні дивани Chesterfield, персональний батлер та вишуканий сигарний х'юмідор.",
        img: "https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?auto=format&fit=crop&w=1200&q=80",
        resZone: "lounge",
        features: [
            "Повна звукоізоляція та приватність",
            "Дивани Chesterfield",
            "Персональний офіціант",
            "Преміальні кальяни Wookah"
        ]
    },
    karaoke: {
        title: "Караоке-зал Evolution Pro",
        tag: "ВИСОКИЙ ДРАЙВ ТА ЗВУК",
        capacity: "🎤 До 40 гостей &middot; Концертна акустика",
        desc: "Професійне обладнання Evolution Pro 2, мікрофони Shure Beta, потужний звук та каталог із понад 80 000 треків. Світлове лазерне оформлення та окремий бар для вашої вечірки.",
        img: "https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?auto=format&fit=crop&w=1200&q=80",
        resZone: "karaoke",
        features: [
            "База 80 000+ світових пісень",
            "Мікрофони Shure Beta 58A",
            "Динамічне світлове шоу",
            "Окремий персонал зали"
        ]
    },
    art_patio: {
        title: "Літній Арт-Дворик (Art Patio)",
        tag: "АТМОСФЕРА ПІД ВІДКРИТИМ НЕБОМ",
        capacity: "🌿 До 95 гостей &middot; Літня тераса",
        desc: "Затишний зелений дворик, схований від міського шуму в самому центрі Тернополя. Відкрите небо, арт-інсталяції сучасних художників, літній бар та акустичні вечори щоп'ятниці.",
        img: "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=1200&q=80",
        resZone: "art",
        features: [
            "Живі рослини та зелена арка",
            "Літні авторські Aperitivo",
            "Виставки українських митців",
            "Теплі пледи та газові обігрівачі"
        ]
    }
};

let currentZoneKey = 'main_vault';

function switchZone(zoneKey) {
    const data = ZONES_DATA[zoneKey];
    if (!data) return;
    currentZoneKey = zoneKey;

    // Update active tab buttons
    document.querySelectorAll('.zone-tab-btn').forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('data-zone') === zoneKey);
    });

    const card = document.getElementById('zoneShowcaseCard');
    if (!card) return;

    // Smooth fade effect
    card.style.opacity = '0.3';
    card.style.transform = 'translateY(8px)';

    setTimeout(() => {
        const heroImg = document.getElementById('zoneHeroImage');
        const capBadge = document.getElementById('zoneCapacityBadge');
        const tagLine = document.getElementById('zoneTagLine');
        const title = document.getElementById('zoneTitle');
        const desc = document.getElementById('zoneDesc');
        const featGrid = document.getElementById('zoneFeaturesGrid');
        const bookBtn = document.getElementById('btnBookThisZone');

        if (heroImg) heroImg.src = data.img;
        if (capBadge) capBadge.innerHTML = data.capacity;
        if (tagLine) tagLine.textContent = data.tag;
        if (title) title.textContent = data.title;
        if (desc) desc.textContent = data.desc;

        if (featGrid) {
            featGrid.innerHTML = data.features.map(f => `
                <div class="zf-chip"><span class="zf-bullet">✦</span> ${f}</div>
            `).join('');
        }

        if (bookBtn) {
            bookBtn.setAttribute('onclick', `openReservationWithZone('${data.resZone}')`);
        }

        card.style.opacity = '1';
        card.style.transform = 'translateY(0)';
    }, 200);
}

function openReservationWithZone(zoneCode) {
    openReservationModal();
    const zoneSelect = document.getElementById('resZone');
    if (zoneSelect) {
        zoneSelect.value = zoneCode;
    }
}

/* ==========================================================================
   ORDER TRACKER MODAL LOGIC
   ========================================================================== */
function openOrderTrackModal(orderNumber = '') {
    const modal = document.getElementById('orderTrackModal');
    const backdrop = document.getElementById('orderTrackBackdrop');
    if (!modal) return;

    modal.classList.add('active');
    if (backdrop) backdrop.classList.add('active');
    document.body.classList.add('modal-open');

    if (orderNumber) {
        const input = document.getElementById('trackOrderInput');
        if (input) {
            input.value = orderNumber;
            searchOrderStatus();
        }
    }
}

function closeOrderTrackModal() {
    const modal = document.getElementById('orderTrackModal');
    const backdrop = document.getElementById('orderTrackBackdrop');
    if (modal) modal.classList.remove('active');
    if (backdrop) backdrop.classList.remove('active');
    document.body.classList.remove('modal-open');
}

async function searchOrderStatus() {
    const input = document.getElementById('trackOrderInput');
    if (!input) return;
    const orderNum = input.value.trim();

    const loading = document.getElementById('trackLoading');
    const errorBox = document.getElementById('trackError');
    const resultBox = document.getElementById('trackResult');

    if (!orderNum) {
        showToast('Введіть номер замовлення (напр. BM-A1B2C3)', '⚠️');
        return;
    }

    if (loading) loading.style.display = 'flex';
    if (errorBox) errorBox.style.display = 'none';
    if (resultBox) resultBox.style.display = 'none';

    try {
        const resp = await fetch(`/api/orders/track/${encodeURIComponent(orderNum)}/`);
        const data = await resp.json();

        if (loading) loading.style.display = 'none';

        if (!data.success) {
            if (errorBox) {
                document.getElementById('trackErrorMessage').textContent = data.error || 'Замовлення не знайдено';
                errorBox.style.display = 'block';
            }
            return;
        }

        // Render result
        document.getElementById('resOrderNum').textContent = `#${data.order_number}`;
        document.getElementById('resOrderDate').textContent = data.created_at;
        document.getElementById('resOrderStatus').textContent = data.status_display;
        document.getElementById('resClientName').textContent = data.client_name;
        document.getElementById('resDeliveryType').textContent = data.delivery_type;
        document.getElementById('resTotalAmount').textContent = `${data.total_amount.toFixed(0)} ₴`;

        // Stepper state
        const statusMap = {
            new: 1,
            cooking: 2,
            delivering: 3,
            completed: 4
        };
        const currentStep = statusMap[data.status] || 1;

        const steps = ['new', 'cooking', 'delivering', 'completed'];
        steps.forEach((st, idx) => {
            const node = document.getElementById(`step-${st}`);
            if (node) {
                node.classList.toggle('active', (idx + 1) <= currentStep);
                node.classList.toggle('current', (idx + 1) === currentStep);
            }
        });

        for (let i = 1; i <= 3; i++) {
            const line = document.getElementById(`line-${i}`);
            if (line) line.classList.toggle('active', i < currentStep);
        }

        // Items list
        const list = document.getElementById('resItemsList');
        if (list) {
            list.innerHTML = data.items.map(item => `
                <div class="track-item-row">
                    <span class="ti-title">${item.title} &times; ${item.quantity}</span>
                    <span class="ti-price">${item.item_total.toFixed(0)} ₴</span>
                </div>
            `).join('');
        }

        if (resultBox) resultBox.style.display = 'block';

    } catch (err) {
        if (loading) loading.style.display = 'none';

        // Static Demo Fallback from localStorage or sample
        const cleanNum = orderNum.replace('#', '').trim().toUpperCase();
        let localOrder = null;
        try {
            const saved = JSON.parse(localStorage.getItem('bunkermuz_orders') || '{}');
            localOrder = saved[cleanNum];
        } catch(e) {}

        if (!localOrder && cleanNum.startsWith('BM-')) {
            localOrder = {
                order_number: cleanNum,
                created_at: new Date().toLocaleDateString('uk-UA') + ' ' + new Date().toLocaleTimeString('uk-UA', {hour: '2-digit', minute:'2-digit'}),
                status: 'cooking',
                status_display: 'Готується на кухні',
                client_name: 'Гість Бункермуз',
                delivery_type: 'Доставка курʼєром',
                total_amount: 540,
                items: [
                    { title: 'Філадельфія з лососем', quantity: 1, item_total: 360 },
                    { title: 'Коктейль Pornstar Martini', quantity: 1, item_total: 180 }
                ]
            };
        }

        if (localOrder) {
            document.getElementById('resOrderNum').textContent = `#${localOrder.order_number}`;
            document.getElementById('resOrderDate').textContent = localOrder.created_at;
            document.getElementById('resOrderStatus').textContent = localOrder.status_display;
            document.getElementById('resClientName').textContent = localOrder.client_name;
            document.getElementById('resDeliveryType').textContent = localOrder.delivery_type_display || localOrder.delivery_type;
            document.getElementById('resTotalAmount').textContent = typeof localOrder.total_amount === 'number' ? `${localOrder.total_amount.toFixed(0)} ₴` : localOrder.total_amount;

            const statusMap = { new: 1, cooking: 2, delivering: 3, completed: 4 };
            const currentStep = statusMap[localOrder.status] || 2;
            ['new', 'cooking', 'delivering', 'completed'].forEach((st, idx) => {
                const node = document.getElementById(`step-${st}`);
                if (node) {
                    node.classList.toggle('active', (idx + 1) <= currentStep);
                    node.classList.toggle('current', (idx + 1) === currentStep);
                }
            });
            for (let i = 1; i <= 3; i++) {
                const line = document.getElementById(`line-${i}`);
                if (line) line.classList.toggle('active', i < currentStep);
            }
            const list = document.getElementById('resItemsList');
            if (list && localOrder.items) {
                list.innerHTML = localOrder.items.map(item => `
                    <div class="track-item-row">
                        <span class="ti-title">${item.title} &times; ${item.quantity}</span>
                        <span class="ti-price">${item.item_total || item.subtotal || 250} ₴</span>
                    </div>
                `).join('');
            }
            if (resultBox) resultBox.style.display = 'block';
            return;
        }

        if (errorBox) {
            document.getElementById('trackErrorMessage').textContent = 'Замовлення не знайдено або номер введено невірно.';
            errorBox.style.display = 'block';
        }
    }
}



/* ==========================================================================
   FEATURE 1: CHEF'S GASTRONOMIC PAIRING GUIDE LOGIC
   ========================================================================== */
const PAIRING_SETS = {
    romance: {
        title: "Сет «L'Amour Speakeasy»: Тар-тар з лосося & Pornstar Passion Martini",
        primaryImg: "https://images.unsplash.com/photo-1534422298391-e4f8c172dddb?auto=format&fit=crop&w=700&q=80",
        secondaryImg: "https://images.unsplash.com/photo-1551024709-8f23befc6f87?auto=format&fit=crop&w=500&q=80",
        vibeTag: "🕯️ ІДЕАЛЬНО ДЛЯ ДВОХ · РОМАНТИЧНА ВЕЧЕРЯ",
        desc: "Ніжний тартар зі свіжого норвезького лосося з авокадо та соусом понзу в гармонійному поєднанні з яскравим авторським коктейлем на основі маракуї, ванілі та подачею з шотом ігристого вина.",
        items: [
            { id: 160, title: 'Тар-тар з лосося', weight: '220 г', price: 390, img: 'https://images.unsplash.com/photo-1534422298391-e4f8c172dddb?auto=format&fit=crop&w=700&q=80', desc: 'свіжий лосось, стиглий авокадо, цибуля шалот, каперси' },
            { id: 200, title: 'Pornstar Passion Martini', weight: '180 мл', price: 270, img: 'https://images.unsplash.com/photo-1551024709-8f23befc6f87?auto=format&fit=crop&w=500&q=80', desc: 'ванільна горілка, пюре маракуї, лайм, келих Brut' }
        ],
        sommelier: "Кисло-солодкий тропічний профіль маракуї бездоганно освіжає рецептори та підкреслює багату текстуру норвезького лосося.",
        oldPrice: 660,
        newPrice: 590,
        economy: 70
    },
    meat: {
        title: "Сет «Feast of the Vaults»: Свинина на пательні, Батат & Whiskey Sour",
        primaryImg: "https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=700&q=80",
        secondaryImg: "https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?auto=format&fit=crop&w=500&q=80",
        vibeTag: "🥩 СИТНА М'ЯСНА ВЕЧЕРЯ & ДУБОВИЙ ВІСКІ",
        desc: "Соковита свинина по-домашньому з золотистою картоплею на чавунній пательні, хрумкий батат з трюфельним соусом та пармезаном, плюс фірмовий Whiskey Sour з нотами дубової бочки.",
        items: [
            { id: 188, title: 'Сковорідка зі свининою', weight: '350 г', price: 290, img: 'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=700&q=80', desc: 'гаряча свинина по-домашньому з цибулею та травами' },
            { id: 201, title: 'Whiskey Sour Oak Barrel', weight: '160 мл', price: 250, img: 'https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?auto=format&fit=crop&w=500&q=80', desc: 'витриманий бурбон, фреш лимона, білок, ангостура' },
            { id: 173, title: 'Батат з пармезаном', weight: '200 г', price: 205, img: 'https://images.unsplash.com/photo-1576107232684-1279f3908594?auto=format&fit=crop&w=500&q=80', desc: 'запечений батат з соусом айолі та тертим пармезаном' }
        ],
        sommelier: "Цитрусовий баланс та шовковиста пінка Whiskey Sour розкривають димний жирний смак свинини і додають шляхетного післясмаку.",
        oldPrice: 745,
        newPrice: 670,
        economy: 75
    },
    speakeasy: {
        title: "Сет «Nocturne Speakeasy»: Лосось у сирній ванні & Bunker Smoked Negroni",
        primaryImg: "https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?auto=format&fit=crop&w=700&q=80",
        secondaryImg: "https://images.unsplash.com/photo-1551538827-9c037cb4f32a?auto=format&fit=crop&w=500&q=80",
        vibeTag: "🍸 АТМОСФЕРА ПІДЗЕМЕЛЬ XVII СТ.",
        desc: "Фірмовий делікатес — ніжний лосось у густому оксамитовому сирному соусі Dorblu & чеддер у парі з легендарним Bunker Smoked Negroni з підкопченням яблуневою тріскою.",
        items: [
            { id: 183, title: 'Лосось в сирній ванні', weight: '280 г', price: 420, img: 'https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?auto=format&fit=crop&w=700&q=80', desc: 'філе лосося на грилі під вершково-сирним соусом з травами' },
            { id: 199, title: 'Bunker Smoked Negroni', weight: '120 мл', price: 280, img: 'https://images.unsplash.com/photo-1551538827-9c037cb4f32a?auto=format&fit=crop&w=500&q=80', desc: 'джин, Campari, червоний вермут, подача під димним клошем' }
        ],
        sommelier: "Гіркувато-пряний трав'яний профіль Negroni розрізає вершкову насиченість сирного соусу — ідеальний гастрономічний контраст.",
        oldPrice: 700,
        newPrice: 630,
        economy: 70
    },
    friends: {
        title: "Сет «Bunker Party Combo»: Бургер Black Angus, Батат & Craft IPA",
        primaryImg: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=700&q=80",
        secondaryImg: "https://images.unsplash.com/photo-1535958636474-b021ee887b13?auto=format&fit=crop&w=500&q=80",
        vibeTag: "🥂 ДЛЯ КОМПАНІЇ ДРУЗІВ & ДРАЙВУ",
        desc: "Великий крафтовий бургер з соковитою телятиною та карамелізованою цибулею, хрумкий батат під сирною шапкою та келих свіжого розливного нефільтрованого Bunker Craft IPA.",
        items: [
            { id: 195, title: 'Бургер з свининою-телятиною', weight: '360 г', price: 295, img: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=700&q=80', desc: 'соковита подвійна котлета, карамелізована цибуля, сир чеддер' },
            { id: 173, title: 'Батат з пармезаном', weight: '200 г', price: 205, img: 'https://images.unsplash.com/photo-1576107232684-1279f3908594?auto=format&fit=crop&w=500&q=80', desc: 'солодка картопля батат, пармезан, трюфельний соус' },
            { id: 203, title: 'Bunker Craft IPA Draft', weight: '500 мл', price: 130, img: 'https://images.unsplash.com/photo-1535958636474-b021ee887b13?auto=format&fit=crop&w=500&q=80', desc: 'свіже охмелене нефільтроване крафтове пиво' }
        ],
        sommelier: "Хмелева цитрусова гірчинка IPA змиває соковиту жирність котлети і робить кожен шматочок бургера таким же свіжим, як перший.",
        oldPrice: 630,
        newPrice: 560,
        economy: 70
    }
};

let currentPairingMood = 'romance';

function selectPairingMood(moodKey) {
    const data = PAIRING_SETS[moodKey];
    if (!data) return;
    currentPairingMood = moodKey;

    document.querySelectorAll('.pairing-mood-btn').forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('data-mood') === moodKey);
    });

    const wrap = document.getElementById('pairingCardWrap');
    if (!wrap) return;

    wrap.style.opacity = '0.3';
    wrap.style.transform = 'translateY(6px)';

    setTimeout(() => {
        wrap.innerHTML = `
            <div class="pairing-card">
                <div class="pc-visual">
                    <div class="pc-img-duo">
                        <img src="${data.primaryImg}" alt="${data.title}" class="pc-img-primary">
                        <img src="${data.secondaryImg}" alt="Pairing Drink" class="pc-img-secondary">
                    </div>
                    <div class="pc-badge-discount">-10% НА СЕТ</div>
                </div>

                <div class="pc-info">
                    <div class="pc-vibe-tag">${data.vibeTag}</div>
                    <h3 class="pc-title">${data.title}</h3>
                    <p class="pc-desc">${data.desc}</p>

                    <div class="pc-items-list">
                        ${data.items.map(it => `
                            <div class="pc-item-row">
                                <span class="item-dot">✦</span>
                                <span class="item-name"><strong>${it.title}</strong> (${it.weight}) — ${it.desc}</span>
                                <span class="item-single-price">${it.price} ₴</span>
                            </div>
                        `).join('')}
                    </div>

                    <div class="pc-sommelier-quote">
                        <span class="sq-icon">💬</span>
                        <p class="sq-text"><strong>Порада сомельє:</strong> ${data.sommelier}</p>
                    </div>

                    <div class="pc-footer-row">
                        <div class="pc-price-block">
                            <span class="pc-old-price">${data.oldPrice} ₴</span>
                            <span class="pc-new-price">${data.newPrice} ₴</span>
                            <span class="pc-economy">Ваша вигода ${data.economy} ₴</span>
                        </div>

                        <div class="pc-actions">
                            <button type="button" class="btn btn-gold btn-lg btn-add-set" onclick="addCurrentSetToCart()">
                                <span class="btn-icon">🛒</span>
                                <span>Замовити цей гастро-сет</span>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        wrap.style.opacity = '1';
        wrap.style.transform = 'translateY(0)';
    }, 180);
}

function addCurrentSetToCart() {
    const data = PAIRING_SETS[currentPairingMood];
    if (!data || !data.items) return;

    data.items.forEach(it => {
        addToCart(it.id, it.title, it.price, it.img, it.weight, 1);
    });

    showToast(`Гастро-сет «${data.title.split(':')[0]}» додано до кошика!`, '✨');
}

/* ==========================================================================
   FEATURE 2: ARCHITECTURAL FLOOR PLAN & SEATING LOGIC
   ========================================================================== */
const FLOOR_TABLES = {
    t1: {
        number: "Стіл #1",
        title: "Стіл #1 біля каміна",
        zone: "vault",
        resZone: "main",
        zoneName: "🏛️ ГОЛОВНИЙ ЗАЛ СКЛЕПІНЬ",
        capacity: "4-6 гостей",
        location: "Поруч із каміном",
        deposit: "Без депозиту",
        vibe: "Камерний, теплий",
        status: "🟢 Вільний на сьогодні",
        isVip: false,
        img: "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=800&q=80",
        desc: "Затишний стіл під автентичними арками XVII століття поруч із декоративним цегляним каміном. Тепле вечірнє світло, м'які оксамитові крісла та ідеальна атмосфера для неквапливої вечері."
    },
    t2: {
        number: "Стіл #2",
        title: "Стіл #2 — Центральна арка",
        zone: "vault",
        resZone: "main",
        zoneName: "🏛️ ГОЛОВНИЙ ЗАЛ СКЛЕПІНЬ",
        capacity: "2-4 гостя",
        location: "Центральне склепіння",
        deposit: "Без депозиту",
        vibe: "Історичний, затишний",
        status: "🟢 Вільний на сьогодні",
        isVip: false,
        img: "https://images.unsplash.com/photo-1550966871-3ed3cdb5ed0c?auto=format&fit=crop&w=800&q=80",
        desc: "Розташований точно під найвищою точкою історичного склепіння. Унікальна акустика, приглушене світло та вид на винну колекцію закладу."
    },
    t3: {
        number: "Стіл #3",
        title: "Стіл #3 — Винна панорама",
        zone: "vault",
        resZone: "main",
        zoneName: "🏛️ ГОЛОВНИЙ ЗАЛ СКЛЕПІНЬ",
        capacity: "4 гостя",
        location: "Біля скляної винної галереї",
        deposit: "Без депозиту",
        vibe: "Гастрономічний",
        status: "🟢 Вільний на сьогодні",
        isVip: false,
        img: "https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?auto=format&fit=crop&w=800&q=80",
        desc: "Стіл навпроти освітленої скляної винної шафи з рідкісними європейськими вінтажами. Ідеальний для вечері з дегустацією авторських страв."
    },
    t4: {
        number: "Стіл #4",
        title: "Стіл #4 — Затишна ніша",
        zone: "vault",
        resZone: "main",
        zoneName: "🏛️ ГОЛОВНИЙ ЗАЛ СКЛЕПІНЬ",
        capacity: "2 гостя (Romantic)",
        location: "Відокремлена арочна ніша",
        deposit: "Без депозиту",
        vibe: "Інтимний, при свічках",
        status: "🟢 Вільний на сьогодні",
        isVip: false,
        img: "https://images.unsplash.com/photo-1543007630-9710e4a00a20?auto=format&fit=crop&w=800&q=80",
        desc: "Круглий стіл у затишній кам'яній ніші, де вас ніхто не потурбує. Ідеальний вибір для освідчення, річниці або романтичного побачення."
    },
    t5: {
        number: "Стіл #5",
        title: "Стіл #5 — Перша лінія сцени",
        zone: "stage",
        resZone: "bar",
        zoneName: "🎷 ДЖАЗ-СЦЕНА & SPEAKEASY",
        capacity: "2-4 гостя",
        location: "Прямо перед джаз-сценою",
        deposit: "Без депозиту",
        vibe: "Жива музика, драйв",
        status: "🟢 Вільний на сьогодні",
        isVip: false,
        img: "https://images.unsplash.com/photo-1511192336575-5a79af67a629?auto=format&fit=crop&w=800&q=80",
        desc: "Найкращі місця для поціновувачів живого звуку. Безпосередній контакт з музикантами, чудова видимість та бездоганне звучання джазових соло."
    },
    t6: {
        number: "Стіл #6",
        title: "Стіл #6 — Сценічна ложа",
        zone: "stage",
        resZone: "bar",
        zoneName: "🎷 ДЖАЗ-СЦЕНА & SPEAKEASY",
        capacity: "4-6 гостей",
        location: "Бокова ложа біля сцени",
        deposit: "Без депозиту",
        vibe: "Жива музика, компанійський",
        status: "🟢 Вільний на сьогодні",
        isVip: false,
        img: "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=800&q=80",
        desc: "Комфортний м'який куточок біля сцени для компанії друзів. Зручно слухати концерт, спілкуватися та замовляти авторські коктейлі."
    },
    tvip1: {
        number: "VIP-1",
        title: "VIP-1 «Панський Кабінет»",
        zone: "vip",
        resZone: "lounge",
        zoneName: "👑 VIP LOUNGE & CIGAR ROOM",
        capacity: "6-10 гостей",
        location: "Окрема закрита ложа",
        deposit: "Депозит 3000 ₴",
        vibe: "Максимальна приватність",
        status: "👑 VIP доступний",
        isVip: true,
        img: "https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?auto=format&fit=crop&w=800&q=80",
        desc: "Преміальна ізольована кімната з велюровими диванами Chesterfield, персональним викликом офіціанта, можливістю курити преміум-сигари та кальяни."
    },
    tvip2: {
        number: "VIP-2",
        title: "VIP-2 «Винний Погріб»",
        zone: "vip",
        resZone: "lounge",
        zoneName: "👑 VIP LOUNGE & CIGAR ROOM",
        capacity: "4-8 гостей",
        location: "Винна дегустаційна зала",
        deposit: "Депозит 2500 ₴",
        vibe: "Елітарний, сомельє",
        status: "👑 VIP доступний",
        isVip: true,
        img: "https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?auto=format&fit=crop&w=800&q=80",
        desc: "Атмосферний круглий дубовий стіл в оточенні колекційних вин. Ідеальний для ділових переговорів, сімейних урочистостей або камерних святкувань."
    },
    tbar: {
        number: "Стійка B1-B5",
        title: "Контактний Speakeasy Бар (B1-B5)",
        zone: "bar",
        resZone: "bar",
        zoneName: "🍸 КОНТАКТНИЙ SPEAKEASY БАР",
        capacity: "1-5 гостей",
        location: "Барна стійка з масиву дуба",
        deposit: "Без депозиту",
        vibe: "Динамічний, бармен-шоу",
        status: "🟢 Вільні стільці",
        isVip: false,
        img: "https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?auto=format&fit=crop&w=800&q=80",
        desc: "Посадка безпосередньо біля шеф-бартендера. Спостерігайте за створенням авторських коктейлів, насолоджуйтесь міксологією та дружніми бесідами."
    }
};

let currentSelectedTableKey = 't1';

function selectFloorTable(tableKey) {
    const data = FLOOR_TABLES[tableKey];
    if (!data) return;
    currentSelectedTableKey = tableKey;

    // Highlight active SVG node
    document.querySelectorAll('.map-table-node').forEach(node => {
        node.classList.remove('active');
    });
    const targetNode = document.getElementById(`node-${tableKey}`);
    if (targetNode) targetNode.classList.add('active');

    // Update Inspector Card
    const card = document.getElementById('fpInspectorCard');
    if (!card) return;

    card.style.opacity = '0.3';
    card.style.transform = 'translateY(6px)';

    setTimeout(() => {
        const zoneTag = document.getElementById('fpiZoneTag');
        const statusBadge = document.getElementById('fpiStatusBadge');
        const numBadge = document.getElementById('fpiNumberBadge');
        const img = document.getElementById('fpiImage');
        const title = document.getElementById('fpiTitle');
        const desc = document.getElementById('fpiDesc');
        const cap = document.getElementById('fpiCapacity');
        const loc = document.getElementById('fpiLocation');
        const dep = document.getElementById('fpiDeposit');
        const vibe = document.getElementById('fpiVibe');
        const bookBtn = document.getElementById('btnBookSelectedTable');

        if (zoneTag) zoneTag.textContent = data.zoneName;
        if (statusBadge) {
            statusBadge.textContent = data.status;
            statusBadge.className = `fpi-status-badge ${data.isVip ? 'vip' : 'free'}`;
        }
        if (numBadge) numBadge.textContent = data.number;
        if (img) {
            img.src = data.img;
            img.alt = data.title;
        }
        if (title) title.textContent = data.title;
        if (desc) desc.textContent = data.desc;
        if (cap) cap.textContent = data.capacity;
        if (loc) loc.textContent = data.location;
        if (dep) dep.textContent = data.deposit;
        if (vibe) vibe.textContent = data.vibe;

        if (bookBtn) {
            bookBtn.innerHTML = `<span>🥂 Забронювати ${data.number}</span>`;
        }

        card.style.opacity = '1';
        card.style.transform = 'translateY(0)';
    }, 180);
}

function filterFloorTables(filterZone) {
    document.querySelectorAll('.fp-pill').forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('data-filter') === filterZone);
    });

    document.querySelectorAll('.map-table-node').forEach(node => {
        const nodeZone = node.getAttribute('data-zone');
        if (filterZone === 'all' || nodeZone === filterZone) {
            node.classList.remove('filtered-out');
        } else {
            node.classList.add('filtered-out');
        }
    });
}

function bookSelectedFloorTable() {
    const data = FLOOR_TABLES[currentSelectedTableKey];
    if (!data) return;

    openReservationModal();

    // Set badge in modal
    const wrap = document.getElementById('selectedTableBadgeWrap');
    const input = document.getElementById('resSelectedTable');
    const display = document.getElementById('resSelectedTableDisplay');
    const zoneSelect = document.getElementById('resZone');

    if (wrap) wrap.style.display = 'block';
    if (input) input.value = `${data.number} (${data.zoneName.replace(/^[^\s]+\s/, '')})`;
    if (display) display.textContent = `${data.number} — ${data.title}`;
    if (zoneSelect && data.resZone) zoneSelect.value = data.resZone;
}

function clearSelectedTable() {
    const wrap = document.getElementById('selectedTableBadgeWrap');
    const input = document.getElementById('resSelectedTable');
    const display = document.getElementById('resSelectedTableDisplay');
    if (wrap) wrap.style.display = 'none';
    if (input) input.value = '';
    if (display) display.textContent = '—';
}
