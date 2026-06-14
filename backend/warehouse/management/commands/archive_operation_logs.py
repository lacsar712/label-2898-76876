from django.core.management.base import BaseCommand
from django.utils import timezone
from django.conf import settings
from datetime import timedelta
from warehouse.models import OperationLog, OperationLogArchive


class Command(BaseCommand):
    help = '归档超过保留期限的操作日志到历史分区'

    def add_arguments(self, parser):
        parser.add_argument(
            '--days', type=int, default=None,
            help='自定义保留天数（覆盖 settings.OPERATION_LOG_RETENTION_DAYS）',
        )
        parser.add_argument(
            '--dry-run', action='store_true',
            help='仅预览将归档的数量，不实际执行',
        )

    def handle(self, *args, **options):
        retention_days = options.get('days') or getattr(settings, 'OPERATION_LOG_RETENTION_DAYS', 90)
        dry_run = options.get('dry_run')

        cutoff_date = timezone.now() - timedelta(days=retention_days)
        logs_to_archive = OperationLog.objects.filter(action_time__lt=cutoff_date)
        count = logs_to_archive.count()

        self.stdout.write(
            self.style.WARNING(f'保留天数: {retention_days} 天')
        )
        self.stdout.write(
            self.style.WARNING(f'截止日期: {cutoff_date.strftime("%Y-%m-%d %H:%M:%S")}')
        )
        self.stdout.write(
            self.style.WARNING(f'待归档日志数量: {count} 条')
        )

        if dry_run:
            self.stdout.write(
                self.style.SUCCESS('（预览模式，未执行实际归档')
            )
            return

        if count == 0:
            self.stdout.write(
                self.style.SUCCESS('没有需要归档的日志')
            )
            return

        archived_logs = []
        for log in logs_to_archive.iterator():
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

        OperationLog.objects.create(
            action_type=OperationLog.ACTION_ARCHIVE,
            operator='system',
            target_object='操作日志归档',
            detail={
                'retention_days': retention_days,
                'cutoff_date': cutoff_date.strftime('%Y-%m-%d'),
                'archived_count': count,
            },
        )

        self.stdout.write(
            self.style.SUCCESS(f'成功归档 {count} 条日志到历史分区')
        )
