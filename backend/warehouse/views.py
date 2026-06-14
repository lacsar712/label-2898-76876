from django.shortcuts import render, redirect
from django.contrib.auth import authenticate, login, logout
from django.contrib.auth.decorators import login_required
from django.http import JsonResponse, HttpResponse
from django.utils import timezone
from django.db import transaction
from django.db.models import Q
from django.conf import settings
import json
import csv
from datetime import timedelta, datetime
import random
from decimal import Decimal

from .models import (
    GoodsVariety, GoodsCategory, GoodsInbound, GoodsOutbound, generate_outbound_no,
    Warehouse, WarehouseZone, WarehouseStock, TransferOrder, TransferOrderLog, generate_transfer_no,
    Supplier, SupplierRatingLog, OperationLog, OperationLogArchive, Message,
)
from django.db.models import Max, Sum


def get_client_ip(request):
    x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
    if x_forwarded_for:
        return x_forwarded_for.split(',')[0].strip()
    return request.META.get('REMOTE_ADDR')


def log_operation(request, action_type, target_object='', detail=None):
    operator = request.user.username if request.user.is_authenticated else 'system'
    OperationLog.log(
        action_type=action_type,
        operator=operator,
        target_object=target_object,
        ip_address=get_client_ip(request),
        detail=detail or {},
    )


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

    log_operation(
        request,
        OperationLog.ACTION_OUTBOUND,
        f'出库记录-{outbound_no}',
        {
            'outbound_no': outbound_no,
            'variety_name': variety.name,
            'quantity': str(quantity),
            'receiving_unit': receiving_unit,
            'receiver': receiver,
        },
    )

    if float(variety.stock_quantity) <= STOCK_CRITICAL_THRESHOLD:
        Message.send_message(
            receiver=operator or request.user.username,
            title=f'库存紧缺预警 - {variety.name}',
            content=f'物资品种【{variety.name}】（品类：{variety.category.name}）当前库存仅为 {variety.stock_quantity}{variety.unit.name}，已低于警戒线（{STOCK_CRITICAL_THRESHOLD}{variety.unit.name}），请及时补充库存。',
            message_type=Message.TYPE_WARNING,
            sender='system',
            biz_no=outbound_no,
            biz_type='出库单',
            biz_url=f'/inventory/',
        )

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


@login_required
def transfer_page(request):
    return render(request, 'pages/transfer.html', {
        'title': '调拨管理',
        'page_name': 'transfer',
    })


@login_required
def api_transfer_warehouses(request):
    warehouses = Warehouse.objects.all()
    data = []
    for w in warehouses:
        data.append({
            'id': w.id,
            'name': w.name,
            'code': w.code,
        })
    return JsonResponse({'warehouses': data})


@login_required
def api_transfer_warehouse_stock(request, warehouse_id):
    variety_id = request.GET.get('variety_id', '')
    try:
        warehouse = Warehouse.objects.get(pk=warehouse_id)
    except Warehouse.DoesNotExist:
        return JsonResponse({'error': '库区不存在'}, status=404)

    if variety_id:
        try:
            stock = WarehouseStock.objects.get(
                warehouse=warehouse,
                variety_id=variety_id,
            )
            variety = stock.variety
            return JsonResponse({
                'warehouse_id': warehouse.id,
                'warehouse_name': warehouse.name,
                'variety_id': variety.id,
                'variety_name': variety.name,
                'stock_quantity': str(stock.stock_quantity),
                'unit': variety.unit.name,
            })
        except WarehouseStock.DoesNotExist:
            return JsonResponse({
                'warehouse_id': warehouse.id,
                'warehouse_name': warehouse.name,
                'variety_id': int(variety_id) if variety_id.isdigit() else None,
                'variety_name': '',
                'stock_quantity': '0',
                'unit': '',
            })

    stocks = WarehouseStock.objects.filter(
        warehouse=warehouse,
    ).select_related('variety', 'variety__unit')
    data = []
    for s in stocks:
        data.append({
            'variety_id': s.variety.id,
            'variety_name': s.variety.name,
            'stock_quantity': str(s.stock_quantity),
            'unit': s.variety.unit.name,
        })
    return JsonResponse({'stocks': data, 'warehouse_name': warehouse.name})


@login_required
def api_transfer_varieties(request):
    source_warehouse_id = request.GET.get('warehouse_id', '')
    if not source_warehouse_id:
        varieties = GoodsVariety.objects.select_related('category', 'unit').all()
        data = []
        for v in varieties:
            data.append({
                'id': v.id,
                'name': v.name,
                'category': v.category.name,
                'unit': v.unit.name,
            })
        return JsonResponse({'varieties': data})

    try:
        warehouse = Warehouse.objects.get(pk=source_warehouse_id)
    except Warehouse.DoesNotExist:
        return JsonResponse({'error': '库区不存在'}, status=404)

    stocks = WarehouseStock.objects.filter(
        warehouse=warehouse,
        stock_quantity__gt=0,
    ).select_related('variety', 'variety__category', 'variety__unit')

    data = []
    for s in stocks:
        data.append({
            'id': s.variety.id,
            'name': s.variety.name,
            'category': s.variety.category.name,
            'unit': s.variety.unit.name,
            'stock_quantity': str(s.stock_quantity),
        })
    return JsonResponse({'varieties': data})


@login_required
@transaction.atomic
def api_transfer_create(request):
    if request.method != 'POST':
        return JsonResponse({'success': False, 'message': '请求方法不允许'}, status=405)

    try:
        data = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({'success': False, 'message': '数据格式错误'}, status=400)

    source_warehouse_id = data.get('source_warehouse_id')
    target_warehouse_id = data.get('target_warehouse_id')
    variety_id = data.get('variety_id')
    quantity = data.get('quantity')
    applicant = data.get('applicant', '').strip()
    remark = data.get('remark', '').strip()

    if not all([source_warehouse_id, target_warehouse_id, variety_id, quantity, applicant]):
        return JsonResponse({'success': False, 'message': '必填字段不能为空'})

    if source_warehouse_id == target_warehouse_id:
        return JsonResponse({'success': False, 'message': '源库区和目标库区不能相同'})

    try:
        quantity = Decimal(str(quantity))
        if quantity <= 0:
            return JsonResponse({'success': False, 'message': '调拨数量必须大于零'})
    except Exception:
        return JsonResponse({'success': False, 'message': '调拨数量格式错误'})

    try:
        source_warehouse = Warehouse.objects.get(pk=source_warehouse_id)
    except Warehouse.DoesNotExist:
        return JsonResponse({'success': False, 'message': '源库区不存在'})

    try:
        target_warehouse = Warehouse.objects.get(pk=target_warehouse_id)
    except Warehouse.DoesNotExist:
        return JsonResponse({'success': False, 'message': '目标库区不存在'})

    try:
        variety = GoodsVariety.objects.get(pk=variety_id)
    except GoodsVariety.DoesNotExist:
        return JsonResponse({'success': False, 'message': '物资品种不存在'})

    try:
        source_stock = WarehouseStock.objects.select_for_update().get(
            warehouse=source_warehouse,
            variety=variety,
        )
    except WarehouseStock.DoesNotExist:
        return JsonResponse({
            'success': False,
            'message': f'源库区{source_warehouse.name}中无{variety.name}库存',
        })

    if quantity > source_stock.stock_quantity:
        return JsonResponse({
            'success': False,
            'message': f'调拨数量({quantity}{variety.unit.name})超过源库区可用库存({source_stock.stock_quantity}{variety.unit.name})',
        })

    transfer_no = generate_transfer_no()

    order = TransferOrder.objects.create(
        transfer_no=transfer_no,
        source_warehouse=source_warehouse,
        target_warehouse=target_warehouse,
        variety=variety,
        quantity=quantity,
        applicant=applicant,
        status=TransferOrder.STATUS_PENDING,
        remark=remark,
    )

    TransferOrderLog.objects.create(
        transfer_order=order,
        action=TransferOrderLog.ACTION_CREATE,
        operator=applicant,
        remark='创建调拨申请',
    )

    return JsonResponse({
        'success': True,
        'message': '调拨申请提交成功',
        'data': {
            'transfer_no': order.transfer_no,
            'status': order.get_status_display(),
        },
    })


