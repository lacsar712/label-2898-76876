from django.shortcuts import render, redirect
from django.contrib.auth import authenticate, login, logout
from django.contrib.auth.decorators import login_required
from django.http import JsonResponse, HttpResponse
from django.utils import timezone
from django.db import transaction
from django.db.models import Q
import json
import csv
from datetime import timedelta, datetime
import random
from decimal import Decimal

from .models import GoodsVariety, GoodsCategory, GoodsInbound, GoodsOutbound, generate_outbound_no
from django.db.models import Max, Sum


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
        link = '/goods-entry/' if op_type == '入库' else '/outbound/'
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


@login_required
def outbound_page(request):
    return render(request, 'pages/outbound.html', {
        'title': '出库登记',
        'page_name': 'outbound',
    })


@login_required
def api_outbound_varieties(request):
    varieties = GoodsVariety.objects.select_related('category', 'unit').all()
    data = []
    for v in varieties:
        data.append({
            'id': v.id,
            'name': v.name,
            'category': v.category.name,
            'unit': v.unit.name,
            'stock_quantity': str(v.stock_quantity),
        })
    return JsonResponse({'varieties': data})


@login_required
def api_outbound_variety_stock(request, variety_id):
    try:
        v = GoodsVariety.objects.select_related('unit').get(pk=variety_id)
        return JsonResponse({
            'id': v.id,
            'name': v.name,
            'stock_quantity': str(v.stock_quantity),
            'unit': v.unit.name,
        })
    except GoodsVariety.DoesNotExist:
        return JsonResponse({'error': '品种不存在'}, status=404)


@login_required
@transaction.atomic
def api_outbound_create(request):
    if request.method != 'POST':
        return JsonResponse({'success': False, 'message': '请求方法不允许'}, status=405)

    try:
        data = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({'success': False, 'message': '数据格式错误'}, status=400)

    variety_id = data.get('variety_id')
    quantity = data.get('quantity')
    receiving_unit = data.get('receiving_unit', '').strip()
    receiver = data.get('receiver', '').strip()
    outbound_date = data.get('outbound_date')
    operator = data.get('operator', '').strip()
    purpose = data.get('purpose', '').strip()
    remark = data.get('remark', '').strip()

    if not all([variety_id, quantity, receiving_unit, receiver, outbound_date]):
        return JsonResponse({'success': False, 'message': '必填字段不能为空'})

    try:
        quantity = Decimal(str(quantity))
        if quantity <= 0:
            return JsonResponse({'success': False, 'message': '出库数量必须大于零'})
    except Exception:
        return JsonResponse({'success': False, 'message': '出库数量格式错误'})

    try:
        variety = GoodsVariety.objects.select_for_update().get(pk=variety_id)
    except GoodsVariety.DoesNotExist:
        return JsonResponse({'success': False, 'message': '物资品种不存在'})

    if quantity > variety.stock_quantity:
        return JsonResponse({
            'success': False,
            'message': f'出库数量({quantity})超过可用库存({variety.stock_quantity}{variety.unit.name})',
        })

    try:
        datetime.strptime(outbound_date, '%Y-%m-%d')
    except ValueError:
        return JsonResponse({'success': False, 'message': '出库日期格式错误'})

    outbound_no = generate_outbound_no()

    record = GoodsOutbound.objects.create(
        outbound_no=outbound_no,
        variety=variety,
        quantity=quantity,
        receiving_unit=receiving_unit,
        receiver=receiver,
        outbound_date=outbound_date,
        operator=operator,
        purpose=purpose,
        remark=remark,
        status='completed',
    )

    variety.stock_quantity -= quantity
    variety.save(update_fields=['stock_quantity'])

    return JsonResponse({
        'success': True,
        'message': '出库登记成功',
        'data': {
            'outbound_no': record.outbound_no,
            'variety_name': variety.name,
            'quantity': str(record.quantity),
            'remaining_stock': str(variety.stock_quantity),
        },
    })


@login_required
def api_outbound_list(request):
    page = int(request.GET.get('page', 1))
    page_size = int(request.GET.get('page_size', 10))
    date_from = request.GET.get('date_from', '')
    date_to = request.GET.get('date_to', '')
    receiving_unit = request.GET.get('receiving_unit', '')

    qs = GoodsOutbound.objects.select_related('variety', 'variety__category', 'variety__unit').all()

    if date_from:
        qs = qs.filter(outbound_date__gte=date_from)
    if date_to:
        qs = qs.filter(outbound_date__lte=date_to)
    if receiving_unit:
        qs = qs.filter(receiving_unit__icontains=receiving_unit)

    total = qs.count()
    start = (page - 1) * page_size
    end = start + page_size
    records = qs[start:end]

    items = []
    for r in records:
        items.append({
            'id': r.id,
            'outbound_no': r.outbound_no,
            'variety_name': r.variety.name,
            'category': r.variety.category.name,
            'unit': r.variety.unit.name,
            'quantity': str(r.quantity),
            'receiving_unit': r.receiving_unit,
            'receiver': r.receiver,
            'outbound_date': r.outbound_date.strftime('%Y-%m-%d'),
            'operator': r.operator,
            'purpose': r.purpose,
            'remark': r.remark,
            'status': r.get_status_display(),
        })

    return JsonResponse({
        'items': items,
        'total': total,
        'page': page,
        'page_size': page_size,
        'total_pages': (total + page_size - 1) // page_size if total > 0 else 0,
    })


