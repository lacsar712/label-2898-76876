from django.db import models
from django.utils import timezone
from decimal import Decimal


class MeasureUnit(models.Model):
    name = models.CharField('单位名称', max_length=20, unique=True)

    class Meta:
        verbose_name = '计量单位'
        verbose_name_plural = '计量单位'
        ordering = ['id']

    def __str__(self):
        return self.name


class GoodsCategory(models.Model):
    name = models.CharField('品类名称', max_length=50, unique=True)

    class Meta:
        verbose_name = '物资品类'
        verbose_name_plural = '物资品类'
        ordering = ['id']

    def __str__(self):
        return self.name


class GoodsVariety(models.Model):
    name = models.CharField('品种名称', max_length=100)
    category = models.ForeignKey(
        GoodsCategory, on_delete=models.PROTECT,
        verbose_name='所属品类', related_name='varieties',
    )
    unit = models.ForeignKey(
        MeasureUnit, on_delete=models.PROTECT,
        verbose_name='计量单位', related_name='varieties',
    )
    stock_quantity = models.DecimalField(
        '库存数量', max_digits=12, decimal_places=2, default=0,
    )

    class Meta:
        verbose_name = '物资品种'
        verbose_name_plural = '物资品种'
        ordering = ['id']
        unique_together = ('name', 'category')

    def __str__(self):
        return f'{self.name}({self.category.name})'


class GoodsInbound(models.Model):
    inbound_no = models.CharField('入库单号', max_length=30, unique=True)
    variety = models.ForeignKey(
        GoodsVariety, on_delete=models.PROTECT,
        verbose_name='物资品种', related_name='inbound_records',
    )
    quantity = models.DecimalField('入库数量', max_digits=12, decimal_places=2)
    supplier_ref = models.ForeignKey(
        Supplier, on_delete=models.PROTECT,
        verbose_name='供应商', related_name='inbound_records',
        null=True, blank=True,
    )
    supplier = models.CharField('供应商名称', max_length=100, blank=True, default='')
    inbound_date = models.DateField('入库日期', default=timezone.now)
    operator = models.CharField('经办入库员', max_length=30, blank=True, default='')
    remark = models.TextField('备注', blank=True, default='')
    status = models.CharField(
        '单据状态', max_length=10,
        choices=[('draft', '草稿'), ('approved', '已审核'), ('completed', '已完成')],
        default='completed',
    )
    created_at = models.DateTimeField('创建时间', auto_now_add=True)

    class Meta:
        verbose_name = '入库记录'
        verbose_name_plural = '入库记录'
        ordering = ['-inbound_date', '-id']

    def __str__(self):
        return self.inbound_no

    def save(self, *args, **kwargs):
        is_new = self.pk is None
        if self.supplier_ref and not self.supplier:
            self.supplier = self.supplier_ref.name
        super().save(*args, **kwargs)
        if is_new and self.status == 'completed':
            self.variety.stock_quantity += self.quantity
            self.variety.save(update_fields=['stock_quantity'])


def generate_outbound_no():
    today = timezone.now().strftime('%Y%m%d')
    prefix = f'CK{today}'
    last = GoodsOutbound.objects.filter(
        outbound_no__startswith=prefix,
    ).order_by('-outbound_no').first()
    if last:
        seq = int(last.outbound_no[-3:]) + 1
    else:
        seq = 1
    return f'{prefix}{seq:03d}'


class GoodsOutbound(models.Model):
    STATUS_CHOICES = [
        ('draft', '草稿'),
        ('approved', '已审核'),
        ('completed', '已完成'),
    ]
    outbound_no = models.CharField(
        '出库单号', max_length=30, unique=True, default=generate_outbound_no,
    )
    variety = models.ForeignKey(
        GoodsVariety, on_delete=models.PROTECT,
        verbose_name='物资品种', related_name='outbound_records',
    )
    quantity = models.DecimalField('出库数量', max_digits=12, decimal_places=2)
    receiving_unit = models.CharField('领用连队', max_length=100)
    receiver = models.CharField('领用人', max_length=30)
    outbound_date = models.DateField('出库日期', default=timezone.now)
    operator = models.CharField('经办出库员', max_length=30, blank=True, default='')
    purpose = models.CharField('领用用途', max_length=200, blank=True, default='')
    remark = models.TextField('备注', blank=True, default='')
    status = models.CharField(
        '单据状态', max_length=10,
        choices=STATUS_CHOICES, default='completed',
    )
    created_at = models.DateTimeField('创建时间', auto_now_add=True)

    class Meta:
        verbose_name = '出库记录'
        verbose_name_plural = '出库记录'
        ordering = ['-outbound_date', '-id']

    def __str__(self):
        return self.outbound_no

    def save(self, *args, **kwargs):
        is_new = self.pk is None
        super().save(*args, **kwargs)
        if is_new and self.status == 'completed':
            self.variety.stock_quantity -= self.quantity
            self.variety.save(update_fields=['stock_quantity'])