@login_required
def api_transfer_list(request):
    page = int(request.GET.get('page', 1))
    page_size = int(request.GET.get('page_size', 10))
    status = request.GET.get('status', '')
    date_from = request.GET.get('date_from', '')
    date_to = request.GET.get('date_to', '')
    keyword = request.GET.get('keyword', '').strip()

    qs = TransferOrder.objects.select_related(
        'source_warehouse', 'target_warehouse',
        'variety', 'variety__category', 'variety__unit',
    ).all()

    if status and status != 'all':
        qs = qs.filter(status=status)

    if date_from:
        try:
            qs = qs.filter(apply_time__date__gte=date_from)
        except ValueError:
            pass

    if date_to:
        try:
            qs = qs.filter(apply_time__date__lte=date_to)
        except ValueError:
            pass

    if keyword:
        qs = qs.filter(
            Q(transfer_no__icontains=keyword) |
            Q(applicant__icontains=keyword) |
            Q(variety__name__icontains=keyword)
        )

    total = qs.count()
    start = (page - 1) * page_size
    end = start + page_size
    orders = qs[start:end]

    items = []
    for o in orders:
        items.append({
            'id': o.id,
            'transfer_no': o.transfer_no,
            'source_warehouse': o.source_warehouse.name,
            'target_warehouse': o.target_warehouse.name,
            'variety_name': o.variety.name,
            'category': o.variety.category.name,
            'unit': o.variety.unit.name,
            'quantity': str(o.quantity),
            'applicant': o.applicant,
            'status': o.get_status_display(),
            'status_code': o.status,
            'apply_time': o.apply_time.strftime('%Y-%m-%d %H:%M'),
            'execute_time': o.execute_time.strftime('%Y-%m-%d %H:%M') if o.execute_time else '',
        })

    return JsonResponse({
        'items': items,
        'total': total,
        'page': page,
        'page_size': page_size,
        'total_pages': (total + page_size - 1) // page_size if total > 0 else 0,
    })


@login_required
def api_transfer_detail(request, order_id):
    try:
        order = TransferOrder.objects.select_related(
            'source_warehouse', 'target_warehouse',
            'variety', 'variety__category', 'variety__unit',
        ).get(pk=order_id)
    except TransferOrder.DoesNotExist:
        return JsonResponse({'error': '调拨单不存在'}, status=404)

    try:
        source_stock = WarehouseStock.objects.get(
            warehouse=order.source_warehouse,
            variety=order.variety,
        )
        source_stock_qty = str(source_stock.stock_quantity)
    except WarehouseStock.DoesNotExist:
        source_stock_qty = '0'

    try:
        target_stock = WarehouseStock.objects.get(
            warehouse=order.target_warehouse,
            variety=order.variety,
        )
        target_stock_qty = str(target_stock.stock_quantity)
    except WarehouseStock.DoesNotExist:
        target_stock_qty = '0'

    logs = []
    for log in order.logs.all().order_by('created_at'):
        logs.append({
            'id': log.id,
            'action': log.get_action_display(),
            'action_code': log.action,
            'operator': log.operator,
            'remark': log.remark,
            'time': log.created_at.strftime('%Y-%m-%d %H:%M:%S'),
        })

    order_data = {
        'id': order.id,
        'transfer_no': order.transfer_no,
        'source_warehouse_id': order.source_warehouse.id,
        'source_warehouse': order.source_warehouse.name,
        'target_warehouse_id': order.target_warehouse.id,
        'target_warehouse': order.target_warehouse.name,
        'variety_id': order.variety.id,
        'variety_name': order.variety.name,
        'category': order.variety.category.name,
        'unit': order.variety.unit.name,
        'quantity': str(order.quantity),
        'applicant': order.applicant,
        'status': order.get_status_display(),
        'status_code': order.status,
        'apply_time': order.apply_time.strftime('%Y-%m-%d %H:%M:%S'),
        'execute_time': order.execute_time.strftime('%Y-%m-%d %H:%M:%S') if order.execute_time else '',
        'approver': order.approver,
        'approval_remark': order.approval_remark,
        'approval_time': order.approval_time.strftime('%Y-%m-%d %H:%M:%S') if order.approval_time else '',
        'executor': order.executor,
        'remark': order.remark,
        'source_stock': source_stock_qty,
        'target_stock': target_stock_qty,
    }

    return JsonResponse({
        'order': order_data,
        'logs': logs,
    })


