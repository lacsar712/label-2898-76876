const MessageCenter = (function () {
    let currentPage = 1;
    let totalPages = 1;
    let currentType = 'all';
    let currentKeyword = '';
    let selectedMessageId = null;
    let selectedMessageIds = new Set();

    function init() {
        loadMessages();
        bindEvents();
    }

    function bindEvents() {
        document.querySelectorAll('.category-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                const type = tab.dataset.type;
                switchTab(type);
            });
        });

        document.getElementById('btn-search').addEventListener('click', () => {
            currentPage = 1;
            currentKeyword = document.getElementById('search-keyword').value.trim();
            loadMessages();
        });

        document.getElementById('search-keyword').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                document.getElementById('btn-search').click();
            }
        });

        document.getElementById('btn-reset').addEventListener('click', () => {
            document.getElementById('search-keyword').value = '';
            currentKeyword = '';
            currentPage = 1;
            loadMessages();
        });

        document.getElementById('check-select-all').addEventListener('change', (e) => {
            const isChecked = e.target.checked;
            document.querySelectorAll('.message-item-checkbox').forEach(cb => {
                cb.checked = isChecked;
                const id = parseInt(cb.dataset.messageId);
                if (isChecked) {
                    selectedMessageIds.add(id);
                } else {
                    selectedMessageIds.delete(id);
                }
            });
            updateBatchButtonState();
        });

        document.getElementById('btn-batch-mark-read').addEventListener('click', () => {
            if (selectedMessageIds.size === 0) return;
            UI.confirm('批量标为已读', `确定要将选中的 ${selectedMessageIds.size} 条消息标为已读吗？`, () => {
                batchMarkRead(Array.from(selectedMessageIds));
            });
        });

        document.getElementById('btn-mark-all-read').addEventListener('click', () => {
            UI.confirm('全部标为已读', '确定要将所有未读消息标为已读吗？', () => {
                batchMarkRead([], true);
            });
        });

        document.getElementById('btn-prev').addEventListener('click', () => {
            if (currentPage > 1) {
                currentPage--;
                loadMessages();
            }
        });

        document.getElementById('btn-next').addEventListener('click', () => {
            if (currentPage < totalPages) {
                currentPage++;
                loadMessages();
            }
        });

        document.getElementById('btn-mark-read').addEventListener('click', () => {
            if (selectedMessageId) {
                markMessageRead(selectedMessageId);
            }
        });

        document.getElementById('btn-delete').addEventListener('click', () => {
            if (selectedMessageId) {
                UI.confirm('删除消息', '确定要删除这条消息吗？此操作不可恢复。', () => {
                    deleteMessage(selectedMessageId);
                });
            }
        });

        document.getElementById('btn-goto-biz').addEventListener('click', () => {
            const bizUrl = document.getElementById('btn-goto-biz').dataset.bizUrl;
            if (bizUrl) {
                window.location.href = bizUrl;
            }
        });
    }

    function switchTab(type) {
        currentType = type;
        currentPage = 1;
        selectedMessageId = null;
        selectedMessageIds.clear();
        document.getElementById('check-select-all').checked = false;

        document.querySelectorAll('.category-tab').forEach(tab => {
            tab.classList.toggle('active', tab.dataset.type === type);
        });

        document.getElementById('detail-empty').style.display = 'flex';
        document.getElementById('detail-content').style.display = 'none';

        loadMessages();
    }

    function loadMessages() {
        UI.showLoader();
        const params = {
            page: currentPage,
            page_size: 15,
        };

        if (currentType === 'unread') {
            params.unread = 'true';
        } else if (currentType !== 'all') {
            params.type = currentType;
        }

        if (currentKeyword) {
            params.keyword = currentKeyword;
        }

        const queryString = new URLSearchParams(params).toString();

        fetch(`/api/message/list/?${queryString}`, {
            method: 'GET',
            credentials: 'same-origin',
        })
            .then(response => response.json())
            .then(data => {
                UI.hideLoader();
                renderMessages(data.items);
                renderTypeCounts(data.type_counts);
                updatePagination(data.page, data.total_pages, data.total);
                updateBatchButtonState();
            })
            .catch(error => {
                UI.hideLoader();
                console.error('加载消息失败:', error);
                UI.toast('加载消息失败', 'error');
            });
    }

    function renderTypeCounts(counts) {
        if (!counts) return;
        document.getElementById('count-all').textContent = counts.all || 0;
        document.getElementById('count-unread').textContent = counts.unread || 0;
        document.getElementById('count-system').textContent = counts.system || 0;
        document.getElementById('count-approval').textContent = counts.approval || 0;
        document.getElementById('count-warning').textContent = counts.warning || 0;

        if (typeof updateSidebarBadge === 'function') {
            updateSidebarBadge(counts.unread || 0);
        }
    }

    function renderMessages(messages) {
        const list = document.getElementById('message-list');

        if (!messages || messages.length === 0) {
            list.innerHTML = `
                <div class="empty-state-card">
                    <i class="bi bi-bell-slash"></i>
                    <p>暂无消息</p>
                </div>
            `;
            return;
        }

        list.innerHTML = messages.map(msg => createMessageItem(msg)).join('');

        list.querySelectorAll('.message-item').forEach(item => {
            const msgId = parseInt(item.dataset.messageId);

            item.addEventListener('click', (e) => {
                if (e.target.closest('.message-item-checkbox')) {
                    e.stopPropagation();
                    return;
                }
                selectMessage(msgId);
            });

            const checkbox = item.querySelector('.message-item-checkbox');
            if (checkbox) {
                checkbox.addEventListener('change', (e) => {
                    e.stopPropagation();
                    if (checkbox.checked) {
                        selectedMessageIds.add(msgId);
                    } else {
                        selectedMessageIds.delete(msgId);
                    }
                    updateBatchButtonState();
                    updateSelectAllState();
                });
            }
        });
    }

    function createMessageItem(msg) {
        const typeClass = `type-${msg.message_type_code}`;
        const isUnread = !msg.is_read;
        const isSelected = msg.id === selectedMessageId;
        const isChecked = selectedMessageIds.has(msg.id);

        return `
            <div class="message-item ${isUnread ? 'unread' : ''} ${isSelected ? 'selected' : ''}" data-message-id="${msg.id}">
                <input type="checkbox" class="message-item-checkbox" data-message-id="${msg.id}" ${isChecked ? 'checked' : ''}>
                ${isUnread ? '<div class="unread-dot"></div>' : ''}
                <div class="message-item-content">
                    <div class="message-item-header">
                        <span class="message-item-title">${escapeHtml(msg.title)}</span>
                        <span class="message-type-badge ${typeClass}">${escapeHtml(msg.message_type)}</span>
                    </div>
                    <div class="message-item-meta">
                        <span class="message-item-sender"><i class="bi bi-person"></i> ${escapeHtml(msg.sender)}</span>
                        <span class="message-item-time"><i class="bi bi-clock"></i> ${escapeHtml(msg.created_at)}</span>
                    </div>
                    <div class="message-item-preview">${escapeHtml(msg.content)}</div>
                </div>
            </div>
        `;
    }

    function selectMessage(messageId) {
        selectedMessageId = messageId;

        document.querySelectorAll('.message-item').forEach(item => {
            const id = parseInt(item.dataset.messageId);
            item.classList.toggle('selected', id === messageId);
        });

        loadMessageDetail(messageId);
    }

    function loadMessageDetail(messageId) {
        UI.showLoader();

        fetch(`/api/message/detail/${messageId}/`, {
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
                renderMessageDetail(data);
                loadMessages();
            })
            .catch(error => {
                UI.hideLoader();
                console.error('加载消息详情失败:', error);
                UI.toast('加载消息详情失败', 'error');
            });
    }

    function renderMessageDetail(msg) {
        document.getElementById('detail-empty').style.display = 'none';
        const detailContent = document.getElementById('detail-content');
        detailContent.style.display = 'flex';

        document.getElementById('detail-title').textContent = msg.title;

        const typeBadge = document.getElementById('detail-type');
        typeBadge.textContent = msg.message_type;
        typeBadge.className = `detail-type-badge type-${msg.message_type_code}`;

        document.getElementById('detail-sender').textContent = msg.sender;
        document.getElementById('detail-time').textContent = msg.created_at;

        const readStatus = document.getElementById('detail-read-status');
        if (msg.is_read) {
            readStatus.textContent = '已读';
            readStatus.className = 'detail-read-status read-status-read';
        } else {
            readStatus.textContent = '未读';
            readStatus.className = 'detail-read-status read-status-unread';
        }

        document.getElementById('detail-body').textContent = msg.content;

        const bizInfo = document.getElementById('detail-biz-info');
        if (msg.biz_no || msg.biz_type) {
            bizInfo.style.display = 'flex';
            const bizText = msg.biz_type ? `${msg.biz_type} - ${msg.biz_no}` : msg.biz_no;
            document.getElementById('detail-biz-text').textContent = bizText;

            const gotoBtn = document.getElementById('btn-goto-biz');
            if (msg.biz_url) {
                gotoBtn.style.display = 'inline-block';
                gotoBtn.dataset.bizUrl = msg.biz_url;
            } else {
                gotoBtn.style.display = 'none';
            }
        } else {
            bizInfo.style.display = 'none';
        }
    }

    function markMessageRead(messageId) {
        const csrfToken = getCsrfToken();

        fetch(`/api/message/mark-read/${messageId}/`, {
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
                if (data.success) {
                    UI.toast(data.message);
                    if (selectedMessageId === messageId) {
                        loadMessageDetail(messageId);
                    }
                    loadMessages();
                } else {
                    UI.toast(data.message || '操作失败', 'error');
                }
            })
            .catch(error => {
                console.error('标记已读失败:', error);
                UI.toast('标记已读失败', 'error');
            });
    }

    function batchMarkRead(messageIds, markAll = false) {
        const csrfToken = getCsrfToken();

        fetch('/api/message/batch-mark-read/', {
            method: 'POST',
            credentials: 'same-origin',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': csrfToken,
            },
            body: JSON.stringify({
                message_ids: messageIds,
                mark_all: markAll,
            }),
        })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    UI.toast(data.message);
                    selectedMessageIds.clear();
                    document.getElementById('check-select-all').checked = false;
                    loadMessages();
                    if (selectedMessageId) {
                        loadMessageDetail(selectedMessageId);
                    }
                } else {
                    UI.toast(data.message || '操作失败', 'error');
                }
            })
            .catch(error => {
                console.error('批量标记已读失败:', error);
                UI.toast('批量标记已读失败', 'error');
            });
    }

    function deleteMessage(messageId) {
        const csrfToken = getCsrfToken();

        fetch(`/api/message/delete/${messageId}/`, {
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
                if (data.success) {
                    UI.toast(data.message);
                    selectedMessageId = null;
                    selectedMessageIds.delete(messageId);
                    document.getElementById('detail-empty').style.display = 'flex';
                    document.getElementById('detail-content').style.display = 'none';
                    loadMessages();
                } else {
                    UI.toast(data.message || '删除失败', 'error');
                }
            })
            .catch(error => {
                console.error('删除消息失败:', error);
                UI.toast('删除消息失败', 'error');
            });
    }

    function updatePagination(page, pages, total) {
        document.getElementById('message-stats').textContent = `共 ${total} 条消息`;

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

    function updateBatchButtonState() {
        const btn = document.getElementById('btn-batch-mark-read');
        btn.disabled = selectedMessageIds.size === 0;
        btn.style.opacity = selectedMessageIds.size === 0 ? '0.5' : '1';
    }

    function updateSelectAllState() {
        const checkboxes = document.querySelectorAll('.message-item-checkbox');
        const allChecked = checkboxes.length > 0 && Array.from(checkboxes).every(cb => cb.checked);
        document.getElementById('check-select-all').checked = allChecked;
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

    function escapeHtml(text) {
        if (text === null || text === undefined) return '';
        const div = document.createElement('div');
        div.textContent = String(text);
        return div.innerHTML;
    }

    return { init };
})();

document.addEventListener('DOMContentLoaded', MessageCenter.init);
