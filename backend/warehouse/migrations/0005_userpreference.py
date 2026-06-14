from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('auth', '0012_alter_user_first_name_max_length'),
        ('warehouse', '0004_message'),
    ]

    operations = [
        migrations.CreateModel(
            name='UserPreference',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('default_page_size', models.IntegerField(choices=[(10, '10条'), (20, '20条'), (50, '50条'), (100, '100条')], default=20, verbose_name='默认分页条数')),
                ('page_transition_animation', models.BooleanField(default=True, verbose_name='页面过渡动画')),
                ('operation_sound', models.BooleanField(default=True, verbose_name='操作提示音')),
                ('created_at', models.DateTimeField(auto_now_add=True, verbose_name='创建时间')),
                ('updated_at', models.DateTimeField(auto_now=True, verbose_name='更新时间')),
                ('user', models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name='preferences', to='auth.user', verbose_name='用户')),
            ],
            options={
                'verbose_name': '用户偏好',
                'verbose_name_plural': '用户偏好',
            },
        ),
    ]