@login_required
@transaction.atomic
def api_transfer_approve(request, order_id):
    if request.method != 'POST':
        return JsonResponse({'success': False, 'message': '请求方法不允许'}, status=405)

    try:
        data = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({'success': False, 'message': '数据格式错误'}, status=400)

    action = data.get('action')
    approver = data.get('approver', '').strip()
    remark = data.get('remark', '').strip()

    if action not in ('approve', 'reject'):
        return JsonResponse({'success': False, 'message': '无效的审批操作'})

    if not approver:
        return JsonResponse({'success': False, 'message': '审批人不能为空'})

    try:
        order = TransferOrder.objects.select_for_update().get(pk=order_id)
    except TransferOrder.DoesNotExist:
        return JsonResponse({'success': False, 'message': '调拨单不存在'}, status=404)

    if order.status != TransferOrder.STATUS_PENDING:
        return JsonResponse({'success': False, 'message': '只有待审批状态的调拨单才能审批'})

    if action == 'approve':
        try:
            source_stock = WarehouseStock.objects.select_for_update().get(
                warehouse=order.source_warehouse,
                variety=order.variety,
            )
        except WarehouseStock.DoesNotExist:
            return JsonResponse({
                'success': False,
                'message': f'源库区{order.source_warehouse.name}中无{order.variety.name}库存',
            })

        if order.quantity > source_stock.stock_quantity:
            return JsonResponse({
                'success': False,
                'message': f'调拨数量({order.quantity}{order.variety.unit.name})超过源库区可用库存({source_stock.stock_quantity}{order.variety.unit.name})',
            })

        order.status = TransferOrder.STATUS_APPROVED
        log_action = TransferOrderLog.ACTION_APPROVE
        msg = '审批通过'
    else:
        order.status = TransferOrder.STATUS_REJECTED
        log_action = TransferOrderLog.ACTION_REJECT
        msg = '审批驳回'

    order.approver = approver
    order.approval_remark = remark
    order.approval_time = timezone.now()
    order.save()

    TransferOrderLog.objects.create(
        transfer_order=order,
        action=log_action,
        operator=approver,
        remark=remark or msg,
    )

    log_operation(
        request,
        OperationLog.ACTION_APPROVE if action == 'approve' else OperationLog.ACTION_REJECT,
        f'调拨单-{order.transfer_no}',
        {
            'transfer_no': order.transfer_no,
            'approver': approver,
            'action': action,
            'remark': remark,
        },
    )

    if action == 'reject':
        Message.send_message(
            receiver=order.applicant,
            title=f'调拨单审批驳回 - {order.transfer_no}',
            content=f'您提交的调拨单 {order.transfer_no}（{order.variety.name} {order.quantity}{order.variety.unit.name}）已被驳回。\n审批人：{approver}\n驳回原因：{remark or "未填写"}',
            message_type=Message.TYPE_APPROVAL,
            sender=approver,
            biz_no=order.transfer_no,
            biz_type='调拨单',
            biz_url=f'/transfer/',
        )
    else:
        Message.send_message(
            receiver=order.applicant,
            title=f'调拨单审批通过 - {order.transfer_no}',
            content=f'您提交的调拨单 {order.transfer_no}（{order.variety.name} {order.quantity}{order.variety.unit.name}）已审批通过，请等待执行。\n审批人：{approver}\n审批意见：{remark or "无"}',
            message_type=Message.TYPE_APPROVAL,
            sender=approver,
            biz_no=order.transfer_no,
            biz_type='调拨单',
            biz_url=f'/transfer/',
        )

    return JsonResponse({
        'success': True,
        'message': msg + '成功',
        'data': {
            'transfer_no': order.transfer_no,
            'status': order.get_status_display(),
        },
    })


@login_required
@transaction.atomic
def api_transfer_execute(request, order_id):
    if request.method != 'POST':
        return JsonResponse({'success': False, 'message': '请求方法不允许'}, status=405)

    try:
        data = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({'success': False, 'message': '数据格式错误'}, status=400)

    executor = data.get('executor', '').strip()

    if not executor:
        return JsonResponse({'success': False, 'message': '执行人不能为空'})

    try:
        order = TransferOrder.objects.select_for_update().get(pk=order_id)
    except TransferOrder.DoesNotExist:
        return JsonResponse({'success': False, 'message': '调拨单不存在'}, status=404)

    if order.status != TransferOrder.STATUS_APPROVED:
        return JsonResponse({'success': False, 'message': '只有已通过状态的调拨单才能执行'})

    try:
        source_stock = WarehouseStock.objects.select_for_update().get(
            warehouse=order.source_warehouse,
            variety=order.variety,
        )
    except WarehouseStock.DoesNotExist:
        return JsonResponse({
            'success': False,
            'message': f'源库区{order.source_warehouse.name}中无{order.variety.name}库存',
        })

    if order.quantity > source_stock.stock_quantity:
        return JsonResponse({
            'success': False,
            'message': f'调拨数量({order.quantity}{order.variety.unit.name})超过源库区可用库存({source_stock.stock_quantity}{order.variety.unit.name})',
        })

    source_stock.stock_quantity -= order.quantity
    source_stock.save()

    try:
        target_stock = WarehouseStock.objects.select_for_update().get(
            warehouse=order.target_warehouse,
            variety=order.variety,
        )
        target_stock.stock_quantity += order.quantity
        target_stock.save()
    except WarehouseStock.DoesNotExist:
        WarehouseStock.objects.create(
            warehouse=order.target_warehouse,
            variety=order.variety,
            stock_quantity=order.quantity,
        )

    order.status = TransferOrder.STATUS_EXECUTED
    order.executor = executor
    order.execute_time = timezone.now()
    order.save()

    TransferOrderLog.objects.create(
        transfer_order=order,
        action=TransferOrderLog.ACTION_EXECUTE,
        operator=executor,
        remark='执行调拨完成',
    )

    log_operation(
        request,
        OperationLog.ACTION_EXECUTE,
        f'调拨单-{order.transfer_no}',
        {
            'transfer_no': order.transfer_no,
            'executor': executor,
            'variety_name': order.variety.name if order.variety else '',
            'quantity': str(order.quantity),
            'source_warehouse': order.source_warehouse.name if order.source_warehouse else '',
            'target_warehouse': order.target_warehouse.name if order.target_warehouse else '',
        },
    )

    try:
        variety = GoodsVariety.objects.get(pk=order.variety_id)
        if float(variety.stock_quantity) <= STOCK_CRITICAL_THRESHOLD:
            Message.send_message(
                receiver=executor,
                title=f'库存紧缺预警 - {variety.name}',
                content=f'物资品种【{variety.name}】（品类：{variety.category.name}）当前总库存仅为 {variety.stock_quantity}{variety.unit.name}，已低于警戒线（{STOCK_CRITICAL_THRESHOLD}{variety.unit.name}），请及时补充库存。',
                message_type=Message.TYPE_WARNING,
                sender='system',
                biz_no=order.transfer_no,
                biz_type='调拨单',
                biz_url=f'/inventory/',
            )
    except GoodsVariety.DoesNotExist:
        pass

    Message.send_message(
        receiver=order.applicant,
        title=f'调拨单已执行 - {order.transfer_no}',
        content=f'您申请的调拨单 {order.transfer_no}（{order.variety.name} {order.quantity}{order.variety.unit.name}）已由 {executor} 执行完成。\n源库区：{order.source_warehouse.name}\n目标库区：{order.target_warehouse.name}',
        message_type=Message.TYPE_APPROVAL,
        sender=executor,
        biz_no=order.transfer_no,
        biz_type='调拨单',
        biz_url=f'/transfer/',
    )

    return JsonResponse({
        'success': True,
        'message': '调拨执行成功',
        'data': {
            'transfer_no': order.transfer_no,
            'status': order.get_status_display(),
            'execute_time': order.execute_time.strftime('%Y-%m-%d %H:%M:%S'),
        },
    })


@login_required
def supplier_page(request):
    return render(request, 'pages/supplier.html', {
        'title': '供应商管理',
        'page_name': 'supplier',
    })


@login_required
def api_supplier_categories(request):
    categories = GoodsCategory.objects.all()
    data = []
    for c in categories:
        data.append({
            'id': c.id,
            'name': c.name,
        })
    return JsonResponse({'categories': data})


@login_required
def api_supplier_list(request):
    status = request.GET.get('status', '')
    rating = request.GET.get('rating', '')
    keyword = request.GET.get('keyword', '').strip()

    qs = Supplier.objects.prefetch_related('categories').all()

    if status and status != 'all':
        qs = qs.filter(status=status)
    if rating and rating != 'all':
        qs = qs.filter(rating=rating)
    if keyword:
        qs = qs.filter(
            Q(code__icontains=keyword) |
            Q(name__icontains=keyword) |
            Q(contact_person__icontains=keyword)
        )

    suppliers = []
    for s in qs:
        categories = []
        for c in s.categories.all():
            categories.append({'id': c.id, 'name': c.name})
        suppliers.append({
            'id': s.id,
            'code': s.code,
            'name': s.name,
            'contact_person': s.contact_person,
            'phone': s.phone,
            'address': s.address,
            'categories': categories,
            'status': s.get_status_display(),
            'status_code': s.status,
            'rating': s.rating,
            'cooperation_date': s.cooperation_date.strftime('%Y-%m-%d'),
            'remark': s.remark,
        })

    return JsonResponse({
        'suppliers': suppliers,
        'total': len(suppliers),
    })


