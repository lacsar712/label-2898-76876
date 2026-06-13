(function () {
    var csrfToken = document.querySelector('[name=csrfmiddlewaretoken]').value;
    var varietiesCache = [];
    var currentPage = 1;
    var pageSize = 10;

    var varietySelect = document.getElementById('variety-select');
    var stockInfo = document.getElementById('stock-info');
    var quantityInput = document.getElementById('quantity');
    var quantityUnit = document.getElementById('quantity-unit');
    var outboundForm = document.getElementById('outbound-form');
    var outboundDateInput = document.getElementById('outbound-date');
    var tbody = document.getElementById('outbound-tbody');
    var paginationInfo = document.getElementById('pagination-info');
    var paginationPages = document.getElementById('pagination-pages');
    var btnPrev = document.getElementById('btn-prev-page');
    var btnNext = document.getElementById('btn-next-page');
    var filterDateFrom = document.getElementById('filter-date-from');
    var filterDateTo = document.getElementById('filter-date-to');
    var filterUnit = document.getElementById('filter-unit');
    var btnFilter = document.getElementById('btn-filter');
    var btnResetFilter = document.getElementById('btn-reset-filter');
    var btnExportCsv = document.getElementById('btn-export-csv');

    function todayStr() {
        var d = new Date();
        var mm = String(d.getMonth() + 1).padStart(2, '0');
        var dd = String(d.getDate()).padStart(2, '0');
        return d.getFullYear() + '-' + mm + '-' + dd;
    }

    function fetchJSON(url, options) {
        var opts = options || {};
        opts.credentials = 'same-origin';
        opts.headers = opts.headers || {};
        opts.headers['X-Requested-With'] = 'XMLHttpRequest';
        if (opts.method && opts.method !== 'GET') {
            opts.headers['X-CSRFToken'] = csrfToken;
        }
        return fetch(url, opts).then(function (r) { return r.json(); });
    }

    function loadVarieties() {
        fetchJSON('/api/outbound/varieties/').then(function (data) {
            varietiesCache = data.varieties || [];
            varietySelect.innerHTML = '<option value="">-- 请选择品种 --</option>';
            varietiesCache.forEach(function (v) {
                var opt = document.createElement('option');
                opt.value = v.id;
                opt.textContent = v.name + '（' + v.category + '）';
                opt.dataset.unit = v.unit;
                opt.dataset.stock = v.stock_quantity;
                varietySelect.appendChild(opt);
            });
        }).catch(function () {
            UI.toast('加载品种数据失败', 'error');
        });
    }

    function updateStockDisplay() {
        var opt = varietySelect.options[varietySelect.selectedIndex];
        if (!opt || !opt.value) {
            stockInfo.textContent = '选择品种后显示';
            stockInfo.className = 'stock-info-display';
            quantityUnit.textContent = '';
            return;
        }
        var stock = parseFloat(opt.dataset.stock);
        var unit = opt.dataset.unit;
        stockInfo.textContent = '当前库存：' + stock + ' ' + unit;
        quantityUnit.textContent = unit;

        stockInfo.className = 'stock-info-display active';
        if (stock <= 0) {
            stockInfo.className = 'stock-info-display danger';
        } else if (stock < 10) {
            stockInfo.className = 'stock-info-display warning';
        }
    }

    function loadOutboundList() {
        var params = new URLSearchParams();
        params.set('page', currentPage);
        params.set('page_size', pageSize);
        if (filterDateFrom.value) params.set('date_from', filterDateFrom.value);
        if (filterDateTo.value) params.set('date_to', filterDateTo.value);
        if (filterUnit.value.trim()) params.set('receiving_unit', filterUnit.value.trim());

        fetchJSON('/api/outbound/list/?' + params.toString()).then(function (data) {
            renderTable(data);
        }).catch(function () {
            UI.toast('加载出库记录失败', 'error');
        });
    }

    function renderTable(data) {
        var items = data.items || [];
        var total = data.total || 0;
        var totalPages = data.total_pages || 0;

        if (items.length === 0) {
            tbody.innerHTML = '<tr class="empty-row"><td colspan="9">暂无出库记录</td></tr>';
        } else {
            var html = '';
            items.forEach(function (r) {
                var statusClass = 'status-draft';
                if (r.status === '已完成') statusClass = 'status-completed';
                else if (r.status === '已审核') statusClass = 'status-approved';

                html += '<tr>' +
                    '<td>' + escHtml(r.outbound_no) + '</td>' +
                    '<td>' + escHtml(r.variety_name) + '</td>' +
                    '<td>' + escHtml(r.category) + '</td>' +
                    '<td>' + escHtml(r.quantity) + ' ' + escHtml(r.unit) + '</td>' +
                    '<td>' + escHtml(r.receiving_unit) + '</td>' +
                    '<td>' + escHtml(r.receiver) + '</td>' +
                    '<td>' + escHtml(r.outbound_date) + '</td>' +
                    '<td>' + escHtml(r.operator) + '</td>' +
                    '<td><span class="status-badge ' + statusClass + '">' + escHtml(r.status) + '</span></td>' +
                    '</tr>';
            });
            tbody.innerHTML = html;
        }

        paginationInfo.textContent = '共 ' + total + ' 条';
        renderPagination(totalPages, data.page);
    }

    function renderPagination(totalPages, current) {
        paginationPages.innerHTML = '';
        btnPrev.disabled = current <= 1;
        btnNext.disabled = current >= totalPages;

        var start = Math.max(1, current - 2);
        var end = Math.min(totalPages, current + 2);

        if (start > 1) {
            appendPageBtn(1);
            if (start > 2) {
                var dots = document.createElement('span');
                dots.textContent = '...';
                dots.className = 'page-dots';
                dots.style.cssText = 'color:rgba(255,255,255,0.3);padding:4px 4px;font-size:0.8rem;';
                paginationPages.appendChild(dots);
            }
        }

        for (var i = start; i <= end; i++) {
            appendPageBtn(i, i === current);
        }

        if (end < totalPages) {
            if (end < totalPages - 1) {
                var dots2 = document.createElement('span');
                dots2.textContent = '...';
                dots2.className = 'page-dots';
                dots2.style.cssText = 'color:rgba(255,255,255,0.3);padding:4px 4px;font-size:0.8rem;';
                paginationPages.appendChild(dots2);
            }
            appendPageBtn(totalPages);
        }
    }

    function appendPageBtn(pageNum, isActive) {
        var btn = document.createElement('button');
        btn.textContent = pageNum;
        btn.className = 'page-btn' + (isActive ? ' active' : '');
        btn.addEventListener('click', function () {
            currentPage = pageNum;
            loadOutboundList();
        });
        paginationPages.appendChild(btn);
    }

    function escHtml(str) {
        if (!str) return '';
        var d = document.createElement('div');
        d.textContent = str;
        return d.innerHTML;
    }

    function handleFormSubmit(e) {
        e.preventDefault();

        var varietyId = varietySelect.value;
        var quantity = quantityInput.value;
        var receivingUnit = document.getElementById('receiving-unit').value.trim();
        var receiver = document.getElementById('receiver').value.trim();
        var outboundDate = outboundDateInput.value;
        var operator = document.getElementById('operator').value.trim();
        var purpose = document.getElementById('purpose').value.trim();
        var remark = document.getElementById('remark').value.trim();

        if (!varietyId) {
            UI.toast('请选择物资品种', 'error');
            return;
        }
        if (!quantity || parseFloat(quantity) <= 0) {
            UI.toast('请输入有效的出库数量', 'error');
            return;
        }
        if (!receivingUnit) {
            UI.toast('请输入领用连队', 'error');
            return;
        }
        if (!receiver) {
            UI.toast('请输入领用人', 'error');
            return;
        }
        if (!outboundDate) {
            UI.toast('请选择出库日期', 'error');
            return;
        }

        UI.showLoader();

        fetch('/api/outbound/create/', {
            method: 'POST',
            credentials: 'same-origin',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': csrfToken,
                'X-Requested-With': 'XMLHttpRequest',
            },
            body: JSON.stringify({
                variety_id: parseInt(varietyId),
                quantity: quantity,
                receiving_unit: receivingUnit,
                receiver: receiver,
                outbound_date: outboundDate,
                operator: operator,
                purpose: purpose,
                remark: remark,
            }),
        })
            .then(function (r) { return r.json(); })
            .then(function (data) {
                UI.hideLoader();
                if (data.success) {
                    UI.toast('出库登记成功，单号：' + data.data.outbound_no);
                    document.getElementById('outbound-no').value = data.data.outbound_no;
                    outboundForm.reset();
                    document.getElementById('outbound-no').value = '';
                    stockInfo.textContent = '选择品种后显示';
                    stockInfo.className = 'stock-info-display';
                    quantityUnit.textContent = '';
                    currentPage = 1;
                    loadOutboundList();
                    loadVarieties();
                } else {
                    UI.toast(data.message || '出库登记失败', 'error');
                }
            })
            .catch(function () {
                UI.hideLoader();
                UI.toast('网络连接异常', 'error');
            });
    }

    function handleExportCsv() {
        var params = new URLSearchParams();
        if (filterDateFrom.value) params.set('date_from', filterDateFrom.value);
        if (filterDateTo.value) params.set('date_to', filterDateTo.value);
        if (filterUnit.value.trim()) params.set('receiving_unit', filterUnit.value.trim());

        var url = '/api/outbound/export-csv/?' + params.toString();
        var a = document.createElement('a');
        a.href = url;
        a.download = 'outbound_records.csv';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    }

    varietySelect.addEventListener('change', updateStockDisplay);

    outboundForm.addEventListener('submit', handleFormSubmit);

    btnPrev.addEventListener('click', function () {
        if (currentPage > 1) {
            currentPage--;
            loadOutboundList();
        }
    });

    btnNext.addEventListener('click', function () {
        currentPage++;
        loadOutboundList();
    });

    btnFilter.addEventListener('click', function () {
        currentPage = 1;
        loadOutboundList();
    });

    btnResetFilter.addEventListener('click', function () {
        filterDateFrom.value = '';
        filterDateTo.value = '';
        filterUnit.value = '';
        currentPage = 1;
        loadOutboundList();
    });

    btnExportCsv.addEventListener('click', handleExportCsv);

    outboundDateInput.value = todayStr();

    loadVarieties();
    loadOutboundList();
})();
