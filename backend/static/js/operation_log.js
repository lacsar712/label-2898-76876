const OperationLog = (function () {
    let currentPage = 1;
    let totalPages = 1;
    let currentFilters = {
        action_type: 'all',
        operator: '',
        date_from: '',
        date_to: '',
    };

    function init() {
        loadStats();
        loadActionTypes();
        loadLogs();
        bindEvents();
    }

    function bindEvents() {
        document.getElementById('btn-filter').addEventListener('click', () => {
            currentPage = 1;
            applyFilters();
            loadLogs();
        });

        document.getElementById('btn-reset-filter').addEventListener('click', () => {
            document.getElementById('filter-action-type').value = 'all';
            document.getElementById('filter-operator').value = '';
            document.getElementById('filter-date-from').value = '';
            document.getElementById('filter-date-to').value = '';
            currentFilters = {
                action_type: 'all',
                operator: '',
                date_from: '',
                date_to: '',
            };
            currentPage = 1;
            loadLogs();
        });

        document.getElementById('btn-refresh').addEventListener('click', () => {
            loadStats();
            loadLogs();
            UI.toast('已刷新');
        });

        document.getElementById('btn-archive').addEventListener('click', () => {
            UI.confirm('归档确认', '确定要归档超过保留期限的日志吗？归档后日志将移至历史分区。', () => {
                archiveLogs();
            });
        });

        document.getElementById('btn-prev').addEventListener('click', () => {
            if (currentPage > 1) {
                currentPage--;
                loadLogs();
            }
        });

        document.getElementById('btn-next').addEventListener('click', () => {
            if (currentPage < totalPages) {
                currentPage++;
                loadLogs();
            }
        });

        document.getElementById('detail-modal-close').addEventListener('click', closeDetailModal);
        document.getElementById('oplog-detail-modal').addEventListener('click', (e) => {
            if (e.target.id === 'oplog-detail-modal') {
                closeDetailModal();
            }
        });
    }

    function applyFilters() {
        currentFilters = {
            action_type: document.getElementById('filter-action-type').value,
            operator: document.getElementById('filter-operator').value.trim(),
            date_from: document.getElementById('filter-date-from').value,
            date_to: document.getElementById('filter-date-to').value,
        };
    }

    function loadActionTypes() {
        fetch('/api/operation-log/list/?page=1&page_size=1', {
            method: 'GET',
            credentials: 'same-origin',
        })
            .then(response => response.json())
            .then(data => {
                if (data.action_types) {
                    renderActionTypes(data.action_types);
                }
            })
            .catch(error => {
                console.error('加载操作类型失败:', error);
            });
    }

    function renderActionTypes(actionTypes) {
        const select = document.getElementById('filter-action-type');
        select.innerHTML = '';
        actionTypes.forEach(type => {
            const option = document.createElement('option');
            option.value = type.code;
            option.textContent = type.name;
            select.appendChild(option);
        });
    }

    function loadStats() {
        fetch('/api/operation-log/stats/', {
            method: 'GET',
            credentials: 'same-origin',
        })
            .then(response => response.json())
            .then(data => {
                renderStats(data);
            })
            .catch(error => {
                console.error('加载统计数据失败:', error);
            });
    }

    function renderStats(stats) {
        document.getElementById('stat-total').textContent = stats.total;
        document.getElementById('stat-today').textContent = stats.today_count;
        document.getElementById('stat-archived').textContent = stats.archived_count;
        document.getElementById('stat-retention').textContent = stats.retention_days;
    }

    function loadLogs() {
        UI.showLoader();
        const params = new URLSearchParams({
            page: currentPage,
            page_size: 20,
            ...currentFilters,
        });

        fetch(`/api/operation-log/list/?${params}`, {
            method: 'GET',
            credentials: 'same-origin',
        })
            .then(response => response.json())
            .then(data => {
                UI.hideLoader();
                renderLogs(data.items);
                updatePagination(data.page, data.total_pages, data.total);
            })
            .catch(error => {
                UI.hideLoader();
                console.error('加载日志失败:', error);
                UI.toast('加载日志失败', 'error');
            });
    }

    function renderLogs(logs) {
        const timeline = document.getElementById('oplog-timeline');

        if (!logs || logs.length === 0) {
            timeline.innerHTML = `
                <div class="empty-state-card">
                    <i class="bi bi-journal-text"></i>
                    <p>暂无操作日志记录</p>
                </div>
            `;
            return;
        }

        timeline.innerHTML = logs.map(log => createTimelineItem(log)).join('');

        timeline.querySelectorAll('.timeline-card').forEach(card => {
            card.addEventListener('click', (e) => {
                if (e.target.closest('.timeline-detail-toggle')) {
                    toggleDetail(card);
                } else {
                    const logId = card.dataset.logId;
                    openDetailModal(logId);
                }
            });
        });
    }

    function createTimelineItem(log) {
        const actionCode = log.action_type_code;
        const hasDetail = log.detail && Object.keys(log.detail).length > 0;

        return `
            <div class="timeline-item log-${actionCode}">
                <div class="timeline-card" data-log-id="${log.id}">
                    <div class="timeline-header">
                        <span class="timeline-type log-${actionCode}">${log.action_type}</span>
                        <span class="timeline-time"><i class="bi bi-clock"></i> ${log.action_time}</span>
                    </div>
                    <div class="timeline-body">
                        <div class="timeline-field">
                            <span class="timeline-field-label">操作人</span>
                            <span class="timeline-field-value"><i class="bi bi-person"></i> ${escapeHtml(log.operator)}</span>
                        </div>
                        <div class="timeline-field">
                            <span class="timeline-field-label">操作对象</span>
                            <span class="timeline-field-value"><i class="bi bi-box"></i> ${escapeHtml(log.target_object || '-')}</span>
                        </div>
                        ${log.ip_address ? `
                        <div class="timeline-field">
                            <span class="timeline-field-label">IP 地址</span>
                            <span class="timeline-field-value"><i class="bi bi-hdd-network"></i> ${escapeHtml(log.ip_address)}</span>
                        </div>
                        ` : ''}
                    </div>
                    ${hasDetail ? `
                    <div class="timeline-expand-hint timeline-detail-toggle">
                        <i class="bi bi-chevron-down"></i> 点击展开详情 JSON
                    </div>
                    <div class="timeline-detail">
                        <div class="timeline-detail-title">
                            <i class="bi bi-braces"></i> 操作详情
                        </div>
                        <div class="json-detail">${formatJson(log.detail)}</div>
                    </div>
                    ` : ''}
                </div>
            </div>
        `;
    }

    function toggleDetail(card) {
        const detail = card.querySelector('.timeline-detail');
        const hint = card.querySelector('.timeline-expand-hint');
        if (detail) {
            detail.classList.toggle('open');
            if (detail.classList.contains('open')) {
                hint.innerHTML = '<i class="bi bi-chevron-up"></i> 点击收起详情 JSON';
            } else {
                hint.innerHTML = '<i class="bi bi-chevron-down"></i> 点击展开详情 JSON';
            }
        }
    }

    function openDetailModal(logId) {
        UI.showLoader();
        fetch(`/api/operation-log/detail/${logId}/`, {
            method: 'GET',
            credentials: 'same-origin',
        })
            .then(response => response.json())
            .then(data => {
                UI.hideLoader();
                if (data.error) {
                    UI.toast(data.error, 'error');
                    return;
                }
                renderDetailModal(data);
            })
            .catch(error => {
                UI.hideLoader();
                console.error('加载日志详情失败:', error);
                UI.toast('加载日志详情失败', 'error');
            });
    }

    function renderDetailModal(log) {
        const modal = document.getElementById('oplog-detail-modal');
        const body = document.getElementById('detail-modal-body');

        const hasDetail = log.detail && Object.keys(log.detail).length > 0;

        body.innerHTML = `
            <div class="detail-grid">
                <div class="detail-field">
                    <span class="detail-field-label">操作类型</span>
                    <span class="detail-field-value">
                        <span class="timeline-type log-${log.action_type_code}">${log.action_type}</span>
                        ${log.is_archived ? '<span class="archived-badge">已归档</span>' : ''}
                    </span>
                </div>
                <div class="detail-field">
                    <span class="detail-field-label">操作时间</span>
                    <span class="detail-field-value"><i class="bi bi-clock"></i> ${escapeHtml(log.action_time)}</span>
                </div>
                <div class="detail-field">
                    <span class="detail-field-label">操作人</span>
                    <span class="detail-field-value"><i class="bi bi-person"></i> ${escapeHtml(log.operator)}</span>
                </div>
                <div class="detail-field">
                    <span class="detail-field-label">IP 地址</span>
                    <span class="detail-field-value"><i class="bi bi-hdd-network"></i> ${escapeHtml(log.ip_address || '-')}</span>
                </div>
                <div class="detail-field full-width">
                    <span class="detail-field-label">操作对象</span>
                    <span class="detail-field-value"><i class="bi bi-box"></i> ${escapeHtml(log.target_object || '-')}</span>
                </div>
                ${log.is_archived && log.archived_at ? `
                <div class="detail-field full-width">
                    <span class="detail-field-label">归档时间</span>
                    <span class="detail-field-value"><i class="bi bi-archive"></i> ${escapeHtml(log.archived_at)}</span>
                </div>
                ` : ''}
            </div>
            ${hasDetail ? `
            <div class="detail-json-section">
                <div class="detail-json-title">
                    <i class="bi bi-braces"></i> 操作详情 (JSON)
                </div>
                <div class="detail-json-content">${formatJson(log.detail)}</div>
            </div>
            ` : `
            <div class="empty-state-card" style="padding: 30px;">
                <i class="bi bi-info-circle"></i>
                <p>该日志无额外详情数据</p>
            </div>
            `}
        `;

        modal.classList.add('open');
    }

    function closeDetailModal() {
        document.getElementById('oplog-detail-modal').classList.remove('open');
    }

    function updatePagination(page, pages, total) {
        document.getElementById('oplog-count').textContent = `共加载 ${total} 条日志`;

        const paginationBar = document.getElementById('pagination-bar');
        if (pages <= 1) {
            paginationBar.style.display = 'none';
            return;
        }

        paginationBar.style.display = 'flex';
        document.getElementById('page-info').textContent = `第 ${page} / ${pages} 页`;

        const prevBtn = document.getElementById('btn-prev');
        const nextBtn = document.getElementById('btn-next');
        prevBtn.disabled = page <= 1;
        nextBtn.disabled = page >= pages;
        prevBtn.style.opacity = page <= 1 ? '0.5' : '1';
        nextBtn.style.opacity = page >= pages ? '0.5' : '1';

        totalPages = pages;
    }

    function archiveLogs() {
        UI.showLoader();
        const csrfToken = document.querySelector('[name=csrfmiddlewaretoken]')?.value || getCsrfToken();

        fetch('/api/operation-log/archive/', {
            method: 'POST',
            credentials: 'same-origin',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': csrfToken,
            },
            body: JSON.stringify({}),
        })
            .then(response => response.json())
            .then(data => {
                UI.hideLoader();
                if (data.success) {
                    UI.toast(data.message);
                    loadStats();
                    loadLogs();
                } else {
                    UI.toast(data.message || '归档失败', 'error');
                }
            })
            .catch(error => {
                UI.hideLoader();
                console.error('归档失败:', error);
                UI.toast('归档失败', 'error');
            });
    }

    function getCsrfToken() {
        const name = 'csrftoken';
        let cookieValue = null;
        if (document.cookie && document.cookie !== '') {
            const cookies = document.cookie.split(';');
            for (let i = 0; i < cookies.length; i++) {
                const cookie = cookies[i].trim();
                if (cookie.substring(0, name.length + 1) === (name + '=')) {
                    cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
                    break;
                }
            }
        }
        return cookieValue;
    }

    function formatJson(obj) {
        if (typeof obj === 'string') {
            try {
                obj = JSON.parse(obj);
            } catch (e) {
                return escapeHtml(obj);
            }
        }
        return syntaxHighlightJson(obj);
    }

    function syntaxHighlightJson(obj) {
        const jsonStr = JSON.stringify(obj, null, 2);
        return jsonStr
            .replace(/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g, (match) => {
                let cls = 'json-number';
                if (/^"/.test(match)) {
                    if (/:$/.test(match)) {
                        cls = 'json-key';
                    } else {
                        cls = 'json-string';
                    }
                } else if (/true|false/.test(match)) {
                    cls = 'json-boolean';
                } else if (/null/.test(match)) {
                    cls = 'json-null';
                }
                return `<span class="${cls}">${escapeHtml(match)}</span>`;
            });
    }

    function escapeHtml(text) {
        if (text === null || text === undefined) return '';
        const div = document.createElement('div');
        div.textContent = String(text);
        return div.innerHTML;
    }

    return { init };
})();

document.addEventListener('DOMContentLoaded', OperationLog.init);
