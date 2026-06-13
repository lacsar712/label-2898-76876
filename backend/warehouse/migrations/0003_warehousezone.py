from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('warehouse', '0002_supplier'),
    ]

    operations = [
        migrations.CreateModel(
            name='WarehouseZone',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('code', models.CharField(max_length=30, unique=True, verbose_name='分区编码')),
                ('name', models.CharField(max_length=50, verbose_name='分区名称')),
                ('area', models.DecimalField(decimal_places=2, default=0, max_digits=10, verbose_name='面积(㎡)')),
                ('capacity_limit', models.DecimalField(decimal_places=2, default=0, max_digits=12, verbose_name='容量上限')),
                ('manager', models.CharField(blank=True, default='', max_length=30, verbose_name='负责人')),
                ('phone', models.CharField(blank=True, default='', max_length=20, verbose_name='联系电话')),
                ('status', models.CharField(choices=[('normal', '正常'), ('maintenance', '维护中'), ('disabled', '停用')], default='normal', max_length=15, verbose_name='运行状态')),
                ('remark', models.TextField(blank=True, default='', verbose_name='备注')),
                ('created_at', models.DateTimeField(auto_now_add=True, verbose_name='创建时间')),
                ('updated_at', models.DateTimeField(auto_now=True, verbose_name='更新时间')),
                ('warehouse', models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name='zones', to='warehouse.warehouse', verbose_name='所属库房')),
            ],
            options={
                'verbose_name': '库房分区',
                'verbose_name_plural': '库房分区',
                'ordering': ['warehouse', 'code'],
            },
        ),
    ]
