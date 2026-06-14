const UI = {
    // 加载动画
    showLoader: () => {
        document.querySelector('.loader-overlay').style.display = 'flex';
    },
    hideLoader: () => {
        document.querySelector('.loader-overlay').style.display = 'none';
    },

    // 提示框
    toast: (message, type = 'success') => {
        const toast = document.createElement('div');
        toast.className = `toast-tech ${type === 'error' ? 'error' : ''}`;
        toast.innerHTML = `<i class="bi bi-${type === 'error' ? 'exclamation-circle' : 'check-circle'}"></i> ${message}`;
        document.body.appendChild(toast);

        setTimeout(() => toast.classList.add('active'), 100);
        setTimeout(() => {
            toast.classList.remove('active');
            setTimeout(() => toast.remove(), 400);
        }, 3000);
    },

    // 确认弹窗
    confirm: (title, message, callback) => {
        const overlay = document.getElementById('modal-overlay');
        const modal = overlay.querySelector('.modal-tech');
        modal.querySelector('h3').innerText = title;
        modal.querySelector('p').innerText = message;

        const confirmBtn = document.getElementById('modal-confirm');
        const cancelBtn = document.getElementById('modal-cancel');

        overlay.style.display = 'flex';

        const close = () => { overlay.style.display = 'none'; };

        confirmBtn.onclick = () => { close(); callback(); };
        cancelBtn.onclick = () => { close(); };
    },

    // 算术验证码
    initCaptcha: (containerId) => {
        const container = document.getElementById(containerId);
        const a = Math.floor(Math.random() * 10);
        const b = Math.floor(Math.random() * 10);
        container.dataset.result = a + b;
        container.innerText = `${a} + ${b} = ?`;
    },

    checkCaptcha: (containerId, value) => {
        const container = document.getElementById(containerId);
        return parseInt(value) === parseInt(container.dataset.result);
    },

    initUserDropdown: () => {
        const profile = document.getElementById('global-user-profile');
        const dropdown = document.getElementById('global-user-dropdown');
        const logoutItem = document.getElementById('global-dropdown-logout');
        if (!profile || !dropdown) return;

        profile.addEventListener('click', (e) => {
            e.stopPropagation();
            dropdown.classList.toggle('show');
        });

        document.addEventListener('click', (e) => {
            if (dropdown.contains(e.target) || profile.contains(e.target)) return;
            dropdown.classList.remove('show');
        });

        if (logoutItem && typeof handleLogout !== 'undefined') {
            logoutItem.addEventListener('click', handleLogout);
        } else if (logoutItem) {
            logoutItem.addEventListener('click', () => {
                window.location.href = '/logout/';
            });
        }
    }
};

// 页面加载完成后隐藏加载器
window.addEventListener('load', () => {
    setTimeout(UI.hideLoader, 500);
    UI.initUserDropdown();
});
