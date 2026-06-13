from django.shortcuts import render, redirect
from django.contrib.auth import authenticate, login, logout
from django.contrib.auth.decorators import login_required
from django.http import JsonResponse
from django.utils import timezone
import json
from datetime import timedelta, datetime
import random


def user_login(request):
    if request.method == 'POST':
        try:
            data = json.loads(request.body)
            username = data.get('username')
            password = data.get('password')
            user = authenticate(request, username=username, password=password)
            if user is not None:
                login(request, user)
                return JsonResponse({'success': True})
            else:
                return JsonResponse({'success': False, 'message': '用户名或密码错误'})
        except Exception as e:
            return JsonResponse({'success': False, 'message': str(e)})
    return render(request, 'login.html')


def user_logout(request):
    logout(request)
    return redirect('login')


@login_required
def dashboard(request):
    return render(request, 'dashboard.html', {'title': '仪表盘', 'page_name': 'dashboard'})


@login_required
def api_dashboard_kpi(request):
    today = timezone.now().date()
    inbound_today = random.randint(20, 80)
    total_varieties = random.randint(300, 600)
    pending_approvals = random.randint(3, 15)
    active_alerts = random.randint(1, 8)
    return JsonResponse({
        'inbound_today': inbound_today,
        'total_varieties': total_varieties,
        'pending_approvals': pending_approvals,
        'active_alerts': active_alerts,
    })


@login_required
def api_dashboard_trend(request):
    today = timezone.now().date()
    labels = []
    values = []
    for i in range(6, -1, -1):
        d = today - timedelta(days=i)
        labels.append(d.strftime('%m/%d'))
        values.append(random.randint(15, 90))
    return JsonResponse({'labels': labels, 'values': values})


@login_required
def api_dashboard_category(request):
    categories = [
        {'name': '办公物资', 'value': random.randint(80, 200)},
        {'name': '维修器材', 'value': random.randint(60, 150)},
        {'name': '医疗用品', 'value': random.randint(40, 120)},
        {'name': '安防装备', 'value': random.randint(30, 100)},
        {'name': '生活给养', 'value': random.randint(50, 130)},
        {'name': '其他', 'value': random.randint(10, 50)},
    ]
    return JsonResponse({'categories': categories})


@login_required
def api_dashboard_activities(request):
    types = ['入库', '出库']
    operators = ['张伟', '李强', '王军', '赵磊', '刘洋']
    items = [
        ('办公桌椅', '办公物资'),
        ('急救药箱', '医疗用品'),
        ('监控摄像头', '安防装备'),
        ('发电机配件', '维修器材'),
        ('压缩饼干', '生活给养'),
        ('打印纸A4', '办公物资'),
        ('灭火器', '安防装备'),
        ('工具套装', '维修器材'),
    ]
    activities = []
    now = timezone.now()
    for i in range(5):
        op_type = random.choice(types)
        item_name, category = random.choice(items)
        operator = random.choice(operators)
        quantity = random.randint(5, 50)
        ts = now - timedelta(minutes=random.randint(5, 300))
        link = '/goods-entry/' if op_type == '入库' else '/query-export/'
        activities.append({
            'type': op_type,
            'item': item_name,
            'category': category,
            'quantity': quantity,
            'operator': operator,
            'time': ts.strftime('%H:%M'),
            'link': link,
        })
    activities.sort(key=lambda x: x['time'], reverse=True)
    return JsonResponse({'activities': activities})


@login_required
def menu_page(request, page_name):
    titles = {
        'goods-entry': '货物入库',
        'unit-management': '单位管理',
        'category-management': '品类管理',
        'variety-management': '品种管理',
        'query-export': '查询导出',
        'daily-report': '每日报表',
        'warning': '预警',
        'approval': '审批区域',
        'attendance-staff': '考勤人员管理',
        'outbound-staff': '出库人员管理',
    }
    title = titles.get(page_name, '页面')
    return render(request, 'pages/dev.html', {'title': title, 'page_name': page_name})