@login_required
def api_supplier_detail(request, supplier_id):
    try:
        s = Supplier.objects.prefetch_related('categories', 'rating_logs').get(pk=supplier_id)
    except Supplier.DoesNotExist:
        return JsonResponse({'error': '供应商不存在'}, status=404)

    categories = []
    for c in s.categories.all():
        categories.append({'id': c.id, 'name': c.name})

    rating_logs = []
    for log in s.rating_logs.all():
        rating_logs.append({
            'id': log.id,
            'old_rating': log.old_rating,
            'new_rating': log.new_rating,
            'operator': log.operator,
            'remark': log.remark,
            'created_at': log.created_at.strftime('%Y-%m-%d %H:%M:%S'),
        })

    supplier_data = {
        'id': s.id,
        'code': s.code,
        'name': s.name,
        'contact_person': s.contact_person,
        'phone': s.phone,
        'address': s.address,
        'categories': categories,
        'status': s.get_status_display(),
        'status_code': s.status,
        'rating': s.rating,
        'cooperation_date': s.cooperation_date.strftime('%Y-%m-%d'),
        'remark': s.remark,
        'created_at': s.created_at.strftime('%Y-%m-%d %H:%M:%S'),
        'updated_at': s.updated_at.strftime('%Y-%m-%d %H:%M:%S'),
    }

    return JsonResponse({
        'supplier': supplier_data,
        'rating_logs': rating_logs,
    })


@login_required
@transaction.atomic
def api_supplier_create(request):
    if request.method != 'POST':
        return JsonResponse({'success': False, 'message': '请求方法不允许'}, status=405)

    try:
        data = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({'success': False, 'message': '数据格式错误'}, status=400)

    code = data.get('code', '').strip()
    name = data.get('name', '').strip()
    contact_person = data.get('contact_person', '').strip()
    phone = data.get('phone', '').strip()
    address = data.get('address', '').strip()
    category_ids = data.get('category_ids', [])
    status = data.get('status', Supplier.STATUS_ACTIVE)
    rating = data.get('rating', Supplier.RATING_B)
    cooperation_date = data.get('cooperation_date', '')
    remark = data.get('remark', '').strip()

    if not code or not name:
        return JsonResponse({'success': False, 'message': '供应商编码和名称不能为空'})

    if Supplier.objects.filter(code=code).exists():
        return JsonResponse({'success': False, 'message': '供应商编码已存在'})

    if cooperation_date:
        try:
            datetime.strptime(cooperation_date, '%Y-%m-%d')
        except ValueError:
            return JsonResponse({'success': False, 'message': '合作日期格式错误'})
    else:
        cooperation_date = timezone.now().strftime('%Y-%m-%d')

    supplier = Supplier.objects.create(
        code=code,
        name=name,
        contact_person=contact_person,
        phone=phone,
        address=address,
        status=status,
        rating=rating,
        cooperation_date=cooperation_date,
        remark=remark,
    )

    if category_ids:
        valid_categories = GoodsCategory.objects.filter(id__in=category_ids)
        supplier.categories.set(valid_categories)

    SupplierRatingLog.objects.create(
        supplier=supplier,
        old_rating=rating,
        new_rating=rating,
        operator=request.user.username if request.user.is_authenticated else 'system',
        remark='创建供应商，初始评级',
    )

    log_operation(
        request,
        OperationLog.ACTION_CREATE,
        f'供应商-{code}',
        {
            'supplier_code': code,
            'supplier_name': name,
            'contact_person': contact_person,
            'status': status,
            'rating': rating,
        },
    )

    return JsonResponse({
        'success': True,
        'message': '供应商创建成功',
        'data': {'id': supplier.id, 'code': supplier.code},
    })


@login_required
@transaction.atomic
def api_supplier_update(request, supplier_id):
    if request.method != 'POST':
        return JsonResponse({'success': False, 'message': '请求方法不允许'}, status=405)

    try:
        supplier = Supplier.objects.select_for_update().get(pk=supplier_id)
    except Supplier.DoesNotExist:
        return JsonResponse({'success': False, 'message': '供应商不存在'}, status=404)

    try:
        data = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({'success': False, 'message': '数据格式错误'}, status=400)

    code = data.get('code', '').strip()
    name = data.get('name', '').strip()
    contact_person = data.get('contact_person', '').strip()
    phone = data.get('phone', '').strip()
    address = data.get('address', '').strip()
    category_ids = data.get('category_ids', [])
    status = data.get('status', supplier.status)
    rating = data.get('rating', supplier.rating)
    cooperation_date = data.get('cooperation_date', '')
    remark = data.get('remark', '').strip()
    rating_remark = data.get('rating_remark', '').strip()

    if not code or not name:
        return JsonResponse({'success': False, 'message': '供应商编码和名称不能为空'})

    if Supplier.objects.filter(code=code).exclude(pk=supplier_id).exists():
        return JsonResponse({'success': False, 'message': '供应商编码已存在'})

    if cooperation_date:
        try:
            datetime.strptime(cooperation_date, '%Y-%m-%d')
        except ValueError:
            return JsonResponse({'success': False, 'message': '合作日期格式错误'})

    old_rating = supplier.rating

    supplier.code = code
    supplier.name = name
    supplier.contact_person = contact_person
    supplier.phone = phone
    supplier.address = address
    supplier.status = status
    supplier.rating = rating
    if cooperation_date:
        supplier.cooperation_date = cooperation_date
    supplier.remark = remark
    supplier.save()

    if category_ids is not None:
        valid_categories = GoodsCategory.objects.filter(id__in=category_ids)
        supplier.categories.set(valid_categories)

    if old_rating != rating:
        SupplierRatingLog.objects.create(
            supplier=supplier,
            old_rating=old_rating,
            new_rating=rating,
            operator=request.user.username if request.user.is_authenticated else 'system',
            remark=rating_remark or '评级变更',
        )

    log_operation(
        request,
        OperationLog.ACTION_UPDATE,
        f'供应商-{code}',
        {
            'supplier_code': code,
            'supplier_name': name,
            'old_rating': old_rating,
            'new_rating': rating,
            'status': status,
        },
    )

    return JsonResponse({
        'success': True,
        'message': '供应商更新成功',
        'data': {'id': supplier.id, 'code': supplier.code},
    })


