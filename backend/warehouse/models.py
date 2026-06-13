from django.db import models
from django.utils import timezone


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
    supplier = models.CharField('供应商', max_length=100, blank=True, default='')
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