@login_required
def api_outbound_export_csv(request):
    date_from = request.GET.get('date_from', '')
    date_to = request.GET.get('date_to', '')
    receiving_unit = request.GET.get('receiving_unit', '')

    qs = GoodsOutbound.objects.select_related('variety', 'variety__category', 'variety__unit').all()

    if date_from:
        qs = qs.filter(outbound_date__gte=date_from)
    if date_to:
        qs = qs.filter(outbound_date__lte=date_to)
    if receiving_unit:
        qs = qs.filter(receiving_unit__icontains=receiving_unit)

    response = HttpResponse(content_type='text/csv')
    response['Content-Disposition'] = 'attachment; filename="outbound_records.csv"'
    response.write('\ufeff')

    writer = csv.writer(response)
    writer.writerow([
        '出库单号', '物资品种', '品类', '计量单位', '出库数量',
        '领用连队', '领用人', '出库日期', '经办出库员',
        '领用用途', '备注', '单据状态',
    ])

    for r in qs:
        writer.writerow([
            r.outbound_no,
            r.variety.name,
            r.variety.category.name,
            r.variety.unit.name,
            str(r.quantity),
            r.receiving_unit,
            r.receiver,
            r.outbound_date.strftime('%Y-%m-%d'),
            r.operator,
            r.purpose,
            r.remark,
            r.get_status_display(),
        ])

    return response


STOCK_CRITICAL_THRESHOLD = 5
STOCK_LOW_THRESHOLD = 20


def get_stock_status(quantity):
    q = float(quantity) if quantity else 0
    if q <= STOCK_CRITICAL_THRESHOLD:
        return '紧缺'
    elif q <= STOCK_LOW_THRESHOLD:
        return '偏低'
    return '正常'


@login_required
def inventory_page(request):
    return render(request, 'pages/inventory.html', {
        'title': '库存台账',
        'page_name': 'inventory',
    })


@login_required
def api_inventory_overview(request):
    total_varieties = GoodsVariety.objects.count()
    total_stock = GoodsVariety.objects.aggregate(total=Sum('stock_quantity'))['total'] or Decimal('0')
    critical_count = sum(
        1 for v in GoodsVariety.objects.all()
        if float(v.stock_quantity) <= STOCK_CRITICAL_THRESHOLD
    )
    return JsonResponse({
        'total_varieties': total_varieties,
        'total_stock': str(total_stock),
        'critical_count': critical_count,
    })


@login_required
def api_inventory_list(request):
    category_id = request.GET.get('category_id', '')
    keyword = request.GET.get('keyword', '').strip()
    group_by_category = request.GET.get('group_by_category', 'false') == 'true'

    qs = GoodsVariety.objects.select_related('category', 'unit').all()

    if category_id and category_id != 'all':
        try:
            qs = qs.filter(category_id=int(category_id))
        except ValueError:
            pass

    if keyword:
        qs = qs.filter(name__icontains=keyword)

    qs = qs.order_by('stock_quantity')

    varieties = []
    for v in qs:
        last_in = v.inbound_records.filter(status='completed').aggregate(latest=Max('inbound_date'))['latest']
        last_out = v.outbound_records.filter(status='completed').aggregate(latest=Max('outbound_date'))['latest']
        varieties.append({
            'id': v.id,
            'name': v.name,
            'stock_quantity': str(v.stock_quantity),
            'unit': v.unit.name,
            'category_id': v.category.id,
            'category': v.category.name,
            'last_inbound': last_in.strftime('%Y-%m-%d') if last_in else '',
            'last_outbound': last_out.strftime('%Y-%m-%d') if last_out else '',
            'status': get_stock_status(v.stock_quantity),
        })

    categories = [{'id': 0, 'name': '全部'}]
    for c in GoodsCategory.objects.all():
        categories.append({'id': c.id, 'name': c.name})

    grouped = {}
    if group_by_category:
        for item in varieties:
            cat = item['category']
            if cat not in grouped:
                grouped[cat] = []
            grouped[cat].append(item)

    return JsonResponse({
        'varieties': varieties,
        'categories': categories,
        'grouped': grouped if group_by_category else {},
    })


@login_required
def api_inventory_flow(request, variety_id):
    try:
        variety = GoodsVariety.objects.select_related('category', 'unit').get(pk=variety_id)
    except GoodsVariety.DoesNotExist:
        return JsonResponse({'error': '品种不存在'}, status=404)

    inbound_records = []
    for r in variety.inbound_records.filter(status='completed').order_by('-inbound_date', '-id')[:20]:
        inbound_records.append({
            'id': r.id,
            'type': '入库',
            'no': r.inbound_no,
            'quantity': str(r.quantity),
            'counterparty': r.supplier or '-',
            'operator': r.operator or '-',
            'date': r.inbound_date.strftime('%Y-%m-%d'),
            'remark': r.remark or '',
        })

    outbound_records = []
    for r in variety.outbound_records.filter(status='completed').order_by('-outbound_date', '-id')[:20]:
        outbound_records.append({
            'id': r.id,
            'type': '出库',
            'no': r.outbound_no,
            'quantity': str(r.quantity),
            'counterparty': r.receiving_unit or '-',
            'operator': r.operator or r.receiver,
            'date': r.outbound_date.strftime('%Y-%m-%d'),
            'remark': r.remark or '',
        })

    all_flows = inbound_records + outbound_records
    all_flows.sort(key=lambda x: x['date'], reverse=True)

    return JsonResponse({
        'variety': {
            'id': variety.id,
            'name': variety.name,
            'category': variety.category.name,
            'unit': variety.unit.name,
            'stock_quantity': str(variety.stock_quantity),
        },
        'flows': all_flows,
    })