class Warehouse(models.Model):
    name = models.CharField('库区名称', max_length=50, unique=True)
    code = models.CharField('库区编码', max_length=20, unique=True)
    location = models.CharField('所在位置', max_length=100, blank=True, default='')
    manager = models.CharField('负责人', max_length=30, blank=True, default='')
    remark = models.TextField('备注', blank=True, default='')
    created_at = models.DateTimeField('创建时间', auto_now_add=True)

    class Meta:
        verbose_name = '库区'
        verbose_name_plural = '库区'
        ordering = ['id']

    def __str__(self):
        return self.name


class WarehouseStock(models.Model):
    warehouse = models.ForeignKey(
        Warehouse, on_delete=models.PROTECT,
        verbose_name='库区', related_name='stocks',
    )
    variety = models.ForeignKey(
        GoodsVariety, on_delete=models.PROTECT,
        verbose_name='物资品种', related_name='warehouse_stocks',
    )
    stock_quantity = models.DecimalField(
        '库存数量', max_digits=12, decimal_places=2, default=0,
    )
    updated_at = models.DateTimeField('更新时间', auto_now=True)

    class Meta:
        verbose_name = '库区库存'
        verbose_name_plural = '库区库存'
        ordering = ['warehouse', 'variety']
        unique_together = ('warehouse', 'variety')

    def __str__(self):
        return f'{self.warehouse.name} - {self.variety.name}'


def generate_transfer_no():
    today = timezone.now().strftime('%Y%m%d')
    prefix = f'DB{today}'
    last = TransferOrder.objects.filter(
        transfer_no__startswith=prefix,
    ).order_by('-transfer_no').first()
    if last:
        seq = int(last.transfer_no[-3:]) + 1
    else:
        seq = 1
    return f'{prefix}{seq:03d}'


class TransferOrder(models.Model):
    STATUS_PENDING = 'pending'
    STATUS_APPROVED = 'approved'
    STATUS_REJECTED = 'rejected'
    STATUS_EXECUTED = 'executed'

    STATUS_CHOICES = [
        (STATUS_PENDING, '待审批'),
        (STATUS_APPROVED, '已通过'),
        (STATUS_REJECTED, '已驳回'),
        (STATUS_EXECUTED, '已执行'),
    ]

    transfer_no = models.CharField(
        '调拨单号', max_length=30, unique=True, default=generate_transfer_no,
    )
    source_warehouse = models.ForeignKey(
        Warehouse, on_delete=models.PROTECT,
        verbose_name='源库区', related_name='source_transfers',
    )
    target_warehouse = models.ForeignKey(
        Warehouse, on_delete=models.PROTECT,
        verbose_name='目标库区', related_name='target_transfers',
    )
    variety = models.ForeignKey(
        GoodsVariety, on_delete=models.PROTECT,
        verbose_name='物资品种', related_name='transfer_records',
    )
    quantity = models.DecimalField('调拨数量', max_digits=12, decimal_places=2)
    applicant = models.CharField('申请人', max_length=30)
    status = models.CharField(
        '审批状态', max_length=15,
        choices=STATUS_CHOICES, default=STATUS_PENDING,
    )
    apply_time = models.DateTimeField('申请时间', auto_now_add=True)
    execute_time = models.DateTimeField('执行时间', null=True, blank=True)
    approver = models.CharField('审批人', max_length=30, blank=True, default='')
    approval_remark = models.TextField('审批意见', blank=True, default='')
    approval_time = models.DateTimeField('审批时间', null=True, blank=True)
    executor = models.CharField('执行人', max_length=30, blank=True, default='')
    remark = models.TextField('备注', blank=True, default='')
    created_at = models.DateTimeField('创建时间', auto_now_add=True)

    class Meta:
        verbose_name = '调拨单'
        verbose_name_plural = '调拨单'
        ordering = ['-apply_time', '-id']

    def __str__(self):
        return self.transfer_no

    def get_source_stock(self):
        try:
            stock = WarehouseStock.objects.get(
                warehouse=self.source_warehouse,
                variety=self.variety,
            )
            return stock.stock_quantity
        except WarehouseStock.DoesNotExist:
            return Decimal('0')


