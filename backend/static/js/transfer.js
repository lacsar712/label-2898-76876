(function () {
    var csrfToken = document.querySelector('[name=csrfmiddlewaretoken]').value;
    var warehousesCache = [];
    var varietiesCache = [];
    var currentStatus = 'all';
    var currentPage = 1;
    var pageSize = 10;
    var currentOrderId = null;
    var currentAction = null;

    var sourceWarehouseSelect = document.getElementById('source-warehouse');
    var targetWarehouseSelect = document.getElementById('target-warehouse');
    var varietySelect = document.getElementById('variety-select');
    var sourceStockInfo = document.getElementById('source-stock-info');
    var quantityInput = document.getElementById('quantity');
    var quantityUnit = document.getElementById('quantity-unit');
    var unitDisplay = document.getElementById('unit-display');
    var transferForm = document.getElementById('transfer-form');
    var transferNoInput = document.getElementById('transfer-no');
    var applyTimeInput = document.getElementById('apply-time');

    var statusTabs = document.getElementById('status-tabs');
    var filterDateFrom = document.getElementById('filter-date-from');
    var filterDateTo = document.getElementById('filter-date-to');
    var filterKeyword = document.getElementById('filter-keyword');
    var btnFilter = document.getElementById('btn-filter');
    var btnResetFilter = document.getElementById('btn-reset-filter');
    var tbody = document.getElementById('transfer-tbody');
    var paginationInfo = document.getElementById('pagination-info');
    var paginationPages = document.getElementById('pagination-pages');
    var btnPrev = document.getElementById('btn-prev-page');
    var btnNext = document.getElementById('btn-next-page');
    var recordCount = document.getElementById('record-count');

    var detailModal = document.getElementById('detail-modal');
    var detailCloseBtn = document.getElementById('detail-close-btn');
    var detailModalFooter = document.getElementById('detail-modal-footer');

    var actionModal = document.getElementById('action-modal');
    var actionModalTitle = document.getElementById('action-modal-title');
    var actionOperatorLabel = document.getElementById('action-operator-label');
    var actionOperator = document.getElementById('action-operator');
    var actionRemark = document.getElementById('action-remark');
    var actionCloseBtn = document.getElementById('action-close-btn');
    var actionCancelBtn = document.getElementById('action-cancel-btn');
    var actionConfirmBtn = document.getElementById('action-confirm-btn');
    var actionRemarkGroup = document.getElementById('action-remark-group');

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

    function escHtml(str) {
        if (!str) return '';
        var d = document.createElement('div');
        d.textContent = str;
        return d.innerHTML;
    }

    function todayStr() {
        var d = new Date();
        var mm = String(d.getMonth() + 1).padStart(2, '0');
        var dd = String(d.getDate()).padStart(2, '0');
        return d.getFullYear() + '-' + mm + '-' + dd;
    }

    function nowStr() {
        var d = new Date();
        var y = d.getFullYear();
        var m = String(d.getMonth() + 1).padStart(2, '0');
        var day = String(d.getDate()).padStart(2, '0');
        var h = String(d.getHours()).padStart(2, '0');
        var min = String(d.getMinutes()).padStart(2, '0');
        return y + '-' + m + '-' + day + ' ' + h + ':' + min;
    }

    function loadWarehouses() {
        fetchJSON('/api/transfer/warehouses/').then(function (data) {
            warehousesCache = data.warehouses || [];
            var options = '<option value="">-- 请选择源库区 --</option>';
            warehousesCache.forEach(function (w) {
                options += '<option value="' + w.id + '">' + escHtml(w.name) + '</option>';
            });
            sourceWarehouseSelect.innerHTML = options;

            var targetOptions = '<option value="">-- 请选择目标库区 --</option>';
            warehousesCache.forEach(function (w) {
                targetOptions += '<option value="' + w.id + '">' + escHtml(w.name) + '</option>';
            });
            targetWarehouseSelect.innerHTML = targetOptions;
        }).catch(function () {
            UI.toast('加载库区数据失败', 'error');
        });
    }

    function loadVarieties() {
        var sourceId = sourceWarehouseSelect.value;
        if (!sourceId) {
            varietySelect.innerHTML = '<option value="">-- 请先选择源库区 --</option>';
            varietiesCache = [];
            updateStockDisplay();
            return;
        }

        fetchJSON('/api/transfer/varieties/?warehouse_id=' + sourceId).then(function (data) {
            varietiesCache = data.varieties || [];
            var html = '<option value="">-- 请选择品种 --</option>';
            varietiesCache.forEach(function (v) {
                html += '<option value="' + v.id + '" data-stock="' + v.stock_quantity + '" data-unit="' + v.unit + '">' +
                    escHtml(v.name) + '（' + escHtml(v.category) + '）' +
                    '</option>';
            });
            varietySelect.innerHTML = html;
            updateStockDisplay();
        }).catch(function () {
            UI.toast('加载品种数据失败', 'error');
        });
    }

    function updateStockDisplay() {
        var opt = varietySelect.options[varietySelect.selectedIndex];
        if (!opt || !opt.value) {
            sourceStockInfo.textContent = '请先选择源库区和品种';
            sourceStockInfo.className = 'stock-info-display';
            quantityUnit.textContent = '';
            unitDisplay.value = '';
            return;
        }
        var stock = parseFloat(opt.dataset.stock || 0);
        var unit = opt.dataset.unit || '';
        sourceStockInfo.textContent = '可用库存：' + stock + ' ' + unit;
        quantityUnit.textContent = unit;
        unitDisplay.value = unit;

        sourceStockInfo.className = 'stock-info-display active';
        if (stock <= 0) {
            sourceStockInfo.className = 'stock-info-display danger';
        } else if (stock < 10) {
            sourceStockInfo.className = 'stock-info-display warning';
        }
    }

    function handleFormSubmit(e) {
        e.preventDefault();

        var sourceWarehouseId = sourceWarehouseSelect.value;
        var targetWarehouseId = targetWarehouseSelect.value;
        var varietyId = varietySelect.value;
        var quantity = quantityInput.value;
        var applicant = document.getElementById('applicant').value.trim();
        var remark = document.getElementById('remark').value.trim();

        if (!sourceWarehouseId) {
            UI.toast('请选择源库区', 'error');
            return;
        }
        if (!targetWarehouseId) {
            UI.toast('请选择目标库区', 'error');
            return;
        }
        if (sourceWarehouseId === targetWarehouseId) {
            UI.toast('源库区和目标库区不能相同', 'error');
            return;
        }
        if (!varietyId) {
            UI.toast('请选择物资品种', 'error');
            return;
        }
        if (!quantity || parseFloat(quantity) <= 0) {
            UI.toast('请输入有效的调拨数量', 'error');
            return;
        }
        if (!applicant) {
            UI.toast('请输入申请人', 'error');
            return;
        }

        UI.showLoader();

        fetch('/api/transfer/create/', {
            method: 'POST',
            credentials: 'same-origin',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': csrfToken,
                'X-Requested-With': 'XMLHttpRequest',
            },
            body: JSON.stringify({
                source_warehouse_id: parseInt(sourceWarehouseId),
                target_warehouse_id: parseInt(targetWarehouseId),
                variety_id: parseInt(varietyId),
                quantity: quantity,
                applicant: applicant,
                remark: remark,
            }),
        })
            .then(function (r) { return r.json(); })
            .then(function (data) {
                UI.hideLoader();
                if (data.success) {
                    UI.toast('调拨申请提交成功，单号：' + data.data.transfer_no);
                    transferNoInput.value = data.data.transfer_no;
                    applyTimeInput.value = nowStr();
                    currentStatus = 'all';
                    updateStatusTabs();
                    currentPage = 1;
                    loadTransferList();
                    loadVarieties();
                } else {
                    UI.toast(data.message || '提交失败', 'error');
                }
            })
            .catch(function () {
                UI.hideLoader();
                UI.toast('网络连接异常', 'error');
            });
    }

    function getStatusClass(statusCode) {
        if (statusCode === 'pending') return 'status-pending';
        if (statusCode === 'approved') return 'status-approved';
        if (statusCode === 'rejected') return 'status-rejected';
        if (statusCode === 'executed') return 'status-executed';
        return '';
    }

    function renderTable(data) {
        var items = data.items || [];
        var total = data.total || 0;
        var totalPages = data.total_pages || 0;

        if (items.length === 0) {
            tbody.innerHTML = '<tr class="empty-row"><td colspan="9">暂无调拨记录</td></tr>';
        } else {
            var html = '';
            items.forEach(function (r) {
                html += '<tr data-id="' + r.id + '">' +
                    '<td><a href="javascript:void(0)" class="transfer-no-link" data-id="' + r.id + '">' + escHtml(r.transfer_no) + '</a></td>' +
                    '<td>' + escHtml(r.source_warehouse) + '</td>' +
                    '<td>' + escHtml(r.target_warehouse) + '</td>' +
                    '<td>' + escHtml(r.variety_name) + '</td>' +
                    '<td>' + escHtml(r.quantity) + ' ' + escHtml(r.unit) + '</td>' +
                    '<td>' + escHtml(r.applicant) + '</td>' +
                    '<td>' + escHtml(r.apply_time) + '</td>' +
                    '<td><span class="status-badge ' + getStatusClass(r.status_code) + '">' + escHtml(r.status) + '</span></td>' +
                    '<td><button class="btn-tech btn-xs btn-detail" data-id="' + r.id + '">详情</button></td>' +
                    '</tr>';
            });
            tbody.innerHTML = html;
            bindRowEvents();
        }

        paginationInfo.textContent = '共 ' + total + ' 条';
        recordCount.textContent = '共 ' + total + ' 条记录';
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
            loadTransferList();
        });
        paginationPages.appendChild(btn);
    }

    function bindRowEvents() {
        tbody.querySelectorAll('.btn-detail').forEach(function (btn) {
            btn.addEventListener('click', function (e) {
                e.stopPropagation();
                var id = parseInt(btn.dataset.id);
                showDetail(id);
            });
        });

        tbody.querySelectorAll('.transfer-no-link').forEach(function (link) {
            link.addEventListener('click', function (e) {
                e.preventDefault();
                var id = parseInt(link.dataset.id);
                showDetail(id);
            });
        });
    }

    function loadTransferList() {
        var params = new URLSearchParams();
        params.set('page', currentPage);
        params.set('page_size', pageSize);
        params.set('status', currentStatus);
        if (filterDateFrom.value) params.set('date_from', filterDateFrom.value);
        if (filterDateTo.value) params.set('date_to', filterDateTo.value);
        if (filterKeyword.value.trim()) params.set('keyword', filterKeyword.value.trim());

        fetchJSON('/api/transfer/list/?' + params.toString()).then(function (data) {
            renderTable(data);
        }).catch(function () {
            UI.toast('加载调拨记录失败', 'error');
        });
    }

    function updateStatusTabs() {
        var tabs = statusTabs.querySelectorAll('.status-tab');
        tabs.forEach(function (tab) {
            tab.classList.toggle('active', tab.dataset.status === currentStatus);
        });
    }

    function showDetail(orderId) {
        currentOrderId = orderId;
        fetchJSON('/api/transfer/detail/' + orderId + '/').then(function (data) {
            if (!data || !data.order) return;
            var order = data.order;
            var logs = data.logs || [];

            document.getElementById('detail-transfer-no').textContent = order.transfer_no;
            document.getElementById('detail-status').innerHTML = '<span class="status-badge ' + getStatusClass(order.status_code) + '">' + escHtml(order.status) + '</span>';
            document.getElementById('detail-applicant').textContent = order.applicant;
            document.getElementById('detail-apply-time').textContent = order.apply_time;
            document.getElementById('detail-source').textContent = order.source_warehouse;
            document.getElementById('detail-target').textContent = order.target_warehouse;
            document.getElementById('detail-variety').textContent = order.variety_name + '（' + order.category + '）';
            document.getElementById('detail-quantity').textContent = order.quantity + ' ' + order.unit;
            document.getElementById('detail-source-stock').textContent = order.source_stock + ' ' + order.unit;
            document.getElementById('detail-target-stock').textContent = order.target_stock + ' ' + order.unit;
            document.getElementById('detail-approver').textContent = order.approver || '-';
            document.getElementById('detail-approval-time').textContent = order.approval_time || '-';
            document.getElementById('detail-executor').textContent = order.executor || '-';
            document.getElementById('detail-execute-time').textContent = order.execute_time || '-';
            document.getElementById('detail-remark').textContent = order.remark || '-';

            var approvalRemarkEl = document.getElementById('detail-approval-remark');
            if (order.approval_remark) {
                approvalRemarkEl.style.display = 'block';
                document.getElementById('detail-approval-remark-text').textContent = order.approval_remark;
            } else {
                approvalRemarkEl.style.display = 'none';
            }

            renderTimeline(logs);
            renderDetailFooter(order);

            detailModal.style.display = 'flex';
        }).catch(function () {
            UI.toast('加载详情失败', 'error');
        });
    }

    function renderTimeline(logs) {
        var timeline = document.getElementById('detail-timeline');
        if (!logs || logs.length === 0) {
            timeline.innerHTML = '<div class="timeline-empty">暂无流转记录</div>';
            return;
        }

        var html = '';
        logs.forEach(function (log, index) {
            var isLast = index === logs.length - 1;
            var iconClass = '';
            if (log.action_code === 'create') iconClass = 'bi-file-plus timeline-icon-create';
            else if (log.action_code === 'approve') iconClass = 'bi-check-circle timeline-icon-approve';
            else if (log.action_code === 'reject') iconClass = 'bi-x-circle timeline-icon-reject';
            else if (log.action_code === 'execute') iconClass = 'bi-play-circle timeline-icon-execute';

            html += '<div class="timeline-item ' + (isLast ? 'timeline-item-last' : '') + '">' +
                '<div class="timeline-dot"><i class="bi ' + iconClass + '"></i></div>' +
                '<div class="timeline-content">' +
                '<div class="timeline-header">' +
                '<span class="timeline-action">' + escHtml(log.action) + '</span>' +
                '<span class="timeline-time">' + escHtml(log.time) + '</span>' +
                '</div>' +
                '<div class="timeline-operator">操作人：' + escHtml(log.operator) + '</div>' +
                (log.remark ? '<div class="timeline-remark">' + escHtml(log.remark) + '</div>' : '') +
                '</div>' +
                '</div>';
        });
        timeline.innerHTML = html;
    }

    function renderDetailFooter(order) {
        var footerHtml = '';
        if (order.status_code === 'pending') {
            footerHtml = '<button class="btn-tech btn-approve" data-action="approve">通过</button>' +
                '<button class="btn-tech btn-reject" data-action="reject">驳回</button>';
        } else if (order.status_code === 'approved') {
            footerHtml = '<button class="btn-tech btn-execute">执行调拨</button>';
        }
        detailModalFooter.innerHTML = footerHtml;

        var btnApprove = detailModalFooter.querySelector('.btn-approve');
        if (btnApprove) {
            btnApprove.addEventListener('click', function () {
                openActionModal('approve');
            });
        }

        var btnReject = detailModalFooter.querySelector('.btn-reject');
        if (btnReject) {
            btnReject.addEventListener('click', function () {
                openActionModal('reject');
            });
        }

        var btnExecute = detailModalFooter.querySelector('.btn-execute');
        if (btnExecute) {
            btnExecute.addEventListener('click', function () {
                openActionModal('execute');
            });
        }
    }

    function openActionModal(action) {
        currentAction = action;
        actionOperator.value = '';
        actionRemark.value = '';

        if (action === 'approve') {
            actionModalTitle.textContent = '审批通过';
            actionOperatorLabel.innerHTML = '审批人 <span class="required">*</span>';
            actionRemarkGroup.style.display = 'block';
            actionRemark.placeholder = '请输入审批意见（可选）';
        } else if (action === 'reject') {
            actionModalTitle.textContent = '审批驳回';
            actionOperatorLabel.innerHTML = '审批人 <span class="required">*</span>';
            actionRemarkGroup.style.display = 'block';
            actionRemark.placeholder = '请输入驳回原因';
        } else if (action === 'execute') {
            actionModalTitle.textContent = '执行调拨';
            actionOperatorLabel.innerHTML = '执行人 <span class="required">*</span>';
            actionRemarkGroup.style.display = 'none';
        }

        actionModal.style.display = 'flex';
    }

    function closeActionModal() {
        actionModal.style.display = 'none';
        currentAction = null;
    }

    function handleActionConfirm() {
        var operator = actionOperator.value.trim();
        if (!operator) {
            UI.toast('请输入操作人姓名', 'error');
            return;
        }

        UI.showLoader();
        detailModal.style.display = 'none';

        var url = '';
        var body = { operator: operator };

        if (currentAction === 'approve' || currentAction === 'reject') {
            url = '/api/transfer/approve/' + currentOrderId + '/';
            body.action = currentAction;
            body.approver = operator;
            body.remark = actionRemark.value.trim();
        } else if (currentAction === 'execute') {
            url = '/api/transfer/execute/' + currentOrderId + '/';
            body.executor = operator;
        }

        fetch(url, {
            method: 'POST',
            credentials: 'same-origin',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': csrfToken,
                'X-Requested-With': 'XMLHttpRequest',
            },
            body: JSON.stringify(body),
        })
            .then(function (r) { return r.json(); })
            .then(function (data) {
                UI.hideLoader();
                if (data.success) {
                    UI.toast(data.message || '操作成功');
                    closeActionModal();
                    loadTransferList();
                } else {
                    UI.toast(data.message || '操作失败', 'error');
                    detailModal.style.display = 'flex';
                }
            })
            .catch(function () {
                UI.hideLoader();
                UI.toast('网络连接异常', 'error');
                detailModal.style.display = 'flex';
            });
    }

    function closeDetail() {
        detailModal.style.display = 'none';
        currentOrderId = null;
    }

    sourceWarehouseSelect.addEventListener('change', function () {
        loadVarieties();
    });

    varietySelect.addEventListener('change', function () {
        updateStockDisplay();
    });

    transferForm.addEventListener('submit', handleFormSubmit);

    statusTabs.querySelectorAll('.status-tab').forEach(function (tab) {
        tab.addEventListener('click', function () {
            currentStatus = tab.dataset.status;
            updateStatusTabs();
            currentPage = 1;
            loadTransferList();
        });
    });

    btnFilter.addEventListener('click', function () {
        currentPage = 1;
        loadTransferList();
    });

    btnResetFilter.addEventListener('click', function () {
        filterDateFrom.value = '';
        filterDateTo.value = '';
        filterKeyword.value = '';
        currentPage = 1;
        loadTransferList();
    });

    btnPrev.addEventListener('click', function () {
        if (currentPage > 1) {
            currentPage--;
            loadTransferList();
        }
    });

    btnNext.addEventListener('click', function () {
        currentPage++;
        loadTransferList();
    });

    detailCloseBtn.addEventListener('click', closeDetail);
    detailModal.addEventListener('click', function (e) {
        if (e.target === detailModal) {
            closeDetail();
        }
    });

    actionCloseBtn.addEventListener('click', closeActionModal);
    actionCancelBtn.addEventListener('click', closeActionModal);
    actionModal.addEventListener('click', function (e) {
        if (e.target === actionModal) {
            closeActionModal();
        }
    });
    actionConfirmBtn.addEventListener('click', handleActionConfirm);

    loadWarehouses();
    loadTransferList();
})();
