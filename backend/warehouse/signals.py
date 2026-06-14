from django.db.models.signals import post_delete
from django.dispatch import receiver
from django.contrib.auth.signals import user_logged_in, user_logged_out
from .models import OperationLog, GoodsInbound, GoodsOutbound, Supplier, TransferOrder


def get_client_ip(request):
    if request is None:
        return None
    x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
    if x_forwarded_for:
        ip = x_forwarded_for.split(',')[0].strip()
    else:
        ip = request.META.get('REMOTE_ADDR')
    return ip


@receiver(user_logged_in)
def log_user_login(sender, request, user, **kwargs):
    OperationLog.log(
        action_type=OperationLog.ACTION_LOGIN,
        operator=user.username,
        target_object='系统登录',
        ip_address=get_client_ip(request),
        detail={'user_id': user.id, 'username': user.username},
    )


@receiver(user_logged_out)
def log_user_logout(sender, request, user, **kwargs):
    if user and user.is_authenticated:
        OperationLog.log(
            action_type=OperationLog.ACTION_LOGOUT,
            operator=user.username,
            target_object='系统登出',
            ip_address=get_client_ip(request),
            detail={'user_id': user.id, 'username': user.username},
        )


@receiver(post_delete, sender=GoodsInbound)
def log_inbound_delete(sender, instance, **kwargs):
    OperationLog.log(
        action_type=OperationLog.ACTION_DELETE,
        operator=getattr(instance, '_deleted_by', 'system'),
        target_object=f'入库记录-{instance.inbound_no}',
        detail={
            'inbound_no': instance.inbound_no,
            'variety': instance.variety.name if instance.variety else '',
            'quantity': str(instance.quantity),
        },
    )


@receiver(post_delete, sender=GoodsOutbound)
def log_outbound_delete(sender, instance, **kwargs):
    OperationLog.log(
        action_type=OperationLog.ACTION_DELETE,
        operator=getattr(instance, '_deleted_by', 'system'),
        target_object=f'出库记录-{instance.outbound_no}',
        detail={
            'outbound_no': instance.outbound_no,
            'variety': instance.variety.name if instance.variety else '',
            'quantity': str(instance.quantity),
        },
    )


@receiver(post_delete, sender=Supplier)
def log_supplier_delete(sender, instance, **kwargs):
    OperationLog.log(
        action_type=OperationLog.ACTION_DELETE,
        operator=getattr(instance, '_deleted_by', 'system'),
        target_object=f'供应商-{instance.code}',
        detail={
            'supplier_code': instance.code,
            'supplier_name': instance.name,
        },
    )


@receiver(post_delete, sender=TransferOrder)
def log_transfer_delete(sender, instance, **kwargs):
    OperationLog.log(
        action_type=OperationLog.ACTION_DELETE,
        operator=getattr(instance, '_deleted_by', 'system'),
        target_object=f'调拨单-{instance.transfer_no}',
        detail={
            'transfer_no': instance.transfer_no,
            'variety': instance.variety.name if instance.variety else '',
            'quantity': str(instance.quantity),
        },
    )
