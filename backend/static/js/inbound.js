(function () {
    var csrfToken = document.querySelector('[name=csrfmiddlewaretoken]').value;
    var varietiesCache = [];
    var suppliersCache = [];
    var currentPage = 1;
    var pageSize = 10;

    var varietySelect = document.getElementById('variety-select');
    var supplierSelect = document.getElementById('supplier-select');
    var supplierHint = document.getElementById('supplier-hint');
    var stockInfo = document.getElementById('stock-info');
    var quantityInput = document.getElementById('quantity');
    var quantityUnit = document.getElementById('quantity-unit');
    var inboundForm = document.getElementById('inbound-form');
    var inboundDateInput = document.getElementById('inbound-date');
    var tbody = document.getElementById('inbound-tbody');
    var paginationInfo = document.getElementById('pagination-info');
    var paginationPages = document.getElementById('pagination-pages');
    var btnPrev = document.getElementById('btn-prev-page');
    var btnNext = document.getElementById('btn-next-page');
    var filterDateFrom = document.getElementById('filter-date-from');
    var filterDateTo = document.getElementById('filter-date-to');
    var filterKeyword = document.getElementById('filter-keyword');
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
        fetchJSON('/api/inbound/varieties/').then(function (data) {
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

    function loadActiveSuppliers() {
        fetchJSON('/api/supplier/active-list/').then(function (data) {
            suppliersCache = data.suppliers || [];
            supplierSelect.innerHTML = '<option value="">-- 请选择供应商（仅合作中） --</option>';
            suppliersCache.forEach(function (s) {
                var opt = document.createElement('option');
                opt.value = s.id;
                opt.textContent = s.code + ' - ' + s.name;
                supplierSelect.appendChild(opt);
            });
            if (suppliersCache.length > 0) {
                supplierHint.style.display = 'flex';
            }
        }).catch(function () {
            UI.toast('加载供应商数据失败', 'error');
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

    function loadInboundList() {
        var params = new URLSearchParams();
        params.set('page', currentPage);
        params.set('page_size', pageSize);
        if (filterDateFrom.value) params.set('date_from', filterDateFrom.value);
        if (filterDateTo.value) params.set('date_to', filterDateTo.value);
        if (filterKeyword.value.trim()) params.set('keyword', filterKeyword.value.trim());

        fetchJSON('/api/inbound/list/?' + params.toString()).then(function (data) {
            renderTable(data);
        }).catch(function () {
            UI.toast('加载入库记录失败', 'error');
        });
    }

    function renderTable(data) {
        var items = data.items || [];
        var total = data.total || 0;
        var totalPages = data.total_pages || 0;

        if (items.length === 0) {
            tbody.innerHTML = '<tr class="empty-row"><td colspan="8">暂无入库记录</td></tr>';
        } else {
            var html = '';
            items.forEach(function (r) {
                var statusClass = 'status-draft';
                if (r.status === '已完成') statusClass = 'status-completed';
                else if (r.status === '已审核') statusClass = 'status-approved';

                html += '<tr>' +
                    '<td>' + escHtml(r.inbound_no) + '</td>' +
                    '<td>' + escHtml(r.variety_name) + '</td>' +
                    '<td>' + escHtml(r.category) + '</td>' +
                    '<td>' + escHtml(r.quantity) + ' ' + escHtml(r.unit) + '</td>' +
                    '<td>' + escHtml(r.supplier || '未指定') + '</td>' +
                    '<td>' + escHtml(r.inbound_date) + '</td>' +
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
            loadInboundList();
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
        var supplierId = supplierSelect.value;
        var inboundDate = inboundDateInput.value;
        var operator = document.getElementById('operator').value.trim();
        var remark = document.getElementById('remark').value.trim();

        if (!varietyId) {
            UI.toast('请选择物资品种', 'error');
            return;
        }
        if (!quantity || parseFloat(quantity) <= 0) {
            UI.toast('请输入有效的入库数量', 'error');
            return;
        }
        if (!inboundDate) {
            UI.toast('请选择入库日期', 'error');
            return;
        }

        UI.showLoader();

        fetch('/api/inbound/create/', {
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
                supplier_id: supplierId ? parseInt(supplierId) : null,
                inbound_date: inboundDate,
                operator: operator,
                remark: remark,
            }),
        })
            .then(function (r) { return r.json(); })
            .then(function (data) {
                UI.hideLoader();
                if (data.success) {
                    UI.toast('入库登记成功，单号：' + data.data.inbound_no);
                    document.getElementById('inbound-no').value = data.data.inbound_no;
                    inboundForm.reset();
                    document.getElementById('inbound-no').value = '';
                    stockInfo.textContent = '选择品种后显示';
                    stockInfo.className = 'stock-info-display';
                    quantityUnit.textContent = '';
                    currentPage = 1;
                    loadInboundList();
                    loadVarieties();
                } else {
                    UI.toast(data.message || '入库登记失败', 'error');
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
        if (filterKeyword.value.trim()) params.set('keyword', filterKeyword.value.trim());

        var url = '/api/inbound/export-csv/?' + params.toString();
        var a = document.createElement('a');
        a.href = url;
        a.download = 'inbound_records.csv';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    }

    varietySelect.addEventListener('change', updateStockDisplay);

    inboundForm.addEventListener('submit', handleFormSubmit);

    btnPrev.addEventListener('click', function () {
        if (currentPage > 1) {
            currentPage--;
            loadInboundList();
        }
    });

    btnNext.addEventListener('click', function () {
        currentPage++;
        loadInboundList();
    });

    btnFilter.addEventListener('click', function () {
        currentPage = 1;
        loadInboundList();
    });

    btnResetFilter.addEventListener('click', function () {
        filterDateFrom.value = '';
        filterDateTo.value = '';
        filterKeyword.value = '';
        currentPage = 1;
        loadInboundList();
    });

    btnExportCsv.addEventListener('click', handleExportCsv);

    inboundDateInput.value = todayStr();

    loadVarieties();
    loadActiveSuppliers();
    loadInboundList();
})();
