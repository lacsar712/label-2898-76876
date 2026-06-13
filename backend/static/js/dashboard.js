(function () {
    var COLORS = {
        blue: '#00d2ff',
        green: '#00ff88',
        orange: '#ffaa00',
        red: '#ff4136',
        purple: '#b366ff',
        pink: '#ff6699',
        gridLine: 'rgba(0, 210, 255, 0.1)',
        axisText: 'rgba(255, 255, 255, 0.45)',
        donutSegments: ['#00d2ff', '#00ff88', '#ffaa00', '#ff4136', '#b366ff', '#ff6699'],
    };

    function fadeIn(el) {
        if (!el) return;
        requestAnimationFrame(function () {
            el.classList.add('visible');
        });
    }

    function animateNumber(el, target, duration) {
        var start = 0;
        var startTime = null;
        function step(timestamp) {
            if (!startTime) startTime = timestamp;
            var progress = Math.min((timestamp - startTime) / duration, 1);
            var eased = 1 - Math.pow(1 - progress, 3);
            el.textContent = Math.floor(eased * target);
            if (progress < 1) {
                requestAnimationFrame(step);
            } else {
                el.textContent = target;
            }
        }
        requestAnimationFrame(step);
    }

    function fetchJSON(url) {
        return fetch(url, {
            headers: { 'X-Requested-With': 'XMLHttpRequest' },
            credentials: 'same-origin',
        }).then(function (r) { return r.json(); });
    }

    function renderKPI(data) {
        var cards = [
            { id: 'kpi-inbound', key: 'inbound_today', accent: 'accent-blue' },
            { id: 'kpi-variety', key: 'total_varieties', accent: 'accent-green' },
            { id: 'kpi-approval', key: 'pending_approvals', accent: 'accent-orange' },
            { id: 'kpi-alert', key: 'active_alerts', accent: 'accent-red' },
        ];
        cards.forEach(function (c) {
            var card = document.getElementById(c.id);
            if (!card) return;
            var skeleton = card.querySelector('.kpi-skeleton');
            var content = card.querySelector('.kpi-content');
            var valueEl = content.querySelector('.kpi-value');
            skeleton.style.display = 'none';
            content.style.display = '';
            valueEl.classList.add(c.accent);
            animateNumber(valueEl, data[c.key], 800);
            fadeIn(card);
        });
    }

    function renderTrendChart(data) {
        var container = document.getElementById('trend-chart');
        var skeleton = container.querySelector('.skeleton-chart');
        var svgWrap = container.querySelector('.trend-svg-wrap');
        if (!data || !data.labels || !data.labels.length) return;

        skeleton.style.display = 'none';
        svgWrap.style.display = '';

        var width = container.clientWidth || 600;
        var height = 220;
        var padL = 50, padR = 20, padT = 20, padB = 36;
        var chartW = width - padL - padR;
        var chartH = height - padT - padB;

        var values = data.values;
        var labels = data.labels;
        var maxVal = Math.max.apply(null, values) * 1.15;
        maxVal = Math.max(maxVal, 1);

        var points = values.map(function (v, i) {
            var x = padL + (i / (values.length - 1)) * chartW;
            var y = padT + chartH - (v / maxVal) * chartH;
            return { x: x, y: y, v: v };
        });

        var linePath = points.map(function (p, i) {
            return (i === 0 ? 'M' : 'L') + p.x.toFixed(1) + ' ' + p.y.toFixed(1);
        }).join(' ');

        var areaPath = linePath + ' L' + points[points.length - 1].x.toFixed(1) + ' ' + (padT + chartH) + ' L' + points[0].x.toFixed(1) + ' ' + (padT + chartH) + ' Z';

        var gridLines = '';
        var gridCount = 5;
        for (var gi = 0; gi <= gridCount; gi++) {
            var gy = padT + (gi / gridCount) * chartH;
            var gVal = Math.round(maxVal * (1 - gi / gridCount));
            gridLines += '<line x1="' + padL + '" y1="' + gy.toFixed(1) + '" x2="' + (padL + chartW) + '" y2="' + gy.toFixed(1) + '" stroke="' + COLORS.gridLine + '" stroke-width="1"/>';
            gridLines += '<text x="' + (padL - 8) + '" y="' + (gy + 4).toFixed(1) + '" text-anchor="end" fill="' + COLORS.axisText + '" font-size="11">' + gVal + '</text>';
        }

        var xLabels = labels.map(function (l, i) {
            var x = padL + (i / (labels.length - 1)) * chartW;
            return '<text x="' + x.toFixed(1) + '" y="' + (height - 8) + '" text-anchor="middle" fill="' + COLORS.axisText + '" font-size="11">' + l + '</text>';
        }).join('');

        var dots = points.map(function (p) {
            return '<circle cx="' + p.x.toFixed(1) + '" cy="' + p.y.toFixed(1) + '" r="4" fill="' + COLORS.blue + '" stroke="#020b1a" stroke-width="2"/>';
        }).join('');

        var svg = '<svg class="trend-svg" viewBox="0 0 ' + width + ' ' + height + '" preserveAspectRatio="xMidYMid meet">' +
            '<defs><linearGradient id="trendGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="' + COLORS.blue + '" stop-opacity="0.3"/><stop offset="100%" stop-color="' + COLORS.blue + '" stop-opacity="0.02"/></linearGradient></defs>' +
            gridLines + xLabels +
            '<path d="' + areaPath + '" fill="url(#trendGrad)"/>' +
            '<path d="' + linePath + '" fill="none" stroke="' + COLORS.blue + '" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>' +
            dots +
            '</svg>';

        svgWrap.innerHTML = svg;
        fadeIn(container);
    }

    function renderDonutChart(data) {
        var container = document.getElementById('category-chart');
        var skeleton = container.querySelector('.skeleton-chart');
        var svgWrap = container.querySelector('.donut-svg-wrap');
        var legendWrap = container.querySelector('.donut-legend');
        if (!data || !data.categories || !data.categories.length) return;

        skeleton.style.display = 'none';
        svgWrap.style.display = '';
        legendWrap.style.display = '';

        var size = 220;
        var cx = size / 2, cy = size / 2;
        var outerR = 95, innerR = 58;
        var total = data.categories.reduce(function (s, c) { return s + c.value; }, 0);
        total = Math.max(total, 1);

        var startAngle = -Math.PI / 2;
        var segments = '';
        var legendItems = '';

        data.categories.forEach(function (cat, i) {
            var fraction = cat.value / total;
            var angle = fraction * 2 * Math.PI;
            var endAngle = startAngle + angle;
            var largeArc = angle > Math.PI ? 1 : 0;

            var x1o = cx + outerR * Math.cos(startAngle);
            var y1o = cy + outerR * Math.sin(startAngle);
            var x2o = cx + outerR * Math.cos(endAngle);
            var y2o = cy + outerR * Math.sin(endAngle);
            var x1i = cx + innerR * Math.cos(endAngle);
            var y1i = cy + innerR * Math.sin(endAngle);
            var x2i = cx + innerR * Math.cos(startAngle);
            var y2i = cy + innerR * Math.sin(startAngle);

            var gap = fraction > 0.03 ? 0.02 : 0;

            var d = 'M' + x1o.toFixed(2) + ' ' + y1o.toFixed(2) +
                ' A' + outerR + ' ' + outerR + ' 0 ' + largeArc + ' 1 ' + x2o.toFixed(2) + ' ' + y2o.toFixed(2) +
                ' L' + x1i.toFixed(2) + ' ' + y1i.toFixed(2) +
                ' A' + innerR + ' ' + innerR + ' 0 ' + largeArc + ' 0 ' + x2i.toFixed(2) + ' ' + y2i.toFixed(2) +
                ' Z';

            var color = COLORS.donutSegments[i % COLORS.donutSegments.length];
            segments += '<path d="' + d + '" fill="' + color + '" opacity="0.85">';

            segments += '<animate attributeName="opacity" from="0" to="0.85" dur="0.6s" fill="freeze" begin="' + (i * 0.1) + 's"/>';
            segments += '</path>';

            var pct = (fraction * 100).toFixed(1);
            legendItems += '<div class="donut-legend-item"><span class="donut-legend-dot" style="background:' + color + '"></span>' + cat.name + ' ' + pct + '%</div>';

            startAngle = endAngle;
        });

        var centerText = '<text x="' + cx + '" y="' + (cy - 6) + '" text-anchor="middle" fill="#fff" font-size="22" font-weight="700">' + total + '</text>' +
            '<text x="' + cx + '" y="' + (cy + 16) + '" text-anchor="middle" fill="' + COLORS.axisText + '" font-size="11">总品种</text>';

        var svg = '<svg class="donut-svg" viewBox="0 0 ' + size + ' ' + size + '" preserveAspectRatio="xMidYMid meet">' + segments + centerText + '</svg>';

        svgWrap.innerHTML = svg;
        legendWrap.innerHTML = legendItems;
        fadeIn(container);
    }

    function renderActivities(data) {
        var panel = document.getElementById('activity-panel');
        var skeleton = panel.querySelector('.activity-skeleton');
        var listEl = panel.querySelector('.activity-list');
        if (!data || !data.activities) return;

        skeleton.style.display = 'none';
        listEl.style.display = '';

        var html = '';
        data.activities.forEach(function (act) {
            var typeClass = act.type === '入库' ? 'type-in' : 'type-out';
            html += '<li class="activity-item" onclick="window.location.href=\'' + act.link + '\'">' +
                '<span class="act-type ' + typeClass + '">' + act.type + '</span>' +
                '<div class="act-info"><span class="act-name">' + act.item + '</span><span class="act-category">' + act.category + '</span></div>' +
                '<span class="act-operator">' + act.operator + '</span>' +
                '<span class="act-qty">' + act.quantity + ' 件</span>' +
                '<span class="act-time">' + act.time + '</span>' +
                '</li>';
        });

        listEl.innerHTML = html;
        fadeIn(panel);
    }

    function init() {
        var kpiCards = document.querySelectorAll('.kpi-card');
        kpiCards.forEach(function (card) { card.classList.add('fade-enter'); });
        var panels = document.querySelectorAll('.chart-panel, .activity-panel');
        panels.forEach(function (p) { p.classList.add('fade-enter'); });

        fetchJSON('/api/dashboard/kpi/').then(renderKPI).catch(function () {});
        fetchJSON('/api/dashboard/trend/').then(renderTrendChart).catch(function () {});
        fetchJSON('/api/dashboard/category/').then(renderDonutChart).catch(function () {});
        fetchJSON('/api/dashboard/activities/').then(renderActivities).catch(function () {});
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
