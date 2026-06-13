(function () {
    var currentFilter = {
        warehouse_id: 'all',
        status: 'all',
        keyword: ''
    };
    var allWarehouses = [];
    var searchTimer = null;
    var activeDropdown = null;

    var cardGrid = document.getElementById('zone-card-grid');
    var zoneCountEl = document.getElementById('zone-count');
    var filterWarehouseEl = document.getElementById('filter-warehouse');
    var filterStatusEl = document.getElementById('filter-status');
    var filterKeywordEl = document.getElementById('filter-keyword');
    var btnFilter = document.getElementById('btn-filter');
    var btnResetFilter = document.getElementById('btn-reset-filter');
    var btnAddZone = document.getElementById('btn-add-zone');

    var detailModal = document.getElementById('zone-detail-modal');
    var detailModalBody = document.getElementById('detail-modal-body');
    var detailModalClose = document.getElementById('detail-modal-close');

    var formModal = document.getElementById('zone-form-modal');
    var formModalTitle = document.getElementById('form-modal-title');
    var formModalClose = document.getElementById('form-modal-close');
    var formCancel = document.getElementById('form-cancel');
    var formSubmit = document.getElementById('form-submit');
    var formWarehouseEl = document.getElementById('form-warehouse');

    function fetchJSON(url, options) {
        var opts = options || {};
        opts.credentials = 'same-origin';
        opts.headers = opts.headers || {};
        opts.headers['X-Requested-With'] = 'XMLHttpRequest';
        opts.headers['Content-Type'] = 'application/json';
        if (!opts.headers['X-CSRFToken']) {
            var csrf = document.querySelector('[name=csrfmiddlewaretoken]');
            if (csrf) opts.headers['X-CSRFToken'] = csrf.value;
        }
        return fetch(url, opts).then(function (r) { return r.json(); });
    }

    function escHtml(str) {
        if (!str) return '';
        var d = document.createElement('div');
        d.textContent = str;
        return d.innerHTML;
    }

    function getStatusClass(statusCode) {
        if (statusCode === 'normal') return 'zone-status-normal';
        if (statusCode === 'maintenance') return 'zone-status-maintenance';
        return 'zone-status-disabled';
    }

    function getStatusText(statusCode) {
        if (statusCode === 'normal') return '正常';
        if (statusCode === 'maintenance') return '维护中';
        if (statusCode === 'disabled') return '停用';
        return statusCode;
    }

    function getUtilizationClass(utilization) {
        if (utilization >= 85) return 'critical';
        if (utilization >= 70) return 'warning';
        return 'normal';
    }

    function getCardStatusClasses(z) {
        var classes = ['zone-card'];
        if (z.status_code === 'maintenance') classes.push('status-maintenance');
        if (z.status_code === 'disabled') classes.push('status-disabled');
        if (z.is_warning && z.status_code !== 'disabled') classes.push('status-warning');
        return classes.join(' ');
    }

    function renderCard(z) {
        var utilClass = getUtilizationClass(z.utilization);
        var utilValueClass = z.utilization >= 85 ? 'utilization-value warning' : 'utilization-value';

        var statusSwitchHtml = '';
        if (z.status_code !== 'disabled') {
            statusSwitchHtml = '<div class="status-switch-wrapper">' +
                '<button class="status-switch-btn" data-action="switch-status" data-id="' + z.id + '" data-status="' + z.status_code + '">' +
                '<i class="bi bi-arrow-repeat"></i> 切换状态' +
                '</button>' +
                '<div class="status-dropdown" id="status-dropdown-' + z.id + '">' +
                '<div class="status-dropdown-item" data-status="normal"><span class="status-dot normal"></span>正常</div>' +
                '<div class="status-dropdown-item" data-status="maintenance"><span class="status-dot maintenance"></span>维护中</div>' +
                '<div class="status-dropdown-item" data-status="disabled"><span class="status-dot disabled"></span>停用</div>' +
                '</div>' +
                '</div>';
        }

        return '<div class="' + getCardStatusClasses(z) + '" data-id="' + z.id + '">' +
            '<div class="zone-card-header">' +
            '<div class="zone-card-title">' +
            '<div class="zone-icon"><i class="bi bi-layers"></i></div>' +
            '<div>' +
            '<div class="zone-name">' + escHtml(z.name) + '</div>' +
            '<div class="zone-code">编码: ' + escHtml(z.code) + '</div>' +
            '</div>' +
            '</div>' +
            '</div>' +
            '<span class="zone-status-badge ' + getStatusClass(z.status_code) + '">' + escHtml(z.status) + '</span>' +
            '<span class="zone-warehouse-tag">' + escHtml(z.warehouse_name) + '</span>' +
            '<div class="zone-info-list">' +
            '<div class="info-item">' +
            '<i class="bi bi-arrows-full"></i><span class="info-label">面积:</span><span class="info-value">' + escHtml(z.area) + ' ㎡</span>' +
            '</div>' +
            '<div class="info-item">' +
            '<i class="bi bi-person"></i><span class="info-label">负责人:</span><span class="info-value">' + escHtml(z.manager || '-') + '</span>' +
            '</div>' +
            '<div class="info-item">' +
            '<i class="bi bi-telephone"></i><span class="info-label">电话:</span><span class="info-value">' + escHtml(z.phone || '-') + '</span>' +
            '</div>' +
            '</div>' +
            '<div class="zone-utilization-bar">' +
            '<div class="utilization-header">' +
            '<span class="utilization-label">空间利用率</span>' +
            '<span class="' + utilValueClass + '">' + z.utilization + '%</span>' +
            '</div>' +
            '<div class="utilization-track">' +
            '<div class="utilization-fill ' + utilClass + '" style="width: ' + Math.min(z.utilization, 100) + '%"></div>' +
            '</div>' +
            '</div>' +
            '<div class="zone-card-footer">' +
            '<span class="zone-card-meta">容量: <strong>' + escHtml(z.current_usage) + '</strong> / ' + escHtml(z.capacity_limit) + '</span>' +
            '<div class="card-actions">' +
            statusSwitchHtml +
            '</div>' +
            '</div>' +
            '</div>';
    }

    function renderList(zones) {
        zoneCountEl.innerHTML = '共加载 <strong>' + (zones ? zones.length : 0) + '</strong> 个分区';

        if (!zones || zones.length === 0) {
            cardGrid.innerHTML = '<div class="empty-state-card">' +
                '<i class="bi bi-layers"></i>' +
                '<p>暂无分区数据</p>' +
                '</div>';
            bindCardEvents();
            return;
        }

        var html = '';
        zones.forEach(function (z) {
            html += renderCard(z);
        });
        cardGrid.innerHTML = html;
        bindCardEvents();
    }

    function bindCardEvents() {
        cardGrid.querySelectorAll('.zone-card').forEach(function (card) {
            card.addEventListener('click', function (e) {
                if (e.target.closest('.card-action-btn') || e.target.closest('.status-switch-wrapper')) return;
                var id = parseInt(card.dataset.id);
                openDetailModal(id);
            });
        });

        cardGrid.querySelectorAll('[data-action="switch-status"]').forEach(function (btn) {
            btn.addEventListener('click', function (e) {
                e.stopPropagation();
                var zoneId = btn.dataset.id;
                var dropdown = document.getElementById('status-dropdown-' + zoneId);
                if (!dropdown) return;

                closeAllDropdowns();

                var currentStatus = btn.dataset.status;
                dropdown.querySelectorAll('.status-dropdown-item').forEach(function (item) {
                    if (item.dataset.status === currentStatus) {
                        item.classList.add('current');
                    } else {
                        item.classList.remove('current');
                    }
                });

                dropdown.classList.add('active');
                activeDropdown = dropdown;

                dropdown.querySelectorAll('.status-dropdown-item').forEach(function (item) {
                    item.onclick = function (ev) {
                        ev.stopPropagation();
                        var newStatus = item.dataset.status;
                        if (newStatus === currentStatus) {
                            closeAllDropdowns();
                            return;
                        }
                        closeAllDropdowns();
                        confirmStatusChange(parseInt(zoneId), currentStatus, newStatus);
                    };
                });
            });
        });
    }

    function closeAllDropdowns() {
        cardGrid.querySelectorAll('.status-dropdown.active').forEach(function (d) {
            d.classList.remove('active');
        });
        activeDropdown = null;
    }

    function confirmStatusChange(zoneId, oldStatus, newStatus) {
        var oldText = getStatusText(oldStatus);
        var newText = getStatusText(newStatus);
        UI.confirm(
            '状态变更确认',
            '确定要将分区运行状态从【' + oldText + '】变更为【' + newText + '】吗？',
            function () {
                switchZoneStatus(zoneId, newStatus);
            }
        );
    }

    function switchZoneStatus(zoneId, newStatus) {
        fetchJSON('/api/zone/update-status/' + zoneId + '/', {
            method: 'POST',
            body: JSON.stringify({ status: newStatus })
        }).then(function (data) {
            if (data.success) {
                UI.toast(data.message);
                loadList();
            } else {
                UI.toast(data.message || '状态变更失败', 'error');
            }
        }).catch(function () {
            UI.toast('网络错误，状态变更失败', 'error');
        });
    }

    function loadList() {
        var params = new URLSearchParams();
        if (currentFilter.warehouse_id !== 'all') params.set('warehouse_id', currentFilter.warehouse_id);
        if (currentFilter.status !== 'all') params.set('status', currentFilter.status);
        if (currentFilter.keyword.trim()) params.set('keyword', currentFilter.keyword.trim());

        var url = '/api/zone/list/?' + params.toString();
        fetchJSON(url).then(function (data) {
            renderList(data.zones || []);
        }).catch(function () {
            UI.toast('加载分区数据失败', 'error');
            cardGrid.innerHTML = '<div class="empty-state-card">' +
                '<i class="bi bi-exclamation-triangle"></i>' +
                '<p>加载失败，请刷新重试</p>' +
                '</div>';
        });
    }

    function loadWarehouses() {
        fetchJSON('/api/zone/warehouses/').then(function (data) {
            allWarehouses = data.warehouses || [];
            var filterOptions = '<option value="all">全部库房</option>';
            var formOptions = '<option value="">请选择库房</option>';
            allWarehouses.forEach(function (w) {
                filterOptions += '<option value="' + w.id + '">' + escHtml(w.name) + '</option>';
                formOptions += '<option value="' + w.id + '">' + escHtml(w.name) + '</option>';
            });
            filterWarehouseEl.innerHTML = filterOptions;
            formWarehouseEl.innerHTML = formOptions;
        }).catch(function () {
            UI.toast('加载库房数据失败', 'error');
        });
    }

    function openDetailModal(zoneId) {
        fetchJSON('/api/zone/detail/' + zoneId + '/').then(function (data) {
            var z = data.zone;
            var items = data.variety_items || [];

            var utilClass = getUtilizationClass(z.utilization);

            var varietyHtml = '';
            if (items.length > 0) {
                varietyHtml = '<table class="variety-table">' +
                    '<thead><tr><th>品种名称</th><th>品类</th><th>数量</th><th>单位</th></tr></thead>' +
                    '<tbody>' +
                    items.map(function (item) {
                        return '<tr>' +
                            '<td>' + escHtml(item.variety_name) + '</td>' +
                            '<td>' + escHtml(item.category) + '</td>' +
                            '<td>' + escHtml(item.quantity) + '</td>' +
                            '<td>' + escHtml(item.unit) + '</td>' +
                            '</tr>';
                    }).join('') +
                    '</tbody></table>';
            } else {
                varietyHtml = '<div class="empty-variety">该分区暂无存放品种</div>';
            }

            var remarkHtml = '';
            if (z.remark) {
                remarkHtml = '<div class="detail-section">' +
                    '<div class="detail-section-title"><i class="bi bi-sticky"></i> 备注</div>' +
                    '<div class="remark-block">' + escHtml(z.remark) + '</div>' +
                    '</div>';
            }

            var html =
                '<div class="detail-section">' +
                '<div class="detail-summary">' +
                '<div class="detail-summary-icon"><i class="bi bi-layers"></i></div>' +
                '<div class="detail-summary-info">' +
                '<div class="detail-summary-name">' + escHtml(z.name) +
                '<div class="detail-badges">' +
                '<span class="zone-status-badge ' + getStatusClass(z.status_code) + '">' + escHtml(z.status) + '</span>' +
                '<span class="zone-warehouse-tag">' + escHtml(z.warehouse_name) + '</span>' +
                '</div>' +
                '</div>' +
                '<div class="detail-summary-code">编码: ' + escHtml(z.code) + '</div>' +
                '</div>' +
                '</div>' +
                '</div>' +

                '<div class="detail-section">' +
                '<div class="detail-section-title"><i class="bi bi-info-circle"></i> 基础信息</div>' +
                '<div class="detail-info-grid">' +
                '<div class="detail-info-item"><i class="bi bi-arrows-full"></i><span class="detail-info-label">面积:</span><span class="detail-info-value">' + escHtml(z.area) + ' ㎡</span></div>' +
                '<div class="detail-info-item"><i class="bi bi-person"></i><span class="detail-info-label">负责人:</span><span class="detail-info-value">' + escHtml(z.manager || '-') + '</span></div>' +
                '<div class="detail-info-item"><i class="bi bi-telephone"></i><span class="detail-info-label">联系电话:</span><span class="detail-info-value">' + escHtml(z.phone || '-') + '</span></div>' +
                '<div class="detail-info-item"><i class="bi bi-clock-history"></i><span class="detail-info-label">创建时间:</span><span class="detail-info-value">' + escHtml(z.created_at) + '</span></div>' +
                '</div>' +
                '</div>' +

                '<div class="detail-section">' +
                '<div class="detail-section-title"><i class="bi bi-bar-chart-line"></i> 空间利用率</div>' +
                '<div class="detail-utilization-section">' +
                '<div class="utilization-header">' +
                '<span class="utilization-label">当前利用率</span>' +
                '<span class="utilization-value' + (z.utilization >= 85 ? ' warning' : '') + '">' + z.utilization + '%</span>' +
                '</div>' +
                '<div class="detail-utilization-bar">' +
                '<div class="detail-utilization-fill utilization-fill ' + utilClass + '" style="width: ' + Math.min(z.utilization, 100) + '%"></div>' +
                '</div>' +
                '<div class="detail-utilization-stats">' +
                '<span class="usage-text">已使用: <strong>' + escHtml(z.current_usage) + '</strong></span>' +
                '<span class="capacity-text">容量上限: ' + escHtml(z.capacity_limit) + '</span>' +
                '</div>' +
                '</div>' +
                '</div>' +

                '<div class="detail-section">' +
                '<div class="detail-section-title"><i class="bi bi-box-seam"></i> 存放品种清单</div>' +
                varietyHtml +
                '</div>' +

                remarkHtml;

            detailModalBody.innerHTML = html;
            detailModal.classList.add('active');
        }).catch(function () {
            UI.toast('加载分区详情失败', 'error');
        });
    }

    function closeDetailModal() {
        detailModal.classList.remove('active');
    }

    function openAddForm() {
        formModalTitle.innerHTML = '<i class="bi bi-plus-circle"></i> 新增分区';
        document.getElementById('form-code').value = '';
        document.getElementById('form-name').value = '';
        document.getElementById('form-warehouse').value = '';
        document.getElementById('form-status').value = 'normal';
        document.getElementById('form-area').value = '';
        document.getElementById('form-capacity').value = '';
        document.getElementById('form-manager').value = '';
        document.getElementById('form-phone').value = '';
        document.getElementById('form-remark').value = '';
        formModal.classList.add('active');
    }

    function closeFormModal() {
        formModal.classList.remove('active');
    }

    function handleFormSubmit() {
        var code = document.getElementById('form-code').value.trim();
        var name = document.getElementById('form-name').value.trim();
        var warehouseId = document.getElementById('form-warehouse').value;
        var status = document.getElementById('form-status').value;
        var area = document.getElementById('form-area').value || 0;
        var capacity = document.getElementById('form-capacity').value || 0;
        var manager = document.getElementById('form-manager').value.trim();
        var phone = document.getElementById('form-phone').value.trim();
        var remark = document.getElementById('form-remark').value.trim();

        if (!code) { UI.toast('请输入分区编码', 'error'); return; }
        if (!name) { UI.toast('请输入分区名称', 'error'); return; }
        if (!warehouseId) { UI.toast('请选择所属库房', 'error'); return; }

        var payload = {
            code: code,
            name: name,
            warehouse_id: parseInt(warehouseId),
            status: status,
            area: parseFloat(area),
            capacity_limit: parseFloat(capacity),
            manager: manager,
            phone: phone,
            remark: remark
        };

        fetchJSON('/api/zone/create/', {
            method: 'POST',
            body: JSON.stringify(payload)
        }).then(function (data) {
            if (data.success) {
                UI.toast(data.message);
                closeFormModal();
                loadList();
            } else {
                UI.toast(data.message || '操作失败', 'error');
            }
        }).catch(function () {
            UI.toast('网络错误，操作失败', 'error');
        });
    }

    function handleFilterChange() {
        currentFilter.warehouse_id = filterWarehouseEl.value;
        currentFilter.status = filterStatusEl.value;
        loadList();
    }

    function handleKeywordInput() {
        if (searchTimer) clearTimeout(searchTimer);
        searchTimer = setTimeout(function () {
            currentFilter.keyword = filterKeywordEl.value;
            loadList();
        }, 300);
    }

    function resetFilter() {
        filterWarehouseEl.value = 'all';
        filterStatusEl.value = 'all';
        filterKeywordEl.value = '';
        currentFilter = { warehouse_id: 'all', status: 'all', keyword: '' };
        loadList();
    }

    filterWarehouseEl.addEventListener('change', handleFilterChange);
    filterStatusEl.addEventListener('change', handleFilterChange);
    filterKeywordEl.addEventListener('input', handleKeywordInput);
    btnFilter.addEventListener('click', handleFilterChange);
    btnResetFilter.addEventListener('click', resetFilter);

    btnAddZone.addEventListener('click', openAddForm);

    detailModalClose.addEventListener('click', closeDetailModal);
    detailModal.addEventListener('click', function (e) {
        if (e.target === detailModal) closeDetailModal();
    });

    formModalClose.addEventListener('click', closeFormModal);
    formCancel.addEventListener('click', closeFormModal);
    formModal.addEventListener('click', function (e) {
        if (e.target === formModal) closeFormModal();
    });

    formSubmit.addEventListener('click', handleFormSubmit);

    document.addEventListener('click', function (e) {
        if (activeDropdown && !e.target.closest('.status-switch-wrapper')) {
            closeAllDropdowns();
        }
    });

    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') {
            if (formModal.classList.contains('active')) closeFormModal();
            else if (detailModal.classList.contains('active')) closeDetailModal();
            closeAllDropdowns();
        }
    });

    loadWarehouses();
    loadList();
})();
