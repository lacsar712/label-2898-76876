(function () {
    var currentFilter = {
        status: 'all',
        rating: 'all',
        keyword: ''
    };
    var allCategories = [];
    var selectedCategoryIds = [];
    var editMode = false;
    var editingSupplierId = null;
    var originalRating = null;
    var searchTimer = null;

    var cardGrid = document.getElementById('supplier-card-grid');
    var supplierCountEl = document.getElementById('supplier-count');
    var filterStatusEl = document.getElementById('filter-status');
    var filterRatingEl = document.getElementById('filter-rating');
    var filterKeywordEl = document.getElementById('filter-keyword');
    var btnFilter = document.getElementById('btn-filter');
    var btnResetFilter = document.getElementById('btn-reset-filter');
    var btnAddSupplier = document.getElementById('btn-add-supplier');

    var detailModal = document.getElementById('supplier-detail-modal');
    var detailModalBody = document.getElementById('detail-modal-body');
    var detailModalClose = document.getElementById('detail-modal-close');

    var formModal = document.getElementById('supplier-form-modal');
    var formModalTitle = document.getElementById('form-modal-title');
    var formModalClose = document.getElementById('form-modal-close');
    var formCancel = document.getElementById('form-cancel');
    var formSubmit = document.getElementById('form-submit');

    var tagWrapper = document.getElementById('tag-select-wrapper');
    var tagSelectedList = document.getElementById('tag-selected-list');
    var tagSearchInput = document.getElementById('tag-search-input');
    var tagDropdown = document.getElementById('tag-dropdown');

    var labelRatingRemark = document.getElementById('label-rating-remark');
    var inputRatingRemark = document.getElementById('form-rating-remark');

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
        if (statusCode === 'active') return 'status-active';
        if (statusCode === 'paused') return 'status-paused';
        return 'status-terminated';
    }

    function renderCard(s) {
        var categoryTags = '';
        if (s.categories && s.categories.length > 0) {
            categoryTags = '<div class="category-tags">' +
                s.categories.map(function (c) {
                    return '<span class="category-tag">' + escHtml(c.name) + '</span>';
                }).join('') +
                '</div>';
        } else {
            categoryTags = '<div class="category-tags"><span class="category-tag" style="opacity:0.45">暂无品类</span></div>';
        }

        return '<div class="supplier-card" data-id="' + s.id + '">' +
            '<div class="supplier-card-header">' +
            '<div class="supplier-card-title">' +
            '<div class="supplier-icon"><i class="bi bi-building"></i></div>' +
            '<div>' +
            '<div class="supplier-name">' + escHtml(s.name) + '</div>' +
            '<div class="supplier-code">编码: ' + escHtml(s.code) + '</div>' +
            '</div>' +
            '</div>' +
            '<div class="rating-badge rating-' + s.rating + '">' + s.rating + '</div>' +
            '</div>' +
            '<span class="status-badge ' + getStatusClass(s.status_code) + '">' + escHtml(s.status) + '</span>' +
            '<div class="supplier-info-list">' +
            '<div class="info-item">' +
            '<i class="bi bi-person"></i><span class="info-label">联系人:</span><span class="info-value">' + escHtml(s.contact_person || '-') + '</span>' +
            '</div>' +
            '<div class="info-item">' +
            '<i class="bi bi-telephone"></i><span class="info-label">电话:</span><span class="info-value">' + escHtml(s.phone || '-') + '</span>' +
            '</div>' +
            '<div class="info-item">' +
            '<i class="bi bi-geo-alt"></i><span class="info-label">地址:</span><span class="info-value">' + escHtml(s.address || '-') + '</span>' +
            '</div>' +
            '</div>' +
            categoryTags +
            '<div class="supplier-card-footer">' +
            '<span class="coop-date">合作起始: <strong>' + escHtml(s.cooperation_date) + '</strong></span>' +
            '<div class="card-actions">' +
            '<button class="card-action-btn" data-action="edit" data-id="' + s.id + '"><i class="bi bi-pencil"></i> 编辑</button>' +
            '<button class="card-action-btn delete" data-action="delete" data-id="' + s.id + '"><i class="bi bi-trash"></i> 删除</button>' +
            '</div>' +
            '</div>' +
            '</div>';
    }

    function renderList(suppliers) {
        supplierCountEl.innerHTML = '共加载 <strong>' + (suppliers ? suppliers.length : 0) + '</strong> 家供应商';

        if (!suppliers || suppliers.length === 0) {
            cardGrid.innerHTML = '<div class="empty-state-card">' +
                '<i class="bi bi-inbox"></i>' +
                '<p>暂无供应商数据</p>' +
                '</div>';
            bindCardEvents();
            return;
        }

        var html = '';
        suppliers.forEach(function (s) {
            html += renderCard(s);
        });
        cardGrid.innerHTML = html;
        bindCardEvents();
    }

    function bindCardEvents() {
        cardGrid.querySelectorAll('.supplier-card').forEach(function (card) {
            card.addEventListener('click', function (e) {
                if (e.target.closest('.card-action-btn')) return;
                var id = parseInt(card.dataset.id);
                openDetailModal(id);
            });
        });

        cardGrid.querySelectorAll('[data-action="edit"]').forEach(function (btn) {
            btn.addEventListener('click', function (e) {
                e.stopPropagation();
                var id = parseInt(btn.dataset.id);
                openEditForm(id);
            });
        });

        cardGrid.querySelectorAll('[data-action="delete"]').forEach(function (btn) {
            btn.addEventListener('click', function (e) {
                e.stopPropagation();
                var id = parseInt(btn.dataset.id);
                var card = btn.closest('.supplier-card');
                var name = card ? card.querySelector('.supplier-name').textContent : '该供应商';
                deleteSupplier(id, name);
            });
        });
    }

    function loadList() {
        var params = new URLSearchParams();
        if (currentFilter.status !== 'all') params.set('status', currentFilter.status);
        if (currentFilter.rating !== 'all') params.set('rating', currentFilter.rating);
        if (currentFilter.keyword.trim()) params.set('keyword', currentFilter.keyword.trim());

        var url = '/api/supplier/list/?' + params.toString();
        fetchJSON(url).then(function (data) {
            renderList(data.suppliers || []);
        }).catch(function () {
            UI.toast('加载供应商数据失败', 'error');
            cardGrid.innerHTML = '<div class="empty-state-card">' +
                '<i class="bi bi-exclamation-triangle"></i>' +
                '<p>加载失败，请刷新重试</p>' +
                '</div>';
        });
    }

    function loadCategories() {
        fetchJSON('/api/supplier/categories/').then(function (data) {
            allCategories = data.categories || [];
        }).catch(function () {
            UI.toast('加载品类数据失败', 'error');
        });
    }

    function openDetailModal(supplierId) {
        fetchJSON('/api/supplier/detail/' + supplierId + '/').then(function (data) {
            var s = data.supplier;
            var logs = data.rating_logs || [];

            var categoryTags = '';
            if (s.categories && s.categories.length > 0) {
                categoryTags = '<div class="detail-category-tags">' +
                    s.categories.map(function (c) {
                        return '<span class="detail-category-tag">' + escHtml(c.name) + '</span>';
                    }).join('') +
                    '</div>';
            }

            var ratingLogsHtml = '';
            if (logs.length > 0) {
                ratingLogsHtml = '<table class="rating-log-table">' +
                    '<thead><tr><th>变更时间</th><th>评级变更</th><th>操作人</th><th>变更备注</th></tr></thead>' +
                    '<tbody>' +
                    logs.map(function (log) {
                        return '<tr>' +
                            '<td>' + escHtml(log.created_at) + '</td>' +
                            '<td><div class="rating-change-cell">' +
                            '<span class="rating-mini rating-' + log.old_rating + '">' + log.old_rating + '</span>' +
                            '<i class="bi bi-arrow-right rating-arrow"></i>' +
                            '<span class="rating-mini rating-' + log.new_rating + '">' + log.new_rating + '</span>' +
                            '</div></td>' +
                            '<td>' + escHtml(log.operator) + '</td>' +
                            '<td>' + escHtml(log.remark || '-') + '</td>' +
                            '</tr>';
                    }).join('') +
                    '</tbody></table>';
            } else {
                ratingLogsHtml = '<div class="empty-logs">暂无评级变更记录</div>';
            }

            var remarkHtml = '';
            if (s.remark) {
                remarkHtml = '<div class="detail-section">' +
                    '<div class="detail-section-title"><i class="bi bi-sticky"></i> 合作备注</div>' +
                    '<div class="remark-block">' + escHtml(s.remark) + '</div>' +
                    '</div>';
            }

            var html =
                '<div class="detail-section">' +
                '<div class="detail-summary">' +
                '<div class="detail-summary-icon"><i class="bi bi-building"></i></div>' +
                '<div class="detail-summary-info">' +
                '<div class="detail-summary-name">' + escHtml(s.name) +
                '<div class="detail-badges">' +
                '<span class="status-badge ' + getStatusClass(s.status_code) + '">' + escHtml(s.status) + '</span>' +
                '<span class="rating-badge rating-' + s.rating + '" style="width:30px;height:30px;font-size:0.95rem">' + s.rating + '</span>' +
                '</div>' +
                '</div>' +
                '<div class="detail-summary-code">编码: ' + escHtml(s.code) + '</div>' +
                '</div>' +
                '</div>' +
                '</div>' +

                '<div class="detail-section">' +
                '<div class="detail-section-title"><i class="bi bi-info-circle"></i> 基础信息</div>' +
                '<div class="detail-info-grid">' +
                '<div class="detail-info-item"><i class="bi bi-person"></i><span class="detail-info-label">联系人:</span><span class="detail-info-value">' + escHtml(s.contact_person || '-') + '</span></div>' +
                '<div class="detail-info-item"><i class="bi bi-telephone"></i><span class="detail-info-label">电话:</span><span class="detail-info-value">' + escHtml(s.phone || '-') + '</span></div>' +
                '<div class="detail-info-item full-width"><i class="bi bi-geo-alt"></i><span class="detail-info-label">地址:</span><span class="detail-info-value">' + escHtml(s.address || '-') + '</span></div>' +
                '<div class="detail-info-item"><i class="bi bi-calendar-check"></i><span class="detail-info-label">合作起始:</span><span class="detail-info-value">' + escHtml(s.cooperation_date) + '</span></div>' +
                '<div class="detail-info-item"><i class="bi bi-clock-history"></i><span class="detail-info-label">创建时间:</span><span class="detail-info-value">' + escHtml(s.created_at) + '</span></div>' +
                '<div class="detail-info-item full-width"><i class="bi bi-grid"></i><span class="detail-info-label">供应品类:</span><span class="detail-info-value">' + (categoryTags || '<span style="opacity:0.5">暂无</span>') + '</span></div>' +
                '</div>' +
                '</div>' +

                remarkHtml +

                '<div class="detail-section">' +
                '<div class="detail-section-title"><i class="bi bi-star"></i> 评级变更历史</div>' +
                ratingLogsHtml +
                '</div>';

            detailModalBody.innerHTML = html;
            detailModal.classList.add('active');
        }).catch(function () {
            UI.toast('加载供应商详情失败', 'error');
        });
    }

    function closeDetailModal() {
        detailModal.classList.remove('active');
    }

    function openAddForm() {
        editMode = false;
        editingSupplierId = null;
        originalRating = null;
        selectedCategoryIds = [];
        labelRatingRemark.style.display = 'none';
        inputRatingRemark.style.display = 'none';
        inputRatingRemark.value = '';

        formModalTitle.innerHTML = '<i class="bi bi-plus-circle"></i> 新增供应商';
        document.getElementById('form-code').value = '';
        document.getElementById('form-name').value = '';
        document.getElementById('form-contact').value = '';
        document.getElementById('form-phone').value = '';
        document.getElementById('form-address').value = '';
        document.getElementById('form-status').value = 'active';
        document.getElementById('form-rating').value = 'B';
        document.getElementById('form-coop-date').value = new Date().toISOString().split('T')[0];
        document.getElementById('form-remark').value = '';

        renderSelectedTags();
        filterTagDropdown('');
        formModal.classList.add('active');
    }

    function openEditForm(supplierId) {
        editMode = true;
        editingSupplierId = supplierId;

        fetchJSON('/api/supplier/detail/' + supplierId + '/').then(function (data) {
            var s = data.supplier;
            originalRating = s.rating;
            selectedCategoryIds = (s.categories || []).map(function (c) { return c.id; });

            labelRatingRemark.style.display = 'none';
            inputRatingRemark.style.display = 'none';
            inputRatingRemark.value = '';

            formModalTitle.innerHTML = '<i class="bi bi-pencil"></i> 编辑供应商';
            document.getElementById('form-code').value = s.code;
            document.getElementById('form-name').value = s.name;
            document.getElementById('form-contact').value = s.contact_person || '';
            document.getElementById('form-phone').value = s.phone || '';
            document.getElementById('form-address').value = s.address || '';
            document.getElementById('form-status').value = s.status_code;
            document.getElementById('form-rating').value = s.rating;
            document.getElementById('form-coop-date').value = s.cooperation_date;
            document.getElementById('form-remark').value = s.remark || '';

            renderSelectedTags();
            filterTagDropdown('');
            formModal.classList.add('active');
        }).catch(function () {
            UI.toast('加载供应商信息失败', 'error');
        });
    }

    function closeFormModal() {
        formModal.classList.remove('active');
        tagDropdown.classList.remove('active');
    }

    function renderSelectedTags() {
        if (selectedCategoryIds.length === 0) {
            tagSelectedList.innerHTML = '';
            return;
        }
        var html = selectedCategoryIds.map(function (id) {
            var cat = allCategories.find(function (c) { return c.id === id; });
            var name = cat ? cat.name : '未知';
            return '<span class="tag-item" data-id="' + id + '">' +
                escHtml(name) +
                '<i class="bi bi-x tag-item-close" data-remove-id="' + id + '"></i>' +
                '</span>';
        }).join('');
        tagSelectedList.innerHTML = html;

        tagSelectedList.querySelectorAll('[data-remove-id]').forEach(function (btn) {
            btn.addEventListener('click', function () {
                var rid = parseInt(btn.dataset.removeId);
                selectedCategoryIds = selectedCategoryIds.filter(function (x) { return x !== rid; });
                renderSelectedTags();
                filterTagDropdown(tagSearchInput.value);
            });
        });
    }

    function filterTagDropdown(keyword) {
        var kw = (keyword || '').trim().toLowerCase();
        var filtered = allCategories.filter(function (c) {
            return !kw || c.name.toLowerCase().indexOf(kw) !== -1;
        });

        if (filtered.length === 0) {
            tagDropdown.innerHTML = '<div class="tag-dropdown-empty">暂无匹配品类</div>';
        } else {
            tagDropdown.innerHTML = filtered.map(function (c) {
                var selected = selectedCategoryIds.indexOf(c.id) !== -1;
                return '<div class="tag-dropdown-item ' + (selected ? 'selected' : '') + '" data-id="' + c.id + '">' +
                    escHtml(c.name) +
                    '</div>';
            }).join('');

            tagDropdown.querySelectorAll('.tag-dropdown-item').forEach(function (item) {
                item.addEventListener('click', function () {
                    var id = parseInt(item.dataset.id);
                    if (selectedCategoryIds.indexOf(id) === -1) {
                        selectedCategoryIds.push(id);
                    } else {
                        selectedCategoryIds = selectedCategoryIds.filter(function (x) { return x !== id; });
                    }
                    renderSelectedTags();
                    filterTagDropdown(tagSearchInput.value);
                    tagSearchInput.focus();
                });
            });
        }
    }

    function handleFormSubmit() {
        var code = document.getElementById('form-code').value.trim();
        var name = document.getElementById('form-name').value.trim();
        var contact = document.getElementById('form-contact').value.trim();
        var phone = document.getElementById('form-phone').value.trim();
        var address = document.getElementById('form-address').value.trim();
        var status = document.getElementById('form-status').value;
        var rating = document.getElementById('form-rating').value;
        var coopDate = document.getElementById('form-coop-date').value;
        var remark = document.getElementById('form-remark').value.trim();
        var ratingRemark = document.getElementById('form-rating-remark').value.trim();

        if (!code) { UI.toast('请输入供应商编码', 'error'); return; }
        if (!name) { UI.toast('请输入供应商名称', 'error'); return; }

        if (editMode && originalRating !== rating && !ratingRemark) {
            UI.toast('评级变更时请填写变更备注', 'error');
            return;
        }

        var payload = {
            code: code,
            name: name,
            contact_person: contact,
            phone: phone,
            address: address,
            category_ids: selectedCategoryIds.slice(),
            status: status,
            rating: rating,
            cooperation_date: coopDate,
            remark: remark,
            rating_remark: ratingRemark
        };

        var url = editMode
            ? '/api/supplier/update/' + editingSupplierId + '/'
            : '/api/supplier/create/';

        fetchJSON(url, {
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

    function deleteSupplier(id, name) {
        UI.confirm('删除确认', '确定要删除供应商【' + name + '】吗？此操作不可恢复。', function () {
            fetchJSON('/api/supplier/delete/' + id + '/', {
                method: 'POST'
            }).then(function (data) {
                if (data.success) {
                    UI.toast(data.message);
                    loadList();
                } else {
                    UI.toast(data.message || '删除失败', 'error');
                }
            }).catch(function () {
                UI.toast('网络错误，删除失败', 'error');
            });
        });
    }

    function handleRatingChange() {
        if (editMode && originalRating !== null) {
            var newRating = document.getElementById('form-rating').value;
            if (newRating !== originalRating) {
                labelRatingRemark.style.display = 'block';
                inputRatingRemark.style.display = 'block';
            } else {
                labelRatingRemark.style.display = 'none';
                inputRatingRemark.style.display = 'none';
                inputRatingRemark.value = '';
            }
        }
    }

    function handleFilterChange() {
        currentFilter.status = filterStatusEl.value;
        currentFilter.rating = filterRatingEl.value;
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
        filterStatusEl.value = 'all';
        filterRatingEl.value = 'all';
        filterKeywordEl.value = '';
        currentFilter = { status: 'all', rating: 'all', keyword: '' };
        loadList();
    }

    filterStatusEl.addEventListener('change', handleFilterChange);
    filterRatingEl.addEventListener('change', handleFilterChange);
    filterKeywordEl.addEventListener('input', handleKeywordInput);
    btnFilter.addEventListener('click', handleFilterChange);
    btnResetFilter.addEventListener('click', resetFilter);

    btnAddSupplier.addEventListener('click', openAddForm);

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

    document.getElementById('form-rating').addEventListener('change', handleRatingChange);

    tagSearchInput.addEventListener('focus', function () {
        filterTagDropdown(tagSearchInput.value);
        tagDropdown.classList.add('active');
    });

    tagSearchInput.addEventListener('input', function () {
        filterTagDropdown(tagSearchInput.value);
        tagDropdown.classList.add('active');
    });

    document.addEventListener('click', function (e) {
        if (!tagWrapper.contains(e.target)) {
            tagDropdown.classList.remove('active');
        }
    });

    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') {
            if (formModal.classList.contains('active')) closeFormModal();
            else if (detailModal.classList.contains('active')) closeDetailModal();
        }
    });

    loadCategories();
    loadList();
})();