@login_required
@transaction.atomic
def api_supplier_delete(request, supplier_id):
    if request.method != 'POST':
        return JsonResponse({'success': False, 'message': '请求方法不允许'}, status=405)

    try:
        supplier = Supplier.objects.get(pk=supplier_id)
    except Supplier.DoesNotExist:
        return JsonResponse({'success': False, 'message': '供应商不存在'}, status=404)

    supplier_name = supplier.name
    supplier._deleted_by = request.user.username if request.user.is_authenticated else 'system'
    supplier.delete()

    log_operation(
        request,
        OperationLog.ACTION_DELETE,
        f'供应商-{supplier.code}',
        {
            'supplier_code': supplier.code,
            'supplier_name': supplier_name,
        },
    )

    return JsonResponse({
        'success': True,
        'message': f'供应商【{supplier_name}】已删除',
    })


@login_required
def api_supplier_active_list(request):
    qs = Supplier.objects.filter(
        status=Supplier.STATUS_ACTIVE
    ).prefetch_related('categories').order_by('code')

    suppliers = []
    for s in qs:
        suppliers.append({
            'id': s.id,
            'code': s.code,
            'name': s.name,
        })

    return JsonResponse({'suppliers': suppliers})


def generate_inbound_no():
    today = timezone.now().strftime('%Y%m%d')
    prefix = f'RK{today}'
    last = GoodsInbound.objects.filter(
        inbound_no__startswith=prefix,
    ).order_by('-inbound_no').first()
    if last:
        seq = int(last.inbound_no[-3:]) + 1
    else:
        seq = 1
    return f'{prefix}{seq:03d}'


@login_required
def goods_entry_page(request):
    return render(request, 'pages/goods_entry.html', {
        'title': '货物入库',
        'page_name': 'goods-entry',
    })


@login_required
def api_inbound_varieties(request):
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
@transaction.atomic
def api_inbound_create(request):
    if request.method != 'POST':
        return JsonResponse({'success': False, 'message': '请求方法不允许'}, status=405)

    try:
        data = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({'success': False, 'message': '数据格式错误'}, status=400)

    variety_id = data.get('variety_id')
    quantity = data.get('quantity')
    supplier_id = data.get('supplier_id')
    inbound_date = data.get('inbound_date')
    operator = data.get('operator', '').strip()
    remark = data.get('remark', '').strip()

    if not all([variety_id, quantity, inbound_date]):
        return JsonResponse({'success': False, 'message': '必填字段不能为空'})

    try:
        quantity = Decimal(str(quantity))
        if quantity <= 0:
            return JsonResponse({'success': False, 'message': '入库数量必须大于零'})
    except Exception:
        return JsonResponse({'success': False, 'message': '入库数量格式错误'})

    try:
        variety = GoodsVariety.objects.select_for_update().get(pk=variety_id)
    except GoodsVariety.DoesNotExist:
        return JsonResponse({'success': False, 'message': '物资品种不存在'})

    supplier_ref = None
    supplier_name = ''
    if supplier_id:
        try:
            supplier_ref = Supplier.objects.get(pk=supplier_id)
            if supplier_ref.status != Supplier.STATUS_ACTIVE:
                return JsonResponse({
                    'success': False,
                    'message': f'供应商【{supplier_ref.name}】当前状态为{supplier_ref.get_status_display()}，不可选为供货来源',
                })
            supplier_name = supplier_ref.name
        except Supplier.DoesNotExist:
            return JsonResponse({'success': False, 'message': '供应商不存在'})

    try:
        datetime.strptime(inbound_date, '%Y-%m-%d')
    except ValueError:
        return JsonResponse({'success': False, 'message': '入库日期格式错误'})

    inbound_no = generate_inbound_no()

    record = GoodsInbound.objects.create(
        inbound_no=inbound_no,
        variety=variety,
        quantity=quantity,
        supplier_ref=supplier_ref,
        supplier=supplier_name,
        inbound_date=inbound_date,
        operator=operator,
        remark=remark,
        status='completed',
    )

    variety.stock_quantity += quantity
    variety.save(update_fields=['stock_quantity'])

    log_operation(
        request,
        OperationLog.ACTION_INBOUND,
        f'入库记录-{inbound_no}',
        {
            'inbound_no': inbound_no,
            'variety_name': variety.name,
            'quantity': str(quantity),
            'supplier': supplier_name,
            'operator': operator,
        },
    )

    return JsonResponse({
        'success': True,
        'message': '入库登记成功',
        'data': {
            'inbound_no': record.inbound_no,
            'variety_name': variety.name,
            'quantity': str(record.quantity),
            'new_stock': str(variety.stock_quantity),
            'supplier': supplier_name or '未指定',
        },
    })


