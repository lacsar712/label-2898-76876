const ProfileSettings = (function () {
    let currentTab = 'basic';
    let emailEditing = false;
    let originalEmail = '';
    let preferences = {
        default_page_size: 20,
        page_transition_animation: true,
        operation_sound: true,
    };

    function getCsrfToken() {
        const csrfMeta = document.querySelector('meta[name="csrf-token"]');
        if (csrfMeta) return csrfMeta.content;
        const cookie = document.cookie.match(/csrftoken=([^;]+)/);
        return cookie ? cookie[1] : '';
    }

    function initTabs() {
        const tabs = document.querySelectorAll('.tab-item');
        const indicator = document.querySelector('.tab-glow-indicator');

        function updateIndicator(tab) {
            const rect = tab.getBoundingClientRect();
            const parentRect = tab.parentElement.getBoundingClientRect();
            indicator.style.width = rect.width + 'px';
            indicator.style.left = (rect.left - parentRect.left) + 'px';
        }

        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                const target = tab.dataset.tab;
                if (target === currentTab) return;

                tabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                updateIndicator(tab);

                document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
                document.getElementById(`panel-${target}`).classList.add('active');

                currentTab = target;
            });
        });

        const activeTab = document.querySelector('.tab-item.active');
        if (activeTab && indicator) {
            setTimeout(() => updateIndicator(activeTab), 50);
        }

        window.addEventListener('resize', () => {
            const active = document.querySelector('.tab-item.active');
            if (active && indicator) updateIndicator(active);
        });
    }

    function loadBasicInfo() {
        fetch('/api/profile/basic-info/', {
            method: 'GET',
            credentials: 'same-origin',
            headers: { 'X-CSRFToken': getCsrfToken() },
        })
            .then(r => r.json())
            .then(data => {
                document.getElementById('info-username').textContent = data.username || '-';
                document.getElementById('info-date-joined').textContent = data.date_joined || '-';
                const emailInput = document.getElementById('info-email');
                emailInput.value = data.email || '';
                originalEmail = data.email || '';
            })
            .catch(() => {
                UI.toast('加载基本信息失败', 'error');
            });
    }

    function initEmailEdit() {
        const editBtn = document.getElementById('btn-email-edit');
        const saveBtn = document.getElementById('btn-email-save');
        const cancelBtn = document.getElementById('btn-email-cancel');
        const emailInput = document.getElementById('info-email');
        const saveStatus = document.getElementById('basic-save-status');

        function showStatus(type, msg) {
            saveStatus.className = `save-status show ${type}`;
            saveStatus.innerHTML = `<i class="bi bi-${type === 'success' ? 'check-circle' : 'exclamation-circle'}"></i> ${msg}`;
            setTimeout(() => saveStatus.classList.remove('show'), 3000);
        }

        editBtn.addEventListener('click', () => {
            emailEditing = true;
            emailInput.disabled = false;
            emailInput.focus();
            editBtn.style.display = 'none';
            saveBtn.style.display = 'flex';
            cancelBtn.style.display = 'flex';
        });

        cancelBtn.addEventListener('click', () => {
            emailEditing = false;
            emailInput.value = originalEmail;
            emailInput.disabled = true;
            editBtn.style.display = 'flex';
            saveBtn.style.display = 'none';
            cancelBtn.style.display = 'none';
        });

        saveBtn.addEventListener('click', () => {
            const email = emailInput.value.trim();
            const emailPattern = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

            if (!email) {
                showStatus('error', '邮箱不能为空');
                return;
            }
            if (!emailPattern.test(email)) {
                showStatus('error', '邮箱格式不正确');
                return;
            }
            if (email === originalEmail) {
                emailEditing = false;
                emailInput.disabled = true;
                editBtn.style.display = 'flex';
                saveBtn.style.display = 'none';
                cancelBtn.style.display = 'none';
                return;
            }

            UI.showLoader();
            fetch('/api/profile/update-email/', {
                method: 'POST',
                credentials: 'same-origin',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': getCsrfToken(),
                },
                body: JSON.stringify({ email }),
            })
                .then(r => r.json())
                .then(data => {
                    UI.hideLoader();
                    if (data.success) {
                        originalEmail = email;
                        emailEditing = false;
                        emailInput.disabled = true;
                        editBtn.style.display = 'flex';
                        saveBtn.style.display = 'none';
                        cancelBtn.style.display = 'none';
                        showStatus('success', data.message);
                    } else {
                        showStatus('error', data.message || '保存失败');
                    }
                })
                .catch(() => {
                    UI.hideLoader();
                    showStatus('error', '网络错误，请稍后重试');
                });
        });
    }

    function calculatePasswordStrength(password) {
        let score = 0;
        if (!password) return { level: '', score: 0, text: '' };
        if (password.length >= 8) score++;
        if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score++;
        if (/[0-9]/.test(password)) score++;
        if (/[^A-Za-z0-9]/.test(password)) score++;
        if (password.length >= 12) score++;

        if (score <= 1) return { level: 'weak', score, text: '弱 - 建议增加复杂度' };
        if (score <= 3) return { level: 'medium', score, text: '中 - 可以更安全' };
        return { level: 'strong', score, text: '强 - 密码安全性良好' };
    }

    function initPasswordForm() {
        const form = document.getElementById('password-form');
        const newPwd = document.getElementById('new-password');
        const strengthBar = document.getElementById('password-strength-bar');
        const strengthText = document.getElementById('password-strength-text');

        function togglePasswordVisibility(btn, input) {
            btn.addEventListener('click', () => {
                const isPwd = input.type === 'password';
                input.type = isPwd ? 'text' : 'password';
                btn.innerHTML = isPwd ? '<i class="bi bi-eye-slash"></i>' : '<i class="bi bi-eye"></i>';
            });
        }

        togglePasswordVisibility(
            document.getElementById('toggle-old-pwd'),
            document.getElementById('old-password')
        );
        togglePasswordVisibility(
            document.getElementById('toggle-new-pwd'),
            newPwd
        );
        togglePasswordVisibility(
            document.getElementById('toggle-confirm-pwd'),
            document.getElementById('confirm-password')
        );

        newPwd.addEventListener('input', () => {
            const strength = calculatePasswordStrength(newPwd.value);
            strengthBar.className = 'password-strength-bar ' + (strength.level || '');
            strengthText.textContent = strength.text;
        });

        form.addEventListener('submit', (e) => {
            e.preventDefault();
            const saveStatus = document.getElementById('password-save-status');
            function showStatus(type, msg) {
                saveStatus.className = `save-status show ${type}`;
                saveStatus.innerHTML = `<i class="bi bi-${type === 'success' ? 'check-circle' : 'exclamation-circle'}"></i> ${msg}`;
                setTimeout(() => saveStatus.classList.remove('show'), 4000);
            }

            const oldPwd = document.getElementById('old-password').value;
            const confirmPwd = document.getElementById('confirm-password').value;

            if (!oldPwd || !newPwd.value || !confirmPwd) {
                showStatus('error', '请填写所有密码字段');
                return;
            }
            if (newPwd.value.length < 8) {
                showStatus('error', '新密码长度至少8位');
                return;
            }
            if (!/[A-Za-z]/.test(newPwd.value) || !/[0-9]/.test(newPwd.value)) {
                showStatus('error', '新密码必须包含字母和数字');
                return;
            }
            if (newPwd.value !== confirmPwd) {
                showStatus('error', '两次输入的新密码不一致');
                return;
            }
            if (newPwd.value === oldPwd) {
                showStatus('error', '新密码不能与原密码相同');
                return;
            }

            UI.showLoader();
            fetch('/api/profile/change-password/', {
                method: 'POST',
                credentials: 'same-origin',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': getCsrfToken(),
                },
                body: JSON.stringify({
                    old_password: oldPwd,
                    new_password: newPwd.value,
                    confirm_password: confirmPwd,
                }),
            })
                .then(r => r.json())
                .then(data => {
                    UI.hideLoader();
                    if (data.success) {
                        showStatus('success', data.message);
                        UI.toast(data.message);
                        setTimeout(() => {
                            window.location.href = '/logout/';
                        }, 1500);
                    } else {
                        showStatus('error', data.message || '修改失败');
                    }
                })
                .catch(() => {
                    UI.hideLoader();
                    showStatus('error', '网络错误，请稍后重试');
                });
        });
    }

    function loadPreferences() {
        fetch('/api/profile/preferences/', {
            method: 'GET',
            credentials: 'same-origin',
            headers: { 'X-CSRFToken': getCsrfToken() },
        })
            .then(r => r.json())
            .then(data => {
                preferences = Object.assign(preferences, data);
                renderPreferences();
            })
            .catch(() => {});
    }

    function renderPreferences() {
        document.getElementById('pref-page-size').value = preferences.default_page_size;
        const animSwitch = document.getElementById('pref-animation');
        const soundSwitch = document.getElementById('pref-sound');
        animSwitch.classList.toggle('on', preferences.page_transition_animation);
        soundSwitch.classList.toggle('on', preferences.operation_sound);
    }

    function savePreferences() {
        const saveStatus = document.getElementById('prefs-save-status');
        function showStatus(type, msg) {
            saveStatus.className = `save-status show ${type}`;
            saveStatus.innerHTML = `<i class="bi bi-${type === 'success' ? 'check-circle' : 'exclamation-circle'}"></i> ${msg}`;
            setTimeout(() => saveStatus.classList.remove('show'), 3000);
        }

        UI.showLoader();
        fetch('/api/profile/preferences/', {
            method: 'POST',
            credentials: 'same-origin',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': getCsrfToken(),
            },
            body: JSON.stringify(preferences),
        })
            .then(r => r.json())
            .then(data => {
                UI.hideLoader();
                if (data.success) {
                    preferences = Object.assign(preferences, data.preferences);
                    showStatus('success', data.message);
                } else {
                    showStatus('error', data.message || '保存失败');
                }
            })
            .catch(() => {
                UI.hideLoader();
                showStatus('error', '网络错误，请稍后重试');
            });
    }

    function initPreferences() {
        const pageSizeSelect = document.getElementById('pref-page-size');
        pageSizeSelect.addEventListener('change', (e) => {
            preferences.default_page_size = parseInt(e.target.value);
        });

        function bindSwitch(id, key) {
            const el = document.getElementById(id);
            el.addEventListener('click', () => {
                preferences[key] = !preferences[key];
                el.classList.toggle('on', preferences[key]);
            });
        }

        bindSwitch('pref-animation', 'page_transition_animation');
        bindSwitch('pref-sound', 'operation_sound');

        document.getElementById('btn-prefs-save').addEventListener('click', savePreferences);
    }

    function initUserPanelDropdown() {
        const dropdown = document.getElementById('global-user-dropdown');
        if (dropdown) return;

        const userProfile = document.querySelector('.user-profile');
        if (!userProfile) return;

        let localDropdown = document.getElementById('user-panel-dropdown');
        if (!localDropdown) {
            localDropdown = document.createElement('div');
            localDropdown.id = 'user-panel-dropdown';
            localDropdown.className = 'user-panel-dropdown';
            localDropdown.innerHTML = `
                <a href="/profile-settings/" class="user-panel-dropdown-item">
                    <i class="bi bi-gear-fill"></i> 个人设置
                </a>
                <div class="user-panel-dropdown-divider"></div>
                <div class="user-panel-dropdown-item" id="dropdown-logout">
                    <i class="bi bi-box-arrow-right"></i> 退出登录
                </div>
            `;
            document.querySelector('.header-tech').appendChild(localDropdown);

            document.getElementById('dropdown-logout').addEventListener('click', handleLogout);
        }

        userProfile.onclick = null;
        userProfile.addEventListener('click', (e) => {
            e.stopPropagation();
            localDropdown.classList.toggle('show');
        });

        document.addEventListener('click', () => {
            localDropdown.classList.remove('show');
        });
    }

    return {
        init: function () {
            initTabs();
            loadBasicInfo();
            initEmailEdit();
            initPasswordForm();
            loadPreferences();
            initPreferences();
            initUserPanelDropdown();
        }
    };
})();

document.addEventListener('DOMContentLoaded', ProfileSettings.init);
