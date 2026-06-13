from django.db import migrations, models
import django.db.models.deletion
import django.utils.timezone


class Migration(migrations.Migration):

    dependencies = [
        ('warehouse', '0001_initial'),
    ]

    operations = [
        migrations.CreateModel(
            name='Supplier',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('code', models.CharField(max_length=30, unique=True, verbose_name='供应商编码')),
                ('name', models.CharField(max_length=100, verbose_name='供应商名称')),
                ('contact_person', models.CharField(blank=True, default='', max_length=30, verbose_name='联系人')),
                ('phone', models.CharField(blank=True, default='', max_length=20, verbose_name='电话')),
                ('address', models.CharField(blank=True, default='', max_length=200, verbose_name='地址')),
                ('status', models.CharField(choices=[('active', '合作中'), ('paused', '暂停'), ('terminated', '终止')], default='active', max_length=15, verbose_name='合作状态')),
                ('rating', models.CharField(choices=[('A', 'A'), ('B', 'B'), ('C', 'C')], default='B', max_length=5, verbose_name='评级')),
                ('cooperation_date', models.DateField(default=django.utils.timezone.now, verbose_name='合作起始日期')),
                ('remark', models.TextField(blank=True, default='', verbose_name='备注')),
                ('created_at', models.DateTimeField(auto_now_add=True, verbose_name='创建时间')),
                ('updated_at', models.DateTimeField(auto_now=True, verbose_name='更新时间')),
                ('categories', models.ManyToManyField(blank=True, related_name='suppliers', to='warehouse.goodscategory', verbose_name='供应品类')),
            ],
            options={
                'verbose_name': '供应商',
                'verbose_name_plural': '供应商',
                'ordering': ['code'],
            },
        ),
        migrations.CreateModel(
            name='SupplierRatingLog',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('old_rating', models.CharField(choices=[('A', 'A'), ('B', 'B'), ('C', 'C')], max_length=5, verbose_name='原评级')),
                ('new_rating', models.CharField(choices=[('A', 'A'), ('B', 'B'), ('C', 'C')], max_length=5, verbose_name='新评级')),
                ('operator', models.CharField(max_length=30, verbose_name='操作人')),
                ('remark', models.TextField(blank=True, default='', verbose_name='变更备注')),
                ('created_at', models.DateTimeField(auto_now_add=True, verbose_name='变更时间')),
                ('supplier', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='rating_logs', to='warehouse.supplier', verbose_name='供应商')),
            ],
            options={
                'verbose_name': '供应商评级变更记录',
                'verbose_name_plural': '供应商评级变更记录',
                'ordering': ['-created_at', '-id'],
            },
        ),
        migrations.AddField(
            model_name='goodsinbound',
            name='supplier_ref',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.PROTECT, related_name='inbound_records', to='warehouse.supplier', verbose_name='供应商'),
        ),
    ]