@login_required
def api_inbound_list(request):
    page = int(request.GET.get('page', 1))
    page_size = int(request.GET.get('page_size', 10))
    date_from = request.GET.get('date_from', '')
    date_to = request.GET.get('date_to', '')
    keyword = request.GET.get('keyword', '').strip()

    qs = GoodsInbound.objects.select_related('variety', 'variety__category', 'variety__unit', 'supplier_ref').all()

    if date_from:
        qs = qs.filter(inbound_date__gte=date_from)
    if date_to:
        qs = qs.filter(inbound_date__lte=date_to)
    if keyword:
        qs = qs.filter(
            Q(inbound_no__icontains=keyword) |
            Q(variety__name__icontains=keyword) |
            Q(supplier__icontains=keyword)
        )

    total = qs.count()
    start = (page - 1) * page_size
    end = start + page_size
    records = qs[start:end]

    items = []
    for r in records:
        supplier_info = ''
        if r.supplier_ref:
            supplier_info = f'{r.supplier_ref.code} - {r.supplier_ref.name}'
        elif r.supplier:
            supplier_info = r.supplier
        items.append({
            'id': r.id,
            'inbound_no': r.inbound_no,
            'variety_name': r.variety.name,
            'category': r.variety.category.name,
            'unit': r.variety.unit.name,
            'quantity': str(r.quantity),
            'supplier': supplier_info,
            'inbound_date': r.inbound_date.strftime('%Y-%m-%d'),
            'operator': r.operator,
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
def api_inbound_export_csv(request):
    date_from = request.GET.get('date_from', '')
    date_to = request.GET.get('date_to', '')
    keyword = request.GET.get('keyword', '').strip()

    qs = GoodsInbound.objects.select_related('variety', 'variety__category', 'variety__unit', 'supplier_ref').all()

    if date_from:
        qs = qs.filter(inbound_date__gte=date_from)
    if date_to:
        qs = qs.filter(inbound_date__lte=date_to)
    if keyword:
        qs = qs.filter(
            Q(inbound_no__icontains=keyword) |
            Q(variety__name__icontains=keyword) |
            Q(supplier__icontains=keyword)
        )

    response = HttpResponse(content_type='text/csv')
    response['Content-Disposition'] = 'attachment; filename="inbound_records.csv"'
    response.write('\ufeff')

    writer = csv.writer(response)
    writer.writerow([
        '入库单号', '物资品种', '品类', '计量单位', '入库数量',
        '供应商', '入库日期', '经办入库员', '备注', '单据状态',
    ])

    for r in qs:
        supplier_info = ''
        if r.supplier_ref:
            supplier_info = f'{r.supplier_ref.code} - {r.supplier_ref.name}'
        elif r.supplier:
            supplier_info = r.supplier
        writer.writerow([
            r.inbound_no,
            r.variety.name,
            r.variety.category.name,
            r.variety.unit.name,
            str(r.quantity),
            supplier_info,
            r.inbound_date.strftime('%Y-%m-%d'),
            r.operator,
            r.remark,
            r.get_status_display(),
        ])

    return response


ZONE_CAPACITY_WARNING_RATIO = 0.85


@login_required
def zone_page(request):
    return render(request, 'pages/zone.html', {
        'title': '库房分区',
        'page_name': 'zone',
    })


@login_required
def api_zone_warehouses(request):
    warehouses = Warehouse.objects.all()
    data = []
    for w in warehouses:
        data.append({
            'id': w.id,
            'name': w.name,
            'code': w.code,
        })
    return JsonResponse({'warehouses': data})


@login_required
def api_zone_list(request):
    warehouse_id = request.GET.get('warehouse_id', '')
    status = request.GET.get('status', '')
    keyword = request.GET.get('keyword', '').strip()

    qs = WarehouseZone.objects.select_related('warehouse').all()

    if warehouse_id and warehouse_id != 'all':
        try:
            qs = qs.filter(warehouse_id=int(warehouse_id))
        except ValueError:
            pass
    if status and status != 'all':
        qs = qs.filter(status=status)
    if keyword:
        qs = qs.filter(
            Q(code__icontains=keyword) |
            Q(name__icontains=keyword) |
            Q(manager__icontains=keyword)
        )

    zones = []
    for z in qs:
        stocks = WarehouseStock.objects.filter(warehouse=z.warehouse).select_related('variety', 'variety__unit')
        total_quantity = Decimal('0')
        for s in stocks:
            total_quantity += s.stock_quantity

        utilization = 0
        if z.capacity_limit and float(z.capacity_limit) > 0:
            utilization = min(round(float(total_quantity) / float(z.capacity_limit) * 100, 1), 100)

        is_warning = utilization >= ZONE_CAPACITY_WARNING_RATIO * 100

        zones.append({
            'id': z.id,
            'code': z.code,
            'name': z.name,
            'warehouse_id': z.warehouse.id,
            'warehouse_name': z.warehouse.name,
            'area': str(z.area),
            'capacity_limit': str(z.capacity_limit),
            'current_usage': str(total_quantity),
            'utilization': utilization,
            'is_warning': is_warning,
            'manager': z.manager,
            'phone': z.phone,
            'status': z.get_status_display(),
            'status_code': z.status,
            'remark': z.remark,
        })

    return JsonResponse({
        'zones': zones,
        'total': len(zones),
    })


@login_required
def api_zone_detail(request, zone_id):
    try:
        z = WarehouseZone.objects.select_related('warehouse').get(pk=zone_id)
    except WarehouseZone.DoesNotExist:
        return JsonResponse({'error': '分区不存在'}, status=404)

    stocks = WarehouseStock.objects.filter(warehouse=z.warehouse).select_related('variety', 'variety__category', 'variety__unit')
    total_quantity = Decimal('0')
    variety_items = []
    for s in stocks:
        total_quantity += s.stock_quantity
        variety_items.append({
            'variety_id': s.variety.id,
            'variety_name': s.variety.name,
            'category': s.variety.category.name,
            'quantity': str(s.stock_quantity),
            'unit': s.variety.unit.name,
        })

    utilization = 0
    if z.capacity_limit and float(z.capacity_limit) > 0:
        utilization = min(round(float(total_quantity) / float(z.capacity_limit) * 100, 1), 100)

    is_warning = utilization >= ZONE_CAPACITY_WARNING_RATIO * 100

    zone_data = {
        'id': z.id,
        'code': z.code,
        'name': z.name,
        'warehouse_id': z.warehouse.id,
        'warehouse_name': z.warehouse.name,
        'area': str(z.area),
        'capacity_limit': str(z.capacity_limit),
        'current_usage': str(total_quantity),
        'utilization': utilization,
        'is_warning': is_warning,
        'manager': z.manager,
        'phone': z.phone,
        'status': z.get_status_display(),
        'status_code': z.status,
        'remark': z.remark,
        'created_at': z.created_at.strftime('%Y-%m-%d %H:%M:%S'),
        'updated_at': z.updated_at.strftime('%Y-%m-%d %H:%M:%S'),
    }

    return JsonResponse({
        'zone': zone_data,
        'variety_items': variety_items,
    })


@login_required
@transaction.atomic
def api_zone_create(request):
    if request.method != 'POST':
        return JsonResponse({'success': False, 'message': '请求方法不允许'}, status=405)

    try:
        data = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({'success': False, 'message': '数据格式错误'}, status=400)

    code = data.get('code', '').strip()
    name = data.get('name', '').strip()
    warehouse_id = data.get('warehouse_id')
    area = data.get('area', 0)
    capacity_limit = data.get('capacity_limit', 0)
    manager = data.get('manager', '').strip()
    phone = data.get('phone', '').strip()
    status = data.get('status', WarehouseZone.STATUS_NORMAL)
    remark = data.get('remark', '').strip()

    if not code or not name or not warehouse_id:
        return JsonResponse({'success': False, 'message': '分区编码、名称和所属库房不能为空'})

    if WarehouseZone.objects.filter(code=code).exists():
        return JsonResponse({'success': False, 'message': '分区编码已存在'})

    try:
        warehouse = Warehouse.objects.get(pk=warehouse_id)
    except Warehouse.DoesNotExist:
        return JsonResponse({'success': False, 'message': '所属库房不存在'})

    try:
        area = Decimal(str(area))
        capacity_limit = Decimal(str(capacity_limit))
    except Exception:
        return JsonResponse({'success': False, 'message': '面积或容量格式错误'})

    zone = WarehouseZone.objects.create(
        code=code,
        name=name,
        warehouse=warehouse,
        area=area,
        capacity_limit=capacity_limit,
        manager=manager,
        phone=phone,
        status=status,
        remark=remark,
    )

    return JsonResponse({
        'success': True,
        'message': '分区创建成功',
        'data': {'id': zone.id, 'code': zone.code},
    })


@login_required
@transaction.atomic
def api_zone_update_status(request, zone_id):
    if request.method != 'POST':
        return JsonResponse({'success': False, 'message': '请求方法不允许'}, status=405)

    try:
        zone = WarehouseZone.objects.select_for_update().get(pk=zone_id)
    except WarehouseZone.DoesNotExist:
        return JsonResponse({'success': False, 'message': '分区不存在'}, status=404)

    try:
        data = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({'success': False, 'message': '数据格式错误'}, status=400)

    new_status = data.get('status', '').strip()
    if new_status not in ('normal', 'maintenance', 'disabled'):
        return JsonResponse({'success': False, 'message': '无效的运行状态'})

    old_status_display = zone.get_status_display()
    zone.status = new_status
    zone.save(update_fields=['status', 'updated_at'])

    return JsonResponse({
        'success': True,
        'message': f'分区状态已从【{old_status_display}】变更为【{zone.get_status_display()}】',
        'data': {
            'id': zone.id,
            'status': zone.get_status_display(),
            'status_code': zone.status,
        },
    })


@login_required
def operation_log_page(request):
    return render(request, 'pages/operation_log.html', {
        'title': '操作日志',
        'page_name': 'operation-log',
    })


@login_required
def api_operation_log_list(request):
    page = int(request.GET.get('page', 1))
    page_size = int(request.GET.get('page_size', 20))
    action_type = request.GET.get('action_type', '')
    operator = request.GET.get('operator', '').strip()
    date_from = request.GET.get('date_from', '')
    date_to = request.GET.get('date_to', '')
    include_archive = request.GET.get('include_archive', 'false') == 'true'

    qs = OperationLog.objects.all()

    if action_type and action_type != 'all':
        qs = qs.filter(action_type=action_type)
    if operator:
        qs = qs.filter(operator__icontains=operator)
    if date_from:
        try:
            qs = qs.filter(action_time__date__gte=date_from)
        except ValueError:
            pass
    if date_to:
        try:
            qs = qs.filter(action_time__date__lte=date_to)
        except ValueError:
            pass

    total = qs.count()
    start = (page - 1) * page_size
    end = start + page_size
    logs = qs[start:end]

    items = []
    for log in logs:
        items.append({
            'id': log.id,
            'action_type': log.get_action_type_display(),
            'action_type_code': log.action_type,
            'operator': log.operator,
            'target_object': log.target_object,
            'ip_address': log.ip_address or '',
            'action_time': log.action_time.strftime('%Y-%m-%d %H:%M:%S'),
            'detail': log.detail,
            'is_archived': False,
        })

    action_types = [{'code': 'all', 'name': '全部操作类型'}]
    for code, name in OperationLog.ACTION_CHOICES:
        action_types.append({'code': code, 'name': name})

    return JsonResponse({
        'items': items,
        'total': total,
        'page': page,
        'page_size': page_size,
        'total_pages': (total + page_size - 1) // page_size if total > 0 else 0,
        'action_types': action_types,
    })


@login_required
def api_operation_log_detail(request, log_id):
    try:
        log = OperationLog.objects.get(pk=log_id)
        is_archived = False
    except OperationLog.DoesNotExist:
        try:
            log = OperationLogArchive.objects.get(pk=log_id)
            is_archived = True
        except OperationLogArchive.DoesNotExist:
            return JsonResponse({'error': '日志不存在'}, status=404)

    return JsonResponse({
        'id': log.id,
        'action_type': log.get_action_type_display(),
        'action_type_code': log.action_type,
        'operator': log.operator,
        'target_object': log.target_object,
        'ip_address': log.ip_address or '',
        'action_time': log.action_time.strftime('%Y-%m-%d %H:%M:%S'),
        'detail': log.detail,
        'is_archived': is_archived,
        'archived_at': log.archived_at.strftime('%Y-%m-%d %H:%M:%S') if is_archived and hasattr(log, 'archived_at') else '',
    })


@login_required
def api_operation_log_archive(request):
    if request.method != 'POST':
        return JsonResponse({'success': False, 'message': '请求方法不允许'}, status=405)

    retention_days = getattr(settings, 'OPERATION_LOG_RETENTION_DAYS', 90)
    cutoff_date = timezone.now() - timedelta(days=retention_days)

    logs_to_archive = OperationLog.objects.filter(action_time__lt=cutoff_date)
    count = logs_to_archive.count()

    if count == 0:
        return JsonResponse({
            'success': True,
            'message': '没有需要归档的日志',
            'archived_count': 0,
        })

    archived_logs = []
    for log in logs_to_archive:
        archived_logs.append(OperationLogArchive(
            action_type=log.action_type,
            operator=log.operator,
            target_object=log.target_object,
            ip_address=log.ip_address,
            action_time=log.action_time,
            detail=log.detail,
        ))

    OperationLogArchive.objects.bulk_create(archived_logs, batch_size=500)
    logs_to_archive.delete()

    log_operation(
        request,
        OperationLog.ACTION_ARCHIVE,
        '操作日志归档',
        {
            'retention_days': retention_days,
            'cutoff_date': cutoff_date.strftime('%Y-%m-%d'),
            'archived_count': count,
        },
    )

    return JsonResponse({
        'success': True,
        'message': f'成功归档 {count} 条日志',
        'archived_count': count,
    })


@login_required
def api_operation_log_stats(request):
    total = OperationLog.objects.count()
    archived_count = OperationLogArchive.objects.count()

    today = timezone.now().date()
    today_count = OperationLog.objects.filter(action_time__date=today).count()

    action_stats = {}
    for code, name in OperationLog.ACTION_CHOICES:
        action_stats[code] = {
            'name': name,
            'count': OperationLog.objects.filter(action_type=code).count(),
        }

    return JsonResponse({
        'total': total,
        'archived_count': archived_count,
        'today_count': today_count,
        'action_stats': action_stats,
        'retention_days': getattr(settings, 'OPERATION_LOG_RETENTION_DAYS', 90),
    })


@login_required
def message_page(request):
    return render(request, 'pages/message.html', {
        'title': '消息中心',
        'page_name': 'message',
    })


@login_required
def api_message_unread_count(request):
    receiver = request.user.username
    unread_count = Message.get_unread_count(receiver)
    return JsonResponse({'unread_count': unread_count})


@login_required
def api_message_list(request):
    page = int(request.GET.get('page', 1))
    page_size = int(request.GET.get('page_size', 20))
    message_type = request.GET.get('type', 'all')
    keyword = request.GET.get('keyword', '').strip()
    only_unread = request.GET.get('unread', 'false') == 'true'

    receiver = request.user.username
    qs = Message.objects.filter(receiver=receiver)

    if only_unread:
        qs = qs.filter(is_read=False)
    if message_type and message_type != 'all':
        qs = qs.filter(message_type=message_type)
    if keyword:
        qs = qs.filter(
            Q(title__icontains=keyword) |
            Q(content__icontains=keyword)
        )

    total = qs.count()
    start = (page - 1) * page_size
    end = start + page_size
    messages = qs[start:end]

    items = []
    for msg in messages:
        items.append({
            'id': msg.id,
            'title': msg.title,
            'content': msg.content[:100] + ('...' if len(msg.content) > 100 else ''),
            'full_content': msg.content,
            'message_type': msg.get_message_type_display(),
            'message_type_code': msg.message_type,
            'sender': msg.sender,
            'is_read': msg.is_read,
            'created_at': msg.created_at.strftime('%Y-%m-%d %H:%M:%S'),
            'biz_no': msg.biz_no,
            'biz_type': msg.biz_type,
            'biz_url': msg.biz_url,
        })

    unread_count = Message.get_unread_count(receiver)
    type_counts = {
        'all': total,
        'unread': unread_count,
        'system': Message.objects.filter(receiver=receiver, message_type=Message.TYPE_SYSTEM).count(),
        'approval': Message.objects.filter(receiver=receiver, message_type=Message.TYPE_APPROVAL).count(),
        'warning': Message.objects.filter(receiver=receiver, message_type=Message.TYPE_WARNING).count(),
    }

    return JsonResponse({
        'items': items,
        'total': total,
        'page': page,
        'page_size': page_size,
        'total_pages': (total + page_size - 1) // page_size if total > 0 else 0,
        'unread_count': unread_count,
        'type_counts': type_counts,
    })


@login_required
def api_message_detail(request, message_id):
    receiver = request.user.username
    try:
        msg = Message.objects.get(pk=message_id, receiver=receiver)
    except Message.DoesNotExist:
        return JsonResponse({'error': '消息不存在'}, status=404)

    if not msg.is_read:
        msg.is_read = True
        msg.save(update_fields=['is_read'])

    return JsonResponse({
        'id': msg.id,
        'title': msg.title,
        'content': msg.content,
        'message_type': msg.get_message_type_display(),
        'message_type_code': msg.message_type,
        'sender': msg.sender,
        'is_read': msg.is_read,
        'created_at': msg.created_at.strftime('%Y-%m-%d %H:%M:%S'),
        'biz_no': msg.biz_no,
        'biz_type': msg.biz_type,
        'biz_url': msg.biz_url,
    })


@login_required
@transaction.atomic
def api_message_mark_read(request, message_id):
    if request.method != 'POST':
        return JsonResponse({'success': False, 'message': '请求方法不允许'}, status=405)

    receiver = request.user.username
    try:
        msg = Message.objects.select_for_update().get(pk=message_id, receiver=receiver)
    except Message.DoesNotExist:
        return JsonResponse({'success': False, 'message': '消息不存在'}, status=404)

    msg.is_read = True
    msg.save(update_fields=['is_read'])

    return JsonResponse({
        'success': True,
        'message': '已标记为已读',
        'unread_count': Message.get_unread_count(receiver),
    })


@login_required
@transaction.atomic
def api_message_batch_mark_read(request):
    if request.method != 'POST':
        return JsonResponse({'success': False, 'message': '请求方法不允许'}, status=405)

    try:
        data = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({'success': False, 'message': '数据格式错误'}, status=400)

    message_ids = data.get('message_ids', [])
    mark_all = data.get('mark_all', False)
    receiver = request.user.username

    qs = Message.objects.select_for_update().filter(receiver=receiver, is_read=False)
    if not mark_all and message_ids:
        qs = qs.filter(id__in=message_ids)

    updated_count = qs.update(is_read=True)

    return JsonResponse({
        'success': True,
        'message': f'已将 {updated_count} 条消息标记为已读',
        'updated_count': updated_count,
        'unread_count': Message.get_unread_count(receiver),
    })


@login_required
@transaction.atomic
def api_message_delete(request, message_id):
    if request.method != 'POST':
        return JsonResponse({'success': False, 'message': '请求方法不允许'}, status=405)

    receiver = request.user.username
    try:
        msg = Message.objects.select_for_update().get(pk=message_id, receiver=receiver)
    except Message.DoesNotExist:
        return JsonResponse({'success': False, 'message': '消息不存在'}, status=404)

    msg_title = msg.title
    msg.delete()

    log_operation(
        request,
        OperationLog.ACTION_DELETE,
        f'消息-{msg_title}',
        {'message_id': message_id, 'title': msg_title},
    )

    return JsonResponse({
        'success': True,
        'message': '消息已删除',
        'unread_count': Message.get_unread_count(receiver),
    })


@login_required
def data_screen_page(request):
    return render(request, 'data_screen.html', {
        'title': '数据大屏',
        'page_name': 'data-screen',
    })


@login_required
def api_data_screen_overview(request):
    today = timezone.now().date()
    today_start = timezone.make_aware(datetime.combine(today, datetime.min.time()))
    week_start = timezone.make_aware(datetime.combine(today - timedelta(days=today.weekday()), datetime.min.time()))
    month_start = timezone.make_aware(datetime.combine(today.replace(day=1), datetime.min.time()))

    def get_inbound_quantity(start, end):
        return GoodsInbound.objects.filter(
            status='completed',
            inbound_date__gte=start.date(),
            inbound_date__lte=end.date(),
        ).aggregate(total=Sum('quantity'))['total'] or Decimal('0')

    def get_outbound_quantity(start, end):
        return GoodsOutbound.objects.filter(
            status='completed',
            outbound_date__gte=start.date(),
            outbound_date__lte=end.date(),
        ).aggregate(total=Sum('quantity'))['total'] or Decimal('0')

    def get_inbound_count(start, end):
        return GoodsInbound.objects.filter(
            status='completed',
            inbound_date__gte=start.date(),
            inbound_date__lte=end.date(),
        ).count()

    def get_outbound_count(start, end):
        return GoodsOutbound.objects.filter(
            status='completed',
            outbound_date__gte=start.date(),
            outbound_date__lte=end.date(),
        ).count()

    today_end = today_start + timedelta(days=1) - timedelta(microseconds=1)
    week_end = week_start + timedelta(days=7) - timedelta(microseconds=1)
    month_end = month_start + timedelta(days=32)
    month_end_date = (month_end.replace(day=1) - timedelta(days=1)).date()
    month_end = timezone.make_aware(datetime.combine(month_end_date, datetime.max.time()))

    today_in_qty = get_inbound_quantity(today_start, today_end)
    today_out_qty = get_outbound_quantity(today_start, today_end)
    week_in_qty = get_inbound_quantity(week_start, week_end)
    week_out_qty = get_outbound_quantity(week_start, week_end)
    month_in_qty = get_inbound_quantity(month_start, month_end)
    month_out_qty = get_outbound_quantity(month_start, month_end)

    today_in_count = get_inbound_count(today_start, today_end)
    today_out_count = get_outbound_count(today_start, today_end)

    total_stock = GoodsVariety.objects.aggregate(total=Sum('stock_quantity'))['total'] or Decimal('0')

    thirty_days_ago = today - timedelta(days=30)
    outbound_30d = GoodsOutbound.objects.filter(
        status='completed',
        outbound_date__gte=thirty_days_ago,
    ).aggregate(total=Sum('quantity'))['total'] or Decimal('0')

    turnover_rate = Decimal('0')
    if total_stock > 0:
        avg_stock = total_stock
        turnover_rate = (outbound_30d / avg_stock * Decimal('100')).quantize(Decimal('0.01'))

    warning_messages = Message.objects.filter(
        message_type=Message.TYPE_WARNING,
        is_read=False,
    ).order_by('-created_at')[:20]

    warnings = []
    for msg in warning_messages:
        warnings.append({
            'id': msg.id,
            'title': msg.title,
            'content': msg.content,
            'level': 'critical' if '紧缺' in msg.title else 'warning',
            'time': msg.created_at.strftime('%Y-%m-%d %H:%M:%S'),
        })

    if not warnings:
        warnings = [
            {
                'id': 0,
                'title': '系统运行正常',
                'content': '当前无预警信息，库房运营态势良好',
                'level': 'info',
                'time': timezone.now().strftime('%Y-%m-%d %H:%M:%S'),
            }
        ]

    return JsonResponse({
        'bar_chart': {
            'labels': ['今日', '本周', '本月'],
            'inbound': [
                float(today_in_qty),
                float(week_in_qty),
                float(month_in_qty),
            ],
            'outbound': [
                float(today_out_qty),
                float(week_out_qty),
                float(month_out_qty),
            ],
        },
        'flip_cards': {
            'total_stock': float(total_stock),
            'turnover_rate': float(turnover_rate),
            'today_in_count': today_in_count,
            'today_out_count': today_out_count,
        },
        'warnings': warnings,
    })
