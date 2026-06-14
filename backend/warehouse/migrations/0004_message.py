from django.db import migrations, models
import django.utils.timezone


class Migration(migrations.Migration):

    dependencies = [
        ('warehouse', '0003_warehousezone'),
    ]

    operations = [
        migrations.CreateModel(
            name='Message',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('title', models.CharField(max_length=200, verbose_name='标题')),
                ('content', models.TextField(verbose_name='内容')),
                ('message_type', models.CharField(
                    choices=[('system', '系统消息'), ('approval', '审批消息'), ('warning', '预警消息')],
                    db_index=True, max_length=20, verbose_name='消息类型',
                )),
                ('sender', models.CharField(blank=True, default='system', max_length=100, verbose_name='发送人')),
                ('receiver', models.CharField(db_index=True, max_length=100, verbose_name='接收人')),
                ('is_read', models.BooleanField(db_index=True, default=False, verbose_name='是否已读')),
                ('created_at', models.DateTimeField(db_index=True, default=django.utils.timezone.now, verbose_name='创建时间')),
                ('biz_no', models.CharField(blank=True, db_index=True, default='', max_length=100, verbose_name='关联业务单号')),
                ('biz_type', models.CharField(blank=True, default='', max_length=50, verbose_name='关联业务类型')),
                ('biz_url', models.CharField(blank=True, default='', max_length=500, verbose_name='关联业务页面URL')),
            ],
            options={
                'verbose_name': '消息',
                'verbose_name_plural': '消息',
                'ordering': ['-created_at', '-id'],
            },
        ),
    ]
