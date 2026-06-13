(function () {
    var currentCategoryId = 'all';
    var currentKeyword = '';
    var groupByCategory = false;
    var expandedRowId = null;
    var categoriesCache = [];

    var categoryTabsEl = document.getElementById('category-tabs');
    var searchInput = document.getElementById('search-input');
    var tbody = document.getElementById('inventory-tbody');
    var listInfo = document.getElementById('list-info');
    var btnToggleGroup = document.getElementById('btn-toggle-group');
    var searchTimer = null;

    function fetchJSON(url, options) {
        var opts = options || {};
        opts.credentials = 'same-origin';
        opts.headers = opts.headers || {};
        opts.headers['X-Requested-With'] = 'XMLHttpRequest';
        return fetch(url, opts).then(function (r) { return r.json(); });
    }

    function escHtml(str) {
        if (!str) return '';
        var d = document.createElement('div');
        d.textContent = str;
        return d.innerHTML;
    }

    function formatNumber(str) {
        var n = parseFloat(str);
        if (isNaN(n)) return str;
        if (Number.isInteger(n)) return n.toString();
        return n.toFixed(2).replace(/\.?0+$/, '');
    }

    function loadOverview() {
        fetchJSON('/api/inventory/overview/').then(function (data) {
            var varietyCard = document.getElementById('kpi-total-variety');
            var stockCard = document.getElementById('kpi-total-stock');
            var criticalCard = document.getElementById('kpi-critical');

            varietyCard.querySelector('.kpi-value').textContent = data.total_varieties || 0;
            stockCard.querySelector('.kpi-value').textContent = formatNumber(data.total_stock || '0');
            criticalCard.querySelector('.kpi-value').textContent = data.critical_count || 0;

            [varietyCard, stockCard, criticalCard].forEach(function (c) {
                c.querySelector('.kpi-skeleton').style.display = 'none';
                var content = c.querySelector('.kpi-content');
                content.style.display = 'block';
                content.classList.add('fade-enter');
                setTimeout(function () { content.classList.add('visible'); }, 50);
            });
        }).catch(function () {
            UI.toast('加载概览数据失败', 'error');
        });
    }

    function loadCategoryTabs(categories) {
        categoryTabsEl.innerHTML = '';
        categoriesCache = categories || [];

        categoriesCache.forEach(function (cat) {
            var tab = document.createElement('span');
            tab.className = 'category-tab' + (currentCategoryId === String(cat.id) ? ' active' : '');
            tab.textContent = cat.name;
            tab.dataset.id = cat.id === 0 ? 'all' : String(cat.id);
            tab.addEventListener('click', function () {
                currentCategoryId = tab.dataset.id;
                expandedRowId = null;
                updateTabsActive();
                loadList();
            });
            categoryTabsEl.appendChild(tab);
        });
    }

    function updateTabsActive() {
        var tabs = categoryTabsEl.querySelectorAll('.category-tab');
        tabs.forEach(function (t) {
            t.classList.toggle('active', t.dataset.id === currentCategoryId);
        });
    }

    function getStatusClass(status) {
        if (status === '紧缺') return 'stock-status-critical';
        if (status === '偏低') return 'stock-status-low';
        return 'stock-status-normal';
    }

    function renderRow(v) {
        var expandIcon = '<i class="bi bi-chevron-right expand-icon"></i>';
        return '<tr class="inventory-row" data-id="' + v.id + '">' +
            '<td>' + expandIcon + '</td>' +
            '<td><strong>' + escHtml(v.name) + '</strong></td>' +
            '<td>' + escHtml(formatNumber(v.stock_quantity)) + '</td>' +
            '<td>' + escHtml(v.unit) + '</td>' +
            '<td>' + escHtml(v.category) + '</td>' +
            '<td>' + escHtml(v.last_inbound || '-') + '</td>' +
            '<td>' + escHtml(v.last_outbound || '-') + '</td>' +
            '<td><span class="stock-status-badge ' + getStatusClass(v.status) + '">' + escHtml(v.status) + '</span></td>' +
            '</tr>';
    }

    function renderDetailRow(v, flows) {
        var flowHtml = '';
        if (flows && flows.length > 0) {
            flowHtml = flows.slice(0, 20).map(function (f) {
                var typeClass = f.type === '入库' ? 'flow-type-in' : 'flow-type-out';
                return '<tr>' +
                    '<td><span class="flow-type-tag ' + typeClass + '">' + escHtml(f.type) + '</span></td>' +
                    '<td>' + escHtml(f.no) + '</td>' +
                    '<td>' + escHtml(formatNumber(f.quantity)) + ' ' + escHtml(v.unit) + '</td>' +
                    '<td>' + escHtml(f.counterparty) + '</td>' +
                    '<td>' + escHtml(f.operator) + '</td>' +
                    '<td>' + escHtml(f.date) + '</td>' +
                    '<td>' + escHtml(f.remark || '-') + '</td>' +
                    '</tr>';
            }).join('');
        } else {
            flowHtml = '<tr><td colspan="7" class="flow-empty">暂无出入库流水记录</td></tr>';
        }

        return '<tr class="accordion-detail-row" data-parent-id="' + v.id + '">' +
            '<td colspan="8">' +
            '<div class="accordion-detail-inner">' +
            '<div class="accordion-content">' +
            '<div class="accordion-header">' +
            '<span class="accordion-title"><i class="bi bi-clock-history"></i> 出入库流水明细</span>' +
            '<span class="accordion-info">当前库存：' + escHtml(formatNumber(v.stock_quantity)) + ' ' + escHtml(v.unit) + ' · 共 ' + (flows ? flows.length : 0) + ' 条记录（最近20条）</span>' +
            '</div>' +
            '<table class="flow-table">' +
            '<thead><tr>' +
            '<th>类型</th><th>单据号</th><th>数量</th><th>对方单位</th><th>经办人</th><th>日期</th><th>备注</th>' +
            '</tr></thead>' +
            '<tbody>' + flowHtml + '</tbody>' +
            '</table>' +
            '</div>' +
            '</div>' +
            '</td>' +
            '</tr>';
    }

    function renderGrouped(grouped) {
        var html = '';
        var cats = Object.keys(grouped);
        if (cats.length === 0) {
            return '<tr class="empty-row"><td colspan="8">暂无匹配数据</td></tr>';
        }
        cats.forEach(function (catName) {
            var items = grouped[catName];
            html += '<tr class="category-group-row"><td colspan="8">' +
                '<span class="category-group-name"><i class="bi bi-folder2-open"></i> ' +
                escHtml(catName) + '<span class="category-group-count">(' + items.length + ' 个品种)</span></span>' +
                '</td></tr>';
            items.forEach(function (v) {
                html += renderRow(v);
                if (expandedRowId === v.id) {
                    html += renderDetailRow(v, v._flows || null);
                }
            });
        });
        return html;
    }

    function renderList(data) {
        var varieties = data.varieties || [];
        var grouped = data.grouped || {};

        listInfo.textContent = '共 ' + varieties.length + ' 条记录';

        if (varieties.length === 0) {
            tbody.innerHTML = '<tr class="empty-row"><td colspan="8">暂无匹配数据</td></tr>';
            bindRowEvents();
            return;
        }

        var html = '';
        if (groupByCategory) {
            html = renderGrouped(grouped);
        } else {
            varieties.forEach(function (v) {
                html += renderRow(v);
                if (expandedRowId === v.id) {
                    html += renderDetailRow(v, v._flows || null);
                }
            });
        }

        tbody.innerHTML = html;
        bindRowEvents();

        if (expandedRowId !== null) {
            var mainRow = tbody.querySelector('.inventory-row[data-id="' + expandedRowId + '"]');
            if (mainRow) mainRow.classList.add('expanded');
            var flows = (varieties.find(function (v) { return v.id === expandedRowId; }) || {})._flows;
            if (!flows) {
                loadFlowDetail(expandedRowId);
            }
        }
    }

    function bindRowEvents() {
        tbody.querySelectorAll('.inventory-row').forEach(function (row) {
            row.addEventListener('click', function () {
                var id = parseInt(row.dataset.id);
                if (expandedRowId === id) {
                    expandedRowId = null;
                    row.classList.remove('expanded');
                    var detail = tbody.querySelector('.accordion-detail-row[data-parent-id="' + id + '"]');
                    if (detail) detail.remove();
                } else {
                    var prevId = expandedRowId;
                    expandedRowId = id;
                    if (prevId !== null) {
                        var prevRow = tbody.querySelector('.inventory-row[data-id="' + prevId + '"]');
                        if (prevRow) prevRow.classList.remove('expanded');
                        var prevDetail = tbody.querySelector('.accordion-detail-row[data-parent-id="' + prevId + '"]');
                        if (prevDetail) prevDetail.remove();
                    }
                    row.classList.add('expanded');
                    loadFlowDetail(id);
                }
            });
        });
    }

    function loadFlowDetail(varietyId) {
        fetchJSON('/api/inventory/flow/' + varietyId + '/').then(function (data) {
            if (!data || !data.variety) return;
            if (expandedRowId !== varietyId) return;

            var mainRow = tbody.querySelector('.inventory-row[data-id="' + varietyId + '"]');
            if (!mainRow) { loadList(); return; }

            var existingDetail = tbody.querySelector('.accordion-detail-row[data-parent-id="' + varietyId + '"]');
            if (existingDetail) existingDetail.remove();

            var detailHtml = renderDetailRow(data.variety, data.flows || []);
            mainRow.insertAdjacentHTML('afterend', detailHtml);

            var detailEl = tbody.querySelector('.accordion-detail-row[data-parent-id="' + varietyId + '"]');
            if (detailEl) {
                detailEl.style.opacity = '0';
                detailEl.style.transition = 'opacity 0.25s ease';
                setTimeout(function () { detailEl.style.opacity = '1'; }, 10);
            }
        }).catch(function () {
            UI.toast('加载流水明细失败', 'error');
        });
    }

    function loadList() {
        var params = new URLSearchParams();
        params.set('category_id', currentCategoryId);
        if (currentKeyword.trim()) params.set('keyword', currentKeyword.trim());
        params.set('group_by_category', groupByCategory ? 'true' : 'false');

        fetchJSON('/api/inventory/list/?' + params.toString()).then(function (data) {
            if (categoriesCache.length === 0 && data.categories) {
                loadCategoryTabs(data.categories);
            }
            renderList(data);
        }).catch(function () {
            UI.toast('加载库存数据失败', 'error');
            tbody.innerHTML = '<tr class="empty-row"><td colspan="8">加载失败，请刷新重试</td></tr>';
        });
    }

    function handleSearchInput() {
        if (searchTimer) clearTimeout(searchTimer);
        searchTimer = setTimeout(function () {
            currentKeyword = searchInput.value;
            expandedRowId = null;
            loadList();
        }, 300);
    }

    function handleToggleGroup() {
        groupByCategory = !groupByCategory;
        expandedRowId = null;
        var btn = btnToggleGroup;
        var btnSpan = btn.querySelector('span');
        var btnIcon = btn.querySelector('i');
        if (groupByCategory) {
            btnSpan.textContent = '切换列表视图';
            btnIcon.className = 'bi bi-grid-3x3-gap';
        } else {
            btnSpan.textContent = '切换按品类分组';
            btnIcon.className = 'bi bi-list-ul';
        }
        loadList();
    }

    searchInput.addEventListener('input', handleSearchInput);
    btnToggleGroup.addEventListener('click', handleToggleGroup);

    loadOverview();
    loadList();
})();