class TransferOrderLog(models.Model):
    ACTION_CREATE = 'create'
    ACTION_APPROVE = 'approve'
    ACTION_REJECT = 'reject'
    ACTION_EXECUTE = 'execute'

    ACTION_CHOICES = [
        (ACTION_CREATE, '创建申请'),
        (ACTION_APPROVE, '审批通过'),
        (ACTION_REJECT, '审批驳回'),
        (ACTION_EXECUTE, '执行调拨'),
    ]

    transfer_order = models.ForeignKey(
        TransferOrder, on_delete=models.CASCADE,
        verbose_name='调拨单', related_name='logs',
    )
    action = models.CharField('操作类型', max_length=20, choices=ACTION_CHOICES)
    operator = models.CharField('操作人', max_length=30)
    remark = models.TextField('备注', blank=True, default='')
    created_at = models.DateTimeField('操作时间', auto_now_add=True)

    class Meta:
        verbose_name = '调拨单流转记录'
        verbose_name_plural = '调拨单流转记录'
        ordering = ['created_at', 'id']

    def __str__(self):
        return f'{self.transfer_order.transfer_no} - {self.get_action_display()}'


class Supplier(models.Model):
    STATUS_ACTIVE = 'active'
    STATUS_PAUSED = 'paused'
    STATUS_TERMINATED = 'terminated'

    STATUS_CHOICES = [
        (STATUS_ACTIVE, '合作中'),
        (STATUS_PAUSED, '暂停'),
        (STATUS_TERMINATED, '终止'),
    ]

    RATING_A = 'A'
    RATING_B = 'B'
    RATING_C = 'C'

    RATING_CHOICES = [
        (RATING_A, 'A'),
        (RATING_B, 'B'),
        (RATING_C, 'C'),
    ]

    code = models.CharField('供应商编码', max_length=30, unique=True)
    name = models.CharField('供应商名称', max_length=100)
    contact_person = models.CharField('联系人', max_length=30, blank=True, default='')
    phone = models.CharField('电话', max_length=20, blank=True, default='')
    address = models.CharField('地址', max_length=200, blank=True, default='')
    categories = models.ManyToManyField(
        GoodsCategory,
        verbose_name='供应品类',
        related_name='suppliers',
        blank=True,
    )
    status = models.CharField(
        '合作状态',
        max_length=15,
        choices=STATUS_CHOICES,
        default=STATUS_ACTIVE,
    )
    rating = models.CharField(
        '评级',
        max_length=5,
        choices=RATING_CHOICES,
        default=RATING_B,
    )
    cooperation_date = models.DateField('合作起始日期', default=timezone.now)
    remark = models.TextField('备注', blank=True, default='')
    created_at = models.DateTimeField('创建时间', auto_now_add=True)
    updated_at = models.DateTimeField('更新时间', auto_now=True)

    class Meta:
        verbose_name = '供应商'
        verbose_name_plural = '供应商'
        ordering = ['code']

    def __str__(self):
        return f'{self.code} - {self.name}'


class SupplierRatingLog(models.Model):
    supplier = models.ForeignKey(
        Supplier,
        on_delete=models.CASCADE,
        verbose_name='供应商',
        related_name='rating_logs',
    )
    old_rating = models.CharField('原评级', max_length=5, choices=Supplier.RATING_CHOICES)
    new_rating = models.CharField('新评级', max_length=5, choices=Supplier.RATING_CHOICES)
    operator = models.CharField('操作人', max_length=30)
    remark = models.TextField('变更备注', blank=True, default='')
    created_at = models.DateTimeField('变更时间', auto_now_add=True)

    class Meta:
        verbose_name = '供应商评级变更记录'
        verbose_name_plural = '供应商评级变更记录'
        ordering = ['-created_at', '-id']

    def __str__(self):
        return f'{self.supplier.name} {self.old_rating}→{self.new_rating}'
