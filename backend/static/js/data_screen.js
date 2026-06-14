(function () {
    var COLORS = {
        blue: '#00d2ff',
        green: '#00ff88',
        orange: '#ffaa00',
        red: '#ff4136',
        purple: '#b366ff',
        gridLine: 'rgba(0, 210, 255, 0.12)',
        axisText: 'rgba(255, 255, 255, 0.5)',
        axisLine: 'rgba(0, 210, 255, 0.3)',
        inbound: '#00d2ff',
        outbound: '#ffaa00',
    };

    var REFRESH_INTERVAL = 30000;
    var previousData = null;

    function updateCurrentTime() {
        var now = new Date();
        var timeStr = now.toLocaleTimeString('zh-CN', { hour12: false });
        var dateStr = now.toLocaleDateString('zh-CN', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            weekday: 'long'
        });
        var el = document.getElementById('current-time');
        if (el) {
            el.textContent = dateStr + ' ' + timeStr;
        }
    }

    function fetchJSON(url) {
        return fetch(url, {
            headers: { 'X-Requested-With': 'XMLHttpRequest' },
            credentials: 'same-origin',
        }).then(function (r) { return r.json(); });
    }

    function formatNumber(num, decimals) {
        if (decimals === undefined) decimals = 0;
        return Number(num).toLocaleString('zh-CN', {
            minimumFractionDigits: decimals,
            maximumFractionDigits: decimals
        });
    }

    function animateNumber(el, from, to, duration, decimals) {
        if (decimals === undefined) decimals = 0;
        var startTime = null;
        var diff = to - from;

        function step(timestamp) {
            if (!startTime) startTime = timestamp;
            var progress = Math.min((timestamp - startTime) / duration, 1);
            var eased = 1 - Math.pow(1 - progress, 3);
            var current = from + diff * eased;
            el.textContent = formatNumber(current, decimals);
            if (progress < 1) {
                requestAnimationFrame(step);
            } else {
                el.textContent = formatNumber(to, decimals);
            }
        }
        requestAnimationFrame(step);
    }

    function renderFlipDigits(containerId, value, decimals) {
        if (decimals === undefined) decimals = 0;
        var container = document.getElementById(containerId);
        if (!container) return;

        var strValue = formatNumber(value, decimals);
        var digits = strValue.split('');
        var currentDigits = container.querySelectorAll('.digit');
        var currentHtml = '';
        currentDigits.forEach(function (d) { currentHtml += d.textContent; });

        if (currentHtml === strValue && currentDigits.length === digits.length) {
            return;
        }

        var html = '';
        digits.forEach(function (ch, i) {
            var needsFlip = true;
            if (currentDigits[i] && currentDigits[i].textContent === ch) {
                needsFlip = false;
            }
            if (ch === '.' || ch === ',') {
                html += '<span class="digit-sep">' + ch + '</span>';
            } else {
                html += '<span class="digit' + (needsFlip ? ' flipping' : '') + '">' + ch + '</span>';
            }
        });

        container.innerHTML = html;

        setTimeout(function () {
            var flipping = container.querySelectorAll('.digit.flipping');
            flipping.forEach(function (d) {
                d.classList.remove('flipping');
            });
        }, 500);
    }

    function renderFlipCards(data) {
        var cards = data.flip_cards;

        var stockFrom = previousData ? previousData.flip_cards.total_stock : 0;
        var turnoverFrom = previousData ? previousData.flip_cards.turnover_rate : 0;
        var inCountFrom = previousData ? previousData.flip_cards.today_in_count : 0;
        var outCountFrom = previousData ? previousData.flip_cards.today_out_count : 0;

        var stockEl = document.querySelector('#digits-stock');
        var turnoverEl = document.querySelector('#digits-turnover');
        var inCountEl = document.querySelector('#digits-inbound');
        var outCountEl = document.querySelector('#digits-outbound');

        if (stockEl && !previousData) {
            animateNumber({
                textContent: '',
                get textContent() { return this._tc || '0'; },
                set textContent(v) {
                    this._tc = v;
                    renderFlipDigits('digits-stock', parseFloat(v.replace(/,/g, '')), 0);
                }
            }, stockFrom, cards.total_stock, 1200, 0);
        } else {
            renderFlipDigits('digits-stock', cards.total_stock, 0);
        }

        if (turnoverEl && !previousData) {
            animateNumber({
                textContent: '',
                get textContent() { return this._tc || '0'; },
                set textContent(v) {
                    this._tc = v;
                    renderFlipDigits('digits-turnover', parseFloat(v.replace(/,/g, '')), 2);
                }
            }, turnoverFrom, cards.turnover_rate, 1200, 2);
        } else {
            renderFlipDigits('digits-turnover', cards.turnover_rate, 2);
        }

        if (inCountEl && !previousData) {
            animateNumber({
                textContent: '',
                get textContent() { return this._tc || '0'; },
                set textContent(v) {
                    this._tc = v;
                    renderFlipDigits('digits-inbound', parseFloat(v.replace(/,/g, '')), 0);
                }
            }, inCountFrom, cards.today_in_count, 1000, 0);
        } else {
            renderFlipDigits('digits-inbound', cards.today_in_count, 0);
        }

        if (outCountEl && !previousData) {
            animateNumber({
                textContent: '',
                get textContent() { return this._tc || '0'; },
                set textContent(v) {
                    this._tc = v;
                    renderFlipDigits('digits-outbound', parseFloat(v.replace(/,/g, '')), 0);
                }
            }, outCountFrom, cards.today_out_count, 1000, 0);
        } else {
            renderFlipDigits('digits-outbound', cards.today_out_count, 0);
        }
    }

    function renderBarChart(data) {
        var container = document.getElementById('bar-chart');
        var skeleton = container.querySelector('.skeleton');
        var svg = container.querySelector('.bar-svg');

        var chart = data.bar_chart;
        if (!chart || !chart.labels || !chart.labels.length) return;

        if (skeleton) skeleton.style.display = 'none';
        svg.style.display = 'block';

        var width = container.clientWidth || 500;
        var height = container.clientHeight || 350;
        var padL = 60, padR = 30, padT = 30, padB = 50;
        var chartW = width - padL - padR;
        var chartH = height - padT - padB;

        var labels = chart.labels;
        var inbound = chart.inbound;
        var outbound = chart.outbound;

        var allValues = inbound.concat(outbound);
        var maxVal = Math.max.apply(null, allValues) * 1.2;
        maxVal = Math.max(maxVal, 10);

        var groupCount = labels.length;
        var groupWidth = chartW / groupCount;
        var barGap = 12;
        var barWidth = (groupWidth - barGap * 3) / 2;

        var gridLines = '';
        var gridCount = 5;
        for (var gi = 0; gi <= gridCount; gi++) {
            var gy = padT + (gi / gridCount) * chartH;
            var gVal = Math.round(maxVal * (1 - gi / gridCount));
            gridLines += '<line x1="' + padL + '" y1="' + gy.toFixed(1) + '" x2="' + (padL + chartW) + '" y2="' + gy.toFixed(1) + '" stroke="' + COLORS.gridLine + '" stroke-width="1"/>';
            gridLines += '<text x="' + (padL - 10) + '" y="' + (gy + 4).toFixed(1) + '" text-anchor="end" fill="' + COLORS.axisText + '" font-size="11">' + formatNumber(gVal) + '</text>';
        }

        var axisX = '<line x1="' + padL + '" y1="' + (padT + chartH) + '" x2="' + (padL + chartW) + '" y2="' + (padT + chartH) + '" stroke="' + COLORS.axisLine + '" stroke-width="1.5"/>';
        var axisY = '<line x1="' + padL + '" y1="' + padT + '" x2="' + padL + '" y2="' + (padT + chartH) + '" stroke="' + COLORS.axisLine + '" stroke-width="1.5"/>';

        var xLabels = labels.map(function (l, i) {
            var x = padL + groupWidth * i + groupWidth / 2;
            return '<text x="' + x.toFixed(1) + '" y="' + (height - 20) + '" text-anchor="middle" fill="' + COLORS.axisText + '" font-size="12" font-weight="500">' + l + '</text>';
        }).join('');

        var bars = '';
        var valueLabels = '';

        for (var i = 0; i < groupCount; i++) {
            var groupX = padL + groupWidth * i + barGap;

            var inVal = inbound[i];
            var inHeight = (inVal / maxVal) * chartH;
            var inY = padT + chartH - inHeight;
            var inX = groupX;

            var outVal = outbound[i];
            var outHeight = (outVal / maxVal) * chartH;
            var outY = padT + chartH - outHeight;
            var outX = groupX + barWidth + barGap;

            bars += '<rect class="bar-enter" x="' + inX.toFixed(1) + '" y="' + inY.toFixed(1) + '" width="' + barWidth.toFixed(1) + '" height="' + inHeight.toFixed(1) + '" fill="' + COLORS.inbound + '" rx="3" opacity="0.9" style="animation-delay:' + (i * 0.15) + 's">';
            bars += '<animate attributeName="opacity" from="0" to="0.9" dur="0.6s" fill="freeze" begin="' + (i * 0.15) + 's"/>';
            bars += '</rect>';

            bars += '<rect class="bar-enter" x="' + outX.toFixed(1) + '" y="' + outY.toFixed(1) + '" width="' + barWidth.toFixed(1) + '" height="' + outHeight.toFixed(1) + '" fill="' + COLORS.outbound + '" rx="3" opacity="0.9" style="animation-delay:' + (i * 0.15 + 0.08) + 's">';
            bars += '<animate attributeName="opacity" from="0" to="0.9" dur="0.6s" fill="freeze" begin="' + (i * 0.15 + 0.08) + 's"/>';
            bars += '</rect>';

            valueLabels += '<text x="' + (inX + barWidth / 2).toFixed(1) + '" y="' + (inY - 8).toFixed(1) + '" text-anchor="middle" fill="' + COLORS.inbound + '" font-size="11" font-weight="600">' + formatNumber(inVal) + '</text>';
            valueLabels += '<text x="' + (outX + barWidth / 2).toFixed(1) + '" y="' + (outY - 8).toFixed(1) + '" text-anchor="middle" fill="' + COLORS.outbound + '" font-size="11" font-weight="600">' + formatNumber(outVal) + '</text>';
        }

        var svgContent = '<svg class="bar-svg" viewBox="0 0 ' + width + ' ' + height + '" preserveAspectRatio="xMidYMid meet">' +
            '<defs>' +
            '<linearGradient id="inboundGrad" x1="0" y1="0" x2="0" y2="1">' +
            '<stop offset="0%" stop-color="' + COLORS.inbound + '" stop-opacity="1"/>' +
            '<stop offset="100%" stop-color="' + COLORS.inbound + '" stop-opacity="0.4"/>' +
            '</linearGradient>' +
            '<linearGradient id="outboundGrad" x1="0" y1="0" x2="0" y2="1">' +
            '<stop offset="0%" stop-color="' + COLORS.outbound + '" stop-opacity="1"/>' +
            '<stop offset="100%" stop-color="' + COLORS.outbound + '" stop-opacity="0.4"/>' +
            '</linearGradient>' +
            '</defs>' +
            gridLines + axisX + axisY + xLabels + bars + valueLabels +
            '</svg>';

        svg.outerHTML = svgContent;
    }

    function renderWarnings(data) {
        var listEl = document.getElementById('warning-list');
        var badgeEl = document.getElementById('warning-badge');
        if (!listEl || !data.warnings) return;

        var warnings = data.warnings;
        var displayWarnings = warnings.slice(0, 10);

        if (badgeEl) {
            var count = warnings.length > 0 && warnings[0].id === 0 ? 0 : warnings.length;
            badgeEl.textContent = count;
            if (count === 0) {
                badgeEl.style.background = '#00ff88';
                badgeEl.style.boxShadow = '0 0 10px rgba(0, 255, 136, 0.5)';
            } else {
                badgeEl.style.background = '#ff4136';
                badgeEl.style.boxShadow = '0 0 10px rgba(255, 65, 54, 0.5)';
            }
        }

        var levelTags = {
            'critical': '紧急',
            'warning': '预警',
            'info': '信息'
        };

        var html = '';
        var duplicateList = displayWarnings.concat(displayWarnings);

        duplicateList.forEach(function (w) {
            html += '<div class="warning-item level-' + w.level + '">' +
                '<div class="warning-item-header">' +
                '<span class="warning-level-tag">' + levelTags[w.level] + '</span>' +
                '<span class="warning-title">' + w.title + '</span>' +
                '<span class="warning-time">' + w.time + '</span>' +
                '</div>' +
                '<div class="warning-content">' + w.content + '</div>' +
                '</div>';
        });

        listEl.innerHTML = html;

        var scrollContainer = document.getElementById('warning-scroll');
        if (scrollContainer && displayWarnings.length > 3) {
            var list = scrollContainer.querySelector('.warning-list');
            list.style.animation = 'none';
            list.offsetHeight;
            list.style.animation = 'scrollUp 25s linear infinite';
        }
    }

    function loadData() {
        fetchJSON('/api/data-screen/overview/')
            .then(function (data) {
                renderBarChart(data);
                renderFlipCards(data);
                renderWarnings(data);
                previousData = data;
            })
            .catch(function (err) {
                console.error('Failed to load data screen data:', err);
            });
    }

    function init() {
        updateCurrentTime();
        setInterval(updateCurrentTime, 1000);

        loadData();
        setInterval(loadData, REFRESH_INTERVAL);

        window.addEventListener('resize', function () {
            if (previousData) {
                renderBarChart(previousData);
            }
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
