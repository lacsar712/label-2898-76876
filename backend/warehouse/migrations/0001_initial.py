from django.db import migrations, models
import django.db.models.deletion
import django.utils.timezone


class Migration(migrations.Migration):

    initial = True

    dependencies = [
    ]

    operations = [
        migrations.CreateModel(
            name='MeasureUnit',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name', models.CharField(max_length=20, unique=True, verbose_name='单位名称')),
            ],
            options={
                'verbose_name': '计量单位',
                'verbose_name_plural': '计量单位',
                'ordering': ['id'],
            },
        ),
        migrations.CreateModel(
            name='GoodsCategory',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name', models.CharField(max_length=50, unique=True, verbose_name='品类名称')),
            ],
            options={
                'verbose_name': '物资品类',
                'verbose_name_plural': '物资品类',
                'ordering': ['id'],
            },
        ),
        migrations.CreateModel(
            name='GoodsVariety',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name', models.CharField(max_length=100, verbose_name='品种名称')),
                ('stock_quantity', models.DecimalField(decimal_places=2, default=0, max_digits=12, verbose_name='库存数量')),
                ('category', models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name='varieties', to='warehouse.goodscategory', verbose_name='所属品类')),
                ('unit', models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name='varieties', to='warehouse.measureunit', verbose_name='计量单位')),
            ],
            options={
                'verbose_name': '物资品种',
                'verbose_name_plural': '物资品种',
                'ordering': ['id'],
                'unique_together': {('name', 'category')},
            },
        ),
        migrations.CreateModel(
            name='Warehouse',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name', models.CharField(max_length=50, unique=True, verbose_name='库区名称')),
                ('code', models.CharField(max_length=20, unique=True, verbose_name='库区编码')),
                ('location', models.CharField(blank=True, default='', max_length=100, verbose_name='所在位置')),
                ('manager', models.CharField(blank=True, default='', max_length=30, verbose_name='负责人')),
                ('remark', models.TextField(blank=True, default='', verbose_name='备注')),
                ('created_at', models.DateTimeField(auto_now_add=True, verbose_name='创建时间')),
            ],
            options={
                'verbose_name': '库区',
                'verbose_name_plural': '库区',
                'ordering': ['id'],
            },
        ),
        migrations.CreateModel(
            name='WarehouseStock',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('stock_quantity', models.DecimalField(decimal_places=2, default=0, max_digits=12, verbose_name='库存数量')),
                ('updated_at', models.DateTimeField(auto_now=True, verbose_name='更新时间')),
                ('variety', models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name='warehouse_stocks', to='warehouse.goodsvariety', verbose_name='物资品种')),
                ('warehouse', models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name='stocks', to='warehouse.warehouse', verbose_name='库区')),
            ],
            options={
                'verbose_name': '库区库存',
                'verbose_name_plural': '库区库存',
                'ordering': ['warehouse', 'variety'],
                'unique_together': {('warehouse', 'variety')},
            },
        ),
        migrations.CreateModel(
            name='TransferOrder',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('transfer_no', models.CharField(max_length=30, unique=True, verbose_name='调拨单号')),
                ('quantity', models.DecimalField(decimal_places=2, max_digits=12, verbose_name='调拨数量')),
                ('applicant', models.CharField(max_length=30, verbose_name='申请人')),
                ('status', models.CharField(choices=[('pending', '待审批'), ('approved', '已通过'), ('rejected', '已驳回'), ('executed', '已执行')], default='pending', max_length=15, verbose_name='审批状态')),
                ('apply_time', models.DateTimeField(auto_now_add=True, verbose_name='申请时间')),
                ('execute_time', models.DateTimeField(blank=True, null=True, verbose_name='执行时间')),
                ('approver', models.CharField(blank=True, default='', max_length=30, verbose_name='审批人')),
                ('approval_remark', models.TextField(blank=True, default='', verbose_name='审批意见')),
                ('approval_time', models.DateTimeField(blank=True, null=True, verbose_name='审批时间')),
                ('executor', models.CharField(blank=True, default='', max_length=30, verbose_name='执行人')),
                ('remark', models.TextField(blank=True, default='', verbose_name='备注')),
                ('created_at', models.DateTimeField(auto_now_add=True, verbose_name='创建时间')),
                ('source_warehouse', models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name='source_transfers', to='warehouse.warehouse', verbose_name='源库区')),
                ('target_warehouse', models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name='target_transfers', to='warehouse.warehouse', verbose_name='目标库区')),
                ('variety', models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name='transfer_records', to='warehouse.goodsvariety', verbose_name='物资品种')),
            ],
            options={
                'verbose_name': '调拨单',
                'verbose_name_plural': '调拨单',
                'ordering': ['-apply_time', '-id'],
            },
        ),
        migrations.CreateModel(
            name='TransferOrderLog',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('action', models.CharField(choices=[('create', '创建申请'), ('approve', '审批通过'), ('reject', '审批驳回'), ('execute', '执行调拨')], max_length=20, verbose_name='操作类型')),
                ('operator', models.CharField(max_length=30, verbose_name='操作人')),
                ('remark', models.TextField(blank=True, default='', verbose_name='备注')),
                ('created_at', models.DateTimeField(auto_now_add=True, verbose_name='操作时间')),
                ('transfer_order', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='logs', to='warehouse.transferorder', verbose_name='调拨单')),
            ],
            options={
                'verbose_name': '调拨单流转记录',
                'verbose_name_plural': '调拨单流转记录',
                'ordering': ['created_at', 'id'],
            },
        ),
        migrations.CreateModel(
            name='GoodsOutbound',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('outbound_no', models.CharField(max_length=30, unique=True, verbose_name='出库单号')),
                ('quantity', models.DecimalField(decimal_places=2, max_digits=12, verbose_name='出库数量')),
                ('receiving_unit', models.CharField(max_length=100, verbose_name='领用连队')),
                ('receiver', models.CharField(max_length=30, verbose_name='领用人')),
                ('outbound_date', models.DateField(default=django.utils.timezone.now, verbose_name='出库日期')),
                ('operator', models.CharField(blank=True, default='', max_length=30, verbose_name='经办出库员')),
                ('purpose', models.CharField(blank=True, default='', max_length=200, verbose_name='领用用途')),
                ('remark', models.TextField(blank=True, default='', verbose_name='备注')),
                ('status', models.CharField(choices=[('draft', '草稿'), ('approved', '已审核'), ('completed', '已完成')], default='completed', max_length=10, verbose_name='单据状态')),
                ('created_at', models.DateTimeField(auto_now_add=True, verbose_name='创建时间')),
                ('variety', models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name='outbound_records', to='warehouse.goodsvariety', verbose_name='物资品种')),
            ],
            options={
                'verbose_name': '出库记录',
                'verbose_name_plural': '出库记录',
                'ordering': ['-outbound_date', '-id'],
            },
        ),
        migrations.CreateModel(
            name='GoodsInbound',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('inbound_no', models.CharField(max_length=30, unique=True, verbose_name='入库单号')),
                ('quantity', models.DecimalField(decimal_places=2, max_digits=12, verbose_name='入库数量')),
                ('supplier', models.CharField(blank=True, default='', max_length=100, verbose_name='供应商名称')),
                ('inbound_date', models.DateField(default=django.utils.timezone.now, verbose_name='入库日期')),
                ('operator', models.CharField(blank=True, default='', max_length=30, verbose_name='经办入库员')),
                ('remark', models.TextField(blank=True, default='', verbose_name='备注')),
                ('status', models.CharField(choices=[('draft', '草稿'), ('approved', '已审核'), ('completed', '已完成')], default='completed', max_length=10, verbose_name='单据状态')),
                ('created_at', models.DateTimeField(auto_now_add=True, verbose_name='创建时间')),
                ('variety', models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name='inbound_records', to='warehouse.goodsvariety', verbose_name='物资品种')),
            ],
            options={
                'verbose_name': '入库记录',
                'verbose_name_plural': '入库记录',
                'ordering': ['-inbound_date', '-id'],
            },
        ),
    ]
