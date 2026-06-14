from django.shortcuts import render
from django.contrib.auth.decorators import login_required


@login_required
def dashboard(request):
    return render(request, 'dashboard.html', {'title': '仪表盘', 'page_name': 'dashboard'})


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
